-- ============================================
-- QUERY DI VALIDAZIONE: Sincronizzazione Listini
-- ============================================
-- Verifica quante configurazioni e contractCode ci sono
-- per capire perché vengono creati solo 2 listini invece di 8

-- QUERY 1: Configurazioni API per l'utente test
-- ============================================
SELECT 
  cc.id,
  cc.name,
  cc.config_label,
  cc.owner_user_id,
  cc.is_default,
  cc.is_active,
  cc.provider_id,
  u.email AS owner_email,
  -- Conta quanti contractCode ci sono in contract_mapping
  (
    SELECT COUNT(*) 
    FROM jsonb_object_keys(cc.contract_mapping) AS contract_key
  ) AS contract_count,
  -- Mostra i contractCode
  (
    SELECT jsonb_agg(contract_key)
    FROM jsonb_object_keys(cc.contract_mapping) AS contract_key
  ) AS contract_codes
FROM courier_configs cc
LEFT JOIN users u ON u.id = cc.owner_user_id
WHERE cc.provider_id = 'spedisci_online'
  AND cc.is_active = true
  AND (
    u.email = 'testspediresicuro+postaexpress@gmail.com'
    OR cc.is_default = true
  )
ORDER BY cc.is_default DESC, cc.created_at DESC;

-- QUERY 2: Dettaglio contract_mapping per ogni config
-- ============================================
SELECT 
  cc.id AS config_id,
  cc.name AS config_name,
  cc.owner_user_id,
  u.email AS owner_email,
  -- Estrai ogni contractCode con il suo courier name
  jsonb_each_text(cc.contract_mapping) AS contract_details
FROM courier_configs cc
LEFT JOIN users u ON u.id = cc.owner_user_id
WHERE cc.provider_id = 'spedisci_online'
  AND cc.is_active = true
  AND (
    u.email = 'testspediresicuro+postaexpress@gmail.com'
    OR cc.is_default = true
  )
ORDER BY cc.is_default DESC, cc.created_at DESC;

-- QUERY 3: Listini esistenti per questo utente
-- ============================================
SELECT 
  pl.id,
  pl.name,
  pl.list_type,
  pl.status,
  pl.created_at,
  pl.metadata,
  pl.source_metadata,
  -- Estrai carrier_code e courier_config_id dai metadata
  (pl.metadata->>'carrier_code') AS carrier_code,
  (pl.metadata->>'courier_config_id') AS courier_config_id,
  (pl.source_metadata->>'carrier_code') AS carrier_code_source,
  (pl.source_metadata->>'courier_config_id') AS courier_config_id_source,
  u.email AS created_by_email
FROM price_lists pl
LEFT JOIN users u ON u.id = pl.created_by
WHERE pl.list_type = 'supplier'
  AND u.email = 'testspediresicuro+postaexpress@gmail.com'
ORDER BY pl.created_at DESC;

-- QUERY 4: Confronto atteso vs reale
-- ============================================
-- Quanti listini DOVREBBERO esserci (1 per ogni contractCode)
WITH config_contracts AS (
  SELECT 
    cc.id AS config_id,
    cc.name AS config_name,
    jsonb_object_keys(cc.contract_mapping) AS contract_code,
    jsonb_object_keys(cc.contract_mapping) AS courier_name
  FROM courier_configs cc
  LEFT JOIN users u ON u.id = cc.owner_user_id
  WHERE cc.provider_id = 'spedisci_online'
    AND cc.is_active = true
    AND (
      u.email = 'testspediresicuro+postaexpress@gmail.com'
      OR cc.is_default = true
    )
),
actual_lists AS (
  SELECT 
    pl.id,
    pl.name,
    (pl.metadata->>'carrier_code') AS carrier_code,
    (pl.metadata->>'courier_config_id') AS courier_config_id
  FROM price_lists pl
  LEFT JOIN users u ON u.id = pl.created_by
  WHERE pl.list_type = 'supplier'
    AND u.email = 'testspediresicuro+postaexpress@gmail.com'
)
SELECT 
  'CONFIGURAZIONI' AS tipo,
  COUNT(DISTINCT config_id) AS count
FROM config_contracts
UNION ALL
SELECT 
  'CONTRACT_CODE TOTALI' AS tipo,
  COUNT(*) AS count
FROM config_contracts
UNION ALL
SELECT 
  'LISTINI ESISTENTI' AS tipo,
  COUNT(*) AS count
FROM actual_lists
UNION ALL
SELECT 
  'LISTINI MANCANTI' AS tipo,
  (SELECT COUNT(*) FROM config_contracts) - (SELECT COUNT(*) FROM actual_lists) AS count;

-- QUERY 5: Dettaglio contractCode per ogni config
-- ============================================
SELECT 
  cc.id::text AS config_id,
  cc.name AS config_name,
  u.email AS owner_email,
  -- Estrai carrierCode dal contractCode (prima parte prima del primo trattino)
  SPLIT_PART(jsonb_object_keys(cc.contract_mapping)::text, '-', 1) AS carrier_code,
  -- ContractCode completo
  jsonb_object_keys(cc.contract_mapping)::text AS contract_code,
  -- Courier name (valore nel mapping)
  jsonb_object_keys(cc.contract_mapping) AS courier_name
FROM courier_configs cc
LEFT JOIN users u ON u.id = cc.owner_user_id
WHERE cc.provider_id = 'spedisci_online'
  AND cc.is_active = true
  AND (
    u.email = 'testspediresicuro+postaexpress@gmail.com'
    OR cc.is_default = true
  )
ORDER BY cc.name, contract_code;

-- QUERY 6: Raggruppamento per carrierCode (come fa il sistema attuale)
-- ============================================
SELECT 
  SPLIT_PART(jsonb_object_keys(cc.contract_mapping)::text, '-', 1) AS carrier_code,
  COUNT(DISTINCT cc.id) AS config_count,
  COUNT(*) AS contract_code_count,
  jsonb_agg(DISTINCT cc.id::text) AS config_ids,
  jsonb_agg(jsonb_object_keys(cc.contract_mapping)::text) AS contract_codes
FROM courier_configs cc
LEFT JOIN users u ON u.id = cc.owner_user_id
WHERE cc.provider_id = 'spedisci_online'
  AND cc.is_active = true
  AND (
    u.email = 'testspediresicuro+postaexpress@gmail.com'
    OR cc.is_default = true
  )
GROUP BY carrier_code
ORDER BY carrier_code;

-- QUERY 7: Come DOVREBBE essere raggruppato (per config + carrierCode)
-- ============================================
SELECT 
  cc.id::text AS config_id,
  cc.name AS config_name,
  SPLIT_PART(jsonb_object_keys(cc.contract_mapping)::text, '-', 1) AS carrier_code,
  COUNT(*) AS contract_code_count,
  jsonb_agg(jsonb_object_keys(cc.contract_mapping)::text) AS contract_codes
FROM courier_configs cc
LEFT JOIN users u ON u.id = cc.owner_user_id
WHERE cc.provider_id = 'spedisci_online'
  AND cc.is_active = true
  AND (
    u.email = 'testspediresicuro+postaexpress@gmail.com'
    OR cc.is_default = true
  )
GROUP BY cc.id, cc.name, carrier_code
ORDER BY cc.name, carrier_code;

-- QUERY 8: Verifica se i listini esistenti hanno metadata corretti
-- ============================================
SELECT 
  pl.id,
  pl.name,
  pl.metadata,
  pl.source_metadata,
  -- Estrai info dai metadata
  COALESCE(pl.metadata->>'carrier_code', pl.source_metadata->>'carrier_code') AS carrier_code,
  COALESCE(pl.metadata->>'courier_config_id', pl.source_metadata->>'courier_config_id') AS courier_config_id,
  -- Verifica se esiste la config corrispondente
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM courier_configs cc 
      WHERE cc.id::text = COALESCE(pl.metadata->>'courier_config_id', pl.source_metadata->>'courier_config_id')
    ) THEN '✅ Config trovata'
    ELSE '❌ Config NON trovata'
  END AS config_exists
FROM price_lists pl
LEFT JOIN users u ON u.id = pl.created_by
WHERE pl.list_type = 'supplier'
  AND u.email = 'testspediresicuro+postaexpress@gmail.com'
ORDER BY pl.created_at DESC;
