-- ============================================
-- QUERY SQL: Verifica Unicità Contract Code
-- Spiega come funziona l'identificazione univoca dei contratti
-- ============================================

-- 1. CONTRACT_CODE NON SONO UNIVOCI GLOBALMENTE
-- Mostra che lo stesso contract_code può esistere in configurazioni diverse
SELECT 
  cc.id AS config_id,
  cc.name AS nome_config,
  jsonb_each.key AS corriere,
  jsonb_each.value::text AS contract_code,
  -- Identificatore univoco: config_id + corriere
  cc.id::text || '::' || jsonb_each.key AS identificatore_univoco
FROM courier_configs cc,
  jsonb_each(cc.contract_mapping) AS jsonb_each
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
ORDER BY jsonb_each.value::text, cc.name;

-- 2. VERIFICA CONTRACT_CODE DUPLICATI TRA CONFIGURAZIONI
-- Mostra se ci sono contract_code identici in configurazioni diverse
WITH all_contracts AS (
  SELECT 
    cc.id AS config_id,
    cc.name AS nome_config,
    jsonb_each.key AS corriere,
    jsonb_each.value::text AS contract_code
  FROM courier_configs cc,
    jsonb_each(cc.contract_mapping) AS jsonb_each
  WHERE cc.owner_user_id = (
    SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
  )
  AND cc.is_active = true
)
SELECT 
  contract_code,
  COUNT(DISTINCT config_id) AS num_configs_con_questo_contract,
  COUNT(*) AS num_occorrenze_totali,
  string_agg(DISTINCT nome_config, ', ') AS configurazioni,
  string_agg(DISTINCT corriere, ', ') AS corrieri,
  CASE 
    WHEN COUNT(DISTINCT config_id) > 1 THEN '⚠️ STESSO CONTRACT_CODE in configurazioni diverse'
    ELSE '✅ CONTRACT_CODE unico per configurazione'
  END AS stato
FROM all_contracts
GROUP BY contract_code
HAVING COUNT(DISTINCT config_id) > 1 OR COUNT(*) > 1
ORDER BY num_configs_con_questo_contract DESC, contract_code;

-- 3. IDENTIFICAZIONE UNIVOCA: config_id + contract_code
-- Mostra come identificare univocamente un contratto
SELECT 
  cc.id AS config_id,
  cc.name AS nome_config,
  jsonb_each.key AS corriere,
  jsonb_each.value::text AS contract_code,
  -- Identificatore univoco completo
  cc.id::text || '::' || jsonb_each.key || '::' || jsonb_each.value::text AS identificatore_completo,
  -- Spiegazione
  'Per identificare univocamente un contratto serve: config_id (' || cc.id::text || ') + contract_code (' || jsonb_each.value::text || ')' AS spiegazione
FROM courier_configs cc,
  jsonb_each(cc.contract_mapping) AS jsonb_each
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
ORDER BY cc.name, jsonb_each.key;

-- 4. CONFRONTO: Stesso contract_code in configurazioni diverse
-- Mostra se "Spedizioni Prime" e "Speedgo" hanno contract_code identici
WITH configs AS (
  SELECT 
    cc.id AS config_id,
    cc.name AS nome_config,
    jsonb_each.key AS corriere,
    jsonb_each.value::text AS contract_code
  FROM courier_configs cc,
    jsonb_each(cc.contract_mapping) AS jsonb_each
  WHERE cc.owner_user_id = (
    SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
  )
  AND cc.is_active = true
  AND cc.name IN ('Spedizioni Prime', 'Speedgo')
)
SELECT 
  c1.contract_code,
  c1.nome_config AS config_1,
  c1.corriere AS corriere_1,
  c2.nome_config AS config_2,
  c2.corriere AS corriere_2,
  CASE 
    WHEN c1.contract_code = c2.contract_code THEN '⚠️ STESSO CONTRACT_CODE (potrebbero essere account API diversi!)'
    ELSE '✅ CONTRACT_CODE diversi'
  END AS analisi
FROM configs c1
INNER JOIN configs c2 ON c1.contract_code = c2.contract_code
WHERE c1.config_id != c2.config_id
ORDER BY c1.contract_code;

-- 5. SPIEGAZIONE: Perché serve config_id per identificare univocamente
-- Mostra la struttura completa per capire l'identificazione
SELECT 
  'CONFIGURAZIONE' AS tipo,
  cc.id::text AS identificatore,
  cc.name AS nome,
  NULL AS dettaglio
FROM courier_configs cc
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true

UNION ALL

SELECT 
  'CONTRATTO' AS tipo,
  cc.id::text || '::' || jsonb_each.key AS identificatore,
  jsonb_each.key AS nome,
  jsonb_each.value::text AS dettaglio
FROM courier_configs cc,
  jsonb_each(cc.contract_mapping) AS jsonb_each
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
ORDER BY tipo, identificatore;

-- 6. ESEMPIO PRATICO: Perché serve config_id
-- Mostra un esempio concreto di perché lo stesso contract_code può esistere in config diverse
SELECT 
  'ESEMPIO' AS esempio,
  'Config 1 (Spedizioni Prime)' AS config_1,
  'postedeliverybusiness-Solution-and-Shipment' AS contract_code_1,
  'Config 2 (Speedgo)' AS config_2,
  'postedeliverybusiness-Solution-and-Shipment' AS contract_code_2,
  '⚠️ STESSO CONTRACT_CODE ma account API diversi!' AS problema,
  '✅ Soluzione: Usa config_id per identificare quale configurazione usare' AS soluzione;

-- 7. VERIFICA: Contract code univoci per configurazione
-- Verifica che all'interno di ogni configurazione, ogni corriere abbia un contract_code unico
WITH configs_expanded AS (
  SELECT 
    cc.id AS config_id,
    cc.name AS nome_config,
    jsonb_each.key AS corriere,
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
  COUNT(*) AS num_contratti,
  COUNT(DISTINCT corriere) AS num_corrieri,
  COUNT(DISTINCT contract_code) AS num_contract_codes,
  CASE 
    WHEN COUNT(*) = COUNT(DISTINCT corriere) AND COUNT(DISTINCT corriere) = COUNT(DISTINCT contract_code) THEN '✅ UNIVOCITÀ OK'
    WHEN COUNT(DISTINCT corriere) != COUNT(DISTINCT contract_code) THEN '⚠️ STESSO CONTRACT_CODE per corrieri diversi'
    ELSE '❓ DA VERIFICARE'
  END AS stato_unicita
FROM configs_expanded
GROUP BY config_id, nome_config
ORDER BY nome_config;

-- 8. QUERY RIASSUNTIVA: Struttura identificazione
SELECT 
  'IDENTIFICAZIONE UNIVOCA CONTRATTI' AS titolo,
  E'\n' ||
  '1. CONFIG_ID: ' || cc.id::text || E'\n' ||
  '   Nome: ' || cc.name || E'\n' ||
  '   Provider: ' || cc.provider_id || E'\n' ||
  E'\n' ||
  '2. CONTRATTI in questa configurazione:' || E'\n' ||
  (
    SELECT string_agg(
      '   - ' || key || ' → ' || value::text || ' (ID univoco: ' || cc.id::text || '::' || key || ')',
      E'\n'
    )
    FROM jsonb_each_text(cc.contract_mapping)
  ) || E'\n' ||
  E'\n' ||
  '⚠️ IMPORTANTE: Lo stesso contract_code può esistere in configurazioni diverse!' || E'\n' ||
  '✅ Per identificare univocamente: usa config_id + contract_code' AS spiegazione_completa
FROM courier_configs cc
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
ORDER BY cc.name;
