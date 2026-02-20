#!/usr/bin/env python3
"""
Test Anne: solo Python. Una richiesta reale per funzione, un .txt per funzione in tests/anne/output/.

Richiede: app in esecuzione (npm run dev), AUTH_COOKIE (cookie sessione dopo login admin).

Uso:
  set AUTH_COOKIE=<cookie>
  python tests/anne/scripts/e2e_flow_test.py [base_url]

Output: tests/anne/output/flow_<id>.txt e pricing_<slug>.txt (uno file per funzione testata).
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    print("pip install requests")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).resolve().parent
FIXTURES_DIR = SCRIPT_DIR.parent / "fixtures"
OUTPUT_DIR = SCRIPT_DIR.parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("TEST_ANNE_BASE_URL", "http://localhost:3000")).rstrip("/")
AUTH_COOKIE = os.environ.get("AUTH_COOKIE", "").strip()


def load_fixture(name):
    p = FIXTURES_DIR / f"{name}.json"
    if not p.exists():
        return []
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def post_agent_chat(message: str) -> tuple[int, dict]:
    url = f"{BASE_URL}/api/ai/agent-chat"
    headers = {"Content-Type": "application/json"}
    if AUTH_COOKIE:
        headers["Cookie"] = AUTH_COOKIE
    try:
        r = requests.post(url, json={"message": message, "messages": []}, headers=headers, timeout=60)
        data = r.json() if "application/json" in (r.headers.get("content-type") or "") else {}
        return r.status_code, data
    except requests.RequestException as e:
        return 0, {"error": str(e)}
    except json.JSONDecodeError:
        return 0, {"error": "Invalid JSON response"}


def safe_filename(s: str, max_len: int = 50) -> str:
    s = re.sub(r"[^\w\-]", "_", s)
    return s[:max_len] if s else "unnamed"


def write_txt(filename: str, prompt: str, status: int, data: dict, expected_flow_id: str | None = None, error: str | None = None):
    out = OUTPUT_DIR / filename
    lines = [
        f"--- {filename} ---",
        f"run: {datetime.now(timezone.utc).isoformat()} BASE_URL={BASE_URL} AUTH={'si' if AUTH_COOKIE else 'no'}",
        "",
        f"prompt: {prompt}",
        f"status: {status}",
        f"flowId: {data.get('metadata', {}).get('flowId', 'n/a')}",
        f"success: {data.get('success', False)}",
        f"message: {(data.get('message') or data.get('error') or error or '')[:500]}",
    ]
    if expected_flow_id:
        lines.append(f"expectedFlowId: {expected_flow_id}")
    meta = data.get("metadata") or {}
    if meta.get("agentState"):
        lines.append(f"agentState keys: {','.join(meta['agentState'].keys())}")
    out.write_text("\n".join(lines), encoding="utf-8")


def main():
    if not AUTH_COOKIE:
        print("AUTH_COOKIE non impostato. Eseguo comunque il primo test e scrivo l'output (atteso 401 senza cookie).")
    flows = load_fixture("flows")
    pricing = load_fixture("pricing-matrix")
    failed = []

    for case in flows:
        fid = case.get("id", "unknown")
        prompt = case.get("genericPrompt", "")
        status, data = post_agent_chat(prompt)
        write_txt(f"flow_{fid}.txt", prompt, status, data, expected_flow_id=fid)
        if status != 200 or not data.get("success") or data.get("metadata", {}).get("flowId") != fid:
            failed.append(f"flow_{fid}")

    for i, case in enumerate(pricing):
        msg = case.get("message", "")
        expected_flow = case.get("expectedFlowId", "support")
        expected_status = case.get("expectedStatus", 200)
        desc = case.get("description", f"case_{i+1}")
        slug = safe_filename(desc) or f"case_{i+1}"
        status, data = post_agent_chat(msg)
        write_txt(f"pricing_{slug}.txt", msg, status, data, expected_flow_id=expected_flow)
        if status != expected_status or data.get("metadata", {}).get("flowId") != expected_flow:
            failed.append(f"pricing_{slug}")

    print(f"Output in {OUTPUT_DIR}: flow_*.txt e pricing_*.txt")
    if failed:
        print("FAIL:", ", ".join(failed))
        sys.exit(1)
    print("OK")
    sys.exit(0)


if __name__ == "__main__":
    main()
