from __future__ import annotations

import json
import os
import re
import subprocess
import time
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple

from api.ollama_client import OllamaClient
from tools.registry import ToolDef, ToolRegistry
from tools.system_tools import SystemTools
from tools.python_tools import PythonTools
from .prompts import (
    SYSTEM_PROMPT,
    TASK_PLANNER_PROMPT,
    TASK_PLANNER_STRICT_PROMPT,
    TASK_PLANNER_REPAIR_PROMPT,
    PLANNER_PROMPT,
    PLANNER_STRICT_PROMPT,
    PLANNER_REPAIR_PROMPT,
    TOOL_CALLER_PROMPT,
    TOOL_CALLER_STRICT_PROMPT,
    CODER_PROMPT,
    CODER_CONTENT_PROMPT,
    CODER_REPLACE_PROMPT,
    FINAL_PROMPT,
    FINAL_SUMMARY_PROMPT,
    TRANSLATOR_SYSTEM_PROMPT,
    TRANSLATE_PROMPT,
    TRANSLATE_TO_IT_PROMPT,
)

class AgentBaseMixin:
    def __init__(
        self,
        base_dir: str | None = None,
        model: str = "gpt-oss:20b-cloud",
        host: str = "http://localhost:11434",
        final_model: str | None = None,
        planner_model: str | None = None,
        task_planner_model: str | None = None,
        tool_model: str | None = None,
        tool_analysis_model: str | None = None,
        tool_argument_model: str | None = None,
        translator_model: str | None = None,
        coder_model: str | None = None,
        summary_model: str | None = None,
    ) -> None:
        self.planner_client = OllamaClient(model=planner_model or model, host=host)
        self.task_planner_client = OllamaClient(model=task_planner_model or model, host=host)
        self.tool_client = OllamaClient(model=tool_model or model, host=host)
        self.tool_analysis_client = OllamaClient(model=tool_analysis_model or model, host=host)
        self.tool_argument_client = OllamaClient(model=tool_argument_model or model, host=host)
        self.final_client = OllamaClient(model=final_model or model, host=host)
        self.translator_client = OllamaClient(model=translator_model or model, host=host)
        self.coder_client = OllamaClient(model=coder_model or model, host=host)
        self.summary_client = OllamaClient(model=summary_model or model, host=host)
        self.system_tools = SystemTools(base_dir=base_dir, allow_any=True)
        self.python_tools = PythonTools()
        self.registry = self._build_registry()
        self._approval_granted = False
        self._history: List[Dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
        self._last_user_text_en: str = ""
        self._base_dir = os.path.abspath(base_dir or os.getcwd())
        self._index_dir = os.path.join(self._base_dir, ".index")
        self._index_path = os.path.join(self._index_dir, "index.json")
        self._index_last_start = 0.0
        self._index_files: set[str] = set()


    def set_write_authorized(self, authorized: bool) -> None:
        self._approval_granted = authorized


    def reset_history(self) -> None:
        self._history = [{"role": "system", "content": SYSTEM_PROMPT}]


    def _sanitize_translated_input(self, text: str) -> str:
        cleaned = text.strip()
        if not cleaned:
            return cleaned
        patterns = [
            r"\*\*Fixed[\s\S]*",
            r"\*\*Change Summary[\s\S]*",
        ]
        for pat in patterns:
            cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```[\s\S]*?```", "", cleaned).strip()
        if "\n\n" in cleaned:
            cleaned = cleaned.split("\n\n", 1)[0].strip()

        return cleaned


    def set_base_dir(self, base_dir: str) -> None:
        self.system_tools.set_base_dir(base_dir)


    def set_model(self, model: str) -> None:
        self.tool_client.set_model(model)


    def set_host(self, host: str) -> None:
        self.planner_client.set_host(host)
        self.task_planner_client.set_host(host)
        self.tool_client.set_host(host)
        self.tool_analysis_client.set_host(host)
        self.tool_argument_client.set_host(host)
        self.final_client.set_host(host)
        self.translator_client.set_host(host)
        self.coder_client.set_host(host)
        self.summary_client.set_host(host)


    def set_final_model(self, model: str) -> None:
        self.final_client.set_model(model)


    def set_planner_model(self, model: str) -> None:
        self.planner_client.set_model(model)


    def set_task_planner_model(self, model: str) -> None:
        self.task_planner_client.set_model(model)


    def set_tool_model(self, model: str) -> None:
        self.tool_client.set_model(model)

    def set_tool_analysis_model(self, model: str) -> None:
        self.tool_analysis_client.set_model(model)

    def set_tool_argument_model(self, model: str) -> None:
        self.tool_argument_client.set_model(model)


    def set_translator_model(self, model: str) -> None:
        self.translator_client.set_model(model)


    def set_coder_model(self, model: str) -> None:
        self.coder_client.set_model(model)


    def set_summary_model(self, model: str) -> None:
        self.summary_client.set_model(model)


    def _chat_text_with_events(
        self, messages: List[Dict[str, Any]], client: str = "tool"
    ) -> Tuple[str, List[Dict[str, Any]]]:
        if client == "planner":
            active = self.planner_client
        elif client == "task_planner":
            active = self.task_planner_client
        elif client == "summary":
            active = self.summary_client
        elif client == "final":
            active = self.final_client
        elif client == "translator":
            active = self.translator_client
        elif client == "coder":
            active = self.coder_client
        else:
            active = self.tool_client
        out: List[str] = []
        events: List[Dict[str, Any]] = []
        for event in active.chat(messages=messages, tools=None, stream=False):
            events.append(event)
            if event.get("type") == "token":
                out.append(event.get("content", ""))
        return "".join(out).strip(), events

    def _chat_text(self, messages: List[Dict[str, Any]], client: str = "tool") -> str:
        if client == "planner":
            active = self.planner_client
        elif client == "task_planner":
            active = self.task_planner_client
        elif client == "summary":
            active = self.summary_client
        elif client == "final":
            active = self.final_client
        elif client == "translator":
            active = self.translator_client
        elif client == "coder":
            active = self.coder_client
        else:
            active = self.tool_client
        out = []
        for event in active.chat(messages=messages, tools=None, stream=False):
            if event.get("type") == "token":
                out.append(event.get("content", ""))
        return "".join(out).strip()

    def _translate_to_english(self, text: str) -> str:
        messages = [
            {"role": "system", "content": TRANSLATOR_SYSTEM_PROMPT},
            {"role": "user", "content": "Translate to English:\
" + text},
        ]
        out = self._chat_text(messages, client="translator")
        return out.strip() or text

    def _translate_to_italian(self, text: str) -> str:
        messages = [
            {"role": "system", "content": TRANSLATOR_SYSTEM_PROMPT},
            {"role": "user", "content": "Translate to Italian:\
" + text},
        ]
        out = self._chat_text(messages, client="translator")
        return out.strip() or text

    def _summarize_evidence(self, context: List[Dict[str, Any]]) -> Dict[str, Any]:
        summary: Dict[str, Any] = {"error_log": "", "file_content": "", "notes": []}
        for item in context:
            if not isinstance(item, dict):
                continue
            if item.get("tool") == "read_file":
                path = str(item.get("args", {}).get("path", ""))
                content = str(item.get("result", {}).get("content", ""))
                if path.endswith("error_log.txt"):
                    summary["error_log"] = content
                elif path.endswith("log_error_sample.py"):
                    summary["file_content"] = content
        if summary["error_log"]:
            summary["notes"].append("Use error_log.txt traceback as primary bug evidence.")
        return summary

    def _tool_names(self) -> List[str]:
        return sorted(list(self.registry._tools.keys()))  # type: ignore[attr-defined]

    def _safe_json(self, text: str) -> Dict[str, Any]:
        try:
            return json.loads(text)
        except Exception:
            # try to extract JSON substring
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    return json.loads(text[start : end + 1])
                except Exception:
                    pass
        return {}

    def _ensure_index(self) -> None:
        now = time.time()
        if now - self._index_last_start < 10:
            return
        self._index_last_start = now
        try:
            os.makedirs(self._index_dir, exist_ok=True)
            if os.path.exists(self._index_path):
                # refresh only if older than 60s
                if now - os.path.getmtime(self._index_path) < 60:
                    return
            indexer = os.path.join(os.path.dirname(__file__), "..", "tools", "indexer.py")
            indexer = os.path.abspath(indexer)
            subprocess.Popen(
                ["py", indexer, os.path.abspath(self._base_dir), os.path.abspath(self._index_path)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except Exception:
            pass

    def _load_index(self) -> Dict[str, Any]:
        try:
            if not os.path.exists(self._index_path):
                return {"files": [], "py_symbols": [], "truncated": False}
            with open(self._index_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            files = data.get("files") or []
            if isinstance(files, list):
                self._index_files = set(str(p).replace("\\", "/") for p in files)
            return data
        except Exception:
            return {"files": [], "py_symbols": [], "truncated": False}
