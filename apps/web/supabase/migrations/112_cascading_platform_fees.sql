-- =====================================================
-- Migration: 112_cascading_platform_fees.sql
-- Descrizione: Sistema fee a cascata per gerarchia utenti
--
-- Logica:
-- - USER senza parent: GRATIS
-- - USER con parent: eredita fee dal parent o usa parent_imposed_fee
-- - SUPERADMIN/RESELLER: pagano fee (configurabile)
--
-- Priorità calcolo fee:
-- 1. platform_fee_override (massima priorità)
-- 2. parent_imposed_fee (imposta dal parent)
-- 3. Fee del parent (ricorsivo)
-- 4. Default €0.50
-- =====================================================

-- 1. Nuove colonne su users per fee a cascata
ALTER TABLE users
ADD COLUMN IF NOT EXISTS parent_imposed_fee DECIMAL(10,2) DEFAULT NULL;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS fee_applied_by_parent_id UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN users.parent_imposed_fee IS 'Fee imposta dal parent RESELLER/SUPERADMIN al sub-user. NULL = usa logica cascading';
COMMENT ON COLUMN users.fee_applied_by_parent_id IS 'ID del parent che ha imposto la fee (per audit trail)';

-- 2. Tabella audit per fee a cascata (parent → child)
CREATE TABLE IF NOT EXISTS parent_fee_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_parent_fee DECIMAL(10,2),
  new_parent_fee DECIMAL(10,2),
  notes TEXT,
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indici per performance
CREATE INDEX IF NOT EXISTS idx_users_parent_imposed_fee
ON users(parent_imposed_fee) WHERE parent_imposed_fee IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_parent_fee_history_parent ON parent_fee_history(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_fee_history_child ON parent_fee_history(child_id);
CREATE INDEX IF NOT EXISTS idx_parent_fee_history_changed_at ON parent_fee_history(changed_at DESC);

-- 4. Funzione calcolo fee a cascata (ricorsiva)
CREATE OR REPLACE FUNCTION get_platform_fee_cascading(p_user_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_fee DECIMAL(10,2);
  v_parent_imposed_fee DECIMAL(10,2);
  v_parent_id UUID;
  v_account_type TEXT;
  v_default_fee CONSTANT DECIMAL(10,2) := 0.50;
  v_recursion_depth INT := 0;
  v_max_recursion CONSTANT INT := 10; -- Protezione anti-loop infinito
BEGIN
  -- Recupera info utente
  SELECT
    platform_fee_override,
    parent_id,
    parent_imposed_fee,
    account_type
  INTO v_user_fee, v_parent_id, v_parent_imposed_fee, v_account_type
  FROM users
  WHERE id = p_user_id;

  -- Utente non trovato → default
  IF NOT FOUND THEN
    RETURN v_default_fee;
  END IF;

  -- Priorità 1: Override utente (massima priorità)
  -- Se l'utente ha un override personale, usa quello
  IF v_user_fee IS NOT NULL THEN
    RETURN v_user_fee;
  END IF;

  -- Priorità 2: Fee imposta dal parent
  -- Se il parent ha esplicitamente imposto una fee, usa quella
  IF v_parent_imposed_fee IS NOT NULL THEN
    RETURN v_parent_imposed_fee;
  END IF;

  -- Priorità 3: Fee del parent (ricorsivo)
  -- Se è un sub-user, eredita la fee dal parent
  IF v_parent_id IS NOT NULL THEN
    -- Protezione anti-loop
    IF v_recursion_depth >= v_max_recursion THEN
      RAISE WARNING 'get_platform_fee_cascading: max recursion depth reached for user %', p_user_id;
      RETURN v_default_fee;
    END IF;

    RETURN get_platform_fee_cascading(v_parent_id);
  END IF;

  -- Priorità 4: Default
  -- Solo se non ha parent e non ha override
  RETURN v_default_fee;
END;
$$;

COMMENT ON FUNCTION get_platform_fee_cascading(UUID) IS
'Calcola fee in cascata: override_utente > parent_imposed > parent_fee > default €0.50';

-- 5. Funzione per ottenere dettagli fee (per UI)
CREATE OR REPLACE FUNCTION get_platform_fee_details(p_user_id UUID)
RETURNS TABLE (
  fee DECIMAL(10,2),
  source TEXT, -- 'custom', 'parent_imposed', 'parent_cascaded', 'default'
  source_user_id UUID,
  source_user_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_fee DECIMAL(10,2);
  v_parent_imposed_fee DECIMAL(10,2);
  v_parent_id UUID;
  v_applied_by_parent_id UUID;
  v_default_fee CONSTANT DECIMAL(10,2) := 0.50;
  v_current_user_id UUID := p_user_id;
  v_iteration INT := 0;
  v_max_iteration CONSTANT INT := 10;
BEGIN
  -- Recupera info utente
  SELECT
    u.platform_fee_override,
    u.parent_id,
    u.parent_imposed_fee,
    u.fee_applied_by_parent_id
  INTO v_user_fee, v_parent_id, v_parent_imposed_fee, v_applied_by_parent_id
  FROM users u
  WHERE u.id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT v_default_fee, 'default'::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  -- Priorità 1: Override utente
  IF v_user_fee IS NOT NULL THEN
    RETURN QUERY
    SELECT v_user_fee, 'custom'::TEXT, p_user_id, (SELECT email FROM users WHERE id = p_user_id);
    RETURN;
  END IF;

  -- Priorità 2: Fee imposta dal parent
  IF v_parent_imposed_fee IS NOT NULL THEN
    RETURN QUERY
    SELECT v_parent_imposed_fee, 'parent_imposed'::TEXT, v_applied_by_parent_id,
           (SELECT email FROM users WHERE id = v_applied_by_parent_id);
    RETURN;
  END IF;

  -- Priorità 3: Cerca nella catena parent
  WHILE v_parent_id IS NOT NULL AND v_iteration < v_max_iteration LOOP
    v_iteration := v_iteration + 1;
    v_current_user_id := v_parent_id;

    SELECT
      u.platform_fee_override,
      u.parent_id
    INTO v_user_fee, v_parent_id
    FROM users u
    WHERE u.id = v_current_user_id;

    IF v_user_fee IS NOT NULL THEN
      RETURN QUERY
      SELECT v_user_fee, 'parent_cascaded'::TEXT, v_current_user_id,
             (SELECT email FROM users WHERE id = v_current_user_id);
      RETURN;
    END IF;
  END LOOP;

  -- Priorità 4: Default
  RETURN QUERY SELECT v_default_fee, 'default'::TEXT, NULL::UUID, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION get_platform_fee_details(UUID) IS
'Ritorna fee e dettagli sulla fonte (per UI/debugging)';

-- 6. RLS per parent_fee_history
ALTER TABLE parent_fee_history ENABLE ROW LEVEL SECURITY;

-- SUPERADMIN può vedere tutto
CREATE POLICY "superadmin_full_access_parent_fee_history"
ON parent_fee_history
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND (users.role = 'SUPERADMIN' OR users.account_type = 'superadmin')
  )
);

-- Parent può vedere fee history dei propri sub-user
CREATE POLICY "parent_can_view_child_fee_history"
ON parent_fee_history
FOR SELECT
USING (
  parent_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND is_sub_user_of(parent_fee_history.child_id, users.id)
  )
);

-- Parent può inserire fee history per i propri sub-user
CREATE POLICY "parent_can_insert_child_fee_history"
ON parent_fee_history
FOR INSERT
WITH CHECK (
  parent_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = child_id
    AND (u.parent_id = auth.uid() OR is_sub_user_of(u.id, auth.uid()))
  )
);

-- 7. Grant permessi
GRANT SELECT ON parent_fee_history TO authenticated;
GRANT INSERT ON parent_fee_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_platform_fee_cascading(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_platform_fee_details(UUID) TO authenticated;

-- 8. Verifica integrità: parent_imposed_fee senza parent_id non ha senso
-- (ma non aggiungiamo constraint per flessibilità)

-- =====================================================
-- NOTA: Questa migration NON modifica la funzione
-- get_platform_fee() esistente. Le modifiche a quella
-- funzione vanno fatte nel codice TypeScript che
-- chiamerà get_platform_fee_cascading() invece.
-- =====================================================
