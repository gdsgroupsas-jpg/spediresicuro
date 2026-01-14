-- ============================================
-- Migration: Aggiungi colonne fiscali mancanti a shipments
-- Data: 2026-01-14
-- Descrizione: Aggiunge total_price, courier_cost, cod_status e margin per supporto dashboard finanza
-- ============================================

-- Crea enum per cod_status se non esiste
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cod_status_type') THEN
    CREATE TYPE cod_status_type AS ENUM ('pending', 'collected', 'paid');
    RAISE NOTICE '✅ Creato enum cod_status_type';
  END IF;
END
$$;

-- Aggiungi total_price (alias di final_price per compatibilità)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'total_price'
  ) THEN
    ALTER TABLE shipments ADD COLUMN total_price DECIMAL(10,2);
    RAISE NOTICE '✅ Aggiunto campo: total_price';
    
    -- Popola total_price con final_price esistente
    UPDATE shipments 
    SET total_price = final_price 
    WHERE final_price IS NOT NULL;
    
    RAISE NOTICE '✅ Popolato total_price da final_price';
  END IF;
END
$$;

-- Aggiungi courier_cost (alias di total_cost per compatibilità)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'courier_cost'
  ) THEN
    ALTER TABLE shipments ADD COLUMN courier_cost DECIMAL(10,2);
    RAISE NOTICE '✅ Aggiunto campo: courier_cost';
    
    -- Popola courier_cost con total_cost esistente
    UPDATE shipments 
    SET courier_cost = total_cost 
    WHERE total_cost IS NOT NULL;
    
    RAISE NOTICE '✅ Popolato courier_cost da total_cost';
  END IF;
END
$$;

-- Aggiungi cod_status (stato contrassegno)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'cod_status'
  ) THEN
    ALTER TABLE shipments ADD COLUMN cod_status cod_status_type DEFAULT 'pending';
    RAISE NOTICE '✅ Aggiunto campo: cod_status';
    
    -- Imposta cod_status = 'pending' per tutte le spedizioni con contrassegno
    UPDATE shipments 
    SET cod_status = 'pending' 
    WHERE cash_on_delivery = true AND cod_status IS NULL;
    
    RAISE NOTICE '✅ Impostato cod_status = pending per spedizioni con contrassegno';
  END IF;
END
$$;

-- Aggiungi margin (calcolato, ma lo salviamo per performance)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'margin'
  ) THEN
    ALTER TABLE shipments ADD COLUMN margin DECIMAL(10,2);
    RAISE NOTICE '✅ Aggiunto campo: margin';
    
    -- Calcola margin come total_price - courier_cost (o final_price - total_cost)
    UPDATE shipments 
    SET margin = COALESCE(total_price, final_price, 0) - COALESCE(courier_cost, total_cost, 0)
    WHERE (total_price IS NOT NULL OR final_price IS NOT NULL)
      AND (courier_cost IS NOT NULL OR total_cost IS NOT NULL);
    
    RAISE NOTICE '✅ Calcolato margin per spedizioni esistenti';
  END IF;
END
$$;

-- Crea trigger per mantenere total_price sincronizzato con final_price
CREATE OR REPLACE FUNCTION sync_total_price_from_final_price()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.final_price IS NOT NULL AND (NEW.total_price IS NULL OR NEW.total_price != NEW.final_price) THEN
    NEW.total_price := NEW.final_price;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_total_price ON shipments;
CREATE TRIGGER trigger_sync_total_price
  BEFORE INSERT OR UPDATE OF final_price ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION sync_total_price_from_final_price();

-- Crea trigger per mantenere courier_cost sincronizzato con total_cost
CREATE OR REPLACE FUNCTION sync_courier_cost_from_total_cost()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_cost IS NOT NULL AND (NEW.courier_cost IS NULL OR NEW.courier_cost != NEW.total_cost) THEN
    NEW.courier_cost := NEW.total_cost;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_courier_cost ON shipments;
CREATE TRIGGER trigger_sync_courier_cost
  BEFORE INSERT OR UPDATE OF total_cost ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION sync_courier_cost_from_total_cost();

-- Crea trigger per calcolare margin automaticamente
CREATE OR REPLACE FUNCTION calculate_margin()
RETURNS TRIGGER AS $$
BEGIN
  NEW.margin := COALESCE(NEW.total_price, NEW.final_price, 0) - COALESCE(NEW.courier_cost, NEW.total_cost, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_margin ON shipments;
CREATE TRIGGER trigger_calculate_margin
  BEFORE INSERT OR UPDATE OF total_price, final_price, courier_cost, total_cost ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION calculate_margin();

-- Crea indice per cod_status per query più veloci
CREATE INDEX IF NOT EXISTS idx_shipments_cod_status 
ON shipments(cod_status) 
WHERE cod_status IS NOT NULL;

-- Crea indice per cash_on_delivery + cod_status per query COD
CREATE INDEX IF NOT EXISTS idx_shipments_cod_pending 
ON shipments(cash_on_delivery, cod_status) 
WHERE cash_on_delivery = true AND cod_status != 'paid';

DO $$
BEGIN
  RAISE NOTICE '✅ Migration completata: colonne fiscali aggiunte a shipments';
END
$$;
