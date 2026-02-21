-- 🔍 VISTA COMPATTA: Configurazioni API Corriere e Carrier Codes
-- Utente test: testspediresicuro+postaexpress@gmail.com
--
-- Mostra in una sola query tutte le configurazioni API con i loro carrier codes

SELECT 
  -- Info Configurazione
  cc.id as config_id,
  cc.name as config_name,
  cc.provider_id,
  cc.is_active,
  cc.is_default,
  CASE 
    WHEN cc.owner_user_id = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com') 
    THEN '✅ Proprietà'
    WHEN cc.is_default = true 
    THEN '🌐 Default'
    ELSE '🔗 Condivisa'
  END as tipo,
  
  -- Carrier Code e Contract Code
  jsonb_object_keys(cc.contract_mapping) as carrier_code,
  cc.contract_mapping->>jsonb_object_keys(cc.contract_mapping) as contract_code,
  
  -- Info aggiuntive
  cc.base_url,
  cc.created_at,
  cc.description
  
FROM courier_configs cc
WHERE 
  cc.contract_mapping IS NOT NULL 
  AND cc.contract_mapping != '{}'::jsonb
  AND (
    -- Configurazioni di proprietà dell'utente test
    cc.owner_user_id = (SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
    -- O configurazioni default
    OR cc.is_default = true
    -- O configurazioni assegnate all'utente
    OR cc.id = (SELECT assigned_config_id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com')
  )
ORDER BY 
  cc.provider_id, 
  cc.name, 
  carrier_code;
