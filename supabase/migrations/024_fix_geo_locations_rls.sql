-- ============================================
-- MIGRATION: Fix RLS Policy per geo_locations
-- ============================================
-- 
-- Questa migration:
-- 1. Abilita RLS su geo_locations (se non già abilitato)
-- 2. Crea policy per lettura pubblica (tutti possono cercare città)
-- 3. Verifica che shipments sia protetto
-- 
-- IMPORTANTE: Rendere pubblica geo_locations NON espone le spedizioni!
-- Le due tabelle sono separate e shipments ha già RLS policies.
-- ============================================

-- ============================================
-- STEP 1: Abilita RLS su geo_locations
-- ============================================

ALTER TABLE geo_locations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: Rimuovi policy esistenti (se ci sono)
-- ============================================

DROP POLICY IF EXISTS "geo_locations_select_public" ON geo_locations;
DROP POLICY IF EXISTS "geo_locations_select_all" ON geo_locations;
DROP POLICY IF EXISTS "Enable read access to everyone" ON geo_locations;

-- ============================================
-- STEP 3: Crea policy per lettura pubblica
-- ============================================

CREATE POLICY "geo_locations_select_public" 
  ON geo_locations
  FOR SELECT
  USING (true); -- Tutti possono leggere (dati pubblici: città, CAP, province)

COMMENT ON POLICY "geo_locations_select_public" ON geo_locations IS 
  'RLS: Permette lettura pubblica di geo_locations (dati pubblici: città, CAP, province). NON espone shipments!';

-- ============================================
-- STEP 4: Verifica che shipments sia protetto
-- ============================================

DO $$
BEGIN
  -- Verifica che RLS sia abilitato su shipments
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'shipments' 
    AND rowsecurity = true
  ) THEN
    RAISE WARNING '⚠️ RLS NON abilitato su shipments! Abilitazione automatica...';
    ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Verifica che esista almeno una policy SELECT su shipments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'shipments' 
    AND cmd = 'SELECT'
  ) THEN
    RAISE WARNING '⚠️ Nessuna policy SELECT trovata su shipments! Creazione policy base...';
    
    -- Crea policy base: utenti vedono solo le proprie spedizioni
    CREATE POLICY "Users can view own shipments"
      ON shipments FOR SELECT
      USING (auth.uid() = user_id);
      
    RAISE NOTICE '✅ Policy base creata: Users can view own shipments';
  ELSE
    RAISE NOTICE '✅ Policy SELECT su shipments già presente';
  END IF;
END $$;

-- ============================================
-- STEP 5: Verifica finale
-- ============================================

DO $$
DECLARE
  v_geo_rls BOOLEAN;
  v_shipments_rls BOOLEAN;
  v_geo_policy_count INTEGER;
  v_shipments_policy_count INTEGER;
BEGIN
  -- Verifica RLS su geo_locations
  SELECT rowsecurity INTO v_geo_rls
  FROM pg_tables 
  WHERE tablename = 'geo_locations';
  
  -- Verifica RLS su shipments
  SELECT rowsecurity INTO v_shipments_rls
  FROM pg_tables 
  WHERE tablename = 'shipments';
  
  -- Conta policy su geo_locations
  SELECT COUNT(*) INTO v_geo_policy_count
  FROM pg_policies 
  WHERE tablename = 'geo_locations' AND cmd = 'SELECT';
  
  -- Conta policy su shipments
  SELECT COUNT(*) INTO v_shipments_policy_count
  FROM pg_policies 
  WHERE tablename = 'shipments' AND cmd = 'SELECT';
  
  -- Report finale
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICA SICUREZZA RLS';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'geo_locations:';
  RAISE NOTICE '  RLS abilitato: %', v_geo_rls;
  RAISE NOTICE '  Policy SELECT: %', v_geo_policy_count;
  IF v_geo_rls AND v_geo_policy_count > 0 THEN
    RAISE NOTICE '  ✅ Configurazione corretta (pubblico)';
  ELSE
    RAISE WARNING '  ⚠️ Configurazione incompleta!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'shipments:';
  RAISE NOTICE '  RLS abilitato: %', v_shipments_rls;
  RAISE NOTICE '  Policy SELECT: %', v_shipments_policy_count;
  IF v_shipments_rls AND v_shipments_policy_count > 0 THEN
    RAISE NOTICE '  ✅ Configurazione corretta (protetto)';
  ELSE
    RAISE WARNING '  ⚠️ Configurazione incompleta!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'IMPORTANTE:';
  RAISE NOTICE 'geo_locations è pubblico (OK - dati pubblici)';
  RAISE NOTICE 'shipments è protetto (OK - dati privati)';
  RAISE NOTICE 'Le due tabelle sono separate e indipendenti!';
  RAISE NOTICE '========================================';
END $$;

