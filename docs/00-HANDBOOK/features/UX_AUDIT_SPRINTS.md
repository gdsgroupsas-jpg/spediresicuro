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

## Sprint 3 — "Differenziarsi" (pianificato)

**Tema:** Intelligence, prevenzione, responsive, bulk ops

| Task                     | Descrizione                                 |
| ------------------------ | ------------------------------------------- |
| Carrier intelligence     | Suggerimenti corriere basati su storico     |
| Wallet depletion warning | Avviso quando saldo wallet si sta esaurendo |
| Responsive tables        | Tabelle fruibili su mobile                  |
| Bulk operations          | Operazioni massive su spedizioni            |

---

## Sprint 4 — "Eccellenza" (pianificato)

**Tema:** Miglioramenti continui, polish, performance monitoring

---

## Componenti riusabili creati/migliorati

| Componente                         | File                                          | Sprint |
| ---------------------------------- | --------------------------------------------- | ------ |
| `useUnsavedChanges`                | `hooks/useUnsavedChanges.ts`                  | S1     |
| `UserContext` / `useUser`          | `contexts/UserContext.tsx`                    | S1     |
| `StatsCardsSkeleton`               | `components/shared/data-table-skeleton.tsx`   | S2     |
| `DataTableSkeleton`                | `components/shared/data-table-skeleton.tsx`   | S2     |
| `EmptyState`                       | `components/shared/empty-state.tsx`           | S2     |
| `ConfirmActionDialog` (focus trap) | `components/shared/confirm-action-dialog.tsx` | S2     |
| `Dialog` (focus trap)              | `components/ui/dialog.tsx`                    | S2     |
