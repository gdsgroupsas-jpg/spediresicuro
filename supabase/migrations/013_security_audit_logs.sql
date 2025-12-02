/**
 * Security & Audit Logs Migration
 * 
 * Migration: 013 - Sistema di Audit Logging e Sicurezza
 * Description: Aggiunge tabella audit_logs per tracciare accessi a credenziali sensibili
 */

-- ============================================
-- STEP 1: Crea Tabella audit_logs
-- ============================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tipo di azione
  action TEXT NOT NULL,
  -- Valori possibili: 'credential_viewed', 'credential_copied', 'credential_created', 
  --                   'credential_updated', 'credential_deleted', 'credential_decrypted'
  
  -- Risorsa interessata
  resource_type TEXT NOT NULL, -- 'courier_config' | 'api_credential'
  resource_id UUID NOT NULL,
  
  -- Utente che ha eseguito l'azione
  user_email TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Metadata aggiuntivi (IP, user agent, dettagli operazione)
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per performance e query
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_email, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- RLS: Solo admin possono vedere i log
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_admin_access ON public.audit_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.email = current_setting('request.jwt.claims', true)::json->>'email'
      AND users.role = 'admin'
    )
  );

-- Commenti
COMMENT ON TABLE public.audit_logs IS 
  'Log di audit per tracciare accessi e modifiche a credenziali sensibili';
COMMENT ON COLUMN public.audit_logs.action IS 
  'Tipo di azione eseguita (credential_viewed, credential_copied, etc.)';
COMMENT ON COLUMN public.audit_logs.metadata IS 
  'Dati aggiuntivi dell''operazione (IP, user agent, dettagli)';

-- ============================================
-- STEP 2: Aggiungi colonna encrypted_flag a courier_configs
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs' 
    AND column_name = 'encrypted'
  ) THEN
    ALTER TABLE public.courier_configs 
    ADD COLUMN encrypted BOOLEAN DEFAULT false;
    
    -- Marca come encrypted le credenziali esistenti (se hanno formato criptato)
    UPDATE public.courier_configs
    SET encrypted = true
    WHERE api_key LIKE '%:%:%:%' -- Formato criptato: iv:salt:tag:encrypted
    OR api_secret LIKE '%:%:%:%';
    
    RAISE NOTICE '✅ Colonna encrypted aggiunta a courier_configs';
  ELSE
    RAISE NOTICE '⚠️ Colonna encrypted già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 3: Funzione per migrare credenziali esistenti
-- ============================================

-- Nota: La migrazione delle credenziali esistenti deve essere fatta
-- manualmente o tramite script, poiché richiede la chiave di criptazione
-- ⚠️ IMPORTANTE: Eseguire migrazione credenziali solo dopo aver configurato ENCRYPTION_KEY

COMMENT ON COLUMN public.courier_configs.encrypted IS 
  'Flag che indica se le credenziali sono criptate (true) o in chiaro (false)';

