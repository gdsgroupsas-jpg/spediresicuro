# Financial Tracking - SpedireSicuro

## Overview

Questo documento descrive il sistema di tracking finanziario di SpedireSicuro, che traccia i costi reali che la piattaforma paga ai corrieri, calcola margini, genera P&L, e gestisce alert per margini anomali.

## Target Audience

- [x] Developers
- [x] DevOps
- [x] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- Conoscenza base di P&L e margini
- Comprensione di sistemi di riconciliazione
- Familiarità con PostgreSQL views

## Quick Reference

| Sezione          | Pagina                                 | Link                                       |
| ---------------- | -------------------------------------- | ------------------------------------------ |
| Platform Costs   | docs/11-FEATURES/FINANCIAL_TRACKING.md | [Platform Costs](#platform-provider-costs) |
| P&L Views        | docs/11-FEATURES/FINANCIAL_TRACKING.md | [P&L](#p-l-views)                          |
| Cost Calculation | docs/11-FEATURES/FINANCIAL_TRACKING.md | [Cost Calculation](#cost-calculation)      |
| Financial Alerts | docs/11-FEATURES/FINANCIAL_TRACKING.md | [Alerts](#financial-alerts)                |
| Reconciliation   | docs/11-FEATURES/FINANCIAL_TRACKING.md | [Reconciliation](#reconciliation)          |

## Content

### Platform Provider Costs

#### Concetto

Quando un Reseller/BYOC usa un listino assegnato dal SuperAdmin (contratti piattaforma), SpedireSicuro paga il corriere per conto del Reseller. La tabella `platform_provider_costs` traccia:

- Quanto abbiamo addebitato al Reseller (`billed_amount`)
- Quanto paghiamo noi al corriere (`provider_cost`)
- Il margine effettivo (`platform_margin`)

#### Struttura Database

**File:** `supabase/migrations/090_platform_provider_costs.sql`

```sql
CREATE TABLE platform_provider_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Riferimento spedizione
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  shipment_tracking_number TEXT NOT NULL,

  -- Chi ha pagato (Reseller o suo sub-user)
  billed_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Importi
  billed_amount DECIMAL(10,2) NOT NULL CHECK (billed_amount >= 0), -- Quanto addebitato
  provider_cost DECIMAL(10,2) NOT NULL CHECK (provider_cost >= 0), -- Quanto paghiamo
  platform_margin DECIMAL(10,2), -- Calcolato via trigger: billed_amount - provider_cost
  platform_margin_percent DECIMAL(5,2), -- Calcolato via trigger

  -- Fonte API
  api_source TEXT NOT NULL CHECK (api_source IN ('platform', 'reseller_own', 'byoc_own')),
  price_list_id UUID REFERENCES price_lists(id),
  master_price_list_id UUID REFERENCES price_lists(id),

  -- Dettagli corriere
  courier_code TEXT NOT NULL,
  service_type TEXT,

  -- Fonte costo
  cost_source TEXT CHECK (cost_source IN ('api_realtime', 'master_list', 'historical_avg', 'estimate')),

  -- Riconciliazione
  reconciliation_status TEXT DEFAULT 'pending' CHECK (reconciliation_status IN ('pending', 'matched', 'discrepancy', 'resolved')),
  reconciliation_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Trigger Calcolo Margine

```sql
CREATE OR REPLACE FUNCTION calculate_platform_margins()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcola margine assoluto
  NEW.platform_margin := NEW.billed_amount - NEW.provider_cost;

  -- Calcola margine percentuale
  IF NEW.provider_cost > 0 THEN
    NEW.platform_margin_percent := ROUND(
      ((NEW.billed_amount - NEW.provider_cost) / NEW.provider_cost * 100)::numeric,
      2
    );
  ELSE
    NEW.platform_margin_percent := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ppc_calculate_margins
  BEFORE INSERT OR UPDATE ON platform_provider_costs
  FOR EACH ROW
  EXECUTE FUNCTION calculate_platform_margins();
```

#### Registrazione Costo

**File:** `lib/shipments/platform-cost-recorder.ts`

```typescript
export async function recordPlatformCost(
  supabaseAdmin: SupabaseClient,
  params: RecordPlatformCostParams
): Promise<RecordPlatformCostResult> {
  // Skip se non è spedizione platform
  if (params.apiSource !== 'platform') {
    return { success: true };
  }

  // Usa funzione RPC per insert sicuro
  const { data, error } = await supabaseAdmin.rpc('record_platform_provider_cost', {
    p_shipment_id: params.shipmentId,
    p_tracking_number: params.trackingNumber,
    p_billed_user_id: params.billedUserId,
    p_billed_amount: params.billedAmount,
    p_provider_cost: params.providerCost,
    p_api_source: params.apiSource,
    p_courier_code: params.courierCode,
    p_cost_source: params.costSource || 'estimate',
  });

  if (error) {
    // NON bloccare la spedizione, solo log
    console.error('[PLATFORM_COST] Failed to record:', error);
    return { success: false, error: error.message };
  }

  return { success: true, recordId: data as string };
}
```

**⚠️ IMPORTANTE:** La registrazione del costo NON deve mai bloccare la creazione della spedizione (graceful degradation).

---

### Cost Calculation

#### Determinazione API Source

**File:** `lib/pricing/platform-cost-calculator.ts`

Il sistema determina quale fonte API è stata usata:

1. **Listino derivato da master** (`master_list_id`) → `'platform'`
2. **Listino globale** (`is_global = true`) → `'platform'`
3. **Listino assegnato da SuperAdmin** → `'platform'`
4. **Utente BYOC** → `'byoc_own'`
5. **Default** → `'reseller_own'`

```typescript
export async function determineApiSource(
  supabaseAdmin: SupabaseClient,
  params: DetermineApiSourceParams
): Promise<DetermineApiSourceResult> {
  const { userId, priceListId } = params;

  // Se abbiamo un priceListId, verifica caratteristiche
  if (priceListId) {
    const { data: priceList } = await supabaseAdmin
      .from('price_lists')
      .select('id, master_list_id, is_global, list_type')
      .eq('id', priceListId)
      .single();

    // Check 1: Listino derivato da master
    if (priceList?.master_list_id) {
      return {
        apiSource: 'platform',
        masterPriceListId: priceList.master_list_id,
        reason: 'Listino derivato da master',
      };
    }

    // Check 2: Listino globale
    if (priceList?.is_global) {
      return {
        apiSource: 'platform',
        reason: 'Listino globale SpedireSicuro',
      };
    }
  }

  // Check 3: Verifica tipo utente
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', userId)
    .single();

  if (user?.account_type === 'byoc') {
    return { apiSource: 'byoc_own', reason: 'Utente BYOC' };
  }

  // Default: reseller con proprio contratto
  return { apiSource: 'reseller_own', reason: 'Contratto proprio' };
}
```

#### Calcolo Provider Cost

```typescript
export async function calculateProviderCost(
  supabaseAdmin: SupabaseClient,
  params: {
    courierCode: string;
    weight: number;
    destination: { zip?: string; province?: string; country?: string };
    serviceType?: string;
    masterPriceListId?: string;
  }
): Promise<{
  cost: number;
  source: CostSource;
}> {
  // 1. Prova API real-time (se disponibile)
  try {
    const apiCost = await getRealtimeCostFromCourierAPI(params);
    if (apiCost) {
      return { cost: apiCost, source: 'api_realtime' };
    }
  } catch (error) {
    // Fallback a listino
  }

  // 2. Usa master price list
  if (params.masterPriceListId) {
    const listCost = await getCostFromPriceList(
      params.masterPriceListId,
      params.destination,
      params.weight
    );
    if (listCost) {
      return { cost: listCost, source: 'master_list' };
    }
  }

  // 3. Fallback: historical average
  const avgCost = await getHistoricalAverageCost(params.courierCode, params.destination);
  if (avgCost) {
    return { cost: avgCost, source: 'historical_avg' };
  }

  // 4. Ultimo fallback: stima
  return { cost: estimateCost(params), source: 'estimate' };
}
```

---

### P&L Views

#### P&L Giornaliero per Corriere

**View:** `v_platform_daily_pnl`

**File:** `supabase/migrations/092_platform_pnl_views.sql`

```sql
CREATE OR REPLACE VIEW v_platform_daily_pnl AS
SELECT
  DATE(ppc.created_at) AS date,
  ppc.courier_code,

  -- Volumi
  COUNT(*) AS shipments_count,

  -- Fatturato (quanto abbiamo incassato)
  SUM(ppc.billed_amount) AS total_billed,
  AVG(ppc.billed_amount) AS avg_billed,

  -- Costi (quanto paghiamo)
  SUM(ppc.provider_cost) AS total_provider_cost,
  AVG(ppc.provider_cost) AS avg_provider_cost,

  -- Margine
  SUM(ppc.platform_margin) AS total_margin,
  AVG(ppc.platform_margin) AS avg_margin,
  AVG(ppc.platform_margin_percent) AS avg_margin_percent,

  -- Alert
  COUNT(*) FILTER (WHERE ppc.platform_margin < 0) AS negative_margin_count,
  COUNT(*) FILTER (WHERE ppc.reconciliation_status = 'discrepancy') AS discrepancy_count,

  -- Cost source breakdown
  COUNT(*) FILTER (WHERE ppc.cost_source = 'api_realtime') AS cost_from_api,
  COUNT(*) FILTER (WHERE ppc.cost_source = 'master_list') AS cost_from_list,
  COUNT(*) FILTER (WHERE ppc.cost_source IN ('historical_avg', 'estimate')) AS cost_estimated

FROM platform_provider_costs ppc
WHERE ppc.api_source = 'platform'
GROUP BY DATE(ppc.created_at), ppc.courier_code
ORDER BY date DESC, courier_code;
```

#### P&L Mensile Aggregato

**View:** `v_platform_monthly_pnl`

```sql
CREATE OR REPLACE VIEW v_platform_monthly_pnl AS
SELECT
  DATE_TRUNC('month', ppc.created_at)::DATE AS month,

  -- Volumi
  COUNT(*) AS total_shipments,
  COUNT(DISTINCT ppc.billed_user_id) AS unique_users,

  -- Fatturato
  SUM(ppc.billed_amount) AS total_revenue,

  -- Costi
  SUM(ppc.provider_cost) AS total_cost,

  -- Margine
  SUM(ppc.platform_margin) AS gross_margin,
  ROUND(
    (SUM(ppc.platform_margin) / NULLIF(SUM(ppc.billed_amount), 0) * 100)::numeric,
    2
  ) AS margin_percent_of_revenue,

  -- Qualità dati
  COUNT(*) FILTER (WHERE ppc.cost_source IN ('api_realtime', 'master_list')) AS accurate_cost_count,
  ROUND(
    (COUNT(*) FILTER (WHERE ppc.cost_source IN ('api_realtime', 'master_list'))::DECIMAL /
     NULLIF(COUNT(*), 0) * 100)::numeric,
    1
  ) AS cost_accuracy_percent,

  -- Issues
  COUNT(*) FILTER (WHERE ppc.platform_margin < 0) AS negative_margin_count,
  COUNT(*) FILTER (WHERE ppc.reconciliation_status = 'discrepancy') AS unresolved_discrepancies

FROM platform_provider_costs ppc
WHERE ppc.api_source = 'platform'
GROUP BY DATE_TRUNC('month', ppc.created_at)
ORDER BY month DESC;
```

#### Usage Mensile per Reseller

**View:** `v_reseller_monthly_platform_usage`

```sql
CREATE OR REPLACE VIEW v_reseller_monthly_platform_usage AS
SELECT
  DATE_TRUNC('month', ppc.created_at)::DATE AS month,
  ppc.billed_user_id,
  u.email AS user_email,
  u.name AS user_name,

  -- Volumi
  COUNT(*) AS shipments_count,

  -- Spesa (quanto ha pagato il reseller)
  SUM(ppc.billed_amount) AS total_spent,
  AVG(ppc.billed_amount) AS avg_per_shipment,

  -- Margine generato per noi
  SUM(ppc.platform_margin) AS margin_generated,
  AVG(ppc.platform_margin_percent) AS avg_margin_percent,

  -- Trend (vs mese precedente)
  LAG(COUNT(*)) OVER (
    PARTITION BY ppc.billed_user_id
    ORDER BY DATE_TRUNC('month', ppc.created_at)
  ) AS prev_month_shipments

FROM platform_provider_costs ppc
JOIN users u ON u.id = ppc.billed_user_id
WHERE ppc.api_source = 'platform'
GROUP BY
  DATE_TRUNC('month', ppc.created_at),
  ppc.billed_user_id,
  u.email,
  u.name
ORDER BY month DESC, total_spent DESC;
```

---

### Financial Alerts

#### Alert Margini Negativi

**View:** `v_platform_margin_alerts`

```sql
CREATE OR REPLACE VIEW v_platform_margin_alerts AS
SELECT
  ppc.id,
  ppc.shipment_id,
  ppc.shipment_tracking_number,
  ppc.created_at,
  ppc.billed_user_id,
  u.email AS user_email,
  ppc.courier_code,
  ppc.billed_amount,
  ppc.provider_cost,
  ppc.platform_margin,
  ppc.platform_margin_percent,
  ppc.cost_source,
  ppc.reconciliation_status
FROM platform_provider_costs ppc
JOIN users u ON u.id = ppc.billed_user_id
WHERE ppc.api_source = 'platform'
  AND (
    ppc.platform_margin < 0  -- Margine negativo
    OR ppc.reconciliation_status = 'discrepancy'  -- Discrepanza riconciliazione
  )
ORDER BY ppc.created_at DESC;
```

#### Alert Automatico

**File:** `supabase/migrations/090_platform_provider_costs.sql`

La funzione `record_platform_provider_cost()` genera automaticamente un alert se il margine è negativo:

```sql
-- Log se margine negativo (alert automatico)
IF p_billed_amount < p_provider_cost THEN
  INSERT INTO financial_audit_log (
    event_type,
    shipment_id,
    user_id,
    amount,
    metadata
  )
  VALUES (
    'margin_alert',
    p_shipment_id,
    p_billed_user_id,
    p_billed_amount - p_provider_cost,
    jsonb_build_object(
      'billed_amount', p_billed_amount,
      'provider_cost', p_provider_cost,
      'alert', 'NEGATIVE_MARGIN'
    )
  );
END IF;
```

---

### Reconciliation

#### Stato Riconciliazione

I record in `platform_provider_costs` hanno un campo `reconciliation_status`:

- **`pending`** - Non ancora riconciliato con fattura corriere
- **`matched`** - Riconciliato con fattura (importo corrisponde)
- **`discrepancy`** - Discrepanza tra costo registrato e fattura
- **`resolved`** - Discrepanza risolta manualmente

#### View Riconciliazione Pending

**View:** `v_reconciliation_pending`

```sql
CREATE OR REPLACE VIEW v_reconciliation_pending AS
SELECT
  ppc.id,
  ppc.shipment_id,
  ppc.shipment_tracking_number,
  ppc.created_at,
  ppc.courier_code,
  ppc.provider_cost,
  ppc.reconciliation_status,
  ppc.reconciliation_notes
FROM platform_provider_costs ppc
WHERE ppc.api_source = 'platform'
  AND ppc.reconciliation_status IN ('pending', 'discrepancy')
ORDER BY ppc.created_at DESC;
```

#### Processo Riconciliazione

1. **Admin carica fattura corriere** (CSV/PDF)
2. **Sistema matcha tracking numbers** con `platform_provider_costs`
3. **Sistema verifica importi:**
   - Se corrispondono → `reconciliation_status = 'matched'`
   - Se non corrispondono → `reconciliation_status = 'discrepancy'`
4. **Admin risolve discrepanze** manualmente → `reconciliation_status = 'resolved'`

---

### Integration con Creazione Spedizione

#### Flow Completo

**File:** `lib/shipments/create-shipment-core.ts`

```typescript
// 1. Determina API source
const apiSourceResult = await determineApiSource(supabaseAdmin, {
  userId: targetId,
  priceListId: validated.priceListId,
  courierCode: validated.carrier,
});

// 2. Calcola provider cost (solo se api_source = 'platform')
if (apiSourceResult.apiSource === 'platform') {
  const providerCostResult = await calculateProviderCost(supabaseAdmin, {
    courierCode: validated.carrier,
    weight: validated.packages[0]?.weight || 1,
    destination: {
      zip: validated.recipient.postalCode,
      province: validated.recipient.province,
      country: validated.recipient.country || 'IT',
    },
    masterPriceListId: apiSourceResult.masterPriceListId,
  });

  // 3. Registra costo piattaforma (NON blocca se fallisce)
  await recordPlatformCost(supabaseAdmin, {
    shipmentId: shipment.id,
    trackingNumber: courierResponse.trackingNumber,
    billedUserId: targetId,
    billedAmount: finalCost,
    providerCost: providerCostResult.cost,
    apiSource: apiSourceResult.apiSource,
    courierCode: validated.carrier,
    costSource: providerCostResult.source,
  });
}
```

**⚠️ IMPORTANTE:** La registrazione del costo NON deve mai bloccare la creazione della spedizione (graceful degradation).

---

## Examples

### Query P&L Giornaliero

```sql
-- P&L ultimi 7 giorni
SELECT * FROM v_platform_daily_pnl
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC, courier_code;
```

### Query P&L Mensile

```sql
-- P&L ultimi 3 mesi
SELECT * FROM v_platform_monthly_pnl
WHERE month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')
ORDER BY month DESC;
```

### Query Alert Margini

```sql
-- Alert margini negativi ultimi 30 giorni
SELECT * FROM v_platform_margin_alerts
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY platform_margin ASC;
```

### Registrare Costo (TypeScript)

```typescript
// Durante creazione spedizione
import { recordPlatformCost } from '@/lib/shipments/platform-cost-recorder';

await recordPlatformCost(supabaseAdmin, {
  shipmentId: shipment.id,
  trackingNumber: courierResponse.trackingNumber,
  billedUserId: context.target.id,
  billedAmount: finalCost,
  providerCost: providerCostResult.cost,
  apiSource: 'platform',
  courierCode: validated.carrier,
  costSource: 'api_realtime',
});
```

---

## Common Issues

| Issue                         | Soluzione                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| Costo non registrato          | Verifica che `api_source = 'platform'`, controlla log errori (non blocca spedizione) |
| Margine negativo              | Verifica listino master, controlla calcolo provider_cost, verifica alert             |
| P&L view vuota                | Verifica che spedizioni abbiano `api_source = 'platform'`, controlla RLS             |
| Reconciliation fallisce       | Verifica matching tracking numbers, controlla importi fattura                        |
| Cost source sempre 'estimate' | Verifica che master price list esista, controlla API corriere disponibile            |

---

## Related Documentation

- [Money Flows](../MONEY_FLOWS.md) - Flussi finanziari completi
- [Shipments Feature](SHIPMENTS.md) - Integrazione tracking durante creazione spedizione
- [Price Lists Feature](PRICE_LISTS.md) - Listini master e calcolo costi
- [Database Architecture](../2-ARCHITECTURE/DATABASE.md) - Struttura tabelle platform_provider_costs

---

## Changelog

| Date       | Version | Changes                                                               | Author   |
| ---------- | ------- | --------------------------------------------------------------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version - Platform Costs, P&L Views, Cost Calculation, Alerts | AI Agent |

---

_Last Updated: 2026-01-12_  
_Status: 🟢 Active_  
_Maintainer: Engineering Team_
