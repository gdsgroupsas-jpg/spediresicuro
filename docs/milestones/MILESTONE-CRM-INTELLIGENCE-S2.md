---
title: 'Milestone: CRM Intelligence Sprint S2 — Anne Write Actions'
scope: ai, crm
audience: developers, business
owner: ai-team
status: completed
source_of_truth: true
updated: 2026-02-08
---

# Milestone: CRM Intelligence Sprint S2

**Data completamento:** 2026-02-08
**Commit:** `576ca46` (feature) + `aaaec31` (security hardening) + `c1effa7` (CI fix)
**Status:** COMPLETATO

## Obiettivo

Dare ad Anne il "gessetto": la capacita' di **scrivere** sulla pipeline CRM via chat. Sprint S1 le aveva dato la lettura, ora puo' aggiornare stati, aggiungere note e registrare contatti — tutto con un messaggio in linguaggio naturale.

**3 azioni write:**

- **Aggiorna stato** — "segna Farmacia Rossi come contattata"
- **Aggiungi nota** — "nota su TechShop: interessati a pallet"
- **Registra contatto** — "ho chiamato Pizzeria Mario"

## Architettura

**Pattern:** Stesso Strangler di S1 — aggiunge 3 sub-intent write e 3 tool al CRM worker, zero impatto su pricing/support.

```
Messaggio utente
  |
  supervisorRouter()
  |
  +-- detectCrmIntent() --> CRM Worker
  |                            |
  |                            +-- Read sub-intents (S1, invariati)
  |                            +-- Write sub-intents (S2, NUOVI)
  |                            |     +-- update_status
  |                            |     +-- add_note
  |                            |     +-- record_contact
  |                            |
  |                            +-- crm-write-service.ts (NUOVO)
  |                                  |
  |                                  +-- updateEntityStatus()
  |                                  +-- addEntityNote()
  |                                  +-- recordEntityContact()
  |
  +-- Pricing/Support/Legacy (invariati)
```

**Due livelli CRM (invariati):**

- **Admin -> Leads** (tabella `leads`, pipeline L1 Platform)
- **Reseller -> Prospects** (tabella `reseller_prospects`, pipeline L2 filtrata per `workspace_id`)

## File Creati (2)

| File                                   | Descrizione                                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `lib/crm/crm-write-service.ts`         | Layer scrittura CRM: 3 funzioni + security helpers (sanitize, workspace validation, optimistic locking, safe events) |
| `tests/unit/crm-write-service.test.ts` | 38 test (transizioni, note, contatti, sicurezza, permessi, errori)                                                   |

## File Modificati (6)

| File                                        | Modifica                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `types/crm-intelligence.ts`                 | 3 sub-intent write (`update_status`, `add_note`, `record_contact`) + `CrmWriteResult` type        |
| `lib/agent/intent-detector.ts`              | 16 keyword write CRM (segna, nota, ho chiamato, ecc.)                                             |
| `lib/agent/workers/crm-worker.ts`           | 3 write handlers + extraction functions (status, nota, entity name, lost reason, contact note)    |
| `lib/ai/tools.ts`                           | 3 tool write (`update_crm_status`, `add_crm_note`, `record_crm_contact`) + handler in executeTool |
| `lib/ai/prompts.ts`                         | Istruzioni write nel prompt admin e reseller                                                      |
| `tests/integration/p4-auto-proceed.test.ts` | Fix mock con `importOriginal` (future-proof)                                                      |

## File Riusati (NON modificati)

| File                          | Cosa riusa                                                |
| ----------------------------- | --------------------------------------------------------- |
| `lib/crm/lead-scoring.ts`     | `calculateLeadScore()` per ricalcolo post-update          |
| `lib/crm/crm-data-service.ts` | `getEntityDetail()` per risolvere entity name -> ID       |
| `lib/db/client.ts`            | `supabaseAdmin` per query                                 |
| `types/leads.ts`              | `LEAD_VALID_TRANSITIONS` per validazione transizioni lead |
| `types/reseller-prospects.ts` | `VALID_TRANSITIONS` per validazione transizioni prospect  |

## CRM Write Service — Dettaglio

### `updateEntityStatus(params)`

1. Valida workspace (fail-fast per reseller senza workspaceId)
2. Fetch entita' con filtro workspace per reseller
3. Valida transizione con `LEAD_VALID_TRANSITIONS` / `VALID_TRANSITIONS`
4. Ricalcola score con `calculateLeadScore()`
5. Update con optimistic locking (`updated_at`) + filtro workspace
6. Crea evento timeline (best-effort)

### `addEntityNote(params)`

1. Valida workspace
2. Sanitizza nota (strip HTML tags)
3. Fetch entita' con filtro workspace
4. Appendi nota con timestamp `[YYYY-MM-DD HH:MM]`
5. Update con optimistic locking + filtro workspace
6. Crea evento `note_added` (best-effort)

### `recordEntityContact(params)`

1. Valida workspace
2. Sanitizza nota contatto
3. Fetch entita' con filtro workspace
4. Aggiorna `last_contact_at = NOW()`
5. Se status=`new`, auto-avanza a `contacted`
6. Ricalcola score
7. Update con optimistic locking + filtro workspace
8. Crea evento `contacted` (best-effort)

## Sicurezza (Security Hardening)

Dopo la feature iniziale, una security review ha identificato 4 issue CRITICI + 1 WARNING, tutti risolti nel commit `aaaec31`:

| ID    | Severita' | Problema                                                                 | Fix                                                                                    |
| ----- | --------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| C1+C2 | CRITICO   | Update query senza filtro workspace + workspaceId opzionale per reseller | `validateWorkspaceRequired()` fail-fast + `.eq('workspace_id', ...)` in FETCH e UPDATE |
| C3    | CRITICO   | TOCTOU race condition fetch-validate-update                              | Optimistic locking con `.eq('updated_at', entity.updated_at)` su tutti gli update      |
| C4    | CRITICO   | Event insert fallito blocca flusso principale                            | `insertEventSafe()` try/catch best-effort con `console.warn`                           |
| W1    | WARNING   | Input non sanitizzato (stored XSS)                                       | `sanitizeText()` strip HTML tags da note, lostReason, contactNote                      |
| W4    | WARNING   | `undefined` in event_data JSON                                           | Spread condizionale per lostReason                                                     |

## 3 Tool CRM Write

| Tool                 | Parametri                                                             | Descrizione                  |
| -------------------- | --------------------------------------------------------------------- | ---------------------------- |
| `update_crm_status`  | `entity_id?`, `entity_name?`, `new_status` (required), `lost_reason?` | Aggiorna stato lead/prospect |
| `add_crm_note`       | `entity_id?`, `entity_name?`, `note` (required)                       | Aggiunge nota con timestamp  |
| `record_crm_contact` | `entity_id?`, `entity_name?`, `contact_note?`                         | Registra contatto avvenuto   |

## Transizioni Valide

**Lead (Admin):**

| Da          | Verso                  |
| ----------- | ---------------------- |
| new         | contacted, lost        |
| contacted   | qualified, lost        |
| qualified   | negotiation, won, lost |
| negotiation | won, lost              |
| won         | (finale)               |
| lost        | new (riattivazione)    |

**Prospect (Reseller):**

| Da          | Verso                         |
| ----------- | ----------------------------- |
| new         | contacted, lost               |
| contacted   | quote_sent, negotiating, lost |
| quote_sent  | negotiating, won, lost        |
| negotiating | won, lost                     |
| won         | (finale)                      |
| lost        | new (riattivazione)           |

## Test

| Suite                      | Test                            | Risultato |
| -------------------------- | ------------------------------- | --------- |
| updateEntityStatus         | 15                              | Pass      |
| addEntityNote              | 8                               | Pass      |
| recordEntityContact        | 12                              | Pass      |
| Transizioni complete       | 2                               | Pass      |
| Sicurezza (workspace)      | 3                               | Pass      |
| Sicurezza (sanitizzazione) | 3                               | Pass      |
| Sicurezza (event_data)     | 1                               | Pass      |
| **Totale nuovi S2**        | **38**                          |           |
| P4 Auto-Proceed (fix)      | 3                               | Pass      |
| **Totale suite (tutti)**   | **2040 unit + 195 integration** |           |

## Metriche

| Metrica                   | Valore                       |
| ------------------------- | ---------------------------- |
| File nuovi                | 2                            |
| File modificati           | 6                            |
| Test nuovi                | 38                           |
| Build errors              | 0                            |
| Impatto su test esistenti | 1 fix (p4-auto-proceed mock) |

## Cosa Cambia per l'Utente

### Admin

- "Segna Farmacia Rossi come contattata" -> Anne aggiorna lead, conferma nuovo stato e score
- "Nota su TechShop: interessati a volume pallet" -> Anne aggiunge nota con timestamp
- "Ho chiamato Pizzeria Mario" -> Anne registra contatto, auto-avanza se era new
- "Segna lead come perso, prezzo troppo alto" -> Anne aggiorna a lost con motivazione

### Reseller

- "Segna TechShop come preventivo inviato" -> Anne aggiorna prospect
- "Nota che il cliente vuole urgente" -> Anne aggiunge nota
- "Ho parlato con il referente" -> Anne registra contatto

### Comportamento Intelligente

- Se messaggio ambiguo, Anne chiede chiarimento (non esegue alla cieca)
- Se transizione invalida (es. new -> won), Anne spiega le transizioni valide
- Se entita' non trovata, Anne informa e suggerisce ricerca
- Dopo ogni modifica, Anne conferma cosa ha fatto + mostra nuovo score

## Prossimi Sprint

| Sprint | Obiettivo                            | Dipendenza |
| ------ | ------------------------------------ | ---------- |
| S3     | Email + WhatsApp outreach automatico | S2         |

## Changelog

| Data       | Versione | Cambiamento                        | Autore   |
| ---------- | -------- | ---------------------------------- | -------- |
| 2026-02-08 | 1.0.0    | Sprint S2 completato               | AI Agent |
| 2026-02-08 | 1.0.1    | Security hardening (C1-C4, W1, W4) | AI Agent |
