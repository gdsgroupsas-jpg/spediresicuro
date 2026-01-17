-- ============================================
-- TEST QUERIES: Reseller Pricing Governance
-- ============================================

-- TEST 1: Verifica tabella creata correttamente
SELECT 'TEST 1: Tabella reseller_pricing_policies' AS test;
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'reseller_pricing_policies'
ORDER BY ordinal_position;

-- TEST 2: Verifica RLS policies attive
SELECT 'TEST 2: RLS Policies' AS test;
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'reseller_pricing_policies';

-- TEST 3: Verifica config su custom lists (dovrebbe essere vuoto inizialmente)
SELECT 'TEST 3: Config su Custom Lists' AS test;
SELECT
  pl.id,
  pl.name,
  pl.list_type,
  splc.carrier_code,
  splc.insurance_config,
  splc.cod_config,
  splc.accessory_services_config
FROM price_lists pl
LEFT JOIN supplier_price_list_config splc ON splc.price_list_id = pl.id
WHERE pl.list_type = 'custom'
LIMIT 5;

-- TEST 4: Verifica policies attive (dovrebbe essere vuoto inizialmente)
SELECT 'TEST 4: Policies Attive' AS test;
SELECT
  rpp.id,
  u.email AS reseller_email,
  rpp.enforce_limits,
  rpp.min_markup_percent,
  rpp.created_at,
  rpp.notes
FROM reseller_pricing_policies rpp
JOIN users u ON u.id = rpp.reseller_id
WHERE rpp.revoked_at IS NULL;

-- TEST 5: Simula creazione policy test (DRY RUN - non esegue)
SELECT 'TEST 5: Simulazione Policy Creation' AS test;
SELECT
  'INSERT INTO reseller_pricing_policies (reseller_id, enforce_limits, min_markup_percent, notes) VALUES (''reseller-uuid'', true, 10, ''Test policy'')' AS query_example;

-- TEST 6: Verifica constraint check funziona
SELECT 'TEST 6: Constraint Check (0-100%)' AS test;
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'reseller_pricing_policies'::regclass
  AND contype = 'c'; -- check constraints

-- TEST 7: Count custom lists che potrebbero avere config
SELECT 'TEST 7: Custom Lists Eligible' AS test;
SELECT
  COUNT(DISTINCT pl.id) AS total_custom_lists,
  COUNT(DISTINCT splc.carrier_code) AS unique_carriers,
  COUNT(CASE WHEN splc.carrier_code IS NOT NULL THEN 1 END) AS with_carrier_code
FROM price_lists pl
LEFT JOIN supplier_price_list_config splc ON splc.price_list_id = pl.id
WHERE pl.list_type = 'custom';

-- TEST 8: Verifica unique index parziale funziona
SELECT 'TEST 8: Unique Index Verification' AS test;
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'reseller_pricing_policies'
  AND indexname LIKE '%reseller_active%';

-- ============================================
-- SUMMARY
-- ============================================
SELECT 'SUMMARY: Sistema pronto per test manuali' AS status;
SELECT
  'Migration 112 deployed' AS step_1,
  'RLS policies active' AS step_2,
  'Ready for policy creation' AS step_3;
