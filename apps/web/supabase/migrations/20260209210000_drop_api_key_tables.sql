-- ============================================================
-- Migration: Rimozione completa API Key Authentication (FASE 1)
--
-- FASE 1 rimossa per decisione CTO: implementazione incompleta
-- (score audit 3.75/10), feature flag sempre OFF, zero utilizzo.
-- Sara' reimplementata da zero se necessario.
--
-- Droppa: api_audit_log, api_keys, funzioni SQL associate
-- ============================================================

-- Drop funzioni
DROP FUNCTION IF EXISTS public.get_api_key_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.find_stale_api_keys() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_audit_logs() CASCADE;

-- Drop tabelle (ordine: FK prima)
DROP TABLE IF EXISTS public.api_audit_log CASCADE;
DROP TABLE IF EXISTS public.api_keys CASCADE;

-- Verifica
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'api_keys') THEN
    RAISE EXCEPTION 'Tabella api_keys ancora presente dopo rollback';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'api_audit_log') THEN
    RAISE EXCEPTION 'Tabella api_audit_log ancora presente dopo rollback';
  END IF;
  RAISE NOTICE 'API Key Authentication rimossa con successo';
END $$;
