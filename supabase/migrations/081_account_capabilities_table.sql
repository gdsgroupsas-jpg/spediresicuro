-- ============================================
-- MIGRATION: 081_account_capabilities_table.sql
-- DESCRIZIONE: Crea tabella account_capabilities per permessi granulari
-- DATA: 2025-01 (Enterprise Hardening - Fase 1)
-- 
-- ⚠️ IMPORTANTE: Questa migration aggiunge sistema capability flags granulari.
-- Non breaking: mantiene compatibilità con role/account_type esistenti.
-- Fallback: se capability non trovata, usa role/account_type.
-- ============================================

-- ============================================
-- STEP 1: Crea tabella account_capabilities
-- ============================================

CREATE TABLE IF NOT EXISTS account_capabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Riferimento utente
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Nome capability
  capability_name TEXT NOT NULL,
  
  -- Audit trail
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES users(id),
  
  -- Revoca (soft delete per audit trail)
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id),
  
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Vincolo: un utente può avere una sola capability attiva per nome
  CONSTRAINT unique_active_capability 
    UNIQUE (user_id, capability_name) 
    WHERE revoked_at IS NULL
);

-- ============================================
-- STEP 2: Indici per performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_account_capabilities_user_id 
  ON account_capabilities(user_id);

CREATE INDEX IF NOT EXISTS idx_account_capabilities_capability_name 
  ON account_capabilities(capability_name);

CREATE INDEX IF NOT EXISTS idx_account_capabilities_active 
  ON account_capabilities(user_id, capability_name) 
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_account_capabilities_revoked 
  ON account_capabilities(revoked_at) 
  WHERE revoked_at IS NOT NULL;

-- ============================================
-- STEP 3: Commenti
-- ============================================

COMMENT ON TABLE account_capabilities IS 
  'Capability flags granulari per permessi utente. Supporta audit trail e revoca. Non breaking: mantiene compatibilità con role/account_type esistenti.';

COMMENT ON COLUMN account_capabilities.user_id IS 'ID utente a cui è assegnata la capability';
COMMENT ON COLUMN account_capabilities.capability_name IS 'Nome capability (es: can_manage_pricing, can_create_subusers)';
COMMENT ON COLUMN account_capabilities.revoked_at IS 'NULL = capability attiva, NOT NULL = revocata';
COMMENT ON COLUMN account_capabilities.granted_by IS 'ID utente che ha concesso la capability (audit trail)';

-- ============================================
-- STEP 4: RLS (Row Level Security)
-- ============================================

ALTER TABLE account_capabilities ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: Utenti vedono solo le proprie capability, superadmin vede tutto
CREATE POLICY account_capabilities_select ON account_capabilities
  FOR SELECT USING (
    -- Superadmin vede tutto
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.account_type = 'superadmin'
    )
    OR
    -- Utente vede solo le proprie capability
    user_id = auth.uid()
  );

-- Policy INSERT: Solo superadmin può creare capability
CREATE POLICY account_capabilities_insert ON account_capabilities
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.account_type = 'superadmin'
    )
  );

-- Policy UPDATE: Solo superadmin può aggiornare (es. revocare)
CREATE POLICY account_capabilities_update ON account_capabilities
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.account_type = 'superadmin'
    )
  );

-- Policy DELETE: Solo superadmin può eliminare (preferire soft delete via revoked_at)
CREATE POLICY account_capabilities_delete ON account_capabilities
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.account_type = 'superadmin'
    )
  );

COMMENT ON POLICY account_capabilities_select ON account_capabilities IS 
  'RLS: Superadmin vede tutto, utenti vedono solo proprie capability';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 081 completata con successo';
  RAISE NOTICE '✅ Tabella account_capabilities creata';
  RAISE NOTICE '';
  RAISE NOTICE 'Prossimi step:';
  RAISE NOTICE '  1. Popolare capability da role/account_type esistenti';
  RAISE NOTICE '  2. Creare funzione helper has_capability()';
  RAISE NOTICE '  3. Integrare in backend con fallback';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ NOTA: Sistema non breaking, mantiene compatibilità';
  RAISE NOTICE '========================================';
END $$;
