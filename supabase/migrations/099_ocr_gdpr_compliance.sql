-- ============================================
-- MIGRATION: 099_ocr_gdpr_compliance.sql
-- DESCRIZIONE: GDPR compliance per OCR Vision
-- DATA: 2026-01-12
-- CRITICITÀ: P0.3 - GDPR COMPLIANCE
-- ============================================
--
-- SCOPO:
-- Implementa il consent flow GDPR per OCR Vision con:
-- - Tracciamento consent (IP, user agent, timestamp)
-- - Log processing con TTL 7 giorni
-- - RLS per isolamento dati
--
-- ============================================

-- ============================================
-- STEP 1: Aggiungi colonne consent a users
-- ============================================
DO $$
BEGIN
  -- Colonna timestamp consent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'ocr_vision_consent_given_at'
  ) THEN
    ALTER TABLE users ADD COLUMN ocr_vision_consent_given_at TIMESTAMPTZ;
    RAISE NOTICE '✅ Colonna ocr_vision_consent_given_at aggiunta';
  END IF;
  
  -- Colonna IP consent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'ocr_vision_consent_ip'
  ) THEN
    ALTER TABLE users ADD COLUMN ocr_vision_consent_ip TEXT;
    RAISE NOTICE '✅ Colonna ocr_vision_consent_ip aggiunta';
  END IF;
  
  -- Colonna user agent consent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'ocr_vision_consent_user_agent'
  ) THEN
    ALTER TABLE users ADD COLUMN ocr_vision_consent_user_agent TEXT;
    RAISE NOTICE '✅ Colonna ocr_vision_consent_user_agent aggiunta';
  END IF;
END $$;

-- ============================================
-- STEP 2: Crea tabella ocr_processing_log
-- ============================================
CREATE TABLE IF NOT EXISTS ocr_processing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Dettagli processing
  provider TEXT NOT NULL CHECK (provider IN ('google_vision', 'tesseract_local', 'gemini_vision')),
  document_type TEXT NOT NULL,
  
  -- Metadati
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete per GDPR (invece di hard delete)
  soft_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_ocr_processing_log_user_id ON ocr_processing_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_processing_log_processed_at ON ocr_processing_log(processed_at);
CREATE INDEX IF NOT EXISTS idx_ocr_processing_log_soft_deleted ON ocr_processing_log(soft_deleted) WHERE soft_deleted = FALSE;

COMMENT ON TABLE ocr_processing_log IS 
'Log di processing OCR per GDPR compliance. TTL 7 giorni.';

-- ============================================
-- STEP 3: Abilita RLS su ocr_processing_log
-- ============================================
ALTER TABLE ocr_processing_log ENABLE ROW LEVEL SECURITY;

-- Policy: utenti vedono solo i propri log
DROP POLICY IF EXISTS ocr_processing_log_user_policy ON ocr_processing_log;
CREATE POLICY ocr_processing_log_user_policy ON ocr_processing_log
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: service_role può vedere tutto (per admin/cleanup)
DROP POLICY IF EXISTS ocr_processing_log_service_policy ON ocr_processing_log;
CREATE POLICY ocr_processing_log_service_policy ON ocr_processing_log
  FOR ALL
  USING (current_setting('role') = 'service_role');

COMMENT ON POLICY ocr_processing_log_user_policy ON ocr_processing_log IS 
'Utenti possono vedere/modificare solo i propri log OCR';

-- ============================================
-- STEP 4: Function grant_ocr_vision_consent
-- ============================================
CREATE OR REPLACE FUNCTION grant_ocr_vision_consent(
  p_user_id UUID,
  p_ip_address TEXT,
  p_user_agent TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE users
  SET 
    ocr_vision_consent_given_at = NOW(),
    ocr_vision_consent_ip = p_ip_address,
    ocr_vision_consent_user_agent = p_user_agent,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION grant_ocr_vision_consent(UUID, TEXT, TEXT) 
SET search_path = public, pg_temp;

COMMENT ON FUNCTION grant_ocr_vision_consent IS 
'Registra il consent GDPR per OCR Vision con IP, user agent e timestamp.';

-- ============================================
-- STEP 5: Function revoke_ocr_vision_consent
-- ============================================
CREATE OR REPLACE FUNCTION revoke_ocr_vision_consent(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE users
  SET 
    ocr_vision_consent_given_at = NULL,
    ocr_vision_consent_ip = NULL,
    ocr_vision_consent_user_agent = NULL,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
  
  -- Soft-delete tutti i log OCR dell'utente
  UPDATE ocr_processing_log
  SET 
    soft_deleted = TRUE,
    deleted_at = NOW()
  WHERE user_id = p_user_id
  AND soft_deleted = FALSE;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION revoke_ocr_vision_consent(UUID) 
SET search_path = public, pg_temp;

COMMENT ON FUNCTION revoke_ocr_vision_consent IS 
'Revoca il consent GDPR per OCR Vision e soft-delete tutti i log.';

-- ============================================
-- STEP 6: Function log_ocr_processing
-- ============================================
CREATE OR REPLACE FUNCTION log_ocr_processing(
  p_user_id UUID,
  p_provider TEXT,
  p_document_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Verifica consent
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = p_user_id 
    AND ocr_vision_consent_given_at IS NOT NULL
  ) THEN
    RAISE WARNING 'OCR processing logged without explicit consent for user %', p_user_id;
  END IF;
  
  INSERT INTO ocr_processing_log (
    user_id,
    provider,
    document_type,
    metadata,
    processed_at
  ) VALUES (
    p_user_id,
    p_provider,
    p_document_type,
    p_metadata,
    NOW()
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION log_ocr_processing(UUID, TEXT, TEXT, JSONB) 
SET search_path = public, pg_temp;

COMMENT ON FUNCTION log_ocr_processing IS 
'Logga un processing OCR. Avvisa se consent non dato.';

-- ============================================
-- STEP 7: Function cleanup_expired_ocr_logs (TTL 7 giorni)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_ocr_logs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Soft-delete log più vecchi di 7 giorni
  UPDATE ocr_processing_log
  SET 
    soft_deleted = TRUE,
    deleted_at = NOW()
  WHERE processed_at < NOW() - INTERVAL '7 days'
  AND soft_deleted = FALSE;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Opzionale: hard-delete log soft-deleted da più di 30 giorni
  DELETE FROM ocr_processing_log
  WHERE soft_deleted = TRUE
  AND deleted_at < NOW() - INTERVAL '30 days';
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION cleanup_expired_ocr_logs() 
SET search_path = public, pg_temp;

COMMENT ON FUNCTION cleanup_expired_ocr_logs IS 
'Soft-delete log OCR più vecchi di 7 giorni. Hard-delete dopo 30 giorni.
Può essere chiamata da cron job (es. pg_cron).';

-- ============================================
-- COMPLETAMENTO
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 099 completata con successo';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tabelle create:';
  RAISE NOTICE '  - ocr_processing_log';
  RAISE NOTICE '';
  RAISE NOTICE 'Colonne aggiunte a users:';
  RAISE NOTICE '  - ocr_vision_consent_given_at';
  RAISE NOTICE '  - ocr_vision_consent_ip';
  RAISE NOTICE '  - ocr_vision_consent_user_agent';
  RAISE NOTICE '';
  RAISE NOTICE 'Funzioni create:';
  RAISE NOTICE '  - grant_ocr_vision_consent()';
  RAISE NOTICE '  - revoke_ocr_vision_consent()';
  RAISE NOTICE '  - log_ocr_processing()';
  RAISE NOTICE '  - cleanup_expired_ocr_logs()';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 OCR GDPR COMPLIANCE: ATTIVO';
  RAISE NOTICE '   - RLS abilitato su ocr_processing_log';
  RAISE NOTICE '   - TTL 7 giorni per log';
  RAISE NOTICE '========================================';
END $$;
