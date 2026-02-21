-- Migration: Preventivatore Intelligente Fase A2
--
-- 1. does_client_pickup su supplier_price_list_config:
--    indica se il corriere/contratto fa ritiro dal cliente finale.
--    Se delivery_mode = 'carrier_pickup', mostra solo corrieri con flag = true.
--
-- 2. goods_needs_processing + processing_fee su commercial_quotes:
--    per gestire la lavorazione merce (etichettatura, imballaggio).

-- === supplier_price_list_config ===
ALTER TABLE supplier_price_list_config
  ADD COLUMN IF NOT EXISTS does_client_pickup boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN supplier_price_list_config.does_client_pickup IS
  'Il corriere fa ritiro direttamente dal cliente finale? false = solo magazzino reseller';

-- === commercial_quotes: lavorazione merce ===
ALTER TABLE commercial_quotes
  ADD COLUMN IF NOT EXISTS goods_needs_processing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS processing_fee numeric(10,2) DEFAULT NULL;

COMMENT ON COLUMN commercial_quotes.goods_needs_processing IS
  'La merce richiede lavorazione (etichettatura, imballaggio) da parte del reseller';
COMMENT ON COLUMN commercial_quotes.processing_fee IS
  'Costo lavorazione per spedizione in EUR. NULL = gratuito/incluso';

-- === commercial_quotes: multi-corriere ===
ALTER TABLE commercial_quotes
  ADD COLUMN IF NOT EXISTS additional_carriers jsonb DEFAULT NULL;

COMMENT ON COLUMN commercial_quotes.additional_carriers IS
  'Array di snapshot aggiuntivi per confronto multi-corriere [{carrier_code, contract_code, price_matrix}]';
