-- ============================================
-- Migration: 090 - Populate Reseller Tier
-- Description: Popola reseller_tier per tutti i reseller esistenti
-- Date: 2025-01-07
-- Phase: 3 - Reseller Tier System
-- ============================================

-- Popola reseller_tier per tutti i reseller esistenti
-- Calcola da numero sub-users attuale
-- Idempotente: aggiorna solo se reseller_tier IS NULL
UPDATE users u
SET reseller_tier = CASE
  WHEN sub_count < 10 THEN 'small'::reseller_tier
  WHEN sub_count <= 100 THEN 'medium'::reseller_tier
  ELSE 'enterprise'::reseller_tier
END
FROM (
  SELECT 
    parent_id,
    COUNT(*) as sub_count
  FROM users
  WHERE parent_id IS NOT NULL
    AND is_reseller = false
  GROUP BY parent_id
) sub_counts
WHERE u.id = sub_counts.parent_id
  AND u.is_reseller = true
  AND u.reseller_tier IS NULL; -- Solo se NULL (idempotenza)

-- Verifica popolamento
DO $$
DECLARE
  v_total_resellers INTEGER;
  v_resellers_with_tier INTEGER;
  v_resellers_without_tier INTEGER;
BEGIN
  -- Conta reseller totali
  SELECT COUNT(*) INTO v_total_resellers
  FROM users
  WHERE is_reseller = true;
  
  -- Conta reseller con tier popolato
  SELECT COUNT(*) INTO v_resellers_with_tier
  FROM users
  WHERE is_reseller = true
    AND reseller_tier IS NOT NULL;
  
  -- Conta reseller senza tier
  SELECT COUNT(*) INTO v_resellers_without_tier
  FROM users
  WHERE is_reseller = true
    AND reseller_tier IS NULL;
  
  RAISE NOTICE '📊 Migration 090 - Statistiche popolamento:';
  RAISE NOTICE '   Reseller totali: %', v_total_resellers;
  RAISE NOTICE '   Reseller con tier: %', v_resellers_with_tier;
  RAISE NOTICE '   Reseller senza tier: %', v_resellers_without_tier;
  
  IF v_resellers_without_tier = 0 AND v_total_resellers > 0 THEN
    RAISE NOTICE '✅ Migration 090 completata: tutti i reseller hanno tier popolato';
  ELSIF v_total_resellers = 0 THEN
    RAISE NOTICE 'ℹ️ Migration 090: nessun reseller trovato (normale se database vuoto)';
  ELSE
    RAISE WARNING '⚠️ Migration 090: % reseller senza tier dopo popolamento', v_resellers_without_tier;
  END IF;
END $$;

-- Verifica distribuzione tier
DO $$
DECLARE
  v_small_count INTEGER;
  v_medium_count INTEGER;
  v_enterprise_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_small_count
  FROM users
  WHERE is_reseller = true AND reseller_tier = 'small';
  
  SELECT COUNT(*) INTO v_medium_count
  FROM users
  WHERE is_reseller = true AND reseller_tier = 'medium';
  
  SELECT COUNT(*) INTO v_enterprise_count
  FROM users
  WHERE is_reseller = true AND reseller_tier = 'enterprise';
  
  RAISE NOTICE '📊 Distribuzione tier:';
  RAISE NOTICE '   Small: %', v_small_count;
  RAISE NOTICE '   Medium: %', v_medium_count;
  RAISE NOTICE '   Enterprise: %', v_enterprise_count;
END $$;
