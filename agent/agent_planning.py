from __future__ import annotations
from typing import Any, Dict, List
from tools.registry import ToolDef

class AgentPlanningMixin:
    def _filter_task_plan(self, plan: Dict[str, Any], request: str) -> Dict[str, Any]:
        if not isinstance(plan, dict):
            return {}
        tasks = plan.get("tasks")
        if not isinstance(tasks, list):
            return plan
        req = (request or "").lower()
        allow_report = any(k in req for k in ["report", "summary", "riepilogo", "resoconto"])
        filtered: List[Dict[str, Any]] = []
        for task in tasks:
            if not isinstance(task, dict):
                continue
            goal = str(task.get("goal", "")).lower()
            command = str(task.get("command", "")).lower()
            if not allow_report and ("report" in goal or "report" in command or "summary" in goal or "summary" in command):
                continue
            if not goal.strip():
                continue
            filtered.append(task)
        plan["tasks"] = filtered
        return plan

    def _validate_task_plan(self, plan: Dict[str, Any]) -> bool:
        if not isinstance(plan, dict):
            return False
        tasks = plan.get("tasks")
        if not isinstance(tasks, list) or not tasks:
            return False
        for task in tasks:
            if not isinstance(task, dict):
                return False
            if "goal" not in task:
                return False
            goal = task.get("goal")
            if not isinstance(goal, str) or not goal.strip():
                return False
        return True

    def _normalize_task_plan(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(plan, dict):
            return {}
        tasks = plan.get("tasks")
        if not isinstance(tasks, list):
            return plan
        return plan

    def _validate_plan(self, plan: Dict[str, Any]) -> bool:
        if not isinstance(plan, dict):
            return False
        steps = plan.get("plan")
        if not isinstance(steps, list) or not steps:
            return False
        for step in steps:
            if not isinstance(step, dict):
                return False
            if "tool" not in step or "goal" not in step:
                return False
        return True

    def _normalize_plan(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(plan, dict):
            return {}
        steps = plan.get("plan")
        if not isinstance(steps, list):
            return plan
        # Drop any final_output if present (no longer part of plan)
        if "final_output" in plan:
            plan.pop("final_output", None)
        return plan

    def _validate_tool_call(self, call: Dict[str, Any], tool_name: str) -> bool:
        if not isinstance(call, dict):
            return False
        if call.get("tool") != tool_name:
            return False
        args = call.get("args")
        if not isinstance(args, dict):
            return False
        spec = self.registry._tools.get(tool_name)  # type: ignore[attr-defined]
        if not spec:
            return False
        required = spec.parameters.get("required", [])
        for key in required:
            if key not in args:
                return False
            val = args.get(key)
            if val is None:
                return False
            if isinstance(val, str) and not val.strip():
                return False
        return True

    def _normalize_tool_name(self, name: str) -> str:
        if name in self.registry._tools:  # type: ignore[attr-defined]
            return name
        if "<|" in name:
            name = name.split("<|", 1)[0]
        name = name.strip()
        if name in self.registry._tools:  # type: ignore[attr-defined]
            return name
        cleaned = "".join(ch for ch in name if ch.isalnum() or ch == "_")
        if cleaned in self.registry._tools:  # type: ignore[attr-defined]
            return cleaned
        return name

    def _tool_example(self, spec: ToolDef) -> Dict[str, Any]:
        example_args: Dict[str, Any] = {}
        required = spec.parameters.get("required", [])
        props = spec.parameters.get("properties", {})
        for key in required:
            prop = props.get(key, {})
            ptype = prop.get("type")
            if key.endswith("_path") or key == "path":
                example_args[key] = "path/to/file_or_dir"
            elif key.endswith("_hash"):
                example_args[key] = "sha256_hash_here"
            elif key in ("content", "text", "diff"):
                example_args[key] = "..."
            elif ptype == "integer":
                example_args[key] = 1
            elif ptype == "boolean":
                example_args[key] = False
            else:
                example_args[key] = "..."
        return {"tool": spec.name, "args": example_args}
