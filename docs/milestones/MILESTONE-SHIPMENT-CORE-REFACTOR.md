# MILESTONE: Refactoring Shipment Creation - Single Source of Truth

**Data:** 2026-01-24
**Priorità:** HIGH
**Stima:** 4-6 ore
**Rischio:** MEDIO (richiede test accurati)
**Status:** ✅ COMPLETATO

---

## Obiettivo

Eliminare la duplicazione tra `route.ts` (894 righe) e `create-shipment-core.ts` (757 righe).
La route diventa un thin wrapper che chiama il core.

## Risultato Finale

```
PRIMA:
├── route.ts (996 righe)
├── create-shipment-core.ts (757 righe)
└── Duplicazione logica wallet/courier/financial

DOPO:
├── route.ts (98 righe) ← Thin wrapper
├── create-shipment-core.ts (~800 righe) ← Single Source of Truth
└── get-courier-client.ts (nuovo) ← Config lookup estratto
```

## Nota Importante

Durante l'analisi abbiamo scoperto che:

- **Il frontend usa `/api/spedizioni`**, NON `/api/shipments/create`
- `/api/spedizioni` ha già logica corretta per `final_price`
- Il refactoring migliora l'architettura per test e future integrazioni
- **Nessun impatto sul frontend produzione**

---

## Fasi

### FASE 1: Allineare Core con Features di Route ✅

**Task 1.1: Aggiungere Response Dettagliato al Core** ✅

- [x] Modificare `createShipmentCore` per restituire sender/recipient nella response
- [x] Allineare formato response con quello attuale di route.ts

**Task 1.2: Creare getCourierClientReal()** ✅

- [x] Estrarre logica config lookup da route.ts in funzione riutilizzabile
- [x] Supporto configId specifico
- [x] Supporto personal → assigned → default
- [x] Contract mapping

**Task 1.3: Aggiungere Legacy Format Support al Core** ✅

- [x] Decisione: gestirlo nella route prima di chiamare core (separation of concerns)

**Task 1.4: Fix Wallet Estimate da Prezzo Quotato** ✅

- [x] Rimuovere stima hardcoded `€8.50 * 1.2 = €10.20`
- [x] Usare `validated.final_price` dal frontend
- [x] Fallback conservativo €15.00 (aumentato da €8.50)
- [x] Margine sicurezza 10% per adjustment

### FASE 2: Refactor Route come Thin Wrapper ✅

**Task 2.1: Sostituire Body di Route con Chiamata a Core** ✅

- [x] Route ora chiama `createShipmentCore()` come Single Source of Truth

**Task 2.2: Rimuovere Codice Duplicato da Route** ✅

- [x] Eliminare tutta la logica wallet
- [x] Eliminare tutta la logica courier
- [x] Eliminare financial tracking duplicato
- [x] Mantenere solo auth, validation, audit

### FASE 3: Test & Validazione ✅

**Task 3.1: Build & TypeScript** ✅

- [x] TypeScript compila senza errori
- [x] Build produzione passa

**Task 3.2: Smoke Test** ✅

- [x] `npm run smoke:wallet` passa (primo test)

**Task 3.3: Test Manuali** ⏭️ SKIPPED

- Frontend usa `/api/spedizioni`, non impattato

### FASE 4: Cleanup ✅

**Task 4.1: Rimuovere Codice Morto** ✅

- [x] Rimosso import `DEFAULT_PLATFORM_FEE` non usato
- [x] Fixato `_walletTransactionId` (prefixed unused)
- [x] Rimosso `data` non usato in destructuring

**Task 4.2: Aggiornare Documentazione** ✅

- [x] Aggiunto JSDoc completo a `createShipmentCore`
- [x] Aggiunto JSDoc a `getCourierClientReal`
- [x] Documentato flusso e invarianti

---

## Checklist Pre-Deploy

- [x] Route.ts < 100 righe (98 righe)
- [x] Nessuna logica wallet duplicata
- [x] Nessuna logica courier duplicata
- [x] Nessuna logica financial tracking duplicata
- [x] Nessuna stima wallet hardcoded (€8.50) → usa `final_price`
- [x] TypeScript compila
- [x] Build passa
- [x] Smoke test passa

---

## Files Modificati

| File                                    | Azione                         | Righe    |
| --------------------------------------- | ------------------------------ | -------- |
| `app/api/shipments/create/route.ts`     | REFACTOR → thin wrapper        | 996 → 98 |
| `lib/shipments/create-shipment-core.ts` | ENHANCE → fix estimate + JSDoc | ~800     |
| `lib/shipments/get-courier-client.ts`   | NEW → config lookup estratto   | ~190     |

---

## Decisione Strategica

**Non migrare `/api/spedizioni` a `createShipmentCore`**

Motivi:

- ROI negativo (55h lavoro, ~€4,400)
- Rischio rotture frontend
- Nessun problema urgente da risolvere
- `/api/spedizioni` già funziona correttamente

Strategia: Pattern "Strangler Fig"

- Nuove integrazioni API → usano `createShipmentCore`
- Nuove feature → implementate in `createShipmentCore`
- `/api/spedizioni` → migrerà gradualmente quando conveniente

---

## Completato il 2026-01-24
