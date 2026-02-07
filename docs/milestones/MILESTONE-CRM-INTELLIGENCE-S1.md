---
title: 'Milestone: CRM Intelligence Sprint S1 — Anne Sales Partner (Read-Only)'
scope: ai, crm
audience: developers, business
owner: ai-team
status: completed
source_of_truth: true
updated: 2026-02-07
---

# Milestone: CRM Intelligence Sprint S1

**Data completamento:** 2026-02-07
**Commit:** `d0dccfb`
**Status:** ✅ COMPLETATO

## Obiettivo

Connettere Anne (l'assistente AI) al CRM in **sola lettura**, trasformandola da assistente spedizioni a **Sales Partner senior** che capisce pipeline, bisogni inespressi, sfaccettature commerciali e ottimizza azioni.

**NON e' un chatbot con dati** — e' un partner commerciale con conoscenza da senior:

- Capisce i bisogni inespressi del settore (pharma non tratta sul prezzo, tratta sull'affidabilita')
- Suggerisce il PERCHE' di ogni azione, non solo il COSA
- Avvisa proattivamente di alert e opportunita' senza che glielo si chieda

## Architettura

**Pattern:** Strangler — aggiunge CRM intent detection e CRM worker al supervisor-router, zero impatto su pricing/support esistenti.

```
Messaggio utente
  │
  ├── Support check (esistente)
  ├── CRM check (NUOVO) → crmWorker → risposta intelligente
  ├── Pricing check (esistente)
  └── Legacy fallback
```

**Due livelli CRM:**

- **Admin → Leads** (tabella `leads`, pipeline L1 Platform)
- **Reseller → Prospects** (tabella `reseller_prospects`, pipeline L2 filtrata per `workspace_id`)

## File Creati (6)

| File                                     | Descrizione                                                                                                                                                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types/crm-intelligence.ts`              | 12 interfacce: CrmContext, CrmWorkerResult, TodayAction, SuggestedAction, CrmSearchResult, CrmEntityDetail, ConversionMetrics, PendingQuoteSummary, CrmWorkerInput, CrmSubIntent, ecc.                                  |
| `lib/crm/sales-knowledge.ts`             | 35 entry knowledge base senior (8 settori, 10 obiezioni, 5 timing, 6 negoziazione, 6 persuasione, 2 industry). Funzioni: `findRelevantKnowledge()`, `findKnowledgeByCategory()`                                         |
| `lib/crm/crm-data-service.ts`            | Layer dati CRM read-only. 9 funzioni: `getPipelineSummary`, `getHotEntities`, `getStaleEntities`, `getHealthAlerts`, `searchEntities`, `getEntityDetail`, `getTodayActions`, `getConversionMetrics`, `getPendingQuotes` |
| `lib/agent/workers/crm-worker.ts`        | Worker CRM con 6 sub-intent: pipeline_overview, entity_detail, today_actions, health_check, search, conversion_analysis. Arricchisce risposte con knowledge base settoriale                                             |
| `tests/unit/crm-data-service.test.ts`    | 25 test (knowledge structure, search, categories, importability, health rules integration)                                                                                                                              |
| `tests/unit/crm-intent-detector.test.ts` | 22 test (14 positivi CRM + 8 negativi pricing/support/general)                                                                                                                                                          |

## File Modificati (7)

| File                                          | Modifica                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `lib/agent/intent-detector.ts`                | Aggiunta `detectCrmIntent()` con 30+ keyword e exclude list             |
| `lib/agent/orchestrator/state.ts`             | Aggiunto `'crm_worker'` a `next_step` union, `crm_response` field       |
| `lib/agent/orchestrator/supervisor-router.ts` | Routing CRM tra support check e pricing check (sezione 1.6)             |
| `lib/ai/context-builder.ts`                   | Inject CRM pipeline context nel system prompt + parametro `workspaceId` |
| `lib/ai/prompts.ts`                           | Sezione CRM INTELLIGENCE per admin, CRM PROSPECT per reseller           |
| `lib/ai/tools.ts`                             | 5 tool CRM read-only + execution handlers                               |
| `lib/telemetry/logger.ts`                     | Aggiunto `'crm'` a `IntentType` union                                   |

## File Riusati (NON modificati)

| File                      | Cosa riusa                                  |
| ------------------------- | ------------------------------------------- |
| `lib/crm/health-rules.ts` | `evaluateHealthRules()` per alert proattivi |
| `lib/crm/lead-scoring.ts` | Score label per contesto                    |
| `lib/crm/analytics.ts`    | `computeCrmAnalytics()` per metriche        |
| `lib/db/client.ts`        | `supabaseAdmin` per query                   |

## Sales Knowledge Base — Contenuto

### Per Settore (8 entry)

| Settore       | Leva principale                            | Esempio key insight                                    |
| ------------- | ------------------------------------------ | ------------------------------------------------------ |
| E-commerce    | Prezzo volume + API + gestione resi        | "5% giacenze = €3.000/anno persi su 200 pacchi/mese"   |
| Pharma        | SLA + tracciabilita' + compliance GDP      | "Non chiede il prezzo, chiede cosa succede a 26 gradi" |
| Food          | Copertura sabato + consegna programmata    | "3% ritardi = margine di un mese bruciato"             |
| Artigianato   | Assicurazione inclusa + imballo dedicato   | "Una rottura/mese costa piu' del risparmio annuale"    |
| Industria     | Tariffe pallet + booking ricorrente        | "Vuole il telefono del corriere, non il tracking app"  |
| Logistica/3PL | Infrastruttura IT + prezzi all'ingrosso    | "Margine basso ma €1-2k/mese di ricavo fisso"          |
| Fashion       | Gestione resi efficiente + packaging brand | "30-40% resi: risparmiare €2/reso fa la differenza"    |
| Generico      | Qualifica prima, proponi dopo              | "Mai mandare un preventivo generico"                   |

### Per Obiezione (10 entry)

- "Troppo caro" → MAI giustificarsi, ricalcola costo totale
- "Usiamo gia' competitor" → Non attaccare, scopri il pain point
- "Devo pensarci" → Pianta seme concreto (analisi gratuita)
- "Volume non giustifica" → Break-even analysis
- "Non e' il momento" → Collega a evento concreto
- "Mandami email" → E' un no nel 80% dei casi, personalizza
- "Contratto in corso" → Follow-up 2 mesi prima scadenza
- "Non decido io" → Rendi il contatto il tuo venditore interno
- "Non ci interessa" → Capisci il perche', pianta seme
- "Dubbi sulla qualita'" → Rispondi con dati, offri periodo prova

### Per Timing (5 entry)

- Miglior giorno/orario per contatto
- Regola follow-up 3-7-14
- Ciclo decisionale per dimensione azienda
- Stagionalita' (picchi Natale, budget Gennaio)
- Urgenza naturale (mai falsa)

### Per Negoziazione (6 entry)

- Ancoraggio (premium first)
- Volume commitment
- Trial 30 giorni
- Mai cedere gratis
- Segnali di chiusura
- Vantaggio multi-corriere

### Per Persuasione (6 entry)

- Social proof settoriale
- Loss aversion quantificata
- Urgenza reale (mai falsa)
- Value framing
- Reciprocita' (dare prima di chiedere)
- Scarsita' legittima

## 5 Tool CRM (Read-Only)

| Tool                    | Parametri                      | Descrizione                           |
| ----------------------- | ------------------------------ | ------------------------------------- |
| `get_pipeline_summary`  | nessuno                        | Panoramica pipeline con KPI           |
| `get_entity_details`    | `entity_id?`, `search_name?`   | Dettaglio lead/prospect + timeline    |
| `get_crm_health_alerts` | nessuno                        | Alert: stale, hot, win-back, quote    |
| `get_today_actions`     | nessuno                        | Lista prioritizzata azioni del giorno |
| `search_crm_entities`   | `query?`, `status?`, `sector?` | Ricerca per nome/email/stato/settore  |

## CRM Context nel System Prompt

Iniettato automaticamente via `buildContext()` + `formatContextForPrompt()`:

**Admin:**

```
**PIPELINE LEAD:**
- Totale: 25 (3 new, 5 contacted, 2 qualified, 1 negotiating, 10 won, 4 lost)
- Score medio: 62 | Valore pipeline: €15.000
- 2 entita calde (score>=70) che richiedono attenzione
- 3 alert attivi
```

**Reseller:**

```
**PIPELINE PROSPECT:**
- Totale: 12 (2 new, 3 contacted, 4 quote_sent, 2 negotiating, 1 won)
- Score medio: 55 | Valore pipeline: €8.000
- 3 preventivi in attesa di risposta
```

## Test

| Suite                            | Test     | Risultato |
| -------------------------------- | -------- | --------- |
| CRM Intent Detection             | 22       | ✅ Pass   |
| Sales Knowledge Base             | 7        | ✅ Pass   |
| Knowledge Search                 | 7        | ✅ Pass   |
| Knowledge Categories             | 4        | ✅ Pass   |
| CRM Types Importability          | 2        | ✅ Pass   |
| CRM Worker/Service Importability | 2        | ✅ Pass   |
| Health Rules Integration         | 3        | ✅ Pass   |
| **Totale nuovi**                 | **47**   | ✅        |
| **Totale suite (tutti i test)**  | **2002** | ✅        |

## Metriche

| Metrica                   | Valore   |
| ------------------------- | -------- |
| File nuovi                | 6        |
| File modificati           | 7        |
| Righe aggiunte            | ~2.621   |
| Test nuovi                | 47       |
| Build errors              | 0        |
| Impatto su test esistenti | 0 broken |

## Cosa Cambia per l'Utente

### Admin

- Anne menziona lead caldi e alert **al primo messaggio** (proattivo)
- "Come va la pipeline?" → Panoramica con KPI, trend, alert e suggerimenti
- "Cosa devo fare oggi?" → Lista prioritizzata con PERCHE' per ogni azione
- "A che punto e' il lead Farmacia Rossi?" → Dettaglio con timeline e insight settoriale
- "Tasso di conversione?" → Analisi con trend e suggerimenti se in calo

### Reseller

- Anne mostra pipeline prospect e preventivi in attesa nel contesto
- "Come vanno i miei prospect?" → Panoramica filtrata per workspace
- "Trova prospect ecommerce" → Ricerca filtrata per settore
- Alert proattivi su prospect stale e preventivi in scadenza

## Prossimi Sprint

| Sprint | Obiettivo                                       | Dipendenza |
| ------ | ----------------------------------------------- | ---------- |
| S2     | CRM Write Actions (aggiorna stato, note, score) | S1         |
| S3     | Email + WhatsApp outreach automatico            | S2         |

## Changelog

| Data       | Versione | Cambiamento          | Autore   |
| ---------- | -------- | -------------------- | -------- |
| 2026-02-07 | 1.0.0    | Sprint S1 completato | AI Agent |
