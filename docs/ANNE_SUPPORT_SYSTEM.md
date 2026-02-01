# Anne Support System - Architettura

## Overview

Sistema di assistenza clienti AI-native dove Anne (l'assistente AI di SpedireSicuro) gestisce autonomamente il 95-98% delle richieste di supporto. Solo il 2-5% dei casi viene escalato a un operatore umano.

**Principio chiave:** L'utente non "apre un ticket". Chatta con Anne, che risolve il problema in tempo reale.

---

## Architettura

```
Utente chatta con Anne (chat esistente)
        │
  Supervisor Router (esistente)
        │
  detectSupportIntent() ──► support_worker
        │
  Decision Engine (regole per corriere + pattern appresi)
        │
  Support Tools (8 tool, wrappano servizi esistenti)
        │
  Azione eseguita / Conferma richiesta / Escalation
```

### Flusso dettagliato

1. **Intent Detection** (`support-worker.ts`): Regex italiano rileva intent di supporto (tracking, giacenza, cancellazione, rimborso, problemi generici)
2. **Shipment Resolution**: Identifica la spedizione dell'utente (da tracking number nel messaggio o ultima spedizione attiva)
3. **Case Learning** (`case-learning.ts`): Cerca pattern simili già risolti in passato
4. **Decision Engine** (`support-rules.ts`): Applica regole statiche per tipo di problema
5. **Confirmation Flow**: Se l'azione ha un costo o è irreversibile, chiede conferma all'utente
6. **Tool Execution**: Esegue l'azione via support tools
7. **Learning**: Registra l'esito per migliorare nel tempo

---

## File principali

### Core

| File                                  | Descrizione                                     |
| ------------------------------------- | ----------------------------------------------- |
| `lib/agent/workers/support-worker.ts` | Worker principale, orchestrazione del flusso    |
| `lib/ai/support-rules.ts`             | Decision engine con 20+ regole per categoria    |
| `lib/ai/tools/support-tools.ts`       | 8 tool che wrappano servizi esistenti           |
| `lib/ai/case-learning.ts`             | Apprendimento da casi risolti, pattern matching |

### API Routes

| File                                     | Descrizione                          |
| ---------------------------------------- | ------------------------------------ |
| `app/api/support/notifications/route.ts` | GET/PATCH notifiche supporto         |
| `app/api/support/escalations/route.ts`   | GET/PATCH escalation (admin)         |
| `app/api/cron/support-alerts/route.ts`   | Cron ogni 30min: notifiche proattive |

### UI Components

| File                                      | Descrizione                                                    |
| ----------------------------------------- | -------------------------------------------------------------- |
| `components/anne/ActionConfirmCard.tsx`   | Card conferma azione con costo                                 |
| `components/anne/SupportQuickActions.tsx` | Pills rapide ("Traccia spedizione", "Problema giacenza", etc.) |
| `components/anne/NotificationBell.tsx`    | Campanella notifiche nella top bar                             |
| `app/dashboard/supporto/page.tsx`         | Dashboard admin escalation                                     |

### Database

| Migration                                  | Tabelle                                          |
| ------------------------------------------ | ------------------------------------------------ |
| `20260202120000_anne_support_system.sql`   | `support_escalations`, `support_notifications`   |
| `20260202130000_anne_case_patterns.sql`    | `support_case_patterns`, `support_pattern_usage` |
| `20260202140000_fix_case_patterns_rls.sql` | Fix RLS: solo admin leggono patterns             |

---

## Support Tools (8)

| Tool                      | Funzione                       | Wrappa                            |
| ------------------------- | ------------------------------ | --------------------------------- |
| `get_shipment_status`     | Tracking + hold + eventi       | TrackingService                   |
| `manage_hold`             | Lista/esegui azioni giacenza   | GiacenzeService                   |
| `cancel_shipment`         | Cancella + rimborso wallet     | CourierClient + wallet            |
| `process_refund`          | Rimborso wallet                | wallet RPC                        |
| `force_refresh_tracking`  | Forza aggiornamento tracking   | TrackingService                   |
| `check_wallet_status`     | Saldo + transazioni            | users + wallet_transactions       |
| `diagnose_shipment_issue` | Diagnostica problemi creazione | wallet + price_lists              |
| `escalate_to_human`       | Crea escalation + Telegram     | support_escalations + TelegramBot |

---

## Decision Engine

### Categorie di regole

- **Giacenza** (8 regole): destinatario assente, indirizzo errato, rifiutata, contrassegno, zona inaccessibile, documenti mancanti, scadenza, generico
- **Cancellazione** (3 regole): pre-transito, in transito, post-consegna
- **Rimborso** (3 regole): cancellata, smarrita (>14gg), ritardo grave (7-14gg)
- **Tracking** (2 regole): stale >48h, consegnata

### Livelli di conferma

| Livello        | Comportamento                                           |
| -------------- | ------------------------------------------------------- |
| `auto`         | Anne esegue senza chiedere (azioni gratuite e sicure)   |
| `confirm`      | Anne chiede sempre conferma                             |
| `anne_decides` | Anne decide: chiede se costo > 0 o wallet insufficiente |

---

## Case Learning

Anne impara dai casi risolti:

1. **Prima di rispondere**: cerca pattern simili nel DB (`support_case_patterns`)
2. **Se trova match con confidence >= 80% e match score >= 70%**: usa il pattern direttamente
3. **Dopo la risoluzione**: registra l'esito in `support_pattern_usage`
4. **Trigger DB**: aggiorna automaticamente `confidence_score` basandosi su success/failure rate
5. **Nuovi pattern**: creati quando Anne risolve un caso che non matchava nessun pattern

### Sicurezza PII

Le keywords estratte per il pattern matching passano per:

1. `sanitizePII()`: rimuove email, telefoni, CF, P.IVA, tracking numbers, CAP
2. Allowlist di ~80 parole di dominio (solo termini logistici, nessun nome proprio)
3. RLS: solo admin possono leggere `support_case_patterns` (il backend usa `supabaseAdmin`)

---

## Confirmation Flow

Le pending actions sono persistite in DB (serverless-safe, non in-memory):

- Storage: tabella `support_notifications` con `metadata.pending_action = true`
- Scadenza: 10 minuti
- Conferma: l'utente risponde "sì"/"ok"/"confermo" o clicca il bottone
- Cancellazione: "no"/"annulla"/"lascia stare"

---

## Notifiche Proattive

Il cron `support-alerts` (ogni 30 minuti) controlla:

- Nuove giacenze non gestite
- Tracking stale > 48h
- Giacenze in scadenza (< 3 giorni)

Canali attivi: in-app (campanella).
Canali futuri (schema pronto): Telegram, email, WhatsApp.

---

## Admin Dashboard

`/dashboard/supporto` (solo admin/superadmin):

- Lista escalation con filtri per stato
- Dettaglio con conversation snapshot di Anne
- Azioni: prendi in carico, risolvi, chiudi

---

## Test

| File                                | Cosa testa                                                           | # Test |
| ----------------------------------- | -------------------------------------------------------------------- | ------ |
| `tests/unit/case-learning.test.ts`  | `extractKeywords`, sanitizzazione PII, allowlist                     | 15     |
| `tests/unit/support-rules.test.ts`  | Decision engine, `findMatchingRule`, `shouldConfirm`, interpolazione | 30     |
| `tests/unit/support-worker.test.ts` | `detectSupportIntent`, `detectConfirmation`                          | 30     |

```bash
# Esegui tutti i test del supporto
npx vitest run tests/unit/case-learning.test.ts tests/unit/support-rules.test.ts tests/unit/support-worker.test.ts
```
