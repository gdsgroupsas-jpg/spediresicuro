-- =====================================================
-- Migration: 113_fix_cascading_fee_security.sql
-- Descrizione: FIX P0 - Aggiunge authorization check a funzioni RPC
-- =====================================================

-- 1. Fix get_platform_fee_cascading: Aggiunge auth check
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
  v_max_recursion CONSTANT INT := 10;
  v_caller_id UUID := auth.uid();
  v_is_authorized BOOLEAN := FALSE;
BEGIN
  -- ⚠️ SECURITY: Authorization check
  -- Può chiamare solo per:
  -- 1. Sé stesso
  -- 2. I propri sub-user (se è parent/reseller)
  -- 3. Qualsiasi user (se è SUPERADMIN)

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check autorizzazione
  IF p_user_id = v_caller_id THEN
    -- Caso 1: Richiesta per sé stesso
    v_is_authorized := TRUE;
  ELSIF EXISTS (
    SELECT 1 FROM users
    WHERE id = v_caller_id
    AND (role = 'SUPERADMIN' OR account_type = 'superadmin')
  ) THEN
    -- Caso 3: SUPERADMIN può vedere tutto
    v_is_authorized := TRUE;
  ELSIF EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = p_user_id
    AND (
      u.parent_id = v_caller_id
      OR is_sub_user_of(p_user_id, v_caller_id)
    )
  ) THEN
    -- Caso 2: Richiesta per proprio sub-user
    v_is_authorized := TRUE;
  END IF;

  -- Se non autorizzato → DENY
  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Access denied: You are not authorized to view fees for user %', p_user_id;
  END IF;

  -- Recupera info utente (resto della logica uguale)
  SELECT
    platform_fee_override,
    parent_id,
    parent_imposed_fee,
    account_type
  INTO v_user_fee, v_parent_id, v_parent_imposed_fee, v_account_type
  FROM users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN v_default_fee;
  END IF;

  -- Priorità 1: Override utente
  IF v_user_fee IS NOT NULL THEN
    RETURN v_user_fee;
  END IF;

  -- Priorità 2: Fee imposta dal parent
  IF v_parent_imposed_fee IS NOT NULL THEN
    RETURN v_parent_imposed_fee;
  END IF;

  -- Priorità 3: Fee del parent (ricorsivo)
  IF v_parent_id IS NOT NULL THEN
    IF v_recursion_depth >= v_max_recursion THEN
      RAISE WARNING 'get_platform_fee_cascading: max recursion depth reached for user %', p_user_id;
      RETURN v_default_fee;
    END IF;

    RETURN get_platform_fee_cascading(v_parent_id);
  END IF;

  -- Priorità 4: Default
  RETURN v_default_fee;
END;
$$;

COMMENT ON FUNCTION get_platform_fee_cascading(UUID) IS
'Calcola fee a cascata con auth check: solo user stesso, parent, o superadmin';

-- 2. Fix get_platform_fee_details: Aggiunge auth check
CREATE OR REPLACE FUNCTION get_platform_fee_details(p_user_id UUID)
RETURNS TABLE (
  fee DECIMAL(10,2),
  source TEXT,
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
  v_caller_id UUID := auth.uid();
  v_is_authorized BOOLEAN := FALSE;
BEGIN
  -- ⚠️ SECURITY: Authorization check (same as above)
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_user_id = v_caller_id THEN
    v_is_authorized := TRUE;
  ELSIF EXISTS (
    SELECT 1 FROM users
    WHERE id = v_caller_id
    AND (role = 'SUPERADMIN' OR account_type = 'superadmin')
  ) THEN
    v_is_authorized := TRUE;
  ELSIF EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = p_user_id
    AND (
      u.parent_id = v_caller_id
      OR is_sub_user_of(p_user_id, v_caller_id)
    )
  ) THEN
    v_is_authorized := TRUE;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Access denied: You are not authorized to view fee details for user %', p_user_id;
  END IF;

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

  -- Priorità 3: Fee del parent (ricorsivo)
  WHILE v_current_user_id IS NOT NULL AND v_iteration < v_max_iteration LOOP
    SELECT u.parent_id, u.platform_fee_override
    INTO v_parent_id, v_user_fee
    FROM users u
    WHERE u.id = v_current_user_id;

    IF v_user_fee IS NOT NULL THEN
      RETURN QUERY
      SELECT v_user_fee, 'parent_cascaded'::TEXT, v_current_user_id,
             (SELECT email FROM users WHERE id = v_current_user_id);
      RETURN;
    END IF;

    v_current_user_id := v_parent_id;
    v_iteration := v_iteration + 1;
  END LOOP;

  -- Priorità 4: Default
  RETURN QUERY SELECT v_default_fee, 'default'::TEXT, NULL::UUID, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION get_platform_fee_details(UUID) IS
'Ritorna fee e dettagli con auth check: solo user stesso, parent, o superadmin';
