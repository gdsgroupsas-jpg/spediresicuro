-- ============================================
-- MIGRATION: 080_add_reseller_to_account_type_enum.sql
-- DESCRIZIONE: Aggiunge valore 'reseller' all'enum account_type per supportare utenti reseller
-- DATA: 2026-01 (Reseller System Enhancement)
-- 
-- ⚠️ IMPORTANTE: Questa migration aggiunge 'reseller' all'enum account_type.
-- PostgreSQL non permette di usare un nuovo valore enum nella stessa transazione
-- in cui viene aggiunto. Quindi:
-- 1. Esegui questa migration per aggiungere 'reseller' all'enum
-- 2. Poi puoi usare account_type='reseller' nelle query
-- ============================================

-- ============================================
-- STEP 1: Aggiungi 'reseller' all'enum account_type
-- ============================================

DO $$ 
BEGIN
  -- Verifica se 'reseller' esiste già nell'enum
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'reseller' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'account_type')
  ) THEN
    -- Aggiungi 'reseller' all'enum account_type
    ALTER TYPE account_type ADD VALUE 'reseller';
    RAISE NOTICE '✅ Aggiunto valore "reseller" all''enum account_type';
  ELSE
    RAISE NOTICE '⚠️ Valore "reseller" già presente nell''enum account_type';
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
-- STEP 3: Aggiorna commento colonna (opzionale)
-- ============================================

COMMENT ON COLUMN users.account_type IS 'Tipo account: user (base), admin (avanzato), superadmin (gestione completa), byoc (Bring Your Own Carrier), reseller (rivenditore)';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 080 completata con successo';
  RAISE NOTICE '✅ Valore "reseller" aggiunto all''enum account_type';
  RAISE NOTICE '';
  RAISE NOTICE 'Ora è possibile usare account_type = ''reseller'' per:';
  RAISE NOTICE '  - Utenti reseller creati da superadmin';
  RAISE NOTICE '  - Distinzione chiara tra user base e reseller';
  RAISE NOTICE '  - Migliore tracciabilità e reporting';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ NOTA: I reseller devono avere anche is_reseller=true';
  RAISE NOTICE '========================================';
END $$;
