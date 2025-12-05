-- ============================================
-- MIGRATION: Fix Security Issues - RLS e Views
-- ============================================
-- Data: 2024-12-05
-- Descrizione: Risolve problemi di sicurezza rilevati da Security Advisor
-- - Abilita RLS su tabelle pubbliche senza protezione
-- - Corregge viste Security Definer
-- ============================================

-- ========== FIX 1: RLS su automation_locks ==========
-- Abilita RLS sulla tabella automation_locks (se esiste)
DO $$
BEGIN
  -- Verifica se la tabella esiste
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'automation_locks') THEN
    
    -- Abilita RLS
    ALTER TABLE public.automation_locks ENABLE ROW LEVEL SECURITY;
    
    -- Rimuovi policy esistenti se ci sono
    DROP POLICY IF EXISTS "Only system can access automation_locks" ON public.automation_locks;
    DROP POLICY IF EXISTS "Admins can view automation_locks" ON public.automation_locks;
    
    -- Policy: Solo sistema e admin possono accedere
    CREATE POLICY "Only system and admins can access automation_locks"
      ON public.automation_locks
      FOR ALL
      USING (
        -- Sistema (service role) o admin
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      );
    
    RAISE NOTICE 'RLS abilitato su automation_locks';
  ELSE
    RAISE NOTICE 'Tabella automation_locks non trovata, skip';
  END IF;
END $$;

-- ========== FIX 2: RLS su admin_actions_log ==========
-- Abilita RLS sulla tabella admin_actions_log (se esiste)
DO $$
BEGIN
  -- Verifica se la tabella esiste
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'admin_actions_log') THEN
    
    -- Abilita RLS
    ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY;
    
    -- Rimuovi policy esistenti se ci sono
    DROP POLICY IF EXISTS "Admins can view admin_actions_log" ON public.admin_actions_log;
    DROP POLICY IF EXISTS "System can insert admin_actions_log" ON public.admin_actions_log;
    
    -- Policy: Solo admin possono vedere i log
    CREATE POLICY "Admins can view admin_actions_log"
      ON public.admin_actions_log
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      );
    
    -- Policy: Sistema può inserire log
    CREATE POLICY "System can insert admin_actions_log"
      ON public.admin_actions_log
      FOR INSERT
      WITH CHECK (true);
    
    RAISE NOTICE 'RLS abilitato su admin_actions_log';
  ELSE
    RAISE NOTICE 'Tabella admin_actions_log non trovata, skip';
  END IF;
END $$;

-- ========== FIX 3: Verifica RLS su audit_logs ==========
-- Assicurati che audit_logs abbia RLS abilitato (dovrebbe già averlo dal nostro script precedente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    
    -- Abilita RLS se non già abilitato
    ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'RLS verificato su audit_logs';
  END IF;
END $$;

-- ========== FIX 4: Corregge viste Security Definer ==========
-- Le viste con SECURITY DEFINER possono essere pericolose
-- Le ricreiamo senza SECURITY DEFINER (usa SECURITY INVOKER di default)
-- La sicurezza sarà gestita dalle policy RLS delle tabelle sottostanti

DO $$
BEGIN
  -- Rimuovi viste esistenti (CASCADE rimuove anche dipendenze)
  DROP VIEW IF EXISTS public.admin_monthly_stats CASCADE;
  DROP VIEW IF EXISTS public.top_customers CASCADE;
  DROP VIEW IF EXISTS public.god_view_users CASCADE;
  
  RAISE NOTICE 'Viste rimosse';
END $$;

-- Ricrea admin_monthly_stats SENZA SECURITY DEFINER
-- IMPORTANTE: Non specificare SECURITY DEFINER = usa SECURITY INVOKER (default)
-- La vista userà i permessi dell'utente che la interroga, non del creatore
CREATE OR REPLACE VIEW public.admin_monthly_stats AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS total_shipments,
  SUM(final_price) AS total_revenue,
  SUM(final_price - COALESCE(base_price, 0)) AS total_margin,
  AVG(final_price - COALESCE(base_price, 0)) AS avg_margin,
  carrier,
  COUNT(DISTINCT user_id) AS unique_customers
FROM shipments
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at), carrier
ORDER BY month DESC, total_revenue DESC;

-- Imposta security_invoker (se supportato dalla versione PostgreSQL)
DO $$
BEGIN
  -- Prova a impostare security_invoker (PostgreSQL 15+)
  BEGIN
    ALTER VIEW public.admin_monthly_stats SET (security_invoker = true);
    RAISE NOTICE 'Security invoker impostato su admin_monthly_stats';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Versione PostgreSQL non supporta security_invoker su viste, skip';
  END;
END $$;

-- Ricrea top_customers SENZA SECURITY DEFINER
-- IMPORTANTE: Con security_invoker = true, la vista usa i permessi dell'utente
-- Se l'utente non è admin, vedrà solo i dati per cui ha permesso (tramite RLS su shipments)
CREATE OR REPLACE VIEW public.top_customers AS
SELECT
  u.id AS user_id,
  u.full_name,
  COUNT(s.id) AS total_shipments,
  SUM(s.final_price) AS total_spent,
  SUM(s.final_price - COALESCE(s.base_price, 0)) AS total_margin,
  MAX(s.created_at) AS last_shipment_date
FROM users u
INNER JOIN shipments s ON u.id = s.user_id
WHERE s.created_at >= NOW() - INTERVAL '6 months'
GROUP BY u.id, u.full_name
ORDER BY total_spent DESC
LIMIT 50;

-- Imposta security_invoker (se supportato dalla versione PostgreSQL)
DO $$
BEGIN
  -- Prova a impostare security_invoker (PostgreSQL 15+)
  BEGIN
    ALTER VIEW public.top_customers SET (security_invoker = true);
    RAISE NOTICE 'Security invoker impostato su top_customers';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Versione PostgreSQL non supporta security_invoker su viste, skip';
  END;
END $$;

-- ========== FIX 5: Verifica RLS su tutte le tabelle pubbliche ==========
-- Script per verificare e abilitare RLS su tutte le tabelle pubbliche esposte
DO $$
DECLARE
  table_record RECORD;
BEGIN
  -- Trova tutte le tabelle nel schema public
  FOR table_record IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('_prisma_migrations', 'schema_migrations') -- Escludi tabelle di sistema
  LOOP
    -- Abilita RLS se non già abilitato
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.table_name);
      RAISE NOTICE 'RLS abilitato su: %', table_record.table_name;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Errore su %: %', table_record.table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ========== FIX 6: Policy di sicurezza di default per tabelle senza policy ==========
-- Crea una policy di default che nega tutto se una tabella non ha policy specifiche
-- Questo è un "fail-safe" per sicurezza

-- Nota: Questo è opzionale e può essere troppo restrittivo
-- Commentato per default, decommenta se vuoi massima sicurezza

/*
DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('_prisma_migrations', 'schema_migrations')
  LOOP
    -- Crea policy di default che nega tutto
    BEGIN
      EXECUTE format('
        CREATE POLICY IF NOT EXISTS "deny_all_default_%s"
        ON public.%I
        FOR ALL
        USING (false)
        WITH CHECK (false)
      ', table_record.table_name, table_record.table_name);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Errore creazione policy default su %: %', table_record.table_name, SQLERRM;
    END;
  END LOOP;
END $$;
*/

-- ========== COMMENTI FINALI ==========
COMMENT ON VIEW public.admin_monthly_stats IS 'Statistiche mensili per admin dashboard (SENZA SECURITY DEFINER per sicurezza)';
COMMENT ON VIEW public.top_customers IS 'Top 50 clienti per fatturato ultimi 6 mesi (SENZA SECURITY DEFINER per sicurezza)';

-- ========== VERIFICA FINALE ==========
-- Query per verificare che RLS sia abilitato su tutte le tabelle
DO $$
DECLARE
  table_record RECORD;
  rls_enabled BOOLEAN;
BEGIN
  RAISE NOTICE '=== VERIFICA RLS ===';
  FOR table_record IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('_prisma_migrations', 'schema_migrations')
  LOOP
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = table_record.table_name
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    
    IF rls_enabled THEN
      RAISE NOTICE '✅ %: RLS abilitato', table_record.table_name;
    ELSE
      RAISE NOTICE '❌ %: RLS NON abilitato!', table_record.table_name;
    END IF;
  END LOOP;
END $$;

