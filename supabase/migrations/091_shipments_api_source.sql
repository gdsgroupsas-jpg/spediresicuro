-- ============================================
-- MIGRATION: 091_shipments_api_source.sql
-- DESCRIZIONE: Aggiunge campo api_source a shipments per tracking fonte contratto
-- DATA: 2026-01-07
-- CRITICITÀ: P0 - FINANCIAL CORE
-- SPRINT: 1 - Financial Tracking Infrastructure
-- ============================================
--
-- SCOPO:
-- Ogni spedizione deve sapere QUALE CONTRATTO è stato usato:
-- - platform: contratti SpedireSicuro (paghiamo noi il corriere)
-- - reseller_own: contratto proprio del Reseller
-- - byoc_own: contratto proprio del BYOC
-- - unknown: record legacy prima di questa migration
--
-- Questo è fondamentale per:
-- 1. Determinare chi paga effettivamente il corriere
-- 2. Calcolare P&L correttamente
-- 3. Routing delle spedizioni
--
-- ============================================

-- ============================================
-- STEP 1: Aggiungere campo api_source
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'api_source'
  ) THEN
    -- Aggiungi colonna
    ALTER TABLE shipments 
    ADD COLUMN api_source TEXT DEFAULT 'unknown';
    
    -- Aggiungi constraint
    ALTER TABLE shipments 
    ADD CONSTRAINT shipments_api_source_check 
    CHECK (api_source IN ('platform', 'reseller_own', 'byoc_own', 'unknown'));
    
    RAISE NOTICE '✅ Aggiunto campo: shipments.api_source';
  ELSE
    RAISE NOTICE '⚠️ Campo shipments.api_source già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 2: Aggiungere campo price_list_used_id
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'price_list_used_id'
  ) THEN
    ALTER TABLE shipments 
    ADD COLUMN price_list_used_id UUID REFERENCES price_lists(id) ON DELETE SET NULL;
    
    RAISE NOTICE '✅ Aggiunto campo: shipments.price_list_used_id';
  ELSE
    RAISE NOTICE '⚠️ Campo shipments.price_list_used_id già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 3: Indici
-- ============================================

-- Indice per filtering per api_source
CREATE INDEX IF NOT EXISTS idx_shipments_api_source 
  ON shipments(api_source);

-- Indice per join con price_lists
CREATE INDEX IF NOT EXISTS idx_shipments_price_list_used 
  ON shipments(price_list_used_id) 
  WHERE price_list_used_id IS NOT NULL;

-- Composite per report: utente + api_source + data
CREATE INDEX IF NOT EXISTS idx_shipments_user_api_date 
  ON shipments(user_id, api_source, created_at DESC);

-- ============================================
-- STEP 4: Comments
-- ============================================

COMMENT ON COLUMN shipments.api_source IS 
  'Fonte contratto: platform (SpedireSicuro paga), reseller_own (Reseller paga), byoc_own (BYOC paga), unknown (legacy)';

COMMENT ON COLUMN shipments.price_list_used_id IS 
  'ID del listino usato per calcolare il prezzo. Utile per audit e riconciliazione.';

-- ============================================
-- STEP 5: Backfill script (BEST EFFORT)
-- ============================================
-- 
-- NOTA: Questo script tenta di determinare api_source per record esistenti
-- basandosi su euristiche. NON È PERFETTO, ma meglio di 'unknown'.
--
-- Eseguire SOLO se necessario, dopo aver verificato la logica.
--

-- Funzione helper per backfill (commentata per sicurezza)
/*
CREATE OR REPLACE FUNCTION backfill_shipments_api_source()
RETURNS TABLE(updated_count INTEGER, platform_count INTEGER, reseller_count INTEGER) AS $$
DECLARE
  v_updated INTEGER := 0;
  v_platform INTEGER := 0;
  v_reseller INTEGER := 0;
BEGIN
  -- 1. Se user è BYOC con proprio contratto → byoc_own
  UPDATE shipments s
  SET api_source = 'byoc_own'
  FROM users u
  WHERE s.user_id = u.id
    AND u.account_type = 'byoc'
    AND s.api_source = 'unknown';
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Aggiornati % record come byoc_own', v_updated;

  -- 2. Se shipment ha price_list_used_id con master_list_id → platform
  UPDATE shipments s
  SET api_source = 'platform'
  FROM price_lists pl
  WHERE s.price_list_used_id = pl.id
    AND pl.master_list_id IS NOT NULL
    AND s.api_source = 'unknown';
  
  GET DIAGNOSTICS v_platform = ROW_COUNT;
  RAISE NOTICE 'Aggiornati % record come platform (da master_list)', v_platform;

  -- 3. Default rimanenti → reseller_own (assunzione conservativa)
  UPDATE shipments
  SET api_source = 'reseller_own'
  WHERE api_source = 'unknown';
  
  GET DIAGNOSTICS v_reseller = ROW_COUNT;
  RAISE NOTICE 'Aggiornati % record come reseller_own (default)', v_reseller;

  RETURN QUERY SELECT v_updated + v_platform + v_reseller, v_platform, v_reseller;
END;
$$ LANGUAGE plpgsql;

-- Per eseguire:
-- SELECT * FROM backfill_shipments_api_source();
*/

-- ============================================
-- STEP 6: View helper per statistiche
-- ============================================

CREATE OR REPLACE VIEW v_shipments_by_api_source AS
SELECT 
  api_source,
  COUNT(*) AS total_shipments,
  COUNT(DISTINCT user_id) AS unique_users,
  SUM(total_cost) AS total_revenue,
  AVG(total_cost) AS avg_cost,
  MIN(created_at) AS first_shipment,
  MAX(created_at) AS last_shipment
FROM shipments
WHERE status NOT IN ('cancelled', 'deleted')
GROUP BY api_source
ORDER BY total_shipments DESC;

COMMENT ON VIEW v_shipments_by_api_source IS 
  'Statistiche spedizioni raggruppate per fonte API (platform, reseller_own, byoc_own, unknown)';

-- ============================================
-- STEP 7: Verifica
-- ============================================

DO $$
DECLARE
  v_has_api_source BOOLEAN;
  v_has_price_list_id BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'api_source'
  ) INTO v_has_api_source;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'price_list_used_id'
  ) INTO v_has_price_list_id;

  IF NOT v_has_api_source THEN
    RAISE EXCEPTION 'FAIL: Campo api_source non trovato';
  END IF;

  IF NOT v_has_price_list_id THEN
    RAISE EXCEPTION 'FAIL: Campo price_list_used_id non trovato';
  END IF;

  RAISE NOTICE '✅ Migration 091 verificata con successo';
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 091 completata con successo';
  RAISE NOTICE '';
  RAISE NOTICE '📊 CAMPI AGGIUNTI A SHIPMENTS:';
  RAISE NOTICE '   - api_source: platform|reseller_own|byoc_own|unknown';
  RAISE NOTICE '   - price_list_used_id: FK a price_lists';
  RAISE NOTICE '';
  RAISE NOTICE '📈 INDICI CREATI:';
  RAISE NOTICE '   - idx_shipments_api_source';
  RAISE NOTICE '   - idx_shipments_price_list_used';
  RAISE NOTICE '   - idx_shipments_user_api_date';
  RAISE NOTICE '';
  RAISE NOTICE '📊 VIEW CREATA: v_shipments_by_api_source';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NOTA: Record esistenti hanno api_source = "unknown"';
  RAISE NOTICE '   Backfill disponibile ma commentato per sicurezza.';
  RAISE NOTICE '========================================';
END $$;
