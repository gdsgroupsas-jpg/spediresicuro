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
        debugger_model: str | None = None,
        summary_model: str | None = None,
        request_manager_model: str | None = None,
        project_manager_model: str | None = None,
        project_planner_model: str | None = None,
        route_planner_model: str | None = None,
        plan_enhancer_model: str | None = None,
        function_planner_model: str | None = None,
        discovery_model: str | None = None,
        reasoner_model: str | None = None,
        plan_resolver_model: str | None = None,
        explainer_model: str | None = None,
        explain_discovery_model: str | None = None,
        explain_planner_model: str | None = None,
    ) -> None:
        self.planner_client = OllamaClient(model=planner_model or model, host=host)
        self.task_planner_client = OllamaClient(model=task_planner_model or model, host=host)
        self.tool_client = OllamaClient(model=tool_model or model, host=host)
        self.tool_analysis_client = OllamaClient(model=tool_analysis_model or model, host=host)
        self.tool_argument_client = OllamaClient(model=tool_argument_model or model, host=host)
        self.final_client = OllamaClient(model=final_model or model, host=host)
        self.translator_client = OllamaClient(model=translator_model or model, host=host)
        self.coder_client = OllamaClient(model=coder_model or model, host=host)
        self.debugger_client = OllamaClient(model=debugger_model or coder_model or model, host=host)
        self.summary_client = OllamaClient(model=summary_model or model, host=host)
        base = model
        self.request_manager_client = OllamaClient(model=request_manager_model or base, host=host)
        self.project_manager_client = OllamaClient(model=project_manager_model or base, host=host)
        self.project_planner_client = OllamaClient(model=project_planner_model or base, host=host)
        self.route_planner_client = OllamaClient(model=route_planner_model or base, host=host)
        self.plan_enhancer_client = OllamaClient(model=plan_enhancer_model or base, host=host)
        self.function_planner_client = OllamaClient(model=function_planner_model or base, host=host)
        self.discovery_client = OllamaClient(model=discovery_model or base, host=host)
        self.reasoner_client = OllamaClient(model=reasoner_model or base, host=host)
        self.plan_resolver_client = OllamaClient(model=plan_resolver_model or base, host=host)
        self.explainer_client = OllamaClient(model=explainer_model or base, host=host)
        self.explain_discovery_client = OllamaClient(model=explain_discovery_model or base, host=host)
        self.explain_planner_client = OllamaClient(model=explain_planner_model or base, host=host)
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
        self._token_options = self._build_token_options()
        self._last_token_usage: Optional[Dict[str, Any]] = None
        self._last_token_limits: Optional[Dict[str, int]] = None
        self._last_token_usage_context: Optional[Dict[str, str]] = None  # request_preview, response_preview (troncati)

    def _build_token_options(self) -> Dict[str, Dict[str, int]]:
        """Limiti token (num_ctx, num_predict) per client. Default + override da env OLLAMA_<CLIENT>_NUM_CTX / NUM_PREDICT."""
        # Coder: 8192 in entrata e in uscita (goal, file_content, diff/contenuti lunghi).
        # Altri client: 4096.
        defaults: Dict[str, Dict[str, int]] = {
            "coder": {"num_ctx": 8192, "num_predict": 8192},
            "debugger": {"num_ctx": 8192, "num_predict": 8192},
            "task_planner": {"num_ctx": 4096, "num_predict": 4096},
            "planner": {"num_ctx": 4096, "num_predict": 4096},
            "tool": {"num_ctx": 4096, "num_predict": 4096},
            "tool_analysis": {"num_ctx": 4096, "num_predict": 4096},
            "tool_argument": {"num_ctx": 4096, "num_predict": 4096},
            "final": {"num_ctx": 4096, "num_predict": 4096},
            "translator": {"num_ctx": 4096, "num_predict": 4096},
            "summary": {"num_ctx": 4096, "num_predict": 4096},
            "request_manager": {"num_ctx": 4096, "num_predict": 1024},
            "project_manager": {"num_ctx": 4096, "num_predict": 4096},
            "project_planner": {"num_ctx": 4096, "num_predict": 4096},
            "route_planner": {"num_ctx": 4096, "num_predict": 4096},
            "plan_enhancer": {"num_ctx": 4096, "num_predict": 4096},
            "function_planner": {"num_ctx": 4096, "num_predict": 4096},
            "discovery": {"num_ctx": 4096, "num_predict": 4096},
            "reasoner": {"num_ctx": 8192, "num_predict": 4096},
            "plan_resolver": {"num_ctx": 4096, "num_predict": 4096},
            "explainer": {"num_ctx": 4096, "num_predict": 4096},
            "explain_discovery": {"num_ctx": 4096, "num_predict": 4096},
            "explain_planner": {"num_ctx": 4096, "num_predict": 4096},
        }
        out: Dict[str, Dict[str, int]] = {}
        for client, opts in defaults.items():
            key_prefix = "OLLAMA_" + client.upper() + "_"
            num_ctx = os.environ.get(key_prefix + "NUM_CTX")
            num_predict = os.environ.get(key_prefix + "NUM_PREDICT")
            out[client] = {
                "num_ctx": int(num_ctx) if num_ctx is not None else opts["num_ctx"],
                "num_predict": int(num_predict) if num_predict is not None else opts["num_predict"],
            }
        return out

    _TOKEN_PREVIEW_MAX = 1500  # caratteri max per request/response nella preview quando si sfora il limite

    def _yield_token_usage(self) -> Iterable[Tuple[str, str]]:
        """Se è stato impostato _last_token_usage dopo una chat, yield (TOKEN_USAGE, json). Alert bloccante se sforati i limiti."""
        usage = getattr(self, "_last_token_usage", None)
        limits = getattr(self, "_last_token_limits", None)
        if not usage:
            return
        yield ("TOKEN_USAGE", json.dumps(usage, ensure_ascii=False))
        if limits and isinstance(limits, dict):
            num_ctx = limits.get("num_ctx", 0)
            num_predict = limits.get("num_predict", 0)
            inp = int(usage.get("input_tokens", 0))
            out = int(usage.get("output_tokens", 0))
            client = usage.get("client", "?")
            # Alert quando si usa il massimo disponibile (>=) o si sfora (>)
            at_limit_ctx = num_ctx > 0 and inp >= num_ctx
            at_limit_predict = num_predict > 0 and out >= num_predict
            if at_limit_ctx or at_limit_predict:
                msg = f"Token limit reached or exceeded (client={client}):"
                if at_limit_ctx:
                    msg += f" input_tokens={inp} >= num_ctx={num_ctx}"
                if at_limit_predict:
                    msg += f" output_tokens={out} >= num_predict={num_predict}"
                yield ("ERROR", msg)
                ctx = getattr(self, "_last_token_usage_context", None)
                if ctx and isinstance(ctx, dict):
                    yield ("TOKEN_LIMIT_PREVIEW", json.dumps(ctx, ensure_ascii=False))
        self._last_token_usage = None
        self._last_token_limits = None
        self._last_token_usage_context = None

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
        self.debugger_client.set_host(host)
        self.summary_client.set_host(host)
        self.request_manager_client.set_host(host)
        self.project_manager_client.set_host(host)
        self.project_planner_client.set_host(host)
        self.route_planner_client.set_host(host)
        self.plan_enhancer_client.set_host(host)
        self.function_planner_client.set_host(host)
        self.discovery_client.set_host(host)
        self.reasoner_client.set_host(host)
        self.plan_resolver_client.set_host(host)
        self.explainer_client.set_host(host)
        self.explain_discovery_client.set_host(host)
        self.explain_planner_client.set_host(host)


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


    def set_debugger_model(self, model: str) -> None:
        self.debugger_client.set_model(model)


    def set_summary_model(self, model: str) -> None:
        self.summary_client.set_model(model)

    def set_request_manager_model(self, model: str) -> None:
        self.request_manager_client.set_model(model)

    def set_project_manager_model(self, model: str) -> None:
        self.project_manager_client.set_model(model)

    def set_project_planner_model(self, model: str) -> None:
        self.project_planner_client.set_model(model)

    def set_route_planner_model(self, model: str) -> None:
        self.route_planner_client.set_model(model)

    def set_plan_enhancer_model(self, model: str) -> None:
        self.plan_enhancer_client.set_model(model)

    def set_function_planner_model(self, model: str) -> None:
        self.function_planner_client.set_model(model)

    def set_discovery_model(self, model: str) -> None:
        self.discovery_client.set_model(model)

    def set_reasoner_model(self, model: str) -> None:
        self.reasoner_client.set_model(model)

    def set_plan_resolver_model(self, model: str) -> None:
        self.plan_resolver_client.set_model(model)

    def set_explainer_model(self, model: str) -> None:
        self.explainer_client.set_model(model)

    def set_explain_discovery_model(self, model: str) -> None:
        self.explain_discovery_client.set_model(model)

    def set_explain_planner_model(self, model: str) -> None:
        self.explain_planner_client.set_model(model)

    def _chat_text_with_events(
        self, messages: List[Dict[str, Any]], client: str = "tool"
    ) -> Tuple[str, List[Dict[str, Any]]]:
        active = self._client_for(client)
        opts = self._token_options.get(client, {})
        out: List[str] = []
        events: List[Dict[str, Any]] = []
        self._last_token_usage = None
        for event in active.chat(messages=messages, tools=None, stream=False, options=opts or None):
            events.append(event)
            if event.get("type") == "token_usage":
                self._last_token_usage = {"client": client, "input_tokens": event.get("input_tokens", 0), "output_tokens": event.get("output_tokens", 0)}
                self._last_token_limits = self._token_options.get(client, {})
                req_preview = json.dumps(messages, ensure_ascii=False)
                resp_preview = "".join(out)
                if len(req_preview) > self._TOKEN_PREVIEW_MAX:
                    req_preview = req_preview[: self._TOKEN_PREVIEW_MAX] + "... [troncato]"
                if len(resp_preview) > self._TOKEN_PREVIEW_MAX:
                    resp_preview = resp_preview[: self._TOKEN_PREVIEW_MAX] + "... [troncato]"
                self._last_token_usage_context = {"request_preview": req_preview, "response_preview": resp_preview}
            elif event.get("type") == "token":
                out.append(event.get("content", ""))
        return "".join(out).strip(), events

    def _client_for(self, client: str):
        """Return the OllamaClient for the given client name."""
        mapping = {
            "planner": self.planner_client,
            "task_planner": self.task_planner_client,
            "summary": self.summary_client,
            "final": self.final_client,
            "translator": self.translator_client,
            "coder": self.coder_client,
            "debugger": self.debugger_client,
            "request_manager": self.request_manager_client,
            "project_manager": self.project_manager_client,
            "project_planner": self.project_planner_client,
            "route_planner": self.route_planner_client,
            "plan_enhancer": self.plan_enhancer_client,
            "function_planner": self.function_planner_client,
            "discovery": self.discovery_client,
            "reasoner": self.reasoner_client,
            "plan_resolver": self.plan_resolver_client,
            "explainer": self.explainer_client,
            "explain_discovery": self.explain_discovery_client,
            "explain_planner": self.explain_planner_client,
        }
        return mapping.get(client, self.tool_client)

    def _chat_text(self, messages: List[Dict[str, Any]], client: str = "tool") -> str:
        active = self._client_for(client)
        opts = self._token_options.get(client, {})
        out = []
        self._last_token_usage = None
        for event in active.chat(messages=messages, tools=None, stream=False, options=opts or None):
            if event.get("type") == "token_usage":
                self._last_token_usage = {"client": client, "input_tokens": event.get("input_tokens", 0), "output_tokens": event.get("output_tokens", 0)}
                self._last_token_limits = self._token_options.get(client, {})
                req_preview = json.dumps(messages, ensure_ascii=False)
                resp_preview = "".join(out)
                if len(req_preview) > self._TOKEN_PREVIEW_MAX:
                    req_preview = req_preview[: self._TOKEN_PREVIEW_MAX] + "... [troncato]"
                if len(resp_preview) > self._TOKEN_PREVIEW_MAX:
                    resp_preview = resp_preview[: self._TOKEN_PREVIEW_MAX] + "... [troncato]"
                self._last_token_usage_context = {"request_preview": req_preview, "response_preview": resp_preview}
            elif event.get("type") == "token":
                out.append(event.get("content", ""))
        return "".join(out).strip()

    def _is_translator_refusal(self, out: str) -> bool:
        """Se la risposta del translator assomiglia a un rifiuto, usiamo il testo originale."""
        if not out or len(out) > 500:
            return False
        lower = out.lower()
        return (
            "i can't help" in lower or "i cannot help" in lower
            or "i'm sorry" in lower or "i am sorry" in lower
            or "i'm unable" in lower or "i am not able" in lower
        )

    def _translate_to_english(self, text: str) -> str:
        messages = [
            {"role": "system", "content": TRANSLATOR_SYSTEM_PROMPT},
            {"role": "user", "content": "Translate to English:\n" + text},
        ]
        out = self._chat_text(messages, client="translator")
        out = out.strip() if out else ""
        if not out or self._is_translator_refusal(out):
            return text
        return out

    def _translate_to_italian(self, text: str) -> str:
        messages = [
            {"role": "system", "content": TRANSLATOR_SYSTEM_PROMPT},
            {"role": "user", "content": "Translate to Italian:\n" + text},
        ]
        out = self._chat_text(messages, client="translator")
        out = out.strip() if out else ""
        if not out or self._is_translator_refusal(out):
            return text
        return out

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
        def try_parse(s: str) -> Dict[str, Any]:
            try:
                out = json.loads(s)
                return out if isinstance(out, dict) else {}
            except Exception:
                return {}

        out = try_parse(text)
        if out:
            return out
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            segment = text[start : end + 1]
            out = try_parse(segment)
            if out:
                return out
            # Normalize literal newlines inside double-quoted strings so JSON is valid
            def fix_newlines_in_strings(t: str) -> str:
                def repl(m: re.Match) -> str:
                    content = m.group(1)
                    content = content.replace("\r\n", "\\n").replace("\r", "\\n").replace("\n", "\\n")
                    return '"' + content + '"'
                return re.sub(r'"((?:[^"\\]|\\.|\n|\r)*)"', repl, t)
            out = try_parse(fix_newlines_in_strings(segment))
            if out:
                return out
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
