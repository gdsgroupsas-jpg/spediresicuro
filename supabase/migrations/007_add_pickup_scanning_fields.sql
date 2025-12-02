/**
 * Migration: Aggiunge campi per scanner ritiro LDV
 * 
 * Aggiunge:
 * 1. Stato 'scanned_at_pickup' all'enum shipment_status
 * 2. Campo pickup_time per timestamp ritiro
 * 3. Campo gps_location per coordinate GPS
 * 4. Campo picked_up_by per tracciare l'operatore
 */

-- Aggiungi nuovo stato all'enum shipment_status
DO $$ 
BEGIN
  -- Controlla se lo stato esiste già
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'scanned_at_pickup' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'shipment_status')
  ) THEN
    ALTER TYPE shipment_status ADD VALUE 'scanned_at_pickup';
    RAISE NOTICE '✅ Aggiunto stato: scanned_at_pickup';
  ELSE
    RAISE NOTICE '⚠️ Stato scanned_at_pickup già esistente';
  END IF;
END $$;

-- Aggiungi campo pickup_time (timestamp ritiro)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'pickup_time'
  ) THEN
    ALTER TABLE shipments ADD COLUMN pickup_time TIMESTAMPTZ;
    RAISE NOTICE '✅ Aggiunto campo: pickup_time';
  ELSE
    RAISE NOTICE '⚠️ Campo pickup_time già esistente';
  END IF;
END $$;

-- Aggiungi campo gps_location (coordinate GPS formato "lat,lng")
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'gps_location'
  ) THEN
    ALTER TABLE shipments ADD COLUMN gps_location TEXT;
    COMMENT ON COLUMN shipments.gps_location IS 'Coordinate GPS ritiro in formato "latitudine,longitudine" (es. "45.4642,9.1900")';
    RAISE NOTICE '✅ Aggiunto campo: gps_location';
  ELSE
    RAISE NOTICE '⚠️ Campo gps_location già esistente';
  END IF;
END $$;

-- Aggiungi campo picked_up_by (ID o email operatore)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'picked_up_by'
  ) THEN
    ALTER TABLE shipments ADD COLUMN picked_up_by TEXT;
    COMMENT ON COLUMN shipments.picked_up_by IS 'Email o ID dell''operatore che ha effettuato il ritiro';
    RAISE NOTICE '✅ Aggiunto campo: picked_up_by';
  ELSE
    RAISE NOTICE '⚠️ Campo picked_up_by già esistente';
  END IF;
END $$;

-- Crea indice per ricerche per pickup_time
CREATE INDEX IF NOT EXISTS idx_shipments_pickup_time 
ON shipments(pickup_time DESC) 
WHERE pickup_time IS NOT NULL;

-- Crea indice per ricerche per status scanned_at_pickup
CREATE INDEX IF NOT EXISTS idx_shipments_scanned_at_pickup 
ON shipments(status) 
WHERE status = 'scanned_at_pickup';

DO $$ 
BEGIN
  RAISE NOTICE '✅ Migration completata: campi scanner ritiro LDV aggiunti';
END $$;

