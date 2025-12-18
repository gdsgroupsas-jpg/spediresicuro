-- ============================================
-- Migration: Remediate Orphan Shipments
-- ============================================
-- 
-- ⚠️ SICUREZZA: Rimuove/archivia shipments orfane (user_id IS NULL AND created_by_user_email IS NULL)
-- 
-- Strategia:
-- 1. Soft delete: setta deleted=true, deleted_at=NOW(), notes con motivo
-- 2. Mantiene i dati per audit ma li marca come eliminati
-- 
-- ============================================

DO $$
DECLARE
  orphan_count INTEGER;
  remediated_count INTEGER;
BEGIN
  -- Conta shipments orfane
  SELECT COUNT(*) INTO orphan_count
  FROM shipments
  WHERE user_id IS NULL
    AND created_by_user_email IS NULL
    AND deleted = false;
  
  RAISE NOTICE '🔍 Trovate % shipments orfane da rimediare', orphan_count;
  
  IF orphan_count > 0 THEN
    -- Soft delete: marca come eliminate con motivo
    UPDATE shipments
    SET 
      deleted = true,
      deleted_at = NOW(),
      notes = COALESCE(notes || E'\n', '') || '[ORPHAN_REMEDIATION] Shipment orfana rimossa: user_id e created_by_user_email entrambi null. Remediated: ' || NOW()::TEXT,
      updated_at = NOW()
    WHERE user_id IS NULL
      AND created_by_user_email IS NULL
      AND deleted = false;
    
    GET DIAGNOSTICS remediated_count = ROW_COUNT;
    
    RAISE NOTICE '✅ Rimediate % shipments orfane (soft delete)', remediated_count;
  ELSE
    RAISE NOTICE '✅ Nessuna shipment orfana trovata';
  END IF;
END $$;

-- ============================================
-- Verifica post-remediation
-- ============================================

DO $$
DECLARE
  remaining_orphans INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_orphans
  FROM shipments
  WHERE user_id IS NULL
    AND created_by_user_email IS NULL
    AND deleted = false;
  
  IF remaining_orphans > 0 THEN
    RAISE WARNING '⚠️ Rimangono % shipments orfane attive dopo remediation', remaining_orphans;
  ELSE
    RAISE NOTICE '✅ Nessuna shipment orfana attiva rimasta';
  END IF;
END $$;

COMMENT ON TABLE shipments IS 'Tabella spedizioni - Orphan remediation: shipments con user_id=null E created_by_user_email=null vengono soft-deleted automaticamente.';

