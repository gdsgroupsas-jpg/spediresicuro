/**
 * Unified Audit Logs Schema
 * 
 * Migration: 013 - Audit Logs Unified (replaces original 013)
 * Description: Riconcilia schema audit_logs tra error logging (002) e security audit (013)
 * 
 * CONTEXT:
 * - Migration 002 creò audit_logs per error logging (severity, message, stack_trace)
 * - Migration 013 originale tentava di creare audit_logs per security audit (action, resource_type)
 * - Questa migration UNIFICA i due schemi per supportare ENTRAMBI gli usi
 */

-- ============================================
-- STEP 1: Verifica Stato Attuale
-- ============================================

DO $$
DECLARE
  v_has_severity BOOLEAN;
  v_has_action BOOLEAN;
  v_has_resource_type BOOLEAN;
BEGIN
  -- Check quali colonne esistono
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'severity'
  ) INTO v_has_severity;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'action'
  ) INTO v_has_action;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'resource_type'
  ) INTO v_has_resource_type;
  
  RAISE NOTICE '📊 Schema audit_logs corrente:';
  RAISE NOTICE '   - has_severity: % (error logging schema)', v_has_severity;
  RAISE NOTICE '   - has_action: % (security audit schema)', v_has_action;
  RAISE NOTICE '   - has_resource_type: % (security audit schema)', v_has_resource_type;
END $$;

-- ============================================
-- STEP 2: Aggiungi Colonne Security Audit (se mancanti)
-- ============================================

DO $$
BEGIN
  -- action: Tipo di azione (per security audit)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'action'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN action TEXT;
    RAISE NOTICE '✅ Colonna action aggiunta (nullable per compatibilità)';
  ELSE
    RAISE NOTICE '⚠️ Colonna action già esistente';
  END IF;
  
  -- resource_type: Tipo risorsa (per security audit)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'resource_type'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN resource_type TEXT;
    RAISE NOTICE '✅ Colonna resource_type aggiunta (nullable per compatibilità)';
  ELSE
    RAISE NOTICE '⚠️ Colonna resource_type già esistente';
  END IF;
  
  -- resource_id: ID risorsa (per security audit)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'resource_id'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN resource_id UUID;
    RAISE NOTICE '✅ Colonna resource_id aggiunta (nullable per compatibilità)';
  ELSE
    RAISE NOTICE '⚠️ Colonna resource_id già esistente';
  END IF;
  
  -- user_email: Email utente (per security audit)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'user_email'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN user_email TEXT;
    RAISE NOTICE '✅ Colonna user_email aggiunta (nullable per compatibilità)';
  ELSE
    RAISE NOTICE '⚠️ Colonna user_email già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 3: Aggiungi Colonne Error Logging (se mancanti)
-- ============================================

DO $$
BEGIN
  -- severity: Livello gravità (per error logging)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'severity'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN severity TEXT;
    RAISE NOTICE '✅ Colonna severity aggiunta (nullable per compatibilità)';
  ELSE
    RAISE NOTICE '⚠️ Colonna severity già esistente';
  END IF;
  
  -- message: Messaggio errore (per error logging)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'message'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN message TEXT;
    RAISE NOTICE '✅ Colonna message aggiunta (nullable per compatibilità)';
  ELSE
    RAISE NOTICE '⚠️ Colonna message già esistente';
  END IF;
  
  -- stack_trace: Stack trace (per error logging)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'stack_trace'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN stack_trace TEXT;
    RAISE NOTICE '✅ Colonna stack_trace aggiunta (nullable per compatibilità)';
  ELSE
    RAISE NOTICE '⚠️ Colonna stack_trace già esistente';
  END IF;
  
  -- endpoint: Endpoint API (per error logging)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'endpoint'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN endpoint TEXT;
    RAISE NOTICE '✅ Colonna endpoint aggiunta (nullable per compatibilità)';
  ELSE
    RAISE NOTICE '⚠️ Colonna endpoint già esistente';
  END IF;
  
  -- ip_address: IP address (per error logging)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN ip_address INET;
    RAISE NOTICE '✅ Colonna ip_address aggiunta (nullable per compatibilità)';
  ELSE
    RAISE NOTICE '⚠️ Colonna ip_address già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 4: Crea Indici (idempotenti)
-- ============================================

-- Indici per security audit
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action) WHERE action IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id) WHERE resource_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email ON public.audit_logs(user_email) WHERE user_email IS NOT NULL;

-- Indici per error logging
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs(severity) WHERE severity IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_endpoint ON public.audit_logs(endpoint) WHERE endpoint IS NOT NULL;

-- Indici comuni
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================
-- STEP 5: RLS (se non già abilitato)
-- ============================================

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop policy esistente se c'è (per ricrearla corretta)
DROP POLICY IF EXISTS audit_logs_admin_access ON public.audit_logs;

-- Policy: Solo admin possono vedere i log
CREATE POLICY audit_logs_admin_access ON public.audit_logs
  FOR ALL
  USING (
    -- SuperAdmin vede tutto
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND (users.account_type = 'superadmin' OR users.role = 'admin')
    )
    OR
    -- Utente vede solo i propri log
    auth.uid() = user_id
  );

-- ============================================
-- STEP 6: Commenti Schema Unificato
-- ============================================

COMMENT ON TABLE public.audit_logs IS 
  'Unified audit logs: error logging (severity, message) + security audit (action, resource_type)';

COMMENT ON COLUMN public.audit_logs.action IS 
  'Security audit: Tipo di azione (credential_viewed, impersonation_started, etc.)';
  
COMMENT ON COLUMN public.audit_logs.resource_type IS 
  'Security audit: Tipo risorsa (courier_config, impersonation, shipment, etc.)';
  
COMMENT ON COLUMN public.audit_logs.resource_id IS 
  'Security audit: ID risorsa interessata';
  
COMMENT ON COLUMN public.audit_logs.user_email IS 
  'Security audit: Email utente che ha eseguito azione';
  
COMMENT ON COLUMN public.audit_logs.severity IS 
  'Error logging: Livello gravità (info, warning, error, critical)';
  
COMMENT ON COLUMN public.audit_logs.message IS 
  'Error logging: Messaggio errore';
  
COMMENT ON COLUMN public.audit_logs.stack_trace IS 
  'Error logging: Stack trace errore';
  
COMMENT ON COLUMN public.audit_logs.endpoint IS 
  'Error logging: Endpoint API dove è avvenuto errore';
  
COMMENT ON COLUMN public.audit_logs.ip_address IS 
  'Error logging: IP address del client';

COMMENT ON COLUMN public.audit_logs.metadata IS 
  'Metadata JSONB flessibile per entrambi gli usi';

-- ============================================
-- MIGRATION COMPLETATA
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ MIGRATION 013 UNIFIED COMPLETATA';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Schema audit_logs ora supporta:';
  RAISE NOTICE '   ✅ Error Logging (severity, message, stack_trace)';
  RAISE NOTICE '   ✅ Security Audit (action, resource_type, resource_id)';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Colonne unificate (tutte nullable per compatibilità):';
  RAISE NOTICE '   - Common: id, user_id, metadata, created_at';
  RAISE NOTICE '   - Error: severity, message, stack_trace, endpoint, ip_address';
  RAISE NOTICE '   - Security: action, resource_type, resource_id, user_email';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ PROSSIMO PASSO:';
  RAISE NOTICE '   Applica migration 20251221201850_audit_actor_schema.sql';
  RAISE NOTICE '   (Aggiunge actor_id, target_id per impersonation)';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

