# Test Anne (solo Python)

Tutti i test Anne sono in **Python**. Un file .txt per ogni funzione testata in `tests/anne/output/`.

## Esecuzione

1. Avvia l'app: `npm run dev`
2. Imposta il cookie di sessione (login come admin, poi DevTools > Application > Cookies):
   - PowerShell: `$env:AUTH_COOKIE="<valore cookie>"`
   - cmd: `set AUTH_COOKIE=<valore cookie>`
3. Dalla root: `npm run test:anne`  
   Oppure con login automatico (E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD in .env.local): `npm run test:anne:real`

Su Windows se `python` non è in PATH usa: `py tests/anne/scripts/e2e_flow_test.py`

## Output

In `tests/anne/output/`:

- `flow_richiesta_preventivo.txt`, `flow_crea_spedizione.txt`, `flow_support.txt`, … — un file per flusso
- `pricing_*.txt` — un file per caso della pricing matrix
- **`crea_spedizione_reale_log.txt`** — log del test “spedizione reale” (vedi sotto)

Ogni file contiene: run, prompt, status, flowId, success, message, expectedFlowId.

### Test “crea spedizione reale”

Verifica che una spedizione venga **effettivamente creata** (booking success). **Account admin già impostato** (E2E*ADMIN*\* in .env.local), **nessun soldo reale**. Passa **solo** se `booking_result.status === 'success'`.

```bash
npm run test:anne:crea-spedizione-reale
# oppure: node scripts/anne-crea-spedizione-reale.js http://localhost:3000
```

(Login automatico con E2E*ADMIN*\* da .env.local; nessun soldo reale.)

- **Prompt:** un unico messaggio con tutti i dati (mittente, destinatario, indirizzo, CAP, provincia, telefono, peso) per consentire all’LLM di estrarre tutto e alla chain di arrivare a booking.
- **Log:** `tests/anne/output/crea_spedizione_reale_log.txt` (timestamp, prompt, response, metadata, booking_result).
- **Exit 0** solo se la spedizione è stata creata; altrimenti **exit 1** (clarification, errore, o flowId diverso da crea_spedizione).

## Dipendenze

```bash
pip install -r tests/anne/requirements-anne-tests.txt
```

(contiene `requests`)
