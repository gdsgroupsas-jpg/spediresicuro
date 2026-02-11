-- =====================================================
-- Migration: Fix Supabase Database Linter Warnings
-- Created: 2026-02-15
-- Description: Risolve tutti i warning del Supabase linter:
--   1. function_search_path_mutable (42 funzioni) -> SET search_path = ''
--   2. extension_in_public (pg_trgm) -> spostata in schema extensions
--   3. rls_policy_always_true -> documentata come intenzionale
--
-- Riferimento: https://supabase.com/docs/guides/database/database-linter
-- =====================================================

-- =====================================================
-- PARTE 1: Fix search_path su TUTTE le funzioni public
-- =====================================================
-- Supabase raccomanda search_path = '' (vuoto) per prevenire
-- search_path hijacking su funzioni SECURITY DEFINER.
-- La migration precedente (20260125140000) usava search_path = public,
-- ma il linter richiede search_path vuoto.
-- Questa migration riapplica il fix con search_path = '' a tutte
-- le funzioni nel schema public.

DO $$
DECLARE
  func_record RECORD;
  alter_sql TEXT;
  fixed_count INT := 0;
  skipped_count INT := 0;
BEGIN
  FOR func_record IN
    SELECT
      p.proname AS func_name,
      pg_get_function_identity_arguments(p.oid) AS func_args,
      p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'  -- solo funzioni, non procedure
  LOOP
    BEGIN
      IF func_record.func_args = '' THEN
        alter_sql := format(
          'ALTER FUNCTION public.%I() SET search_path = ''''',
          func_record.func_name
        );
      ELSE
        alter_sql := format(
          'ALTER FUNCTION public.%I(%s) SET search_path = ''''',
          func_record.func_name,
          func_record.func_args
        );
      END IF;

      EXECUTE alter_sql;
      fixed_count := fixed_count + 1;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Skip %.%(%): %', 'public', func_record.func_name, func_record.func_args, SQLERRM;
      skipped_count := skipped_count + 1;
    END;
  END LOOP;

  RAISE NOTICE 'search_path fix completato: % funzioni fixate, % skippate', fixed_count, skipped_count;
END;
$$;

-- =====================================================
-- PARTE 2: Spostare pg_trgm in schema extensions
-- =====================================================
-- Il linter segnala pg_trgm installata in public.
-- Supabase raccomanda di usare lo schema "extensions" dedicato.
-- Nota: DROP + CREATE e' necessario perche' ALTER EXTENSION SET SCHEMA
-- potrebbe fallire se ci sono dipendenze (indici GIN con gin_trgm_ops).

-- Assicuriamoci che lo schema extensions esista
CREATE SCHEMA IF NOT EXISTS extensions;

-- Rimuoviamo prima l'indice che dipende da pg_trgm
DROP INDEX IF EXISTS public.idx_geo_locations_name_trgm;

-- Spostiamo l'estensione nello schema extensions
-- ALTER EXTENSION ... SET SCHEMA e' il modo raccomandato
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Ricreiamo l'indice usando l'operator class dal nuovo schema
CREATE INDEX IF NOT EXISTS idx_geo_locations_name_trgm
  ON public.geo_locations USING GIN (name extensions.gin_trgm_ops);

-- =====================================================
-- PARTE 3: RLS Policy Always True - NESSUNA AZIONE
-- =====================================================
-- Le seguenti policy con WITH CHECK (true) sono INTENZIONALI:
--
-- 1. admin_actions_log: INSERT con true
--    -> Tabella di audit, inserita SOLO da service_role server-side.
--       RLS non applica al service_role (bypassa automaticamente).
--       La policy esiste per sicurezza difensiva.
--
-- 2. tracking_events: INSERT con true
--    -> Eventi tracking inseriti SOLO da API server-side con service_role.
--       Nessun utente autenticato puo' inserire direttamente.
--
-- 3. workspace_custom_domains: INSERT con true
--    -> Policy per owner/admin con proper authorization check su workspace_id.
--       Non e' una policy "true" pura - ha controllo workspace membership.
--
-- 4. COD tables (cod_files, cod_items, cod_distinte, cod_disputes):
--    -> Service role only, gestite interamente server-side.
--
-- 5. Support system (support_escalations, support_notifications, etc.):
--    -> Service role only, gestite da Anne AI server-side.
--
-- DECISIONE: Non modificare queste policy. Il pattern service_role + WITH CHECK(true)
-- e' corretto per tabelle gestite esclusivamente lato server.
-- Il linter non distingue tra policy per ruoli specifici (service_role)
-- e policy per authenticated, generando falsi positivi.

-- =====================================================
-- VERIFICA: Query per confermare che tutti i warning sono risolti
-- =====================================================
-- Eseguire dopo la migration per verificare:
--
-- 1. Funzioni con search_path mutable (dovrebbe essere 0):
-- SELECT p.proname, pg_get_function_identity_arguments(p.oid)
-- FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public' AND p.prokind = 'f'
--   AND (p.proconfig IS NULL
--        OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'));
--
-- 2. Estensioni in public (dovrebbe non includere pg_trgm):
-- SELECT e.extname, n.nspname
-- FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid
-- WHERE n.nspname = 'public';
