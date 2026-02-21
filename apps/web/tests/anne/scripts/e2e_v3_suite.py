#!/usr/bin/env python3
"""
ANNE V3 E2E Suite

- Usa prompt reali per tutti i domini ANNE V3.
- Verifica contratto API e metadata orchestrator V3.
- Scrive log TXT per ogni caso + summary TXT finale.

Uso:
  python tests/anne/scripts/e2e_v3_suite.py [base_url]
  python tests/anne/scripts/e2e_v3_suite.py [base_url] --case <case_id>

Prerequisiti:
- App in esecuzione.
- AUTH_COOKIE impostato (opzionale, ma senza cookie molte richieste possono fallire 401).
"""

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    print("pip install requests")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).resolve().parent
FIXTURES_PATH = SCRIPT_DIR.parent / "fixtures" / "v3-suite.json"
OUTPUT_DIR = SCRIPT_DIR.parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
SUMMARY_FILE = OUTPUT_DIR / "v3_suite_summary.txt"


@dataclass
class CaseResult:
    case_id: str
    passed: bool
    status: int
    message: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_name(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", name)[:80]


def load_cases(case_filter: str | None) -> list[dict]:
    if not FIXTURES_PATH.exists():
        raise FileNotFoundError(f"Fixture non trovato: {FIXTURES_PATH}")

    with open(FIXTURES_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)

    if not isinstance(payload, list):
        raise ValueError("Fixture v3-suite.json non valido: attesa lista")

    cases = payload
    if case_filter:
        cases = [c for c in cases if c.get("id") == case_filter]

    if not cases:
        raise ValueError("Nessun caso trovato con i filtri richiesti")

    return cases


def post_agent_chat(base_url: str, auth_cookie: str, message: str) -> tuple[int, dict]:
    url = f"{base_url.rstrip('/')}/api/ai/agent-chat"
    headers = {"Content-Type": "application/json"}
    if auth_cookie:
        headers["Cookie"] = auth_cookie

    try:
        response = requests.post(
            url,
            json={"message": message, "messages": []},
            headers=headers,
            timeout=120,
        )
        content_type = response.headers.get("content-type") or ""
        data = response.json() if "application/json" in content_type else {}
        return response.status_code, data
    except requests.RequestException as exc:
        return 0, {"success": False, "error": str(exc)}
    except json.JSONDecodeError:
        return 0, {"success": False, "error": "Invalid JSON response"}


def validate_case(case: dict, status: int, data: dict) -> tuple[bool, str]:
    case_id = case.get("id", "unknown")
    expected_domain = case.get("expectedDomain", "")
    expected_channel = case.get("expectedChannel", "")
    expect_approval = bool(case.get("expectApproval", False))
    expect_clarification = bool(case.get("expectClarification", False))

    if status != 200:
        return False, f"HTTP {status}"

    if not data.get("success"):
        return False, "success=false"

    metadata = data.get("metadata") or {}

    flow_id = metadata.get("flowId")
    if not isinstance(flow_id, str) or not flow_id.startswith(f"orch.{expected_domain}."):
        return False, f"flowId non coerente: {flow_id}"

    domain = metadata.get("domain")
    if domain != expected_domain:
        return False, f"domain atteso={expected_domain} ottenuto={domain}"

    channel = metadata.get("channel")
    if channel != expected_channel:
        return False, f"channel atteso={expected_channel} ottenuto={channel}"

    pipeline_id = metadata.get("pipelineId")
    if not isinstance(pipeline_id, str) or len(pipeline_id.strip()) == 0:
        return False, "pipelineId mancante"

    stage_trace = metadata.get("stageTrace")
    if not isinstance(stage_trace, dict):
        return False, "stageTrace mancante/non valido"

    if "lastStage" not in stage_trace or "totalDurationMs" not in stage_trace:
        return False, "stageTrace incompleto"

    approval_required = bool(metadata.get("approvalRequired", False))
    if expect_approval and not approval_required:
        return False, "approvalRequired atteso ma assente"

    if expect_clarification:
        msg = (data.get("message") or "").strip()
        if not msg:
            return False, "clarification attesa ma message vuoto"

    return True, f"OK ({case_id})"


def write_case_log(case: dict, status: int, data: dict, passed: bool, reason: str, base_url: str) -> None:
    case_id = case.get("id", "unknown")
    output_file = OUTPUT_DIR / f"v3_case_{safe_name(case_id)}.txt"

    metadata = data.get("metadata") or {}
    stage_trace = metadata.get("stageTrace") or {}
    stage_entries = stage_trace.get("entries") if isinstance(stage_trace, dict) else []
    token_usage = stage_trace.get("tokenUsage") if isinstance(stage_trace, dict) else {}
    stage_detail_lines: list[str] = []

    if isinstance(stage_entries, list):
        for index, entry in enumerate(stage_entries, start=1):
            if not isinstance(entry, dict):
                continue
            stage_detail_lines.extend(
            [
                "",
                f"--- stage_{index} ---",
                f"stage: {entry.get('stage')}",
                f"attempt: {entry.get('attempt')}",
                f"model: {entry.get('model')}",
                f"success: {entry.get('success')}",
                f"durationMs: {entry.get('durationMs')}",
                f"inputTokens: {entry.get('inputTokens')}",
                f"outputTokens: {entry.get('outputTokens')}",
                f"totalTokens: {entry.get('totalTokens')}",
                f"tokenAlert: {entry.get('tokenAlert')}",
                "[input]",
                str(entry.get("inputText") or ""),
                "[output]",
                str(entry.get("outputText") or ""),
            ]
        )

    lines = [
        f"--- v3_case_{case_id} ---",
        f"run: {now_iso()}",
        f"base_url: {base_url}",
        "",
        "[case]",
        json.dumps(case, ensure_ascii=False, indent=2),
        "",
        "[response]",
        f"status: {status}",
        f"success: {data.get('success', False)}",
        f"passed: {passed}",
        f"reason: {reason}",
        f"message: {(data.get('message') or data.get('error') or '')[:1200]}",
        "",
        "[metadata]",
        json.dumps(metadata, ensure_ascii=False, indent=2),
        "",
        "[stage_trace_summary]",
        f"lastStage: {stage_trace.get('lastStage')}",
        f"totalDurationMs: {stage_trace.get('totalDurationMs')}",
        f"tokenInputTotal: {token_usage.get('inputTokens') if isinstance(token_usage, dict) else None}",
        f"tokenOutputTotal: {token_usage.get('outputTokens') if isinstance(token_usage, dict) else None}",
        f"tokenTotal: {token_usage.get('totalTokens') if isinstance(token_usage, dict) else None}",
        f"tokenAlertCount: {token_usage.get('tokenAlertCount') if isinstance(token_usage, dict) else None}",
        f"tokenAlertThreshold: {token_usage.get('tokenAlertThreshold') if isinstance(token_usage, dict) else None}",
    ]

    if stage_detail_lines:
        lines.extend(["", "[stage_trace_entries]"])
        lines.extend(stage_detail_lines)

    output_file.write_text("\n".join(lines), encoding="utf-8")


def write_summary(results: list[CaseResult], base_url: str, auth_cookie: str) -> None:
    failed = [r for r in results if not r.passed]
    lines = [
        "=== ANNE V3 E2E SUITE SUMMARY ===",
        f"run: {now_iso()}",
        f"base_url: {base_url}",
        f"auth_cookie: {'present' if auth_cookie else 'missing'}",
        f"total_cases: {len(results)}",
        f"passed: {len(results) - len(failed)}",
        f"failed: {len(failed)}",
        "",
    ]

    for r in results:
        status = "PASS" if r.passed else "FAIL"
        lines.append(f"[{status}] {r.case_id} -> HTTP {r.status} | {r.message}")

    SUMMARY_FILE.write_text("\n".join(lines), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("base_url", nargs="?", default=os.environ.get("TEST_ANNE_BASE_URL", "http://localhost:3000"))
    parser.add_argument("--case", dest="case_id", default=None)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    base_url = args.base_url.rstrip("/")
    auth_cookie = os.environ.get("AUTH_COOKIE", "").strip()

    if not auth_cookie:
        print("AUTH_COOKIE mancante: questa suite supporta solo test real autenticati.")
        sys.exit(2)

    cases = load_cases(args.case_id)

    print(f"Eseguo {len(cases)} casi ANNE V3 su {base_url}...")

    results: list[CaseResult] = []
    for case in cases:
        case_id = case.get("id", "unknown")
        prompt = case.get("prompt", "")
        status, data = post_agent_chat(base_url, auth_cookie, prompt)
        passed, reason = validate_case(case, status, data)
        write_case_log(case, status, data, passed, reason, base_url)
        results.append(CaseResult(case_id=case_id, passed=passed, status=status, message=reason))
        print(("PASS" if passed else "FAIL") + f" {case_id}: {reason}")

    write_summary(results, base_url, auth_cookie)
    print(f"Summary scritto in: {SUMMARY_FILE}")

    has_failures = any(not r.passed for r in results)
    sys.exit(1 if has_failures else 0)


if __name__ == "__main__":
    main()
