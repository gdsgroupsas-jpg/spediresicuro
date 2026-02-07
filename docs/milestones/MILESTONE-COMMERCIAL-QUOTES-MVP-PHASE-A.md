# MILESTONE: Preventivatore Commerciale — MVP + Fase A

**Data:** 2026-02-07
**Priorita':** HIGH
**Stima:** 8-10 ore
**Rischio:** BASSO
**Status:** COMPLETATO

---

## Obiettivo

Creare il modulo Preventivatore Commerciale per reseller: generazione preventivi PDF brandizzati per prospect, pipeline di gestione, conversione in clienti operativi. Fase A aggiunge logistica intelligente (delivery mode, processing fee, multi-corriere).

## Risultato Finale

```
PRIMA:
└── Nessun sistema preventivi commerciali
    I reseller gestivano preventivi manualmente (Excel, email)

DOPO:
├── actions/commercial-quotes.ts (44KB, 7 server actions)
├── types/commercial-quotes.ts (tipi completi + status FSM)
├── lib/commercial-quotes/
│   ├── matrix-builder.ts (costruzione matrice da listino)
│   ├── pdf-generator.ts (PDF brandizzato con jsPDF)
│   ├── clauses.ts (clausole standard + custom)
│   └── conversion.ts (prospect -> cliente operativo)
├── components/commercial-quotes/ (6 componenti React)
├── app/dashboard/reseller/preventivo/page.tsx
├── app/api/commercial-quotes/[id]/pdf/route.ts
├── supabase/migrations/ (schema DB + trigger expires_at)
└── tests/unit/ (7 file, 125+ test)
```

---

## Fasi

### MVP: Sistema Base

**Task 1: Schema Database**

- [x] Migration `commercial_quotes` con tutti i campi (prospect, matrice, clausole, status)
- [x] Migration `commercial_quote_events` per lifecycle tracking
- [x] Trigger `expires_at = sent_at + validity_days * interval '1 day'`
- [x] RLS policies per workspace isolation
- [x] `original_margin_percent` per self-learning futuro

**Task 2: Tipi TypeScript**

- [x] `CommercialQuoteStatus`: draft, sent, negotiating, accepted, rejected, expired
- [x] `CommercialQuoteEventType`: 9 tipi evento
- [x] `CommercialQuotePriceMatrix`, `CommercialQuoteClause`
- [x] `VALID_TRANSITIONS` map per FSM stato
- [x] `PROSPECT_SECTORS` (8 settori)

**Task 3: Logica Core**

- [x] `buildPriceMatrix()` — costruzione matrice da listino attivo
- [x] `generateQuotePdf()` — PDF brandizzato con header, matrice, clausole
- [x] Clausole standard (IVA, pagamento, validita', supplementi)
- [x] `convertProspectToClient()` — creazione utente + listino personalizzato

**Task 4: Server Actions**

- [x] `createCommercialQuoteAction` — crea draft con matrice
- [x] `getCommercialQuotesAction` — lista con filtri, raggruppa revisioni
- [x] `getCommercialQuoteByIdAction` — dettaglio + catena revisioni
- [x] `sendCommercialQuoteAction` — genera PDF, upload storage, status sent
- [x] `updateQuoteStatusAction` — transizioni con validazione FSM
- [x] `createRevisionAction` — nuova revisione da esistente
- [x] `convertQuoteToClientAction` — conversione completa

**Task 5: Componenti UI**

- [x] `QuoteForm` — form multi-step con anteprima matrice
- [x] `QuotePipeline` — tabella con filtri, badge stato, azioni contestuali
- [x] `QuoteDetailDialog` — dialog modale con matrice, clausole, revisioni
- [x] `MatrixPreview` — tabella prezzi zone x pesi
- [x] `ConvertDialog` — form conversione con email/password

**Task 6: Test MVP (82 test)**

- [x] Matrix builder: 22 test (costruzione, fasce peso, zone, arrotondamento)
- [x] PDF: 18 test (generazione, layout, clausole, metadata)
- [x] Clausole: 21 test (standard, custom, validazione, merge)
- [x] Pipeline: 14 test (transizioni stato, filtri, FSM)
- [x] Immutabilita': 19 test (snapshot, revisioni, catena parent)
- [x] Audit: 9 test (costanti, logging)

### Fase A: Logistica Intelligente

**Task 7: Delivery Mode**

- [x] 3 modalita': `carrier_pickup`, `own_fleet`, `client_dropoff`
- [x] Label e descrizioni italiane
- [x] Selector nel form con icone (Truck, Building2, MapPin)

**Task 8: Processing Fee**

- [x] Campo opzionale per tariffa lavorazione merce
- [x] Visibile nella matrice e nel PDF
- [x] Validazione: >= 0, max 2 decimali

**Task 9: Multi-Corriere**

- [x] Confronto fino a 3 corrieri nello stesso preventivo
- [x] Selezione carrierCode dal listino workspace
- [x] Matrice separata per ogni corriere

**Task 10: Test Fase A (43 test)**

- [x] Delivery mode: 22 test (validazione, label, icone, PDF)
- [x] Processing fee: integrato nei test delivery mode

---

## Files Modificati

| File                                          | Azione     | Note                         |
| --------------------------------------------- | ---------- | ---------------------------- |
| `actions/commercial-quotes.ts`                | Nuovo      | 7 server actions, ~700 righe |
| `types/commercial-quotes.ts`                  | Nuovo      | Tipi completi, ~200 righe    |
| `lib/commercial-quotes/matrix-builder.ts`     | Nuovo      | Costruzione matrice          |
| `lib/commercial-quotes/pdf-generator.ts`      | Nuovo      | Generazione PDF jsPDF        |
| `lib/commercial-quotes/clauses.ts`            | Nuovo      | Clausole standard + custom   |
| `lib/commercial-quotes/conversion.ts`         | Nuovo      | Prospect -> cliente          |
| `components/commercial-quotes/*.tsx`          | Nuovo      | 6 componenti UI              |
| `app/dashboard/reseller/preventivo/page.tsx`  | Nuovo      | Pagina principale            |
| `app/api/commercial-quotes/[id]/pdf/route.ts` | Nuovo      | API download PDF             |
| `supabase/migrations/20260207*.sql`           | Nuovo      | Schema + trigger             |
| `lib/security/audit-actions.ts`               | Modificato | +5 costanti audit            |
| `tests/unit/commercial-quote-*.test.ts`       | Nuovo      | 7 file, 125+ test            |

## Checklist Pre-Deploy

- [x] 125+ test unitari verdi
- [x] `npm run build` zero errori
- [x] Review sicurezza: workspace isolation, RLS, audit
- [x] Snapshot immutabile verificato (matrice non modificabile dopo invio)
- [x] Transizioni stato validate con FSM

---

## Completato il 2026-02-07
