---
title: 'Milestone: Multi-Channel Outreach Sprint S3'
scope: ai, outreach, crm
audience: developers, business
owner: ai-team
status: completed
source_of_truth: true
updated: 2026-02-08
---

# Milestone: Multi-Channel Outreach Sprint S3

**Data completamento:** 2026-02-08
**Commit:** `297e8aa`
**Status:** COMPLETATO

## Obiettivo

Dare ad Anne un motore outreach enterprise-grade: sequenze multi-canale (Email, WhatsApp, Telegram) per lead e prospect, controllabili via chat e configurabili per workspace.

**Principio:** I 3 provider erano gia' funzionanti — serviva l'orchestrazione sopra.

## Architettura

```
Messaggio utente
  |
  supervisorRouter()
  |
  +-- detectOutreachIntent() --> Outreach Worker (diretto, no LangGraph)
  |                                |
  |                                +-- 10 sub-intent:
  |                                |     +-- enroll_entity
  |                                |     +-- cancel_enrollment
  |                                |     +-- pause_enrollment
  |                                |     +-- resume_enrollment
  |                                |     +-- send_message
  |                                |     +-- check_status
  |                                |     +-- manage_channels
  |                                |     +-- list_templates
  |                                |     +-- list_sequences
  |                                |     +-- outreach_metrics
  |                                |
  |                                +-- Servizi usati:
  |                                      +-- enrollment-service.ts
  |                                      +-- outreach-data-service.ts
  |                                      +-- channel-providers.ts
  |                                      +-- consent-service.ts
  |                                      +-- outreach-analytics.ts
  |                                      +-- template-engine.ts
  |
  +-- Cron: /api/cron/outreach-executor (ogni 5 min)
  |     |
  |     +-- processOutreachQueue()
  |           +-- Kill switch check
  |           +-- Workspace feature flag check
  |           +-- 6 safety checks per enrollment:
  |                 1. Condizione step (no_reply, no_open, ecc.)
  |                 2. Consenso GDPR
  |                 3. Canale abilitato
  |                 4. Rate limit giornaliero
  |                 5. Cool-down 24h
  |                 6. Provider configurato
  |
  +-- Webhooks delivery tracking:
        +-- /api/webhooks/resend-events (Svix HMAC)
        +-- /api/webhooks/whatsapp (status events)
```

## Sub-Sprint

| Sub-Sprint | Scope                                                                                                   | Status     |
| ---------- | ------------------------------------------------------------------------------------------------------- | ---------- |
| **S3a**    | Foundation: types, DB 7 tabelle, channel abstraction, template engine, data service                     | Completato |
| **S3b**    | Sequence Engine: enrollment, executor con 6 safety checks, cron                                         | Completato |
| **S3c**    | Anne Integration: intent, worker 10 sub-intent, router, prompts                                         | Completato |
| **S3d**    | Safety & Observability: consent GDPR, delivery tracking, feature flags, kill switch, structured logging | Completato |

## Database

**Migration:** `supabase/migrations/20260210100000_outreach_system.sql`

7 tabelle con RLS, indici, trigger updated_at:

| Tabella                   | Scopo                                             |
| ------------------------- | ------------------------------------------------- |
| `outreach_channel_config` | Configurazione canali per workspace               |
| `outreach_templates`      | Template Handlebars per canale                    |
| `outreach_sequences`      | Definizioni sequenze DAG lineare                  |
| `outreach_sequence_steps` | Step dentro sequenza                              |
| `outreach_enrollments`    | Entita' iscritta a sequenza (idempotency UNIQUE)  |
| `outreach_executions`     | Audit trail invii (denormalizzato per rate limit) |
| `outreach_consent`        | GDPR consent tracking                             |

## File Creati (19)

| File                                                     | Scopo                                           |
| -------------------------------------------------------- | ----------------------------------------------- |
| `types/outreach.ts`                                      | 17 tipi + CHANNEL_CAPABILITIES                  |
| `lib/outreach/channel-providers.ts`                      | Factory 3 provider (Resend, WhatsApp, Telegram) |
| `lib/outreach/template-engine.ts`                        | Handlebars render/validate/extract              |
| `lib/outreach/outreach-data-service.ts`                  | CRUD Supabase (pattern crm-data-service)        |
| `lib/outreach/enrollment-service.ts`                     | Lifecycle enrollment (6 funzioni)               |
| `lib/outreach/sequence-executor.ts`                      | Core engine con 6 safety checks                 |
| `lib/outreach/consent-service.ts`                        | GDPR check/grant/revoke/status                  |
| `lib/outreach/outreach-analytics.ts`                     | Metriche aggregate per workspace                |
| `lib/outreach/delivery-tracker.ts`                       | Update execution da webhook (no regression)     |
| `lib/outreach/outreach-feature-flags.ts`                 | Kill switch + pilot workspace                   |
| `lib/outreach/outreach-logger.ts`                        | Logger JSON strutturato                         |
| `lib/agent/workers/outreach-worker.ts`                   | 10 sub-intent handler                           |
| `app/api/cron/outreach-executor/route.ts`                | Cron job ogni 5 min                             |
| `app/api/webhooks/resend-events/route.ts`                | Webhook Resend (Svix HMAC)                      |
| `supabase/migrations/20260210100000_outreach_system.sql` | 7 tabelle + RLS                                 |
| `tests/unit/outreach-foundation.test.ts`                 | 44 test (S3a)                                   |
| `tests/unit/sequence-executor.test.ts`                   | 33 test (S3b)                                   |
| `tests/unit/outreach-worker.test.ts`                     | 38 test (S3c+S3d)                               |
| `tests/unit/outreach-gaps.test.ts`                       | 35 test (gap fixes)                             |

## File Modificati (10)

| File                                          | Modifica                                    |
| --------------------------------------------- | ------------------------------------------- |
| `lib/agent/intent-detector.ts`                | +detectOutreachIntent (26 keywords)         |
| `lib/agent/orchestrator/supervisor-router.ts` | +outreach routing (dopo CRM, prima pricing) |
| `lib/agent/orchestrator/state.ts`             | +outreach_worker, +outreach_response        |
| `lib/ai/prompts.ts`                           | +sezione outreach (admin + reseller)        |
| `lib/telemetry/logger.ts`                     | +'outreach' in IntentType                   |
| `app/api/webhooks/whatsapp/route.ts`          | +status events delivery tracking            |
| `vercel.json`                                 | +cron outreach-executor \*/5                |
| `.env.example`                                | +env vars outreach                          |
| `package.json`                                | +handlebars                                 |
| `package-lock.json`                           | aggiornato                                  |

## Safety

- **Consent GDPR obbligatorio:** 0 invii senza consenso (check pre-invio)
- **Idempotency:** UNIQUE(sequence_id, entity_type, entity_id) in DB
- **Rate limit:** per workspace per canale per giorno
- **Cool-down 24h:** per entita' per canale
- **Optimistic locking:** updated_at in WHERE su enrollment update
- **Kill switch globale:** OUTREACH_KILL_SWITCH env var (no deploy)
- **Pilot workspace:** OUTREACH_PILOT_WORKSPACES env var
- **Delivery tracking:** Resend webhook (Svix HMAC) + WhatsApp status events
- **Status progression:** sent -> delivered -> opened -> replied (no regression)

## Env Vars

| Variabile                   | Dove               | Scopo                                           |
| --------------------------- | ------------------ | ----------------------------------------------- |
| `RESEND_WEBHOOK_SECRET`     | Vercel             | Svix signing secret per email delivery tracking |
| `OUTREACH_KILL_SWITCH`      | Vercel (emergenza) | Blocca tutti gli invii se "true"                |
| `OUTREACH_PILOT_WORKSPACES` | Vercel (pilot)     | Lista workspace abilitati (comma-separated)     |

## Metriche

| Metrica         | Valore         |
| --------------- | -------------- |
| File nuovi      | 19             |
| File modificati | 10             |
| Tabelle DB      | 7              |
| Test nuovi      | 150            |
| Righe aggiunte  | 6119           |
| Dipendenze npm  | 1 (handlebars) |

## Cosa Cambia Per l'Utente

### Admin

- "Attiva email outreach" -> Anne abilita canale
- "Iscrivi lead nuovi alla sequenza intro" -> auto-enrollment
- "Stato outreach Farmacia Rossi?" -> timeline invii + delivery status
- "Metriche outreach" -> delivery/open/reply rate per canale

### Reseller

- "Manda followup a TechShop" -> invio via template
- "Disabilita WhatsApp, uso solo email" -> toggle canale
- "Quali template ho?" -> lista template disponibili

### Comportamento Intelligente Anne

- Canale non configurato -> suggerisce attivazione
- Consenso mancante -> avvisa, non invia
- Rate limit raggiunto -> spiega, suggerisce domani
- Kill switch attivo -> spiega, permette letture
