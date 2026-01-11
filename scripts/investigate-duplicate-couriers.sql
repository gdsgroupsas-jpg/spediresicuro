-- 🔍 SCRIPT DI INVESTIGAZIONE: Duplicati corrieri nel preventivatore
-- 
-- Problema: Nel preventivatore compaiono due corrieri con etichetta "Default"
-- (Postedeliverybusiness e Poste Italiane) con stesso costo fornitore
--
-- Questo script verifica:
-- 1. Configurazioni corriere attive per il reseller
-- 2. Listini personalizzati attivi
-- 3. Contract codes duplicati
-- 4. Mapping corrieri

-- ⚠️ SOSTITUISCI CON L'EMAIL DEL RESELLER DA TESTARE
DO $$
DECLARE
  reseller_email TEXT := 'testspediresicuro+postaexpress@gmail.com';
  reseller_user_id UUID;
BEGIN
  -- 1. Info utente reseller
  SELECT id INTO reseller_user_id
  FROM users
  WHERE email = reseller_email;
  
  IF reseller_user_id IS NULL THEN
    RAISE EXCEPTION 'Utente non trovato con email: %', reseller_email;
  END IF;
  
  RAISE NOTICE '🔍 Investigazione duplicati corrieri per: % (ID: %)', reseller_email, reseller_user_id;
END $$;

-- 1. Info utente reseller
SELECT 
  u.id as user_id,
  u.email,
  u.is_reseller,
  u.assigned_config_id,
  u.account_type
FROM users u
WHERE u.email = 'testspediresicuro+postaexpress@gmail.com';

-- 2. Configurazioni corriere PERSONALI del reseller
SELECT 
  cc.id as config_id,
  cc.provider_id,
  cc.is_active,
  cc.is_default,
  cc.owner_user_id,
  cc.contract_mapping,
  key as contract_code,
  value::text as courier_name
FROM courier_configs cc,
  jsonb_each_text(cc.contract_mapping) AS t(key, value)
WHERE cc.owner_user_id = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
  AND cc.is_active = true
ORDER BY cc.created_at DESC, key;

-- 3. Configurazione ASSEGNATA al reseller (se presente)
SELECT 
  cc.id as config_id,
  cc.provider_id,
  cc.is_active,
  cc.is_default,
  cc.owner_user_id,
  cc.contract_mapping,
  key as contract_code,
  value::text as courier_name
FROM courier_configs cc,
  jsonb_each_text(cc.contract_mapping) AS t(key, value)
WHERE cc.id = (SELECT assigned_config_id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
  AND cc.is_active = true
ORDER BY key;

-- 4. Configurazioni DEFAULT GLOBALI (owner_user_id = NULL)
SELECT 
  cc.id as config_id,
  cc.provider_id,
  cc.is_active,
  cc.is_default,
  cc.owner_user_id,
  cc.contract_mapping,
  key as contract_code,
  value::text as courier_name
FROM courier_configs cc,
  jsonb_each_text(cc.contract_mapping) AS t(key, value)
WHERE cc.is_default = true
  AND cc.is_active = true
  AND cc.owner_user_id IS NULL
ORDER BY cc.created_at DESC, key;

-- 5. Listini personalizzati ATTIVI del reseller
SELECT 
  pl.id,
  pl.name,
  pl.courier_id,
  c.name as courier_name,
  pl.list_type,
  pl.status,
  pl.default_margin_percent,
  pl.default_margin_fixed,
  pl.created_at
FROM price_lists pl
LEFT JOIN couriers c ON c.id = pl.courier_id
WHERE pl.created_by = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
  AND pl.list_type = 'custom'
  AND pl.status = 'active'
ORDER BY pl.created_at DESC;

-- 6. ANALISI: Tutti i corrieri che verrebbero mostrati (simula getAvailableCouriersForUser)
-- Questo mostra TUTTE le configurazioni che contribuiscono ai corrieri disponibili
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
)
SELECT 
  ac.config_type,
  ac.id as config_id,
  ac.provider_id,
  t.key as contract_code,
  t.value::text as courier_name,
  -- Verifica se esiste un corriere nella tabella couriers
  (SELECT c.id FROM couriers c WHERE c.name ILIKE '%' || t.value::text || '%' LIMIT 1) as courier_id
FROM all_configs ac,
  jsonb_each_text(ac.contract_mapping) AS t(key, value)
ORDER BY ac.config_type, t.value::text, t.key;

-- 7. DUPLICATI POTENZIALI: Corrieri con stesso nome ma contract_code diversi
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
expanded_couriers AS (
  SELECT 
    ac.config_type,
    ac.id as config_id,
    ac.provider_id,
    t.key as contract_code,
    t.value::text as courier_name
  FROM all_configs ac,
    jsonb_each_text(ac.contract_mapping) AS t(key, value)
)
SELECT 
  courier_name,
  COUNT(DISTINCT contract_code) as num_contracts,
  COUNT(DISTINCT config_id) as num_configs,
  string_agg(DISTINCT contract_code, ', ') as contract_codes,
  string_agg(DISTINCT config_type, ', ') as config_types
FROM expanded_couriers
GROUP BY courier_name
HAVING COUNT(DISTINCT contract_code) > 1 OR COUNT(DISTINCT config_id) > 1
ORDER BY courier_name;
