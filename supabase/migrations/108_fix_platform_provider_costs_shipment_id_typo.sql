-- ============================================
-- MIGRATION: 108_fix_platform_provider_costs_shipment_id_typo.sql
-- DESCRIZIONE: Fix errore di battitura nel nome della colonna (se presente)
-- DATA: 2026-01-16
-- CRITICITÀ: P0 - FIX ERRORE MIGRATION 090
-- ============================================
--
-- PROBLEMA:
-- Se la migration 090 ha creato la colonna come `shipent_id` (manca la "m")
-- invece di `shipment_id`, questo causa errori nelle viste finanziarie
--
-- SOLUZIONE:
-- Rinominare la colonna `shipent_id` in `shipment_id` (se esiste)
-- Idempotente: se la colonna è già corretta, non fa nulla
--
-- ============================================

-- ============================================
-- Verifica e correzione (idempotente)
-- ============================================

DO $$
DECLARE
  col_exists BOOLEAN;
  wrong_col_exists BOOLEAN;
BEGIN
  -- Verifica se la colonna corretta esiste
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'platform_provider_costs' 
    AND column_name = 'shipment_id'
  ) INTO col_exists;
  
  -- Verifica se la colonna sbagliata esiste
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'platform_provider_costs' 
    AND column_name = 'shipent_id'
  ) INTO wrong_col_exists;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 VERIFICA STATO COLONNE:';
  RAISE NOTICE '   shipment_id (corretta): %', col_exists;
  RAISE NOTICE '   shipent_id (sbagliata): %', wrong_col_exists;
  RAISE NOTICE '';
  
  IF col_exists AND NOT wrong_col_exists THEN
    RAISE NOTICE '✅ La colonna è già corretta. Nessuna azione necessaria.';
    RAISE NOTICE '========================================';
    RETURN;
  END IF;
  
  IF NOT col_exists AND NOT wrong_col_exists THEN
    RAISE EXCEPTION '❌ ERRORE: Né shipment_id né shipent_id trovati nella tabella platform_provider_costs!';
  END IF;
  
  IF wrong_col_exists THEN
    RAISE NOTICE '⚠️  Trovata colonna sbagliata. Procedo con la correzione...';
  END IF;
END $$;

-- ============================================
-- Correggi nome colonna (solo se necessario)
-- ============================================

-- ALTER TABLE non può essere dentro DO $$, quindi usiamo EXECUTE
DO $$
BEGIN
  -- Verifica se esiste shipent_id e non esiste shipment_id
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'platform_provider_costs' 
    AND column_name = 'shipent_id'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'platform_provider_costs' 
    AND column_name = 'shipment_id'
  ) THEN
    -- Rinomina usando EXECUTE
    EXECUTE 'ALTER TABLE platform_provider_costs RENAME COLUMN shipent_id TO shipment_id';
    RAISE NOTICE '✅ Colonna rinominata: shipent_id → shipment_id';
  ELSE
    RAISE NOTICE 'ℹ️  Nessuna correzione necessaria.';
  END IF;
END $$;

-- ============================================
-- Verifica finale
-- ============================================

DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  -- Verifica che la colonna corretta esiste ora
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'platform_provider_costs' 
    AND column_name = 'shipment_id'
  ) INTO col_exists;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ VERIFICA FINALE:';
  RAISE NOTICE '   shipment_id esiste: %', col_exists;
  RAISE NOTICE '';
  
  IF col_exists THEN
    RAISE NOTICE '✅ SUCCESSO: Colonna corretta e funzionante!';
    RAISE NOTICE '';
    RAISE NOTICE '📈 ORA PUOI APPLICARE LA MIGRATION 101';
    RAISE NOTICE '   supabase/migrations/101_exclude_test_shipments_from_pnl_views.sql';
  ELSE
    RAISE EXCEPTION '❌ ERRORE: shipment_id non trovata dopo correzione!';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;
