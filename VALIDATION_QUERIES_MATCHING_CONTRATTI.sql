-- ============================================
-- QUERY SQL: Verifica Matching Contratti tra Configurazioni
-- Confronta i contratti delle 2 configurazioni per vedere se matchano correttamente
-- ============================================

-- 1. CONTRATTI DI ENTRAMBE LE CONFIGURAZIONI (confronto diretto)
-- Mostra tutti i contratti di "Spedizioni Prime" e "Speedgo" affiancati
WITH configs AS (
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
  AND cc.name IN ('Spedizioni Prime', 'Speedgo')
)
SELECT 
  c1.courier_name,
  c1.contract_code AS contract_code_spedizioni_prime,
  c2.contract_code AS contract_code_speedgo,
  CASE 
    WHEN c1.contract_code = c2.contract_code THEN '✅ IDENTICI'
    WHEN c1.contract_code IS NULL THEN '❌ MANCA in Spedizioni Prime'
    WHEN c2.contract_code IS NULL THEN '❌ MANCA in Speedgo'
    ELSE '⚠️ DIVERSI'
  END AS stato_match
FROM (
  SELECT courier_name, contract_code 
  FROM configs 
  WHERE nome_config = 'Spedizioni Prime'
) c1
FULL OUTER JOIN (
  SELECT courier_name, contract_code 
  FROM configs 
  WHERE nome_config = 'Speedgo'
) c2 ON c1.courier_name = c2.courier_name
ORDER BY c1.courier_name;

-- 2. LISTA COMPLETA CONTRATTI PER CONFIGURAZIONE
-- Mostra tutti i contratti di ogni configurazione in formato tabellare
SELECT 
  cc.name AS configurazione,
  jsonb_each.key AS corriere,
  jsonb_each.value::text AS contract_code,
  -- Normalizza contract_code per matching (rimuovi trattini multipli, lowercase)
  LOWER(
    REPLACE(
      REPLACE(
        REPLACE(jsonb_each.value::text, '---', '-'),
        '--', '-'
      ),
      ' ', ''
    )
  ) AS contract_code_normalizzato
FROM courier_configs cc,
  jsonb_each(cc.contract_mapping) AS jsonb_each
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
AND cc.name IN ('Spedizioni Prime', 'Speedgo')
ORDER BY cc.name, jsonb_each.key;

-- 3. ANALISI MATCHING: Contratti comuni vs unici
-- Mostra quali contratti sono comuni e quali sono unici per ogni configurazione
WITH all_contracts AS (
  SELECT 
    cc.name AS configurazione,
    jsonb_each.key AS corriere,
    jsonb_each.value::text AS contract_code
  FROM courier_configs cc,
    jsonb_each(cc.contract_mapping) AS jsonb_each
  WHERE cc.owner_user_id = (
    SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
  )
  AND cc.is_active = true
  AND cc.name IN ('Spedizioni Prime', 'Speedgo')
),
spedizioni_prime AS (
  SELECT corriere, contract_code 
  FROM all_contracts 
  WHERE configurazione = 'Spedizioni Prime'
),
speedgo AS (
  SELECT corriere, contract_code 
  FROM all_contracts 
  WHERE configurazione = 'Speedgo'
)
SELECT 
  COALESCE(sp.corriere, sg.corriere) AS corriere,
  sp.contract_code AS contract_spedizioni_prime,
  sg.contract_code AS contract_speedgo,
  CASE 
    WHEN sp.contract_code = sg.contract_code THEN '✅ MATCH PERFETTO'
    WHEN sp.contract_code IS NULL THEN '⚠️ SOLO in Speedgo'
    WHEN sg.contract_code IS NULL THEN '⚠️ SOLO in Spedizioni Prime'
    WHEN sp.corriere = sg.corriere AND sp.contract_code != sg.contract_code THEN '❌ STESSO CORRIERE, CONTRATTO DIVERSO'
    ELSE '❓ DA VERIFICARE'
  END AS analisi_match
FROM spedizioni_prime sp
FULL OUTER JOIN speedgo sg ON sp.corriere = sg.corriere
ORDER BY 
  CASE 
    WHEN sp.contract_code = sg.contract_code THEN 1
    WHEN sp.corriere = sg.corriere AND sp.contract_code != sg.contract_code THEN 2
    ELSE 3
  END,
  COALESCE(sp.corriere, sg.corriere);

-- 4. VERIFICA CONTRATTI DUPLICATI (stesso corriere, contract_code diverso)
-- Controlla se ci sono corrieri con contract_code diversi tra le configurazioni
WITH configs_expanded AS (
  SELECT 
    cc.name AS configurazione,
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
  corriere,
  COUNT(DISTINCT contract_code) AS num_contract_codes_diversi,
  COUNT(DISTINCT configurazione) AS num_configs,
  string_agg(DISTINCT contract_code, ' | ') AS contract_codes_lista,
  string_agg(DISTINCT configurazione, ', ') AS configs_lista,
  CASE 
    WHEN COUNT(DISTINCT contract_code) > 1 THEN '⚠️ CONTRATTI DIVERSI per stesso corriere'
    ELSE '✅ CONTRATTO UNICO'
  END AS stato
FROM configs_expanded
GROUP BY corriere
ORDER BY 
  CASE 
    WHEN COUNT(DISTINCT contract_code) > 1 THEN 1
    ELSE 2
  END,
  corriere;

-- 5. MATCHING NORMALIZZATO (per vedere se matchano dopo normalizzazione)
-- Normalizza i contract_code e verifica se matchano (gestisce variazioni formato)
WITH configs_expanded AS (
  SELECT 
    cc.name AS configurazione,
    jsonb_each.key AS corriere,
    jsonb_each.value::text AS contract_code,
    -- Normalizza: lowercase, rimuovi spazi, normalizza trattini
    LOWER(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(jsonb_each.value::text, '---', '-'),
            '--', '-'
          ),
          ' ', ''
        ),
        '_', ''
      )
    ) AS contract_code_normalizzato
  FROM courier_configs cc,
    jsonb_each(cc.contract_mapping) AS jsonb_each
  WHERE cc.owner_user_id = (
    SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
  )
  AND cc.is_active = true
  AND cc.name IN ('Spedizioni Prime', 'Speedgo')
),
spedizioni_prime AS (
  SELECT corriere, contract_code, contract_code_normalizzato
  FROM configs_expanded 
  WHERE configurazione = 'Spedizioni Prime'
),
speedgo AS (
  SELECT corriere, contract_code, contract_code_normalizzato
  FROM configs_expanded 
  WHERE configurazione = 'Speedgo'
)
SELECT 
  COALESCE(sp.corriere, sg.corriere) AS corriere,
  sp.contract_code AS contract_spedizioni_prime,
  sg.contract_code AS contract_speedgo,
  sp.contract_code_normalizzato AS normalizzato_spedizioni_prime,
  sg.contract_code_normalizzato AS normalizzato_speedgo,
  CASE 
    WHEN sp.contract_code_normalizzato = sg.contract_code_normalizzato THEN '✅ MATCH dopo normalizzazione'
    WHEN sp.contract_code IS NULL THEN '❌ MANCA in Spedizioni Prime'
    WHEN sg.contract_code IS NULL THEN '❌ MANCA in Speedgo'
    ELSE '❌ NO MATCH anche dopo normalizzazione'
  END AS match_normalizzato
FROM spedizioni_prime sp
FULL OUTER JOIN speedgo sg ON sp.corriere = sg.corriere
ORDER BY 
  CASE 
    WHEN sp.contract_code_normalizzato = sg.contract_code_normalizzato THEN 1
    ELSE 2
  END,
  COALESCE(sp.corriere, sg.corriere);

-- 6. RIEPILOGO CONFRONTO CONFIGURAZIONI
-- Vista riassuntiva del confronto tra le due configurazioni
WITH configs_stats AS (
  SELECT 
    cc.name AS configurazione,
    COUNT(*) AS num_contratti,
    string_agg(jsonb_each.key || ' → ' || jsonb_each.value::text, E'\n') AS lista_contratti
  FROM courier_configs cc,
    jsonb_each(cc.contract_mapping) AS jsonb_each
  WHERE cc.owner_user_id = (
    SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
  )
  AND cc.is_active = true
  AND cc.name IN ('Spedizioni Prime', 'Speedgo')
  GROUP BY cc.name
)
SELECT 
  configurazione,
  num_contratti,
  lista_contratti
FROM configs_stats
ORDER BY configurazione;

-- 7. VERIFICA CONTRATTI CHE DOVREBBERO MATCHARE CON L'API
-- Mostra i contract_code così come sono salvati nel DB
-- (per confrontarli con quelli che arrivano dall'API Spedisci.Online)
SELECT 
  cc.name AS configurazione,
  jsonb_each.key AS corriere,
  jsonb_each.value::text AS contract_code_db,
  -- Estrai parti chiave per matching (come fa il codice)
  LOWER(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(jsonb_each.value::text, '---', '-'),
          '--', '-'
        ),
        ' ', ''
      ),
      '_', ''
    )
  ) AS contract_code_per_matching,
  -- Parti chiave estratte (es. "sda", "express", "h24")
  (
    SELECT string_agg(part, '-')
    FROM (
      SELECT unnest(
        string_to_array(
          LOWER(
            REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(jsonb_each.value::text, '---', '-'),
                  '--', '-'
                ),
                ' ', '-'
              ),
              '_', '-'
            )
          ),
          '-'
        )
      ) AS part
      WHERE LENGTH(part) > 2
      AND part NOT IN ('poste', 'gls', 'brt', 'sda', 'ups', 'dhl', 'postedeliverybusiness', 'posteitaliane')
    ) parts
  ) AS key_parts_per_matching
FROM courier_configs cc,
  jsonb_each(cc.contract_mapping) AS jsonb_each
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
AND cc.name IN ('Spedizioni Prime', 'Speedgo')
ORDER BY cc.name, jsonb_each.key;

-- 8. QUERY RAPIDA: Confronto diretto
-- Query semplice per vedere subito se i contratti matchano
SELECT 
  'Spedizioni Prime' AS config,
  jsonb_each.key AS corriere,
  jsonb_each.value::text AS contract_code
FROM courier_configs cc,
  jsonb_each(cc.contract_mapping) AS jsonb_each
WHERE cc.name = 'Spedizioni Prime'
  AND cc.owner_user_id = (
    SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
  )
  AND cc.is_active = true

UNION ALL

SELECT 
  'Speedgo' AS config,
  jsonb_each.key AS corriere,
  jsonb_each.value::text AS contract_code
FROM courier_configs cc,
  jsonb_each(cc.contract_mapping) AS jsonb_each
WHERE cc.name = 'Speedgo'
  AND cc.owner_user_id = (
    SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
  )
  AND cc.is_active = true
ORDER BY corriere, config;
