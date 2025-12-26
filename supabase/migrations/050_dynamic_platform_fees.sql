-- ============================================
-- MIGRATION: 050_dynamic_platform_fees.sql
-- DESCRIZIONE: Abilita platform fee dinamiche per utente + audit trail
-- DATA: 2025-12-26
-- CRITICITÀ: P1 - BUSINESS / REVENUE
-- ============================================
--
-- OBIETTIVO:
-- Permettere fee di piattaforma personalizzate per utente.
-- Default: €0.50 per spedizione.
-- Override: valore custom per utente specifico.
--
-- FEATURES:
-- 1. Colonne platform_fee_override e platform_fee_notes su users
-- 2. Tabella audit platform_fee_history per tracciabilità
-- 3. Funzione get_platform_fee() per recupero fee
-- 4. Trigger automatico per audit changes
-- 5. RLS: solo SUPERADMIN può vedere history
--
-- RIFERIMENTI:
-- - Pricing configurabile per cliente
-- - Compliance e tracciabilità modifiche
-- ============================================

-- ============================================
-- STEP 1: Estendi tabella users con colonne fee
-- ============================================

DO $$
BEGIN
  -- Colonna platform_fee_override (NULL = usa default)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'platform_fee_override'
  ) THEN
    ALTER TABLE users
    ADD COLUMN platform_fee_override DECIMAL(10,2) DEFAULT NULL;
    
    COMMENT ON COLUMN users.platform_fee_override IS 
    'Fee di piattaforma personalizzata per utente. NULL = usa default (€0.50)';
    
    RAISE NOTICE '✅ Aggiunta colonna: users.platform_fee_override';
  ELSE
    RAISE NOTICE '⚠️ Colonna users.platform_fee_override già esistente';
  END IF;

  -- Colonna platform_fee_notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'platform_fee_notes'
  ) THEN
    ALTER TABLE users
    ADD COLUMN platform_fee_notes TEXT DEFAULT NULL;
    
    COMMENT ON COLUMN users.platform_fee_notes IS 
    'Note sulla fee personalizzata (es. motivo sconto, accordo commerciale)';
    
    RAISE NOTICE '✅ Aggiunta colonna: users.platform_fee_notes';
  ELSE
    RAISE NOTICE '⚠️ Colonna users.platform_fee_notes già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 2: Vincolo di validazione (fee >= 0)
-- ============================================

DO $$
BEGIN
  -- Verifica se il constraint esiste già
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_platform_fee_positive'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT check_platform_fee_positive
    CHECK (
      platform_fee_override IS NULL OR platform_fee_override >= 0
    );
    
    RAISE NOTICE '✅ Aggiunto constraint: check_platform_fee_positive';
  ELSE
    RAISE NOTICE '⚠️ Constraint check_platform_fee_positive già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 3: Tabella audit platform_fee_history
-- ============================================

CREATE TABLE IF NOT EXISTS platform_fee_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Riferimento utente
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Fee prima e dopo
  old_fee DECIMAL(10,2),
  new_fee DECIMAL(10,2) NOT NULL,
  
  -- Contesto modifica
  notes TEXT,
  
  -- Chi ha modificato
  changed_by UUID NOT NULL REFERENCES users(id),
  
  -- Quando
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indici per query frequenti
CREATE INDEX IF NOT EXISTS idx_platform_fee_history_user_id
  ON platform_fee_history(user_id);

CREATE INDEX IF NOT EXISTS idx_platform_fee_history_changed_at
  ON platform_fee_history(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_fee_history_changed_by
  ON platform_fee_history(changed_by);

-- Commenti
COMMENT ON TABLE platform_fee_history IS 
'Audit trail delle modifiche alle platform fee per utente. Traccia chi, cosa, quando.';

COMMENT ON COLUMN platform_fee_history.old_fee IS 
'Fee precedente (NULL se prima modifica o era default)';

COMMENT ON COLUMN platform_fee_history.new_fee IS 
'Nuova fee impostata';

COMMENT ON COLUMN platform_fee_history.changed_by IS 
'UUID del SUPERADMIN che ha effettuato la modifica';

-- ============================================
-- STEP 4: Funzione get_platform_fee()
-- ============================================

CREATE OR REPLACE FUNCTION get_platform_fee(p_user_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_fee DECIMAL(10,2);
  v_default_fee CONSTANT DECIMAL(10,2) := 0.50;
BEGIN
  -- Recupera fee override per l'utente
  SELECT platform_fee_override
  INTO v_user_fee
  FROM users
  WHERE id = p_user_id;
  
  -- Utente non trovato: errore
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id
      USING ERRCODE = 'no_data_found';
  END IF;
  
  -- Ritorna fee custom se presente, altrimenti default
  RETURN COALESCE(v_user_fee, v_default_fee);
END;
$$;

COMMENT ON FUNCTION get_platform_fee(UUID) IS 
'Ritorna la platform fee per un utente. Override se impostato, altrimenti default €0.50.';

-- ============================================
-- STEP 5: Trigger per audit automatico
-- ============================================

CREATE OR REPLACE FUNCTION audit_platform_fee_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Logga solo se platform_fee_override è effettivamente cambiato
  IF (OLD.platform_fee_override IS DISTINCT FROM NEW.platform_fee_override) THEN
    INSERT INTO platform_fee_history (
      user_id,
      old_fee,
      new_fee,
      notes,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.platform_fee_override,
      COALESCE(NEW.platform_fee_override, 0.50), -- Log il valore effettivo
      NEW.platform_fee_notes,
      COALESCE(auth.uid(), NEW.id) -- Fallback a user stesso se no auth context
    );
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION audit_platform_fee_change() IS 
'Trigger function che registra le modifiche a platform_fee_override in platform_fee_history.';

-- Rimuovi trigger esistente se presente
DROP TRIGGER IF EXISTS trigger_audit_platform_fee ON users;

-- Crea trigger
CREATE TRIGGER trigger_audit_platform_fee
AFTER UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION audit_platform_fee_change();

-- ============================================
-- STEP 6: RLS su platform_fee_history
-- ============================================

ALTER TABLE platform_fee_history ENABLE ROW LEVEL SECURITY;

-- Drop policy esistente se presente
DROP POLICY IF EXISTS "SuperAdmin can view fee history" ON platform_fee_history;

-- Solo SUPERADMIN può vedere la history
CREATE POLICY "SuperAdmin can view fee history"
ON platform_fee_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND (
      users.account_type = 'superadmin'
      OR users.role::text = 'admin' -- Fallback per vecchio sistema ruoli
    )
  )
);

-- Nessuna policy INSERT/UPDATE/DELETE per utenti normali
-- Solo SECURITY DEFINER functions e service_role possono scrivere

COMMENT ON POLICY "SuperAdmin can view fee history" ON platform_fee_history IS 
'Solo SUPERADMIN possono visualizzare lo storico delle fee.';

-- ============================================
-- STEP 7: Funzione helper per aggiornare fee (uso interno)
-- ============================================

CREATE OR REPLACE FUNCTION update_user_platform_fee(
  p_target_user_id UUID,
  p_new_fee DECIMAL(10,2),
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_is_superadmin BOOLEAN;
BEGIN
  -- Ottieni caller ID
  v_caller_id := auth.uid();
  
  -- Verifica che il caller sia SUPERADMIN
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = v_caller_id
    AND (account_type = 'superadmin' OR role::text = 'admin')
  ) INTO v_is_superadmin;
  
  IF NOT v_is_superadmin THEN
    RAISE EXCEPTION 'Only SUPERADMIN can update platform fees'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  
  -- Validazione fee
  IF p_new_fee IS NOT NULL AND p_new_fee < 0 THEN
    RAISE EXCEPTION 'Platform fee cannot be negative'
      USING ERRCODE = 'check_violation';
  END IF;
  
  -- Aggiorna utente (il trigger registra l'audit)
  UPDATE users
  SET 
    platform_fee_override = p_new_fee,
    platform_fee_notes = p_notes
  WHERE id = p_target_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_target_user_id
      USING ERRCODE = 'no_data_found';
  END IF;
  
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION update_user_platform_fee(UUID, DECIMAL, TEXT) IS 
'Aggiorna la platform fee per un utente. Solo SUPERADMIN. Audit automatico via trigger.';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 050 completata con successo';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'COLONNE AGGIUNTE A users:';
  RAISE NOTICE '  - platform_fee_override DECIMAL(10,2)';
  RAISE NOTICE '  - platform_fee_notes TEXT';
  RAISE NOTICE '';
  RAISE NOTICE 'CONSTRAINT:';
  RAISE NOTICE '  - check_platform_fee_positive (fee >= 0)';
  RAISE NOTICE '';
  RAISE NOTICE 'TABELLA AUDIT:';
  RAISE NOTICE '  - platform_fee_history';
  RAISE NOTICE '';
  RAISE NOTICE 'FUNZIONI RPC:';
  RAISE NOTICE '  - get_platform_fee(user_id) -> DECIMAL';
  RAISE NOTICE '  - update_user_platform_fee(user_id, fee, notes) -> BOOLEAN';
  RAISE NOTICE '';
  RAISE NOTICE 'TRIGGER:';
  RAISE NOTICE '  - trigger_audit_platform_fee (auto-audit)';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS:';
  RAISE NOTICE '  - Solo SUPERADMIN vede platform_fee_history';
  RAISE NOTICE '';
  RAISE NOTICE '📝 DEFAULT FEE: €0.50 per spedizione';
  RAISE NOTICE '========================================';
END $$;

