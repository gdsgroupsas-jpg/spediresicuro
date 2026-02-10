---
title: UX Audit - Sprint Plan & Changelog
scope: feature
audience: engineering, product
owner: engineering
status: active
source_of_truth: true
created: 2026-02-10
updated: 2026-02-10
---

# UX Audit - Sprint Plan & Changelog

## Obiettivo

Portare la UX di SpedireSicuro da "funziona" a "professionale" attraverso sprint incrementali.
Ogni sprint ha un tema e risolve problemi specifici emersi dall'audit UX.

---

## Sprint 1 — "Smetti di perdere soldi"

**Commit:** `e9b7464`
**Tema:** Proteggere dati utente, eliminare dead-end, ridurre fetch ridondanti

### Modifiche

| Task                   | Descrizione                                                            | File principali                                                |
| ---------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| COD max 5.000 EUR      | Validazione Zod server-side `.max(5000)` + UI hint                     | `lib/validations/shipment.ts`, `ServicesStep.tsx`              |
| beforeunload guard     | Hook `useUnsavedChanges` per form non salvati                          | `hooks/useUnsavedChanges.ts` (nuovo), `ShipmentWizard.tsx`     |
| Dead nav links         | Rimossi cost-adjustment e cash-statements dalla nav                    | `lib/config/navigationConfig.ts`                               |
| UserContext            | Context condiviso per ruolo/dati utente (elimina ~19 fetch ridondanti) | `contexts/UserContext.tsx` (nuovo), `components/providers.tsx` |
| Dashboard optimization | Eliminati 2 useEffect con fetch ridondanti, usa UserContext            | `app/dashboard/page.tsx`                                       |

### Test

- Tutti i 2596 unit test verdi
- Build clean (0 errori)

---

## Sprint 2 — "Sembrare professionisti"

**Commit:** `e44d570`
**Tema:** Loading states professionali, conferme distruttive, a11y modale, bundle optimization

### Modifiche

| Task              | Descrizione                                                             | File principali                                                              |
| ----------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Skeleton loading  | Spinner → skeleton strutturato (stat cards + chart + activity)          | `app/dashboard/page.tsx`, `spedizioni/page.tsx`, `cancellate/page.tsx`       |
| EmptyState        | Testo vuoto → EmptyState con icona + CTA                                | `app/dashboard/page.tsx`                                                     |
| Confirm dialog    | `window.confirm` → ConfirmActionDialog (variante destructive)           | `admin/leads/page.tsx`, `admin/bonifici/page.tsx`                            |
| Lazy Recharts     | Import statico → `next/dynamic` (~120KB risparmiati da bundle iniziale) | `admin/leads/page.tsx`, `prospects/page.tsx`, `reseller/preventivo/page.tsx` |
| Focus trap modale | Tab/Shift+Tab trap, Escape, auto-focus, focus restoration               | `components/ui/dialog.tsx`, `components/shared/confirm-action-dialog.tsx`    |

### Dettagli tecnici

**Skeleton loading:** Usa `animate-pulse` con layout che rispecchia la struttura reale (4 stat cards, chart a barre, status list, activity rows). Componenti riusabili: `StatsCardsSkeleton`, `DataTableSkeleton`.

**Confirm dialog:** Sostituisce `window.confirm()` nativo con `ConfirmActionDialog` che supporta: variante `destructive` (rosso), `isLoading` per operazioni async, testo personalizzato.

**Lazy Recharts:** Pattern `next/dynamic` con `ssr: false` e skeleton placeholder durante caricamento:

```typescript
const CrmAnalyticsPanel = dynamic(() => import('@/components/crm-analytics-panel'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-100 rounded-xl h-64" />,
});
```

Per export nominati (QuoteAnalytics):

```typescript
const QuoteAnalytics = dynamic(
  () => import('@/components/commercial-quotes/quote-analytics').then(mod => mod.QuoteAnalytics),
  { ssr: false, loading: () => <div className="animate-pulse bg-gray-100 rounded-xl h-64" /> }
);
```

**Focus trap:** Pattern custom senza dipendenze esterne:

- `FOCUSABLE_SELECTOR` per elementi interattivi
- `Tab`/`Shift+Tab` wrap-around tra primo e ultimo elemento
- `Escape` chiude il dialog
- Auto-focus primo elemento al mount
- Ripristino focus all'elemento precedente alla chiusura

### Test

- Tutti i 2596 unit test verdi
- Build clean (0 errori)

---

## Sprint 3 — "Differenziarsi"

**Commit:** `b543147`
**Tema:** Intelligence, prevenzione, responsive, bulk ops

### Modifiche

| Task                     | Descrizione                                                                     | File principali                                                          |
| ------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Wallet depletion warning | Banner amber (< 10€) / rosso (≤ 0€) con CTA "Ricarica"                          | `app/dashboard/page.tsx`                                                 |
| Responsive tables        | `hidden md:table-cell` / `hidden lg:table-cell` su colonne secondarie           | `spedizioni/page.tsx`, `admin/leads/page.tsx`, `admin/bonifici/page.tsx` |
| Touch-friendly actions   | Azioni righe sempre visibili su mobile (`md:opacity-0 md:group-hover:...`)      | `admin/leads/page.tsx`, `admin/bonifici/page.tsx`                        |
| Bulk label download      | Bottone "Etichette (N)" per download LDV bulk delle selezionate                 | `app/dashboard/spedizioni/page.tsx`                                      |
| Carrier intelligence     | Fetch `/api/corrieri/reliability` + badge "X% zona" con colore per affidabilita | `components/shipments/wizard/steps/CarrierStep.tsx`                      |

### Dettagli tecnici

**Wallet warning:** Usa `workspace.wallet_balance` da `useWorkspaceContext()`. Soglie:

- `< 10€` → banner amber con importo rimasto
- `≤ 0€` → banner rosso "Saldo esaurito — non puoi creare nuove spedizioni"
- CTA link a `/dashboard/wallet`

**Responsive tables:** Pattern `hidden md:table-cell` per nascondere colonne su mobile:

- Spedizioni: nasconde Tracking, Tipo, Peso, Data, Workspace su small/medium
- Leads: nasconde Contatti, Settore, Fonte, Volume, Ultimo Contatto
- Bonifici: nasconde Data, AI Conf

**Carrier intelligence:** Fetch non-bloccante della reliability score dopo il caricamento dei preventivi. Badge con 3 livelli di colore:

- ≥ 80% → verde emerald
- ≥ 60% → amber
- < 60% → rosso

### Test

- Tutti i 2596 unit test verdi
- Build clean (0 errori)

---

## Sprint 4 — "Solidità"

**Commit:** `37f0135`
**Tema:** Revenue-critical fixes, data integrity, supporto visibile

### Modifiche

| Task                    | Descrizione                                                                          | File principali                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Tracking pubblico       | API endpoint pubblico + pagina tracking reale (rimosso tutto mock data)              | `api/public-tracking/[trackingNumber]/route.ts` (nuovo), `app/track/[trackingId]/page.tsx` |
| Salva Bozza             | localStorage auto-save (10s interval, 24h expiry) + bottone manuale                  | `QuickModeForm.tsx`                                                                        |
| Cleanup debug logs      | Rimossi 37 console.log/warn/error di debug dal form spedizione                       | `QuickModeForm.tsx`                                                                        |
| Wallet pre-check wizard | Banner rosso (≤ 0€) / amber (< 10€) con CTA "Ricarica" nella pagina nuova spedizione | `QuickModeForm.tsx`                                                                        |
| Link supporto sidebar   | Link "Supporto" con icona HelpCircle nel footer della sidebar                        | `components/dashboard-sidebar.tsx`                                                         |

### Dettagli tecnici

**Tracking pubblico:** Nuovo endpoint `GET /api/public-tracking/[trackingNumber]` senza autenticazione. Usa `getTrackingService().getTrackingByNumber()` esistente. Restituisce solo dati sicuri (no user_id, no prezzo, no raw_data). La pagina `/track/[trackingId]` è stata completamente riscritta: rimossi mock data, CountdownTimer, UpsellCard; aggiunto supporto per tutti gli status normalizzati (delivered, out_for_delivery, in_transit, at_destination, exception, in_giacenza, created, pending_pickup, returned, cancelled); gestione errori con retry button.

**Salva Bozza:** Pattern localStorage con `saveDraft()` / `handleSaveDraft()`. Auto-save ogni 10 secondi quando `isFormDirty`. Restore al mount solo campi destinatario + pacco (mittente viene dal predefinito). Expiry 24h. Cleanup automatico dopo submit riuscito.

**Wallet pre-check:** Usa `useUser()` da `UserContext` per `wallet_balance`. Banner puramente informativo — il backend fa il vero check (HTTP 402 con `INSUFFICIENT_CREDIT`). Defense in depth.

### Test

- Tutti i 2596 unit test verdi
- Build clean (0 errori)

---

## Componenti riusabili creati/migliorati

| Componente                         | File                                            | Sprint |
| ---------------------------------- | ----------------------------------------------- | ------ |
| `useUnsavedChanges`                | `hooks/useUnsavedChanges.ts`                    | S1     |
| `UserContext` / `useUser`          | `contexts/UserContext.tsx`                      | S1     |
| `StatsCardsSkeleton`               | `components/shared/data-table-skeleton.tsx`     | S2     |
| `DataTableSkeleton`                | `components/shared/data-table-skeleton.tsx`     | S2     |
| `EmptyState`                       | `components/shared/empty-state.tsx`             | S2     |
| `ConfirmActionDialog` (focus trap) | `components/shared/confirm-action-dialog.tsx`   | S2     |
| `Dialog` (focus trap)              | `components/ui/dialog.tsx`                      | S2     |
| Wallet depletion banner            | `app/dashboard/page.tsx` (inline)               | S3     |
| Carrier reliability badge          | `CarrierStep.tsx` (inline)                      | S3     |
| Public tracking API                | `api/public-tracking/[trackingNumber]/route.ts` | S4     |
| Draft save/restore                 | `QuickModeForm.tsx` (inline)                    | S4     |
| Wallet pre-check banner            | `QuickModeForm.tsx` (inline)                    | S4     |
