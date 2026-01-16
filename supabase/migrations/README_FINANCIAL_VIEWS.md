# Migrations Finanziarie - Platform P&L

## 📋 Indice Migrations

| ID | Descrizione | Data | Stato |
|----|------------|------|-------|
| 090 | `platform_provider_costs` tabella | 2026-01-07 | ✅ |
| 091 | `shipments.api_source` campo | 2026-01-07 | ✅ |
| 092 | Viste P&L (daily, monthly, usage, alerts, reconciliation) | 2026-01-07 | ✅ |
| 093 | `financial_audit_log` tabella | 2026-01-07 | ✅ |
| 094 | Fix alert margini negativi (WHERE EXISTS LIMIT 0) | 2026-01-07 | ✅ |
| 095 | 🔒 Security Hotfix: RPC functions solo service_role | 2026-01-07 | ✅ |
| 107 | **Exclude test shipments from PnL views** | 2026-01-16 | ✅ |
| 108 | **Fix platform_provider_costs shipment_id typo** | 2026-01-16 | ✅ |
| 109 | **Exclude deleted shipments from PnL views** | 2026-01-16 | ✅ |
| 104 | **RPC functions for platform stats (exclude test + deleted)** | 2026-01-16 | ✅ |

---

## 🔧 Migration 107: Escludi Spedizioni di Test

### Problema

Le viste finanziarie (`v_platform_daily_pnl`, `v_platform_monthly_pnl`, `v_reseller_monthly_platform_usage`, `v_platform_margin_alerts`, `v_reconciliation_pending`) includevano spedizioni di test nei dati P&L.

Questo inquinava i dati finanziari con:
- Spedizioni di test integrate (`tests/integration/shipment-lifecycle.test.ts`)
- Spedizioni di test servizi accessori (`scripts/test-accessori-services-completo.ts`)

### Soluzione

Aggiunto filtro `tracking_number NOT LIKE '%TEST%'` a tutte le 5 viste finanziarie.

### Criteri Identificazione

Spedizioni di test vengono identificate da:
- `tracking_number` che contiene "TEST" (es. 'DRY-RUN-TEST', 'TEST123', etc.)

Questo criterio è sicuro perché:
- I tracking number reali non contengono "TEST"
- È compatibile con tutti i test esistenti
- È facile da mantenere

### Viste Aggiornate

1. **v_platform_daily_pnl** - P&L giornaliero per corriere
2. **v_platform_monthly_pnl** - P&L mensile aggregato
3. **v_reseller_monthly_platform_usage** - Usage mensile per reseller
4. **v_platform_margin_alerts** - Alert margini anomali
5. **v_reconciliation_pending** - Spedizioni da riconciliare

### Verifica

Script di verifica: `scripts/verify-exclude-test-shipments.sql`

Eseguire dopo la migration per confermare che:
- Spedizioni di test esistono (se ci sono)
- Spedizioni di test NON sono incluse nelle viste

### Come Applicare

```bash
# Opzione 1: Supabase Dashboard
1. Vai su SQL Editor
2. Copia e incolla supabase/migrations/107_exclude_test_shipments_from_pnl_views.sql
3. Esegui
4. Verifica con scripts/verify-exclude-test-shipments.sql

# Opzione 2: Supabase CLI
npx supabase db execute -f supabase/migrations/107_exclude_test_shipments_from_pnl_views.sql
npx supabase db execute -f scripts/verify-exclude-test-shipments.sql
```

### Impatto

- ✅ Dati finanziari ora puliti da spedizioni di test
- ✅ Financial Dashboard mostra solo spedizioni reali
- ✅ P&L accurati per reporting contabile
- ✅ No breaking changes (solo filtro aggiunto)

### Note Importanti

- Le spedizioni di test rimangono nel database (non cancellate)
- Sono solo **escluse dalle viste finanziarie**
- Questo mantiene l'audit trail completo
- Dashboard finanziaria ora mostra dati corretti

---

## 📊 Viste Finanziarie Riepilogo

### 1. v_platform_daily_pnl
P&L giornaliero per corriere con metriche:
- Volumi, fatturato, costi, margini
- Alert (margini negativi, discrepanze)
- Breakdown cost source (API real-time, master list, estimate)

### 2. v_platform_monthly_pnl
P&L mensile aggregato:
- Revenue, costi, margini
- Qualità dati (accuratezza cost source)
- Issues (margini negativi, discrepanze)

### 3. v_reseller_monthly_platform_usage
Usage mensile per reseller:
- Spesa, margini generati
- Trend vs mese precedente
- Corrieri usati

### 4. v_platform_margin_alerts
Alert margini anomali:
- Margini negativi (priorità massima)
- Margini troppo bassi (< 5%)
- Margini troppo alti (> 50%)

### 5. v_reconciliation_pending
Spedizioni da riconciliare:
- Status pending o discrepancy
- Ordinato per priorità (discrepanze prima) e età (FIFO)

---

## 🔒 Note di Sicurezza

- Tutte le viste ereditano RLS da `platform_provider_costs`
- Solo SuperAdmin può accedere alle viste
- Migration 95 ha revocato permessi pubblici su RPC critiche
- Audit trail completo in `financial_audit_log`

---

## 🚨 Troubleshooting

### Problema: Spedizioni di test ancora visibili

**Soluzione:**
1. Verifica che la migration 107 sia stata applicata
2. Esegui lo script di verifica: `scripts/verify-exclude-test-shipments.sql`
3. Controlla che il filtro `tracking_number NOT LIKE '%TEST%'` sia presente

### Problema: Viste restituiscono dati vuoti

**Soluzione:**
1. Verifica che ci siano spedizioni reali (non di test)
2. Controlla che `api_source = 'platform'`
3. Verifica permessi SuperAdmin

### Problema: Performance lenta sulle viste

**Soluzione:**
1. Considera materialized views (vedi commenti nella migration 092)
2. Crea indici sulle colonne joinate
3. Aggiorna statistiche PostgreSQL: `ANALYZE`

---

## 📚 Documentazione Correlata

- `docs/11-FEATURES/FINANCIAL_TRACKING.md` - Feature finanziarie
- `docs/9-BUSINESS/FINANCIAL.md` - Money flows e P&L
- `actions/platform-costs.ts` - Server Actions per dashboard finanziaria

---

---

## 🔧 Migration 109: Escludi Spedizioni Cancellate

### Problema

Le viste finanziarie includevano spedizioni cancellate (soft delete) nei dati P&L. Questo inquinava i dati finanziari con spedizioni che non dovrebbero essere conteggiate.

### Soluzione

Aggiunto filtro `s.deleted = false OR s.deleted IS NULL` a tutte le 5 viste finanziarie.

**File:** `supabase/migrations/109_exclude_deleted_shipments_from_pnl_views.sql`

### Criteri Identificazione

Spedizioni cancellate vengono identificate da:
- `deleted = true` e `deleted_at IS NOT NULL`

Vedi: `docs/SPEDIZIONI_CANCELLATE.md` per dettagli soft delete.

### Viste Aggiornate

Tutte le 5 viste finanziarie ora escludono anche le spedizioni cancellate:
1. **v_platform_daily_pnl** - P&L giornaliero (senza test e cancellate)
2. **v_platform_monthly_pnl** - P&L mensile (senza test e cancellate)
3. **v_reseller_monthly_platform_usage** - Usage reseller (senza test e cancellate)
4. **v_platform_margin_alerts** - Alert margini (senza test e cancellate)
5. **v_reconciliation_pending** - Riconciliazione (senza test e cancellate)

### Filtri Combinati (Migration 107 + 109)

Dopo le migrations 107 e 109, tutte le viste applicano:

```sql
WHERE ppc.api_source = 'platform'
  AND s.tracking_number NOT LIKE '%TEST%'  -- 🚫 Migration 107
  AND (s.deleted = false OR s.deleted IS NULL)  -- 🚫 Migration 109
```

---

## 🔧 Migration 104: Funzioni RPC per Platform Stats

### Problema

`getPlatformStatsAction()` faceva query dirette su `platform_provider_costs` senza filtrare spedizioni di test o cancellate. Questo causava dati errati nella Financial Dashboard.

### Soluzione

Creata 3 funzioni SQL RPC che escludono test e cancellate:

**File:** `supabase/migrations/104_get_platform_stats_function.sql`

#### **a) `get_platform_stats()`**
- Calcola statistiche totali per dashboard
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

### Filtri Applicati (Tutte le Funzioni)

```sql
WHERE ppc.api_source = 'platform'
  AND s.tracking_number NOT LIKE '%TEST%'  -- 🚫 ESCLUDE SPEDIZIONI DI TEST
  AND (s.deleted = false OR s.deleted IS NULL)  -- 🚫 ESCLUDE SPEDIZIONI CANCELLATE
```

### Aggiornamento Server Actions

**File:** `actions/platform-costs.ts`

- ✅ `getPlatformStatsAction()` → usa `get_platform_stats()` RPC
- ✅ `getMarginByCourierAction()` → usa `get_margin_by_courier()` RPC
- ✅ `getTopResellersAction()` → usa `get_top_resellers()` RPC

Tutte con fallback a query dirette se RPC non disponibile (compatibilità).

### Verifica

```sql
-- Test funzione principale
SELECT * FROM get_platform_stats();

-- Verifica funzioni esistenti
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'get_platform_stats',
    'get_margin_by_courier',
    'get_top_resellers'
  );
```

---

*Last Updated: 2026-01-16*
*Migrations 107, 108, 109, 104: Exclude Test & Deleted Shipments from Financial Views*
