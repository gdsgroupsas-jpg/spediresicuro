# Anne: quale modello genera le risposte?

Riepilogo di **dove** e **quale modello** (se reale o meno) produce le risposte in ciascun flusso.

---

## 1. Catena "Creazione spedizione" (flusso che hai implementato)

**Risposte: NON da un modello reale.**

- **Chi risponde:** solo logica deterministica (codice).
- **Come:**
  - I 7 worker usano **regex + funzioni** in `lib/address/normalize-it-address.ts` e `lib/agent/workers/shipment-creation/validation-workers.ts` (nessuna chiamata a LLM).
  - I messaggi tipo _"Mi servono: nome mittente, CAP destinatario, ..."_ sono **template** costruiti da `generateClarificationFromMissingFields()` in `lib/agent/workers/shipment-creation/clarification.ts`.
- **Modello usato:** nessuno (zero chiamate a API esterne per il testo di risposta).

---

## 2. Intent detection (capire se è preventivo / creazione spedizione / altro)

- **Creazione spedizione:** solo **keyword** in `lib/agent/intent-detector.ts` (`detectShipmentCreationIntent`) → nessun modello.
- **Preventivo (pricing):** di default **pattern matching** (`detectPricingIntentSimple`). Se abilitato l’LLM (`detectPricingIntent(message, true)`):
  - **Modello:** **Google Gemini** (`ChatGoogleGenerativeAI`).
  - **Nome modello:** `gemini-2.0-flash-001` (da `lib/config.ts` → `llmConfig.MODEL`).
  - **Chiave:** `GOOGLE_API_KEY` in `.env.local`.

---

## 3. Supervisor e pricing graph (grafo preventivi / indirizzi)

Quando il flusso passa dal **supervisor** o dai nodi del **pricing graph** (es. estrazione dati dal messaggio, decisioni):

- **Modello:** **Google Gemini** (`ChatGoogleGenerativeAI`).
- **Nome modello:** `gemini-2.0-flash-001` (stesso `llmConfig.MODEL`).
- **Chiave:** `GOOGLE_API_KEY`.
- **File:** `lib/agent/orchestrator/supervisor.ts`, `lib/agent/orchestrator/nodes.ts`, `lib/agent/intent-detector.ts` (se usi LLM per intent).

---

## 4. Risposte “chat” legacy (quando Anne risponde in linguaggio libero)

Quando la richiesta **non** è gestita dal supervisor con risposta pronta (END) e finisce al **legacy handler** (risposta conversazionale):

1. **Primo tentativo – Copilot locale**
   - **Modello:** LLM **locale** via API OpenAI-compatible.
   - **Default:** `tinyllama`, URL `http://127.0.0.1:8080` (es. Ollama / server locale).
   - **Env:** `LOCAL_LLM_URL`, `LOCAL_LLM_MODEL`, `LOCAL_LLM_TIMEOUT_MS`.
   - **File:** `lib/agent/copilot/llm-client.ts`, `lib/agent/copilot/executor.ts`.
   - Se questo fallisce o non è configurato → si passa al punto 2.

2. **Fallback – Provider configurato in DB**
   - **Modello:** letto da **system_settings** (tabella `system_settings`, chiave `ai_provider`).
   - **Provider possibili:** `anthropic` (Claude), `deepseek`, `gemini`.
   - **Default se non configurato:** **Anthropic Claude** (`claude-3-haiku-20240307`).
   - **File:** `lib/ai/provider-adapter.ts` (`getConfiguredAIProvider`), `app/api/ai/agent-chat/route.ts`.

Quindi le risposte “da modello reale” in chat sono o dal **modello locale** (TinyLlama/Ollama) o da **Claude / DeepSeek / Gemini** a seconda della configurazione in DB.

---

## Riepilogo veloce

| Flusso                                        | Modello reale?  | Chi / cosa                                   |
| --------------------------------------------- | --------------- | -------------------------------------------- |
| Creazione spedizione (7 worker + chiarimenti) | **No**          | Codice (regex + template)                    |
| Intent creazione spedizione                   | **No**          | Keyword                                      |
| Intent preventivo (con LLM)                   | **Sì**          | Gemini `gemini-2.0-flash-001`                |
| Supervisor / pricing graph                    | **Sì**          | Gemini `gemini-2.0-flash-001`                |
| Chat legacy (primo tentativo)                 | **Sì** (locale) | LLM locale (es. TinyLlama su 127.0.0.1:8080) |
| Chat legacy (fallback)                        | **Sì**          | Claude / DeepSeek / Gemini (da DB)           |

**Conclusione:** nel flusso **“creazione spedizione”** le risposte **non** sono generate da un modello reale; sono tutte deterministiche (template + dati estratti con regex). I modelli reali (Gemini, Claude, LLM locale) entrano in gioco per intent detection (se abilitato), supervisor/pricing graph e per la chat legacy.
