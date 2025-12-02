-- ============================================
-- MIGRAZIONE 005: Test Compatibilità Shipments
-- Verifica che lo schema sia perfettamente compatibile
-- ============================================
-- 
-- Questo script verifica che tutti i campi usati dal codice TypeScript
-- siano presenti e correttamente configurati nella tabella shipments.
--
-- Data: 2024
-- Descrizione: Test di compatibilità schema
-- ============================================

-- ============================================
-- TEST 1: Verifica Campi Obbligatori
-- ============================================

DO $$
DECLARE
  missing_columns TEXT[] := ARRAY[]::TEXT[];
  required_columns TEXT[] := ARRAY[
    'id',
    'user_id',
    'tracking_number',
    'status',
    'sender_name',
    'recipient_name',
    'weight',
    'created_at',
    'updated_at'
  ];
  col TEXT;
BEGIN
  FOREACH col IN ARRAY required_columns
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipments' AND column_name = col
    ) THEN
      missing_columns := array_append(missing_columns, col);
    END IF;
  END LOOP;
  
  IF array_length(missing_columns, 1) > 0 THEN
    RAISE EXCEPTION '❌ Campi obbligatori mancanti: %', array_to_string(missing_columns, ', ');
  ELSE
    RAISE NOTICE '✅ Tutti i campi obbligatori sono presenti';
  END IF;
END $$;

-- ============================================
-- TEST 2: Verifica Campi Opzionali (da codice TypeScript)
-- ============================================

DO $$
DECLARE
  missing_columns TEXT[] := ARRAY[]::TEXT[];
  optional_columns TEXT[] := ARRAY[
    'ldv',
    'external_tracking_number',
    'sender_address',
    'sender_city',
    'sender_zip',
    'sender_province',
    'sender_country',
    'sender_phone',
    'sender_email',
    'recipient_type',
    'recipient_address',
    'recipient_city',
    'recipient_zip',
    'recipient_province',
    'recipient_country',
    'recipient_phone',
    'recipient_email',
    'recipient_notes',
    'length',
    'width',
    'height',
    'volumetric_weight',
    'declared_value',
    'currency',
    'courier_id',
    'service_type',
    'cash_on_delivery',
    'cash_on_delivery_amount',
    'insurance',
    'base_price',
    'surcharges',
    'total_cost',
    'margin_percent',
    'final_price',
    'ecommerce_platform',
    'ecommerce_order_id',
    'ecommerce_order_number',
    'notes',
    'internal_notes',
    'created_via_ocr',
    'ocr_confidence_score',
    'shipped_at',
    'delivered_at',
    'deleted',
    'deleted_at',
    'deleted_by_user_id',
    'created_by_user_email',
    'imported',
    'import_source',
    'import_platform',
    'verified',
    'packages_count',
    'content',
    'sender_reference',
    'recipient_reference'
  ];
  col TEXT;
BEGIN
  FOREACH col IN ARRAY optional_columns
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipments' AND column_name = col
    ) THEN
      missing_columns := array_append(missing_columns, col);
    END IF;
  END LOOP;
  
  IF array_length(missing_columns, 1) > 0 THEN
    RAISE WARNING '⚠️ Campi opzionali mancanti: %', array_to_string(missing_columns, ', ');
  ELSE
    RAISE NOTICE '✅ Tutti i campi opzionali sono presenti';
  END IF;
END $$;

-- ============================================
-- TEST 3: Verifica Indici
-- ============================================

DO $$
DECLARE
  missing_indexes TEXT[] := ARRAY[]::TEXT[];
  required_indexes TEXT[] := ARRAY[
    'idx_shipments_user',
    'idx_shipments_tracking',
    'idx_shipments_status',
    'idx_shipments_created_at',
    'idx_shipments_deleted'
  ];
  idx TEXT;
BEGIN
  FOREACH idx IN ARRAY required_indexes
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'shipments' AND indexname = idx
    ) THEN
      missing_indexes := array_append(missing_indexes, idx);
    END IF;
  END LOOP;
  
  IF array_length(missing_indexes, 1) > 0 THEN
    RAISE WARNING '⚠️ Indici mancanti: %', array_to_string(missing_indexes, ', ');
  ELSE
    RAISE NOTICE '✅ Tutti gli indici richiesti sono presenti';
  END IF;
END $$;

-- ============================================
-- TEST 4: Verifica Tipi di Dato
-- ============================================

DO $$
DECLARE
  type_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Verifica che tracking_number sia TEXT (non VARCHAR con limite)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' 
    AND column_name = 'tracking_number'
    AND data_type != 'text'
  ) THEN
    type_errors := array_append(type_errors, 'tracking_number deve essere TEXT');
  END IF;
  
  -- Verifica che weight sia DECIMAL o NUMERIC
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' 
    AND column_name = 'weight'
    AND data_type NOT IN ('numeric', 'decimal')
  ) THEN
    type_errors := array_append(type_errors, 'weight deve essere DECIMAL o NUMERIC');
  END IF;
  
  -- Verifica che deleted sia BOOLEAN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' 
    AND column_name = 'deleted'
    AND data_type != 'boolean'
  ) THEN
    type_errors := array_append(type_errors, 'deleted deve essere BOOLEAN');
  END IF;
  
  IF array_length(type_errors, 1) > 0 THEN
    RAISE WARNING '⚠️ Errori di tipo: %', array_to_string(type_errors, ', ');
  ELSE
    RAISE NOTICE '✅ Tutti i tipi di dato sono corretti';
  END IF;
END $$;

-- ============================================
-- TEST 5: Test Inserimento Dati (Simulazione)
-- ============================================

DO $$
DECLARE
  test_shipment_id UUID;
  test_user_id UUID;
  sql_query TEXT;
  columns_list TEXT := '';
  values_list TEXT := '';
  col_name TEXT;
BEGIN
  -- Cerca un utente esistente per il test
  SELECT id INTO test_user_id FROM users LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE WARNING '⚠️ Nessun utente trovato per il test - crea almeno un utente';
    RETURN;
  END IF;
  
  -- Costruisci dinamicamente la lista delle colonne e valori
  -- Solo per le colonne che esistono realmente
  
  -- Campi obbligatori (devono esistere)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'user_id') THEN
    columns_list := columns_list || 'user_id, ';
    values_list := values_list || quote_literal(test_user_id::TEXT) || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'tracking_number') THEN
    columns_list := columns_list || 'tracking_number, ';
    values_list := values_list || quote_literal('TEST' || EXTRACT(EPOCH FROM NOW())::TEXT) || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'status') THEN
    columns_list := columns_list || 'status, ';
    values_list := values_list || quote_literal('pending') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'sender_name') THEN
    columns_list := columns_list || 'sender_name, ';
    values_list := values_list || quote_literal('Mittente Test') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'recipient_name') THEN
    columns_list := columns_list || 'recipient_name, ';
    values_list := values_list || quote_literal('Destinatario Test') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'weight') THEN
    columns_list := columns_list || 'weight, ';
    values_list := values_list || '1.5, ';
  END IF;
  
  -- Campi opzionali (solo se esistono)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'sender_address') THEN
    columns_list := columns_list || 'sender_address, ';
    values_list := values_list || quote_literal('Via Test 123') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'sender_city') THEN
    columns_list := columns_list || 'sender_city, ';
    values_list := values_list || quote_literal('Roma') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'sender_zip') THEN
    columns_list := columns_list || 'sender_zip, ';
    values_list := values_list || quote_literal('00100') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'sender_province') THEN
    columns_list := columns_list || 'sender_province, ';
    values_list := values_list || quote_literal('RM') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'sender_country') THEN
    columns_list := columns_list || 'sender_country, ';
    values_list := values_list || quote_literal('IT') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'sender_phone') THEN
    columns_list := columns_list || 'sender_phone, ';
    values_list := values_list || quote_literal('+39 1234567890') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'sender_email') THEN
    columns_list := columns_list || 'sender_email, ';
    values_list := values_list || quote_literal('mittente@test.it') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'recipient_address') THEN
    columns_list := columns_list || 'recipient_address, ';
    values_list := values_list || quote_literal('Via Destinatario 456') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'recipient_city') THEN
    columns_list := columns_list || 'recipient_city, ';
    values_list := values_list || quote_literal('Milano') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'recipient_zip') THEN
    columns_list := columns_list || 'recipient_zip, ';
    values_list := values_list || quote_literal('20100') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'recipient_province') THEN
    columns_list := columns_list || 'recipient_province, ';
    values_list := values_list || quote_literal('MI') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'recipient_country') THEN
    columns_list := columns_list || 'recipient_country, ';
    values_list := values_list || quote_literal('IT') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'recipient_phone') THEN
    columns_list := columns_list || 'recipient_phone, ';
    values_list := values_list || quote_literal('+39 0987654321') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'recipient_email') THEN
    columns_list := columns_list || 'recipient_email, ';
    values_list := values_list || quote_literal('destinatario@test.it') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'length') THEN
    columns_list := columns_list || 'length, ';
    values_list := values_list || '10.0, ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'width') THEN
    columns_list := columns_list || 'width, ';
    values_list := values_list || '20.0, ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'height') THEN
    columns_list := columns_list || 'height, ';
    values_list := values_list || '30.0, ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'service_type') THEN
    columns_list := columns_list || 'service_type, ';
    values_list := values_list || quote_literal('standard') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'cash_on_delivery') THEN
    columns_list := columns_list || 'cash_on_delivery, ';
    values_list := values_list || 'false, ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'insurance') THEN
    columns_list := columns_list || 'insurance, ';
    values_list := values_list || 'false, ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'currency') THEN
    columns_list := columns_list || 'currency, ';
    values_list := values_list || quote_literal('EUR') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'base_price') THEN
    columns_list := columns_list || 'base_price, ';
    values_list := values_list || '10.00, ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'surcharges') THEN
    columns_list := columns_list || 'surcharges, ';
    values_list := values_list || '0.00, ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'total_cost') THEN
    columns_list := columns_list || 'total_cost, ';
    values_list := values_list || '10.00, ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'margin_percent') THEN
    columns_list := columns_list || 'margin_percent, ';
    values_list := values_list || '15.00, ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'final_price') THEN
    columns_list := columns_list || 'final_price, ';
    values_list := values_list || '11.50, ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'notes') THEN
    columns_list := columns_list || 'notes, ';
    values_list := values_list || quote_literal('Note di test') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'ldv') THEN
    columns_list := columns_list || 'ldv, ';
    values_list := values_list || quote_literal('LDV123456') || ', ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'deleted') THEN
    columns_list := columns_list || 'deleted, ';
    values_list := values_list || 'false, ';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'created_by_user_email') THEN
    columns_list := columns_list || 'created_by_user_email, ';
    values_list := values_list || quote_literal('test@test.it') || ', ';
  END IF;
  
  -- Rimuovi ultima virgola e spazio
  columns_list := RTRIM(columns_list, ', ');
  values_list := RTRIM(values_list, ', ');
  
  -- Costruisci query dinamica
  sql_query := 'INSERT INTO shipments (' || columns_list || ') VALUES (' || values_list || ') RETURNING id';
  
  -- Esegui query
  EXECUTE sql_query INTO test_shipment_id;
  
  RAISE NOTICE '✅ Test inserimento riuscito! ID: %', test_shipment_id;
  
  -- Pulisci: elimina il record di test
  DELETE FROM shipments WHERE id = test_shipment_id;
  RAISE NOTICE '✅ Record di test eliminato';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '⚠️ Errore durante test inserimento: % (SQL: %)', SQLERRM, sql_query;
END $$;

-- ============================================
-- TEST 6: Verifica Funzioni e Trigger
-- ============================================

DO $$
DECLARE
  missing_functions TEXT[] := ARRAY[]::TEXT[];
  missing_triggers TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Verifica funzione update_updated_at
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'update_shipments_updated_at'
  ) THEN
    missing_functions := array_append(missing_functions, 'update_shipments_updated_at');
  END IF;
  
  -- Verifica trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_shipments_updated_at'
  ) THEN
    missing_triggers := array_append(missing_triggers, 'trigger_update_shipments_updated_at');
  END IF;
  
  IF array_length(missing_functions, 1) > 0 THEN
    RAISE WARNING '⚠️ Funzioni mancanti: %', array_to_string(missing_functions, ', ');
  ELSE
    RAISE NOTICE '✅ Tutte le funzioni sono presenti';
  END IF;
  
  IF array_length(missing_triggers, 1) > 0 THEN
    RAISE WARNING '⚠️ Trigger mancanti: %', array_to_string(missing_triggers, ', ');
  ELSE
    RAISE NOTICE '✅ Tutti i trigger sono presenti';
  END IF;
END $$;

-- ============================================
-- RIEPILOGO FINALE
-- ============================================

DO $$
DECLARE
  total_columns INTEGER;
  total_indexes INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_columns
  FROM information_schema.columns
  WHERE table_name = 'shipments';
  
  SELECT COUNT(*) INTO total_indexes
  FROM pg_indexes
  WHERE tablename = 'shipments';
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RIEPILOGO SCHEMA SHIPMENTS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Colonne totali: %', total_columns;
  RAISE NOTICE 'Indici totali: %', total_indexes;
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Test di compatibilità completato!';
  RAISE NOTICE '========================================';
END $$;

