-- ============================================
-- QUERY SQL: Identificazione Univoca Contratti
-- Spiega come identificare univocamente un contratto nel sistema
-- ============================================

-- 1. PROBLEMA: contract_code NON è univoco
-- Mostra che lo stesso contract_code può esistere in configurazioni diverse
SELECT 
  'PROBLEMA ATTUALE' AS tipo,
  jsonb_each.value::text AS contract_code,
  COUNT(DISTINCT cc.id) AS num_configs,
  string_agg(DISTINCT cc.name, ', ') AS configurazioni,
  '❌ NON UNIVOCO - stesso contract_code in ' || COUNT(DISTINCT cc.id) || ' configurazioni' AS problema
FROM courier_configs cc,
  jsonb_each(cc.contract_mapping) AS jsonb_each
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
GROUP BY jsonb_each.value::text
HAVING COUNT(DISTINCT cc.id) > 1

UNION ALL

SELECT 
  'OK' AS tipo,
  jsonb_each.value::text AS contract_code,
  COUNT(DISTINCT cc.id) AS num_configs,
  string_agg(DISTINCT cc.name, ', ') AS configurazioni,
  '✅ UNIVOCO - contract_code presente solo in 1 configurazione' AS problema
FROM courier_configs cc,
  jsonb_each(cc.contract_mapping) AS jsonb_each
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
GROUP BY jsonb_each.value::text
HAVING COUNT(DISTINCT cc.id) = 1
ORDER BY tipo DESC, contract_code;

-- 2. SOLUZIONE: Identificatore univoco = config_id + contract_code
-- Mostra come identificare univocamente ogni contratto
SELECT 
  cc.id::text AS config_id,
  cc.name AS nome_config,
  jsonb_each.key AS corriere,
  jsonb_each.value::text AS contract_code,
  -- ✅ IDENTIFICATORE UNIVOCO: config_id + contract_code
  cc.id::text || '::' || jsonb_each.value::text AS identificatore_univoco,
  -- Spiegazione
  'Per identificare questo contratto serve: config_id=' || cc.id::text || ' + contract_code=' || jsonb_each.value::text AS spiegazione
FROM courier_configs cc,
  jsonb_each(cc.contract_mapping) AS jsonb_each
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
ORDER BY cc.name, jsonb_each.key;

-- 3. VERIFICA: Identificatori univoci
-- Verifica che config_id + contract_code sia effettivamente univoco
WITH contratti AS (
  SELECT 
    cc.id::text AS config_id,
    jsonb_each.value::text AS contract_code,
    cc.id::text || '::' || jsonb_each.value::text AS identificatore_univoco
  FROM courier_configs cc,
    jsonb_each(cc.contract_mapping) AS jsonb_each
  WHERE cc.owner_user_id = (
    SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
  )
  AND cc.is_active = true
)
SELECT 
  identificatore_univoco,
  COUNT(*) AS num_occorrenze,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ UNIVOCO'
    ELSE '❌ DUPLICATO - PROBLEMA!'
  END AS stato
FROM contratti
GROUP BY identificatore_univoco
HAVING COUNT(*) > 1
ORDER BY num_occorrenze DESC;

-- 4. CONFRONTO: contract_code vs identificatore_univoco
-- Mostra la differenza tra usare solo contract_code vs config_id + contract_code
SELECT 
  'SOLO contract_code' AS metodo_identificazione,
  jsonb_each.value::text AS valore,
  COUNT(DISTINCT cc.id) AS num_configs,
  CASE 
    WHEN COUNT(DISTINCT cc.id) > 1 THEN '❌ NON UNIVOCO'
    ELSE '✅ UNIVOCO (per caso)'
  END AS stato
FROM courier_configs cc,
  jsonb_each(cc.contract_mapping) AS jsonb_each
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
GROUP BY jsonb_each.value::text

UNION ALL

SELECT 
  'config_id + contract_code' AS metodo_identificazione,
  cc.id::text || '::' || jsonb_each.value::text AS valore,
  COUNT(*) AS num_configs,
  '✅ SEMPRE UNIVOCO' AS stato
FROM courier_configs cc,
  jsonb_each(cc.contract_mapping) AS jsonb_each
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
GROUP BY cc.id::text || '::' || jsonb_each.value::text
ORDER BY metodo_identificazione, stato;

-- 5. ESEMPIO PRATICO: Perché serve config_id
-- Mostra un esempio concreto del problema
WITH esempio AS (
  SELECT 
    cc.id::text AS config_id,
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
  'ESEMPIO' AS tipo,
  e1.contract_code AS contract_code_esempio,
  e1.nome_config AS config_1,
  e1.config_id AS config_id_1,
  e2.nome_config AS config_2,
  e2.config_id AS config_id_2,
  CASE 
    WHEN e1.contract_code = e2.contract_code THEN 
      '⚠️ STESSO contract_code ma config_id diversi!' || E'\n' ||
      '   → Serve usare config_id per distinguerli'
    ELSE '✅ Contract_code diversi'
  END AS spiegazione
FROM esempio e1
INNER JOIN esempio e2 ON e1.contract_code = e2.contract_code
WHERE e1.config_id != e2.config_id
LIMIT 5;

-- 6. COME DOVREBBE FUNZIONARE IL MATCHING
-- Mostra come il sistema dovrebbe identificare un contratto
SELECT 
  cc.name AS configurazione,
  jsonb_each.key AS corriere,
  jsonb_each.value::text AS contract_code,
  -- Identificatore univoco per matching
  cc.id::text || '::' || jsonb_each.value::text AS identificatore_per_matching,
  -- Spiegazione
  'Quando l''utente seleziona questo contratto:' || E'\n' ||
  '  1. Il sistema salva: config_id=' || cc.id::text || E'\n' ||
  '  2. Il sistema salva: contract_code=' || jsonb_each.value::text || E'\n' ||
  '  3. Alla creazione spedizione, usa config_id per trovare la configurazione API corretta' AS come_funziona
FROM courier_configs cc,
  jsonb_each(cc.contract_mapping) AS jsonb_each
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
ORDER BY cc.name, jsonb_each.key;

-- 7. VERIFICA: Tutti i contratti hanno identificatore univoco?
-- Controlla che ogni contratto possa essere identificato univocamente
SELECT 
  COUNT(*) AS totale_contratti,
  COUNT(DISTINCT cc.id::text || '::' || jsonb_each.value::text) AS identificatori_univoci,
  CASE 
    WHEN COUNT(*) = COUNT(DISTINCT cc.id::text || '::' || jsonb_each.value::text) THEN 
      '✅ TUTTI i contratti hanno identificatore univoco (config_id + contract_code)'
    ELSE 
      '❌ PROBLEMA: Ci sono contratti senza identificatore univoco!'
  END AS stato
FROM courier_configs cc,
  jsonb_each(cc.contract_mapping) AS jsonb_each
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true;

-- 8. RIEPILOGO: Struttura identificazione
SELECT 
  'RIEPILOGO IDENTIFICAZIONE CONTRATTI' AS titolo,
  E'\n' ||
  '❌ PROBLEMA:' || E'\n' ||
  '   contract_code da solo NON è univoco' || E'\n' ||
  '   Lo stesso contract_code può esistere in configurazioni diverse' || E'\n' ||
  E'\n' ||
  '✅ SOLUZIONE:' || E'\n' ||
  '   Identificatore univoco = config_id + contract_code' || E'\n' ||
  E'\n' ||
  '📋 ESEMPIO:' || E'\n' ||
  '   Config "Spedizioni Prime" (id: ' || 
  (SELECT id::text FROM courier_configs WHERE name = 'Spedizioni Prime' AND owner_user_id = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com') LIMIT 1) ||
  ')' || E'\n' ||
  '   Contract: postedeliverybusiness-Solution-and-Shipment' || E'\n' ||
  '   → ID univoco: ' ||
  (SELECT id::text FROM courier_configs WHERE name = 'Spedizioni Prime' AND owner_user_id = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com') LIMIT 1) ||
  '::postedeliverybusiness-Solution-and-Shipment' || E'\n' ||
  E'\n' ||
  '🔧 IMPLEMENTAZIONE:' || E'\n' ||
  '   - Il preventivatore passa config_id quando si seleziona un contratto' || E'\n' ||
  '   - Alla creazione spedizione, il sistema usa config_id per trovare la configurazione API corretta' || E'\n' ||
  '   - Questo risolve il problema di usare sempre la stessa configurazione' AS spiegazione_completa;
