from __future__ import annotations

import json
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple
from .prompts import (
    TASK_PLANNER_PROMPT,
    TASK_PLANNER_STRICT_PROMPT,
    FINAL_SUMMARY_PROMPT,
)

class AgentRunnerMixin:
    def run(
        self,
        user_text: str,
        approval_handler: Optional[Callable[[Dict[str, Any]], bool]] = None,
        allowed_files: Optional[List[str]] = None,
    ) -> Iterable[Tuple[str, str]]:
        yield ("SYS", f"Models: task_planner={self.task_planner_client.model} planner={self.planner_client.model} tool={self.tool_client.model} final={self.final_client.model} summary={self.summary_client.model} translator={self.translator_client.model} coder={self.coder_client.model} tool_analysis={self.tool_analysis_client.model} tool_argument={self.tool_argument_client.model}")
        # Translate user input to English for all model prompts
        user_text_en = self._translate_to_english(user_text)
        user_text_en_clean = self._sanitize_translated_input(user_text_en)
        self._last_user_text_en = user_text_en_clean
        yield ("TRANSLATED_CLEAN", user_text_en_clean)
        self._ensure_index()
        repo_index = self._load_index()
        files = repo_index.get("files", [])
        # Scope the index to test assets only to reduce model context noise
        scoped: List[str] = []
        if isinstance(files, list):
            scoped = [f for f in files if f.startswith("tests/")]
            if allowed_files:
                allowed_set = set(allowed_files)
                scoped = [f for f in scoped if f in allowed_set]
        repo_index_light = {"files": scoped[:200]}

        # 1) Task planner
        yield ("SYS", "Task planner: generazione piano JSON...")
        task_user = json.dumps(
            {"request": user_text_en_clean},
            ensure_ascii=False,
        )
        task_messages = [
            {"role": "system", "content": TASK_PLANNER_PROMPT},
            {"role": "user", "content": task_user},
        ]
        task_text = self._chat_text(task_messages, client="task_planner")
        yield ("TASK_PLAN", task_text)
        task_plan = self._safe_json(task_text)
        task_plan = self._normalize_task_plan(task_plan)
        task_plan = self._filter_task_plan(task_plan, user_text_en_clean)
        task_attempts = 1
        if not self._validate_task_plan(task_plan):
            yield ("ERROR", "Task planner JSON non valido, retry...")
            task_text = self._chat_text(task_messages, client="task_planner")
            task_attempts = 2
            yield ("TASK_PLAN", task_text)
            task_plan = self._safe_json(task_text)
            task_plan = self._normalize_task_plan(task_plan)
            task_plan = self._filter_task_plan(task_plan, user_text_en_clean)
            if not self._validate_task_plan(task_plan):
                yield ("ERROR", "Task planner JSON non valido. Strict retry...")
                strict_messages = [
                    {"role": "system", "content": TASK_PLANNER_STRICT_PROMPT},
                    {"role": "user", "content": task_user},
                ]
                task_text = self._chat_text(strict_messages, client="task_planner")
                task_attempts = 3
                yield ("TASK_PLAN", task_text)
                task_plan = self._safe_json(task_text)
                task_plan = self._normalize_task_plan(task_plan)
                task_plan = self._filter_task_plan(task_plan, user_text_en_clean)
                if not self._validate_task_plan(task_plan):
                    yield ("ERROR", "Task planner JSON non valido. Stop.")
                    yield ("ATTEMPT", f"task_planner:global:{task_attempts}")
                    return
        yield ("ATTEMPT", f"task_planner:global:{task_attempts}")
        tasks = task_plan.get("tasks", [])
        if not tasks:
            yield ("ERROR", "Task planner ha prodotto 0 task")
            return
        yield ("SYS", f"Task planner: {len(tasks)} task")
        collected_outputs: List[Dict[str, Any]] = []
        shared_context: List[Dict[str, Any]] = []
        for task_idx, task in enumerate(tasks, start=1):
            task_goal = task.get("goal", "") if isinstance(task, dict) else ""
            task_command = ""
            if isinstance(task, dict):
                task_command = task_goal
            yield ("SYS", f"Task {task_idx}/{len(tasks)}: {task_goal}")
            task_result = yield from self._run_tool_plan(task_command, repo_index_light, task=None, approval_handler=approval_handler, prior_context=shared_context)
            if isinstance(task_result, dict):
                collected_outputs.append(task_result)
            if isinstance(task_result, dict):
                ctx = task_result.get("context")
                if isinstance(ctx, list):
                    shared_context.extend(ctx)
        # Final summary
        summary_messages = [
            {"role": "system", "content": FINAL_SUMMARY_PROMPT},
            {"role": "user", "content": json.dumps({"request": user_text_en_clean, "task_evidence": collected_outputs}, ensure_ascii=False)},
        ]
        yield ("SYS", "Generazione riepilogo finale...")
        summary_text_en = self._chat_text(summary_messages, client="summary")
        summary_text_it = self._translate_to_italian(summary_text_en)
        for token in summary_text_it:
            yield ("MODEL_TOKEN", token)
        yield ("ATTEMPT", "summary:global:1")






