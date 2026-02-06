from __future__ import annotations
import json
import re
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple
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
    CODER_REPLACE_PROMPT,
    FINAL_PROMPT,
)

class ToolingPlanMixin:
    def _run_tool_plan(
        self,
        request: str,
        repo_index_light: Dict[str, Any],
        task: Optional[Dict[str, Any]] = None,
        approval_handler: Optional[Callable[[Dict[str, Any]], bool]] = None,
        prior_context: Optional[List[Dict[str, Any]]] = None,
    ) -> Iterable[Tuple[str, str]]:
        # Tool planner
        yield ("SYS", "Tool planner: generazione piano JSON...")
        allowed_tools = self._tool_names()
        planner_user = json.dumps({"allowed_tools": allowed_tools, "goal": request}, ensure_ascii=False)
        planner_messages = [
            {"role": "system", "content": PLANNER_PROMPT},
            {"role": "user", "content": planner_user},
        ]
        plan_text = self._chat_text(planner_messages, client="planner")
        yield ("PLAN", plan_text)
        plan = self._safe_json(plan_text)
        plan = self._normalize_plan(plan)
        planner_attempts = 1
        if not self._validate_plan(plan):
            yield ("ERROR", "Tool planner JSON non valido, retry...")
            plan_text = self._chat_text(planner_messages, client="planner")
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
        for idx, step in enumerate(steps, start=1):
            tool_name = step.get("tool", "")
            goal = step.get("goal", "")
            tool_name = self._normalize_tool_name(tool_name)
            if tool_name in ("git_status", "git_diff"):
                yield ("SYS", f"Skipping {tool_name} (not a git repo)")
                context.append({"tool": tool_name, "args": {}, "result": {"ok": True, "skipped": True}})
                continue
            if tool_name not in self.registry._tools:  # type: ignore[attr-defined]
                yield ("ERROR", f"Tool sconosciuto nel piano: {tool_name}")
                return ""
            spec = self.registry._tools[tool_name]  # type: ignore[attr-defined]

            content_literal = self._extract_content_literal(goal)
            args_template: Dict[str, Any] = {}
            if tool_name == "safe_write":
                # Tool-argument must output valid JSON with required keys; orchestrator injects real content.
                args_template["content"] = "__CONTENT__"
                args_template["dry_run"] = False
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

            analysis_payload = {
                "tool": {
                    "name": spec.name,
                    "description": spec.description,
                    "parameters": spec.parameters,
                },
                "goal": goal,
                "args_template": args_template,
                "workspace_files": repo_index_light.get("files", []),
                "repo_index": repo_index_light,  # backward compat
            }
            analysis_messages = [
                {"role": "system", "content": TOOL_ANALYSIS_PROMPT},
                {"role": "user", "content": json.dumps(analysis_payload, ensure_ascii=False)},
            ]
            yield ("TOOL_ANALYSIS_PROMPT", json.dumps(analysis_payload, ensure_ascii=False))
            analysis_text = self._chat_text(analysis_messages, client="tool_analysis")
            analysis_call = self._safe_json(analysis_text)
            analysis_attempts = 1
            if not isinstance(analysis_call, dict) or "path" not in analysis_call:
                strict_messages = [
                    {"role": "system", "content": TOOL_ANALYSIS_STRICT_PROMPT},
                    {"role": "user", "content": json.dumps(analysis_payload, ensure_ascii=False)},
                ]
                analysis_text = self._chat_text(strict_messages, client="tool_analysis")
                analysis_call = self._safe_json(analysis_text)
                analysis_attempts = 2
            if not isinstance(analysis_call, dict) or "path" not in analysis_call:
                fallback_path = self._fallback_path_from_goal(goal, repo_index_light)
                if fallback_path:
                    analysis_call = {"path": fallback_path}
                else:
                    yield ("ERROR", f"Tool analysis JSON non valido per {tool_name}")
                    yield ("ATTEMPT", f"tool_analysis:{tool_name}:{analysis_attempts}")
                    return ""
            yield ("ATTEMPT", f"tool_analysis:{tool_name}:{analysis_attempts}")
            selected_path = analysis_call.get("path", "")

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
            arg_messages = [
                {"role": "system", "content": TOOL_ARGUMENT_PROMPT},
                {"role": "user", "content": json.dumps(args_payload, ensure_ascii=False)},
            ]
            yield ("TOOL_ARGUMENT_PROMPT", json.dumps(args_payload, ensure_ascii=False))
            arg_text = self._chat_text(arg_messages, client="tool_argument")
            arg_call = self._safe_json(arg_text)
            arg_attempts = 1
            if not self._validate_tool_call(arg_call, tool_name):
                strict_messages = [
                    {"role": "system", "content": TOOL_ARGUMENT_STRICT_PROMPT},
                    {"role": "user", "content": json.dumps(args_payload, ensure_ascii=False)},
                ]
                arg_text = self._chat_text(strict_messages, client="tool_argument")
                arg_call = self._safe_json(arg_text)
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

            if tool_name == "apply_patch_unified":
                path_hint = constraints.get("path_hint", "") if isinstance(constraints, dict) else ""
                file_content = ""
                if path_hint:
                    read_res = self.system_tools.read_file(path_hint)
                    if isinstance(read_res, dict) and read_res.get("ok"):
                        file_content = read_res.get("content", "")
                coder_payload = {
                    "goal": goal,
                    "constraints": constraints,
                    "path": path_hint,
                    "file_content": file_content,
                    "evidence": context,
                    "evidence_summary": self._summarize_evidence(context),
                    "intent": "Produce a unified diff for the requested change.",
                    "instruction": "Produce a unified diff that applies the requested change to the target file. Use the provided file_content as the exact current content.",
                    "template": (
                        f"--- a/{path_hint}\n"
                        f"+++ b/{path_hint}\n"
                        "@@ -1,3 +1,4 @@\n"
                        " line one\n"
                        " line two\n"
                        "+line two and a half\n"
                        " line three\n"
                    ),
                }
                coder_messages = [
                    {"role": "system", "content": CODER_PROMPT},
                    {"role": "user", "content": json.dumps(coder_payload, ensure_ascii=False)},
                ]
                yield ("SYS", "Coder: genera diff (attempt 1)")
                generated_diff = self._chat_text(coder_messages, client="coder")
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
                coder_payload = {
                    "goal": goal,
                    "constraints": constraints,
                    "path": path_hint,
                    "file_content": file_content,
                    "evidence": context,
                    "evidence_summary": self._summarize_evidence(context),
                    "error_hint": error_hint,
                    "intent": "Fix the bug reported in error_log.txt using the current file content. Do not add new behavior.",
                    "instruction": "Produce the full updated file content that satisfies the goal. Use file_content as the exact current content and apply only the requested changes. If error_hint.error_function is provided, ONLY modify that function.",
                }
                coder_messages = [
                    {"role": "system", "content": CODER_CONTENT_PROMPT},
                    {"role": "user", "content": json.dumps(coder_payload, ensure_ascii=False)},
                ]
                yield ("SYS", "Coder: genera contenuto (attempt 1)")
                generated_content = self._chat_text(coder_messages, client="coder")
                yield ("CODER_RAW", generated_content)
                yield ("ATTEMPT", "coder:safe_write:1")
                if not generated_content:
                    strict_payload = dict(coder_payload)
                    strict_payload["instruction"] = (
                        "STRICT: Output ONLY the full file content. No commentary, no code fences."
                    )
                    strict_messages = [
                        {"role": "system", "content": CODER_CONTENT_PROMPT},
                        {"role": "user", "content": json.dumps(strict_payload, ensure_ascii=False)},
                    ]
                    yield ("SYS", "Coder: genera contenuto (attempt 2)")
                    generated_content = self._chat_text(strict_messages, client="coder")
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
                coder_payload = {
                    "goal": goal,
                    "constraints": constraints,
                    "path": path_hint,
                    "pattern_hint": pattern_hint,
                    "replacement_hint": replacement_hint,
                    "file_content": file_content,
                    "evidence": context,
                    "evidence_summary": self._summarize_evidence(context),
                    "error_hint": error_hint,
                    "intent": "Fix the bug reported in error_log.txt using the current file content. Do not add new behavior.",
                    "instruction": "Produce ONLY the replacement text for args.new. Use file_content as the exact source context and apply the requested change. If error_hint.error_function is provided, ONLY modify that function.",
                }
                coder_messages = [
                    {"role": "system", "content": CODER_REPLACE_PROMPT},
                    {"role": "user", "content": json.dumps(coder_payload, ensure_ascii=False)},
                ]
                yield ("SYS", "Coder: genera replacement (attempt 1)")
                generated_replace = self._chat_text(coder_messages, client="coder")
                yield ("CODER_RAW", generated_replace)
                yield ("ATTEMPT", "coder:replace_text:1")
                if not generated_replace:
                    strict_payload = dict(coder_payload)
                    strict_payload["instruction"] = (
                        "STRICT: Output ONLY the replacement text for args.new. No commentary, no code fences."
                    )
                    strict_messages = [
                        {"role": "system", "content": CODER_REPLACE_PROMPT},
                        {"role": "user", "content": json.dumps(strict_payload, ensure_ascii=False)},
                    ]
                    yield ("SYS", "Coder: genera replacement (attempt 2)")
                    generated_replace = self._chat_text(strict_messages, client="coder")
                    yield ("CODER_RAW", generated_replace)
                    yield ("ATTEMPT", "coder:replace_text:2")
                    if not generated_replace:
                        yield ("ERROR", "Coder produced empty replacement")
                        return ""

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
            if tool_name == "python_exec":
                target_path = self._extract_target_path(request)
                if target_path:
                    tool_prompt["target_path"] = target_path

            yield ("SYS", f"Tool-caller: prepara args per {tool_name}")
            tool_messages = [
                {"role": "system", "content": TOOL_CALLER_PROMPT},
                {"role": "user", "content": json.dumps(tool_prompt, ensure_ascii=False)},
            ]
            tool_text, tool_events = self._chat_text_with_events(tool_messages, client="tool")
            yield ("TOOL_CALLER_PROMPT", json.dumps(tool_prompt, ensure_ascii=False))
            yield ("TOOL_CALLER_RAW", tool_text)
            if tool_events:
                yield ("TOOL_CALLER_EVENTS", json.dumps(tool_events, ensure_ascii=False))
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
                tool_attempts = 2
                yield ("TOOL_CALLER_PROMPT", json.dumps(tool_prompt, ensure_ascii=False))
                yield ("TOOL_CALLER_RAW", tool_text)
            if tool_events:
                yield ("TOOL_CALLER_EVENTS", json.dumps(tool_events, ensure_ascii=False))
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
            if tool_name == "replace_text":
                args["new"] = generated_replace
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

        final_instruction = "Provide the final answer based on tool results."
        final_messages = [
            {"role": "system", "content": FINAL_PROMPT},
            {"role": "user", "content": json.dumps({"goal": request, "context": context, "instruction": final_instruction}, ensure_ascii=False)},
        ]
        yield ("SYS", "Generazione output finale (task)...")
        final_text_en = self._chat_text(final_messages, client="final")
        yield ("ATTEMPT", "final:global:1")
        return {"final": final_text_en, "context": context}

