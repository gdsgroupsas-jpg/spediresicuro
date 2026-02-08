# Outreach Multi-Canale - SpedireSicuro

## Overview

Il sistema Outreach Multi-Canale consente l'invio automatico di sequenze di messaggi via Email, WhatsApp e Telegram a lead e prospect. Opera con un engine a cron (ogni 5 minuti) che esegue step di sequenze rispettando 6 safety check per ogni invio: condizione step, consenso GDPR, canale abilitato, rate limit, cool-down, provider configurato. Include template Handlebars, delivery tracking via webhook, e integrazione nativa con Anne (10 sub-intent).

## Target Audience

- [x] Developers
- [x] DevOps
- [x] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- Comprensione del CRM Intelligence (`CRM_INTELLIGENCE.md`)
- Familiarita' con workspace hierarchy (`RESELLER_HIERARCHY.md`)
- Conoscenza base di Resend (email), WhatsApp Business API, Telegram Bot API

## Quick Reference

| Sezione            | File Principale                           | Link                                  |
| ------------------ | ----------------------------------------- | ------------------------------------- |
| Types              | `types/outreach.ts`                       | [Tipi](#tipi)                         |
| Channel Providers  | `lib/outreach/channel-providers.ts`       | [Canali](#channel-providers)          |
| Template Engine    | `lib/outreach/template-engine.ts`         | [Template](#template-engine)          |
| Data Service       | `lib/outreach/outreach-data-service.ts`   | [CRUD](#data-service)                 |
| Enrollment Service | `lib/outreach/enrollment-service.ts`      | [Enrollment](#enrollment-service)     |
| Sequence Executor  | `lib/outreach/sequence-executor.ts`       | [Executor](#sequence-executor)        |
| Consent Service    | `lib/outreach/consent-service.ts`         | [GDPR](#consent-service-gdpr)         |
| Analytics          | `lib/outreach/outreach-analytics.ts`      | [Metriche](#analytics)                |
| Delivery Tracker   | `lib/outreach/delivery-tracker.ts`        | [Tracking](#delivery-tracking)        |
| Feature Flags      | `lib/outreach/outreach-feature-flags.ts`  | [Flags](#feature-flags)               |
| Anne Worker        | `lib/agent/workers/outreach-worker.ts`    | [Anne Integration](#anne-integration) |
| Cron Job           | `app/api/cron/outreach-executor/route.ts` | [Cron](#cron-job)                     |
| Resend Webhook     | `app/api/webhooks/resend-events/route.ts` | [Webhook](#webhook-delivery-tracking) |
| Dashboard Admin    | `app/dashboard/admin/outreach/page.tsx`   | [UI Admin](#outreach-dashboard)       |
| Dashboard Reseller | `app/dashboard/outreach/page.tsx`         | [UI Reseller](#outreach-dashboard)    |

## Architettura

```
Messaggio utente
  │
  supervisorRouter()
  │
  ├── detectOutreachIntent() ──▶ Outreach Worker (10 sub-intent)
  │                                │
  │                                ├── enrollment-service.ts
  │                                ├── outreach-data-service.ts
  │                                ├── channel-providers.ts
  │                                ├── consent-service.ts
  │                                ├── outreach-analytics.ts
  │                                └── template-engine.ts
  │
  └── Cron: /api/cron/outreach-executor (ogni 5 min)
        │
        └── processOutreachQueue()
              ├── Kill switch check
              ├── Workspace feature flag check
              └── 6 safety checks per enrollment:
                    1. Condizione step (no_reply, no_open, ecc.)
                    2. Consenso GDPR
                    3. Canale abilitato
                    4. Rate limit giornaliero
                    5. Cool-down 24h
                    6. Provider configurato

Webhooks (delivery tracking):
  ├── /api/webhooks/resend-events (Svix HMAC)
  └── /api/webhooks/whatsapp (status events)
```

## Database (7 Tabelle)

**Migration:** `supabase/migrations/20260210100000_outreach_system.sql`

| Tabella                   | Scopo                                             |
| ------------------------- | ------------------------------------------------- |
| `outreach_channel_config` | Configurazione canali per workspace               |
| `outreach_templates`      | Template Handlebars per canale                    |
| `outreach_sequences`      | Definizioni sequenze (DAG lineare)                |
| `outreach_sequence_steps` | Step dentro sequenza (ordine, canale, condizione) |
| `outreach_enrollments`    | Entita' iscritta a sequenza (con idempotency)     |
| `outreach_executions`     | Audit trail invii (denormalizzato per rate limit) |
| `outreach_consent`        | GDPR consent tracking                             |

Tutte le tabelle hanno:

- RLS workspace-scoped (reseller vede solo i propri dati)
- Trigger `updated_at` automatico
- Indici ottimizzati per le query del cron

## Channel Providers

**File:** `lib/outreach/channel-providers.ts`

Factory pattern per 3 provider:

| Canale   | Provider     | Capabilities                      |
| -------- | ------------ | --------------------------------- |
| Email    | Resend       | Send, open tracking, reply detect |
| WhatsApp | WhatsApp API | Send, delivery status             |
| Telegram | Telegram Bot | Send, delivery status             |

Ogni provider implementa l'interfaccia `ChannelProvider`:

- `send(recipient, subject, body)` → `{ messageId, status }`
- Gestione errori con retry policy configurabile per workspace

## Template Engine

**File:** `lib/outreach/template-engine.ts`

Usa Handlebars per rendering template con variabili entita':

```handlebars
Gentile
{{contact_name}}, La contatto per conto di
{{workspace_name}}
riguardo le spedizioni per
{{company_name}}. Con un volume di
{{estimated_volume}}
spedizioni/mese, possiamo offrirle condizioni vantaggiose.
```

Funzioni:

- `renderTemplate(template, context)` — rendering con variabili
- `validateTemplate(body)` — verifica sintassi Handlebars
- `extractVariables(body)` — lista variabili usate nel template

Categorie template: `intro`, `followup`, `quote_reminder`, `winback`, `general`

## Data Service

**File:** `lib/outreach/outreach-data-service.ts`

CRUD Supabase per tutte le tabelle outreach:

- `getChannelConfig(workspaceId)` — configurazione canali
- `getTemplates(workspaceId, channel?, category?)` — lista template
- `getSequences(workspaceId)` — lista sequenze
- `getSequenceSteps(sequenceId)` — step di una sequenza
- `getEnrollments(workspaceId, filters?)` — enrollment con filtri

Pattern identico a `crm-data-service.ts`: query Supabase con `supabaseAdmin`, nessun accesso diretto al client-side.

## Enrollment Service

**File:** `lib/outreach/enrollment-service.ts`

Lifecycle completo dell'enrollment:

| Funzione               | Descrizione                                   |
| ---------------------- | --------------------------------------------- |
| `enrollEntity()`       | Iscrivi lead/prospect a sequenza (idempotent) |
| `cancelEnrollment()`   | Cancella con motivo                           |
| `pauseEnrollment()`    | Metti in pausa                                |
| `resumeEnrollment()`   | Riprendi da dove era rimasto                  |
| `completeEnrollment()` | Segna come completato                         |
| `advanceStep()`        | Avanza allo step successivo                   |

**Idempotency:** UNIQUE constraint su `(sequence_id, entity_type, entity_id)` — impossibile iscrivere la stessa entita' due volte alla stessa sequenza.

**Optimistic locking:** `updated_at` in WHERE clause su ogni UPDATE per evitare race condition.

## Sequence Executor

**File:** `lib/outreach/sequence-executor.ts`

Core engine che processa la coda outreach. Chiamato dal cron ogni 5 minuti.

### 6 Safety Checks (per ogni enrollment)

```
Per ogni enrollment attivo con next_execution_at <= NOW():

1. CONDIZIONE STEP
   └── Verifica: no_reply, no_open, always, replied, opened
   └── Se condizione non soddisfatta: skip step, avanza

2. CONSENSO GDPR
   └── Query: outreach_consent WHERE entity + channel + consented = true
   └── Se mancante: skip, log warning, NON inviare

3. CANALE ABILITATO
   └── Query: outreach_channel_config WHERE workspace + channel + enabled
   └── Se disabilitato: skip

4. RATE LIMIT GIORNALIERO
   └── Query: COUNT executions WHERE workspace + channel + today
   └── Se superato: skip, retry domani

5. COOL-DOWN 24H
   └── Query: MAX(sent_at) WHERE entity + channel
   └── Se < 24h: skip, retry dopo cool-down

6. PROVIDER CONFIGURATO
   └── Verifica: API key/config presente per il canale
   └── Se mancante: skip, log error
```

Se tutti i check passano → invio tramite channel provider → creazione riga in `outreach_executions`.

## Consent Service (GDPR)

**File:** `lib/outreach/consent-service.ts`

| Funzione             | Descrizione                                    |
| -------------------- | ---------------------------------------------- |
| `checkConsent()`     | Verifica consenso per entita' + canale         |
| `grantConsent()`     | Registra consenso con legal basis e source     |
| `revokeConsent()`    | Revoca consenso (soft delete con `revoked_at`) |
| `getConsentStatus()` | Status completo per entita'                    |

**Legal basis GDPR:** `consent`, `legitimate_interest`, `contract`, `legal_obligation`
**Source tracking:** `manual`, `form`, `api`, `import`
**Provenance:** campo libero per dettaglio raccolta (es. "Form sito web 2026-02-01")

**Principio:** 0 invii senza consenso esplicito. Il check e' pre-invio, non post-invio.

## Analytics

**File:** `lib/outreach/outreach-analytics.ts`

Metriche aggregate per workspace:

| Metrica          | Descrizione                        |
| ---------------- | ---------------------------------- |
| `totalSent`      | Totale messaggi inviati            |
| `totalDelivered` | Totale consegnati                  |
| `totalOpened`    | Totale aperti                      |
| `totalReplied`   | Totale con risposta                |
| `totalFailed`    | Totale falliti                     |
| `deliveryRate`   | delivered / sent                   |
| `openRate`       | opened / sent                      |
| `replyRate`      | replied / sent                     |
| `byChannel`      | Breakdown per canale (email/wa/tg) |

## Delivery Tracking

**File:** `lib/outreach/delivery-tracker.ts`

Aggiorna lo status delle esecuzioni in base ai webhook:

**Status progression monotona:** `sent → delivered → opened → replied`

Non e' possibile regredire: se un messaggio e' `opened`, non puo' tornare a `delivered`. Questo previene inconsistenze da webhook out-of-order.

### Webhook Resend (Email)

**File:** `app/api/webhooks/resend-events/route.ts`

- Verifica Svix HMAC signature
- Gestisce eventi: `email.delivered`, `email.opened`, `email.bounced`, `email.complained`
- Lookup via `provider_message_id` → update `outreach_executions`

### Webhook WhatsApp

**File:** `app/api/webhooks/whatsapp/route.ts`

- Status events: `sent`, `delivered`, `read`, `failed`
- Lookup via `provider_message_id`

## Feature Flags

**File:** `lib/outreach/outreach-feature-flags.ts`

| Flag             | Env Var                     | Descrizione                     |
| ---------------- | --------------------------- | ------------------------------- |
| Kill Switch      | `OUTREACH_KILL_SWITCH`      | "true" = blocca TUTTI gli invii |
| Pilot Workspaces | `OUTREACH_PILOT_WORKSPACES` | Lista workspace abilitati (CSV) |

- **Kill switch:** controllo di emergenza, un singolo env var ferma tutto senza deploy
- **Pilot:** solo workspace esplicitamente autorizzati possono usare outreach
- Se nessun pilot workspace e' configurato, outreach e' disabilitato per tutti

## Anne Integration

**File:** `lib/agent/workers/outreach-worker.ts`

10 sub-intent gestiti:

| Sub-Intent          | Esempio utente                           |
| ------------------- | ---------------------------------------- |
| `enroll_entity`     | "Iscrivi lead nuovi alla sequenza intro" |
| `cancel_enrollment` | "Cancella outreach per Farmacia Rossi"   |
| `pause_enrollment`  | "Pausa outreach per TechShop"            |
| `resume_enrollment` | "Riprendi outreach per TechShop"         |
| `send_message`      | "Manda followup a TechShop"              |
| `check_status`      | "Stato outreach Farmacia Rossi?"         |
| `manage_channels`   | "Disabilita WhatsApp, uso solo email"    |
| `list_templates`    | "Quali template ho?"                     |
| `list_sequences`    | "Mostra sequenze attive"                 |
| `outreach_metrics`  | "Metriche outreach"                      |

**Comportamento intelligente:**

- Canale non configurato → suggerisce attivazione
- Consenso mancante → avvisa, non invia
- Rate limit raggiunto → spiega, suggerisce domani
- Kill switch attivo → spiega, permette solo letture

## Cron Job

**File:** `app/api/cron/outreach-executor/route.ts`

- Esecuzione: ogni 5 minuti (configurato in `vercel.json`)
- Processo: `processOutreachQueue()`
- Protezioni: kill switch → pilot workspace check → enrollment loop con 6 safety checks
- Batch: processa tutti gli enrollment con `next_execution_at <= NOW()` e `status = 'active'`

## Outreach Dashboard

### Admin (`/dashboard/admin/outreach`)

3 tab:

- **Panoramica:** 6 KPI cards (invii, delivery rate, open rate, reply rate, enrollment attivi, falliti) + breakdown per canale
- **Enrollment:** tabella con filtro status
- **Sequenze:** lista con stato attivo/disattivo

### Reseller (`/dashboard/outreach`)

Stessa struttura dell'admin ma filtrata per workspace.

**Server Actions:** `app/actions/outreach.ts` con 6 funzioni (admin + reseller variants).

## Sicurezza

| Misura                   | Descrizione                                           |
| ------------------------ | ----------------------------------------------------- |
| **GDPR by design**       | Tabella `outreach_consent` con legal basis e source   |
| **Idempotency**          | UNIQUE(sequence_id, entity_type, entity_id)           |
| **Optimistic locking**   | `updated_at` in WHERE su enrollment update            |
| **Rate limit**           | Per workspace, per canale, per giorno                 |
| **Cool-down 24h**        | Per entita', per canale                               |
| **Kill switch**          | Env var, no deploy richiesto                          |
| **Pilot workspace**      | Solo workspace autorizzati                            |
| **Svix HMAC**            | Verifica firma webhook Resend                         |
| **Status monotono**      | No regression: sent→delivered→opened→replied          |
| **RLS workspace-scoped** | Ogni reseller vede solo i propri dati                 |
| **Consent superadmin**   | Tabella consent accessibile solo a superadmin via RLS |

## Env Vars

| Variabile                   | Dove               | Scopo                                           |
| --------------------------- | ------------------ | ----------------------------------------------- |
| `RESEND_WEBHOOK_SECRET`     | Vercel             | Svix signing secret per email delivery tracking |
| `OUTREACH_KILL_SWITCH`      | Vercel (emergenza) | Blocca tutti gli invii se "true"                |
| `OUTREACH_PILOT_WORKSPACES` | Vercel (pilot)     | Lista workspace abilitati (comma-separated)     |

## Test

| File                                     | Test | Copertura                                    |
| ---------------------------------------- | ---- | -------------------------------------------- |
| `tests/unit/outreach-foundation.test.ts` | 44   | Types, channel providers, template engine    |
| `tests/unit/sequence-executor.test.ts`   | 33   | Executor + 6 safety checks                   |
| `tests/unit/outreach-worker.test.ts`     | 38   | Anne integration + 10 sub-intent             |
| `tests/unit/outreach-gaps.test.ts`       | 35   | Gap fixes (idempotency, rate limit, consent) |
| `tests/unit/outreach-ui.test.ts`         | 10   | Server actions dashboard                     |

## Milestones

- **S3a:** Foundation — types, DB 7 tabelle, channel providers, template engine
- **S3b:** Sequence Engine — enrollment, executor con 6 safety checks, cron
- **S3c:** Anne Integration — intent, worker 10 sub-intent, router
- **S3d:** Safety & Observability — consent GDPR, delivery tracking, feature flags
- **S4c:** Outreach Dashboard — pagine admin + reseller con metriche

Vedi:

- `docs/milestones/MILESTONE-OUTREACH-S3.md`
- `docs/milestones/MILESTONE-CRM-OUTREACH-UI-S4.md`
