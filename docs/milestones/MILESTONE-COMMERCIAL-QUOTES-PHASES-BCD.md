# MILESTONE: Preventivatore Commerciale — Fasi B + C + D

**Data:** 2026-02-07
**Priorita':** HIGH
**Stima:** 6-8 ore
**Rischio:** BASSO
**Status:** COMPLETATO

---

## Obiettivo

Portare il Preventivatore Commerciale da "tool funzionale" a "sistema intelligente" con:

- **Fase B**: Analytics dashboard con KPI, funnel, margini, performance
- **Fase C**: Auto-scadenza cron, email PDF al prospect, reminder pre-scadenza
- **Fase D**: Timeline negoziazione, cambio stato con note, rinnovo scaduti, email benvenuto

## Risultato Finale

```
PRIMA (MVP + Fase A):
├── Pipeline funzionale con PDF e conversione
├── 125 test
└── Nessun analytics, email, automazione, negoziazione avanzata

DOPO (+ Fasi B, C, D):
├── Dashboard analytics (6 grafici + 4 KPI cards)
├── Cron auto-scadenza ogni 4h + reminder 5gg
├── 3 template email (prospect, reminder, benvenuto)
├── Timeline negoziazione con eventi colorati
├── Dialog cambio stato con note obbligatorie/opzionali
├── Rinnovo preventivi scaduti
├── 224 test (+99 nuovi)
└── +3374 righe, 19 file modificati/creati
```

---

## Fasi

### Fase B: Analytics Dashboard + Self-Learning

**Task 1: Database**

- [x] Migration indici analytics: composito (workspace, status, carrier, sector), timeline (created_at DESC), expires_at fix (copre 'negotiating')

**Task 2: Tipi Analytics**

- [x] `QuoteAnalyticsKPI` — conversion_rate, avg_margin, days_to_close, revenue
- [x] `QuoteConversionFunnel` — conteggi step + drop-off %
- [x] `QuoteMarginAnalysis` — original vs final, accettati vs rifiutati
- [x] `QuoteCarrierPerformance` — per corriere: totale, accettati, acceptance_rate
- [x] `QuoteSectorPerformance` — per settore con etichette italiane
- [x] `QuoteTimelinePoint` — bucketing settimanale ISO

**Task 3: Engine Analytics**

- [x] `computeAnalytics()` — funzione pura, zero dipendenze esterne
- [x] `filterLatestRevisions()` — deduplica revisioni (solo ultima per root)
- [x] Calcolo KPI, funnel, margini, carrier perf, sector perf, timeline

**Task 4: Dashboard UI**

- [x] 4 KPI stat cards (tasso conversione, margine medio, giorni chiusura, valore convertito)
- [x] 6 grafici Recharts (funnel, margini, corriere, settore, timeline)
- [x] SSR-safe con `isMounted` guard
- [x] Loading skeleton, error state

**Task 5: Integrazione**

- [x] `getQuoteAnalyticsAction()` — workspace-scoped
- [x] Tab "Analisi" nella pagina preventivatore (3o tab con icona BarChart3)

**Task 6: Test Fase B (26 test)**

- [x] KPI: conversion rate, avg margin, days to close
- [x] Funnel: conteggi e drop-off
- [x] Margin analysis: delta originale vs finale
- [x] Performance corriere e settore
- [x] Timeline: bucketing settimanale ISO
- [x] Edge case: array vuoto, tutti draft, singolo preventivo

### Fase C: Auto-Expiry + Email Sistema

**Task 7: Audit + Tipi**

- [x] `COMMERCIAL_QUOTE_EXPIRED` in audit-actions.ts
- [x] `'reminder_sent'` in CommercialQuoteEventType

**Task 8: Template Email**

- [x] `sendQuoteToProspectEmail()` — PDF allegato, branding reseller, validita'
- [x] `sendQuoteExpiryReminderEmail()` — stile amber warning, data scadenza italiana
- [x] Supporto attachment in `sendEmail()` (interfaccia `EmailAttachment`)

**Task 9: Cron Auto-Scadenza**

- [x] `POST /api/cron/expire-quotes` con auth header
- [x] Step 1: auto-expire sent/negotiating passati expires_at
- [x] Step 2: reminder 5gg prima scadenza (deduplicato via evento)
- [x] System actor per audit log (`user_email: 'system@cron'`)
- [x] Schedule: `0 */4 * * *` in vercel.json

**Task 10: Email su Invio**

- [x] `sendCommercialQuoteAction` invia email prospect dopo PDF upload
- [x] Non-bloccante: try/catch, log errore silenzioso
- [x] Usa `workspace.organization_name` per branding

**Task 11: Badge Scadenza Pipeline**

- [x] `getDaysLeft()` helper
- [x] Badge amber "Scade tra Xg" (<=7 giorni)
- [x] Badge rosso "Scaduto" (<=0 giorni)

**Task 12: Test Fase C (40 test)**

- [x] Expiry: 24 test (shouldExpire, shouldSendReminder, getDaysLeft, immutabilita')
- [x] Email: 16 test (prospect email, reminder, attachment, edge case)

### Fase D: Negoziazione Avanzata

**Task 13: Tipi Negoziazione**

- [x] `NegotiationTimelineEntry` — id, event_type, label, data, actor, notes
- [x] `RenewExpiredQuoteInput` — expired_quote_id, validity_days, margin_percent
- [x] `'renewed'` in CommercialQuoteEventType

**Task 14: Server Actions**

- [x] `getQuoteNegotiationTimelineAction()` — root chain, batch actor names, EVENT_LABELS
- [x] `renewExpiredQuoteAction()` — valida expired, crea draft, ricalcolo opzionale matrice
- [x] Email benvenuto in `convertQuoteToClientAction` (non-bloccante)

**Task 15: Componenti UI**

- [x] `NegotiationTimeline` — timeline verticale con dot colorati, icone per tipo, note callout
- [x] `StatusChangeDialog` — dialog cambio stato con note obbligatorie/opzionali
- [x] `QuoteDetailDialog` aggiornato: timeline negoziazione, email indicator, bottone rinnova
- [x] `QuotePipeline` aggiornato: StatusChangeDialog, "In trattativa", "Rinnova"
- [x] Pagina principale: handler `handleRenewQuote`, passaggio callback

**Task 16: Test Fase D (33 test)**

- [x] Negotiation: 21 test (event labels, timeline sort, rinnovo, preservazione dati, note)
- [x] Welcome email: 12 test (parametri, fallback branding, contenuto HTML)

---

## Files Modificati

| File                                                    | Azione     | Note                                 |
| ------------------------------------------------------- | ---------- | ------------------------------------ |
| `lib/commercial-quotes/analytics.ts`                    | Nuovo      | Engine analytics puro, 330 righe     |
| `components/commercial-quotes/quote-analytics.tsx`      | Nuovo      | Dashboard 6 grafici, 458 righe       |
| `components/commercial-quotes/negotiation-timeline.tsx` | Nuovo      | Timeline eventi verticale            |
| `components/commercial-quotes/status-change-dialog.tsx` | Nuovo      | Dialog cambio stato                  |
| `app/api/cron/expire-quotes/route.ts`                   | Nuovo      | Cron auto-scadenza                   |
| `supabase/migrations/20260208*.sql`                     | Nuovo      | Indici analytics                     |
| `actions/commercial-quotes.ts`                          | Modificato | +313 righe (3 action + email)        |
| `types/commercial-quotes.ts`                            | Modificato | +112 righe (analytics + negotiation) |
| `lib/email/resend.ts`                                   | Modificato | +135 righe (2 template + attachment) |
| `lib/security/audit-actions.ts`                         | Modificato | +1 costante                          |
| `components/commercial-quotes/quote-detail-dialog.tsx`  | Modificato | Timeline, email indicator, rinnova   |
| `components/commercial-quotes/quote-pipeline.tsx`       | Modificato | StatusChangeDialog, badge scadenza   |
| `app/dashboard/reseller/preventivo/page.tsx`            | Modificato | Tab analisi, handler rinnovo         |
| `vercel.json`                                           | Modificato | Cron schedule                        |
| `tests/unit/commercial-quote-analytics.test.ts`         | Nuovo      | 26 test                              |
| `tests/unit/commercial-quote-expiry.test.ts`            | Nuovo      | 24 test                              |
| `tests/unit/commercial-quote-email.test.ts`             | Nuovo      | 16 test                              |
| `tests/unit/commercial-quote-negotiation.test.ts`       | Nuovo      | 21 test                              |
| `tests/unit/commercial-quote-welcome-email.test.ts`     | Nuovo      | 12 test                              |

## Checklist Pre-Deploy

- [x] 224 test unitari verdi (tutti i commercial-quote test)
- [x] `npm run build` zero errori
- [x] Pre-commit hook (prettier + eslint) passato
- [x] Review sicurezza: workspace isolation, non-blocking email, cron auth
- [x] Deploy Vercel verificato in produzione

---

## Completato il 2026-02-07
