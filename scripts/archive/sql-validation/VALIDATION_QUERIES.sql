-- QUERY DI VALIDAZIONE POST-SYNC MULTI-CONTRATTO
-- Esegui queste query per verificare che i listini siano separati

-- 1. CONTA LISTINI PER CONTRATTO
-- Risultato atteso: 2+ righe (uno per contratto), ciascuna con almeno 1 corriere
SELECT
  COALESCE(metadata->>'courier_config_id', 'N/A') as config_id,
  COUNT(*) as numero_listini,
  STRING_AGG(DISTINCT metadata->>'carrier_code', ', ') as corrieri,
  STRING_AGG(DISTINCT name, ', ') as nomi_listini
FROM price_lists
WHERE created_by = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND list_type = 'supplier'
GROUP BY metadata->>'courier_config_id'
ORDER BY MIN(created_at);

-- 2. DETTAGLIO LISTINI CON METADATA COMPLETO
-- Verifica che ogni listino abbia carrier_code E courier_config_id
SELECT
  id,
  name,
  metadata->>'carrier_code' as carrier,
  metadata->>'courier_config_id' as config_id,
  metadata->>'synced_at' as last_sync,
  created_at,
  updated_at
FROM price_lists
WHERE created_by = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND list_type = 'supplier'
ORDER BY updated_at DESC;

-- 3. CONTA ENTRIES PER LISTINO
-- Verifica che ogni listino abbia entries (prezzi)
SELECT
  pl.name as listino,
  pl.metadata->>'carrier_code' as carrier,
  pl.metadata->>'courier_config_id' as config_id,
  COUNT(ple.id) as numero_entries
FROM price_lists pl
LEFT JOIN price_list_entries ple ON ple.price_list_id = pl.id
WHERE pl.created_by = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND pl.list_type = 'supplier'
GROUP BY pl.id, pl.name, pl.metadata
ORDER BY COUNT(ple.id) DESC;

-- 4. VERIFICA NESSUNA SOVRASCRITTURA
-- Controlla che non ci siano listini con updated_at molto recente
-- che abbiano perso entries (segno di sovrascrittura)
SELECT
  pl.name,
  pl.metadata->>'carrier_code' as carrier,
  pl.metadata->>'courier_config_id' as config_id,
  pl.updated_at,
  COUNT(ple.id) as entries_count,
  CASE
    WHEN COUNT(ple.id) = 0 THEN '❌ ZERO ENTRIES (possibile sovrascrittura)'
    WHEN COUNT(ple.id) < 10 THEN '⚠️ POCHE ENTRIES (verificare)'
    ELSE '✅ OK'
  END as status
FROM price_lists pl
LEFT JOIN price_list_entries ple ON ple.price_list_id = pl.id
WHERE pl.created_by = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND pl.list_type = 'supplier'
AND pl.updated_at > NOW() - INTERVAL '1 hour'
GROUP BY pl.id, pl.name, pl.metadata, pl.updated_at
ORDER BY pl.updated_at DESC;

-- 5. TEST FINALE: VERIFICA SEPARAZIONE CONTRATTI
-- Risultato atteso: Ogni config_id ha listini DISTINTI (non condivisi)
WITH config_carriers AS (
  SELECT
    metadata->>'courier_config_id' as config_id,
    metadata->>'carrier_code' as carrier_code,
    name,
    id
  FROM price_lists
  WHERE created_by = (
    SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
  )
  AND list_type = 'supplier'
  AND metadata->>'courier_config_id' IS NOT NULL
)
SELECT
  carrier_code,
  COUNT(DISTINCT config_id) as num_contratti,
  STRING_AGG(DISTINCT config_id::text, ', ') as contratti_usati,
  STRING_AGG(DISTINCT name, '; ') as nomi_listini,
  CASE
    WHEN COUNT(DISTINCT config_id) = (
      SELECT COUNT(DISTINCT metadata->>'courier_config_id')
      FROM price_lists
      WHERE created_by = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
      AND list_type = 'supplier'
    ) THEN '✅ SEPARATI CORRETTAMENTE'
    ELSE '⚠️ VERIFICARE (potrebbero mancare contratti)'
  END as status
FROM config_carriers
GROUP BY carrier_code
ORDER BY carrier_code;

-- INTERPRETAZIONE RISULTATI:
--
-- Query 1: Deve mostrare 2+ righe, una per ogni contratto
-- Query 2: Ogni listino deve avere carrier_code E config_id non NULL
-- Query 3: Ogni listino deve avere entries > 0
-- Query 4: Nessun listino deve avere status "ZERO ENTRIES"
-- Query 5: Ogni carrier_code deve essere presente in TUTTI i contratti (num_contratti >= 2)
--
-- SE TUTTI I CHECK PASSANO → ✅ FIX FUNZIONA!
-- SE QUALCHE CHECK FALLISCE → ❌ Serve ulteriore debug
