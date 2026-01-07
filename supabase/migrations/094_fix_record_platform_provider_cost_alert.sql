-- ============================================
-- MIGRATION: 094_fix_record_platform_provider_cost_alert.sql
-- DESCRIZIONE: Fix bug nella funzione record_platform_provider_cost per alert margini negativi
-- DATA: 2026-01-07
-- CRITICITÀ: P0 - BUG FIX
-- SPRINT: 1 - Financial Tracking Infrastructure
-- ============================================
--
-- PROBLEMA:
-- La funzione record_platform_provider_cost() aveva una condizione buggata:
--   WHERE EXISTS (SELECT 1 FROM financial_audit_log LIMIT 0)
-- 
-- LIMIT 0 restituisce sempre zero righe, quindi EXISTS è sempre FALSE,
-- disabilitando completamente gli alert automatici per margini negativi.
--
-- SOLUZIONE:
-- Sostituire con verifica corretta dell'esistenza della tabella usando
-- information_schema.tables prima di inserire l'alert.
--
-- ============================================

-- ============================================
-- STEP 1: Ricreare funzione con fix
-- ============================================

CREATE OR REPLACE FUNCTION record_platform_provider_cost(
  p_shipment_id UUID,
  p_tracking_number TEXT,
  p_billed_user_id UUID,
  p_billed_amount DECIMAL,
  p_provider_cost DECIMAL,
  p_api_source TEXT,
  p_courier_code TEXT,
  p_service_type TEXT DEFAULT NULL,
  p_price_list_id UUID DEFAULT NULL,
  p_master_price_list_id UUID DEFAULT NULL,
  p_cost_source TEXT DEFAULT 'estimate'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Validazione input
  IF p_shipment_id IS NULL THEN
    RAISE EXCEPTION 'shipment_id è obbligatorio';
  END IF;
  
  IF p_billed_amount < 0 THEN
    RAISE EXCEPTION 'billed_amount non può essere negativo';
  END IF;
  
  IF p_provider_cost < 0 THEN
    RAISE EXCEPTION 'provider_cost non può essere negativo';
  END IF;

  -- Insert con conflict handling (idempotent)
  INSERT INTO platform_provider_costs (
    shipment_id,
    shipment_tracking_number,
    billed_user_id,
    billed_amount,
    provider_cost,
    api_source,
    courier_code,
    service_type,
    price_list_id,
    master_price_list_id,
    cost_source
  )
  VALUES (
    p_shipment_id,
    p_tracking_number,
    p_billed_user_id,
    p_billed_amount,
    p_provider_cost,
    p_api_source,
    p_courier_code,
    p_service_type,
    p_price_list_id,
    p_master_price_list_id,
    p_cost_source
  )
  ON CONFLICT (shipment_id) DO UPDATE SET
    billed_amount = EXCLUDED.billed_amount,
    provider_cost = EXCLUDED.provider_cost,
    updated_at = NOW()
  RETURNING id INTO v_id;

  -- Log se margine negativo (alert automatico)
  -- NOTA: financial_audit_log viene creata in migration 093, quindi verifichiamo
  -- l'esistenza della tabella prima di inserire per evitare errori se la migration
  -- 093 non è ancora stata eseguita
  IF p_billed_amount < p_provider_cost THEN
    -- Verifica se la tabella financial_audit_log esiste
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'financial_audit_log'
    ) THEN
      INSERT INTO financial_audit_log (
        event_type,
        shipment_id,
        user_id,
        amount,
        metadata
      )
      VALUES (
        'margin_alert',
        p_shipment_id,
        p_billed_user_id,
        p_billed_amount - p_provider_cost,
        jsonb_build_object(
          'billed_amount', p_billed_amount,
          'provider_cost', p_provider_cost,
          'margin_percent', CASE WHEN p_provider_cost > 0 
            THEN ROUND(((p_billed_amount - p_provider_cost) / p_provider_cost * 100)::numeric, 2)
            ELSE 0 END,
          'courier', p_courier_code,
          'alert', 'NEGATIVE_MARGIN'
        )
      );
    END IF;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

COMMENT ON FUNCTION record_platform_provider_cost IS 
  'Inserisce o aggiorna record costo piattaforma. Idempotent (ON CONFLICT UPDATE). 
   Genera alert automatico se margine negativo (FIX: ora funziona correttamente).';

-- ============================================
-- STEP 2: Verifica
-- ============================================

DO $$
BEGIN
  -- Verifica che la funzione esista
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'record_platform_provider_cost'
  ) THEN
    RAISE EXCEPTION 'FAIL: Funzione record_platform_provider_cost non trovata';
  END IF;

  RAISE NOTICE '✅ Migration 094 verificata con successo';
  RAISE NOTICE '✅ Funzione record_platform_provider_cost aggiornata con fix alert';
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 094 completata con successo';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 FIX APPLICATO:';
  RAISE NOTICE '   - Funzione record_platform_provider_cost() aggiornata';
  RAISE NOTICE '   - Alert margini negativi ora funzionano correttamente';
  RAISE NOTICE '   - Verifica esistenza tabella financial_audit_log corretta';
  RAISE NOTICE '';
  RAISE NOTICE '📊 IMPATTO:';
  RAISE NOTICE '   - Gli alert automatici per margini negativi ora vengono';
  RAISE NOTICE '     registrati correttamente nel financial_audit_log';
  RAISE NOTICE '========================================';
END $$;
