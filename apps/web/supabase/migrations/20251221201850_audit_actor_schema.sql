/**
 * Acting Context (Impersonation) - Audit Schema 2.0
 * 
 * Migration: 20251221201850 - Audit Actor Schema
 * Description: Estende audit_logs per distinguere ACTOR (chi esegue) e TARGET (per chi)
 * 
 * CRITICAL: Questa migration supporta il sistema di impersonation sicuro dove
 * SuperAdmin può operare "come cliente" mantenendo traccia di chi ha fatto cosa.
 * 
 * PREREQUISITE: Richiede migration 013_security_audit_logs.sql (tabella audit_logs)
 */

-- ============================================
-- STEP 0: Verifica Prerequisiti
-- ============================================

DO $$
BEGIN
  -- Verifica che tabella audit_logs esista
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs'
  ) THEN
    RAISE EXCEPTION '❌ PREREQUISITE FAILED: Tabella audit_logs non trovata. Applicare prima migration 013_security_audit_logs.sql';
  END IF;
  
  -- Verifica che colonna action esista (schema base)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs' 
    AND column_name = 'action'
  ) THEN
    RAISE EXCEPTION '❌ PREREQUISITE FAILED: Colonna action non trovata in audit_logs. Schema audit_logs non valido.';
  END IF;
  
  RAISE NOTICE '✅ Prerequisiti verificati: audit_logs esiste con schema base';
END $$;

-- ============================================
-- STEP 1: Aggiungi colonne Acting Context
-- ============================================

DO $$
BEGIN
  -- actor_id: UUID dell'utente che ESEGUE l'azione (SuperAdmin in caso di impersonation)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs' 
    AND column_name = 'actor_id'
  ) THEN
    ALTER TABLE public.audit_logs 
    ADD COLUMN actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    
    COMMENT ON COLUMN public.audit_logs.actor_id IS 
      'ID dell''utente che ESEGUE l''azione (SuperAdmin se impersonation attiva)';
    
    RAISE NOTICE '✅ Colonna actor_id aggiunta a audit_logs';
  ELSE
    RAISE NOTICE '⚠️ Colonna actor_id già esistente';
  END IF;

  -- target_id: UUID dell'utente TARGET dell'azione (il cliente per cui si opera)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs' 
    AND column_name = 'target_id'
  ) THEN
    ALTER TABLE public.audit_logs 
    ADD COLUMN target_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    
    COMMENT ON COLUMN public.audit_logs.target_id IS 
      'ID dell''utente TARGET (per chi viene eseguita l''azione, es. cliente in caso di impersonation)';
    
    RAISE NOTICE '✅ Colonna target_id aggiunta a audit_logs';
  ELSE
    RAISE NOTICE '⚠️ Colonna target_id già esistente';
  END IF;

  -- impersonation_active: Flag per indicare se l'azione è stata eseguita in modalità impersonation
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs' 
    AND column_name = 'impersonation_active'
  ) THEN
    ALTER TABLE public.audit_logs 
    ADD COLUMN impersonation_active BOOLEAN DEFAULT false NOT NULL;
    
    COMMENT ON COLUMN public.audit_logs.impersonation_active IS 
      'TRUE se l''azione è stata eseguita tramite impersonation (actor_id != target_id)';
    
    RAISE NOTICE '✅ Colonna impersonation_active aggiunta a audit_logs';
  ELSE
    RAISE NOTICE '⚠️ Colonna impersonation_active già esistente';
  END IF;

  -- audit_metadata: JSONB per dati strutturati (espansione del metadata esistente)
  -- Nota: Manteniamo 'metadata' esistente per compatibilità, audit_metadata è per dati di audit specifici
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs' 
    AND column_name = 'audit_metadata'
  ) THEN
    ALTER TABLE public.audit_logs 
    ADD COLUMN audit_metadata JSONB DEFAULT '{}' NOT NULL;
    
    COMMENT ON COLUMN public.audit_logs.audit_metadata IS 
      'Metadata strutturati per audit (es. IP actor, IP target, reason, approval_id, etc.)';
    
    RAISE NOTICE '✅ Colonna audit_metadata aggiunta a audit_logs';
  ELSE
    RAISE NOTICE '⚠️ Colonna audit_metadata già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 2: Crea indici per performance query
-- ============================================

-- Indice su actor_id per query "chi ha fatto cosa"
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id 
  ON public.audit_logs(actor_id) 
  WHERE actor_id IS NOT NULL;

-- Indice su target_id per query "cosa è stato fatto per chi"
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id 
  ON public.audit_logs(target_id) 
  WHERE target_id IS NOT NULL;

-- Indice composto per query "actor per target" (es. "cosa ha fatto admin per cliente X")
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_target 
  ON public.audit_logs(actor_id, target_id) 
  WHERE impersonation_active = true;

-- Indice su impersonation_active per query "tutte le azioni in impersonation"
CREATE INDEX IF NOT EXISTS idx_audit_logs_impersonation 
  ON public.audit_logs(impersonation_active, created_at DESC) 
  WHERE impersonation_active = true;

-- Indice GIN su audit_metadata per query JSON
CREATE INDEX IF NOT EXISTS idx_audit_logs_audit_metadata_gin 
  ON public.audit_logs USING GIN (audit_metadata);

-- ============================================
-- STEP 3: Migra dati esistenti (back-fill)
-- ============================================

DO $$
BEGIN
  -- Per log esistenti senza actor_id/target_id, usa user_id per entrambi
  -- (assumiamo che non ci fosse impersonation prima di questa migration)
  UPDATE public.audit_logs
  SET 
    actor_id = user_id,
    target_id = user_id,
    impersonation_active = false
  WHERE actor_id IS NULL OR target_id IS NULL;
  
  RAISE NOTICE '✅ Migrazione dati esistenti completata: actor_id/target_id popolati da user_id';
END $$;

-- ============================================
-- STEP 4: Aggiungi constraint di sicurezza
-- ============================================

-- Constraint: actor_id e target_id devono essere presenti per nuovi log
DO $$
BEGIN
  -- Non possiamo aggiungere NOT NULL su colonne esistenti con dati null,
  -- quindi creiamo un CHECK constraint per i nuovi record
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'audit_logs_actor_target_required'
  ) THEN
    ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_actor_target_required
    CHECK (
      (actor_id IS NOT NULL AND target_id IS NOT NULL)
      OR created_at < NOW() -- Permetti NULL solo per record esistenti
    );
    
    RAISE NOTICE '✅ Constraint audit_logs_actor_target_required aggiunto';
  END IF;
END $$;

-- ============================================
-- STEP 5: Funzione Helper per Audit Log
-- ============================================

-- Funzione per creare audit log con Acting Context
CREATE OR REPLACE FUNCTION public.log_acting_context_audit(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_actor_id UUID,
  p_target_id UUID,
  p_impersonation_active BOOLEAN DEFAULT false,
  p_audit_metadata JSONB DEFAULT '{}',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_actor_email TEXT;
  v_target_email TEXT;
BEGIN
  -- Recupera email per legacy compatibility
  SELECT email INTO v_actor_email FROM public.users WHERE id = p_actor_id;
  SELECT email INTO v_target_email FROM public.users WHERE id = p_target_id;
  
  -- Inserisci log
  INSERT INTO public.audit_logs (
    action,
    resource_type,
    resource_id,
    user_id,
    user_email,
    actor_id,
    target_id,
    impersonation_active,
    audit_metadata,
    metadata
  ) VALUES (
    p_action,
    p_resource_type,
    p_resource_id,
    p_target_id, -- user_id = target (per compatibilità con query esistenti)
    COALESCE(v_target_email, v_actor_email), -- user_email = target
    p_actor_id,
    p_target_id,
    p_impersonation_active,
    p_audit_metadata,
    p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.log_acting_context_audit IS 
  'Crea audit log con Acting Context (actor + target). Usa questa funzione per log in impersonation.';

-- ============================================
-- STEP 6: View per Query Audit Impersonation
-- ============================================

-- View per audit log con impersonation (con nomi utenti leggibili)
-- NOTA: Crea view solo se tutte le colonne esistono
DO $$
BEGIN
  -- Verifica che tutte le colonne necessarie esistano
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs'
    AND column_name IN ('action', 'actor_id', 'target_id', 'impersonation_active', 'audit_metadata')
    GROUP BY table_name
    HAVING COUNT(DISTINCT column_name) = 5
  ) THEN
    -- Crea o sostituisci view
    CREATE OR REPLACE VIEW public.audit_logs_impersonation AS
    SELECT 
      al.id,
      al.action,
      al.resource_type,
      al.resource_id,
      al.impersonation_active,
      
      -- Actor (chi ha fatto)
      al.actor_id,
      u_actor.email AS actor_email,
      u_actor.name AS actor_name,
      u_actor.account_type AS actor_role,
      
      -- Target (per chi)
      al.target_id,
      u_target.email AS target_email,
      u_target.name AS target_name,
      u_target.account_type AS target_role,
      
      -- Metadata
      al.audit_metadata,
      al.metadata,
      al.created_at
    FROM public.audit_logs al
    LEFT JOIN public.users u_actor ON al.actor_id = u_actor.id
    LEFT JOIN public.users u_target ON al.target_id = u_target.id
    WHERE al.impersonation_active = true
    ORDER BY al.created_at DESC;
    
    COMMENT ON VIEW public.audit_logs_impersonation IS 
      'View audit log con impersonation: mostra chi (actor) ha fatto cosa per chi (target)';
    
    RAISE NOTICE '✅ View audit_logs_impersonation creata/aggiornata';
  ELSE
    RAISE WARNING '⚠️ Impossibile creare view: colonne mancanti in audit_logs';
    RAISE WARNING '   Verifica che migration 013_security_audit_logs.sql sia stata applicata';
  END IF;
END $$;

-- ============================================
-- STEP 7: Policy RLS per View
-- ============================================

-- La view eredita le policy della tabella audit_logs
-- Solo admin possono vedere la view

-- ============================================
-- MIGRATION COMPLETATA
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ MIGRATION 20251221201850 COMPLETATA';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Aggiunte colonne:';
  RAISE NOTICE '   - actor_id (UUID)';
  RAISE NOTICE '   - target_id (UUID)';
  RAISE NOTICE '   - impersonation_active (BOOLEAN)';
  RAISE NOTICE '   - audit_metadata (JSONB)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Creati indici:';
  RAISE NOTICE '   - idx_audit_logs_actor_id';
  RAISE NOTICE '   - idx_audit_logs_target_id';
  RAISE NOTICE '   - idx_audit_logs_actor_target';
  RAISE NOTICE '   - idx_audit_logs_impersonation';
  RAISE NOTICE '   - idx_audit_logs_audit_metadata_gin';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Funzioni helper:';
  RAISE NOTICE '   - log_acting_context_audit()';
  RAISE NOTICE '';
  RAISE NOTICE '👁️ View create:';
  RAISE NOTICE '   - audit_logs_impersonation';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ PROSSIMI PASSI:';
  RAISE NOTICE '   1. Deploy lib/safe-auth.ts';
  RAISE NOTICE '   2. Update middleware.ts per impersonation cookie';
  RAISE NOTICE '   3. Update Server Actions per usare getSafeAuth()';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

