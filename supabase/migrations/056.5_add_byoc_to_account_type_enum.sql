-- ============================================
-- MIGRATION: 056.5_add_byoc_to_account_type_enum.sql
-- DESCRIZIONE: Aggiunge valore 'byoc' all'enum account_type per supportare utenti BYOC
-- DATA: 2026-01 (Listini Fornitore - Fase 2)
-- 
-- ⚠️ IMPORTANTE: Questa migration DEVE essere eseguita PRIMA della 057.
-- PostgreSQL non permette di usare un nuovo valore enum nella stessa transazione
-- in cui viene aggiunto. Quindi:
-- 1. Esegui PRIMA questa migration (056.5) per aggiungere 'byoc' all'enum
-- 2. Poi esegui la migration 057 per aggiornare le RLS Policies
-- ============================================

-- ============================================
-- STEP 1: Aggiungi 'byoc' all'enum account_type
-- ============================================

DO $$ 
BEGIN
  -- Verifica se 'byoc' esiste già nell'enum
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'byoc' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'account_type')
  ) THEN
    -- Aggiungi 'byoc' all'enum account_type
    ALTER TYPE account_type ADD VALUE 'byoc';
    RAISE NOTICE '✅ Aggiunto valore "byoc" all''enum account_type';
  ELSE
    RAISE NOTICE '⚠️ Valore "byoc" già presente nell''enum account_type';
  END IF;
END $$;

-- ============================================
-- STEP 2: Verifica valori enum
-- ============================================

DO $$
DECLARE
  v_enum_values TEXT;
BEGIN
  -- Lista tutti i valori dell'enum
  SELECT string_agg(enumlabel::text, ', ' ORDER BY enumsortorder)
  INTO v_enum_values
  FROM pg_enum
  WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'account_type');
  
  RAISE NOTICE 'Valori enum account_type: %', v_enum_values;
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 056.5 completata con successo';
  RAISE NOTICE '✅ Valore "byoc" aggiunto all''enum account_type';
  RAISE NOTICE '';
  RAISE NOTICE 'Ora è possibile usare account_type = ''byoc'' per:';
  RAISE NOTICE '  - Utenti BYOC (Bring Your Own Courier)';
  RAISE NOTICE '  - RLS Policies per listini fornitore';
  RAISE NOTICE '  - Server Actions per gestione listini';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ PROSSIMO STEP: Esegui la migration 057 per aggiornare le RLS Policies';
  RAISE NOTICE '========================================';
END $$;

