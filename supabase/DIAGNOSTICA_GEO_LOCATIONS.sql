-- ============================================
-- SCRIPT DIAGNOSTICA: geo_locations RLS
-- ============================================
-- 
-- Esegui questo script su Supabase SQL Editor per diagnosticare
-- il problema con geo_locations
-- ============================================

-- ============================================
-- STEP 1: Verifica che la tabella esista
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'geo_locations'
  ) THEN
    RAISE NOTICE '✅ Tabella geo_locations ESISTE';
  ELSE
    RAISE EXCEPTION '❌ Tabella geo_locations NON ESISTE!';
  END IF;
END $$;

-- ============================================
-- STEP 2: Verifica RLS abilitato
-- ============================================

DO $$
DECLARE
  v_rls_enabled BOOLEAN;
BEGIN
  SELECT rowsecurity INTO v_rls_enabled
  FROM pg_tables 
  WHERE tablename = 'geo_locations' AND schemaname = 'public';
  
  IF v_rls_enabled THEN
    RAISE NOTICE '✅ RLS è ABILITATO su geo_locations';
  ELSE
    RAISE WARNING '⚠️ RLS NON è abilitato su geo_locations';
    RAISE NOTICE '   Abilitazione automatica...';
    ALTER TABLE geo_locations ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '   ✅ RLS abilitato!';
  END IF;
END $$;

-- ============================================
-- STEP 3: Verifica policy esistenti
-- ============================================

DO $$
DECLARE
  v_policy_count INTEGER;
  v_policy_names TEXT;
BEGIN
  SELECT COUNT(*), string_agg(policyname, ', ')
  INTO v_policy_count, v_policy_names
  FROM pg_policies 
  WHERE tablename = 'geo_locations' AND schemaname = 'public';
  
  IF v_policy_count = 0 THEN
    RAISE WARNING '⚠️ NESSUNA POLICY trovata su geo_locations!';
    RAISE NOTICE '   Creazione policy pubblica...';
    
    CREATE POLICY "geo_locations_select_public" 
      ON geo_locations FOR SELECT
      USING (true);
    
    RAISE NOTICE '   ✅ Policy creata: geo_locations_select_public';
  ELSE
    RAISE NOTICE '✅ Trovate % policy: %', v_policy_count, v_policy_names;
    
    -- Mostra dettagli policy
    RAISE NOTICE '';
    RAISE NOTICE 'Dettagli policy:';
    FOR v_policy_names IN 
      SELECT 
        policyname || ' (' || cmd || '): ' || qual
      FROM pg_policies 
      WHERE tablename = 'geo_locations' AND schemaname = 'public'
    LOOP
      RAISE NOTICE '   - %', v_policy_names;
    END LOOP;
  END IF;
END $$;

-- ============================================
-- STEP 4: Test query con ruolo anonimo
-- ============================================

DO $$
DECLARE
  v_test_count INTEGER;
  v_error_text TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST QUERY CON RUOLO ANONIMO';
  RAISE NOTICE '========================================';
  
  -- Prova a fare una query semplice
  BEGIN
    SET ROLE anon;
    SELECT COUNT(*) INTO v_test_count FROM geo_locations LIMIT 1;
    RESET ROLE;
    
    IF v_test_count >= 0 THEN
      RAISE NOTICE '✅ Query con ruolo anonimo FUNZIONA!';
      RAISE NOTICE '   Trovate righe: %', v_test_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    v_error_text := SQLERRM;
    RAISE WARNING '❌ Query con ruolo anonimo FALLITA: %', v_error_text;
    RAISE NOTICE '   Questo significa che la policy RLS non funziona correttamente!';
  END;
END $$;

-- ============================================
-- STEP 5: Verifica colonne necessarie
-- ============================================

DO $$
DECLARE
  v_has_name BOOLEAN;
  v_has_province BOOLEAN;
  v_has_region BOOLEAN;
  v_has_caps BOOLEAN;
  v_has_search_vector BOOLEAN;
BEGIN
  SELECT 
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'geo_locations' AND column_name = 'name'),
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'geo_locations' AND column_name = 'province'),
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'geo_locations' AND column_name = 'region'),
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'geo_locations' AND column_name = 'caps'),
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'geo_locations' AND column_name = 'search_vector')
  INTO v_has_name, v_has_province, v_has_region, v_has_caps, v_has_search_vector;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICA COLONNE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'name: %', CASE WHEN v_has_name THEN '✅' ELSE '❌' END;
  RAISE NOTICE 'province: %', CASE WHEN v_has_province THEN '✅' ELSE '❌' END;
  RAISE NOTICE 'region: %', CASE WHEN v_has_region THEN '✅' ELSE '❌' END;
  RAISE NOTICE 'caps: %', CASE WHEN v_has_caps THEN '✅' ELSE '❌' END;
  RAISE NOTICE 'search_vector: %', CASE WHEN v_has_search_vector THEN '✅' ELSE '❌' END;
  
  IF NOT (v_has_name AND v_has_province AND v_has_region AND v_has_caps) THEN
    RAISE WARNING '⚠️ Alcune colonne necessarie mancano!';
  END IF;
END $$;

-- ============================================
-- STEP 6: Verifica indici
-- ============================================

DO $$
DECLARE
  v_index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes 
  WHERE tablename = 'geo_locations' AND schemaname = 'public';
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICA INDICI';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Indici trovati: %', v_index_count;
  
  IF v_index_count = 0 THEN
    RAISE WARNING '⚠️ Nessun indice trovato - le query potrebbero essere lente!';
  END IF;
END $$;

-- ============================================
-- STEP 7: RIEPILOGO FINALE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RIEPILOGO DIAGNOSTICA';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Se vedi errori sopra, risolvili in ordine:';
  RAISE NOTICE '1. Se RLS non è abilitato → abilitalo';
  RAISE NOTICE '2. Se non ci sono policy → crea policy pubblica';
  RAISE NOTICE '3. Se la query anonima fallisce → verifica la policy';
  RAISE NOTICE '';
  RAISE NOTICE 'Per creare la policy manualmente:';
  RAISE NOTICE '  CREATE POLICY "geo_locations_select_public"';
  RAISE NOTICE '    ON geo_locations FOR SELECT';
  RAISE NOTICE '    USING (true);';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

