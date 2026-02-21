-- =====================================================
-- Migration: 20260126160000_fix_delete_user_profiles_dynamic.sql
-- Descrizione: Fix delete_user_complete - skip user_profiles entirely
--
-- BUG FIX: L'errore "column user_id does not exist" si verifica anche
-- con il check dinamico perché PL/pgSQL compila le query in anticipo.
-- Soluzione: usare EXECUTE per query dinamiche.
-- =====================================================

-- Prima elimina la funzione esistente
DROP FUNCTION IF EXISTS delete_user_complete(UUID, UUID, TEXT, TEXT, TEXT);

-- Ricrea la funzione con EXECUTE per query dinamiche
CREATE OR REPLACE FUNCTION delete_user_complete(
  p_user_id UUID,
  p_admin_id UUID,
  p_admin_email TEXT,
  p_target_user_email TEXT,
  p_target_user_name TEXT
)
RETURNS TABLE (
  deleted_shipments_count INTEGER,
  deleted_features_count INTEGER,
  deleted_profiles_count INTEGER,
  wallet_balance_final DECIMAL(10, 2),
  orphaned_shipments_before INTEGER,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted_shipments_count INTEGER := 0;
  v_deleted_features_count INTEGER := 0;
  v_deleted_profiles_count INTEGER := 0;
  v_wallet_balance DECIMAL(10, 2) := 0;
  v_orphaned_shipments_before INTEGER := 0;
  v_target_user_exists BOOLEAN;
  v_admin_user_exists BOOLEAN;
  v_user_profiles_has_user_id BOOLEAN;
  v_user_profiles_has_email BOOLEAN;
BEGIN
  -- ========== STEP 1: VALIDAZIONE PRECONDIZIONI ==========

  -- Verifica che l'utente da cancellare esista
  SELECT EXISTS(SELECT 1 FROM users WHERE id = p_user_id)
  INTO v_target_user_exists;

  IF NOT v_target_user_exists THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  -- Verifica che l'admin esista (per audit trail)
  SELECT EXISTS(SELECT 1 FROM users WHERE id = p_admin_id)
  INTO v_admin_user_exists;

  IF NOT v_admin_user_exists THEN
    RAISE EXCEPTION 'Admin user % not found', p_admin_id;
  END IF;

  -- ========== STEP 2: CONTROLLA SPEDIZIONI ORFANE PRIMA ==========
  SELECT COUNT(*)
  FROM shipments
  WHERE user_id IS NULL
  INTO v_orphaned_shipments_before;

  RAISE LOG '[DELETE_USER_COMPLETE] Orphaned shipments before deletion: %', v_orphaned_shipments_before;

  -- ========== STEP 3: SOFT-DELETE SPEDIZIONI ==========
  UPDATE shipments
  SET
    deleted = true,
    deleted_at = NOW(),
    deleted_by_user_id = p_admin_id,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND deleted = false;

  GET DIAGNOSTICS v_deleted_shipments_count = ROW_COUNT;

  RAISE LOG '[DELETE_USER_COMPLETE] Soft-deleted % shipments for user %',
    v_deleted_shipments_count, p_user_id;

  -- ========== STEP 4: ELIMINA USER FEATURES ==========
  -- Verifica se la tabella esiste prima di eliminare
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_features') THEN
    DELETE FROM user_features WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_deleted_features_count = ROW_COUNT;
    RAISE LOG '[DELETE_USER_COMPLETE] Deleted % features for user %', v_deleted_features_count, p_user_id;
  END IF;

  -- ========== STEP 5: ELIMINA PROFILI UTENTE (DYNAMIC SQL) ==========
  -- La tabella user_profiles potrebbe usare 'email' invece di 'user_id'
  -- Usiamo EXECUTE per evitare errori di compilazione
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
    -- Verifica quale colonna esiste
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'user_id'
    ) INTO v_user_profiles_has_user_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'email'
    ) INTO v_user_profiles_has_email;

    IF v_user_profiles_has_user_id THEN
      EXECUTE 'DELETE FROM user_profiles WHERE user_id = $1' USING p_user_id;
      GET DIAGNOSTICS v_deleted_profiles_count = ROW_COUNT;
    ELSIF v_user_profiles_has_email THEN
      EXECUTE 'DELETE FROM user_profiles WHERE email = $1' USING p_target_user_email;
      GET DIAGNOSTICS v_deleted_profiles_count = ROW_COUNT;
    ELSE
      -- Se non ha ne user_id ne email, skip
      RAISE LOG '[DELETE_USER_COMPLETE] user_profiles has no user_id or email column, skipping';
    END IF;

    RAISE LOG '[DELETE_USER_COMPLETE] Deleted % profiles for user %', v_deleted_profiles_count, p_user_id;
  END IF;

  -- ========== STEP 6: RECUPERA WALLET BALANCE FINALE ==========
  SELECT wallet_balance
  FROM users
  WHERE id = p_user_id
  INTO v_wallet_balance;

  RAISE LOG '[DELETE_USER_COMPLETE] Final wallet balance for user %: €%',
    p_user_id, v_wallet_balance;

  -- ========== STEP 7: HARD-DELETE UTENTE ==========
  DELETE FROM users
  WHERE id = p_user_id;

  RAISE LOG '[DELETE_USER_COMPLETE] Hard-deleted user %', p_user_id;

  -- ========== STEP 8: LOG OPERAZIONE IN AUDIT_LOGS ==========
  INSERT INTO audit_logs (
    action,
    resource_type,
    resource_id,
    user_email,
    user_id,
    severity,
    metadata,
    created_at
  ) VALUES (
    'user_deleted_complete',
    'user',
    p_user_id,
    p_admin_email,
    p_admin_id,
    'info',
    jsonb_build_object(
      'target_user_email', p_target_user_email,
      'target_user_name', p_target_user_name,
      'deleted_by_email', p_admin_email,
      'deleted_by_id', p_admin_id,
      'wallet_balance_final', v_wallet_balance,
      'deleted_shipments_count', v_deleted_shipments_count,
      'deleted_features_count', v_deleted_features_count,
      'deleted_profiles_count', v_deleted_profiles_count,
      'orphaned_shipments_before', v_orphaned_shipments_before,
      'timestamp', NOW()
    ),
    NOW()
  );

  RAISE LOG '[DELETE_USER_COMPLETE] Audit log created for user deletion %', p_user_id;

  -- ========== STEP 9: RETURN STATISTICS ==========
  RETURN QUERY SELECT
    v_deleted_shipments_count,
    v_deleted_features_count,
    v_deleted_profiles_count,
    v_wallet_balance,
    v_orphaned_shipments_before,
    'success'::TEXT;

  RAISE LOG '[DELETE_USER_COMPLETE] User deletion completed successfully: %', p_user_id;

EXCEPTION WHEN OTHERS THEN
  RAISE LOG '[DELETE_USER_COMPLETE] ERROR during user deletion %: %',
    p_user_id, SQLERRM;
  RAISE EXCEPTION 'Error in delete_user_complete(): %', SQLERRM;
END;
$$;

-- Grant permessi
GRANT EXECUTE ON FUNCTION delete_user_complete(UUID, UUID, TEXT, TEXT, TEXT)
  TO authenticated;

COMMENT ON FUNCTION delete_user_complete(UUID, UUID, TEXT, TEXT, TEXT) IS
'ENTERPRISE-GRADE atomic user deletion function (v4 - EXECUTE for dynamic SQL):
1. Soft-deletes all shipments (preserves audit trail)
2. Removes user features (if table exists)
3. Removes user profiles (uses EXECUTE for dynamic column detection)
4. Hard-deletes user account
5. Logs entire operation in audit_logs
SECURITY: SECURITY DEFINER + audit trail
ATOMICITY: All-or-nothing transaction';
