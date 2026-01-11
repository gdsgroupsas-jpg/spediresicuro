-- ============================================
-- TEST AUTOMATICO: reseller_clone_supplier_price_list()
-- ============================================
-- Verifica che la funzione funzioni correttamente

DO $$
DECLARE
  v_test_user_id UUID;
  v_test_price_list_id UUID;
  v_cloned_id UUID;
  v_result JSONB;
  v_entry_count INTEGER;
  v_test_passed BOOLEAN := true;
  v_error_message TEXT;
BEGIN
  RAISE NOTICE '🧪 INIZIO TEST: reseller_clone_supplier_price_list()';
  RAISE NOTICE '========================================';
  
  -- STEP 1: Verifica che la funzione esista
  RAISE NOTICE 'STEP 1: Verifica esistenza funzione...';
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'reseller_clone_supplier_price_list'
    AND pg_get_function_arguments(oid) LIKE '%p_caller_id%'
  ) THEN
    RAISE EXCEPTION '❌ FAIL: Funzione reseller_clone_supplier_price_list non trovata';
  END IF;
  RAISE NOTICE '✅ Funzione trovata';
  
  -- STEP 2: Trova un utente reseller di test
  RAISE NOTICE 'STEP 2: Cerca utente reseller di test...';
  SELECT id INTO v_test_user_id
  FROM users 
  WHERE is_reseller = true 
  AND email = 'testspediresicuro+postaexpress@gmail.com'
  LIMIT 1;
  
  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '⚠️ Utente test non trovato, uso primo reseller disponibile';
    SELECT id INTO v_test_user_id
    FROM users 
    WHERE is_reseller = true 
    LIMIT 1;
  END IF;
  
  IF v_test_user_id IS NULL THEN
    RAISE EXCEPTION '❌ FAIL: Nessun reseller trovato nel database';
  END IF;
  RAISE NOTICE '✅ Reseller trovato: %', v_test_user_id;
  
  -- STEP 3: Trova un listino supplier creato dal reseller
  RAISE NOTICE 'STEP 3: Cerca listino supplier...';
  SELECT id INTO v_test_price_list_id
  FROM price_lists 
  WHERE list_type = 'supplier'
  AND created_by = v_test_user_id
  LIMIT 1;
  
  IF v_test_price_list_id IS NULL THEN
    RAISE NOTICE '⚠️ Nessun listino supplier trovato per questo reseller';
    RAISE NOTICE '⚠️ TEST INCOMPLETO: Serve almeno un listino supplier per testare la clonazione';
    RAISE NOTICE '✅ TEST PARZIALE PASSATO: Funzione esiste e sintassi corretta';
    RETURN;
  END IF;
  RAISE NOTICE '✅ Listino supplier trovato: %', v_test_price_list_id;
  
  -- STEP 4: Testa la funzione con margine percentuale
  RAISE NOTICE 'STEP 4: Test clonazione con margine 20%%...';
  BEGIN
    SELECT reseller_clone_supplier_price_list(
      v_test_price_list_id,
      'TEST - Listino Clonato',
      'percent',
      20,
      'Test automatico',
      v_test_user_id
    ) INTO v_result;
    
    v_cloned_id := (v_result->>'price_list_id')::UUID;
    v_entry_count := (v_result->>'entry_count')::INTEGER;
    
    IF v_cloned_id IS NULL THEN
      RAISE EXCEPTION '❌ FAIL: Funzione non ha restituito price_list_id';
    END IF;
    
    RAISE NOTICE '✅ Clonazione riuscita: ID=%', v_cloned_id;
    RAISE NOTICE '✅ Entries clonate: %', v_entry_count;
    
    -- STEP 5: Verifica che il listino clonato esista
    RAISE NOTICE 'STEP 5: Verifica listino clonato nel database...';
    IF NOT EXISTS (
      SELECT 1 FROM price_lists WHERE id = v_cloned_id
    ) THEN
      RAISE EXCEPTION '❌ FAIL: Listino clonato non trovato nel database';
    END IF;
    RAISE NOTICE '✅ Listino clonato trovato nel database';
    
    -- STEP 6: Verifica campi del listino clonato
    RAISE NOTICE 'STEP 6: Verifica campi listino clonato...';
    DECLARE
      v_cloned_record RECORD;
    BEGIN
      SELECT * INTO v_cloned_record FROM price_lists WHERE id = v_cloned_id;
      
      IF v_cloned_record.name != 'TEST - Listino Clonato' THEN
        RAISE EXCEPTION '❌ FAIL: Nome listino clonato errato: %', v_cloned_record.name;
      END IF;
      
      IF v_cloned_record.list_type != 'custom' THEN
        RAISE EXCEPTION '❌ FAIL: list_type errato: %', v_cloned_record.list_type;
      END IF;
      
      IF v_cloned_record.status != 'draft' THEN
        RAISE EXCEPTION '❌ FAIL: Status errato: %', v_cloned_record.status;
      END IF;
      
      IF v_cloned_record.master_list_id != v_test_price_list_id THEN
        RAISE EXCEPTION '❌ FAIL: master_list_id errato: %', v_cloned_record.master_list_id;
      END IF;
      
      IF v_cloned_record.default_margin_percent != 20 THEN
        RAISE EXCEPTION '❌ FAIL: default_margin_percent errato: %', v_cloned_record.default_margin_percent;
      END IF;
      
      RAISE NOTICE '✅ Tutti i campi verificati correttamente';
    END;
    
    -- STEP 7: Verifica entries clonate
    RAISE NOTICE 'STEP 7: Verifica entries clonate...';
    DECLARE
      v_source_entry_count INTEGER;
      v_cloned_entry_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_source_entry_count
      FROM price_list_entries
      WHERE price_list_id = v_test_price_list_id;
      
      SELECT COUNT(*) INTO v_cloned_entry_count
      FROM price_list_entries
      WHERE price_list_id = v_cloned_id;
      
      IF v_cloned_entry_count != v_source_entry_count THEN
        RAISE EXCEPTION '❌ FAIL: Numero entries errato. Sorgente: %, Clonato: %', 
          v_source_entry_count, v_cloned_entry_count;
      END IF;
      
      RAISE NOTICE '✅ Entries verificate: % entries clonate correttamente', v_cloned_entry_count;
    END;
    
    -- STEP 8: Cleanup - elimina listino di test
    RAISE NOTICE 'STEP 8: Cleanup - elimina listino di test...';
    DELETE FROM price_lists WHERE id = v_cloned_id;
    RAISE NOTICE '✅ Listino di test eliminato';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅✅✅ TUTTI I TEST PASSATI! ✅✅✅';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Funzione reseller_clone_supplier_price_list() funziona correttamente';
    RAISE NOTICE '';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '❌❌❌ TEST FALLITO ❌❌❌';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Errore: %', SQLERRM;
    RAISE NOTICE '';
    
    -- Cleanup in caso di errore
    IF v_cloned_id IS NOT NULL THEN
      DELETE FROM price_lists WHERE id = v_cloned_id;
      RAISE NOTICE 'Cleanup: Listino di test eliminato';
    END IF;
    
    RAISE;
  END;
  
END $$;
