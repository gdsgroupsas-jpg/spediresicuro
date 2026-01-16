# 🔍 ANALISI: Origine Numeri Financial Dashboard

**Data:** 2026-01-16  
**Problema:** Numeri nella Financial Dashboard includono spedizioni di test e cancellate  
**Status:** ✅ RISOLTO

---

## 📊 **NUMERI VISIBILI NELLA DASHBOARD**

Dalla screenshot della dashboard SuperAdmin (`/dashboard/super-admin/financial`):

- **Spedizioni Totali:** 9
- **Ricavi Totali:** €117,00
- **Costi Provider:** €96,00
- **Margine Lordo:** €21,00
- **Margine Medio:** 21.9%
- **Da Riconciliare:** 9
- **Margini Negativi:** 3
- **Ultimi 30 Giorni:** 9

---

## 🔍 **ORIGINE DEI NUMERI**

### **Componente UI**
- **File:** `app/dashboard/super-admin/financial/page.tsx`
- **Componente:** `StatsCards` (`_components/stats-cards.tsx`)
- **Dati:** Provengono da `getPlatformStatsAction()`

### **Server Action**
- **File:** `actions/platform-costs.ts`
- **Funzione:** `getPlatformStatsAction()`
- **Problema Originale:** 
  - ❌ Query dirette su `platform_provider_costs` 
  - ❌ Nessun JOIN con `shipments`
  - ❌ Nessun filtro per test o cancellate

### **Query Originali (PROBLEMATICHE)**

```typescript
// ❌ PRIMA: Query diretta senza filtri
const { data: totalStats } = await supabaseAdmin
  .from("platform_provider_costs")
  .select("billed_amount, provider_cost, platform_margin")
  .eq("api_source", "platform");
```

**Risultato:** Includeva TUTTE le spedizioni, anche:
- Spedizioni di test (`tracking_number LIKE '%TEST%'`)
- Spedizioni cancellate (`deleted = true`)

---

## ✅ **SOLUZIONE IMPLEMENTATA**

### **Contesto: Migrations Precedenti**

Prima di questo fix, erano state applicate:
- **Migration 101:** Esclude spedizioni di test dalle viste finanziarie
- **Migration 103:** Esclude spedizioni cancellate dalle viste finanziarie

Tuttavia, `getPlatformStatsAction()` faceva ancora query dirette senza filtri.

### **1. Funzioni SQL RPC (Migration 104)**

**File:** `supabase/migrations/104_get_platform_stats_function.sql`

Creata 3 funzioni SQL che escludono test E cancellate:

#### **a) `get_platform_stats()`**
- Calcola statistiche totali
- Esclude test e cancellate
- Restituisce: total_shipments, total_revenue, total_cost, total_margin, avg_margin_percent, pending_reconciliation, negative_margin_count, last_30_days_shipments

#### **b) `get_margin_by_courier(p_start_date)`**
- Margini aggregati per corriere
- Parametro: `p_start_date` (opzionale)
- Esclude test e cancellate

#### **c) `get_top_resellers(p_limit, p_start_date)`**
- Top resellers per platform usage
- Parametri: `p_limit` (default 20), `p_start_date` (opzionale)
- Esclude test e cancellate

### **2. Filtri Applicati (Tutte le Funzioni)**

```sql
WHERE ppc.api_source = 'platform'
  AND s.tracking_number NOT LIKE '%TEST%'  -- 🚫 ESCLUDE SPEDIZIONI DI TEST
  AND (s.deleted = false OR s.deleted IS NULL)  -- 🚫 ESCLUDE SPEDIZIONI CANCELLATE
```

### **3. Aggiornamento Server Actions**

**File:** `actions/platform-costs.ts`

#### **`getPlatformStatsAction()`**
- ✅ Usa `get_platform_stats()` RPC
- ✅ Fallback a query dirette se RPC non disponibile

#### **`getMarginByCourierAction()`**
- ✅ Usa `get_margin_by_courier()` RPC
- ✅ Fallback a query dirette se RPC non disponibile

#### **`getTopResellersAction()`**
- ✅ Usa `get_top_resellers()` RPC
- ✅ Fallback a query dirette se RPC non disponibile

---

## 📈 **FLUSSO DATI CORRETTO**

```
Financial Dashboard (UI)
    ↓
getPlatformStatsAction() (TypeScript)
    ↓
get_platform_stats() (SQL RPC)
    ↓
platform_provider_costs
    JOIN shipments
    WHERE tracking_number NOT LIKE '%TEST%'
    AND deleted = false
    ↓
Statistiche Corrette ✅
```

---

## 🚀 **DEPLOYMENT**

### **Step 1: Applica Migration**

```bash
# Esegui migration 104
supabase migration up 104_get_platform_stats_function
```

Oppure esegui manualmente nel SQL Editor di Supabase:
- File: `supabase/migrations/104_get_platform_stats_function.sql`

### **Step 2: Verifica Funzioni**

```sql
-- Verifica che le funzioni esistano
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'get_platform_stats',
    'get_margin_by_courier',
    'get_top_resellers'
  );

-- Test funzione principale
SELECT * FROM get_platform_stats();
```

### **Step 3: Test Dashboard**

1. Accedi a `/dashboard/super-admin/financial`
2. Verifica che i numeri siano corretti (escludono test e cancellate)
3. Controlla che "Spedizioni Totali" non includa test
4. Verifica che "Da Riconciliare" non includa cancellate

---

## 🔍 **VERIFICA DATI**

### **Query per Verificare Spedizioni di Test**

```sql
-- Conta spedizioni di test in platform_provider_costs
SELECT COUNT(*) 
FROM platform_provider_costs ppc
JOIN shipments s ON s.id = ppc.shipment_id
WHERE ppc.api_source = 'platform'
  AND s.tracking_number LIKE '%TEST%';
```

### **Query per Verificare Spedizioni Cancellate**

```sql
-- Conta spedizioni cancellate in platform_provider_costs
SELECT COUNT(*) 
FROM platform_provider_costs ppc
JOIN shipments s ON s.id = ppc.shipment_id
WHERE ppc.api_source = 'platform'
  AND s.deleted = true;
```

### **Query per Verificare Statistiche Corrette**

```sql
-- Confronta: totale vs esclusi test/cancellate
SELECT 
  (SELECT COUNT(*) FROM platform_provider_costs WHERE api_source = 'platform') AS totale,
  (SELECT total_shipments FROM get_platform_stats()) AS esclusi_test_cancellate;
```

---

## 📝 **NOTE TECNICHE**

### **Fallback Legacy**
Le funzioni TypeScript hanno un fallback alle query dirette se le RPC non sono disponibili. Questo garantisce:
- ✅ Compatibilità con database senza migration 104
- ✅ Degrado graceful
- ⚠️ I dati potrebbero includere test/cancellate se RPC non disponibile

### **Performance**
Le funzioni SQL RPC sono ottimizzate:
- ✅ JOIN efficienti con `shipments`
- ✅ Indici su `tracking_number` e `deleted` (se presenti)
- ✅ Aggregazioni a livello database (più veloci)

### **Sicurezza**
- ✅ Funzioni con `SECURITY DEFINER`
- ✅ Verifica SuperAdmin nel codice TypeScript
- ✅ Solo service_role può eseguire (gestito via `supabaseAdmin`)

---

## ✅ **CHECKLIST POST-DEPLOY**

- [ ] Migration 104 applicata con successo
- [ ] Funzioni RPC create e verificabili
- [ ] Dashboard mostra numeri corretti (escludono test)
- [ ] Dashboard mostra numeri corretti (escludono cancellate)
- [ ] "Spedizioni Totali" = numero corretto
- [ ] "Da Riconciliare" = numero corretto
- [ ] "Margini Negativi" = numero corretto
- [ ] Nessun errore in console
- [ ] Performance dashboard accettabile (< 2 secondi)

---

## 🔗 **FILE CORRELATI**

### **Migrations Database**

1. **Migration 101:** `supabase/migrations/101_exclude_test_shipments_from_pnl_views.sql`
   - Esclude spedizioni di test (`tracking_number LIKE '%TEST%'`) dalle viste finanziarie
   - Applicata alle 5 viste: daily_pnl, monthly_pnl, reseller_usage, margin_alerts, reconciliation_pending

2. **Migration 103:** `supabase/migrations/103_exclude_deleted_shipments_from_pnl_views.sql`
   - Esclude spedizioni cancellate (`deleted = true`) dalle viste finanziarie
   - Stesse 5 viste aggiornate con filtro aggiuntivo
   - Vedi: `docs/SPEDIZIONI_CANCELLATE.md` per dettagli soft delete

3. **Migration 104:** `supabase/migrations/104_get_platform_stats_function.sql` ⭐ **QUESTO FIX**
   - Crea 3 funzioni RPC che escludono test E cancellate
   - `get_platform_stats()` - statistiche totali
   - `get_margin_by_courier()` - margini per corriere
   - `get_top_resellers()` - top resellers

### **Codice TypeScript**

- `actions/platform-costs.ts` - Server actions aggiornate per usare RPC
- `app/dashboard/super-admin/financial/page.tsx` - UI dashboard

### **Documentazione**

- `supabase/migrations/README_FINANCIAL_VIEWS.md` - Indice completo migrations finanziarie
- `FIX_FINANCIAL_DASHBOARD_EXCLUDE_TEST_SHIPMENTS.md` - Fix migration 101 (solo test)
- `docs/SPEDIZIONI_CANCELLATE.md` - Sistema soft delete completo

---

**Motto:** *"Test First, Commit After - Excellence Only"*
