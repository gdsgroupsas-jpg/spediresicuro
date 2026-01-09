-- ============================================
-- QUERY SQL: Verifica Configurazioni Utente Test
-- Email: testspediresicuro+postaexpress@gmail.com
-- ============================================

-- 1. INFO UTENTE TEST
SELECT 
  id,
  email,
  name,
  account_type,
  is_reseller,
  reseller_role,
  assigned_config_id,
  created_at,
  updated_at
FROM users
WHERE email = 'testspediresicuro+postaexpress@gmail.com';

-- 2. CONFIGURAZIONI API DELL'UTENTE TEST (owner_user_id)
-- Mostra tutte le configurazioni di cui l'utente è owner
SELECT 
  cc.id AS config_id,
  cc.name AS config_name,
  cc.config_label,
  cc.provider_id,
  cc.is_active,
  cc.is_default,
  cc.owner_user_id,
  cc.created_by,
  cc.created_at,
  cc.updated_at,
  -- Contratti configurati (estratto da contract_mapping JSONB)
  jsonb_object_keys(cc.contract_mapping) AS contratto_corriere,
  cc.contract_mapping->jsonb_object_keys(cc.contract_mapping) AS contract_code,
  -- Base URL
  cc.base_url,
  -- API Key (solo hash per sicurezza, non il valore completo)
  CASE 
    WHEN cc.api_key IS NOT NULL THEN 
      LEFT(cc.api_key, 10) || '...' || RIGHT(cc.api_key, 4)
    ELSE 'NON CONFIGURATA'
  END AS api_key_preview
FROM courier_configs cc
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
ORDER BY cc.created_at DESC;

-- 3. CONFIGURAZIONI ASSEGNATE ALL'UTENTE TEST (assigned_config_id)
SELECT 
  cc.id AS config_id,
  cc.name AS config_name,
  cc.config_label,
  cc.provider_id,
  cc.is_active,
  cc.is_default,
  cc.owner_user_id,
  cc.created_by,
  cc.created_at,
  cc.updated_at,
  -- Contratti configurati
  jsonb_object_keys(cc.contract_mapping) AS contratto_corriere,
  cc.contract_mapping->jsonb_object_keys(cc.contract_mapping) AS contract_code,
  cc.base_url
FROM courier_configs cc
WHERE cc.id = (
  SELECT assigned_config_id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true;

-- 4. TUTTE LE CONFIGURAZIONI DISPONIBILI PER L'UTENTE TEST
-- (owner + assigned + default)
WITH user_info AS (
  SELECT 
    id AS user_id,
    assigned_config_id
  FROM users 
  WHERE email = 'testspediresicuro+postaexpress@gmail.com'
),
configs_with_access AS (
  SELECT 
    cc.id AS config_id,
    cc.name AS config_name,
    cc.provider_id,
    cc.is_active,
    cc.is_default,
    CASE 
      WHEN cc.owner_user_id = ui.user_id THEN 'OWNER'
      WHEN cc.id = ui.assigned_config_id THEN 'ASSIGNED'
      WHEN cc.is_default = true THEN 'DEFAULT'
      ELSE 'OTHER'
    END AS access_type,
    -- Conta contratti configurati
    jsonb_object_keys(cc.contract_mapping) AS contratto_corriere,
    cc.contract_mapping->jsonb_object_keys(cc.contract_mapping) AS contract_code,
    cc.base_url,
    cc.created_at
  FROM courier_configs cc
  CROSS JOIN user_info ui
  WHERE (
    -- Configurazioni di cui è owner
    cc.owner_user_id = ui.user_id
    -- O configurazione assegnata
    OR cc.id = ui.assigned_config_id
    -- O configurazione default
    OR (cc.is_default = true AND cc.provider_id = 'spedisci_online')
  )
  AND cc.is_active = true
  AND cc.provider_id = 'spedisci_online'
)
SELECT 
  config_id,
  config_name,
  provider_id,
  is_active,
  is_default,
  access_type,
  contratto_corriere,
  contract_code,
  base_url,
  created_at
FROM configs_with_access
ORDER BY 
  CASE access_type
    WHEN 'OWNER' THEN 1
    WHEN 'ASSIGNED' THEN 2
    WHEN 'DEFAULT' THEN 3
    ELSE 4
  END,
  created_at DESC;

-- 5. DETTAGLIO CONTRATTI PER OGNI CONFIGURAZIONE
-- Mostra tutti i contratti configurati in formato tabellare
WITH user_info AS (
  SELECT 
    id AS user_id,
    assigned_config_id
  FROM users 
  WHERE email = 'testspediresicuro+postaexpress@gmail.com'
),
configs AS (
  SELECT 
    cc.id AS config_id,
    cc.name AS config_name,
    cc.provider_id,
    cc.contract_mapping,
    CASE 
      WHEN cc.owner_user_id = ui.user_id THEN 'OWNER'
      WHEN cc.id = ui.assigned_config_id THEN 'ASSIGNED'
      WHEN cc.is_default = true THEN 'DEFAULT'
      ELSE 'OTHER'
    END AS access_type
  FROM courier_configs cc
  CROSS JOIN user_info ui
  WHERE (
    cc.owner_user_id = ui.user_id
    OR cc.id = ui.assigned_config_id
    OR (cc.is_default = true AND cc.provider_id = 'spedisci_online')
  )
  AND cc.is_active = true
  AND cc.provider_id = 'spedisci_online'
)
SELECT 
  c.config_id,
  c.config_name,
  c.access_type,
  key AS courier_name,
  value::text AS contract_code
FROM configs c,
  jsonb_each_text(c.contract_mapping) AS contract
ORDER BY c.config_id, key;

-- 6. RIEPILOGO CONFIGURAZIONI (VISTA COMPATTA)
SELECT 
  cc.id AS config_id,
  cc.name AS config_name,
  cc.provider_id,
  cc.is_active,
  cc.is_default,
  CASE 
    WHEN cc.owner_user_id = u.id THEN '✅ OWNER'
    WHEN cc.id = u.assigned_config_id THEN '✅ ASSIGNED'
    WHEN cc.is_default = true THEN '✅ DEFAULT'
    ELSE '❌ OTHER'
  END AS access_type,
  -- Conta contratti
  (
    SELECT COUNT(*) 
    FROM jsonb_object_keys(cc.contract_mapping)
  ) AS num_contratti,
  -- Lista contratti (formato compatto)
  (
    SELECT string_agg(key || ':' || value::text, ', ')
    FROM jsonb_each_text(cc.contract_mapping)
  ) AS contratti_lista,
  cc.created_at,
  cc.updated_at
FROM courier_configs cc
CROSS JOIN (
  SELECT id, assigned_config_id 
  FROM users 
  WHERE email = 'testspediresicuro+postaexpress@gmail.com'
) u
WHERE (
  cc.owner_user_id = u.id
  OR cc.id = u.assigned_config_id
  OR (cc.is_default = true AND cc.provider_id = 'spedisci_online')
)
AND cc.is_active = true
AND cc.provider_id = 'spedisci_online'
ORDER BY 
  CASE 
    WHEN cc.owner_user_id = u.id THEN 1
    WHEN cc.id = u.assigned_config_id THEN 2
    WHEN cc.is_default = true THEN 3
    ELSE 4
  END,
  cc.created_at DESC;

-- 7. VERIFICA CONFIGURAZIONI MULTIPLE (per debug multi-config)
-- Mostra se l'utente ha più configurazioni attive
SELECT 
  COUNT(*) AS num_configs_attive,
  COUNT(DISTINCT cc.id) AS num_configs_unique,
  string_agg(cc.name, ', ') AS nomi_configs
FROM courier_configs cc
WHERE cc.owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND cc.is_active = true
AND cc.provider_id = 'spedisci_online';
