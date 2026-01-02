# 📋 Template Prompt Riepilogo Fase

**Usa questo template dopo ogni fase completata per riepilogare il lavoro fatto e preparare la prossima fase.**

---

## 🎯 PROMPT PER NUOVA CHAT CURSOR

```
Ciao! Sto implementando il sistema Listini Fornitore per Reseller e BYOC.

## 📊 CONTESTO
Sto lavorando sul progetto SpedireSicuro.it (Next.js 14, TypeScript, Supabase).
Sto implementando la gestione listini fornitore come descritto in:
- ANALISI_LISTINI_COMPLETA.md (analisi completa permessi)
- IMPLEMENTAZIONE_LISTINI_FORNITORE.md (piano di implementazione)

## ✅ FASE COMPLETATA: [NOME FASE]

### Cosa è stato fatto:
- [Elenca task completati]
- [File modificati/creati]
- [Funzionalità implementate]

### Validazione:
- [Test eseguiti]
- [Risultati validazione]

### File modificati:
- `path/file1.ts` - [descrizione modifica]
- `path/file2.ts` - [descrizione modifica]

### File creati:
- `path/new-file.ts` - [descrizione]

### Note importanti:
- [Eventuali note tecniche]
- [Decisioni prese]
- [Problemi risolti]

## 🎯 PROSSIMA FASE: [NOME FASE]

### Obiettivo:
[Descrizione obiettivo prossima fase]

### Task da completare:
1. [Task 1]
2. [Task 2]
3. [Task 3]

### File da modificare/creare:
- [Lista file]

## ❓ DOMANDE/CHIARIMENTI
[Eventuali domande o punti da chiarire]

---

Per favore, aiutami a completare la prossima fase seguendo il piano in IMPLEMENTAZIONE_LISTINI_FORNITORE.md
```

---

## 📝 ESEMPI CONCRETI

### Esempio 1: Dopo FASE 1

```
Ciao! Sto implementando il sistema Listini Fornitore per Reseller e BYOC.

## 📊 CONTESTO
Sto lavorando sul progetto SpedireSicuro.it (Next.js 14, TypeScript, Supabase).
Sto implementando la gestione listini fornitore come descritto in:
- ANALISI_LISTINI_COMPLETA.md (analisi completa permessi)
- IMPLEMENTAZIONE_LISTINI_FORNITORE.md (piano di implementazione)

## ✅ FASE COMPLETATA: FASE 1 - Database & Types

### Cosa è stato fatto:
- ✅ Creata migration SQL per aggiungere campo `list_type` a `price_lists`
- ✅ Aggiornati TypeScript types in `types/listini.ts`
- ✅ Creata funzione helper `getAvailableCouriersForUser()` in `lib/db/price-lists.ts`

### Validazione:
- ✅ Migration eseguita correttamente su database
- ✅ Types TypeScript compilano senza errori
- ✅ Funzione helper testata manualmente e restituisce corrieri corretti

### File modificati:
- `supabase/migrations/054_add_list_type.sql` - Aggiunto campo `list_type` con CHECK constraint
- `types/listini.ts` - Aggiunto `list_type?: 'supplier' | 'custom' | 'global'` a `PriceList` e `CreatePriceListInput`

### File creati:
- `supabase/migrations/054_add_list_type.sql` - Migration per campo `list_type`
- `lib/db/price-lists.ts` - Aggiunta funzione `getAvailableCouriersForUser(userId: string)`

### Note importanti:
- Il campo `list_type` è nullable per retrocompatibilità (listini esistenti)
- La funzione helper estrae corrieri da `contract_mapping` JSONB delle configurazioni API
- Per Spedisci.Online, i corrieri sono le chiavi del `contract_mapping`

## 🎯 PROSSIMA FASE: FASE 2 - Backend Logic

### Obiettivo:
Aggiornare Server Actions e RLS Policies per supportare listini fornitore

### Task da completare:
1. Aggiornare `createPriceListAction` per permettere BYOC di creare listini fornitore
2. Aggiornare `updatePriceListAction` per verificare `assigned_to_user_id`
3. Aggiornare `deletePriceListAction` per permettere eliminazione listini fornitore
4. Aggiornare `listPriceListsAction` per filtrare listini globali (Reseller/BYOC)
5. Aggiornare RLS Policies per isolare listini fornitore
6. Creare Server Actions specifiche per listini fornitore

### File da modificare/creare:
- `actions/price-lists.ts` - Aggiornare Server Actions esistenti
- `supabase/migrations/055_update_rls_listini_fornitore.sql` - Aggiornare RLS Policies
- `lib/db/price-lists.ts` - Eventuali funzioni helper aggiuntive

---

Per favore, aiutami a completare la FASE 2 seguendo il piano in IMPLEMENTAZIONE_LISTINI_FORNITORE.md
```

---

### Esempio 2: Dopo FASE 2

```
Ciao! Sto implementando il sistema Listini Fornitore per Reseller e BYOC.

## 📊 CONTESTO
Sto lavorando sul progetto SpedireSicuro.it (Next.js 14, TypeScript, Supabase).
Sto implementando la gestione listini fornitore come descritto in:
- ANALISI_LISTINI_COMPLETA.md (analisi completa permessi)
- IMPLEMENTAZIONE_LISTINI_FORNITORE.md (piano di implementazione)

## ✅ FASE COMPLETATA: FASE 2 - Backend Logic

### Cosa è stato fatto:
- ✅ Aggiornata `createPriceListAction` - BYOC può creare listini fornitore
- ✅ Aggiornata `updatePriceListAction` - Verifica `assigned_to_user_id`
- ✅ Aggiornata `deletePriceListAction` - Permette eliminazione listini fornitore
- ✅ Aggiornata `listPriceListsAction` - Filtra listini globali per Reseller/BYOC
- ✅ Aggiornate RLS Policies - Isolamento listini fornitore
- ✅ Create Server Actions specifiche: `createSupplierPriceListAction`, `listSupplierPriceListsAction`

### Validazione:
- ✅ Test manuale: BYOC può creare listini fornitore ✅
- ✅ Test manuale: Reseller può creare listini fornitore e personalizzati ✅
- ✅ Test manuale: Reseller/BYOC NON vedono listini globali ✅
- ✅ Test RLS: Listini fornitore isolati per utente ✅

### File modificati:
- `actions/price-lists.ts` - Aggiornate tutte le Server Actions
- `supabase/migrations/055_update_rls_listini_fornitore.sql` - RLS Policies aggiornate

### File creati:
- `actions/supplier-price-lists.ts` - Server Actions specifiche per listini fornitore

### Note importanti:
- RLS Policy SELECT ora esclude listini globali per Reseller/BYOC
- Listini fornitore identificati da: `list_type = 'supplier' AND created_by = userId`
- Listini personalizzati identificati da: `list_type = 'custom' AND assigned_to_user_id = subUserId`

## 🎯 PROSSIMA FASE: FASE 3 - UI

### Obiettivo:
Creare interfacce utente per Reseller e BYOC

### Task da completare:
1. Creare `/dashboard/reseller/listini-fornitore` (Reseller)
2. Creare `/dashboard/reseller/listini-personalizzati` (Reseller)
3. Creare `/dashboard/byoc/listini-fornitore` (BYOC)
4. Testare tutte le funzionalità e validare permessi

### File da creare:
- `app/dashboard/reseller/listini-fornitore/page.tsx`
- `app/dashboard/reseller/listini-personalizzati/page.tsx`
- `app/dashboard/byoc/listini-fornitore/page.tsx`
- `components/listini/supplier-price-list-form.tsx`
- `components/listini/supplier-price-list-table.tsx`
- `components/listini/custom-price-list-form.tsx`

---

Per favore, aiutami a completare la FASE 3 seguendo il piano in IMPLEMENTAZIONE_LISTINI_FORNITORE.md
```

---

## 💡 SUGGERIMENTI

1. **Sii specifico**: Elenca sempre file modificati/creati con percorsi completi
2. **Includi validazione**: Descrivi i test eseguiti e i risultati
3. **Note tecniche**: Documenta decisioni importanti o problemi risolti
4. **Link utili**: Riferisci sempre ai documenti di analisi e piano

---

**Template creato**: 2025-01-XX

