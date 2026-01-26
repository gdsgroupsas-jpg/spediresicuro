-- =====================================================
-- Migration: 20260126170000_fix_delete_user_skip_profiles.sql
-- Descrizione: Fix delete_user_complete - versione finale funzionante
--
-- FIX APPLICATI:
-- 1. Rimosso user_id dall'INSERT audit_logs (FK constraint)
-- 2. Rimosso resource_id dall'INSERT audit_logs (FK constraint)
-- 3. Spostato audit log DOPO delete utente
-- 4. Rimosso riferimenti a user_features (no user_id column)
-- 5. Rimosso riferimenti a user_profiles (no user_id column)
-- =====================================================

DROP FUNCTION IF EXISTS delete_user_complete(UUID, UUID, TEXT, TEXT, TEXT);

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
  v_wallet_balance DECIMAL(10, 2) := 0;
  v_orphaned_shipments_before INTEGER := 0;
BEGIN
  -- Verifica utente esiste
  IF NOT EXISTS(SELECT 1 FROM users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  -- Conta spedizioni orfane prima
  SELECT COUNT(*) FROM shipments WHERE user_id IS NULL INTO v_orphaned_shipments_before;

  -- Soft-delete spedizioni
  UPDATE shipments
  SET deleted = true, deleted_at = NOW(), deleted_by_user_id = p_admin_id, updated_at = NOW()
  WHERE user_id = p_user_id AND deleted = false;
  GET DIAGNOSTICS v_deleted_shipments_count = ROW_COUNT;

  -- Recupera wallet balance
  SELECT wallet_balance FROM users WHERE id = p_user_id INTO v_wallet_balance;

  -- Elimina utente
  DELETE FROM users WHERE id = p_user_id;

  -- Audit log DOPO delete (senza user_id e resource_id per evitare FK)
  INSERT INTO audit_logs (action, resource_type, user_email, severity, message, metadata, created_at)
  VALUES ('user_deleted_complete', 'user', p_admin_email, 'info',
    'Utente ' || p_target_user_email || ' eliminato',
    jsonb_build_object(
      'deleted_user_id', p_user_id::text,
      'admin_id', p_admin_id::text,
      'target_user_email', p_target_user_email,
      'target_user_name', p_target_user_name,
      'wallet_balance_final', v_wallet_balance,
      'deleted_shipments_count', v_deleted_shipments_count
    ), NOW()
  );

  RETURN QUERY SELECT v_deleted_shipments_count, 0, 0, v_wallet_balance, v_orphaned_shipments_before, 'success'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error in delete_user_complete(): %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_complete(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION delete_user_complete(UUID, UUID, TEXT, TEXT, TEXT) IS
'Atomic user deletion function (v6 - final working version):
1. Soft-deletes all shipments
2. Hard-deletes user account
3. Logs in audit_logs (without FK references)
SECURITY: SECURITY DEFINER
ATOMICITY: All-or-nothing transaction';
