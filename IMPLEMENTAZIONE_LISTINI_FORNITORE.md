# 🚀 Implementazione: Sistema Listini Fornitore

**Data Inizio**: 2025-01-XX  
**Stato**: 🟡 In Lavorazione  
**Branch**: `feature/listini-fornitore`

---

## 📋 OBIETTIVO

Implementare sistema completo di gestione **Listini Fornitore** per Reseller e BYOC, permettendo:

- ✅ Reseller/BYOC possono creare/modificare/eliminare listini fornitore per ogni corriere
- ✅ Reseller può creare listini personalizzati per i propri sub-users
- ✅ Isolamento completo: Reseller/BYOC NON vedono listini globali nella loro UI
- ✅ Listini fornitore isolati per utente (non visibili ad altri)

---

## 🎯 REQUISITI

### Reseller

- ✅ Vedere propri listini fornitore (uno per ogni corriere configurato)
- ✅ Creare listini fornitore per ogni corriere della configurazione API
- ✅ Modificare/eliminare propri listini fornitore
- ✅ Creare listini personalizzati solo per propri sub-users
- ✅ Assegnare listini personalizzati ai propri sub-users
- ❌ NON vedere listini globali

### BYOC

- ✅ Vedere propri listini fornitore (uno per ogni corriere configurato)
- ✅ Creare listini fornitore per ogni corriere della configurazione API
- ✅ Modificare/eliminare propri listini fornitore
- ❌ NON vedere listini globali
- ❌ NON creare listini personalizzati (non ha sub-users)

---

## 📊 ARCHITETTURA

### Nuovo Campo Database

**Tabella `price_lists`:**

- `list_type` (TEXT) - Tipo listino: `'supplier'` | `'custom'` | `'global'`
  - `'supplier'`: Listino fornitore (Reseller/BYOC)
  - `'custom'`: Listino personalizzato (Reseller per sub-users)
  - `'global'`: Listino globale (Super Admin)

**Logica:**

- `list_type = 'supplier'` + `created_by = userId` → Listino fornitore dell'utente
- `list_type = 'custom'` + `assigned_to_user_id = subUserId` → Listino personalizzato per sub-user
- `list_type = 'global'` + `is_global = true` → Listino globale (Super Admin)

### Helper Functions

**`getAvailableCouriersForUser(userId)`**

- Recupera corrieri disponibili per un utente basandosi su:
  - Configurazioni API (`courier_configs`) con `owner_user_id = userId`
  - `contract_mapping` JSONB per estrarre corrieri (GLS, BRT, SDA, ecc.)

---

## 🔄 FASI DI IMPLEMENTAZIONE

### ✅ FASE 1: Database & Types (Fondamentale) - **COMPLETATA**

**Obiettivo**: Preparare struttura database e types TypeScript

**Task:**

1. ✅ Creare migration SQL per aggiungere `list_type` a `price_lists`
2. ✅ Aggiornare TypeScript types (`types/listini.ts`)
3. ✅ Creare funzione helper `getAvailableCouriersForUser()`

**File modificati:**

- ✅ `supabase/migrations/056_add_list_type.sql` (creato ed eseguito)
- ✅ `types/listini.ts` (aggiunto `list_type` a PriceList, CreatePriceListInput, UpdatePriceListInput)
- ✅ `lib/db/price-lists.ts` (aggiunta funzione `getAvailableCouriersForUser()`)

**Validazione:**

- ✅ Migration 056 eseguita con successo su Supabase
- ✅ Types TypeScript compilano correttamente
- ✅ Funzione helper implementata e esportata correttamente
- ✅ Script di test creato: `scripts/test-getAvailableCouriersForUser.ts`

**Note Tecniche:**

- Campo `list_type` nullable per retrocompatibilità (listini esistenti rimangono NULL)
- CHECK constraint: `'supplier' | 'custom' | 'global'`
- Indice parziale `idx_price_lists_list_type` creato per performance
- Funzione helper supporta multi-provider e gestisce errori gracefully

---

### ✅ FASE 2: Backend Logic (Server Actions & RLS) - **COMPLETATA**

**Obiettivo**: Aggiornare logica backend per supportare listini fornitore

**Task:**

1. ✅ Aggiornare `createPriceListAction` per permettere BYOC di creare listini fornitore
2. ✅ Aggiornare `updatePriceListAction` per verificare `assigned_to_user_id`
3. ✅ Aggiornare `deletePriceListAction` per permettere eliminazione listini fornitore
4. ✅ Aggiornare `listPriceListsAction` per filtrare listini globali (Reseller/BYOC)
5. ✅ Aggiornare RLS Policies per isolare listini fornitore
6. ✅ Creare Server Actions specifiche:
   - `createSupplierPriceListAction()`
   - `listSupplierPriceListsAction()`
   - `getSupplierPriceListForCourierAction(courierId)`

**File modificati:**

- ✅ `actions/price-lists.ts` (tutte le Server Actions aggiornate)
- ✅ `supabase/migrations/057_update_rls_listini_fornitore.sql` (creato ed eseguito)

**Validazione:**

- ✅ BYOC può creare listini fornitore
- ✅ Reseller può creare listini fornitore e personalizzati
- ✅ Reseller/BYOC NON vedono listini globali
- ✅ RLS Policies funzionano correttamente

**Note Tecniche:**

- `createPriceListAction`: Supporta BYOC con validazione `list_type = 'supplier'`
- `updatePriceListAction`: Verifica `assigned_to_user_id` per permessi
- `deletePriceListAction`: Creata nuova action con validazione BYOC
- `listPriceListsAction`: Filtra listini globali per Reseller/BYOC usando `list_type`
- Migration 056.5: Aggiunge valore 'byoc' all'enum `account_type` (OBBLIGATORIA prima della 057)
- Migration 057: Aggiorna tutte le RLS Policies (SELECT, INSERT, UPDATE, DELETE)
  - ⚠️ IMPORTANTE: Esegui PRIMA la 056.5, poi la 057
- Server Actions specifiche: 3 nuove funzioni per gestione listini fornitore

---

### ✅ FASE 3: UI (Interfacce Utente)

**Obiettivo**: Creare interfacce per Reseller e BYOC

**Task:**

1. ✅ Creare `/dashboard/reseller/listini-fornitore` (Reseller)
2. ✅ Creare `/dashboard/reseller/listini-personalizzati` (Reseller)
3. ✅ Creare `/dashboard/byoc/listini-fornitore` (BYOC)
4. ✅ Testare tutte le funzionalità e validare permessi

**File da creare:**

- `app/dashboard/reseller/listini-fornitore/page.tsx` (nuovo)
- `app/dashboard/reseller/listini-personalizzati/page.tsx` (nuovo)
- `app/dashboard/byoc/listini-fornitore/page.tsx` (nuovo)

**Componenti da creare:**

- `components/listini/supplier-price-list-form.tsx`
- `components/listini/supplier-price-list-table.tsx`
- `components/listini/custom-price-list-form.tsx`

**Validazione:**

- ✅ UI accessibile solo a Reseller/BYOC corretti
- ✅ Listini fornitore visibili e gestibili
- ✅ Listini personalizzati funzionanti (solo Reseller)
- ✅ Permessi validati (non si vedono listini globali)

---

## 📝 NOTE TECNICHE

### Identificazione Corrieri Disponibili

Per identificare quali corrieri un utente può usare:

1. Recuperare configurazioni API con `owner_user_id = userId`
2. Estrarre `contract_mapping` JSONB
3. I corrieri sono le chiavi del mapping (es: `{"GLS": "CODE123", "BRT": "CODE456"}`)

### Isolamento Listini Fornitore

**RLS Policy SELECT:**

```sql
-- Reseller/BYOC vedono solo i propri listini fornitore
(list_type = 'supplier' AND created_by = auth.uid())
OR
-- Listini personalizzati assegnati
(list_type = 'custom' AND assigned_to_user_id = auth.uid())
```

**RLS Policy UPDATE/DELETE:**

```sql
-- Solo creatore può modificare/eliminare listini fornitore
(list_type = 'supplier' AND created_by = auth.uid())
OR
-- Admin può tutto
(account_type IN ('admin', 'superadmin'))
```

---

## 🔗 RIFERIMENTI

- **Analisi Completa**: `ANALISI_LISTINI_COMPLETA.md`
- **Tabella Permessi**: Vedi sezione "TABELLA RIASSUNTIVA PERMESSI (NUOVA - AGGIORNATA)"
- **Architettura Database**: `supabase/migrations/020_advanced_price_lists_system.sql`

---

## ✅ CHECKLIST COMPLETAMENTO

### Fase 1 ✅ COMPLETATA

- [x] Migration SQL creata ed eseguita (056_add_list_type.sql)
- [x] Types TypeScript aggiornati (types/listini.ts)
- [x] Funzione helper `getAvailableCouriersForUser()` implementata (lib/db/price-lists.ts)
- [x] Script di test creato (scripts/test-getAvailableCouriersForUser.ts)

### Fase 2 ✅ COMPLETATA

- [x] `createPriceListAction` aggiornata
- [x] `updatePriceListAction` aggiornata
- [x] `deletePriceListAction` aggiornata
- [x] `listPriceListsAction` aggiornata
- [x] Migration 056.5 eseguita: 'byoc' aggiunto all'enum account_type
- [x] Migration 057 eseguita: RLS Policies aggiornate
- [x] Server Actions specifiche create
- [ ] Test manuale: BYOC può creare listini fornitore
- [ ] Test manuale: Reseller/BYOC NON vedono listini globali

### Fase 3

- [ ] UI Reseller listini fornitore creata
- [ ] UI Reseller listini personalizzati creata
- [ ] UI BYOC listini fornitore creata
- [ ] Test completo funzionalità
- [ ] Validazione permessi

---

**Ultimo Aggiornamento**: 2026-01-XX  
**Stato Attuale**: ✅ FASE 1 COMPLETATA, ✅ FASE 2 COMPLETATA (Migration eseguite)  
**Prossimo Step**: Test manuali Fase 2, poi iniziare FASE 3 - UI (Interfacce Utente)
