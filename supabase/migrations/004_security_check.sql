-- ============================================
-- SCRIPT: Security Check Completo
-- ============================================
-- Data: 2024-12-05
-- Descrizione: Verifica completa dello stato di sicurezza del database
-- - Controlla RLS su tutte le tabelle
-- - Verifica policy RLS esistenti
-- - Controlla viste con SECURITY DEFINER
-- - Identifica tabelle senza protezione
-- ============================================

-- ========== REPORT 1: STATO RLS SU TUTTE LE TABELLE ==========
DO $$
DECLARE
  table_record RECORD;
  rls_enabled BOOLEAN;
  policy_count INTEGER;
  total_tables INTEGER := 0;
  tables_with_rls INTEGER := 0;
  tables_without_rls INTEGER := 0;
  tables_without_policies INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'REPORT 1: STATO RLS SU TABELLE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  FOR table_record IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('_prisma_migrations', 'schema_migrations')
    ORDER BY table_name
  LOOP
    total_tables := total_tables + 1;
    
    -- Verifica se RLS è abilitato
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = table_record.table_name
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    
    -- Conta policy esistenti
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = table_record.table_name;
    
    IF rls_enabled THEN
      tables_with_rls := tables_with_rls + 1;
      IF policy_count = 0 THEN
        tables_without_policies := tables_without_policies + 1;
        RAISE NOTICE '[WARNING] %: RLS abilitato ma NESSUNA POLICY! (CRITICO)', table_record.table_name;
      ELSE
        RAISE NOTICE '[OK] %: RLS abilitato (% policy)', table_record.table_name, policy_count;
      END IF;
    ELSE
      tables_without_rls := tables_without_rls + 1;
      RAISE NOTICE '[ERROR] %: RLS NON abilitato! (CRITICO)', table_record.table_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '--- RIEPILOGO ---';
  RAISE NOTICE 'Totale tabelle: %', total_tables;
  RAISE NOTICE 'Tabelle con RLS: %', tables_with_rls;
  RAISE NOTICE 'Tabelle senza RLS: %', tables_without_rls;
  RAISE NOTICE 'Tabelle con RLS ma senza policy: %', tables_without_policies;
  RAISE NOTICE '';
END $$;

-- ========== REPORT 2: TABELLE CRITICHE (automation_locks, admin_actions_log, audit_logs) ==========
DO $$
DECLARE
  tbl_name TEXT;
  rls_enabled BOOLEAN;
  policy_count INTEGER;
  policy_list TEXT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'REPORT 2: TABELLE CRITICHE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  FOR tbl_name IN SELECT unnest(ARRAY['automation_locks', 'admin_actions_log', 'audit_logs']) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables t
               WHERE t.table_schema = 'public' AND t.table_name = tbl_name) THEN
      
      -- Verifica RLS
      SELECT relrowsecurity INTO rls_enabled
      FROM pg_class
      WHERE relname = tbl_name
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
      
      -- Conta e lista policy
      SELECT COUNT(*), string_agg(policyname, ', ') INTO policy_count, policy_list
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl_name;
      
      RAISE NOTICE 'Tabella: %', tbl_name;
      IF rls_enabled THEN
        RAISE NOTICE '  [OK] RLS: Abilitato';
      ELSE
        RAISE NOTICE '  [ERROR] RLS: NON abilitato (CRITICO!)';
      END IF;
      
      IF policy_count > 0 THEN
        RAISE NOTICE '  [OK] Policy: % (nomi: %)', policy_count, policy_list;
      ELSE
        RAISE NOTICE '  [ERROR] Policy: NESSUNA (CRITICO!)';
      END IF;
      RAISE NOTICE '';
    ELSE
      RAISE NOTICE 'Tabella %: Non trovata (skip)', tbl_name;
      RAISE NOTICE '';
    END IF;
  END LOOP;
END $$;

-- ========== REPORT 3: VISTE CON SECURITY DEFINER ==========
DO $$
DECLARE
  view_record RECORD;
  view_count INTEGER := 0;
  security_definer_count INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'REPORT 3: VISTE CON SECURITY DEFINER';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  FOR view_record IN
    SELECT 
      schemaname,
      viewname,
      definition
    FROM pg_views
    WHERE schemaname = 'public'
    ORDER BY viewname
  LOOP
    view_count := view_count + 1;
    
    -- Controlla se la vista è creata con SECURITY DEFINER
    -- (PostgreSQL non memorizza direttamente questa info, ma possiamo controllare se è definita come SECURITY DEFINER)
    -- In alternativa, controlliamo se la vista ha security_invoker impostato
    DECLARE
      is_security_definer BOOLEAN := false;
    BEGIN
      -- Controlla se la definizione contiene SECURITY DEFINER (non sempre affidabile)
      -- Il modo migliore è controllare direttamente gli attributi della vista
      SELECT 
        CASE 
          WHEN (SELECT reloptions FROM pg_class WHERE relname = view_record.viewname AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) IS NULL
          THEN false
          ELSE NOT (COALESCE((SELECT reloptions FROM pg_class WHERE relname = view_record.viewname AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))::text[] @> ARRAY['security_invoker=true'], false))
        END INTO is_security_definer;
      
      -- Metodo alternativo: controlla se la funzione sottostante è SECURITY DEFINER
      -- (per viste materializzate o viste con funzioni)
      IF NOT is_security_definer THEN
        -- Se non abbiamo trovato security_invoker=true, potrebbe essere SECURITY DEFINER
        -- Ma senza accesso diretto, assumiamo che se non c'è security_invoker esplicito, potrebbe essere problematico
        -- Per sicurezza, segnaliamo tutte le viste per verifica manuale
        RAISE NOTICE '[CHECK] Vista: % (verifica manuale consigliata)', view_record.viewname;
      ELSE
        security_definer_count := security_definer_count + 1;
        RAISE NOTICE '[WARNING] Vista: % (possibile SECURITY DEFINER)', view_record.viewname;
      END IF;
    END;
  END LOOP;
  
  IF view_count = 0 THEN
    RAISE NOTICE 'Nessuna vista trovata nello schema public';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '--- RIEPILOGO ---';
    RAISE NOTICE 'Totale viste: %', view_count;
    RAISE NOTICE 'Viste sospette: %', security_definer_count;
  END IF;
  RAISE NOTICE '';
END $$;

-- ========== REPORT 4: LISTA COMPLETA POLICY RLS ==========
DO $$
DECLARE
  policy_record RECORD;
  policy_count INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'REPORT 4: POLICY RLS ESISTENTI';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  FOR policy_record IN
    SELECT 
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  LOOP
    policy_count := policy_count + 1;
    RAISE NOTICE 'Tabella: %.%', policy_record.schemaname, policy_record.tablename;
    RAISE NOTICE '  Policy: %', policy_record.policyname;
    RAISE NOTICE '  Comando: %', policy_record.cmd;
    RAISE NOTICE '  Ruoli: %', policy_record.roles;
    RAISE NOTICE '';
  END LOOP;
  
    IF policy_count = 0 THEN
      RAISE NOTICE '[WARNING] NESSUNA POLICY RLS TROVATA! (CRITICO)';
  ELSE
    RAISE NOTICE '--- RIEPILOGO ---';
    RAISE NOTICE 'Totale policy: %', policy_count;
  END IF;
  RAISE NOTICE '';
END $$;

-- ========== REPORT 5: TABELLE SENZA POLICY (CRITICO) ==========
DO $$
DECLARE
  table_record RECORD;
  rls_enabled BOOLEAN;
  policy_count INTEGER;
  critical_tables INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'REPORT 5: TABELLE CON RLS MA SENZA POLICY (CRITICO)';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  FOR table_record IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('_prisma_migrations', 'schema_migrations')
    ORDER BY table_name
  LOOP
    -- Verifica RLS
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = table_record.table_name
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    
    -- Conta policy
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = table_record.table_name;
    
    IF rls_enabled AND policy_count = 0 THEN
      critical_tables := critical_tables + 1;
      RAISE NOTICE '[ERROR] CRITICO: % - RLS abilitato ma NESSUNA POLICY!', table_record.table_name;
      RAISE NOTICE '   Questa tabella è bloccata per tutti gli utenti!';
      RAISE NOTICE '';
    END IF;
  END LOOP;
  
  IF critical_tables = 0 THEN
    RAISE NOTICE '[OK] Nessuna tabella critica trovata';
  ELSE
    RAISE NOTICE '--- ATTENZIONE ---';
    RAISE NOTICE 'Trovate % tabelle con RLS ma senza policy!', critical_tables;
    RAISE NOTICE 'Queste tabelle sono completamente bloccate!';
  END IF;
  RAISE NOTICE '';
END $$;

-- ========== REPORT 6: VISTE SPECIFICHE (admin_monthly_stats, top_customers) ==========
DO $$
DECLARE
  vw_name TEXT;
  view_exists BOOLEAN;
  view_definition TEXT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'REPORT 6: VISTE SPECIFICHE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  FOR vw_name IN SELECT unnest(ARRAY['admin_monthly_stats', 'top_customers', 'god_view_users']) LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_views v
      WHERE v.schemaname = 'public' AND v.viewname = vw_name
    ) INTO view_exists;
    
    IF view_exists THEN
      SELECT v.definition INTO view_definition
      FROM pg_views v
      WHERE v.schemaname = 'public' AND v.viewname = vw_name;
      
      RAISE NOTICE 'Vista: %', vw_name;
      RAISE NOTICE '  [OK] Esiste';
      
      -- Controlla se contiene SECURITY DEFINER nella definizione
      IF view_definition ILIKE '%SECURITY DEFINER%' THEN
        RAISE NOTICE '  [ERROR] Contiene SECURITY DEFINER (PROBLEMA!)';
      ELSE
        RAISE NOTICE '  [OK] Non contiene SECURITY DEFINER (OK)';
      END IF;
      RAISE NOTICE '';
    ELSE
      RAISE NOTICE 'Vista: % - Non trovata', vw_name;
      RAISE NOTICE '';
    END IF;
  END LOOP;
END $$;

-- ========== REPORT FINALE: RIEPILOGO GENERALE ==========
DO $$
DECLARE
  total_tables INTEGER;
  tables_with_rls INTEGER;
  tables_without_rls INTEGER;
  total_policies INTEGER;
  total_views INTEGER;
  critical_issues INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'REPORT FINALE: RIEPILOGO SICUREZZA';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- Conta tabelle
  SELECT COUNT(*) INTO total_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT IN ('_prisma_migrations', 'schema_migrations');
  
  -- Conta tabelle con RLS
  SELECT COUNT(*) INTO tables_with_rls
  FROM information_schema.tables t
  INNER JOIN pg_class c ON c.relname = t.table_name
  INNER JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT IN ('_prisma_migrations', 'schema_migrations')
    AND c.relrowsecurity = true;
  
  tables_without_rls := total_tables - tables_with_rls;
  
  -- Conta policy
  SELECT COUNT(*) INTO total_policies
  FROM pg_policies
  WHERE schemaname = 'public';
  
  -- Conta viste
  SELECT COUNT(*) INTO total_views
  FROM pg_views
  WHERE schemaname = 'public';
  
  -- Conta problemi critici
  SELECT COUNT(*) INTO critical_issues
  FROM information_schema.tables t
  INNER JOIN pg_class c ON c.relname = t.table_name
  INNER JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = t.table_name
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT IN ('_prisma_migrations', 'schema_migrations')
    AND c.relrowsecurity = true
    AND p.policyname IS NULL;
  
  RAISE NOTICE '[STATISTICHE GENERALI]';
  RAISE NOTICE '  Tabelle totali: %', total_tables;
  RAISE NOTICE '  Tabelle con RLS: %', tables_with_rls;
  RAISE NOTICE '  Tabelle senza RLS: %', tables_without_rls;
  RAISE NOTICE '  Policy RLS totali: %', total_policies;
  RAISE NOTICE '  Viste totali: %', total_views;
  RAISE NOTICE '';
  
  RAISE NOTICE '[PROBLEMI CRITICI]';
  RAISE NOTICE '  Tabelle con RLS ma senza policy: %', critical_issues;
  RAISE NOTICE '';
  
  IF tables_without_rls = 0 AND critical_issues = 0 THEN
    RAISE NOTICE '[OK] STATO SICUREZZA: OTTIMO';
    RAISE NOTICE '   Tutte le tabelle hanno RLS abilitato e policy configurate';
  ELSIF tables_without_rls > 0 THEN
    RAISE NOTICE '[WARNING] STATO SICUREZZA: ATTENZIONE';
    RAISE NOTICE '   Ci sono % tabelle senza RLS', tables_without_rls;
  ELSIF critical_issues > 0 THEN
    RAISE NOTICE '[ERROR] STATO SICUREZZA: CRITICO';
    RAISE NOTICE '   Ci sono % tabelle con RLS ma senza policy (completamente bloccate!)', critical_issues;
  ELSE
    RAISE NOTICE '[OK] STATO SICUREZZA: BUONO';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

