-- ============================================
-- MIGRATION: 097_fix_assign_price_list_auth.sql
-- DESCRIZIONE: Fix autenticazione funzione assign_price_list per supportare service_role
-- DATA: 2025-01-10
-- 
-- PROBLEMA: La funzione assign_price_list() usa auth.uid() che è NULL quando chiamata
-- tramite supabaseAdmin (service_role), causando errore "Non autenticato".
-- 
-- SOLUZIONE: Aggiungere parametro opzionale p_caller_id per supportare chiamate da service_role
-- ============================================

-- ============================================
-- STEP 1: Rimuovi tutte le versioni esistenti della funzione
-- ============================================

-- Rimuovi tutte le versioni esistenti della funzione (se esistono)
-- PostgreSQL richiede di specificare la signature completa per funzioni con overload
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Trova tutte le versioni della funzione e rimuovile
  FOR r IN 
    SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc 
    WHERE proname = 'assign_price_list'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s(%s)', r.proname, r.args);
    RAISE NOTICE 'Rimossa funzione: %(%)', r.proname, r.args;
  END LOOP;
END $$;

-- ============================================
-- STEP 2: Crea nuova versione della funzione
-- ============================================

CREATE OR REPLACE FUNCTION assign_price_list(
  p_price_list_id UUID,
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_caller_id UUID DEFAULT NULL  -- ✨ NUOVO: Parametro opzionale per service_role
)
RETURNS UUID AS $$
DECLARE
  v_assignment_id UUID;
  v_caller_id UUID;
  v_is_admin BOOLEAN;
  v_existing_id UUID;
BEGIN
  -- ✨ FIX: Supporta sia auth.uid() (client autenticato) che p_caller_id (service_role)
  v_caller_id := COALESCE(auth.uid(), p_caller_id);
  
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Non autenticato';
  END IF;
  
  -- Verifica permessi (solo superadmin può assegnare)
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE id = v_caller_id 
    AND account_type = 'superadmin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Non autorizzato: solo superadmin può assegnare listini';
  END IF;
  
  -- Verifica che il listino esista
  IF NOT EXISTS (SELECT 1 FROM price_lists WHERE id = p_price_list_id) THEN
    RAISE EXCEPTION 'Listino non trovato: %', p_price_list_id;
  END IF;
  
  -- Verifica che l'utente esista
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Utente non trovato: %', p_user_id;
  END IF;
  
  -- Verifica assegnazione esistente attiva
  SELECT id INTO v_existing_id
  FROM price_list_assignments
  WHERE price_list_id = p_price_list_id
    AND user_id = p_user_id
    AND revoked_at IS NULL;
  
  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Assegnazione già esistente per questo listino e utente (ID: %)', v_existing_id;
  END IF;
  
  -- Crea assegnazione
  INSERT INTO price_list_assignments (
    price_list_id,
    user_id,
    assigned_by,
    assigned_at,
    notes
  )
  VALUES (
    p_price_list_id,
    p_user_id,
    v_caller_id,
    NOW(),
    p_notes
  )
  RETURNING id INTO v_assignment_id;
  
  RAISE NOTICE '✅ Listino % assegnato a utente % da caller % (assignment ID: %)', 
    p_price_list_id, p_user_id, v_caller_id, v_assignment_id;
  
  RETURN v_assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

COMMENT ON FUNCTION assign_price_list IS 
  'Assegna un listino a un utente. Solo superadmin. Previene duplicati attivi. Supporta sia auth.uid() che p_caller_id per service_role.';

-- ============================================
-- STEP 2: Verifica funzione aggiornata
-- ============================================

DO $$
BEGIN
  -- Verifica che la funzione esista con la nuova signature
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'assign_price_list'
    AND pg_get_function_arguments(oid) LIKE '%p_caller_id%'
  ) THEN
    RAISE EXCEPTION 'FAIL: Funzione assign_price_list non aggiornata correttamente';
  END IF;
  
  RAISE NOTICE '✅ Funzione assign_price_list aggiornata con supporto p_caller_id';
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 097 completata con successo';
  RAISE NOTICE '✅ Funzione assign_price_list aggiornata';
  RAISE NOTICE '';
  RAISE NOTICE 'Fix applicato:';
  RAISE NOTICE '  - Aggiunto parametro p_caller_id opzionale';
  RAISE NOTICE '  - Supporto per chiamate da service_role';
  RAISE NOTICE '  - Mantiene compatibilità con auth.uid()';
  RAISE NOTICE '';
  RAISE NOTICE 'Prossimi step:';
  RAISE NOTICE '  1. Aggiornare action TypeScript per passare p_caller_id';
  RAISE NOTICE '  2. Testare assegnazione listino da superadmin';
  RAISE NOTICE '========================================';
END $$;
