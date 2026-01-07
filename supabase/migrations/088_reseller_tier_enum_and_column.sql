-- ============================================
-- Migration: 088 - Reseller Tier Enum and Column
-- Description: Crea enum reseller_tier e aggiunge campo a users
-- Date: 2025-01-07
-- Phase: 3 - Reseller Tier System
-- ============================================

-- 1. Crea enum per reseller_tier
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reseller_tier') THEN
    CREATE TYPE reseller_tier AS ENUM ('small', 'medium', 'enterprise');
    RAISE NOTICE '✅ Creato enum: reseller_tier';
  ELSE
    RAISE NOTICE '⚠️ Enum reseller_tier già esistente';
  END IF;
END $$;

-- 2. Aggiungi campo reseller_tier a users
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'reseller_tier'
  ) THEN
    ALTER TABLE users ADD COLUMN reseller_tier reseller_tier;
    COMMENT ON COLUMN users.reseller_tier IS 
      'Tier del reseller: small (<10 sub-users), medium (10-100), enterprise (>100). NULL per non-reseller.';
    RAISE NOTICE '✅ Aggiunto campo: reseller_tier';
  ELSE
    RAISE NOTICE '⚠️ Campo reseller_tier già esistente';
  END IF;
END $$;

-- 3. Crea indice per performance
CREATE INDEX IF NOT EXISTS idx_users_reseller_tier 
  ON users(reseller_tier) 
  WHERE reseller_tier IS NOT NULL;

COMMENT ON INDEX idx_users_reseller_tier IS 
  'Indice per query rapide su reseller_tier. Solo per valori non NULL.';

-- 4. Verifica creazione
DO $$
DECLARE
  v_enum_exists BOOLEAN;
  v_column_exists BOOLEAN;
  v_index_exists BOOLEAN;
BEGIN
  -- Verifica enum
  SELECT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'reseller_tier'
  ) INTO v_enum_exists;
  
  -- Verifica colonna
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'reseller_tier'
  ) INTO v_column_exists;
  
  -- Verifica indice
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'users' AND indexname = 'idx_users_reseller_tier'
  ) INTO v_index_exists;
  
  IF v_enum_exists AND v_column_exists AND v_index_exists THEN
    RAISE NOTICE '✅ Migration 088 completata: enum, campo e indice creati';
  ELSE
    RAISE WARNING '⚠️ Migration 088: alcuni elementi mancanti (enum: %, colonna: %, indice: %)', 
      v_enum_exists, v_column_exists, v_index_exists;
  END IF;
END $$;
