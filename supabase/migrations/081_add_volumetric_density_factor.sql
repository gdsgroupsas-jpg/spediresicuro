-- ============================================
-- MIGRATION: 081_add_volumetric_density_factor.sql
-- DESCRIZIONE: Aggiunge campo volumetric_density_factor per configurazione fattore peso/volume
-- DATA: 2026-01-XX
-- ============================================
--
-- PROBLEMA:
-- Il fattore peso/volume (densità) è hardcoded a 5000 (200 kg/m³).
-- Ogni corriere/contratto può avere un fattore diverso configurabile in Spedisci.Online.
-- Deve essere configurabile manualmente per listini fornitore e cliente.
--
-- SOLUZIONE:
-- Aggiunge campo volumetric_density_factor in supplier_price_list_config.
-- Default: 200 kg/m³ (corrisponde a divisore 5000).
-- ============================================

-- Aggiungi campo volumetric_density_factor
ALTER TABLE supplier_price_list_config
ADD COLUMN IF NOT EXISTS volumetric_density_factor DECIMAL(10,2) DEFAULT 200.00;

-- Commento
COMMENT ON COLUMN supplier_price_list_config.volumetric_density_factor IS 
  'Fattore densità peso/volume in kg/m³. Default: 200 kg/m³ (divisore 5000). Usato per calcolo peso volumetrico: (L×W×H in cm) / (1,000,000 / volumetric_density_factor)';

-- Aggiorna valori esistenti a default se NULL
UPDATE supplier_price_list_config
SET volumetric_density_factor = 200.00
WHERE volumetric_density_factor IS NULL;

-- NOTA: La funzione calculate_volumetric_weight verrà modificata in una migration successiva
-- per usare il fattore del listino invece di 5000 hardcoded.

-- Log completamento (usando DO block per RAISE NOTICE)
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 081_add_volumetric_density_factor completata';
  RAISE NOTICE '  - Campo volumetric_density_factor aggiunto a supplier_price_list_config';
  RAISE NOTICE '  - Default: 200 kg/m³ (divisore 5000)';
END $$;
