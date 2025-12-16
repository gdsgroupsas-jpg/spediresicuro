-- Query per DISATTIVARE configurazioni Poste problematiche
-- Esegui queste query in Supabase Studio > SQL Editor

-- 1. Disattiva configurazione senza API Secret (non funzionerà)
UPDATE courier_configs
SET is_active = false,
    notes = 'Disattivata: manca API Secret'
WHERE id = '74ab8ea3-ccb9-4b02-8a00-e6fb9109099b';

-- 2. Disattiva configurazioni senza CDC (potrebbero non funzionare)
UPDATE courier_configs
SET is_active = false,
    notes = 'Disattivata: CDC non configurato'
WHERE id IN (
  'f3a43efa-0cea-463e-8e22-cd8b97a8ca20',  -- Config #3
  '6b4e3ee3-fb24-4dd6-b9d4-fbbd12af874a',  -- Config #4
  'c3225be4-bb46-44d9-8a3e-0691612238c0'   -- Config #6
);

-- 3. Disattiva configurazione con Base URL errato
UPDATE courier_configs
SET is_active = false,
    notes = 'Disattivata: Base URL errato (usa apiw.gp.posteitaliane.it)'
WHERE id = 'c3225be4-bb46-44d9-8a3e-0691612238c0';

-- 4. Verifica che solo la configurazione default sia attiva
-- (La config #2 è identica alla default, puoi disattivarla se vuoi)
UPDATE courier_configs
SET is_active = false,
    notes = 'Disattivata: duplicato della configurazione default'
WHERE id = '6fd1cf93-c649-4628-8b0c-fd98ec02ecc6'
  AND is_default = false;

-- 5. Verifica finale: tutte le configurazioni Poste
SELECT 
  id,
  name,
  is_active,
  is_default,
  CASE WHEN api_secret IS NULL THEN '❌ Manca Secret' ELSE '✅ OK' END as secret_status,
  CASE WHEN contract_mapping->>'cdc' IS NULL THEN '❌ Manca CDC' ELSE '✅ OK' END as cdc_status,
  CASE WHEN base_url = 'https://apiw.gp.posteitaliane.it/gp/internet' THEN '✅ Corretto' ELSE '⚠️ Errato' END as base_url_status,
  notes
FROM courier_configs
WHERE provider_id = 'poste'
ORDER BY is_default DESC, is_active DESC, created_at DESC;

