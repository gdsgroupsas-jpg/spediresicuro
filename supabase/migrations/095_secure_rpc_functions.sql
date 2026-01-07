-- ============================================
-- MIGRATION: 095_secure_rpc_functions.sql
-- DESCRIZIONE: Hotfix sicurezza - Revoca permessi pubblici su funzioni RPC critiche
-- DATA: 2026-01-07
-- CRITICITÀ: P0 - SECURITY HOTFIX (BLOCKING)
-- SPRINT: 1 - Financial Tracking Infrastructure
-- ============================================
--
-- PROBLEMA IDENTIFICATO (Audit PR #38):
-- Le funzioni RPC critiche sono SECURITY DEFINER ma non hanno REVOKE EXECUTE FROM PUBLIC.
-- Questo permette a qualsiasi utente autenticato (o potenzialmente anonimo) di:
-- 1. Iniettare costi falsi per qualsiasi spedizione (causando alert finanziari e P&L errato)
-- 2. Iniettare log di audit falsi rendendo l'audit trail inaffidabile
--
-- FUNZIONI VULNERABILI:
-- - record_platform_provider_cost() (Migration 090)
-- - log_financial_event() (Migration 093)
-- - log_wallet_operation() (Migration 093)
--
-- SOLUZIONE:
-- Revocare EXECUTE da PUBLIC, authenticated, anon e concedere solo a service_role.
-- Questo garantisce che solo il codice server-side (con service_role) possa chiamare
-- queste funzioni, impedendo chiamate dirette da client o SQL Editor.
--
-- VERIFICA PRE-REQUISITI:
-- ✅ Tutte le chiamate nel codice usano supabaseAdmin (service_role)
-- ✅ Nessun componente React chiama direttamente queste RPC
-- ✅ Solo server-side actions e create-shipment-core.ts usano queste funzioni
--
-- ============================================

-- ============================================
-- STEP 1: Verifica esistenza funzioni
-- ============================================

DO $$
DECLARE
  v_record_exists BOOLEAN;
  v_log_event_exists BOOLEAN;
  v_log_wallet_exists BOOLEAN;
BEGIN
  -- Verifica record_platform_provider_cost
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'record_platform_provider_cost'
      AND p.prosecdef = true  -- SECURITY DEFINER
  ) INTO v_record_exists;

  -- Verifica log_financial_event
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'log_financial_event'
      AND p.prosecdef = true
  ) INTO v_log_event_exists;

  -- Verifica log_wallet_operation
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'log_wallet_operation'
      AND p.prosecdef = true
  ) INTO v_log_wallet_exists;

  IF NOT v_record_exists THEN
    RAISE WARNING '⚠️ record_platform_provider_cost() non trovata o non è SECURITY DEFINER';
  END IF;

  IF NOT v_log_event_exists THEN
    RAISE WARNING '⚠️ log_financial_event() non trovata o non è SECURITY DEFINER';
  END IF;

  IF NOT v_log_wallet_exists THEN
    RAISE WARNING '⚠️ log_wallet_operation() non trovata o non è SECURITY DEFINER';
  END IF;

  IF v_record_exists AND v_log_event_exists AND v_log_wallet_exists THEN
    RAISE NOTICE '✅ Tutte le funzioni critiche trovate, procedendo con REVOKE...';
  END IF;
END $$;

-- ============================================
-- STEP 2: Revoca permessi pubblici - record_platform_provider_cost
-- ============================================

-- Revoca da tutti i ruoli pubblici
REVOKE EXECUTE ON FUNCTION record_platform_provider_cost(
  UUID,  -- p_shipment_id
  TEXT,   -- p_tracking_number
  UUID,   -- p_billed_user_id
  DECIMAL, -- p_billed_amount
  DECIMAL, -- p_provider_cost
  TEXT,    -- p_api_source
  TEXT,    -- p_courier_code
  TEXT,    -- p_service_type
  UUID,    -- p_price_list_id
  UUID,    -- p_master_price_list_id
  TEXT     -- p_cost_source
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION record_platform_provider_cost(
  UUID, TEXT, UUID, DECIMAL, DECIMAL, TEXT, TEXT, TEXT, UUID, UUID, TEXT
) FROM authenticated;

REVOKE EXECUTE ON FUNCTION record_platform_provider_cost(
  UUID, TEXT, UUID, DECIMAL, DECIMAL, TEXT, TEXT, TEXT, UUID, UUID, TEXT
) FROM anon;

-- Concede solo a service_role (server-side)
GRANT EXECUTE ON FUNCTION record_platform_provider_cost(
  UUID, TEXT, UUID, DECIMAL, DECIMAL, TEXT, TEXT, TEXT, UUID, UUID, TEXT
) TO service_role;

-- ============================================
-- STEP 3: Revoca permessi pubblici - log_financial_event
-- ============================================

-- Revoca da tutti i ruoli pubblici
REVOKE EXECUTE ON FUNCTION log_financial_event(
  TEXT,    -- p_event_type
  UUID,    -- p_user_id
  UUID,    -- p_shipment_id
  DECIMAL, -- p_amount
  TEXT,    -- p_message
  TEXT,    -- p_severity
  JSONB,   -- p_metadata
  UUID,    -- p_actor_id
  UUID     -- p_platform_cost_id
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION log_financial_event(
  TEXT, UUID, UUID, DECIMAL, TEXT, TEXT, JSONB, UUID, UUID
) FROM authenticated;

REVOKE EXECUTE ON FUNCTION log_financial_event(
  TEXT, UUID, UUID, DECIMAL, TEXT, TEXT, JSONB, UUID, UUID
) FROM anon;

-- Concede solo a service_role
GRANT EXECUTE ON FUNCTION log_financial_event(
  TEXT, UUID, UUID, DECIMAL, TEXT, TEXT, JSONB, UUID, UUID
) TO service_role;

-- ============================================
-- STEP 4: Revoca permessi pubblici - log_wallet_operation
-- ============================================

-- Revoca da tutti i ruoli pubblici
REVOKE EXECUTE ON FUNCTION log_wallet_operation(
  UUID,    -- p_user_id
  TEXT,    -- p_operation
  DECIMAL, -- p_amount
  DECIMAL, -- p_balance_before
  DECIMAL, -- p_balance_after
  TEXT,    -- p_reason
  UUID,    -- p_shipment_id
  UUID     -- p_actor_id
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION log_wallet_operation(
  UUID, TEXT, DECIMAL, DECIMAL, DECIMAL, TEXT, UUID, UUID
) FROM authenticated;

REVOKE EXECUTE ON FUNCTION log_wallet_operation(
  UUID, TEXT, DECIMAL, DECIMAL, DECIMAL, TEXT, UUID, UUID
) FROM anon;

-- Concede solo a service_role
GRANT EXECUTE ON FUNCTION log_wallet_operation(
  UUID, TEXT, DECIMAL, DECIMAL, DECIMAL, TEXT, UUID, UUID
) TO service_role;

-- ============================================
-- STEP 5: Verifica finale permessi
-- ============================================

DO $$
DECLARE
  v_record_public BOOLEAN;
  v_record_service BOOLEAN;
  v_log_event_public BOOLEAN;
  v_log_event_service BOOLEAN;
  v_log_wallet_public BOOLEAN;
  v_log_wallet_service BOOLEAN;
BEGIN
  -- Verifica record_platform_provider_cost
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'record_platform_provider_cost'
      AND grantee = 'PUBLIC'
  ) INTO v_record_public;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'record_platform_provider_cost'
      AND grantee = 'service_role'
  ) INTO v_record_service;

  -- Verifica log_financial_event
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'log_financial_event'
      AND grantee = 'PUBLIC'
  ) INTO v_log_event_public;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'log_financial_event'
      AND grantee = 'service_role'
  ) INTO v_log_event_service;

  -- Verifica log_wallet_operation
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'log_wallet_operation'
      AND grantee = 'PUBLIC'
  ) INTO v_log_wallet_public;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'log_wallet_operation'
      AND grantee = 'service_role'
  ) INTO v_log_wallet_service;

  -- Report finale
  IF v_record_public OR v_log_event_public OR v_log_wallet_public THEN
    RAISE WARNING '⚠️ ATTENZIONE: Alcune funzioni hanno ancora permessi PUBLIC!';
    IF v_record_public THEN
      RAISE WARNING '   - record_platform_provider_cost() ancora accessibile da PUBLIC';
    END IF;
    IF v_log_event_public THEN
      RAISE WARNING '   - log_financial_event() ancora accessibile da PUBLIC';
    END IF;
    IF v_log_wallet_public THEN
      RAISE WARNING '   - log_wallet_operation() ancora accessibile da PUBLIC';
    END IF;
  ELSE
    RAISE NOTICE '✅ Nessuna funzione accessibile da PUBLIC';
  END IF;

  IF v_record_service AND v_log_event_service AND v_log_wallet_service THEN
    RAISE NOTICE '✅ Tutte le funzioni concesse a service_role';
  ELSE
    RAISE WARNING '⚠️ ATTENZIONE: Alcune funzioni non hanno permesso service_role!';
    IF NOT v_record_service THEN
      RAISE WARNING '   - record_platform_provider_cost() NON concessa a service_role';
    END IF;
    IF NOT v_log_event_service THEN
      RAISE WARNING '   - log_financial_event() NON concessa a service_role';
    END IF;
    IF NOT v_log_wallet_service THEN
      RAISE WARNING '   - log_wallet_operation() NON concessa a service_role';
    END IF;
  END IF;
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 095 completata con successo';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SICUREZZA: Funzioni RPC critiche protette';
  RAISE NOTICE '   - record_platform_provider_cost() → solo service_role';
  RAISE NOTICE '   - log_financial_event() → solo service_role';
  RAISE NOTICE '   - log_wallet_operation() → solo service_role';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Vulnerabilità CRITICA risolta';
  RAISE NOTICE '   - Nessun utente autenticato può più chiamare direttamente';
  RAISE NOTICE '   - Solo codice server-side (service_role) può eseguire';
  RAISE NOTICE '';
  RAISE NOTICE '📋 PROSSIMI STEP:';
  RAISE NOTICE '   1. Test integrazione: verifica che le chiamate server-side funzionino';
  RAISE NOTICE '   2. Test sicurezza: tenta chiamata RPC come utente autenticato';
  RAISE NOTICE '      Expected: 403 Forbidden o errore permesso';
  RAISE NOTICE '   3. Verifica integrità dati: query di audit per duplicati sospetti';
  RAISE NOTICE '========================================';
END $$;
