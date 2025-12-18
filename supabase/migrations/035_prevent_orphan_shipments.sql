-- ============================================
-- Migration: Prevent Orphan Shipments (Constraint + Trigger)
-- ============================================
-- 
-- ⚠️ SICUREZZA: Impedisce inserimento di shipments orfane
-- 
-- Regola: user_id IS NOT NULL OR created_by_user_email IS NOT NULL
-- (Almeno uno dei due deve essere presente)
-- 
-- ============================================

-- ============================================
-- STEP 1: Rimuovi constraint esistente se presente
-- ============================================

-- Usa DROP CONSTRAINT IF EXISTS (PostgreSQL 9.2+)
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_no_orphan_check;

-- ============================================
-- STEP 2: Aggiungi constraint CHECK
-- ============================================

DO $$
BEGIN
  -- Verifica se constraint esiste già
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'shipments_no_orphan_check'
    AND conrelid = 'shipments'::regclass
  ) THEN
    -- Aggiungi constraint: almeno user_id O created_by_user_email deve essere NOT NULL
    ALTER TABLE shipments
    ADD CONSTRAINT shipments_no_orphan_check
    CHECK (
      user_id IS NOT NULL 
      OR created_by_user_email IS NOT NULL
    );
    
    RAISE NOTICE '✅ Aggiunto constraint: shipments_no_orphan_check';
    RAISE NOTICE '   Regola: user_id IS NOT NULL OR created_by_user_email IS NOT NULL';
  ELSE
    RAISE NOTICE '⚠️ Constraint shipments_no_orphan_check già esistente, skip';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '⚠️ Errore creazione constraint: %', SQLERRM;
END $$;

-- ============================================
-- STEP 3: Crea funzione trigger per validazione pre-insert
-- ============================================

CREATE OR REPLACE FUNCTION prevent_orphan_shipment()
RETURNS TRIGGER AS $$
BEGIN
  -- Verifica: almeno user_id O created_by_user_email deve essere NOT NULL
  IF NEW.user_id IS NULL AND (NEW.created_by_user_email IS NULL OR NEW.created_by_user_email = '') THEN
    RAISE EXCEPTION 'ORPHAN_SHIPMENT_PREVENTED: Shipment non può essere creata senza user_id o created_by_user_email. user_id=%, created_by_user_email=%', 
      NEW.user_id, NEW.created_by_user_email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 4: Crea trigger BEFORE INSERT
-- ============================================

DO $$
BEGIN
  -- Rimuovi trigger se esiste
  DROP TRIGGER IF EXISTS trigger_prevent_orphan_shipment ON shipments;
  
  -- Crea trigger
  CREATE TRIGGER trigger_prevent_orphan_shipment
    BEFORE INSERT ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION prevent_orphan_shipment();
  
  RAISE NOTICE '✅ Creato trigger: trigger_prevent_orphan_shipment';
END $$;

-- ============================================
-- STEP 5: Crea trigger BEFORE UPDATE (per sicurezza)
-- ============================================

DO $$
BEGIN
  -- Rimuovi trigger se esiste
  DROP TRIGGER IF EXISTS trigger_prevent_orphan_shipment_update ON shipments;
  
  -- Crea trigger per UPDATE (previene che qualcuno setta entrambi a null)
  CREATE TRIGGER trigger_prevent_orphan_shipment_update
    BEFORE UPDATE ON shipments
    FOR EACH ROW
    WHEN (
      (NEW.user_id IS NULL AND (NEW.created_by_user_email IS NULL OR NEW.created_by_user_email = ''))
      AND (OLD.user_id IS NOT NULL OR OLD.created_by_user_email IS NOT NULL)
    )
    EXECUTE FUNCTION prevent_orphan_shipment();
  
  RAISE NOTICE '✅ Creato trigger UPDATE: trigger_prevent_orphan_shipment_update';
END $$;

-- ============================================
-- Commenti
-- ============================================

-- Commento constraint (solo se esiste)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'shipments_no_orphan_check'
    AND conrelid = 'shipments'::regclass
  ) THEN
    COMMENT ON CONSTRAINT shipments_no_orphan_check ON shipments IS 
      'Previene shipments orfane: richiede user_id IS NOT NULL OR created_by_user_email IS NOT NULL';
  END IF;
END $$;

COMMENT ON FUNCTION prevent_orphan_shipment() IS 
  'Funzione trigger che previene inserimento/update di shipments orfane (senza user_id e senza created_by_user_email)';

