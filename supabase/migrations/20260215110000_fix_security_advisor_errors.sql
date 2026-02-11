-- =====================================================
-- Migration: Fix Supabase Security Advisor ERRORS
-- Created: 2026-02-15
-- Description: Risolve tutti gli ERROR del Security Advisor:
--   1. security_definer_view: v_platform_margin_alerts -> security_invoker = true
--   2. rls_disabled_in_public: users, shipments, couriers, price_lists,
--      platform_provider_costs -> ENABLE ROW LEVEL SECURITY + policy
--   3. sensitive_columns_exposed: users.password -> revoke anon select
--
-- NOTA CRITICA: Tutta l'app usa supabaseAdmin (service_role) che BYPASSA RLS.
-- Abilitare RLS e' puramente difensivo: protegge da accesso diretto via
-- PostgREST/anon key. Le operazioni server-side NON sono impattate.
--
-- Riferimento: https://supabase.com/docs/guides/database/database-linter
-- =====================================================

-- =====================================================
-- PARTE 1: Fix v_platform_margin_alerts SECURITY DEFINER
-- =====================================================
-- La migration 20260125130000 ha tentato il fix con una funzione dinamica,
-- ma il linter segnala ancora la view come SECURITY DEFINER.
-- Questa volta usiamo un approccio diretto: DROP + CREATE con security_invoker.

DO $$
DECLARE
  view_def TEXT;
BEGIN
  -- Ottieni la definizione corrente della view
  SELECT pg_get_viewdef('public.v_platform_margin_alerts'::regclass, true)
  INTO view_def;

  IF view_def IS NULL THEN
    RAISE NOTICE 'View v_platform_margin_alerts non trovata, skip';
    RETURN;
  END IF;

  -- Ricrea con security_invoker = true
  DROP VIEW IF EXISTS public.v_platform_margin_alerts;
  EXECUTE format(
    'CREATE VIEW public.v_platform_margin_alerts WITH (security_invoker = true) AS %s',
    view_def
  );

  RAISE NOTICE 'v_platform_margin_alerts ricreata con security_invoker = true';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Errore fix v_platform_margin_alerts: %', SQLERRM;
END;
$$;

-- =====================================================
-- PARTE 2: ENABLE RLS su tabelle senza RLS
-- =====================================================
-- Queste tabelle sono esposte via PostgREST ma non hanno RLS abilitato.
-- L'app usa service_role (bypassa RLS), quindi abilitare RLS non rompe nulla.
-- Le policy servono come difesa in profondita' contro accesso diretto.

-- ----- 2a. users -----
-- Tabella piu' critica: contiene dati personali e colonna password.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Superadmin: accesso totale
CREATE POLICY "Superadmin full access users" ON public.users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

-- User: puo' vedere SOLO il proprio profilo
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- User: puo' aggiornare SOLO il proprio profilo
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Blocco totale per ruolo anon (nessun accesso senza login)
-- NOTA: Per default RLS nega tutto a chi non matcha nessuna policy.
-- Il ruolo anon non e' 'authenticated', quindi non matcha nessuna policy sopra.

-- ----- 2b. shipments -----
-- Le policy esistono gia' (migration 20260203200007) ma manca ENABLE RLS!
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- ----- 2c. couriers -----
-- Tabella reference (catalogo corrieri). Read-only per tutti gli autenticati.
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

-- Tutti gli autenticati possono leggere il catalogo corrieri
CREATE POLICY "Authenticated can view couriers" ON public.couriers
  FOR SELECT
  TO authenticated
  USING (true);

-- Solo superadmin puo' modificare il catalogo
CREATE POLICY "Superadmin can manage couriers" ON public.couriers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

-- ----- 2d. price_lists -----
-- Le policy esistono gia' (migration 20260203200007 + 20260205120000)
-- ma manca ENABLE RLS!
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;

-- ----- 2e. platform_provider_costs -----
-- Tabella finanziaria: costi provider e margini piattaforma.
-- Solo superadmin dovrebbe poter accedere.
ALTER TABLE public.platform_provider_costs ENABLE ROW LEVEL SECURITY;

-- Solo superadmin: accesso totale
CREATE POLICY "Superadmin full access platform_provider_costs" ON public.platform_provider_costs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

-- =====================================================
-- PARTE 3: Fix sensitive_columns_exposed (users.password)
-- =====================================================
-- La colonna "password" nella tabella public.users e' un residuo legacy.
-- Le password reali sono gestite da Supabase Auth (auth.users).
-- La colonna in public.users contiene hash per sub-utenti creati via RPC.
--
-- Fix: Revocare permessi diretti al ruolo anon su questa tabella.
-- Con RLS abilitato (parte 2a), anon non puo' comunque accedere.
-- Aggiungiamo anche revoke esplicito per chiarezza.

REVOKE ALL ON public.users FROM anon;
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE ON public.users TO authenticated;

-- =====================================================
-- VERIFICA: Query per confermare i fix
-- =====================================================
-- 1. Verifica RLS abilitato (tutte le 5 tabelle devono avere relrowsecurity = true):
-- SELECT relname, relrowsecurity
-- FROM pg_class
-- WHERE relname IN ('users', 'shipments', 'couriers', 'price_lists', 'platform_provider_costs')
-- ORDER BY relname;
--
-- 2. Verifica view security_invoker:
-- SELECT c.relname, unnest(c.reloptions) as option
-- FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
-- WHERE n.nspname = 'public' AND c.relname = 'v_platform_margin_alerts';
--
-- 3. Verifica permessi anon su users:
-- SELECT grantee, privilege_type
-- FROM information_schema.table_privileges
-- WHERE table_name = 'users' AND table_schema = 'public';
