-- ============================================
-- QUERY SQL: Struttura Completa Configurazioni nel DB
-- Mostra come sono salvate le configurazioni nella tabella courier_configs
-- ============================================

-- 1. STRUTTURA COMPLETA TABELLA courier_configs
-- Mostra tutte le colonne e i dati delle configurazioni dell'utente test
SELECT 
  cc.id,
  cc.name AS nome_config,
  cc.config_label AS etichetta_config,
  cc.provider_id,
  cc.is_active,
  cc.is_default,
  cc.owner_user_id,
  cc.created_by,
  cc.base_url,
  -- API Key (solo preview per sicurezza)
  CASE 
    WHEN cc.api_key IS NOT NULL THEN 
      LEFT(cc.api_key, 15) || '...' || RIGHT(cc.api_key, 5) || ' (lunghezza: ' || LENGTH(cc.api_key) || ')'
    ELSE 'NON CONFIGURATA'
  END AS api_key_preview,
  -- API Secret (solo preview)
  CASE 
    WHEN cc.api_secret IS NOT NULL THEN 
      LEFT(cc.api_secret, 10) || '...' || RIGHT(cc.api_secret, 5) || ' (lunghezza: ' || LENGTH(cc.api_secret) || ')'
    ELSE 'NON CONFIGURATA'
  END AS api_secret_preview,
  -- Contract Mapping (JSONB completo)
  cc.contract_mapping AS contract_mapping_jsonb,
  -- Timestamps
  cc.created_at,
  cc.updated_at
FROM courier_configs cc
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
ORDER BY cc.created_at DESC;

-- 2. CONTRACT_MAPPING ESPANSO (formato leggibile)
-- Mostra il contract_mapping in formato tabellare per ogni configurazione
SELECT 
  cc.id AS config_id,
  cc.name AS nome_config,
  cc.provider_id,
  -- Estrai ogni coppia chiave-valore dal JSONB
  jsonb_each.key AS courier_name,
  jsonb_each.value::text AS contract_code,
  -- Mostra anche il tipo di valore
  jsonb_typeof(jsonb_each.value) AS tipo_valore
FROM courier_configs cc,
  jsonb_each(cc.contract_mapping) AS jsonb_each
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
ORDER BY cc.name, jsonb_each.key;

-- 3. STRUTTURA DETTAGLIATA CONTRACT_MAPPING
-- Mostra come è strutturato il JSONB contract_mapping per ogni configurazione
SELECT 
  cc.id AS config_id,
  cc.name AS nome_config,
  -- Contract mapping come JSON formattato (per leggibilità)
  jsonb_pretty(cc.contract_mapping) AS contract_mapping_formatted,
  -- Numero di contratti configurati
  (
    SELECT COUNT(*) 
    FROM jsonb_object_keys(cc.contract_mapping)
  ) AS num_contratti,
  -- Lista contratti in formato chiave-valore
  (
    SELECT string_agg(
      E'\n  • ' || key || ' → ' || value::text, 
      ''
    )
    FROM jsonb_each_text(cc.contract_mapping)
  ) AS lista_contratti
FROM courier_configs cc
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
ORDER BY cc.name;

-- 4. CONFRONTO CONFIGURAZIONI (per vedere differenze)
-- Mostra tutte le configurazioni con i loro contratti per confronto
WITH configs_expanded AS (
  SELECT 
    cc.id AS config_id,
    cc.name AS nome_config,
    cc.provider_id,
    cc.is_default,
    cc.created_at,
    jsonb_each.key AS courier_name,
    jsonb_each.value::text AS contract_code
  FROM courier_configs cc,
    jsonb_each(cc.contract_mapping) AS jsonb_each
  WHERE cc.owner_user_id = (
    SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
  )
  AND cc.is_active = true
)
SELECT 
  config_id,
  nome_config,
  provider_id,
  is_default,
  courier_name,
  contract_code,
  created_at
FROM configs_expanded
ORDER BY nome_config, courier_name;

-- 5. ANALISI CONTRATTI DUPLICATI (se ci sono)
-- Verifica se ci sono contratti con stesso nome ma contract_code diversi tra le configurazioni
WITH all_contracts AS (
  SELECT 
    cc.id AS config_id,
    cc.name AS nome_config,
    jsonb_each.key AS courier_name,
    jsonb_each.value::text AS contract_code
  FROM courier_configs cc,
    jsonb_each(cc.contract_mapping) AS jsonb_each
  WHERE cc.owner_user_id = (
    SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
  )
  AND cc.is_active = true
)
SELECT 
  courier_name,
  COUNT(DISTINCT contract_code) AS num_contract_codes_diversi,
  COUNT(DISTINCT config_id) AS num_configs_con_questo_courier,
  string_agg(DISTINCT contract_code, ', ') AS contract_codes_lista,
  string_agg(DISTINCT nome_config, ', ') AS configs_lista
FROM all_contracts
GROUP BY courier_name
HAVING COUNT(DISTINCT contract_code) > 1 OR COUNT(DISTINCT config_id) > 1
ORDER BY courier_name;

-- 6. VISTA COMPLETA CON TUTTI I DETTAGLI
-- Query più completa che mostra tutto in un'unica vista
SELECT 
  -- Info configurazione
  cc.id AS config_id,
  cc.name AS nome_config,
  cc.config_label,
  cc.provider_id,
  cc.is_active,
  cc.is_default,
  cc.base_url,
  -- Info utente owner
  u.email AS owner_email,
  u.name AS owner_name,
  -- Contract mapping completo (JSONB)
  cc.contract_mapping,
  -- Statistiche contratti
  (
    SELECT COUNT(*) 
    FROM jsonb_object_keys(cc.contract_mapping)
  ) AS totale_contratti,
  -- Lista contratti formattata
  (
    SELECT string_agg(
      key || ' = ' || value::text, 
      E'\n'
    )
    FROM jsonb_each_text(cc.contract_mapping)
  ) AS contratti_dettaglio,
  -- Timestamps
  cc.created_at,
  cc.updated_at
FROM courier_configs cc
LEFT JOIN users u ON u.id = cc.owner_user_id
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
ORDER BY cc.created_at DESC;

-- 7. ESEMPIO CONTRACT_MAPPING (per capire la struttura)
-- Mostra un esempio di come è strutturato il JSONB contract_mapping
SELECT 
  cc.name AS nome_config,
  -- Esempio: mostra il contract_mapping come sarebbe in codice
  'contract_mapping: {' || E'\n' ||
  (
    SELECT string_agg(
      '  "' || key || '": "' || value::text || '"',
      ',' || E'\n'
    )
    FROM jsonb_each_text(cc.contract_mapping)
  ) || E'\n' || '}'
  AS esempio_codice
FROM courier_configs cc
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
ORDER BY cc.name;

-- 8. VERIFICA INTEGRITÀ DATI
-- Controlla che tutti i dati necessari siano presenti
SELECT 
  cc.id AS config_id,
  cc.name AS nome_config,
  -- Verifica campi obbligatori
  CASE WHEN cc.provider_id IS NULL THEN '❌' ELSE '✅' END AS has_provider_id,
  CASE WHEN cc.base_url IS NULL THEN '❌' ELSE '✅' END AS has_base_url,
  CASE WHEN cc.api_key IS NULL OR cc.api_key = '' THEN '❌' ELSE '✅' END AS has_api_key,
  CASE WHEN cc.contract_mapping IS NULL OR cc.contract_mapping = '{}'::jsonb THEN '❌' ELSE '✅' END AS has_contract_mapping,
  CASE WHEN cc.is_active IS NULL THEN '❌' ELSE '✅' END AS has_is_active,
  -- Conta contratti
  (
    SELECT COUNT(*) 
    FROM jsonb_object_keys(cc.contract_mapping)
  ) AS num_contratti
FROM courier_configs cc
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
ORDER BY cc.name;
