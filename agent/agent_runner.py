from __future__ import annotations

import json
import os
import time
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple

from requests.exceptions import HTTPError
from .prompts import (
    TASK_PLANNER_PROMPT,
    TASK_PLANNER_STRICT_PROMPT,
    FINAL_SUMMARY_PROMPT,
    INTERMEDIATE_SUMMARY_PROMPT,
    MERGE_SUMMARY_PROMPT,
    REQUEST_MANAGER_PROMPT,
    PROJECT_MANAGER_PROMPT,
    PROJECT_PLANNER_PROMPT,
    ROUTE_PLANNER_PROMPT,
    DEBUG_ENGINEERING_PROMPT,
    DISCOVERY_PROMPT,
    REASONER_PROMPT,
    PLAN_RESOLVER_PROMPT,
    EXPLAINER_PROMPT,
    EXPLAIN_DISCOVERY_PROMPT,
    EXPLAIN_PLANNER_PROMPT,
)

# Soglie payload summary (abbassate per evitare 400 su Ollama)
MAX_SUMMARY_CHUNK_CHARS = 2_000   # ogni chunk intermedio e singolo summary
MAX_SUMMARY_MERGE_CHARS = 2_000  # merge finale (request + summaries)

class AgentRunnerMixin:
    def _get_available_tools_for_planner(self) -> List[Dict[str, Any]]:
        """Build list of {name, description} for task/request planner (excludes python_exec)."""
        out: List[Dict[str, Any]] = []
        for name in self._tool_names():
            if name == "python_exec":
                continue
            spec = getattr(self.registry, "_tools", {}).get(name)
            if spec is not None and getattr(spec, "description", None):
                out.append({"name": name, "description": spec.description})
        return out

    def _classify_request(self, user_text_en: str) -> Tuple[str, Dict[str, Any], str]:
        """Classify request into project|debug|explain|tool. Returns (channel, enriched_context, raw_output)."""
        available_tools = self._get_available_tools_for_planner()
        user_payload = {"request": user_text_en, "available_tools": available_tools}
        user_content = json.dumps(user_payload, ensure_ascii=False)
        messages = [
            {"role": "system", "content": REQUEST_MANAGER_PROMPT},
            {"role": "user", "content": user_content},
        ]
        try:
            out = self._chat_text(messages, client="request_manager")
        except Exception:
            return ("project", {}, "")
        raw = out if isinstance(out, str) else ""
        parsed = self._safe_json(raw)
        if isinstance(parsed, dict):
            ch = str(parsed.get("channel", "project")).strip().lower()
            if ch in ("project", "debug", "explain", "tool"):
                return (ch, {"reason": parsed.get("reason", "")}, raw)
        return ("project", {}, raw)

    def _run_orchestrator_search(
        self,
        elements_json: Dict[str, Any],
        repo_index_light: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Search workdir for elements. Returns collected material."""
        collected: List[Dict[str, Any]] = []
        elements = elements_json.get("elements") if isinstance(elements_json, dict) else []
        if not isinstance(elements, list) or not elements:
            return collected
        files = repo_index_light.get("files") or []
        py_symbols = repo_index_light.get("py_symbols") or []
        base_dir = getattr(self.system_tools, "base_dir", "") or "."
        for el in elements:
            if not isinstance(el, dict):
                continue
            el_type = str(el.get("type", "")).lower()
            search_hint = str(el.get("search", ""))
            if not search_hint:
                continue
            # Match files
            matched_files = [f for f in files if search_hint.lower() in f.lower()]
            for path in matched_files[:10]:
                res = self.system_tools.read_file(path)
                if isinstance(res, dict) and res.get("ok"):
                    collected.append({"element": el, "path": path, "content": res.get("content", ""), "type": "file"})
            # Match py_symbols (functions, classes)
            for sym in py_symbols:
                if not isinstance(sym, dict):
                    continue
                name = str(sym.get("name", ""))
                path = str(sym.get("path", ""))
                if search_hint.lower() in name.lower() or search_hint.lower() in path.lower():
                    res = self.system_tools.read_file(path)
                    content = res.get("content", "") if isinstance(res, dict) and res.get("ok") else ""
                    collected.append({"element": el, "path": path, "name": name, "content": content[:2000], "type": "symbol"})
            # search_text if no matches yet
            if not collected or len([c for c in collected if c.get("element") == el]) == 0:
                try:
                    sr = self.registry.dispatch("search_text", {"path": base_dir, "pattern": search_hint, "max_results": 5})
                except Exception:
                    sr = {}
                if isinstance(sr, dict) and sr.get("results"):
                    for m in (sr.get("results") or [])[:5]:
                        fp = m.get("file") or m.get("path") or ""
                        if fp and fp not in [c.get("path") for c in collected]:
                            res = self.system_tools.read_file(fp)
                            if isinstance(res, dict) and res.get("ok"):
                                collected.append({"element": el, "path": fp, "content": res.get("content", "")[:2000], "type": "search"})
        return collected

    def run(
        self,
        user_text: str,
        approval_handler: Optional[Callable[[Dict[str, Any]], bool]] = None,
        allowed_files: Optional[List[str]] = None,
    ) -> Iterable[Tuple[str, str]]:
        yield ("SYS", f"Models: task_planner={self.task_planner_client.model} planner={self.planner_client.model} tool={self.tool_client.model} final={self.final_client.model} summary={self.summary_client.model} translator={self.translator_client.model} coder={self.coder_client.model} debugger={self.debugger_client.model} tool_analysis={self.tool_analysis_client.model} tool_argument={self.tool_argument_client.model}")
        # Translate user input to English for all model prompts
        yield ("SYS", "Translator: traduzione in inglese...")
        user_text_en = self._translate_to_english(user_text)
        yield from self._yield_token_usage()
        user_text_en_clean = self._sanitize_translated_input(user_text_en)
        self._last_user_text_en = user_text_en_clean
        yield ("TRANSLATED_CLEAN", user_text_en_clean)
        yield ("ATTEMPT", "translator:global:1")

        # Request Manager: classify into project|debug|explain
        yield ("SYS", "Request Manager: classificazione richiesta...")
        channel, ctx, rm_raw = self._classify_request(user_text_en_clean)
        yield from self._yield_token_usage()
        yield ("REQUEST_MANAGER_RAW", rm_raw or json.dumps({"channel": channel, **ctx}, ensure_ascii=False))
        yield ("ATTEMPT", "request_manager:global:1")
        yield ("SYS", f"Request Manager: {channel}")

        self._ensure_index()
        repo_index = self._load_index()
        files = repo_index.get("files", [])
        scoped: List[str] = []
        if allowed_files is not None and len(allowed_files) > 0:
            scoped = list(dict.fromkeys(p.rstrip(".") for p in allowed_files))[:200]
        elif isinstance(files, list):
            scoped = files[:200]
        py_symbols_raw = repo_index.get("py_symbols") or []
        scoped_set = set(scoped)
        py_symbols_scoped = [s for s in py_symbols_raw if isinstance(s, dict) and s.get("path") in scoped_set]
        repo_index_light = {"files": scoped, "py_symbols": py_symbols_scoped}

        # Dispatch to channel and get tasks
        tasks: List[Dict[str, Any]] = []
        if channel == "project":
            for ev in self._run_project_channel(user_text_en_clean, repo_index_light):
                if ev[0] == "TASKS":
                    tasks = ev[1] if isinstance(ev[1], list) else []
                    break
                yield ev
        elif channel == "debug":
            for ev in self._run_debug_channel(user_text_en_clean, repo_index_light):
                if ev[0] == "TASKS":
                    tasks = ev[1] if isinstance(ev[1], list) else []
                    break
                yield ev
        elif channel == "explain":
            for ev in self._run_explain_channel(user_text_en_clean, repo_index_light):
                if ev[0] == "TASKS":
                    tasks = ev[1] if isinstance(ev[1], list) else []
                    break
                yield ev
        elif channel == "tool":
            # Direct tool channel: task planner -> tool planner (no project manager)
            yield ("SYS", "Task planner: generazione piano JSON...")
            available_tools = self._get_available_tools_for_planner()
            task_user = json.dumps({"request": user_text_en_clean, "available_tools": available_tools}, ensure_ascii=False)
            task_messages = [
                {"role": "system", "content": TASK_PLANNER_PROMPT},
                {"role": "user", "content": task_user},
            ]
            task_text = self._chat_text(task_messages, client="task_planner")
            yield from self._yield_token_usage()
            yield ("TASK_PLAN", task_text)
            yield ("ATTEMPT", "task_planner:global:1")
            task_plan = self._safe_json(task_text)
            task_plan = self._normalize_task_plan(task_plan or {})
            task_plan = self._filter_task_plan(task_plan, user_text_en_clean)
            tasks = task_plan.get("tasks", []) if self._validate_task_plan(task_plan) else []
        else:
            # Fallback: direct task planner
            yield ("SYS", "Task planner: generazione piano JSON (fallback)...")
            available_tools = self._get_available_tools_for_planner()
            task_user = json.dumps({"request": user_text_en_clean, "available_tools": available_tools}, ensure_ascii=False)
            task_messages = [
                {"role": "system", "content": TASK_PLANNER_PROMPT},
                {"role": "user", "content": task_user},
            ]
            task_text = self._chat_text(task_messages, client="task_planner")
            yield from self._yield_token_usage()
            yield ("TASK_PLAN", task_text)
            yield ("ATTEMPT", "task_planner:global:1")
            task_plan = self._safe_json(task_text)
            task_plan = self._normalize_task_plan(task_plan or {})
            task_plan = self._filter_task_plan(task_plan, user_text_en_clean)
            tasks = task_plan.get("tasks", []) if self._validate_task_plan(task_plan) else []

        if not tasks:
            yield ("ERROR", "Nessun task prodotto dal canale.")
            return

        yield ("SYS", f"Esecuzione {len(tasks)} task...")
        collected_outputs: List[Dict[str, Any]] = []
        shared_context: List[Dict[str, Any]] = []
        for task_idx, task in enumerate(tasks, start=1):
            task_goal = task.get("goal", "") if isinstance(task, dict) else ""
            task_command = ""
            if isinstance(task, dict):
                task_command = task_goal
            yield ("SYS", f"Task {task_idx}/{len(tasks)}: {task_goal}")
            task_result = yield from self._run_tool_plan(task_command, repo_index_light, task=None, approval_handler=approval_handler, prior_context=shared_context)
            if not isinstance(task_result, dict):
                yield ("ERROR", "Task failed after max retries (tool_analysis/tool_argument/tool). Stop.")
                return
            collected_outputs.append(task_result)
            ctx = task_result.get("context")
            if isinstance(ctx, list):
                shared_context.extend(ctx)
        # Final summary (gerarchico se il payload supera la soglia)
        yield ("SYS", "Generazione riepilogo finale...")
        summary_text_en = ""
        for kind, text in self._hierarchical_summary(user_text_en_clean, collected_outputs):
            yield (kind, text)
            if kind == "SUMMARY_RESULT":
                summary_text_en = text
        if not summary_text_en:
            summary_text_en = "Riepilogo non disponibile."
        summary_text_it = self._translate_to_italian(summary_text_en)
        for token in summary_text_it:
            yield ("MODEL_TOKEN", token)
        yield ("ATTEMPT", "summary:global:1")

    def _path_in_scope(self, path: str, allowed: List[str]) -> bool:
        """Check if path is within allowed workdir scope (exact match or under allowed dir)."""
        if not path or not allowed:
            return False
        path_n = path.replace("\\", "/")
        for a in allowed:
            a_n = a.replace("\\", "/")
            if path_n == a_n:
                return True
            if a_n.endswith("/") and path_n.startswith(a_n):
                return True
            # Allow subpaths of allowed dirs (e.g. tests/fixtures/foo.py when tests/fixtures/ in scope)
            base = a_n.rsplit("/", 1)[0] + "/" if "/" in a_n else ""
            if base and path_n.startswith(base):
                return True
        return False

    def _build_workdir_context_for_project_planner(self, repo_index_light: Dict[str, Any]) -> str:
        """Build workdir context: scope constraint + file list + module summaries + content previews."""
        files = repo_index_light.get("files") or []
        py_symbols = repo_index_light.get("py_symbols") or []
        base_dir = getattr(self, "_base_dir", "") or "."
        # Build path -> summary map from py_symbols
        by_path: Dict[str, Dict[str, List[str]]] = {}
        for sym in py_symbols:
            if not isinstance(sym, dict):
                continue
            path = str(sym.get("path", ""))
            if not path:
                continue
            if path not in by_path:
                by_path[path] = {"classes": [], "functions": []}
            for c in (sym.get("classes") or []):
                if c and c not in by_path[path]["classes"]:
                    by_path[path]["classes"].append(c)
            for f in (sym.get("functions") or []):
                if f and f not in by_path[path]["functions"]:
                    by_path[path]["functions"].append(f)
        # Filter to Python and key files
        relevant = [
            p for p in files
            if isinstance(p, str)
            and not p.replace("\\", "/").split("/")[-1].startswith(".")
            and "__pycache__" not in p
            and p.endswith((".py", ".json", ".yaml", ".yml", ".toml", ".ini", ".env"))
        ][:80]
        lines = [
            "ALLOWED_WORKDIR (you MUST plan only within this scope):",
            "Paths you can create/modify: " + ", ".join(sorted(relevant)[:40]),
            "Do NOT plan paths outside this list (e.g. src/, utils/, new modules outside workdir).",
            "---",
            "WORKDIR FILES (existing modules and content preview):",
        ]
        for path in sorted(relevant)[:50]:
            summary = by_path.get(path, {})
            parts = []
            if summary.get("classes"):
                parts.append("classes: " + ", ".join(summary["classes"][:15]))
            if summary.get("functions"):
                parts.append("functions: " + ", ".join(summary["functions"][:20]))
            if parts:
                lines.append(f"- {path}: " + "; ".join(parts))
            else:
                lines.append(f"- {path}")
            # Content preview for .py files (first 15 lines)
            if path.endswith(".py"):
                full_path = os.path.join(base_dir, path) if base_dir else path
                try:
                    res = getattr(self, "system_tools", None)
                    if res and hasattr(res, "read_file"):
                        r = res.read_file(full_path)
                        if isinstance(r, dict) and r.get("ok") and r.get("content"):
                            preview_lines = r["content"].strip().split("\n")[:15]
                            preview = "\n  ".join(ln[:100] for ln in preview_lines)
                            if preview:
                                lines.append(f"  content_preview:\n  {preview}")
                except Exception:
                    pass
        return "\n".join(lines)

    def _run_project_channel(
        self,
        user_text_en_clean: str,
        repo_index_light: Dict[str, Any],
    ) -> Iterable[Tuple[str, Any]]:
        """Project Manager -> Project Planner -> Route Planner -> Plan Enhancer -> Function Planner -> Task Planner per punto."""
        yield ("SYS", "Project Manager: piano testuale...")
        pm_messages = [
            {"role": "system", "content": PROJECT_MANAGER_PROMPT},
            {"role": "user", "content": user_text_en_clean},
        ]
        pm_text = self._chat_text(pm_messages, client="project_manager")
        yield from self._yield_token_usage()
        yield ("PROJECT_MANAGER_RAW", pm_text)
        yield ("ATTEMPT", "project_manager:global:1")

        yield ("SYS", "Project Planner: piano JSON...")
        workdir_context = self._build_workdir_context_for_project_planner(repo_index_light)
        pp_messages = [
            {"role": "system", "content": PROJECT_PLANNER_PROMPT},
            {"role": "user", "content": json.dumps({
                "plan_text": pm_text,
                "workdir_context": workdir_context,
            }, ensure_ascii=False)},
        ]
        pp_text = self._chat_text(pp_messages, client="project_planner")
        yield from self._yield_token_usage()
        yield ("PLAN", pp_text)
        yield ("ATTEMPT", "project_planner:global:1")
        project_plan = self._safe_json(pp_text)
        plan_points = project_plan.get("plan") if isinstance(project_plan, dict) else []
        if not isinstance(plan_points, list):
            plan_points = []

        allowed_paths = list(repo_index_light.get("files") or [])
        # Filter/remap plan points: module MUST be in allowed_paths; reject out-of-scope modules
        filtered_points: List[Dict[str, Any]] = []
        for pt in plan_points:
            if not isinstance(pt, dict):
                continue
            mod = str(pt.get("module", "")).replace("\\", "/")
            goal = str(pt.get("goal", ""))
            if mod and not self._path_in_scope(mod, allowed_paths) and allowed_paths:
                # Remap: use allowed path mentioned in user request, or first in scope
                best = None
                for ap in allowed_paths:
                    ap_n = ap.replace("\\", "/")
                    if ap_n in user_text_en_clean or ap in user_text_en_clean:
                        best = ap
                        break
                if best is None:
                    best = allowed_paths[0]
                pt = dict(pt)
                pt["module"] = best
                # Rewrite goal to target the in-scope file
                pt["goal"] = goal.replace(mod, best) if mod in goal else f"Implement in {best}: {goal}"
            filtered_points.append(pt)
        plan_points = filtered_points
        if plan_points and isinstance(project_plan, dict):
            project_plan = dict(project_plan)
            project_plan["plan"] = plan_points

        if not plan_points:
            yield ("TASKS", [])
            return

        yield ("SYS", "Route Planner: struttura progetto...")
        rp_messages = [
            {"role": "system", "content": ROUTE_PLANNER_PROMPT},
            {"role": "user", "content": json.dumps({"plan": project_plan, "allowed_workdir": allowed_paths}, ensure_ascii=False)},
        ]
        rp_text = self._chat_text(rp_messages, client="route_planner")
        yield from self._yield_token_usage()
        yield ("ROUTE_PLANNER_RAW", rp_text)
        yield ("ATTEMPT", "route_planner:global:1")

        # Plan Enhancer and Function Planner disabled: Project Planner + Route Planner
        # already provide valid plan (step, goal, module); tasks use goal directly.
        tasks: List[Dict[str, Any]] = []
        for idx, point in enumerate(plan_points):
            if not isinstance(point, dict):
                continue
            goal = point.get("goal", "")
            if not goal and point.get("module"):
                goal = f"Implement in {point['module']}"
            tasks.append({"step": idx + 1, "goal": goal})
        yield ("TASKS", tasks)

    def _run_debug_channel(
        self,
        user_text_en_clean: str,
        repo_index_light: Dict[str, Any],
    ) -> Iterable[Tuple[str, Any]]:
        """Debug Engineering -> Discovery -> Orchestrator -> Reasoner -> Plan Resolver -> Task Planner per punto."""
        yield ("SYS", "Debug Engineering: normalizzazione goal...")
        de_messages = [
            {"role": "system", "content": DEBUG_ENGINEERING_PROMPT},
            {"role": "user", "content": user_text_en_clean},
        ]
        goal_normalized = self._chat_text(de_messages, client="debugger")
        yield from self._yield_token_usage()
        yield ("DEBUG_ENGINEERING_RAW", goal_normalized)
        yield ("ATTEMPT", "debug_engineering:global:1")

        yield ("SYS", "Discovery: elementi da cercare...")
        disc_messages = [
            {"role": "system", "content": DISCOVERY_PROMPT},
            {"role": "user", "content": goal_normalized},
        ]
        disc_text = self._chat_text(disc_messages, client="discovery")
        yield from self._yield_token_usage()
        yield ("DISCOVERY_RAW", disc_text)
        yield ("ATTEMPT", "discovery:global:1")
        disc_json = self._safe_json(disc_text)

        yield ("SYS", "Orchestratore: ricerca contesto...")
        collected = self._run_orchestrator_search(disc_json, repo_index_light)
        yield ("SYS", f"Orchestratore: trovati {len(collected)} elementi")

        # Materiale ridotto per Reasoner: deduplica per path, tronca contenuti (max 600 char/file)
        reasoner_material: List[Dict[str, Any]] = []
        seen_paths: set = set()
        for c in collected:
            if not isinstance(c, dict):
                continue
            path = str(c.get("path", "")).replace("\\", "/")
            if path in seen_paths:
                continue
            seen_paths.add(path)
            content = str(c.get("content", ""))[:600]
            reasoner_material.append({"path": path, "content": content, "type": c.get("type", "file")})

        yield ("SYS", "Reasoner: analisi problema...")
        reasoner_payload = {"request": user_text_en_clean, "material": reasoner_material}
        reasoner_messages = [
            {"role": "system", "content": REASONER_PROMPT},
            {"role": "user", "content": json.dumps(reasoner_payload, ensure_ascii=False)},
        ]
        reasoner_out = self._chat_text(reasoner_messages, client="reasoner")
        yield from self._yield_token_usage()
        reasoner_attempts = 1
        # Retry solo se output davvero vuoto (strip < 30 char) per evitare retry su output validi brevi
        out_stripped = str(reasoner_out or "").strip()
        while len(out_stripped) < 30 and reasoner_attempts < 3:
            yield ("SYS", "Reasoner: output vuoto o troppo breve, retry...")
            reasoner_out = self._chat_text(reasoner_messages, client="reasoner")
            yield from self._yield_token_usage()
            reasoner_attempts += 1
            out_stripped = str(reasoner_out or "").strip()
        yield ("REASONER_RAW", reasoner_out or "")
        yield ("ATTEMPT", f"reasoner:global:{reasoner_attempts}")

        yield ("SYS", "Plan Resolver: piano risolutivo...")
        pr_payload = {
            "reasoner_output": reasoner_out,
            "collected": collected,
            "request": user_text_en_clean,
        }
        pr_messages = [
            {"role": "system", "content": PLAN_RESOLVER_PROMPT},
            {"role": "user", "content": json.dumps(pr_payload, ensure_ascii=False)},
        ]
        pr_text = self._chat_text(pr_messages, client="plan_resolver")
        yield from self._yield_token_usage()
        yield ("TASK_PLAN", pr_text)
        yield ("ATTEMPT", "plan_resolver:global:1")
        pr_plan = self._safe_json(pr_text)
        plan_tasks = pr_plan.get("tasks", []) if isinstance(pr_plan, dict) else []

        tasks = [t for t in plan_tasks if isinstance(t, dict) and t.get("goal")]
        yield ("TASKS", tasks)

    def _run_explain_channel(
        self,
        user_text_en_clean: str,
        repo_index_light: Dict[str, Any],
    ) -> Iterable[Tuple[str, Any]]:
        """Explainer -> Explain Discovery -> Orchestrator -> Explain Planner -> Task Planner per punto."""
        yield ("SYS", "Explainer: normalizzazione richiesta...")
        exp_messages = [
            {"role": "system", "content": EXPLAINER_PROMPT},
            {"role": "user", "content": user_text_en_clean},
        ]
        request_normalized = self._chat_text(exp_messages, client="explainer")
        yield from self._yield_token_usage()
        yield ("EXPLAINER_RAW", request_normalized)
        yield ("ATTEMPT", "explainer:global:1")

        yield ("SYS", "Explain Discovery: elementi da cercare...")
        ed_messages = [
            {"role": "system", "content": EXPLAIN_DISCOVERY_PROMPT},
            {"role": "user", "content": request_normalized},
        ]
        ed_text = self._chat_text(ed_messages, client="explain_discovery")
        yield from self._yield_token_usage()
        yield ("EXPLAIN_DISCOVERY_RAW", ed_text)
        yield ("ATTEMPT", "explain_discovery:global:1")
        ed_json = self._safe_json(ed_text)

        yield ("SYS", "Orchestratore: ricerca workdir...")
        collected = self._run_orchestrator_search(ed_json, repo_index_light)
        yield ("SYS", f"Orchestratore: trovati {len(collected)} elementi")

        yield ("SYS", "Explain Planner: piano numerato...")
        ep_messages = [
            {"role": "system", "content": EXPLAIN_PLANNER_PROMPT},
            {"role": "user", "content": json.dumps({"request": request_normalized, "found_elements": collected}, ensure_ascii=False)},
        ]
        ep_text = self._chat_text(ep_messages, client="explain_planner")
        yield from self._yield_token_usage()
        yield ("PLAN", ep_text)
        yield ("ATTEMPT", "explain_planner:global:1")
        ep_plan = self._safe_json(ep_text)
        plan_tasks = ep_plan.get("tasks", []) if isinstance(ep_plan, dict) else []

        tasks = [t for t in plan_tasks if isinstance(t, dict) and t.get("goal")]
        yield ("TASKS", tasks)

    def _summary_payload_size(self, request: str, task_evidence: List[Dict[str, Any]]) -> int:
        return len(json.dumps({"request": request, "task_evidence": task_evidence}, ensure_ascii=False))

    def _merge_payload_size(self, request: str, summaries: List[str]) -> int:
        return len(json.dumps({"request": request, "summaries": summaries}, ensure_ascii=False))

    def _chunk_evidence(
        self, request: str, evidence: List[Dict[str, Any]], max_chars: int
    ) -> List[List[Dict[str, Any]]]:
        chunks: List[List[Dict[str, Any]]] = []
        current: List[Dict[str, Any]] = []
        for item in evidence:
            trial = current + [item]
            if self._summary_payload_size(request, trial) <= max_chars:
                current = trial
            else:
                if current:
                    chunks.append(current)
                current = [item]
        if current:
            chunks.append(current)
        return chunks

    def _call_summary_once(self, request: str, task_evidence: List[Dict[str, Any]], intermediate: bool) -> str:
        prompt = INTERMEDIATE_SUMMARY_PROMPT if intermediate else FINAL_SUMMARY_PROMPT
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": json.dumps({"request": request, "task_evidence": task_evidence}, ensure_ascii=False)},
        ]
        for attempt in range(3):
            try:
                return self._chat_text(messages, client="summary")
            except HTTPError:
                if attempt < 2:
                    time.sleep(2.0 * (attempt + 1))
        return "Riepilogo non disponibile (errore di rete o modello)."

    def _call_merge_summary(self, request: str, summaries: List[str]) -> str:
        messages = [
            {"role": "system", "content": MERGE_SUMMARY_PROMPT},
            {"role": "user", "content": json.dumps({"request": request, "summaries": summaries}, ensure_ascii=False)},
        ]
        for attempt in range(3):
            try:
                return self._chat_text(messages, client="summary")
            except HTTPError:
                if attempt < 2:
                    time.sleep(2.0 * (attempt + 1))
        return summaries[0] if summaries else "Riepilogo non disponibile (errore di rete o modello)."

    def _hierarchical_summary(
        self, request: str, collected_outputs: List[Dict[str, Any]]
    ) -> Iterable[Tuple[str, str]]:
        size = self._summary_payload_size(request, collected_outputs)
        if size <= MAX_SUMMARY_CHUNK_CHARS:
            yield ("SYS", "Summary: un solo passaggio.")
            result = self._call_summary_once(request, collected_outputs, intermediate=False)
            yield from self._yield_token_usage()
            yield ("SUMMARY_RESULT", result)
            return
        chunks = self._chunk_evidence(request, collected_outputs, MAX_SUMMARY_CHUNK_CHARS)
        yield ("SYS", f"Summary: payload oltre soglia, {len(chunks)} chunk intermedi.")
        intermediates: List[str] = []
        for i, chunk in enumerate(chunks):
            yield ("SYS", f"Summary intermedio {i + 1}/{len(chunks)}.")
            s = self._call_summary_once(request, chunk, intermediate=True)
            yield from self._yield_token_usage()
            intermediates.append(s)
        merge_size = self._merge_payload_size(request, intermediates)
        if merge_size <= MAX_SUMMARY_MERGE_CHARS:
            yield ("SYS", "Merge summary finale.")
            result = self._call_merge_summary(request, intermediates)
            yield from self._yield_token_usage()
            yield ("SUMMARY_RESULT", result)
            return
        # Ricorsione: tratta gli intermedi come "evidence" e riassumi ancora a chunk
        fake_evidence = [{"final": t, "context": []} for t in intermediates]
        out: List[str] = []
        for _kind, text in self._hierarchical_summary(request, fake_evidence):
            if _kind == "SYS":
                yield (_kind, text)
            elif _kind == "SUMMARY_RESULT":
                out.append(text)
        if out:
            final = self._call_merge_summary(request, out) if len(out) > 1 else out[0]
            yield from self._yield_token_usage()
            yield ("SUMMARY_RESULT", final)
        else:
            res = self._call_merge_summary(request, intermediates)
            yield from self._yield_token_usage()
            yield ("SUMMARY_RESULT", res)






