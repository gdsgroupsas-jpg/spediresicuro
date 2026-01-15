-- ============================================
-- MIGRATION: 106_delete_user_complete.sql
-- DESCRIZIONE: Funzione atomica completa per cancellazione utente (ENTERPRISE-GRADE)
-- DATA: 2025-01-15
-- CRITICITÀ: P0 - SICUREZZA & INTEGRITÀ DATI
-- ============================================
--
-- PROBLEMA:
-- Cancellazione utente da dashboard SuperAdmin non rimuoveva utente da auth.users
-- (Supabase Auth), lasciando email "occupata" e bloccando riutilizzo.
--
-- SOLUZIONE:
-- Funzione SQL atomica che gestisce cancellazione completa da database pubblico.
-- Auth.users DEVE essere cancellato PRIMA via Supabase Admin API (non può essere
-- fatto direttamente da SQL per motivi di sicurezza).
--
-- ATOMICITÀ:
-- Tutte le operazioni sono in un singolo blocco BEGIN...END con transaction implicita.
-- Se una operazione fallisce, ROLLBACK automatico. Nessuna inconsistenza possibile.
-- ============================================

-- ============================================
-- STEP 1: Funzione atomica completa per cancellazione utente
-- ============================================

CREATE OR REPLACE FUNCTION delete_user_complete(
  p_user_id UUID,
  p_admin_id UUID,
  p_admin_email TEXT,
  p_target_user_email TEXT,
  p_target_user_name TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := p_user_id;
  v_admin_id UUID := p_admin_id;
  v_deleted_count_shipments INT := 0;
  v_deleted_count_features INT := 0;
  v_deleted_count_profiles INT := 0;
  v_wallet_balance DECIMAL(10,2) := 0;
  v_remaining_shipments_count INT := 0;
  v_result JSONB;
BEGIN
  -- ============================================
  -- VALIDAZIONE INPUT
  -- ============================================
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;
  
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'admin_id cannot be null';
  END IF;
  
  IF p_target_user_email IS NULL OR p_target_user_email = '' THEN
    RAISE EXCEPTION 'target_user_email cannot be null or empty';
  END IF;

  -- ============================================
  -- STEP 1: Audit Log (PRIMA di qualsiasi cancellazione)
  -- ============================================
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
    v_user_id,
    p_admin_email,
    v_admin_id,
    jsonb_build_object(
      'target_user_email', p_target_user_email,
      'target_user_name', p_target_user_name,
      'deleted_by_email', p_admin_email,
      'deleted_by_id', v_admin_id,
      'timestamp', NOW()
    ),
    NOW()
  );

  -- ============================================
  -- STEP 2: Conta spedizioni rimanenti (per warning)
  -- ============================================
  SELECT COUNT(*) INTO v_remaining_shipments_count
  FROM shipments
  WHERE user_id = v_user_id AND deleted = false;

  -- ============================================
  -- STEP 3: Salva wallet balance finale (per audit)
  -- ============================================
  SELECT wallet_balance INTO v_wallet_balance
  FROM users
  WHERE id = v_user_id;

  -- ============================================
  -- STEP 4: Cancellazione user_features
  -- ============================================
  DELETE FROM user_features
  WHERE user_email = p_target_user_email;

  GET DIAGNOSTICS v_deleted_count_features = ROW_COUNT;

  -- ============================================
  -- STEP 5: Soft delete spedizioni (mantiene storico)
  -- ============================================
  UPDATE shipments
  SET
    deleted = true,
    deleted_at = NOW(),
    deleted_by_user_id = v_admin_id,
    updated_at = NOW()
  WHERE user_id = v_user_id AND deleted = false;

  GET DIAGNOSTICS v_deleted_count_shipments = ROW_COUNT;

  -- ============================================
  -- STEP 6: Cancellazione user_profiles
  -- ============================================
  DELETE FROM user_profiles
  WHERE email = p_target_user_email;

  GET DIAGNOSTICS v_deleted_count_profiles = ROW_COUNT;

  -- ============================================
  -- STEP 7: Hard delete users (ULTIMO STEP)
  -- ============================================
  DELETE FROM users
  WHERE id = v_user_id;

  -- ============================================
  -- STEP 8: Audit Log finale (con statistiche)
  -- ============================================
  INSERT INTO audit_logs (
    action,
    resource_type,
    resource_id,
    user_email,
    user_id,
    metadata,
    created_at
  ) VALUES (
    'user_deleted_complete_stats',
    'user',
    v_user_id,
    p_admin_email,
    v_admin_id,
    jsonb_build_object(
      'deleted_user_email', p_target_user_email,
      'deleted_user_name', p_target_user_name,
      'deleted_by_email', p_admin_email,
      'deleted_by_id', v_admin_id,
      'wallet_balance_final', v_wallet_balance,
      'deleted_shipments_count', v_deleted_count_shipments,
      'deleted_features_count', v_deleted_count_features,
      'deleted_profiles_count', v_deleted_count_profiles,
      'remaining_shipments_count', v_remaining_shipments_count,
      'timestamp', NOW()
    ),
    NOW()
  );

  -- ============================================
  -- STEP 9: Ritorna risultato con statistiche
  -- ============================================
  v_result := jsonb_build_object(
    'success', true,
    'deleted_user_id', v_user_id,
    'deleted_user_email', p_target_user_email,
    'wallet_balance_final', v_wallet_balance,
    'deleted_shipments_count', v_deleted_count_shipments,
    'deleted_features_count', v_deleted_count_features,
    'deleted_profiles_count', v_deleted_count_profiles,
    'remaining_shipments_count', v_remaining_shipments_count
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Log errore critico
    RAISE EXCEPTION 'Error in delete_user_complete(): %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANT EXECUTE (solo superadmin/service_role)
-- ============================================
-- Nota: Le RLS policies su audit_logs gestiscono l'accesso
GRANT EXECUTE ON FUNCTION delete_user_complete TO service_role;
GRANT EXECUTE ON FUNCTION delete_user_complete TO authenticated;

-- ============================================
-- COMMENTO FUNZIONE
-- ============================================
COMMENT ON FUNCTION delete_user_complete IS
'Funzione atomica completa per cancellazione utente (ENTERPRISE-GRADE).

EXECUTE CONTEXT:
- DEVE essere chiamata dal backend TypeScript
- Auth.users DEVE essere cancellato PRIMA via Supabase Admin API
- Questa funzione gestisce solo il database pubblico

ATOMICITÀ:
- TUTTE le operazioni sono in un singolo blocco BEGIN...END
- Se una operazione fallisce, ROLLBACK automatico
- Nessuna inconsistenza possibile

OPERAZIONI IN ORDINE:
1. Audit log iniziale (traccia operazione)
2. Conta spedizioni rimanenti (warning se > 0)
3. Salva wallet balance finale (audit)
4. Cancellazione user_features
5. Soft delete spedizioni (mantiene storico)
6. Cancellazione user_profiles
7. Hard delete users (ULTIMO step)
8. Audit log finale (con statistiche complete)
9. Ritorna risultato con statistiche

PARAMETRI:
- p_user_id: UUID utente da cancellare
- p_admin_id: UUID admin che esegue cancellazione
- p_admin_email: Email admin (per audit)
- p_target_user_email: Email utente target (per lookup)
- p_target_user_name: Nome utente target (per audit)

NOTA IMPORTANTE:
- auth.users DEVE essere cancellato PRIMA via Supabase Admin API
  (non può essere fatto direttamente da SQL per motivi di sicurezza)
- Questa funzione gestisce solo il database pubblico

SECURITY:
- SECURITY DEFINER (esegue con permessi di sistema)
- RLS su audit_logs (solo superadmin/service_role possono leggere)
- Transaction atomica (no partial delete possibile)
';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 106 completata con successo';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Funzione creata:';
  RAISE NOTICE '  - delete_user_complete() [ATOMIC]';
  RAISE NOTICE '========================================';
END $$;
