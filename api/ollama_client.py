from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, Iterable, List, Optional

import requests

# Pausa (secondi) prima di ogni request; da env OLLAMA_REQUEST_DELAY (default 2.0). 0 = disattivato.
REQUEST_DELAY_SEC = float(os.environ.get("OLLAMA_REQUEST_DELAY", "2"))


class OllamaClient:
    def __init__(self, model: str, host: str = "http://localhost:11434") -> None:
        self.model = model
        self.host = host.rstrip("/")

    def set_host(self, host: str) -> None:
        self.host = host.rstrip("/")

    def set_model(self, model: str) -> None:
        self.model = model

    def chat(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        stream: bool = True,
        options: Optional[Dict[str, Any]] = None,
    ) -> Iterable[Dict[str, Any]]:
        if REQUEST_DELAY_SEC > 0:
            time.sleep(REQUEST_DELAY_SEC)
        url = f"{self.host}/api/chat"
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": stream,
        }
        if tools:
            payload["tools"] = tools
        if options:
            payload["options"] = {**(payload.get("options") or {}), **options}

        max_retries = 3
        backoff_sec = 1.0
        resp: requests.Response | None = None
        try:
            for attempt in range(1, max_retries + 1):
                try:
                    resp = requests.post(url, json=payload, stream=stream, timeout=(5, 300))
                except requests.RequestException:
                    if attempt >= max_retries:
                        raise
                    time.sleep(backoff_sec)
                    backoff_sec *= 2
                    continue
                # Retry on transient server errors.
                if resp.status_code >= 500 and attempt < max_retries:
                    try:
                        resp.close()
                    except Exception:
                        pass
                    time.sleep(backoff_sec)
                    backoff_sec *= 2
                    continue

                resp.raise_for_status()
                break

            if resp is None:
                raise RuntimeError("No response from Ollama")

            if not stream:
                data = resp.json()
                yield {"type": "token", "content": data.get("message", {}).get("content", "")}
                # Conto token in entrata e uscita (Ollama: prompt_eval_count, eval_count)
                prompt_count = data.get("prompt_eval_count")
                eval_count = data.get("eval_count")
                if prompt_count is not None or eval_count is not None:
                    yield {
                        "type": "token_usage",
                        "input_tokens": prompt_count if prompt_count is not None else 0,
                        "output_tokens": eval_count if eval_count is not None else 0,
                    }
                return

            for line in resp.iter_lines(decode_unicode=True):
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue

                message = data.get("message", {})
                tool_calls = message.get("tool_calls")
                if tool_calls:
                    yield {"type": "tool_calls", "tool_calls": tool_calls}

                if data.get("done"):
                    prompt_count = data.get("prompt_eval_count")
                    eval_count = data.get("eval_count")
                    if prompt_count is not None or eval_count is not None:
                        yield {
                            "type": "token_usage",
                            "input_tokens": prompt_count if prompt_count is not None else 0,
                            "output_tokens": eval_count if eval_count is not None else 0,
                        }
                    return

                content = message.get("content")
                if content:
                    yield {"type": "token", "content": content}
        finally:
            if resp is not None:
                try:
                    resp.close()
                except Exception:
                    pass
