# Test ANNE V3 (prompt reali + log TXT)

Suite E2E ANNE V3 con esecuzione solo real.

## Esecuzione

1. Esegui la suite completa (solo real):
   `npm run test:anne`

2. Esegui un singolo caso (solo real):
   `npm run test:anne -- --case shipment_create_full_payload`

Il runner fa automaticamente:

- verifica connessione Supabase reale
- avvio dev server (se non gia attivo)
- login admin
- esecuzione suite con prompt reali

## Prerequisiti env

Richiede credenziali reali in env:

- `NEXT_PUBLIC_SUPABASE_URL` (o `SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY` (o `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` (oppure `AUTH_COOKIE`)

Il runner carica:

- `.env.local` (workspace/repo)
- fallback file env in `Downloads`
- file esplicito via `ANNE_ENV_FILE`

## Fixture

Case file:
`tests/anne/fixtures/v3-suite.json`

## Output log

Cartella:
`tests/anne/output/`

File generati:

- `v3_case_<case_id>.txt`
- `v3_suite_summary.txt`

Ogni case log include anche:

- token per stage (`inputTokens`, `outputTokens`, `totalTokens`)
- alert token (`tokenAlert`) con soglia `16000`
- input/output completo di ogni passaggio modello (`inputText`, `outputText`)

## Note

- Con Ollama disconnesso i test possono fallire per indisponibilita modello.
- I log TXT restano la fonte principale di diagnosi.
