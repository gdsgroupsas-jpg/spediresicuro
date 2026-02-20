from __future__ import annotations
import json
import re
from typing import Any, Callable, Dict, Iterable, List, Optional, Set, Tuple
from .prompts import (
    PLANNER_PROMPT,
    PLANNER_STRICT_PROMPT,
    TOOL_CALLER_PROMPT,
    TOOL_CALLER_STRICT_PROMPT,
    TOOL_ANALYSIS_PROMPT,
    TOOL_ANALYSIS_STRICT_PROMPT,
    TOOL_ARGUMENT_PROMPT,
    TOOL_ARGUMENT_STRICT_PROMPT,
    CODER_PROMPT,
    CODER_CONTENT_PROMPT,
    CODER_ENV_PROMPT,
    CODER_YAML_PROMPT,
    CODER_JSON_PROMPT,
    CODER_REPLACE_PROMPT,
    CODER_DEBUGGER_PROMPT,
    FINAL_PROMPT,
)

class ToolingPlanMixin:
    MAX_DEBUGGER_RETRIES = 3

    def _run_post_write_pipeline(
        self,
        modified_python_paths: Set[str],
        context: List[Dict[str, Any]],
        approval_handler: Optional[Callable[[Dict[str, Any]], bool]],
    ) -> Iterable[Tuple[str, str]]:
        """Pipeline post-scrittura: Linter -> Formatter -> TypeChecker -> (Debugger se errori mypy)."""
        paths_list = sorted(modified_python_paths)

        # 1. Linter: ruff check --fix
        yield ("SYS", f"Post-write pipeline: linter (ruff check --fix) su {len(paths_list)} file")
        ruff_check_args = " ".join(["--fix"] + paths_list)
        ruff_res = self.python_tools.ruff_check(ruff_check_args)
        yield ("TOOL_RESULT", json.dumps(ruff_res, ensure_ascii=False))
        if not ruff_res.get("ok"):
            yield ("SYS", "Linter ha segnalato problemi, formatter applicato automaticamente")

        # 2. Formatter: ruff format
        yield ("SYS", "Post-write pipeline: formatter (ruff format)")
        for p in paths_list:
            fmt_res = self.python_tools.ruff_format(p)
            yield ("TOOL_RESULT", json.dumps(fmt_res, ensure_ascii=False))

        # 3. Type checker: mypy + Debugger loop
        mypy_retries = 0
        while mypy_retries < self.MAX_DEBUGGER_RETRIES:
            yield ("SYS", "Post-write pipeline: type checker (mypy)")
            mypy_args_str = " ".join(paths_list)
            mypy_res = self.python_tools.mypy_check(mypy_args_str)
            yield ("TOOL_RESULT", json.dumps(mypy_res, ensure_ascii=False))
            if mypy_res.get("ok"):
                break
            err_msg = (mypy_res.get("stdout") or "") + (mypy_res.get("stderr") or "")
            affected: Set[str] = set()
            for m in re.finditer(r"^(.+?\.py):\d+:\s*error:", err_msg, re.MULTILINE):
                path_cand = m.group(1).strip()
                affected.add(path_cand)
            if not affected:
                for p in paths_list:
                    if p in err_msg:
                        affected.add(p)
            if not affected:
                break
            yield ("SYS", f"Debugger: correzione errori mypy in {len(affected)} file")
            for path in sorted(affected):
                read_res = self.system_tools.read_file(path)
                if not (isinstance(read_res, dict) and read_res.get("ok")):
                    continue
                content = read_res.get("content", "")
                payload = {"path": path, "file_content": content, "error_message": err_msg}
                debugger_messages = [
                    {"role": "system", "content": CODER_DEBUGGER_PROMPT},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ]
                fixed = self._chat_text(debugger_messages, client="debugger")
                yield from self._yield_token_usage()
                if not fixed or fixed.strip() == content.strip():
                    continue
                args = {"path": path, "content": fixed, "dry_run": False}
                if self.registry.requires_approval("safe_write") and approval_handler:
                    approval_payload = {"name": "safe_write", "args": args}
                    yield ("REQUEST_APPROVAL", json.dumps(approval_payload, ensure_ascii=False))
                    if not approval_handler(approval_payload):
                        yield ("ERROR", "safe_write (debugger) non autorizzato")
                        return
                result = self.registry.dispatch("safe_write", args)
                yield ("TOOL_RESULT", json.dumps(result, ensure_ascii=False))
                context.append({"step": 0, "tool": "safe_write", "goal": f"debugger fix mypy: {path}", "args": args, "result": result})
            mypy_retries += 1

    def _run_tool_plan(
        self,
        request: str,
        repo_index_light: Dict[str, Any],
        task: Optional[Dict[str, Any]] = None,
        approval_handler: Optional[Callable[[Dict[str, Any]], bool]] = None,
        prior_context: Optional[List[Dict[str, Any]]] = None,
    ) -> Iterable[Tuple[str, str]]:
        # Tool planner: python_exec non è tra i tool disponibili (gestito solo lato sistema dopo le modifiche del coder)
        yield ("SYS", "Tool planner: generazione piano JSON...")
        tools_for_planner: List[Dict[str, Any]] = []
        for name in self._tool_names():
            if name == "python_exec":
                continue
            spec = self.registry._tools.get(name)  # type: ignore[attr-defined]
            if spec:
                tools_for_planner.append({"name": name, "description": spec.description})
        planner_user = json.dumps({"tools": tools_for_planner, "goal": request}, ensure_ascii=False)
        planner_messages = [
            {"role": "system", "content": PLANNER_PROMPT},
            {"role": "user", "content": planner_user},
        ]
        plan_text = self._chat_text(planner_messages, client="planner")
        yield from self._yield_token_usage()
        yield ("PLAN", plan_text)
        plan = self._safe_json(plan_text)
        plan = self._normalize_plan(plan)
        planner_attempts = 1
        if not self._validate_plan(plan):
            yield ("ERROR", "Tool planner JSON non valido, retry...")
            plan_text = self._chat_text(planner_messages, client="planner")
            yield from self._yield_token_usage()
            planner_attempts = 2
            yield ("PLAN", plan_text)
            plan = self._safe_json(plan_text)
            plan = self._normalize_plan(plan)
            if not self._validate_plan(plan):
                yield ("ERROR", "Tool planner JSON non valido. Strict retry...")
                strict_messages = [
                    {"role": "system", "content": PLANNER_STRICT_PROMPT},
                    {"role": "user", "content": planner_user},
                ]
                plan_text = self._chat_text(strict_messages, client="planner")
                yield from self._yield_token_usage()
                planner_attempts = 3
                yield ("PLAN", plan_text)
                plan = self._safe_json(plan_text)
                plan = self._normalize_plan(plan)
                if not self._validate_plan(plan):
                    yield ("ERROR", "Tool planner JSON non valido. Stop.")
                    yield ("ATTEMPT", f"planner:global:{planner_attempts}")
                    return ""
        yield ("ATTEMPT", f"planner:global:{planner_attempts}")
        steps = plan.get("plan", [])
        yield ("SYS", f"Tool planner: {len(steps)} step")
        context: List[Dict[str, Any]] = list(prior_context) if prior_context else []
        modified_python_paths: set = set()
        WRITE_TOOLS = {"safe_write", "apply_patch_unified", "apply_write_preview", "write_file", "replace_text", "insert_text"}
        # Scrittura con contenuto dal coder: esecuzione diretta senza tool_caller.
        WRITE_DIRECT_DISPATCH = {"safe_write", "write_file", "apply_patch_unified", "apply_write_preview", "replace_text"}
        for idx, step in enumerate(steps, start=1):
            tool_name = step.get("tool", "")
            goal = step.get("goal", "")
            tool_name = self._normalize_tool_name(tool_name)
            if tool_name not in self.registry._tools:  # type: ignore[attr-defined]
                yield ("ERROR", f"Tool sconosciuto nel piano: {tool_name}")
                return ""
            spec = self.registry._tools[tool_name]  # type: ignore[attr-defined]

            # python_exec non è scelto dal planner; se il task planner lo ha messo in un step, skip (gestito automaticamente dopo le modifiche del coder)
            if tool_name == "python_exec":
                yield ("SYS", f"Task {idx}/{len(steps)}: {goal}")
                yield ("SYS", "python_exec gestito automaticamente dopo le modifiche al codice, skip step")
                continue

            content_literal = self._extract_content_literal(goal)
            args_template: Dict[str, Any] = {}
            if tool_name == "safe_write":
                # Tool-argument must output valid JSON with required keys; orchestrator injects real content.
                args_template["content"] = "__CONTENT__"
                args_template["dry_run"] = False
            if tool_name == "write_file":
                # Content sempre dal coder (formato corretto per .json, .env, .yaml, .ini, etc.).
                args_template["content"] = "__CONTENT__"
            if tool_name == "apply_patch_unified":
                # Tool-argument must include required keys; the real diff is injected later from coder.
                args_template["diff"] = "__DIFF__"
            if content_literal and "content" in spec.parameters.get("required", []):
                args_template["content"] = content_literal
            if tool_name == "apply_write_preview":
                if "expected_old_hash" in spec.parameters.get("required", []):
                    args_template.setdefault("expected_old_hash", "__EXPECTED_HASH__")
            if tool_name == "preview_write":
                if "content" in spec.parameters.get("required", []) and "content" not in args_template:
                    args_template["content"] = content_literal

            workspace_files = repo_index_light.get("files", [])
            analysis_payload = {
                "tool": {"name": spec.name, "description": spec.description, "parameters": spec.parameters},
                "goal": goal,
                "args_template": args_template,
                "workspace_files": workspace_files,
                "repo_index": repo_index_light,
            }
            if tool_name == "pytest_run":
                test_files = [p for p in workspace_files if (p.replace("\\", "/").split("/")[-1].startswith("test_"))]
                analysis_payload["test_files"] = test_files
            analysis_messages = [
                {"role": "system", "content": TOOL_ANALYSIS_PROMPT},
                {"role": "user", "content": json.dumps(analysis_payload, ensure_ascii=False)},
            ]
            yield ("TOOL_ANALYSIS_PROMPT", json.dumps(analysis_payload, ensure_ascii=False))
            analysis_text = self._chat_text(analysis_messages, client="tool_analysis")
            yield from self._yield_token_usage()
            analysis_call = self._safe_json(analysis_text)
            required_params = spec.parameters.get("required", [])
            path_required = "path" in required_params
            def _analysis_ok(call: Any) -> bool:
                return isinstance(call, dict) and (not path_required or call.get("path"))
            if not _analysis_ok(analysis_call):
                strict_messages = [
                    {"role": "system", "content": TOOL_ANALYSIS_STRICT_PROMPT},
                    {"role": "user", "content": json.dumps(analysis_payload, ensure_ascii=False)},
                ]
                analysis_text = self._chat_text(strict_messages, client="tool_analysis")
                yield from self._yield_token_usage()
                analysis_call = self._safe_json(analysis_text)
            if not _analysis_ok(analysis_call):
                yield ("ERROR", f"Tool analysis JSON non valido per {tool_name}")
                return ""
            selected_path = analysis_call.get("path", "") if isinstance(analysis_call, dict) else ""
            if tool_name in WRITE_TOOLS and selected_path and workspace_files:
                ws = [p.replace("\\", "/") for p in workspace_files]
                if selected_path.replace("\\", "/") not in ws:
                    yield ("ERROR", f"Path {selected_path} fuori dalla workdir. Consentiti: {ws[:5]}{'...' if len(ws) > 5 else ''}")
                    return ""

            tool_context: Dict[str, Any] = {}
            if selected_path:
                for entry in reversed(context):
                    if not isinstance(entry, dict):
                        continue
                    if entry.get("tool") != "preview_write":
                        continue
                    result = entry.get("result")
                    if not isinstance(result, dict):
                        continue
                    if result.get("path") == selected_path and result.get("ok"):
                        tool_context["preview_write"] = result
                        self._last_preview_write = result
                        break
            if not tool_context:
                last_preview = getattr(self, "_last_preview_write", None)
                if isinstance(last_preview, dict):
                    if last_preview.get("path") == selected_path and last_preview.get("ok"):
                        tool_context["preview_write"] = last_preview

            # Scrittura: path da tool_analysis, contenuto da coder. NO tool_argument.
            if tool_name in WRITE_TOOLS:
                analysis_args = {"path": selected_path}
                if tool_name == "safe_write":
                    analysis_args["dry_run"] = False
                yield ("SYS", "Scrittura: path da tool_analysis, contenuto da coder (no tool_argument)")
            else:
                args_payload = {
                    "tool": {
                        "name": spec.name,
                        "description": spec.description,
                        "parameters": spec.parameters,
                    },
                    "goal": goal,
                    "path": selected_path,
                    "tool_context": tool_context,
                    "args_template": args_template,
                }
                if tool_name == "pytest_run":
                    test_files = [p for p in (repo_index_light.get("files", [])) if (p.replace("\\", "/").split("/")[-1].startswith("test_"))]
                    args_payload["test_files"] = test_files
                arg_messages = [
                    {"role": "system", "content": TOOL_ARGUMENT_PROMPT},
                    {"role": "user", "content": json.dumps(args_payload, ensure_ascii=False)},
                ]
                yield ("TOOL_ARGUMENT_PROMPT", json.dumps(args_payload, ensure_ascii=False))
                arg_text = self._chat_text(arg_messages, client="tool_argument")
                yield from self._yield_token_usage()
                arg_call = self._safe_json(arg_text)
                if tool_name in ("pytest_run", "ruff_check", "mypy_check") and isinstance(arg_call.get("args"), str):
                    arg_call["args"] = {"args": arg_call["args"]}
                arg_attempts = 1
                if not self._validate_tool_call(arg_call, tool_name):
                    strict_messages = [
                        {"role": "system", "content": TOOL_ARGUMENT_STRICT_PROMPT},
                        {"role": "user", "content": json.dumps(args_payload, ensure_ascii=False)},
                    ]
                    arg_text = self._chat_text(strict_messages, client="tool_argument")
                    yield from self._yield_token_usage()
                    arg_call = self._safe_json(arg_text)
                    if tool_name in ("pytest_run", "ruff_check", "mypy_check") and isinstance(arg_call.get("args"), str):
                        arg_call["args"] = {"args": arg_call["args"]}
                    arg_attempts = 2
                if not self._validate_tool_call(arg_call, tool_name):
                    yield ("ERROR", f"Tool argument JSON non valido per {tool_name}")
                    yield ("ATTEMPT", f"tool_argument:{tool_name}:{arg_attempts}")
                    return ""
                yield ("ATTEMPT", f"tool_argument:{tool_name}:{arg_attempts}")
                analysis_args = arg_call.get("args", {})

            if tool_name == "apply_write_preview":
                preview_ctx = tool_context.get("preview_write") if isinstance(tool_context, dict) else None
                if isinstance(preview_ctx, dict):
                    prev_path = preview_ctx.get("path")
                    prev_hash = preview_ctx.get("old_hash")
                    if prev_path:
                        analysis_args["path"] = prev_path
                    if prev_hash:
                        analysis_args["expected_old_hash"] = prev_hash
                    if not analysis_args.get("content") or analysis_args.get("content") == "__CONTENT__":
                        last_content = getattr(self, "_last_preview_content", "")
                        if isinstance(last_content, str) and last_content:
                            analysis_args["content"] = last_content

            if tool_name == "apply_patch_unified" and "diff" not in analysis_args:
                analysis_args["diff"] = "__DIFF__"
            if tool_name == "safe_write" and "content" not in analysis_args:
                analysis_args["content"] = "__CONTENT__"
            if tool_name == "write_file" and "content" not in analysis_args:
                analysis_args["content"] = "__CONTENT__"
            if tool_name == "apply_write_preview":
                if "content" not in analysis_args:
                    analysis_args["content"] = "__CONTENT__"
                if "expected_old_hash" not in analysis_args:
                    analysis_args["expected_old_hash"] = "__EXPECTED_HASH__"
            if tool_name == "preview_write" and "content" not in analysis_args:
                analysis_args["content"] = "__CONTENT__"

            constraints = {}
            if isinstance(analysis_args, dict):
                if "path" in analysis_args:
                    constraints["path_hint"] = analysis_args.get("path", "")
                elif "root" in analysis_args:
                    constraints["path_hint"] = analysis_args.get("root", "")
                if tool_name == "replace_text":
                    constraints["pattern_hint"] = analysis_args.get("old", "")
                    constraints["replacement_hint"] = analysis_args.get("new", "")

            generated_diff = ""
            generated_content = ""
            generated_replace = ""
            generated_replace_old = ""
            generated_replace_new = ""

            if tool_name == "apply_patch_unified":
                path_hint = (analysis_args.get("path") or selected_path) if isinstance(analysis_args, dict) else selected_path
                file_content = ""
                if path_hint:
                    read_res = self.system_tools.read_file(path_hint)
                    if isinstance(read_res, dict) and read_res.get("ok"):
                        file_content = read_res.get("content", "")
                # Format instruction automatica dall'orchestratore per tutti i tipi di file
                format_instruction = self._get_format_instruction_for_path(path_hint or "")
                template = (
                    f"--- a/{path_hint}\n"
                    f"+++ b/{path_hint}\n"
                    "@@ -1,3 +1,4 @@\n"
                    " line one\n"
                    " line two\n"
                    "+line two and a half\n"
                    " line three\n"
                )
                coder_payload = self._build_coder_payload(
                    goal, path_hint or "", file_content,
                    constraints={},
                    format_instruction=format_instruction,
                    intent="Produce a unified diff for the requested change.",
                    instruction="Produce a unified diff that applies the requested change to the target file. Use the provided file_content as the exact current content. Follow format_instruction for the file type (e.g. valid JSON lines for .json).",
                    template=template,
                )
                coder_messages = [
                    {"role": "system", "content": CODER_PROMPT},
                    {"role": "user", "content": json.dumps(coder_payload, ensure_ascii=False)},
                ]
                yield ("SYS", "Coder: genera diff (attempt 1)")
                generated_diff = self._chat_text(coder_messages, client="coder")
                yield from self._yield_token_usage()
                yield ("CODER_RAW", generated_diff)
                yield ("ATTEMPT", "coder:apply_patch_unified:1")
                if not generated_diff or not re.search(r"@@ -\d+,\d+ \+\d+,\d+ @@", generated_diff):
                    strict_payload = dict(coder_payload)
                    strict_payload["instruction"] = (
                        "STRICT: Output ONLY a unified diff. Include file headers and a hunk header."
                    )
                    strict_messages = [
                        {"role": "system", "content": CODER_PROMPT},
                        {"role": "user", "content": json.dumps(strict_payload, ensure_ascii=False)},
                    ]
                    yield ("SYS", "Coder: genera diff (attempt 2)")
                    generated_diff = self._chat_text(strict_messages, client="coder")
                    yield from self._yield_token_usage()
                    yield ("CODER_RAW", generated_diff)
                    yield ("ATTEMPT", "coder:apply_patch_unified:2")
                    if not generated_diff or not re.search(r"@@ -\d+,\d+ \+\d+,\d+ @@", generated_diff):
                        yield ("ERROR", "Coder produced invalid diff")
                        return ""
                if not generated_diff.endswith("\n"):
                    generated_diff += "\n"
                generated_diff = self._normalize_unified_diff(path_hint, generated_diff)

            if tool_name == "safe_write":
                path_hint = constraints.get("path_hint", "") if isinstance(constraints, dict) else ""
                file_content = ""
                if path_hint:
                    read_res = self.system_tools.read_file(path_hint)
                    if isinstance(read_res, dict) and read_res.get("ok"):
                        file_content = read_res.get("content", "")
                error_hint: Dict[str, Any] = {}
                for entry in context:
                    if not isinstance(entry, dict):
                        continue
                    result = entry.get("result")
                    if not isinstance(result, dict):
                        continue
                    err_path = str(result.get("path", ""))
                    if not err_path.endswith("error_log.txt"):
                        continue
                    content = result.get("content")
                    if not isinstance(content, str) or not content.strip():
                        continue
                    match = re.search(r'File "([^"]+)", line (\d+), in ([^\n]+)', content)
                    if match:
                        error_hint = {
                            "error_file": match.group(1),
                            "error_line": int(match.group(2)),
                            "error_function": match.group(3).strip(),
                        }
                        lines = content.splitlines()
                        needle = f'File "{match.group(1)}", line {match.group(2)}'
                        for i, line in enumerate(lines):
                            if needle in line and i + 1 < len(lines):
                                error_hint["error_expr"] = lines[i + 1].strip()
                                break
                        break
                # Detect if goal requires removal
                removal_hint = ""
                goal_lower = goal.lower() if isinstance(goal, str) else ""
                if any(word in goal_lower for word in ["remove", "delete", "eliminate", "drop"]):
                    removal_hint = "CRITICAL: This goal requires REMOVAL. You MUST remove the specified element(s) from the file. Do NOT add them."
                # Per il coder: goal senza riferimenti al tool (evita che confonda "safe_write"/"writing" con simboli da inserire)
                coder_goal = goal
                if isinstance(goal, str):
                    phrases = (
                        " writing with safe_write.", " writing with safe_write",
                        " using safe_write.", " with safe_write.", " using safe_write", " with safe_write", " via safe_write",
                    )
                    for phrase in phrases:
                        if phrase in goal:
                            coder_goal = goal.replace(phrase, "").strip()
                            break
                # Format instruction automatica dall'orchestratore (JSON, YAML, .env, .ini, etc.)
                format_instruction = self._get_format_instruction_for_path(path_hint or "")
                coder_payload = self._build_coder_payload(
                    coder_goal, path_hint or "", file_content,
                    constraints={},
                    format_instruction=format_instruction,
                    error_hint=error_hint,
                    removal_hint=removal_hint,
                )
                is_yaml = (path_hint or "").lower().endswith((".yaml", ".yml"))
                is_json = (path_hint or "").lower().endswith(".json")
                coder_system_safe = (
                    CODER_JSON_PROMPT if is_json
                    else CODER_YAML_PROMPT if is_yaml
                    else CODER_CONTENT_PROMPT
                )
                coder_messages = [
                    {"role": "system", "content": coder_system_safe},
                    {"role": "user", "content": json.dumps(coder_payload, ensure_ascii=False)},
                ]
                if is_json:
                    yield ("SYS", "Coder JSON: genera contenuto (attempt 1)")
                elif is_yaml:
                    yield ("SYS", "Coder YAML: genera contenuto (attempt 1)")
                else:
                    yield ("SYS", "Coder: genera contenuto (attempt 1)")
                generated_content = self._chat_text(coder_messages, client="coder")
                yield from self._yield_token_usage()
                yield ("CODER_RAW", generated_content)
                yield ("ATTEMPT", "coder:safe_write:1")
                if not generated_content:
                    strict_payload = dict(coder_payload)
                    strict_payload["instruction"] = (
                        "STRICT: Output ONLY the full JSON file content. Valid JSON, preserve all keys not in the goal, change only the key(s) requested. No commentary, no code fences, no markdown."
                        if is_json
                        else "STRICT: Output ONLY the full YAML file content. Valid YAML, 2-space indentation per level, key: value format. No commentary, no code fences, no markdown."
                        if is_yaml
                        else "STRICT: Output ONLY the full file content. No commentary, no code fences."
                    )
                    strict_messages = [
                        {"role": "system", "content": coder_system_safe},
                        {"role": "user", "content": json.dumps(strict_payload, ensure_ascii=False)},
                    ]
                    if is_json:
                        yield ("SYS", "Coder JSON: genera contenuto (attempt 2 strict)")
                    elif is_yaml:
                        yield ("SYS", "Coder YAML: genera contenuto (attempt 2 strict)")
                    else:
                        yield ("SYS", "Coder: genera contenuto (attempt 2)")
                    generated_content = self._chat_text(strict_messages, client="coder")
                    yield from self._yield_token_usage()
                    yield ("CODER_RAW", generated_content)
                    yield ("ATTEMPT", "coder:safe_write:2")
                    if not generated_content:
                        yield ("ERROR", "Coder produced empty content")
                        return ""

            if tool_name == "replace_text":
                path_hint = constraints.get("path_hint", "") if isinstance(constraints, dict) else ""
                pattern_hint = constraints.get("pattern_hint", "") if isinstance(constraints, dict) else ""
                replacement_hint = constraints.get("replacement_hint", "") if isinstance(constraints, dict) else ""
                file_content = ""
                if path_hint:
                    read_res = self.system_tools.read_file(path_hint)
                    if isinstance(read_res, dict) and read_res.get("ok"):
                        file_content = read_res.get("content", "")
                error_hint: Dict[str, Any] = {}
                for entry in context:
                    if not isinstance(entry, dict):
                        continue
                    result = entry.get("result")
                    if not isinstance(result, dict):
                        continue
                    err_path = str(result.get("path", ""))
                    if not err_path.endswith("error_log.txt"):
                        continue
                    content = result.get("content")
                    if not isinstance(content, str) or not content.strip():
                        continue
                    match = re.search(r'File "([^"]+)", line (\d+), in ([^\n]+)', content)
                    if match:
                        error_hint = {
                            "error_file": match.group(1),
                            "error_line": int(match.group(2)),
                            "error_function": match.group(3).strip(),
                        }
                        lines = content.splitlines()
                        needle = f'File "{match.group(1)}", line {match.group(2)}'
                        for i, line in enumerate(lines):
                            if needle in line and i + 1 < len(lines):
                                error_hint["error_expr"] = lines[i + 1].strip()
                                break
                        break
                # Format instruction automatica dall'orchestratore per tutti i tipi di file
                format_instruction = self._get_format_instruction_for_path(path_hint or "")
                coder_payload = self._build_coder_payload(
                    goal, path_hint or "", file_content,
                    constraints={},
                    format_instruction=format_instruction,
                    pattern_hint=pattern_hint,
                    replacement_hint=replacement_hint,
                    error_hint=error_hint,
                    intent="Produce old/new for replace_text. Use file_content and goal to determine exact text to replace and replacement.",
                    instruction="Output JSON: {\"old\": \"exact substring from file_content to replace\", \"new\": \"replacement\"}. Match file_content exactly for old.",
                )
                coder_messages = [
                    {"role": "system", "content": CODER_REPLACE_PROMPT},
                    {"role": "user", "content": json.dumps(coder_payload, ensure_ascii=False)},
                ]
                yield ("SYS", "Coder: genera old/new per replace_text (attempt 1)")
                raw_replace = self._chat_text(coder_messages, client="coder")
                yield from self._yield_token_usage()
                yield ("CODER_RAW", raw_replace)
                yield ("ATTEMPT", "coder:replace_text:1")
                parsed = self._safe_json(raw_replace) if raw_replace else {}
                if isinstance(parsed, dict) and parsed.get("old") is not None and parsed.get("new") is not None:
                    generated_replace_old = str(parsed.get("old", ""))
                    generated_replace_new = str(parsed.get("new", ""))
                if not generated_replace_old or not generated_replace_new:
                    strict_payload = dict(coder_payload)
                    strict_payload["instruction"] = "STRICT: Output ONLY valid JSON: {\"old\": \"...\", \"new\": \"...\"}. No markdown, no commentary."
                    strict_messages = [
                        {"role": "system", "content": CODER_REPLACE_PROMPT},
                        {"role": "user", "content": json.dumps(strict_payload, ensure_ascii=False)},
                    ]
                    yield ("SYS", "Coder: genera old/new per replace_text (attempt 2)")
                    raw_replace = self._chat_text(strict_messages, client="coder")
                    yield from self._yield_token_usage()
                    yield ("CODER_RAW", raw_replace)
                    yield ("ATTEMPT", "coder:replace_text:2")
                    parsed = self._safe_json(raw_replace) if raw_replace else {}
                    if isinstance(parsed, dict) and parsed.get("old") is not None and parsed.get("new") is not None:
                        generated_replace_old = str(parsed.get("old", ""))
                        generated_replace_new = str(parsed.get("new", ""))
                if not generated_replace_old or not generated_replace_new:
                    yield ("ERROR", "Coder replace_text: output non contiene old/new validi")
                    return ""

            if tool_name == "write_file":
                # Content sempre dal coder: path, goal, file_content. Se .env → coder specializzato .env con retry strict.
                path_hint = (analysis_args.get("path") or selected_path) if isinstance(analysis_args, dict) else selected_path
                file_content = ""
                if path_hint:
                    read_res = self.system_tools.read_file(path_hint)
                    if isinstance(read_res, dict) and read_res.get("ok"):
                        file_content = read_res.get("content", "")
                # Format instruction automatica dall'orchestratore (JSON, YAML, .env, .ini, etc.)
                format_instruction = self._get_format_instruction_for_path(path_hint or "")
                is_env = (path_hint or "").lower().endswith(".env")
                is_yaml = (path_hint or "").lower().endswith((".yaml", ".yml"))
                is_json = (path_hint or "").lower().endswith(".json")
                coder_goal = goal
                if isinstance(goal, str):
                    for phrase in (" writing with safe_write.", " using safe_write.", " with safe_write.", " via safe_write.", " with write_file.", " using write_file."):
                        if phrase in goal:
                            coder_goal = goal.replace(phrase, "").strip()
                            break
                # Coder scrittura: goal, path, file_content, format_instruction. No constraints/path_hint.
                coder_payload = self._build_coder_payload(
                    coder_goal, path_hint or "", file_content,
                    constraints={},
                    format_instruction=format_instruction,
                )
                coder_system = (
                    CODER_ENV_PROMPT if is_env
                    else CODER_YAML_PROMPT if is_yaml
                    else CODER_JSON_PROMPT if is_json
                    else CODER_CONTENT_PROMPT
                )
                coder_messages = [
                    {"role": "system", "content": coder_system},
                    {"role": "user", "content": json.dumps(coder_payload, ensure_ascii=False)},
                ]
                if is_env:
                    yield ("SYS", "Coder .env: genera contenuto (attempt 1)")
                elif is_yaml:
                    yield ("SYS", "Coder YAML: genera contenuto per write_file (attempt 1)")
                elif is_json:
                    yield ("SYS", "Coder JSON: genera contenuto per write_file (attempt 1)")
                else:
                    yield ("SYS", "Coder: genera contenuto per write_file (attempt 1)")
                generated_content = self._chat_text(coder_messages, client="coder")
                yield from self._yield_token_usage()
                yield ("CODER_RAW", generated_content)
                yield ("ATTEMPT", "coder:write_file:1")
                if not generated_content:
                    strict_payload = dict(coder_payload)
                    strict_payload["instruction"] = (
                        "STRICT: Output ONLY the full .env file content. One KEY=VALUE per line. No commentary, no code fences, no markdown."
                        if is_env
                        else "STRICT: Output ONLY the full YAML file content. Valid YAML, 2-space indentation per level, key: value format. No commentary, no code fences, no markdown."
                        if is_yaml
                        else "STRICT: Output ONLY the full JSON file content. Valid JSON, preserve all keys not in the goal, change only the key(s) requested. No commentary, no code fences, no markdown."
                        if is_json
                        else "STRICT: Output ONLY the full file content. Respect format_instruction. No commentary, no code fences."
                    )
                    strict_messages = [
                        {"role": "system", "content": coder_system},
                        {"role": "user", "content": json.dumps(strict_payload, ensure_ascii=False)},
                    ]
                    if is_env:
                        yield ("SYS", "Coder .env: genera contenuto (attempt 2 strict)")
                    elif is_yaml:
                        yield ("SYS", "Coder YAML: genera contenuto per write_file (attempt 2 strict)")
                    elif is_json:
                        yield ("SYS", "Coder JSON: genera contenuto per write_file (attempt 2 strict)")
                    else:
                        yield ("SYS", "Coder: genera contenuto per write_file (attempt 2)")
                    generated_content = self._chat_text(strict_messages, client="coder")
                    yield from self._yield_token_usage()
                    yield ("CODER_RAW", generated_content)
                    yield ("ATTEMPT", "coder:write_file:2")
                    if not generated_content:
                        yield ("ERROR", "Coder produced empty content for write_file")
                        return ""

            # Scrittura con contenuto dal coder: esecuzione diretta, no tool_caller.
            if tool_name in WRITE_DIRECT_DISPATCH:
                args = dict(analysis_args) if isinstance(analysis_args, dict) else {}
                if not args.get("path") and selected_path:
                    args["path"] = selected_path
                if tool_name == "safe_write":
                    args["dry_run"] = False
                    args["content"] = generated_content
                elif tool_name == "write_file":
                    args["content"] = generated_content
                elif tool_name == "replace_text":
                    args["path"] = selected_path or args.get("path", "")
                    args["old"] = generated_replace_old
                    args["new"] = generated_replace_new
                elif tool_name == "apply_patch_unified":
                    args["diff"] = generated_diff
                elif tool_name == "apply_write_preview":
                    preview_ctx = tool_context.get("preview_write") if isinstance(tool_context, dict) else None
                    if isinstance(preview_ctx, dict):
                        if preview_ctx.get("path"):
                            args["path"] = preview_ctx.get("path")
                        if preview_ctx.get("old_hash"):
                            args["expected_old_hash"] = preview_ctx.get("old_hash")
                    last_content = getattr(self, "_last_preview_content", "")
                    if isinstance(last_content, str) and last_content:
                        args["content"] = last_content
                    if not args.get("content"):
                        args["content"] = self._extract_content_literal(request)
                yield ("SYS", "Scrittura: esecuzione diretta (no tool_caller)")
            else:
                tool_prompt = {
                    "tool": {
                        "name": spec.name,
                        "description": spec.description,
                        "parameters": spec.parameters,
                    },
                    "args": analysis_args,
                    "required": spec.parameters.get("required", []),
                    "example": self._tool_example(spec),
                }
                if tool_name == "apply_patch_unified":
                    tool_prompt["diff_placeholder"] = "__DIFF__"
                if tool_name == "safe_write":
                    tool_prompt["content_placeholder"] = "__CONTENT__"
                if tool_name == "write_file":
                    tool_prompt["content_placeholder"] = "__CONTENT__"
                if tool_name == "python_exec":
                    target_path = self._extract_target_path(request)
                    all_paths = self._extract_paths(request)
                    workspace_files = repo_index_light.get("files", [])
                    if len(all_paths) <= 1 and len(workspace_files) > 1:
                        goal_lower = goal.lower() if isinstance(goal, str) else ""
                        if ("foo" in goal_lower and "bar" in goal_lower) or len(workspace_files) == 2:
                            all_paths = workspace_files[:2]
                    if target_path:
                        tool_prompt["target_path"] = target_path
                    if len(all_paths) > 1:
                        tool_prompt["all_paths"] = all_paths
                        tool_prompt["multiple_files"] = True
                        tool_prompt["use_paths_array"] = True
                    elif target_path:
                        tool_prompt["target_path"] = target_path

                yield ("SYS", f"Tool-caller: prepara args per {tool_name}")
                tool_messages = [
                    {"role": "system", "content": TOOL_CALLER_PROMPT},
                    {"role": "user", "content": json.dumps(tool_prompt, ensure_ascii=False)},
                ]
                tool_text, tool_events = self._chat_text_with_events(tool_messages, client="tool")
                yield from self._yield_token_usage()
                yield ("TOOL_CALLER_PROMPT", json.dumps(tool_prompt, ensure_ascii=False))
                yield ("TOOL_CALLER_RAW", tool_text)
                if tool_events:
                    yield ("TOOL_CALLER_EVENTS", json.dumps(tool_events, ensure_ascii=False))
                tool_call = self._safe_json(tool_text)
                tool_attempts = 1
                if not self._validate_tool_call(tool_call, tool_name):
                    yield ("ERROR", f"Tool-caller JSON non valido per {tool_name}, retry...")
                    strict_messages = [
                        {"role": "system", "content": TOOL_CALLER_STRICT_PROMPT},
                        {"role": "user", "content": json.dumps(tool_prompt, ensure_ascii=False)},
                    ]
                    tool_text, tool_events = self._chat_text_with_events(strict_messages, client="tool")
                    yield from self._yield_token_usage()
                    tool_attempts = 2
                    yield ("TOOL_CALLER_PROMPT", json.dumps(tool_prompt, ensure_ascii=False))
                    yield ("TOOL_CALLER_RAW", tool_text)
                if tool_events:
                    yield ("TOOL_CALLER_EVENTS_RETRY", json.dumps(tool_events, ensure_ascii=False))
                    tool_call = self._safe_json(tool_text)
                    if not self._validate_tool_call(tool_call, tool_name):
                        yield ("ERROR", "Tool-caller JSON non valido. Stop.")
                        yield ("ATTEMPT", f"tool:{tool_name}:{tool_attempts}")
                        return ""
                yield ("ATTEMPT", f"tool:{tool_name}:{tool_attempts}")
                args = tool_call.get("args", {})
            if tool_name == "safe_write":
                if args.get("dry_run") is True:
                    args["dry_run"] = False
                elif "dry_run" not in args:
                    args["dry_run"] = False

            if tool_name == "apply_patch_unified":
                args["diff"] = generated_diff
            if tool_name == "safe_write":
                args["content"] = generated_content
            if tool_name == "write_file":
                args["content"] = generated_content
            if tool_name == "preview_write":
                if not args.get("content") or args.get("content") == "__CONTENT__":
                    args["content"] = self._extract_content_literal(request)
                if isinstance(args.get("content"), str) and args.get("content"):
                    self._last_preview_content = args.get("content")

            yield ("TOOL", f"Chiamata tool: {tool_name} {json.dumps(args, ensure_ascii=False)}")
            if tool_name == "apply_write_preview":
                preview_ctx = tool_context.get("preview_write") if isinstance(tool_context, dict) else None
                if isinstance(preview_ctx, dict):
                    if preview_ctx.get("path"):
                        args["path"] = preview_ctx.get("path")
                    if preview_ctx.get("old_hash"):
                        args["expected_old_hash"] = preview_ctx.get("old_hash")
                    if not args.get("content") or args.get("content") == "__CONTENT__":
                        last_content = getattr(self, "_last_preview_content", "")
                        if isinstance(last_content, str) and last_content:
                            args["content"] = last_content
                if not args.get("content") or args.get("content") == "__CONTENT__":
                    args["content"] = self._extract_content_literal(request)
                preview = self.registry.dispatch(
                    "preview_write",
                    {"path": args.get("path", ""), "content": args.get("content", "")},
                )
                if isinstance(preview, dict) and preview.get("ok"):
                    args["expected_old_hash"] = preview.get("old_hash", "")
                else:
                    yield ("ERROR", "apply_write_preview requires a valid preview_write hash")
                    return ""

            # cwd = workdir (base_dir) per run_command e pytest_run se non specificato
            base = getattr(self, "_base_dir", None)
            if base and not args.get("cwd"):
                if tool_name == "run_command" or tool_name == "pytest_run":
                    args["cwd"] = base

            if self.registry.requires_approval(tool_name) and not self._approval_granted:
                approval_payload = {"name": tool_name, "args": args}
                yield ("REQUEST_APPROVAL", json.dumps(approval_payload, ensure_ascii=False))
                if approval_handler is not None:
                    if not approval_handler(approval_payload):
                        yield ("ERROR", "Operazione non autorizzata")
                        return ""
                else:
                    yield ("ERROR", "Operazione non autorizzata")
                    return ""

            result = self.registry.dispatch(tool_name, args)
            yield ("TOOL_RESULT", json.dumps(result, ensure_ascii=False))
            if tool_name == "preview_write" and isinstance(result, dict) and result.get("ok"):
                self._last_preview_write = result

            context.append({"step": idx, "tool": tool_name, "goal": goal, "args": args, "result": result})
            if isinstance(result, dict) and result.get("ok"):
                # Auto python_exec solo per file .py generati dal coder. .env, .json, .yaml, etc. non devono farlo scattare.
                if tool_name in WRITE_TOOLS and selected_path:
                    p = str(selected_path).lower()
                    if p.endswith(".py"):
                        modified_python_paths.add(selected_path)
                if tool_name == "replace_in_repo":
                    changed = result.get("changed", [])
                    if isinstance(changed, list):
                        for item in changed:
                            if isinstance(item, dict):
                                p = item.get("path") or item.get("file")
                                if p and str(p).endswith(".py"):
                                    modified_python_paths.add(p)
            if tool_name == "replace_text" and isinstance(result, dict):
                if result.get("replacements") == 0:
                    yield ("ERROR", "replace_text made 0 replacements")
                    return ""
            if tool_name == "replace_in_repo" and isinstance(result, dict):
                changed = result.get("changed", [])
                if isinstance(changed, list):
                    total = 0
                    for item in changed:
                        if isinstance(item, dict):
                            total += int(item.get("replacements", 0) or 0)
                    if total == 0:
                        yield ("ERROR", "replace_in_repo made 0 replacements")
                        return ""

        if modified_python_paths:
            yield from self._run_post_write_pipeline(
                modified_python_paths, context, approval_handler
            )

        final_instruction = "Provide the final answer based on tool results."
        # Truncate context to avoid Ollama 400 when payload is too large
        max_ctx_entries = 20
        max_field_len = 600
        ctx_for_final = context[-max_ctx_entries:] if len(context) > max_ctx_entries else context
        truncated = []
        for entry in ctx_for_final:
            if not isinstance(entry, dict):
                truncated.append(entry)
                continue
            e = dict(entry)
            res = e.get("result")
            if isinstance(res, dict):
                res = dict(res)
                for key in ("content", "stdout", "stderr"):
                    val = res.get(key)
                    if isinstance(val, str) and len(val) > max_field_len:
                        res[key] = val[:max_field_len] + "\n... [truncated]"
                e["result"] = res
            truncated.append(e)
        user_payload = json.dumps({"goal": request, "context": truncated, "instruction": final_instruction}, ensure_ascii=False)
        if len(user_payload) > 14_000:
            truncated = truncated[-10:]
            user_payload = json.dumps({"goal": request, "context": truncated, "instruction": final_instruction}, ensure_ascii=False)
        final_messages = [
            {"role": "system", "content": FINAL_PROMPT},
            {"role": "user", "content": user_payload},
        ]
        yield ("SYS", "Generazione output finale (task)...")
        final_text_en = self._chat_text(final_messages, client="final")
        yield from self._yield_token_usage()
        yield ("ATTEMPT", "final:global:1")
        return {"final": final_text_en, "context": context}

