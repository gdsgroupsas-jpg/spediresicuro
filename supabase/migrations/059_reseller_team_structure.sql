-- ============================================
-- MIGRATION: 059_reseller_team_structure.sql
-- DESCRIZIONE: Estende la struttura team per account Reseller
-- DATA: 2026-01-03
--
-- NUOVI RUOLI TEAM:
-- - admin: Amministratore reseller (può gestire tutto, incluso eliminare config default)
-- - user: Utente base del team (solo spedizioni)
-- - agent: Agente commerciale (gestione clienti)
-- - courier: Corriere/Autista (gestione consegne)
--
-- STRUTTURA GERARCHICA:
-- reseller_admin > team_administrator > team_agent > team_user
--                                     > team_courier
-- ============================================

-- ============================================
-- STEP 1: Rimuovi vecchio constraint e aggiorna enum reseller_role
-- ============================================
DO $$
BEGIN
  -- Rimuovi constraint esistente
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_reseller_role_check;
  
  -- Aggiungi nuovo constraint con tutti i ruoli
  ALTER TABLE users ADD CONSTRAINT users_reseller_role_check 
    CHECK (reseller_role IN ('admin', 'user', 'agent', 'courier', 'team_administrator'));
  
  RAISE NOTICE '✅ Constraint reseller_role aggiornato con nuovi ruoli team';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Errore aggiornamento constraint: %', SQLERRM;
END $$;

-- ============================================
-- STEP 2: Aggiungi campo parent_reseller_id per gerarchia team
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'parent_reseller_id'
  ) THEN
    ALTER TABLE users ADD COLUMN parent_reseller_id UUID REFERENCES users(id) ON DELETE SET NULL;
    CREATE INDEX idx_users_parent_reseller ON users(parent_reseller_id) WHERE parent_reseller_id IS NOT NULL;
    COMMENT ON COLUMN users.parent_reseller_id IS 'ID del reseller admin padre per membri del team';
    RAISE NOTICE '✅ Campo parent_reseller_id aggiunto';
  ELSE
    RAISE NOTICE '⚠️ Campo parent_reseller_id già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 3: Aggiungi campi per gestione team
-- ============================================
DO $$
BEGIN
  -- Campo per permessi specifici del membro team (JSONB)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'team_permissions'
  ) THEN
    ALTER TABLE users ADD COLUMN team_permissions JSONB DEFAULT '{}';
    COMMENT ON COLUMN users.team_permissions IS 'Permessi specifici del membro team: { can_create_shipments, can_manage_clients, can_view_reports, can_manage_team }';
    RAISE NOTICE '✅ Campo team_permissions aggiunto';
  ELSE
    RAISE NOTICE '⚠️ Campo team_permissions già esistente';
  END IF;

  -- Campo per stato membro team
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'team_status'
  ) THEN
    ALTER TABLE users ADD COLUMN team_status TEXT DEFAULT 'active' CHECK (team_status IN ('active', 'suspended', 'pending'));
    COMMENT ON COLUMN users.team_status IS 'Stato membro nel team: active, suspended, pending (invito)';
    RAISE NOTICE '✅ Campo team_status aggiunto';
  ELSE
    RAISE NOTICE '⚠️ Campo team_status già esistente';
  END IF;

  -- Campo per data invito team
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'team_invited_at'
  ) THEN
    ALTER TABLE users ADD COLUMN team_invited_at TIMESTAMPTZ;
    COMMENT ON COLUMN users.team_invited_at IS 'Data invito al team reseller';
    RAISE NOTICE '✅ Campo team_invited_at aggiunto';
  ELSE
    RAISE NOTICE '⚠️ Campo team_invited_at già esistente';
  END IF;

  -- Campo per data accettazione invito
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'team_joined_at'
  ) THEN
    ALTER TABLE users ADD COLUMN team_joined_at TIMESTAMPTZ;
    COMMENT ON COLUMN users.team_joined_at IS 'Data accettazione invito al team';
    RAISE NOTICE '✅ Campo team_joined_at aggiunto';
  ELSE
    RAISE NOTICE '⚠️ Campo team_joined_at già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 4: Crea tabella per inviti team (opzionale ma utile)
-- ============================================
CREATE TABLE IF NOT EXISTS reseller_team_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_role TEXT NOT NULL CHECK (invited_role IN ('user', 'agent', 'courier', 'team_administrator')),
  invite_token TEXT UNIQUE NOT NULL,
  permissions JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Indici per inviti
CREATE INDEX IF NOT EXISTS idx_team_invites_reseller ON reseller_team_invites(reseller_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON reseller_team_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON reseller_team_invites(invited_email);

COMMENT ON TABLE reseller_team_invites IS 'Inviti pendenti per membri team reseller';

-- ============================================
-- STEP 5: RLS per tabella inviti
-- ============================================
ALTER TABLE reseller_team_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_invites_select ON reseller_team_invites;
CREATE POLICY team_invites_select ON reseller_team_invites
  FOR SELECT TO authenticated
  USING (
    -- Admin globale
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.account_type IN ('admin', 'superadmin'))
    OR
    -- Reseller admin proprietario
    reseller_id = auth.uid()
    OR
    -- Team administrator dello stesso reseller
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.parent_reseller_id = reseller_team_invites.reseller_id
      AND users.reseller_role = 'team_administrator'
    )
  );

DROP POLICY IF EXISTS team_invites_insert ON reseller_team_invites;
CREATE POLICY team_invites_insert ON reseller_team_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Solo reseller admin o team_administrator possono creare inviti
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_reseller = true
      AND users.reseller_role IN ('admin', 'team_administrator')
    )
  );

DROP POLICY IF EXISTS team_invites_delete ON reseller_team_invites;
CREATE POLICY team_invites_delete ON reseller_team_invites
  FOR DELETE TO authenticated
  USING (
    reseller_id = auth.uid()
    OR
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.account_type IN ('admin', 'superadmin'))
  );

-- ============================================
-- STEP 6: Funzione helper per verificare permessi team
-- ============================================
CREATE OR REPLACE FUNCTION check_reseller_team_permission(
  p_user_id UUID,
  p_permission TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT 
    reseller_role,
    team_permissions,
    is_reseller,
    parent_reseller_id
  INTO v_user
  FROM users
  WHERE id = p_user_id;

  -- Non è un membro team o reseller
  IF NOT FOUND OR (NOT v_user.is_reseller AND v_user.parent_reseller_id IS NULL) THEN
    RETURN FALSE;
  END IF;

  -- Admin reseller ha tutti i permessi
  IF v_user.is_reseller AND v_user.reseller_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Team administrator ha quasi tutti i permessi (tranne eliminare config default)
  IF v_user.reseller_role = 'team_administrator' THEN
    IF p_permission = 'delete_default_config' THEN
      RETURN FALSE;
    END IF;
    RETURN TRUE;
  END IF;

  -- Verifica permessi specifici dal JSONB
  IF v_user.team_permissions ? p_permission THEN
    RETURN (v_user.team_permissions ->> p_permission)::BOOLEAN;
  END IF;

  -- Permessi di default per ruolo
  CASE v_user.reseller_role
    WHEN 'agent' THEN
      RETURN p_permission IN ('create_shipments', 'manage_clients', 'view_reports');
    WHEN 'courier' THEN
      RETURN p_permission IN ('view_shipments', 'update_delivery_status');
    WHEN 'user' THEN
      RETURN p_permission IN ('create_shipments', 'view_own_shipments');
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_reseller_team_permission IS 
'Verifica se un utente ha un permesso specifico nel contesto del team reseller';

-- ============================================
-- STEP 7: Verifica finale
-- ============================================
DO $$
DECLARE
  v_parent_reseller_exists BOOLEAN;
  v_team_permissions_exists BOOLEAN;
  v_invites_table_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'parent_reseller_id'
  ) INTO v_parent_reseller_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'team_permissions'
  ) INTO v_team_permissions_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'reseller_team_invites'
  ) INTO v_invites_table_exists;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RESELLER TEAM STRUCTURE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 RUOLI TEAM DISPONIBILI:';
  RAISE NOTICE '   - admin: Amministratore reseller (tutti i permessi)';
  RAISE NOTICE '   - team_administrator: Gestione team (no delete config default)';
  RAISE NOTICE '   - agent: Agente commerciale';
  RAISE NOTICE '   - courier: Corriere/Autista';
  RAISE NOTICE '   - user: Utente base';
  RAISE NOTICE '';
  RAISE NOTICE '📊 CAMPI AGGIUNTI:';
  RAISE NOTICE '   - parent_reseller_id: %', CASE WHEN v_parent_reseller_exists THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   - team_permissions: %', CASE WHEN v_team_permissions_exists THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   - reseller_team_invites: %', CASE WHEN v_invites_table_exists THEN '✅' ELSE '❌' END;
  RAISE NOTICE '========================================';
END $$;
