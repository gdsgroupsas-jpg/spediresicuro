-- ============================================
-- Script: Audit VAT Baseline (FASE 0.1)
-- Obiettivo: Verificare stato attuale prima di implementare VAT semantics
-- ============================================

-- Verifica quanti listini esistono per tipo
SELECT 
  list_type,
  COUNT(*) as total,
  COUNT(CASE WHEN metadata IS NULL OR metadata = '{}'::jsonb THEN 1 END) as no_metadata,
  COUNT(CASE WHEN source_metadata IS NULL OR source_metadata = '{}'::jsonb THEN 1 END) as no_source_metadata
FROM price_lists
GROUP BY list_type
ORDER BY list_type;

-- Verifica spedizioni esistenti (baseline)
SELECT 
  COUNT(*) as total_shipments,
  COUNT(CASE WHEN final_price IS NOT NULL THEN 1 END) as with_final_price,
  COUNT(CASE WHEN total_cost IS NOT NULL THEN 1 END) as with_total_cost,
  MIN(created_at) as oldest_shipment,
  MAX(created_at) as newest_shipment
FROM shipments
WHERE deleted = false;

-- Verifica se colonne VAT già esistono (per sicurezza)
SELECT 
  table_name,
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('price_lists', 'shipments')
  AND column_name IN ('vat_mode', 'vat_rate')
ORDER BY table_name, column_name;

-- Riepilogo
DO $$
DECLARE
  price_lists_count INTEGER;
  shipments_count INTEGER;
  vat_columns_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO price_lists_count FROM price_lists;
  SELECT COUNT(*) INTO shipments_count FROM shipments WHERE deleted = false;
  SELECT COUNT(*) INTO vat_columns_count 
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('price_lists', 'shipments')
    AND column_name IN ('vat_mode', 'vat_rate');
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 BASELINE VAT SEMANTICS AUDIT';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Listini totali: %', price_lists_count;
  RAISE NOTICE 'Spedizioni attive: %', shipments_count;
  RAISE NOTICE 'Colonne VAT esistenti: %', vat_columns_count;
  RAISE NOTICE '';
  IF vat_columns_count = 0 THEN
    RAISE NOTICE '✅ Nessuna colonna VAT esistente - Pronto per implementazione';
  ELSE
    RAISE NOTICE '⚠️ Colonne VAT già esistenti - Verificare prima di procedere';
  END IF;
  RAISE NOTICE '========================================';
END $$;
