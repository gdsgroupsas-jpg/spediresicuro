# CRM Intelligence - SpedireSicuro

## Overview

Il CRM Intelligence e' il sistema di gestione relazioni commerciali integrato nella piattaforma. Opera su due livelli: **Lead** (platform-level, gestiti dall'admin per acquisire nuovi reseller) e **Prospect** (workspace-level, gestiti dal singolo reseller per acquisire clienti finali). Include scoring automatico, health rules proattive, timeline eventi, e integrazione nativa con l'assistente AI Anne.

## Target Audience

- [x] Developers
- [x] DevOps
- [x] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- Comprensione del workspace hierarchy (`RESELLER_HIERARCHY.md`)
- Familiarita' con il sistema di autenticazione (safe-auth, workspace-auth)
- Conoscenza base dell'architettura AI (Anne, supervisor-router)

## Quick Reference

| Sezione             | File Principale                    | Link                                  |
| ------------------- | ---------------------------------- | ------------------------------------- |
| Data Service (Read) | `lib/crm/crm-data-service.ts`      | [Read Functions](#read-functions)     |
| Write Service       | `lib/crm/crm-write-service.ts`     | [Write Functions](#write-functions)   |
| Lead Scoring        | `lib/crm/lead-scoring.ts`          | [Scoring](#lead-scoring)              |
| Health Rules        | `lib/crm/health-rules.ts`          | [Health Rules](#health-rules)         |
| Intent Detection    | `lib/agent/intent-detector.ts`     | [Intent Detection](#intent-detection) |
| CRM Worker (Anne)   | `lib/agent/workers/crm-worker.ts`  | [Anne Integration](#anne-integration) |
| Health Alerts UI    | `components/crm-health-alerts.tsx` | [Health UI](#health-alerts-ui)        |
| Server Actions      | `app/actions/crm-health.ts`        | [Server Actions](#server-actions)     |

## Architettura

```
                    ┌─────────────────────┐
                    │   Anne (Chat UI)    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Intent Detector    │
                    │  (26 CRM keywords)  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │    CRM Worker       │
                    │  (10 read + 3 write)│
                    └──────┬────────┬─────┘
                           │        │
              ┌────────────▼─┐  ┌───▼────────────┐
              │ Data Service │  │ Write Service   │
              │ (10 funzioni)│  │ (3 funzioni)    │
              └──────┬───────┘  └───┬─────────────┘
                     │              │
              ┌──────▼──────────────▼─────┐
              │      Supabase (RLS)       │
              │  leads | reseller_prospects│
              │  lead_events | prospect_events│
              └───────────────────────────┘
```

## Due Livelli CRM

### Livello 1 — Lead (Platform, Admin)

Gestione lead per acquisizione nuovi reseller. Visibili solo a admin e superadmin.

**Tabella:** `leads` (pre-esistente, potenziata con +11 colonne in S1/S2)

| Campo                      | Tipo        | Descrizione                                                       |
| -------------------------- | ----------- | ----------------------------------------------------------------- |
| `lead_score`               | INT (0-100) | Score calcolato dall'applicazione                                 |
| `sector`                   | TEXT (enum) | ecommerce, food, pharma, artigianato, industria, logistica, altro |
| `lead_source`              | TEXT (enum) | direct, website_form, referral, cold_outreach, event, partner     |
| `geographic_zone`          | TEXT (enum) | nord, centro, sud, isole                                          |
| `estimated_monthly_volume` | INT         | Volume spedizioni stimato                                         |
| `tags`                     | TEXT[]      | Tag liberi                                                        |
| `lost_reason`              | TEXT        | Motivo perdita                                                    |
| `workspace_id`             | UUID        | Workspace associato (post-conversione)                            |
| `converted_workspace_id`   | UUID        | Workspace creato dopo conversione                                 |
| `converted_at`             | TIMESTAMPTZ | Data conversione                                                  |
| `last_email_opened_at`     | TIMESTAMPTZ | Ultimo open tracciato                                             |
| `email_open_count`         | INT         | Conteggio aperture email                                          |

**Pipeline:** new -> contacted -> qualified -> negotiating -> converted / lost

### Livello 2 — Prospect (Workspace, Reseller)

Gestione prospect per acquisizione clienti finali. Ogni reseller vede solo i prospect del proprio workspace.

**Tabella:** `reseller_prospects` (creata in S1)

| Campo                      | Tipo        | Descrizione                                        |
| -------------------------- | ----------- | -------------------------------------------------- |
| `workspace_id`             | UUID (FK)   | Workspace del reseller (RLS-scoped)                |
| `company_name`             | TEXT        | Ragione sociale                                    |
| `contact_name`             | TEXT        | Nome referente                                     |
| `email`, `phone`           | TEXT        | Contatti                                           |
| `sector`                   | TEXT (enum) | Settore merceologico                               |
| `estimated_monthly_volume` | INT         | Volume stimato                                     |
| `estimated_monthly_value`  | NUMERIC     | Valore stimato                                     |
| `geographic_corridors`     | TEXT[]      | Corridoi geografici                                |
| `lead_score`               | INT (0-100) | Score calcolato                                    |
| `status`                   | TEXT (enum) | new, contacted, quote_sent, negotiating, won, lost |
| `linked_quote_ids`         | UUID[]      | Preventivi commerciali collegati                   |
| `converted_user_id`        | UUID        | Utente creato dopo conversione                     |

**Pipeline:** new -> contacted -> quote_sent -> negotiating -> won / lost

## Read Functions

**File:** `lib/crm/crm-data-service.ts`

| Funzione                 | Livello  | Descrizione                                  |
| ------------------------ | -------- | -------------------------------------------- |
| `getCrmSummary()`        | Lead     | Conteggi aggregati per status, score medio   |
| `getLeadsByStatus()`     | Lead     | Lista lead filtrati per status               |
| `getRecentLeads()`       | Lead     | Lead creati/aggiornati negli ultimi N giorni |
| `getLeadDetails()`       | Lead     | Scheda completa con timeline eventi          |
| `searchLeads()`          | Lead     | Ricerca fuzzy per nome/email/settore         |
| `getLeadTimeline()`      | Lead     | Cronologia eventi per un lead specifico      |
| `getProspectSummary()`   | Prospect | Conteggi aggregati workspace-scoped          |
| `getProspectsByStatus()` | Prospect | Lista prospect filtrati per status           |
| `getProspectDetails()`   | Prospect | Scheda completa con timeline                 |
| `searchProspects()`      | Prospect | Ricerca fuzzy workspace-scoped               |

## Write Functions

**File:** `lib/crm/crm-write-service.ts`

| Funzione             | Livello | Descrizione                              |
| -------------------- | ------- | ---------------------------------------- |
| `createLead()`       | Lead    | Crea lead con validazione sector/source  |
| `updateLeadStatus()` | Lead    | Cambia status + crea evento timeline     |
| `addLeadNote()`      | Lead    | Aggiunge nota + crea evento `note_added` |

Ogni operazione di scrittura:

1. Valida i dati in ingresso (enum check)
2. Esegue l'operazione atomica
3. Crea un evento nella tabella `lead_events` / `prospect_events`
4. Restituisce il risultato con tipo `ActionResult<T>`

## Lead Scoring

**File:** `lib/crm/lead-scoring.ts`

Score 0-100 calcolato su base di:

- Volume stimato spedizioni mensili (peso alto)
- Settore merceologico (ecommerce > industria > altro)
- Completezza dati (email, telefono, settore compilati)
- Engagement (email aperte, contatti recenti)
- Posizione nella pipeline (qualified > contacted > new)

Lo score viene ricalcolato ad ogni aggiornamento del lead/prospect e salvato nella colonna `lead_score`.

## Health Rules

**File:** `lib/crm/health-rules.ts`

8 regole proattive che identificano lead/prospect che richiedono attenzione:

| Regola                    | Entita'  | Severity | Condizione                                          |
| ------------------------- | -------- | -------- | --------------------------------------------------- |
| `stale_new_prospect`      | Prospect | WARNING  | Status 'new' da 3+ giorni                           |
| `cold_contacted_prospect` | Prospect | WARNING  | Status 'contacted' da 7+ giorni senza contatto      |
| `hot_lead_uncontacted`    | Lead     | CRITICAL | Score >= 80, status 'new' da 2+ giorni              |
| `stale_qualified_lead`    | Lead     | WARNING  | Status 'qualified' da 5+ giorni senza aggiornamenti |
| `stale_negotiating_lead`  | Lead     | WARNING  | Status 'negotiating' da 7+ giorni                   |
| `neglected_quote_sent`    | Lead     | WARNING  | Status 'quote_sent' da 4+ giorni senza contatto     |
| `stale_contacted_lead`    | Lead     | INFO     | Status 'contacted' da 5+ giorni                     |
| `winback_candidate`       | Lead     | INFO     | Status 'lost' da 30-37 giorni (finestra win-back)   |

Le health rules vengono valutate su richiesta (server action o Anne) e mostrate nella UI tramite il tab "Salute".

## Intent Detection

**File:** `lib/agent/intent-detector.ts`

26 keyword per riconoscere intent CRM nei messaggi utente:

- Lead: "lead", "leads", "contatto", "contatti", "prospect", "pipeline"
- Status: "nuovo", "qualificato", "trattativa", "convertito", "perso"
- Azioni: "aggiungi lead", "crea lead", "aggiorna status", "nota"
- Analytics: "riepilogo crm", "salute", "health", "score"
- Ricerca: "cerca lead", "trova prospect", "dettaglio"

L'intent detector opera PRIMA del LLM — se rileva keyword CRM, instrada al CRM Worker senza passare dal modello (bassa latenza).

## Anne Integration

**File:** `lib/agent/workers/crm-worker.ts`

Il CRM Worker gestisce 13 sub-intent:

**Read (10):**

- `crm_summary` — "Come va il CRM?"
- `leads_by_status` — "Quanti lead in trattativa?"
- `recent_leads` — "Novita' ultimi 7 giorni?"
- `lead_details` — "Dimmi tutto su Farmacia Rossi"
- `search_leads` — "Cerca lead ecommerce"
- `lead_timeline` — "Storico Farmacia Rossi"
- `prospect_summary` — "Riepilogo prospect"
- `prospects_by_status` — "Prospect in negoziazione"
- `prospect_details` — "Dettaglio TechShop"
- `search_prospects` — "Cerca prospect pharma"

**Write (3):**

- `create_lead` — "Aggiungi lead TechShop, ecommerce, 200 spedizioni/mese"
- `update_lead_status` — "Sposta Farmacia Rossi in trattativa"
- `add_lead_note` — "Nota: ha chiesto sconto 10%"

## Health Alerts UI

**File:** `components/crm-health-alerts.tsx`

Widget riusabile con:

- **SummaryCard:** conteggio alert per severity (critical/warning/info)
- **AlertCard:** dettaglio per entita' con severity, giorni di stallo, azione suggerita

Integrato come tab "Salute" nelle pagine:

- `app/dashboard/admin/leads/page.tsx` — tab admin con lazy load
- `app/dashboard/prospects/page.tsx` — tab reseller workspace-scoped

## Server Actions

**File:** `app/actions/crm-health.ts`

| Funzione                    | Auth               | Descrizione                          |
| --------------------------- | ------------------ | ------------------------------------ |
| `getCrmHealthAlerts()`      | `requireSafeAuth`  | Admin: health alerts su tutti i lead |
| `getProspectHealthAlerts()` | `getWorkspaceAuth` | Reseller: alerts workspace-scoped    |

## Sicurezza

- **RLS workspace-scoped:** ogni reseller vede SOLO i prospect del proprio workspace
- **Lead solo admin:** la tabella `leads` e' accessibile solo a admin/superadmin
- **Audit trail:** ogni azione crea un evento in `lead_events` / `prospect_events` con `actor_id`
- **CHECK constraints:** sector e lead_source validati a livello DB
- **Score bounds:** CHECK constraint `lead_score >= 0 AND lead_score <= 100`
- **Intent isolation:** Anne non puo' leggere dati cross-workspace

## Database

**Tabelle:**

- `leads` — tabella pre-esistente con +11 colonne (S1/S2)
- `reseller_prospects` — pipeline prospect workspace-scoped (S1)
- `lead_events` — timeline eventi lead (S1)
- `prospect_events` — timeline eventi prospect (S1)

**Migration:**

- `20260208120000_reseller_prospects_crm.sql` — tabelle + RLS + indici prospect
- `20260209100000_leads_crm_upgrade.sql` — +11 colonne leads + lead_events + RLS
- `20260209110000_leads_check_constraints.sql` — CHECK constraints sector/lead_source

## Test

| File                                     | Test | Copertura                            |
| ---------------------------------------- | ---- | ------------------------------------ |
| `tests/unit/crm-data-service.test.ts`    | 42   | Read functions + workspace isolation |
| `tests/unit/crm-write-service.test.ts`   | 24   | Write ops + validation + events      |
| `tests/unit/crm-health-rules.test.ts`    | 28   | 8 health rules + edge cases          |
| `tests/unit/crm-health-ui.test.ts`       | 12   | Server actions + widget rendering    |
| `tests/unit/crm-intent-detector.test.ts` | 22   | Intent detection keywords            |

## Milestones

- **S1:** CRM Foundation — tabelle, read functions, scoring, health rules
- **S2:** CRM Write Intelligence — write functions, Anne integration, intent detection
- **S4b:** CRM Health Alerts UI — widget, server actions, tab "Salute"

Vedi:

- `docs/milestones/MILESTONE-CRM-INTELLIGENCE-S1.md`
- `docs/milestones/MILESTONE-CRM-INTELLIGENCE-S2.md`
- `docs/milestones/MILESTONE-CRM-OUTREACH-UI-S4.md`
