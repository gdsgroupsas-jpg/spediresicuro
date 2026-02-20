#!/usr/bin/env python3
"""
Test crea spedizione REALE: il test passa SOLO se la spedizione viene effettivamente creata (booking success).

- Nessun soldo reale: usa account admin già impostato (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in .env.local).
- Prompt generico ma completo (tutti i dati in un messaggio per estrazione LLM).
- Log completo su file .txt (timestamp, prompt, request/response, booking_result).

Uso consigliato (login automatico con account admin):
  node scripts/anne-crea-spedizione-reale.js
  node scripts/anne-crea-spedizione-reale.js http://localhost:3000

Oppure con cookie già ottenuto:
  set AUTH_COOKIE=<cookie>
  python tests/anne/scripts/e2e_crea_spedizione_reale.py [base_url]

Output: tests/anne/output/crea_spedizione_reale_log.txt
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    print("pip install requests")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = SCRIPT_DIR.parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = OUTPUT_DIR / "crea_spedizione_reale_log.txt"

BASE_URL = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("TEST_ANNE_BASE_URL", "http://localhost:3000")).rstrip("/")
AUTH_COOKIE = os.environ.get("AUTH_COOKIE", "").strip()

# Prompt generico ma COMPLETO: mittente, destinatario, indirizzo, CAP, provincia, telefono, peso.
# L'LLM deve estrarre tutto e la chain deve arrivare a pricing + booking.
PROMPT = (
    "Voglio creare una spedizione. "
    "Mittente: Mario Rossi, telefono 3331234567. "
    "Destinatario: Laura Bianchi, via Roma 15, 00100 Roma RM, telefono 0661234567. "
    "Pacco 2.5 kg."
)


def post_agent_chat(message: str) -> tuple[int, dict]:
    url = f"{BASE_URL}/api/ai/agent-chat"
    headers = {"Content-Type": "application/json"}
    if AUTH_COOKIE:
        headers["Cookie"] = AUTH_COOKIE
    try:
        r = requests.post(url, json={"message": message, "messages": []}, headers=headers, timeout=120)
        data = r.json() if "application/json" in (r.headers.get("content-type") or "") else {}
        return r.status_code, data
    except requests.RequestException as e:
        return 0, {"error": str(e)}
    except json.JSONDecodeError:
        return 0, {"error": "Invalid JSON response"}


def is_booking_success(data: dict) -> bool:
    """True se la risposta indica che la spedizione è stata effettivamente prenotata."""
    meta = data.get("metadata") or {}
    agent = meta.get("agentState") or {}
    booking = agent.get("booking_result")
    if booking and booking.get("status") == "success":
        return True
    msg = (data.get("message") or "").lower()
    if "prenotata" in msg and ("successo" in msg or "tracking" in msg):
        return True
    if "spedizione prenotata" in msg or "tracking:" in msg:
        return True
    return False


def write_log(prompt: str, status: int, data: dict, booking_ok: bool) -> None:
    lines = [
        "=== CREA SPEDIZIONE REALE - LOG ===",
        f"run: {datetime.now(timezone.utc).isoformat()}",
        f"BASE_URL: {BASE_URL}",
        f"AUTH: {'si' if AUTH_COOKIE else 'no'}",
        "",
        "--- PROMPT ---",
        prompt,
        "",
        "--- RESPONSE ---",
        f"status_http: {status}",
        f"success: {data.get('success', False)}",
        f"message: {(data.get('message') or data.get('error') or '')[:800]}",
        "",
        "--- METADATA ---",
        json.dumps(data.get("metadata") or {}, indent=2, ensure_ascii=False),
        "",
        "--- BOOKING ---",
        f"booking_creata: {booking_ok}",
    ]
    agent = (data.get("metadata") or {}).get("agentState") or {}
    if agent.get("booking_result"):
        lines.append("booking_result: " + json.dumps(agent["booking_result"], indent=2, ensure_ascii=False))
    LOG_FILE.write_text("\n".join(lines), encoding="utf-8")
    print(f"Log scritto in {LOG_FILE}")


def main() -> None:
    if not AUTH_COOKIE:
        print("AUTH_COOKIE non impostato. Usa: node scripts/anne-crea-spedizione-reale.js")
        print("(login automatico con account admin da E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in .env.local)")
        print("Senza cookie il test restituirà 401.")
    print("Invio prompt crea spedizione (dati completi)...")
    status, data = post_agent_chat(PROMPT)
    booking_ok = status == 200 and data.get("success") and is_booking_success(data)
    write_log(PROMPT, status, data, booking_ok)

    if status != 200:
        print(f"FAIL: HTTP {status}")
        sys.exit(1)
    if not data.get("success"):
        print("FAIL: success=false nella risposta")
        sys.exit(1)
    flow_id = (data.get("metadata") or {}).get("flowId", "")
    if flow_id != "crea_spedizione":
        print(f"FAIL: flowId={flow_id} (atteso crea_spedizione)")
        sys.exit(1)
    if not booking_ok:
        print("FAIL: la spedizione NON è stata creata (nessun booking_result.status=success nel messaggio)")
        print("Controlla il log per clarification o errori.")
        sys.exit(1)
    print("OK: spedizione creata (booking success)")
    sys.exit(0)


if __name__ == "__main__":
    main()
