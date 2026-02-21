-- ============================================
-- Migration: Aggiunge delivery_mode e pickup_fee ai preventivi commerciali
--
-- Fase A del preventivatore intelligente:
-- - delivery_mode: come la merce arriva dal cliente al reseller/vettore
-- - pickup_fee: supplemento ritiro opzionale
-- ============================================

-- Nuovi campi sulla tabella commercial_quotes
ALTER TABLE commercial_quotes
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'carrier_pickup'
    CHECK (delivery_mode IN ('carrier_pickup', 'own_fleet', 'client_dropoff')),
  ADD COLUMN IF NOT EXISTS pickup_fee numeric(10,2) DEFAULT NULL;

-- Commenti per documentazione
COMMENT ON COLUMN commercial_quotes.delivery_mode IS
  'Modalita ritiro: carrier_pickup (vettore ritira dal cliente), own_fleet (reseller ritira con flotta), client_dropoff (cliente scarica al point)';
COMMENT ON COLUMN commercial_quotes.pickup_fee IS
  'Supplemento ritiro in EUR (NULL = gratuito/incluso nel prezzo)';

-- Aggiorna trigger immutabilita: delivery_mode e pickup_fee sono immutabili dopo invio
-- (gia protetti dal trigger esistente che blocca tutto tranne status/responded_at/converted_*/pdf_storage_path)
