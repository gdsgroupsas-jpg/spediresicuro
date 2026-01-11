-- 🔍 VERIFICA: Unicità carrier_code per (courier_config_id, contract_code) nei listini personalizzati
-- 
-- Domanda: Il carrier_code è univoco per un dato config_id e contract_code in un listino personalizzato?
--
-- Questo script verifica:
-- 1. Se ci sono duplicati di (carrier_code, contract_code, courier_config_id) nei listini personalizzati
-- 2. Se il carrier_code è derivato correttamente dal contract_code
-- 3. Se ci sono vincoli di unicità nel database

-- ⚠️ SOSTITUISCI CON L'EMAIL DEL RESELLER DA TESTARE
DO $$
DECLARE
  reseller_email TEXT := 'testspediresicuro+postaexpress@gmail.com';
  reseller_user_id UUID;
BEGIN
  SELECT id INTO reseller_user_id
  FROM users
  WHERE email = reseller_email;
  
  IF reseller_user_id IS NULL THEN
    RAISE EXCEPTION 'Utente non trovato con email: %', reseller_email;
  END IF;
  
  RAISE NOTICE '🔍 Verifica unicità carrier_code per: % (ID: %)', reseller_email, reseller_user_id;
END $$;

-- 1. Listini personalizzati del reseller con metadata
SELECT 
  pl.id as price_list_id,
  pl.name,
  pl.list_type,
  pl.status,
  pl.metadata->>'courier_config_id' as courier_config_id,
  pl.metadata->>'carrier_code' as carrier_code,
  pl.metadata->>'contract_code' as contract_code,
  pl.created_at
FROM price_lists pl
WHERE pl.created_by = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
  AND pl.list_type = 'custom'
ORDER BY pl.created_at DESC;

-- 2. Configurazioni supplier_price_list_config collegate ai listini personalizzati
SELECT 
  spc.id as config_id,
  spc.price_list_id,
  pl.name as price_list_name,
  spc.carrier_code,
  spc.contract_code,
  spc.courier_config_id,
  pl.metadata->>'courier_config_id' as metadata_courier_config_id,
  pl.metadata->>'carrier_code' as metadata_carrier_code,
  pl.metadata->>'contract_code' as metadata_contract_code
FROM supplier_price_list_config spc
JOIN price_lists pl ON pl.id = spc.price_list_id
WHERE pl.created_by = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
  AND pl.list_type = 'custom'
ORDER BY pl.created_at DESC;

-- 3. VERIFICA DUPLICATI: (carrier_code, contract_code, courier_config_id) nei listini personalizzati
-- Se ci sono duplicati, significa che NON è univoco
WITH custom_lists AS (
  SELECT 
    pl.id,
    pl.name,
    COALESCE(
      spc.courier_config_id::text,
      pl.metadata->>'courier_config_id'
    ) as courier_config_id,
    COALESCE(
      spc.carrier_code,
      pl.metadata->>'carrier_code'
    ) as carrier_code,
    COALESCE(
      spc.contract_code,
      pl.metadata->>'contract_code'
    ) as contract_code
  FROM price_lists pl
  LEFT JOIN supplier_price_list_config spc ON spc.price_list_id = pl.id
  WHERE pl.created_by = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
    AND pl.list_type = 'custom'
    AND pl.status = 'active'
)
SELECT 
  courier_config_id,
  carrier_code,
  contract_code,
  COUNT(*) as num_listini,
  string_agg(name, ', ') as listini_nomi,
  string_agg(id::text, ', ') as listini_ids
FROM custom_lists
WHERE courier_config_id IS NOT NULL
  AND carrier_code IS NOT NULL
  AND contract_code IS NOT NULL
GROUP BY courier_config_id, carrier_code, contract_code
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 4. VERIFICA: Il carrier_code è derivato correttamente dal contract_code?
-- Se il contract_code inizia con "postedeliverybusiness-", il carrier_code dovrebbe essere "postedeliverybusiness"
WITH custom_lists AS (
  SELECT 
    pl.id,
    pl.name,
    COALESCE(
      spc.carrier_code,
      pl.metadata->>'carrier_code'
    ) as carrier_code,
    COALESCE(
      spc.contract_code,
      pl.metadata->>'contract_code'
    ) as contract_code
  FROM price_lists pl
  LEFT JOIN supplier_price_list_config spc ON spc.price_list_id = pl.id
  WHERE pl.created_by = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
    AND pl.list_type = 'custom'
    AND contract_code IS NOT NULL
)
SELECT 
  id,
  name,
  carrier_code,
  contract_code,
  LOWER(SPLIT_PART(contract_code, '-', 1)) as carrier_code_atteso,
  CASE 
    WHEN LOWER(SPLIT_PART(contract_code, '-', 1)) = LOWER(carrier_code) THEN '✅ CORRETTO'
    ELSE '❌ ERRORE: carrier_code non corrisponde al contract_code'
  END as verifica
FROM custom_lists
WHERE contract_code IS NOT NULL
ORDER BY name;

-- 5. VINCOLI DI UNICITÀ NEL DATABASE
-- Verifica se esistono vincoli UNIQUE su (carrier_code, contract_code, courier_config_id)
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('price_lists', 'supplier_price_list_config')
  AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
ORDER BY tc.table_name, tc.constraint_name;

-- 6. RIEPILOGO: Situazione attuale
WITH custom_lists AS (
  SELECT 
    pl.id,
    pl.name,
    pl.status,
    COALESCE(
      spc.courier_config_id::text,
      pl.metadata->>'courier_config_id'
    ) as courier_config_id,
    COALESCE(
      spc.carrier_code,
      pl.metadata->>'carrier_code'
    ) as carrier_code,
    COALESCE(
      spc.contract_code,
      pl.metadata->>'contract_code'
    ) as contract_code
  FROM price_lists pl
  LEFT JOIN supplier_price_list_config spc ON spc.price_list_id = pl.id
  WHERE pl.created_by = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
    AND pl.list_type = 'custom'
)
SELECT 
  'RIEPILOGO' as tipo,
  COUNT(DISTINCT id) as totale_listini,
  COUNT(DISTINCT courier_config_id) FILTER (WHERE courier_config_id IS NOT NULL) as config_id_unici,
  COUNT(DISTINCT carrier_code) FILTER (WHERE carrier_code IS NOT NULL) as carrier_code_unici,
  COUNT(DISTINCT contract_code) FILTER (WHERE contract_code IS NOT NULL) as contract_code_unici,
  COUNT(DISTINCT (courier_config_id, carrier_code, contract_code)) FILTER (
    WHERE courier_config_id IS NOT NULL 
    AND carrier_code IS NOT NULL 
    AND contract_code IS NOT NULL
  ) as combinazioni_uniche,
  COUNT(*) FILTER (WHERE status = 'active') as listini_attivi
FROM custom_lists;
