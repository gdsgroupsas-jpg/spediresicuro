---
title: 'Milestone: CRM Health Alerts + Outreach Dashboard Sprint S4'
scope: ui, crm, outreach
audience: developers, business
owner: ai-team
status: completed
source_of_truth: true
updated: 2026-02-08
---

# Milestone: CRM Health Alerts + Outreach Dashboard Sprint S4

**Data completamento:** 2026-02-08
**Commit:** `63bdc69`
**Status:** COMPLETATO (S4b + S4c — S4a/S4d sono operativi, non codice)

## Obiettivo

Portare CRM e Outreach da "backend testato" a "UI visibile e usabile": health alerts nelle pagine leads/prospects, dashboard outreach dedicata admin+reseller, navigazione aggiornata.

**Scoperta critica in fase di pianificazione:** Le pagine CRM (admin leads 1077 righe, reseller prospects 666 righe) esistevano gia' con pipeline, filtri, modali e analytics. S4 ha aggiunto solo le parti mancanti.

## Sub-Sprint

| Sub-Sprint | Scope                                                                          | Status                |
| ---------- | ------------------------------------------------------------------------------ | --------------------- |
| **S4a**    | Go-Live Infrastructure: migration DB, webhook config, pilot workspace          | Manuale (non codice)  |
| **S4b**    | CRM Health Alerts: widget salute in leads + prospects pages                    | Completato            |
| **S4c**    | Outreach Dashboard: pagine admin + reseller con metriche, enrollment, sequenze | Completato            |
| **S4d**    | Pilot Loop: test con utente reale, feedback, iterazioni                        | Processo (non codice) |

## Architettura S4b — CRM Health Alerts

```
lib/crm/health-rules.ts (GIA' ESISTENTE: 8 regole)
  |
  v
app/actions/crm-health.ts (NUOVO: server actions)
  |-- getCrmHealthAlerts() [admin, tutti i lead]
  |-- getProspectHealthAlerts() [reseller, workspace-scoped]
  |
  v
components/crm-health-alerts.tsx (NUOVO: widget riusabile)
  |-- SummaryCard (critical/warning/info)
  |-- AlertCard (per-entity con severity, giorni, azione)
  |
  v
app/dashboard/admin/leads/page.tsx [MODIFICA: +tab "Salute"]
app/dashboard/prospects/page.tsx [MODIFICA: +tab "Salute"]
```

## Architettura S4c — Outreach Dashboard

```
lib/outreach/outreach-analytics.ts (GIA' ESISTENTE)
lib/outreach/outreach-data-service.ts (GIA' ESISTENTE)
  |
  v
app/actions/outreach.ts (NUOVO: 6 server actions)
  |-- getOutreachOverviewAdmin/Reseller
  |-- getEnrollmentsAdmin/Reseller
  |-- getSequencesAdmin/Reseller
  |-- buildMetricsFromRows() [helper interno]
  |
  v
app/dashboard/admin/outreach/page.tsx (NUOVO: admin view)
app/dashboard/outreach/page.tsx (NUOVO: reseller view)
  |-- Tab Panoramica: 6 KPI + tabella canali
  |-- Tab Enrollment: tabella con filtro status
  |-- Tab Sequenze: lista con stato attivo/disattivo
  |
  v
lib/config/navigationConfig.ts [MODIFICA: +voci Outreach admin+reseller]
```

## File Creati (7)

| File                                    | Scopo                                           |
| --------------------------------------- | ----------------------------------------------- |
| `app/actions/crm-health.ts`             | Server actions health alerts (admin + reseller) |
| `components/crm-health-alerts.tsx`      | Widget riusabile con SummaryCard + AlertCard    |
| `app/actions/outreach.ts`               | 6 server actions + buildMetricsFromRows         |
| `app/dashboard/admin/outreach/page.tsx` | Dashboard outreach admin (3 tab)                |
| `app/dashboard/outreach/page.tsx`       | Dashboard outreach reseller (3 tab)             |
| `tests/unit/crm-health-ui.test.ts`      | 12 test health alerts                           |
| `tests/unit/outreach-ui.test.ts`        | 10 test outreach dashboard                      |

## File Modificati (4)

| File                                  | Modifica                                                                |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `app/dashboard/admin/leads/page.tsx`  | +tab "Salute" con lazy load health alerts + badge critical              |
| `app/dashboard/prospects/page.tsx`    | +tab "Salute" con lazy load prospect health alerts                      |
| `lib/config/navigationConfig.ts`      | +admin-outreach in admin-system, +reseller-outreach in reseller section |
| `tests/unit/navigationConfig.test.ts` | Aggiornati conteggi item (4->5 admin-system, 7->8 reseller)             |

## Health Alert Rules (8, da lib/crm/health-rules.ts)

| Regola                  | Tipo Entita' | Severity | Condizione                                          |
| ----------------------- | ------------ | -------- | --------------------------------------------------- |
| stale_new_prospect      | prospect     | warning  | Status 'new' da 3+ giorni                           |
| cold_contacted_prospect | prospect     | warning  | Status 'contacted' da 7+ giorni senza contatto      |
| hot_lead_uncontacted    | lead         | critical | Score >= 80, status 'new' da 2+ giorni              |
| stale_qualified_lead    | lead         | warning  | Status 'qualified' da 5+ giorni senza aggiornamenti |
| stale_negotiating_lead  | lead         | warning  | Status 'negotiating' da 7+ giorni                   |
| neglected_quote_sent    | lead         | warning  | Status 'quote_sent' da 4+ giorni senza contatto     |
| stale_contacted_lead    | lead         | info     | Status 'contacted' da 5+ giorni                     |
| winback_candidate       | lead         | info     | Status 'lost' da 30-37 giorni (finestra win-back)   |

## Metriche

| Metrica                      | Valore  |
| ---------------------------- | ------- |
| File nuovi                   | 7       |
| File modificati              | 4       |
| Test nuovi                   | 22      |
| Righe aggiunte               | 2248    |
| Build size admin/outreach    | 4.57 kB |
| Build size reseller/outreach | 4.43 kB |

## Cosa Cambia Per l'Utente

### Admin

- Tab "Salute" nella pagina Lead con badge rosso per alert critici
- Dashboard `/dashboard/admin/outreach` con:
  - 6 KPI cards (invii, delivery rate, open rate, reply rate, enrollment attivi, falliti)
  - Breakdown per canale (email, WhatsApp, Telegram)
  - Lista enrollment con filtro status
  - Lista sequenze con stato attivo/disattivo
- Voce "Outreach" nel menu admin sotto "Sistema"

### Reseller

- Tab "Salute" nella pagina Prospect (workspace-scoped)
- Dashboard `/dashboard/outreach` identica all'admin ma filtrata per workspace
- Voce "Outreach" nel menu reseller sotto "Gestione Business"

## Pending (Non Codice)

- **S4a:** Applicare 10 migration SQL su Supabase (vedi guida separata)
- **S4a:** Configurare webhook Resend + WhatsApp
- **S4a:** Settare OUTREACH_PILOT_WORKSPACES env var
- **S4d:** Test con workspace pilota, raccogliere feedback UX
