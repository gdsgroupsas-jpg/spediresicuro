-- ============================================================================
-- Migration: Fix RPC Grants & search_path Security Hardening
-- Data: 2026-02-18
-- Autore: Claude (audit sicurezza FASE 2)
--
-- Questa migration corregge 3 categorie di problemi di sicurezza:
--
-- P1: get_admin_overview_stats + delete_user_complete — GRANT troppo permissivo
--     Queste funzioni erano accessibili da authenticated (utenti normali).
--     Devono essere ristrette a service_role only (chiamate solo dal backend).
--
-- P2: Wallet RPC v2 (5 funzioni) — GRANT authenticated → service_role
--     Le RPC wallet v2 vengono chiamate SOLO dal backend via service_role.
--     Il GRANT a authenticated era un rischio: un utente malevolo potrebbe
--     chiamare direttamente la RPC bypassando i controlli applicativi.
--
-- P3: 5 funzioni con search_path = public senza pg_temp
--     pg_temp è necessario per prevenire attacchi via schema temp hijacking.
--
-- Pattern: DO $$ ... EXCEPTION WHEN undefined_function ... per idempotenza.
-- Se una funzione non esiste (es. diverso ambiente), il blocco viene skippato.
-- ============================================================================

-- ============================================
-- FIX P1: get_admin_overview_stats
-- Restringe accesso a service_role only.
-- Era accessibile da authenticated (rischio: utente normale vede stats admin).
-- ============================================
DO $$ BEGIN
  ALTER FUNCTION public.get_admin_overview_stats() SET search_path = public, pg_temp;
  REVOKE ALL ON FUNCTION public.get_admin_overview_stats() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.get_admin_overview_stats() FROM authenticated;
  GRANT EXECUTE ON FUNCTION public.get_admin_overview_stats() TO service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ============================================
-- FIX P1: delete_user_complete
-- Restringe a service_role only.
-- Funzione distruttiva — MAI accessibile da authenticated.
-- ============================================
DO $$ BEGIN
  ALTER FUNCTION public.delete_user_complete(UUID, UUID, TEXT, TEXT, TEXT) SET search_path = public, pg_temp;
  REVOKE ALL ON FUNCTION public.delete_user_complete(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.delete_user_complete(UUID, UUID, TEXT, TEXT, TEXT) FROM authenticated;
  GRANT EXECUTE ON FUNCTION public.delete_user_complete(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ============================================
-- FIX P2: Wallet RPC v2 — restringe a service_role only
-- Tutte le 5 RPC wallet v2 vengono chiamate SOLO dal backend (service_role).
-- Il GRANT a authenticated era un rischio di privilege escalation.
-- Le signature sono prese da 20260218100000 + 20260218110000.
-- ============================================

-- 1. add_wallet_credit_v2(UUID, UUID, DECIMAL, TEXT, UUID, TEXT)
DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.add_wallet_credit_v2(UUID, UUID, DECIMAL, TEXT, UUID, TEXT) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.add_wallet_credit_v2(UUID, UUID, DECIMAL, TEXT, UUID, TEXT) FROM authenticated;
  GRANT EXECUTE ON FUNCTION public.add_wallet_credit_v2(UUID, UUID, DECIMAL, TEXT, UUID, TEXT) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 2. deduct_wallet_credit_v2(UUID, UUID, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT)
DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.deduct_wallet_credit_v2(UUID, UUID, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.deduct_wallet_credit_v2(UUID, UUID, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT) FROM authenticated;
  GRANT EXECUTE ON FUNCTION public.deduct_wallet_credit_v2(UUID, UUID, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 3. refund_wallet_balance_v2(UUID, UUID, DECIMAL, TEXT, TEXT, UUID)
DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.refund_wallet_balance_v2(UUID, UUID, DECIMAL, TEXT, TEXT, UUID) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.refund_wallet_balance_v2(UUID, UUID, DECIMAL, TEXT, TEXT, UUID) FROM authenticated;
  GRANT EXECUTE ON FUNCTION public.refund_wallet_balance_v2(UUID, UUID, DECIMAL, TEXT, TEXT, UUID) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 4. add_wallet_credit_with_vat_v2(UUID, UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT)
DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.add_wallet_credit_with_vat_v2(UUID, UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.add_wallet_credit_with_vat_v2(UUID, UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT) FROM authenticated;
  GRANT EXECUTE ON FUNCTION public.add_wallet_credit_with_vat_v2(UUID, UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 5. reseller_transfer_credit_v2(UUID, UUID, UUID, UUID, DECIMAL, TEXT, TEXT)
DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.reseller_transfer_credit_v2(UUID, UUID, UUID, UUID, DECIMAL, TEXT, TEXT) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.reseller_transfer_credit_v2(UUID, UUID, UUID, UUID, DECIMAL, TEXT, TEXT) FROM authenticated;
  GRANT EXECUTE ON FUNCTION public.reseller_transfer_credit_v2(UUID, UUID, UUID, UUID, DECIMAL, TEXT, TEXT) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ============================================
-- FIX P3: search_path pg_temp mancante
-- Aggiunge pg_temp a funzioni che avevano solo search_path = public.
-- pg_temp previene attacchi via schema temp hijacking (CVE noto PostgreSQL).
-- ============================================
DO $$ BEGIN
  ALTER FUNCTION public.count_visible_shipments(UUID) SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.get_shipments_for_workspace(UUID, INTEGER, INTEGER, TEXT) SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.get_workspace_stats(UUID) SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.get_user_vat_mode(UUID) SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.bulk_update_user_listini(UUID[], UUID) SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- ============================================
-- NOTA P3 (rischio accettato): messaggi di errore RPC wallet v2
-- ============================================
-- NOTA: i messaggi di errore nelle RPC wallet v2 espongono UUID e saldi nei RAISE EXCEPTION.
-- Questo è un rischio P3 accettato: gli errori sono catturati dal backend e non esposti al client
-- (il fix error.message è stato applicato nei file TypeScript).
-- Cambiare i RAISE EXCEPTION richiederebbe CREATE OR REPLACE su tutte le RPC v2,
-- rischio troppo alto per un P3. Il backend già sanitizza i messaggi di errore.

-- ============================================
-- Completamento
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 20260218130000 completata';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIX P1: get_admin_overview_stats — service_role only + search_path fix';
  RAISE NOTICE 'FIX P1: delete_user_complete — service_role only + search_path fix';
  RAISE NOTICE 'FIX P2: 5x wallet RPC v2 — revoke authenticated, grant service_role only';
  RAISE NOTICE 'FIX P3: 5x funzioni — aggiunto pg_temp a search_path';
  RAISE NOTICE 'SKIP P3: error messages RPC — rischio accettato (backend sanitizza)';
  RAISE NOTICE '========================================';
END $$;
