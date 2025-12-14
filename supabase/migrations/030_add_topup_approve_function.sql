-- ============================================
-- MIGRATION: 030_add_topup_approve_function.sql
-- DESCRIZIONE: Funzione SQL per approvare top_up_requests (bypassa RLS)
-- DATA: 2025-01
-- PREREQUISITO: Migration 027_wallet_topups.sql deve essere eseguita prima
-- ============================================

-- ============================================
-- STEP 1: Funzione per approvare top_up_requests (bypassa RLS)
-- ============================================

-- Funzione che aggiorna top_up_requests usando SECURITY DEFINER
-- Questo bypassa completamente RLS e può essere chiamata da service role
CREATE OR REPLACE FUNCTION approve_top_up_request(
  p_request_id UUID,
  p_admin_user_id UUID,
  p_approved_amount DECIMAL(10,2)
)
RETURNS TABLE(
  success BOOLEAN,
  error_message TEXT,
  updated_id UUID
) AS $$
DECLARE
  v_current_status TEXT;
  v_user_id UUID;
BEGIN
  -- Verifica che la richiesta esista e sia in stato approvabile
  SELECT status, user_id INTO v_current_status, v_user_id
  FROM top_up_requests
  WHERE id = p_request_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Richiesta non trovata'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  
  IF v_current_status NOT IN ('pending', 'manual_review') THEN
    RETURN QUERY SELECT FALSE, 'Richiesta già processata'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  
  -- Aggiorna la richiesta
  UPDATE top_up_requests
  SET 
    status = 'approved',
    approved_by = p_admin_user_id,
    approved_at = NOW(),
    approved_amount = p_approved_amount,
    updated_at = NOW()
  WHERE id = p_request_id
    AND status IN ('pending', 'manual_review');
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Impossibile aggiornare richiesta'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  
  -- Successo
  RETURN QUERY SELECT TRUE, NULL::TEXT, p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION approve_top_up_request IS 'Approva una richiesta top_up_requests. Bypassa RLS usando SECURITY DEFINER.';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration completata: Add TopUp Approve Function';
  RAISE NOTICE '   - Funzione approve_top_up_request() creata';
  RAISE NOTICE '   - Bypassa RLS usando SECURITY DEFINER';
  RAISE NOTICE '   - Usare come fallback se UPDATE diretto fallisce';
END $$;
