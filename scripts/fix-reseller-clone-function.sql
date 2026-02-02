-- ============================================
-- FIX RAPIDO: Ricrea funzione reseller_clone_supplier_price_list
-- ============================================
-- Questo script risolve l'errore "control reached end of function without RETURN"
-- Ricrea la funzione da zero con sintassi corretta

-- Rimuovi TUTTE le versioni esistenti
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc 
    WHERE proname = 'reseller_clone_supplier_price_list'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s(%s) CASCADE', r.proname, r.args);
    RAISE NOTICE 'Rimossa funzione: %(%)', r.proname, r.args;
  END LOOP;
END $$;

-- Ricrea funzione completa
CREATE OR REPLACE FUNCTION reseller_clone_supplier_price_list(
  p_source_id UUID,
  p_new_name TEXT,
  p_margin_type TEXT,
  p_margin_value DECIMAL DEFAULT 0,
  p_description TEXT DEFAULT NULL,
  p_caller_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_new_id UUID;
  v_caller_id UUID;
  v_is_reseller BOOLEAN;
  v_is_admin BOOLEAN;
  v_source_record RECORD;
  v_entry_count INTEGER;
  v_result JSONB;
BEGIN
  -- Supporta sia auth.uid() che p_caller_id (service_role)
  v_caller_id := COALESCE(p_caller_id, auth.uid());
  
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Non autenticato';
  END IF;
  
  -- Verifica che il caller sia reseller o admin
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE users.id = v_caller_id 
    AND users.is_reseller = true
  ) INTO v_is_reseller;
  
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE users.id = v_caller_id 
    AND users.account_type IN ('admin', 'superadmin')
  ) INTO v_is_admin;
  
  IF NOT v_is_reseller AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Non autorizzato: solo reseller e admin possono clonare listini';
  END IF;
  
  -- Recupera listino sorgente
  SELECT * INTO v_source_record FROM price_lists WHERE id = p_source_id;
  
  IF v_source_record IS NULL THEN
    RAISE EXCEPTION 'Listino sorgente non trovato: %', p_source_id;
  END IF;
  
  -- Verifica che sia listino supplier o custom (i reseller possono clonare listini custom assegnati dal superadmin)
  IF v_source_record.list_type NOT IN ('supplier', 'custom') THEN
    RAISE EXCEPTION 'Posso clonare solo listini supplier o custom, non %', v_source_record.list_type;
  END IF;

  -- Se reseller, verifica che il listino sia proprio OPPURE assegnato
  IF v_is_reseller AND NOT v_is_admin THEN
    IF v_source_record.created_by != v_caller_id
       AND NOT EXISTS (
         SELECT 1 FROM price_list_assignments
         WHERE price_list_id = p_source_id
           AND user_id = v_caller_id
           AND revoked_at IS NULL
       )
       AND NOT EXISTS (
         SELECT 1 FROM users
         WHERE id = v_caller_id
           AND assigned_price_list_id = p_source_id
       )
    THEN
      RAISE EXCEPTION 'Non autorizzato: puoi clonare solo listini che hai creato tu o che ti sono stati assegnati';
    END IF;
  END IF;
  
  -- Valida margine
  IF p_margin_type NOT IN ('percent', 'fixed', 'none') THEN
    RAISE EXCEPTION 'Tipo margine non valido: % (valori validi: percent, fixed, none)', p_margin_type;
  END IF;
  
  IF p_margin_type IN ('percent', 'fixed') AND p_margin_value < 0 THEN
    RAISE EXCEPTION 'Il margine non può essere negativo: %', p_margin_value;
  END IF;
  
  -- Genera nuovo UUID
  v_new_id := gen_random_uuid();
  
  -- Inserisci clone con margine applicato
  INSERT INTO price_lists (
    id,
    courier_id,
    name,
    version,
    status,
    valid_from,
    valid_until,
    source_type,
    source_file_url,
    notes,
    rules,
    priority,
    is_global,
    assigned_to_user_id,
    list_type,
    default_margin_percent,
    default_margin_fixed,
    description,
    source_file_name,
    source_metadata,
    metadata,
    master_list_id,
    created_by,
    created_at,
    updated_at
  )
  VALUES (
    v_new_id,
    v_source_record.courier_id,
    p_new_name,
    v_source_record.version || '-clone',
    'draft',
    v_source_record.valid_from,
    v_source_record.valid_until,
    'manual',
    v_source_record.source_file_url,
    COALESCE(p_description, 'Clonato da: ' || v_source_record.name),
    v_source_record.rules,
    'client',
    false,
    NULL,
    'custom',
    CASE 
      WHEN p_margin_type = 'percent' THEN p_margin_value
      WHEN p_margin_type = 'none' THEN v_source_record.default_margin_percent
      ELSE v_source_record.default_margin_percent
    END,
    CASE 
      WHEN p_margin_type = 'fixed' THEN p_margin_value
      WHEN p_margin_type = 'none' THEN v_source_record.default_margin_fixed
      ELSE v_source_record.default_margin_fixed
    END,
    v_source_record.description,
    v_source_record.source_file_name,
    jsonb_build_object(
      'cloned_from', p_source_id,
      'cloned_at', NOW(),
      'cloned_by', v_caller_id,
      'margin_type', p_margin_type,
      'margin_value', p_margin_value
    ) || COALESCE(v_source_record.source_metadata, '{}'::jsonb),
    COALESCE(v_source_record.metadata, '{}'::jsonb), -- metadata
    p_source_id, -- master_list_id
    v_caller_id, -- created_by
    NOW(), -- created_at
    NOW() -- updated_at
  );
  
  -- Clona entries con margini applicati
  INSERT INTO price_list_entries (
    price_list_id,
    weight_from,
    weight_to,
    zone_code,
    zip_code_from,
    zip_code_to,
    province_code,
    region,
    service_type,
    base_price,
    fuel_surcharge_percent,
    island_surcharge,
    ztl_surcharge,
    cash_on_delivery_surcharge,
    insurance_rate_percent,
    estimated_delivery_days_min,
    estimated_delivery_days_max,
    created_at
  )
  SELECT 
    v_new_id,
    weight_from,
    weight_to,
    zone_code,
    zip_code_from,
    zip_code_to,
    province_code,
    region,
    service_type,
    CASE 
      WHEN p_margin_type = 'percent' THEN base_price * (1 + p_margin_value / 100)
      WHEN p_margin_type = 'fixed' THEN base_price + p_margin_value
      ELSE base_price
    END,
    fuel_surcharge_percent,
    island_surcharge,
    ztl_surcharge,
    cash_on_delivery_surcharge,
    insurance_rate_percent,
    estimated_delivery_days_min,
    estimated_delivery_days_max,
    NOW()
  FROM price_list_entries
  WHERE price_list_id = p_source_id;
  
  -- Conta entries clonate
  GET DIAGNOSTICS v_entry_count = ROW_COUNT;
  
  -- Costruisci risultato
  v_result := jsonb_build_object(
    'success', true,
    'price_list_id', v_new_id,
    'entry_count', v_entry_count,
    'margin_type', p_margin_type,
    'margin_value', p_margin_value
  );
  
  RAISE NOTICE '✅ Listino supplier % clonato in % (entries: %) da reseller % con margine %/%', 
    p_source_id, v_new_id, v_entry_count, v_caller_id, p_margin_type, p_margin_value;
  
  -- ✨ IMPORTANTE: RETURN statement obbligatorio
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

COMMENT ON FUNCTION reseller_clone_supplier_price_list IS 
  'Permette ai reseller di clonare listini supplier applicando margini personalizzati. Supporta chiamate da service_role via p_caller_id.';

-- Verifica che la funzione sia stata creata correttamente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'reseller_clone_supplier_price_list'
    AND pg_get_function_arguments(oid) LIKE '%p_caller_id%'
  ) THEN
    RAISE EXCEPTION 'FAIL: Funzione reseller_clone_supplier_price_list non creata correttamente';
  END IF;
  
  RAISE NOTICE '✅ Funzione reseller_clone_supplier_price_list creata con successo';
END $$;
