-- =====================================================
-- Migration: 106_delete_user_complete.sql
-- Descrizione: Funzione ENTERPRISE-GRADE per cancellazione atomica utente
--
-- Logica:
-- 1. Verifica integrità: controlla vincoli FK
-- 2. Soft-delete spedizioni (mark deleted = true)
-- 3. Cancella features associate
-- 4. Cancella profili
-- 5. Hard-delete utente
-- 6. Log operazione in audit_logs
--
-- SECURITY: SECURITY DEFINER + audit trail completo
-- ATOMICITY: Tutto avviene in una transazione
-- =====================================================

-- 1. Funzione principale: Cancellazione atomica completa utente
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
  -- Se ci sono spedizioni senza user_id, contale (diagnostica)
  SELECT COUNT(*)
  FROM shipments
  WHERE user_id IS NULL
  INTO v_orphaned_shipments_before;

  RAISE LOG '[DELETE_USER_COMPLETE] Orphaned shipments before deletion: %', v_orphaned_shipments_before;

  -- ========== STEP 3: SOFT-DELETE SPEDIZIONI ==========
  -- Non eliminare, solo marcare come deleted
  -- Questo preserva l'integrità storica per audit/analytics
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
  DELETE FROM user_features
  WHERE user_id = p_user_id;

  GET DIAGNOSTICS v_deleted_features_count = ROW_COUNT;

  RAISE LOG '[DELETE_USER_COMPLETE] Deleted % features for user %',
    v_deleted_features_count, p_user_id;

  -- ========== STEP 5: ELIMINA PROFILI UTENTE ==========
  DELETE FROM user_profiles
  WHERE user_id = p_user_id;

  GET DIAGNOSTICS v_deleted_profiles_count = ROW_COUNT;

  RAISE LOG '[DELETE_USER_COMPLETE] Deleted % profiles for user %',
    v_deleted_profiles_count, p_user_id;

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
    metadata,
    created_at
  ) VALUES (
    'user_deleted_complete',
    'user',
    p_user_id,
    p_admin_email,
    p_admin_id,
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
  RAISE;
END;
$$;

-- 2. Grant permessi all'API
GRANT EXECUTE ON FUNCTION delete_user_complete(UUID, UUID, TEXT, TEXT, TEXT)
  TO authenticated;

-- 3. Commenti documentazione
COMMENT ON FUNCTION delete_user_complete(UUID, UUID, TEXT, TEXT, TEXT) IS
'ENTERPRISE-GRADE atomic user deletion function:
1. Soft-deletes all shipments (preserves audit trail)
2. Removes user features and profiles
3. Hard-deletes user account
4. Logs entire operation in audit_logs with metadata
5. Returns deletion statistics
SECURITY: SECURITY DEFINER + audit trail
ATOMICITY: All-or-nothing transaction';

-- =====================================================
-- BONUS: Diagnostic function per controllare spedizioni orfane
-- =====================================================

CREATE OR REPLACE FUNCTION diagnose_orphaned_shipments()
RETURNS TABLE (
  orphaned_count BIGINT,
  total_count BIGINT,
  orphaned_total_revenue DECIMAL(10, 2),
  orphaned_avg_price DECIMAL(10, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH orphaned AS (
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(final_price), 0) as total_revenue,
      COALESCE(AVG(final_price), 0) as avg_price
    FROM shipments
    WHERE user_id IS NULL
      AND deleted = false
      AND deleted_at IS NULL
  ),
  all_shipments AS (
    SELECT COUNT(*) as count
    FROM shipments
    WHERE deleted = false
      AND deleted_at IS NULL
  )
  SELECT
    COALESCE(orphaned.count, 0),
    COALESCE(all_shipments.count, 0),
    COALESCE(orphaned.total_revenue, 0),
    COALESCE(orphaned.avg_price, 0)
  FROM orphaned, all_shipments;
END;
$$;

GRANT EXECUTE ON FUNCTION diagnose_orphaned_shipments()
  TO authenticated;

COMMENT ON FUNCTION diagnose_orphaned_shipments() IS
'Diagnostic function to identify orphaned shipments (user_id IS NULL)
and their financial impact on revenue calculations';

-- =====================================================
-- BONUS: Cleanup function per rimuovere spedizioni orfane
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_orphaned_shipments(
  p_admin_id UUID,
  p_admin_email TEXT,
  p_reason TEXT DEFAULT 'orphan_cleanup'
)
RETURNS TABLE (
  cleaned_count INTEGER,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cleaned_count INTEGER := 0;
BEGIN
  -- Soft-delete tutte le spedizioni orfane
  UPDATE shipments
  SET
    deleted = true,
    deleted_at = NOW(),
    deleted_by_user_id = p_admin_id,
    updated_at = NOW()
  WHERE user_id IS NULL
    AND deleted = false
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_cleaned_count = ROW_COUNT;

  -- Log operazione
  INSERT INTO audit_logs (
    action,
    resource_type,
    resource_id,
    user_email,
    user_id,
    metadata
  ) VALUES (
    'orphaned_shipments_cleanup',
    'shipments',
    gen_random_uuid(),
    p_admin_email,
    p_admin_id,
    jsonb_build_object(
      'cleaned_count', v_cleaned_count,
      'reason', p_reason,
      'timestamp', NOW()
    )
  );

  RETURN QUERY SELECT v_cleaned_count, 'success'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_orphaned_shipments(UUID, TEXT, TEXT)
  TO authenticated;

COMMENT ON FUNCTION cleanup_orphaned_shipments(UUID, TEXT, TEXT) IS
'Admin function to cleanup orphaned shipments (soft-delete all shipments with NULL user_id)
with full audit trail';
