-- ============================================
-- MIGRATION: 107_exclude_test_shipments_from_pnl_views.sql
-- DESCRIZIONE: Esclude spedizioni di test dalle viste finanziarie
-- DATA: 2026-01-16
-- CRITICITÀ: P0 - FIX DATI FINANZIARI
-- ============================================
--
-- PROBLEMA:
-- Le viste finanziarie (v_platform_*) includono spedizioni di test
-- Questo inquina i dati P&L con shipment falsi (tracking_number='DRY-RUN-TEST', notes='TEST - DA CANCELLARE')
--
-- SOLUZIONE:
-- Aggiungere filtro per escludere spedizioni di test in tutte le viste
-- Criterio: tracking_number NOT LIKE '%TEST%'
--
-- NOTA: È sicuro perché i tracking_number reali non contengono "TEST"
-- Vedi: tests/integration/shipment-lifecycle.test.ts (linea 44)
-- Vedi: scripts/test-accessori-services-completo.ts (linea 301)
--
-- ============================================
-- ============================================
-- VIEW 1: P&L Giornaliero per Corriere
-- ============================================
CREATE OR REPLACE VIEW v_platform_daily_pnl AS
SELECT DATE(ppc.created_at) AS date,
  ppc.courier_code,
  -- Volumi
  COUNT(*) AS shipments_count,
  -- Fatturato (quanto abbiamo incassato dai Reseller)
  SUM(ppc.billed_amount) AS total_billed,
  AVG(ppc.billed_amount) AS avg_billed,
  -- Costi (quanto paghiamo ai corrieri)
  SUM(ppc.provider_cost) AS total_provider_cost,
  AVG(ppc.provider_cost) AS avg_provider_cost,
  -- Margine
  SUM(ppc.platform_margin) AS total_margin,
  AVG(ppc.platform_margin) AS avg_margin,
  AVG(ppc.platform_margin_percent) AS avg_margin_percent,
  -- Alert
  COUNT(*) FILTER (
    WHERE ppc.platform_margin < 0
  ) AS negative_margin_count,
  COUNT(*) FILTER (
    WHERE ppc.reconciliation_status = 'discrepancy'
  ) AS discrepancy_count,
  -- Cost source breakdown
  COUNT(*) FILTER (
    WHERE ppc.cost_source = 'api_realtime'
  ) AS cost_from_api,
  COUNT(*) FILTER (
    WHERE ppc.cost_source = 'master_list'
  ) AS cost_from_list,
  COUNT(*) FILTER (
    WHERE ppc.cost_source IN ('historical_avg', 'estimate')
  ) AS cost_estimated
FROM platform_provider_costs ppc
  JOIN shipments s ON s.id = ppc.shipment_id
WHERE ppc.api_source = 'platform'
  AND s.tracking_number NOT LIKE '%TEST%' -- 🚫 ESCLUDE SPEDIZIONI DI TEST
GROUP BY DATE(ppc.created_at),
  ppc.courier_code
ORDER BY date DESC,
  courier_code;
COMMENT ON VIEW v_platform_daily_pnl IS 'P&L giornaliero per spedizioni con contratti piattaforma, raggruppato per corriere.
   Include metriche: fatturato, costi, margine, alert.
   ⚠️ ESCLUDE spedizioni di test (tracking_number LIKE ''%TEST%'')';
-- ============================================
-- VIEW 2: P&L Mensile Aggregato
-- ============================================
CREATE OR REPLACE VIEW v_platform_monthly_pnl AS
SELECT DATE_TRUNC('month', ppc.created_at)::DATE AS month,
  -- Volumi totali
  COUNT(*) AS total_shipments,
  COUNT(DISTINCT ppc.billed_user_id) AS unique_users,
  COUNT(DISTINCT ppc.courier_code) AS unique_couriers,
  -- Fatturato
  SUM(ppc.billed_amount) AS total_revenue,
  -- Costi
  SUM(ppc.provider_cost) AS total_cost,
  -- Margine
  SUM(ppc.platform_margin) AS gross_margin,
  ROUND(
    (
      SUM(ppc.platform_margin) / NULLIF(SUM(ppc.billed_amount), 0) * 100
    )::numeric,
    2
  ) AS margin_percent_of_revenue,
  ROUND(
    AVG(ppc.platform_margin_percent)::numeric,
    2
  ) AS avg_margin_percent,
  -- Qualità dati
  COUNT(*) FILTER (
    WHERE ppc.cost_source IN ('api_realtime', 'master_list')
  ) AS accurate_cost_count,
  ROUND(
    (
      COUNT(*) FILTER (
        WHERE ppc.cost_source IN ('api_realtime', 'master_list')
      )::DECIMAL / NULLIF(COUNT(*), 0) * 100
    )::numeric,
    1
  ) AS cost_accuracy_percent,
  -- Issues
  COUNT(*) FILTER (
    WHERE ppc.platform_margin < 0
  ) AS negative_margin_count,
  COUNT(*) FILTER (
    WHERE ppc.reconciliation_status = 'discrepancy'
  ) AS unresolved_discrepancies
FROM platform_provider_costs ppc
  JOIN shipments s ON s.id = ppc.shipment_id
WHERE ppc.api_source = 'platform'
  AND s.tracking_number NOT LIKE '%TEST%' -- 🚫 ESCLUDE SPEDIZIONI DI TEST
GROUP BY DATE_TRUNC('month', ppc.created_at)
ORDER BY month DESC;
COMMENT ON VIEW v_platform_monthly_pnl IS 'P&L mensile aggregato per contratti piattaforma.
   Include: revenue, costi, margine, qualità dati, issues.
   ⚠️ ESCLUDE spedizioni di test (tracking_number LIKE ''%TEST%'')';
-- ============================================
-- VIEW 3: Usage Mensile per Reseller
-- ============================================
CREATE OR REPLACE VIEW v_reseller_monthly_platform_usage AS
SELECT DATE_TRUNC('month', ppc.created_at)::DATE AS month,
  -- User info
  ppc.billed_user_id,
  u.email AS user_email,
  u.name AS user_name,
  -- Account info
  CASE
    WHEN u.is_reseller THEN 'reseller'
    WHEN u.account_type = 'byoc' THEN 'byoc'
    ELSE 'standard'
  END AS user_type,
  -- Parent reseller (se sub-user)
  u.parent_reseller_id,
  parent.email AS parent_reseller_email,
  -- Volumi
  COUNT(*) AS shipments_count,
  -- Spesa (quanto ha pagato il reseller/user)
  SUM(ppc.billed_amount) AS total_spent,
  AVG(ppc.billed_amount) AS avg_per_shipment,
  -- Margine generato per noi
  SUM(ppc.platform_margin) AS margin_generated,
  AVG(ppc.platform_margin_percent) AS avg_margin_percent,
  -- Corrieri usati
  ARRAY_AGG(DISTINCT ppc.courier_code) AS couriers_used,
  -- Trend (vs mese precedente)
  LAG(COUNT(*)) OVER (
    PARTITION BY ppc.billed_user_id
    ORDER BY DATE_TRUNC('month', ppc.created_at)
  ) AS prev_month_shipments,
  LAG(SUM(ppc.billed_amount)) OVER (
    PARTITION BY ppc.billed_user_id
    ORDER BY DATE_TRUNC('month', ppc.created_at)
  ) AS prev_month_spent
FROM platform_provider_costs ppc
  JOIN users u ON u.id = ppc.billed_user_id
  JOIN shipments s ON s.id = ppc.shipment_id
  LEFT JOIN users parent ON parent.id = u.parent_reseller_id
WHERE ppc.api_source = 'platform'
  AND s.tracking_number NOT LIKE '%TEST%' -- 🚫 ESCLUDE SPEDIZIONI DI TEST
GROUP BY DATE_TRUNC('month', ppc.created_at),
  ppc.billed_user_id,
  u.email,
  u.name,
  u.is_reseller,
  u.account_type,
  u.parent_reseller_id,
  parent.email
ORDER BY month DESC,
  total_spent DESC;
COMMENT ON VIEW v_reseller_monthly_platform_usage IS 'Usage mensile per ogni reseller/user che usa contratti piattaforma.
   Include: spesa, margine generato, trend vs mese precedente.
   ⚠️ ESCLUDE spedizioni di test (tracking_number LIKE ''%TEST%'')';
-- ============================================
-- VIEW 4: Alert Margini Anomali
-- ============================================
CREATE OR REPLACE VIEW v_platform_margin_alerts AS
SELECT ppc.id,
  ppc.shipment_id,
  ppc.shipment_tracking_number,
  ppc.created_at,
  -- User
  ppc.billed_user_id,
  u.email AS user_email,
  -- Corriere
  ppc.courier_code,
  ppc.service_type,
  -- Importi
  ppc.billed_amount,
  ppc.provider_cost,
  ppc.platform_margin,
  ppc.platform_margin_percent,
  -- Alert type
  CASE
    WHEN ppc.platform_margin < 0 THEN 'NEGATIVE_MARGIN'
    WHEN ppc.platform_margin_percent < 5 THEN 'LOW_MARGIN'
    WHEN ppc.platform_margin_percent > 50 THEN 'HIGH_MARGIN_CHECK'
    ELSE 'UNKNOWN'
  END AS alert_type,
  -- Cost source (se estimate, meno affidabile)
  ppc.cost_source,
  -- Reconciliation status
  ppc.reconciliation_status
FROM platform_provider_costs ppc
  JOIN users u ON u.id = ppc.billed_user_id
  JOIN shipments s ON s.id = ppc.shipment_id
WHERE ppc.api_source = 'platform'
  AND s.tracking_number NOT LIKE '%TEST%' -- 🚫 ESCLUDE SPEDIZIONI DI TEST
  AND (
    ppc.platform_margin < 0 -- Margine negativo (perdiamo soldi)
    OR ppc.platform_margin_percent < 5 -- Margine < 5% (troppo basso)
    OR ppc.platform_margin_percent > 50 -- Margine > 50% (sospetto, verificare)
  )
ORDER BY CASE
    WHEN ppc.platform_margin < 0 THEN 0 -- Priorità massima
    WHEN ppc.platform_margin_percent < 5 THEN 1
    ELSE 2
  END,
  ppc.created_at DESC;
COMMENT ON VIEW v_platform_margin_alerts IS 'Spedizioni con margini anomali: negativi, troppo bassi (< 5%), o troppo alti (> 50%).
   Ordinato per priorità (negativi prima).
   ⚠️ ESCLUDE spedizioni di test (tracking_number LIKE ''%TEST%'')';
-- ============================================
-- VIEW 5: Riconciliazione Pending
-- ============================================
CREATE OR REPLACE VIEW v_reconciliation_pending AS
SELECT ppc.id,
  ppc.shipment_id,
  ppc.shipment_tracking_number,
  ppc.created_at,
  ppc.courier_code,
  -- Importi
  ppc.billed_amount,
  ppc.provider_cost,
  ppc.platform_margin,
  -- Status
  ppc.reconciliation_status,
  ppc.reconciliation_notes,
  -- Provider invoice (se disponibile)
  ppc.provider_invoice_id,
  ppc.provider_invoice_date,
  ppc.provider_invoice_amount,
  -- Discrepanza calcolata
  CASE
    WHEN ppc.provider_invoice_amount IS NOT NULL THEN ppc.provider_invoice_amount - ppc.provider_cost
    ELSE NULL
  END AS invoice_discrepancy,
  -- Età record (giorni da creazione)
  EXTRACT(
    DAY
    FROM NOW() - ppc.created_at
  )::INTEGER AS age_days,
  -- User info
  u.email AS user_email
FROM platform_provider_costs ppc
  JOIN users u ON u.id = ppc.billed_user_id
  JOIN shipments s ON s.id = ppc.shipment_id
WHERE ppc.reconciliation_status IN ('pending', 'discrepancy')
  AND s.tracking_number NOT LIKE '%TEST%' -- 🚫 ESCLUDE SPEDIZIONI DI TEST
ORDER BY CASE
    ppc.reconciliation_status
    WHEN 'discrepancy' THEN 0 -- Priorità: discrepanze prima
    ELSE 1
  END,
  ppc.created_at ASC;
-- FIFO: i più vecchi prima
COMMENT ON VIEW v_reconciliation_pending IS 'Spedizioni in attesa di riconciliazione o con discrepanze.
   Ordinato per priorità (discrepanze prima) e età (FIFO).
   ⚠️ ESCLUDE spedizioni di test (tracking_number LIKE ''%TEST%'')';
-- ============================================
-- VERIFICA FIX
-- ============================================
DO $$
DECLARE cnt INTEGER;
BEGIN -- Verifica che nessuna spedizione di test sia inclusa nelle viste
SELECT COUNT(*) INTO cnt
FROM platform_provider_costs ppc
  JOIN shipments s ON s.id = ppc.shipment_id
WHERE s.tracking_number LIKE '%TEST%'
  AND ppc.api_source = 'platform';
RAISE NOTICE '========================================';
RAISE NOTICE '✅ Migration 101 completata con successo';
RAISE NOTICE '';
RAISE NOTICE '📊 VISTE AGGIORNATE:';
RAISE NOTICE '   1. v_platform_daily_pnl - Esclude test';
RAISE NOTICE '   2. v_platform_monthly_pnl - Esclude test';
RAISE NOTICE '   3. v_reseller_monthly_platform_usage - Esclude test';
RAISE NOTICE '   4. v_platform_margin_alerts - Esclude test';
RAISE NOTICE '   5. v_reconciliation_pending - Esclude test';
RAISE NOTICE '';
RAISE NOTICE '🔍 VERIFICA:';
RAISE NOTICE '   Spedizioni di test trovate: %',
cnt;
RAISE NOTICE '   (Queste spedizioni ESCLUSE dalle viste)';
RAISE NOTICE '';
RAISE NOTICE '⚠️  FILTRO APPLICATO:';
RAISE NOTICE '   tracking_number NOT LIKE TEST pattern';
RAISE NOTICE '';
RAISE NOTICE '📈 USO:';
RAISE NOTICE '   SELECT * FROM v_platform_daily_pnl;';
RAISE NOTICE '   SELECT * FROM v_platform_margin_alerts;';
RAISE NOTICE '';
RAISE NOTICE '========================================';
END $$;