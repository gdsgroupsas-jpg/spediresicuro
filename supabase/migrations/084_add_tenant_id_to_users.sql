-- ============================================
-- MIGRATION: 084_add_tenant_id_to_users.sql
-- DESCRIZIONE: Aggiunge campo tenant_id a tabella users per isolamento multi-tenant
-- DATA: 2025-01 (Enterprise Hardening - Fase 2)
-- 
-- ⚠️ IMPORTANTE: Aggiunge tenant_id esplicito per isolamento verificabile.
-- Non breaking: mantiene compatibilità con parent_id esistente.
-- Fallback: se tenant_id è NULL, usa parent_id o user_id.
-- ============================================

-- ============================================
-- STEP 1: Aggiungi campo tenant_id
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE users ADD COLUMN tenant_id UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN users.tenant_id IS 
      'ID tenant per isolamento multi-tenant. Reseller: self-tenant (tenant_id = user_id). Sub-User: tenant del reseller (tenant_id = parent_id). BYOC: self-tenant. NULL = usa fallback a parent_id/user_id.';
    RAISE NOTICE '✅ Aggiunto campo: tenant_id';
  ELSE
    RAISE NOTICE '⚠️ Campo tenant_id già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 2: Indici per performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

CREATE INDEX IF NOT EXISTS idx_users_tenant_account_type 
  ON users(tenant_id, account_type) 
  WHERE tenant_id IS NOT NULL;

-- ============================================
-- STEP 3: Commenti
-- ============================================

COMMENT ON INDEX idx_users_tenant_id IS 
  'Indice per query rapide per tenant_id. Usato per isolamento multi-tenant.';

COMMENT ON INDEX idx_users_tenant_account_type IS 
  'Indice composito per query filtrate per tenant e account_type.';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 084 completata con successo';
  RAISE NOTICE '✅ Campo tenant_id aggiunto a users';
  RAISE NOTICE '';
  RAISE NOTICE 'Prossimi step:';
  RAISE NOTICE '  1. Popolare tenant_id da parent_id/user_id esistenti';
  RAISE NOTICE '  2. Creare funzione helper get_user_tenant()';
  RAISE NOTICE '  3. Aggiornare RLS policies con fallback';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ NOTA: Campo nullable, fallback a parent_id/user_id attivo';
  RAISE NOTICE '========================================';
END $$;
