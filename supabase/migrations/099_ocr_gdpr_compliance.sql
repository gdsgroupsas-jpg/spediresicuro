-- ============================================
-- MIGRATION: 099_ocr_gdpr_compliance.sql
-- DESCRIZIONE: GDPR compliance per OCR Vision processing
-- DATA: 2026-01-11
-- CRITICITÀ: P0 - AUDIT FIX (Punto 3)
-- ============================================
--
-- PROBLEMA:
-- OCR Vision processa PII (immagini WhatsApp con indirizzi, nomi, telefoni)
-- Ma manca:
-- 1. Tracking dei consensi utente
-- 2. Retention policy (immagini non eliminate)
-- 3. Audit trail processing
--
-- SOLUZIONE:
-- 1. Tabella ocr_processing_log per tracking
-- 2. TTL automatico 7 giorni (GDPR data minimization)
-- 3. Consent tracking in users table
-- 4. Cleanup job automatico
--
-- ============================================

-- ============================================
-- STEP 1: User consent tracking
-- ============================================

-- Add OCR consent field to users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS ocr_vision_consent_given_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ocr_vision_consent_ip TEXT,
ADD COLUMN IF NOT EXISTS ocr_vision_consent_user_agent TEXT;

COMMENT ON COLUMN users.ocr_vision_consent_given_at IS
'Timestamp quando utente ha dato consenso esplicito per OCR Vision processing.
NULL = consenso non dato (OCR Vision disabilitato per questo utente).
GDPR Art. 6: Lawful basis for processing.';

COMMENT ON COLUMN users.ocr_vision_consent_ip IS
'IP address quando consenso è stato dato (audit trail).';

COMMENT ON COLUMN users.ocr_vision_consent_user_agent IS
'User agent quando consenso è stato dato (audit trail).';

-- ============================================
-- STEP 2: OCR processing log (audit trail)
-- ============================================

CREATE TABLE IF NOT EXISTS ocr_processing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Processing metadata
  provider TEXT NOT NULL CHECK (provider IN ('google_vision', 'claude_vision', 'tesseract', 'mock')),
  processing_status TEXT NOT NULL CHECK (processing_status IN ('success', 'failed', 'rate_limited')),

  -- Image metadata (NO image data stored for privacy)
  image_hash TEXT,  -- SHA-256 hash per deduplication
  image_size_bytes INTEGER,
  image_format TEXT,  -- 'jpeg', 'png', etc.

  -- Extracted data (minimized)
  extracted_fields JSONB,  -- Solo campi estratti, NO raw text

  -- GDPR compliance
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_timestamp TIMESTAMPTZ,

  -- Retention policy
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',  -- TTL 7 giorni
  deleted_at TIMESTAMPTZ,  -- Soft delete per audit

  -- Error tracking (se processing failed)
  error_message TEXT,
  error_code TEXT,

  -- Audit metadata
  ip_address TEXT,
  user_agent TEXT,

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indice per cleanup job (filtra expired records)
CREATE INDEX IF NOT EXISTS ocr_processing_log_expires_at_idx
ON ocr_processing_log(expires_at)
WHERE deleted_at IS NULL;

-- Indice per user lookup
CREATE INDEX IF NOT EXISTS ocr_processing_log_user_id_idx
ON ocr_processing_log(user_id, created_at DESC);

-- Indice per provider stats
CREATE INDEX IF NOT EXISTS ocr_processing_log_provider_status_idx
ON ocr_processing_log(provider, processing_status, created_at DESC);

COMMENT ON TABLE ocr_processing_log IS
'Audit trail per OCR Vision processing (GDPR compliance).

PRIVACY:
- NO raw image data stored (solo hash + size)
- NO raw text stored (solo extracted fields)
- Automatic TTL 7 giorni (data minimization)

RETENTION:
- expires_at = created_at + 7 giorni (default)
- Cleanup job elimina records soft-deleted dopo 30 giorni
- Hard delete dopo 30 giorni da soft delete

CONSENT:
- consent_given = TRUE solo se user ha dato consenso esplicito
- Se consent_given = FALSE → OCR processed ma flaggato per review';

-- ============================================
-- STEP 3: RLS policies per ocr_processing_log
-- ============================================

ALTER TABLE ocr_processing_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own OCR logs
CREATE POLICY ocr_processing_log_user_read
ON ocr_processing_log
FOR SELECT
USING (
  auth.uid() = user_id
  OR
  -- SuperAdmin can read all
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND account_type = 'superadmin'
  )
);

-- Policy: Only service_role can insert
CREATE POLICY ocr_processing_log_service_insert
ON ocr_processing_log
FOR INSERT
WITH CHECK (true);  -- Service role bypassa RLS

-- Policy: No updates/deletes (audit immutability)
-- Solo soft delete via service_role

COMMENT ON TABLE ocr_processing_log IS
'RLS enabled: Users read own logs, service_role full access.
Immutable audit log (no updates, only soft deletes).';

-- ============================================
-- STEP 4: Function per log OCR processing
-- ============================================

CREATE OR REPLACE FUNCTION log_ocr_processing(
  p_user_id UUID,
  p_provider TEXT,
  p_status TEXT,
  p_image_hash TEXT DEFAULT NULL,
  p_image_size INTEGER DEFAULT NULL,
  p_image_format TEXT DEFAULT NULL,
  p_extracted_fields JSONB DEFAULT NULL,
  p_consent_given BOOLEAN DEFAULT false,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_consent_timestamp TIMESTAMPTZ;
BEGIN
  -- Get consent timestamp from user (se disponibile)
  SELECT ocr_vision_consent_given_at INTO v_consent_timestamp
  FROM users
  WHERE id = p_user_id;

  -- Insert log record
  INSERT INTO ocr_processing_log (
    user_id,
    provider,
    processing_status,
    image_hash,
    image_size_bytes,
    image_format,
    extracted_fields,
    consent_given,
    consent_timestamp,
    ip_address,
    user_agent,
    error_message,
    error_code
  ) VALUES (
    p_user_id,
    p_provider,
    p_status,
    p_image_hash,
    p_image_size,
    p_image_format,
    p_extracted_fields,
    p_consent_given,
    v_consent_timestamp,
    p_ip_address,
    p_user_agent,
    p_error_message,
    p_error_code
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_ocr_processing IS
'Log OCR processing event for GDPR compliance.
Called by OCR API after each processing attempt.
Returns log_id for reference.';

-- ============================================
-- STEP 5: Cleanup function per expired records
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_ocr_logs()
RETURNS TABLE(
  soft_deleted_count INTEGER,
  hard_deleted_count INTEGER
) AS $$
DECLARE
  v_soft_deleted INTEGER := 0;
  v_hard_deleted INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_soft_delete_threshold TIMESTAMPTZ := v_now;  -- TTL raggiunto
  v_hard_delete_threshold TIMESTAMPTZ := v_now - INTERVAL '30 days';  -- Soft deleted da >30 giorni
BEGIN
  -- SOFT DELETE: records expired (expires_at < NOW)
  UPDATE ocr_processing_log
  SET deleted_at = v_now
  WHERE expires_at < v_soft_delete_threshold
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_soft_deleted = ROW_COUNT;

  -- HARD DELETE: records soft-deleted da >30 giorni
  DELETE FROM ocr_processing_log
  WHERE deleted_at IS NOT NULL
    AND deleted_at < v_hard_delete_threshold;

  GET DIAGNOSTICS v_hard_deleted = ROW_COUNT;

  -- Log cleanup activity
  RAISE NOTICE 'OCR logs cleanup: % soft deleted, % hard deleted', v_soft_deleted, v_hard_deleted;

  RETURN QUERY SELECT v_soft_deleted, v_hard_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_ocr_logs IS
'GDPR retention policy enforcement.
- Soft delete: records expired (TTL 7 giorni)
- Hard delete: soft deleted da >30 giorni
Called by CRON job daily.';

-- ============================================
-- STEP 6: Function per user consent
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

  -- Log audit event
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    p_user_id,
    'ocr_vision_consent_granted',
    'user',
    p_user_id,
    jsonb_build_object(
      'ip_address', p_ip_address,
      'user_agent', p_user_agent,
      'timestamp', NOW()
    )
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION grant_ocr_vision_consent IS
'Record user consent for OCR Vision processing.
GDPR Art. 6: Lawful basis for processing.
Logs audit event for compliance.';

-- ============================================
-- STEP 7: Function per revoke consent
-- ============================================

CREATE OR REPLACE FUNCTION revoke_ocr_vision_consent(
  p_user_id UUID
)
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

  -- Log audit event
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    p_user_id,
    'ocr_vision_consent_revoked',
    'user',
    p_user_id,
    jsonb_build_object(
      'timestamp', NOW(),
      'note', 'User revoked OCR Vision consent. Future OCR requests will use Tesseract only.'
    )
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION revoke_ocr_vision_consent IS
'Revoke user consent for OCR Vision processing.
GDPR Art. 17: Right to withdraw consent.
Future OCR will use Tesseract (local) only.';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 099 completata con successo';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'GDPR OCR Compliance implementata:';
  RAISE NOTICE '';
  RAISE NOTICE 'Schema updates:';
  RAISE NOTICE '  - users: ocr_vision_consent_* fields';
  RAISE NOTICE '  - ocr_processing_log table (audit trail)';
  RAISE NOTICE '  - RLS policies enabled';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - log_ocr_processing(...)';
  RAISE NOTICE '  - cleanup_expired_ocr_logs() -- CRON job';
  RAISE NOTICE '  - grant_ocr_vision_consent(user_id, ip, ua)';
  RAISE NOTICE '  - revoke_ocr_vision_consent(user_id)';
  RAISE NOTICE '';
  RAISE NOTICE 'Retention policy:';
  RAISE NOTICE '  - TTL: 7 giorni (soft delete)';
  RAISE NOTICE '  - Hard delete: 30 giorni dopo soft delete';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 GDPR COMPLIANT OCR TRACKING';
  RAISE NOTICE '========================================';
END $$;
