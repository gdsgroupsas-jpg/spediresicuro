-- ============================================
-- Migration: 089 - Get Reseller Tier Function
-- Description: Crea funzione get_reseller_tier() per calcolo automatico tier
-- Date: 2025-01-07
-- Phase: 3 - Reseller Tier System
-- ============================================

-- Funzione per recuperare tier di un reseller
-- Se tier è NULL, calcola automaticamente da numero sub-users
-- Se tier è già popolato, restituisce quello esistente
-- Se non è reseller, restituisce NULL
CREATE OR REPLACE FUNCTION get_reseller_tier(
  p_user_id UUID
)
RETURNS reseller_tier AS $$
DECLARE
  v_tier reseller_tier;
  v_is_reseller BOOLEAN;
  v_sub_users_count INTEGER;
BEGIN
  -- 1. Verifica se è reseller (gestisce anche utente non esistente)
  SELECT is_reseller INTO v_is_reseller
  FROM users
  WHERE id = p_user_id;
  
  -- Se utente non esiste o non è reseller, restituisce NULL
  -- BUG FIX: Usa IS NULL OR IS NOT TRUE invece di NOT v_is_reseller
  -- perché NOT NULL = NULL (non TRUE), quindi il check falliva
  IF v_is_reseller IS NULL OR v_is_reseller IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  
  -- 2. Recupera tier esistente
  SELECT reseller_tier INTO v_tier
  FROM users
  WHERE id = p_user_id;
  
  -- 3. Se tier è NULL, calcola da numero sub-users
  IF v_tier IS NULL THEN
    SELECT COUNT(*) INTO v_sub_users_count
    FROM users
    WHERE parent_id = p_user_id
      AND is_reseller = false;
    
    -- Determina tier in base a numero sub-users
    -- BUG FIX: Medium: 10-100 (incluso), Enterprise: > 100
    -- Cambiato < 100 in <= 100 per includere esattamente 100 sub-users in medium
    IF v_sub_users_count < 10 THEN
      RETURN 'small'::reseller_tier;
    ELSIF v_sub_users_count <= 100 THEN
      RETURN 'medium'::reseller_tier;
    ELSE
      RETURN 'enterprise'::reseller_tier;
    END IF;
  END IF;
  
  -- 4. Restituisce tier esistente
  RETURN v_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_reseller_tier IS 
  'Recupera tier di un reseller. Calcola automaticamente se tier è NULL basandosi sul numero di sub-users. Restituisce NULL se non è reseller.';

-- Verifica creazione funzione
DO $$
DECLARE
  v_function_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_reseller_tier'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE '✅ Migration 089 completata: funzione get_reseller_tier() creata';
  ELSE
    RAISE WARNING '⚠️ Migration 089: funzione get_reseller_tier() non trovata';
  END IF;
END $$;