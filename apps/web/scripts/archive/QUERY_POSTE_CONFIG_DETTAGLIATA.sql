-- Query DETTAGLIATA per verificare configurazioni Poste Italiane
-- Mostra tutte le informazioni in una singola query

SELECT 
  id,
  name as "Nome Configurazione",
  provider_id as "Provider",
  base_url as "Base URL",
  CASE WHEN is_active THEN '✅ Sì' ELSE '❌ No' END as "Attiva",
  CASE WHEN is_default THEN '✅ Sì' ELSE '❌ No' END as "Default",
  CASE 
    WHEN api_key IS NOT NULL AND api_key LIKE '%:%:%:%' THEN '✅ Criptata'
    WHEN api_key IS NOT NULL THEN '⚠️ Testo in chiaro'
    ELSE '❌ Mancante'
  END as "API Key",
  CASE 
    WHEN api_secret IS NOT NULL AND api_secret LIKE '%:%:%:%' THEN '✅ Criptato'
    WHEN api_secret IS NOT NULL THEN '⚠️ Testo in chiaro'
    ELSE '❌ Mancante'
  END as "API Secret",
  LENGTH(api_key) as "Lunghezza API Key",
  LENGTH(api_secret) as "Lunghezza API Secret",
  contract_mapping->>'cdc' as "CDC",
  contract_mapping as "Contract Mapping Completo",
  created_at as "Creato il",
  updated_at as "Aggiornato il",
  created_by as "Creato da",
  description as "Descrizione"
FROM courier_configs
WHERE provider_id = 'poste'
ORDER BY 
  is_active DESC,  -- Prima le attive
  is_default DESC,  -- Poi le default
  created_at DESC;  -- Infine per data

-- Riepilogo statistiche (esegui separatamente se vuoi)
SELECT 
  COUNT(*) as totale_configurazioni,
  COUNT(*) FILTER (WHERE is_active = true) as configurazioni_attive,
  COUNT(*) FILTER (WHERE is_default = true) as configurazioni_default,
  COUNT(*) FILTER (WHERE contract_mapping->>'cdc' IS NOT NULL) as con_cdc_configurato,
  COUNT(*) FILTER (WHERE api_key LIKE '%:%:%:%') as api_key_criptate,
  COUNT(*) FILTER (WHERE api_secret LIKE '%:%:%:%') as api_secret_criptati
FROM courier_configs
WHERE provider_id = 'poste';

