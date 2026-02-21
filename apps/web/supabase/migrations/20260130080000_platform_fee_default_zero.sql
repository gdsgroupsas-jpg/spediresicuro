-- =====================================================
-- FIX: Platform fee default da €0.50 a €0
-- Le fee sono decisioni business, non hardcoded.
-- Se serve una fee, va configurata esplicitamente.
-- =====================================================

-- 1. Aggiorna get_platform_fee_cascading
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
  v_default_fee CONSTANT DECIMAL(10,2) := 0.00;
  v_recursion_depth INT := 0;
  v_max_recursion CONSTANT INT := 10;
BEGIN
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

  IF v_user_fee IS NOT NULL THEN
    RETURN v_user_fee;
  END IF;

  IF v_parent_imposed_fee IS NOT NULL THEN
    RETURN v_parent_imposed_fee;
  END IF;

  IF v_parent_id IS NOT NULL THEN
    IF v_recursion_depth >= v_max_recursion THEN
      RAISE WARNING 'get_platform_fee_cascading: max recursion depth reached for user %', p_user_id;
      RETURN v_default_fee;
    END IF;

    RETURN get_platform_fee_cascading(v_parent_id);
  END IF;

  RETURN v_default_fee;
END;
$$;

COMMENT ON FUNCTION get_platform_fee_cascading(UUID) IS
'Calcola fee in cascata: override_utente > parent_imposed > parent_fee > default €0 (nessuna fee)';

-- 2. Aggiorna get_platform_fee_details
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
  v_default_fee CONSTANT DECIMAL(10,2) := 0.00;
  v_current_user_id UUID := p_user_id;
  v_iteration INT := 0;
  v_max_iteration CONSTANT INT := 10;
BEGIN
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

  IF v_user_fee IS NOT NULL THEN
    RETURN QUERY
    SELECT v_user_fee, 'custom'::TEXT, p_user_id, (SELECT email FROM users WHERE id = p_user_id);
    RETURN;
  END IF;

  IF v_parent_imposed_fee IS NOT NULL THEN
    RETURN QUERY
    SELECT v_parent_imposed_fee, 'parent_imposed'::TEXT, v_applied_by_parent_id,
           (SELECT email FROM users WHERE id = v_applied_by_parent_id);
    RETURN;
  END IF;

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

  RETURN QUERY SELECT v_default_fee, 'default'::TEXT, NULL::UUID, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION get_platform_fee_details(UUID) IS
'Ritorna fee e dettagli sulla fonte (per UI/debugging). Default €0.';
