-- 🧪 TEST: Verifica logica deduplicazione corrieri per reseller
-- 
-- Questo script simula la logica di deduplicazione implementata in /api/quotes/db/route.ts
-- per verificare che funzioni correttamente

-- ⚠️ SOSTITUISCI CON L'EMAIL DEL RESELLER DA TESTARE
DO $$
DECLARE
  reseller_email TEXT := 'testspediresicuro+postaexpress@gmail.com';
  reseller_user_id UUID;
BEGIN
  -- Recupera user ID
  SELECT id INTO reseller_user_id
  FROM users
  WHERE email = reseller_email;
  
  IF reseller_user_id IS NULL THEN
    RAISE EXCEPTION 'Utente non trovato con email: %', reseller_email;
  END IF;
  
  RAISE NOTICE '🧪 Test deduplicazione per: % (ID: %)', reseller_email, reseller_user_id;
END $$;

-- 1. Simula getAvailableCouriersForUser: recupera tutti i corrieri disponibili
WITH user_info AS (
  SELECT id, assigned_config_id
  FROM users
  WHERE email = 'testspediresicuro+postaexpress@gmail.com'
),
personal_configs AS (
  SELECT 
    cc.id,
    cc.provider_id,
    cc.contract_mapping,
    'personal' as config_type
  FROM courier_configs cc, user_info ui
  WHERE cc.owner_user_id = ui.id
    AND cc.is_active = true
),
assigned_configs AS (
  SELECT 
    cc.id,
    cc.provider_id,
    cc.contract_mapping,
    'assigned' as config_type
  FROM courier_configs cc, user_info ui
  WHERE cc.id = ui.assigned_config_id
    AND cc.is_active = true
),
default_configs AS (
  SELECT 
    cc.id,
    cc.provider_id,
    cc.contract_mapping,
    'default' as config_type
  FROM courier_configs cc
  WHERE cc.is_default = true
    AND cc.is_active = true
    AND cc.owner_user_id IS NULL
),
all_configs AS (
  SELECT * FROM personal_configs
  UNION ALL
  SELECT * FROM assigned_configs
  UNION ALL
  SELECT * FROM default_configs
),
all_couriers AS (
  SELECT 
    ac.config_type,
    ac.id as config_id,
    ac.provider_id,
    t.key as contract_code,
    t.value::text as courier_name,
    (SELECT c.id FROM couriers c WHERE c.name ILIKE '%' || t.value::text || '%' LIMIT 1) as courier_id
  FROM all_configs ac,
    jsonb_each_text(ac.contract_mapping) AS t(key, value)
)
SELECT 
  'PRIMA DEDUPLICAZIONE' as fase,
  courier_name,
  contract_code,
  config_type,
  courier_id,
  COUNT(*) OVER (PARTITION BY courier_name) as num_duplicati
FROM all_couriers
ORDER BY courier_name, contract_code;

-- 2. Filtra per listini personalizzati attivi (simula filtro in /api/quotes/db)
WITH user_info AS (
  SELECT id, assigned_config_id
  FROM users
  WHERE email = 'testspediresicuro+postaexpress@gmail.com'
),
active_custom_lists AS (
  SELECT DISTINCT courier_id
  FROM price_lists
  WHERE created_by = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
    AND list_type = 'custom'
    AND status = 'active'
    AND courier_id IS NOT NULL
),
personal_configs AS (
  SELECT 
    cc.id,
    cc.provider_id,
    cc.contract_mapping,
    'personal' as config_type
  FROM courier_configs cc, user_info ui
  WHERE cc.owner_user_id = ui.id
    AND cc.is_active = true
),
assigned_configs AS (
  SELECT 
    cc.id,
    cc.provider_id,
    cc.contract_mapping,
    'assigned' as config_type
  FROM courier_configs cc, user_info ui
  WHERE cc.id = ui.assigned_config_id
    AND cc.is_active = true
),
default_configs AS (
  SELECT 
    cc.id,
    cc.provider_id,
    cc.contract_mapping,
    'default' as config_type
  FROM courier_configs cc
  WHERE cc.is_default = true
    AND cc.is_active = true
    AND cc.owner_user_id IS NULL
),
all_configs AS (
  SELECT * FROM personal_configs
  UNION ALL
  SELECT * FROM assigned_configs
  UNION ALL
  SELECT * FROM default_configs
),
all_couriers AS (
  SELECT 
    ac.config_type,
    ac.id as config_id,
    ac.provider_id,
    t.key as contract_code,
    t.value::text as courier_name,
    (SELECT c.id FROM couriers c WHERE c.name ILIKE '%' || t.value::text || '%' LIMIT 1) as courier_id
  FROM all_configs ac,
    jsonb_each_text(ac.contract_mapping) AS t(key, value)
),
filtered_couriers AS (
  SELECT *
  FROM all_couriers
  WHERE courier_id IN (SELECT courier_id FROM active_custom_lists)
)
SELECT 
  'DOPO FILTRO LISTINO ATTIVO' as fase,
  courier_name,
  contract_code,
  config_type,
  courier_id,
  COUNT(*) OVER (PARTITION BY courier_name) as num_duplicati
FROM filtered_couriers
ORDER BY courier_name, contract_code;

-- 3. Simula deduplicazione per displayName (logica finale)
WITH user_info AS (
  SELECT id, assigned_config_id
  FROM users
  WHERE email = 'testspediresicuro+postaexpress@gmail.com'
),
active_custom_lists AS (
  SELECT DISTINCT courier_id
  FROM price_lists
  WHERE created_by = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
    AND list_type = 'custom'
    AND status = 'active'
    AND courier_id IS NOT NULL
),
personal_configs AS (
  SELECT 
    cc.id,
    cc.provider_id,
    cc.contract_mapping,
    'personal' as config_type
  FROM courier_configs cc, user_info ui
  WHERE cc.owner_user_id = ui.id
    AND cc.is_active = true
),
assigned_configs AS (
  SELECT 
    cc.id,
    cc.provider_id,
    cc.contract_mapping,
    'assigned' as config_type
  FROM courier_configs cc, user_info ui
  WHERE cc.id = ui.assigned_config_id
    AND cc.is_active = true
),
default_configs AS (
  SELECT 
    cc.id,
    cc.provider_id,
    cc.contract_mapping,
    'default' as config_type
  FROM courier_configs cc
  WHERE cc.is_default = true
    AND cc.is_active = true
    AND cc.owner_user_id IS NULL
),
all_configs AS (
  SELECT * FROM personal_configs
  UNION ALL
  SELECT * FROM assigned_configs
  UNION ALL
  SELECT * FROM default_configs
),
all_couriers AS (
  SELECT 
    ac.config_type,
    ac.id as config_id,
    ac.provider_id,
    t.key as contract_code,
    t.value::text as courier_name,
    (SELECT c.id FROM couriers c WHERE c.name ILIKE '%' || t.value::text || '%' LIMIT 1) as courier_id
  FROM all_configs ac,
    jsonb_each_text(ac.contract_mapping) AS t(key, value)
),
filtered_couriers AS (
  SELECT *
  FROM all_couriers
  WHERE courier_id IN (SELECT courier_id FROM active_custom_lists)
),
-- Simula mapping displayName (come in getDisplayName)
couriers_with_display AS (
  SELECT 
    *,
    CASE 
      WHEN LOWER(courier_name) IN ('gls', 'gls') THEN 'GLS'
      WHEN LOWER(courier_name) IN ('postedeliverybusiness', 'poste') THEN 'Poste Italiane'
      WHEN LOWER(courier_name) IN ('brt', 'bartolini') THEN 'Bartolini'
      WHEN LOWER(courier_name) IN ('sda') THEN 'SDA'
      WHEN LOWER(courier_name) IN ('dhl') THEN 'DHL'
      WHEN LOWER(courier_name) IN ('tnt') THEN 'TNT'
      WHEN LOWER(courier_name) IN ('ups') THEN 'UPS'
      WHEN LOWER(courier_name) IN ('fedex') THEN 'FedEx'
      ELSE courier_name
    END as display_name
  FROM filtered_couriers
),
-- Deduplica per displayName (mantieni il primo per ogni display_name)
deduplicated AS (
  SELECT DISTINCT ON (display_name)
    courier_name,
    contract_code,
    config_type,
    courier_id,
    display_name
  FROM couriers_with_display
  ORDER BY display_name, 
    CASE config_type 
      WHEN 'personal' THEN 1 
      WHEN 'assigned' THEN 2 
      WHEN 'default' THEN 3 
    END,
    contract_code
)
SELECT 
  'DOPO DEDUPLICAZIONE PER DISPLAYNAME' as fase,
  display_name,
  courier_name,
  contract_code,
  config_type,
  courier_id
FROM deduplicated
ORDER BY display_name;

-- 4. RIEPILOGO: Confronta prima e dopo
WITH user_info AS (
  SELECT id, assigned_config_id
  FROM users
  WHERE email = 'testspediresicuro+postaexpress@gmail.com'
),
active_custom_lists AS (
  SELECT DISTINCT courier_id
  FROM price_lists
  WHERE created_by = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
    AND list_type = 'custom'
    AND status = 'active'
    AND courier_id IS NOT NULL
),
personal_configs AS (
  SELECT 
    cc.id,
    cc.provider_id,
    cc.contract_mapping,
    'personal' as config_type
  FROM courier_configs cc, user_info ui
  WHERE cc.owner_user_id = ui.id
    AND cc.is_active = true
),
assigned_configs AS (
  SELECT 
    cc.id,
    cc.provider_id,
    cc.contract_mapping,
    'assigned' as config_type
  FROM courier_configs cc, user_info ui
  WHERE cc.id = ui.assigned_config_id
    AND cc.is_active = true
),
default_configs AS (
  SELECT 
    cc.id,
    cc.provider_id,
    cc.contract_mapping,
    'default' as config_type
  FROM courier_configs cc
  WHERE cc.is_default = true
    AND cc.is_active = true
    AND cc.owner_user_id IS NULL
),
all_configs AS (
  SELECT * FROM personal_configs
  UNION ALL
  SELECT * FROM assigned_configs
  UNION ALL
  SELECT * FROM default_configs
),
all_couriers AS (
  SELECT 
    ac.config_type,
    ac.id as config_id,
    ac.provider_id,
    t.key as contract_code,
    t.value::text as courier_name,
    (SELECT c.id FROM couriers c WHERE c.name ILIKE '%' || t.value::text || '%' LIMIT 1) as courier_id
  FROM all_configs ac,
    jsonb_each_text(ac.contract_mapping) AS t(key, value)
),
filtered_couriers AS (
  SELECT *
  FROM all_couriers
  WHERE courier_id IN (SELECT courier_id FROM active_custom_lists)
),
couriers_with_display AS (
  SELECT 
    *,
    CASE 
      WHEN LOWER(courier_name) IN ('gls', 'gls') THEN 'GLS'
      WHEN LOWER(courier_name) IN ('postedeliverybusiness', 'poste') THEN 'Poste Italiane'
      WHEN LOWER(courier_name) IN ('brt', 'bartolini') THEN 'Bartolini'
      WHEN LOWER(courier_name) IN ('sda') THEN 'SDA'
      WHEN LOWER(courier_name) IN ('dhl') THEN 'DHL'
      WHEN LOWER(courier_name) IN ('tnt') THEN 'TNT'
      WHEN LOWER(courier_name) IN ('ups') THEN 'UPS'
      WHEN LOWER(courier_name) IN ('fedex') THEN 'FedEx'
      ELSE courier_name
    END as display_name
  FROM filtered_couriers
),
deduplicated AS (
  SELECT DISTINCT ON (display_name)
    courier_name,
    contract_code,
    config_type,
    courier_id,
    display_name
  FROM couriers_with_display
  ORDER BY display_name, 
    CASE config_type 
      WHEN 'personal' THEN 1 
      WHEN 'assigned' THEN 2 
      WHEN 'default' THEN 3 
    END,
    contract_code
)
SELECT 
  'RIEPILOGO' as fase,
  COUNT(DISTINCT courier_name) FILTER (WHERE TRUE) as totale_corrieri_prima,
  COUNT(DISTINCT display_name) FILTER (WHERE TRUE) as totale_display_dopo,
  COUNT(*) FILTER (WHERE TRUE) as totale_entry_prima,
  (SELECT COUNT(*) FROM deduplicated) as totale_entry_dopo
FROM filtered_couriers;
