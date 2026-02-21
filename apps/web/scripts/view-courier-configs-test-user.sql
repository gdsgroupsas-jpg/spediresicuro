-- 🔍 VISUALIZZAZIONE CONFIGURAZIONI API CORRIERE - UTENTE TEST
-- 
-- Mostra tutte le configurazioni API corriere e i carrier codes
-- per l'utente di test: testspediresicuro+postaexpress@gmail.com
--
-- Questo script mostra:
-- 1. Info utente test
-- 2. Configurazioni API corriere (courier_configs)
-- 3. Carrier codes mappati nel contract_mapping (JSONB)
-- 4. Listini fornitore associati (se presenti)

-- ============================================
-- 1. INFO UTENTE TEST
-- ============================================
SELECT 
  '👤 UTENTE TEST' as sezione,
  u.id as user_id,
  u.email,
  u.is_reseller,
  u.assigned_config_id,
  u.account_type,
  u.parent_reseller_id
FROM users u
WHERE u.email = 'testspediresicuro+postaexpress@gmail.com';

-- ============================================
-- 2. CONFIGURAZIONI API CORRIERE
-- ============================================
-- Mostra tutte le configurazioni API corriere disponibili
-- (sia quelle di proprietà dell'utente che quelle assegnate)
SELECT 
  '📦 CONFIGURAZIONI API CORRIERE' as sezione,
  cc.id as config_id,
  cc.name as config_name,
  cc.provider_id,
  cc.base_url,
  cc.is_active,
  cc.is_default,
  cc.owner_user_id,
  cc.created_by,
  cc.created_at,
  cc.description,
  -- Verifica se è di proprietà dell'utente test
  CASE 
    WHEN cc.owner_user_id = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com') 
    THEN '✅ Proprietà utente test'
    WHEN cc.is_default = true 
    THEN '🌐 Configurazione default'
    ELSE '🔗 Configurazione condivisa'
  END as ownership_status
FROM courier_configs cc
WHERE 
  -- Configurazioni di proprietà dell'utente test
  cc.owner_user_id = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
  -- O configurazioni default
  OR cc.is_default = true
  -- O configurazioni assegnate all'utente
  OR cc.id = (SELECT assigned_config_id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
ORDER BY cc.provider_id, cc.name;

-- ============================================
-- 3. CARRIER CODES (CONTRACT MAPPING)
-- ============================================
-- Mostra tutti i carrier codes mappati nel contract_mapping
-- per ogni configurazione API
SELECT 
  '🔑 CARRIER CODES (CONTRACT MAPPING)' as sezione,
  cc.id as config_id,
  cc.name as config_name,
  cc.provider_id,
  jsonb_object_keys(cc.contract_mapping) as carrier_code,
  cc.contract_mapping->>jsonb_object_keys(cc.contract_mapping) as contract_code,
  cc.is_active as config_active
FROM courier_configs cc
WHERE 
  cc.contract_mapping IS NOT NULL 
  AND cc.contract_mapping != '{}'::jsonb
  AND (
    cc.owner_user_id = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
    OR cc.is_default = true
    OR cc.id = (SELECT assigned_config_id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
  )
ORDER BY cc.provider_id, cc.name, carrier_code;

-- ============================================
-- 4. DETTAGLIO COMPLETO CONTRACT MAPPING
-- ============================================
-- Mostra il contract_mapping completo per ogni configurazione
SELECT 
  '📋 DETTAGLIO CONTRACT MAPPING' as sezione,
  cc.id as config_id,
  cc.name as config_name,
  cc.provider_id,
  cc.contract_mapping,
  jsonb_object_keys(cc.contract_mapping) as carrier_codes,
  jsonb_each_text(cc.contract_mapping) as carrier_contract_pairs
FROM courier_configs cc
WHERE 
  cc.contract_mapping IS NOT NULL 
  AND cc.contract_mapping != '{}'::jsonb
  AND (
    cc.owner_user_id = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
    OR cc.is_default = true
    OR cc.id = (SELECT assigned_config_id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
  )
ORDER BY cc.provider_id, cc.name;

-- ============================================
-- 5. LISTINI FORNITORE ASSOCIATI
-- ============================================
-- Mostra i listini fornitore creati da queste configurazioni
-- (se hanno metadata.courier_config_id)
SELECT 
  '📊 LISTINI FORNITORE ASSOCIATI' as sezione,
  pl.id as price_list_id,
  pl.name as price_list_name,
  pl.courier_id,
  pl.status,
  pl.list_type,
  pl.metadata->>'courier_config_id' as courier_config_id,
  pl.metadata->>'carrier_code' as carrier_code,
  pl.metadata->>'contract_code' as contract_code,
  cc.name as config_name,
  cc.provider_id,
  pl.created_at
FROM price_lists pl
LEFT JOIN courier_configs cc ON cc.id::text = pl.metadata->>'courier_config_id'
WHERE 
  pl.list_type = 'supplier'
  AND pl.metadata->>'courier_config_id' IN (
    SELECT cc2.id::text
    FROM courier_configs cc2
    WHERE 
      cc2.owner_user_id = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
      OR cc2.is_default = true
      OR cc2.id = (SELECT assigned_config_id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
  )
ORDER BY cc.provider_id, pl.metadata->>'carrier_code', pl.created_at DESC;

-- ============================================
-- 6. RIEPILOGO COMPATTO
-- ============================================
-- Vista riassuntiva: Config → Carrier Codes → Listini
SELECT 
  '📊 RIEPILOGO COMPATTO' as sezione,
  cc.id as config_id,
  cc.name as config_name,
  cc.provider_id,
  COUNT(DISTINCT jsonb_object_keys(cc.contract_mapping)) as num_carrier_codes,
  COUNT(DISTINCT pl.id) as num_price_lists,
  string_agg(DISTINCT jsonb_object_keys(cc.contract_mapping), ', ' ORDER BY jsonb_object_keys(cc.contract_mapping)) as carrier_codes_list
FROM courier_configs cc
LEFT JOIN price_lists pl ON pl.metadata->>'courier_config_id' = cc.id::text AND pl.list_type = 'supplier'
WHERE 
  cc.contract_mapping IS NOT NULL 
  AND cc.contract_mapping != '{}'::jsonb
  AND (
    cc.owner_user_id = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
    OR cc.is_default = true
    OR cc.id = (SELECT assigned_config_id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
  )
GROUP BY cc.id, cc.name, cc.provider_id
ORDER BY cc.provider_id, cc.name;
