-- ============================================
-- TEST: Verifica colonne tabella price_lists
-- ============================================
-- Verifica che tutte le colonne usate nell'INSERT esistano nella tabella

DO $$
DECLARE
  v_required_columns TEXT[] := ARRAY[
    'id',
    'courier_id',
    'name',
    'version',
    'status',
    'valid_from',
    'valid_until',
    'source_type',
    'source_file_url',
    'notes',
    'rules',
    'priority',
    'is_global',
    'assigned_to_user_id',
    'list_type',
    'default_margin_percent',
    'default_margin_fixed',
    'description',
    'source_file_name',
    'source_metadata',
    'metadata',
    'master_list_id',
    'created_by',
    'created_at',
    'updated_at'
  ];
  v_missing_columns TEXT[];
  v_col TEXT;
BEGIN
  RAISE NOTICE '🧪 TEST: Verifica colonne tabella price_lists';
  RAISE NOTICE '========================================';
  
  -- Verifica che la tabella esista
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'price_lists'
  ) THEN
    RAISE EXCEPTION '❌ Tabella price_lists non esiste';
  END IF;
  
  RAISE NOTICE '✅ Tabella price_lists trovata';
  RAISE NOTICE '';
  RAISE NOTICE 'Verifica colonne richieste...';
  
  -- Verifica ogni colonna
  FOREACH v_col IN ARRAY v_required_columns
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'price_lists'
      AND column_name = v_col
    ) THEN
      v_missing_columns := array_append(v_missing_columns, v_col);
      RAISE NOTICE '❌ Colonna mancante: %', v_col;
    ELSE
      RAISE NOTICE '✅ Colonna presente: %', v_col;
    END IF;
  END LOOP;
  
  IF array_length(v_missing_columns, 1) > 0 THEN
    RAISE EXCEPTION '❌ FAIL: Colonne mancanti: %', array_to_string(v_missing_columns, ', ');
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅✅✅ TUTTE LE COLONNE PRESENTI! ✅✅✅';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Totale colonne verificate: %', array_length(v_required_columns, 1);
  
END $$;
