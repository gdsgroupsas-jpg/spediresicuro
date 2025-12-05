-- ============================================
-- ANNE SUPERADMIN: Accesso Completo a Tutte le Spedizioni
-- ============================================
-- 
-- Questo script configura l'accesso completo per Annie (AI Agent)
-- quando è in modalità superadmin, permettendole di leggere TUTTE
-- le spedizioni da TUTTE le fonti:
-- - Spedizioni create manualmente in piattaforma
-- - Spedizioni importate da CSV
-- - Spedizioni importate da Excel/XLS
-- - Spedizioni importate da PDF (OCR)
-- - Spedizioni importate da screenshot/foto (OCR Vision)
-- - Spedizioni sincronizzate da e-commerce
-- - Spedizioni importate da altre piattaforme
--
-- Data: 6 Dicembre 2024
-- Versione: 1.0
-- ============================================

-- ============================================
-- STEP 1: Verifica e Ottimizza Schema Shipments
-- ============================================

-- Assicurati che tutti i campi per tracciare la sorgente siano presenti
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICA SCHEMA SHIPMENTS PER ANNE AI';
  RAISE NOTICE '========================================';

  -- Campo: import_source (sorgente importazione)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'import_source'
  ) THEN
    ALTER TABLE shipments ADD COLUMN import_source TEXT;
    CREATE INDEX idx_shipments_import_source ON shipments(import_source) WHERE import_source IS NOT NULL;
    RAISE NOTICE '✅ Aggiunto campo: import_source';
  ELSE
    RAISE NOTICE '✓ Campo import_source già presente';
  END IF;

  -- Campo: import_platform (piattaforma di origine)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'import_platform'
  ) THEN
    ALTER TABLE shipments ADD COLUMN import_platform TEXT;
    CREATE INDEX idx_shipments_import_platform ON shipments(import_platform) WHERE import_platform IS NOT NULL;
    RAISE NOTICE '✅ Aggiunto campo: import_platform';
  ELSE
    RAISE NOTICE '✓ Campo import_platform già presente';
  END IF;

  -- Campo: imported (flag booleano per spedizioni importate)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'imported'
  ) THEN
    ALTER TABLE shipments ADD COLUMN imported BOOLEAN DEFAULT false;
    CREATE INDEX idx_shipments_imported ON shipments(imported) WHERE imported = true;
    RAISE NOTICE '✅ Aggiunto campo: imported';
  ELSE
    RAISE NOTICE '✓ Campo imported già presente';
  END IF;

  -- Campo: created_via_ocr (flag per spedizioni create via OCR)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'created_via_ocr'
  ) THEN
    ALTER TABLE shipments ADD COLUMN created_via_ocr BOOLEAN DEFAULT false;
    CREATE INDEX idx_shipments_created_via_ocr ON shipments(created_via_ocr) WHERE created_via_ocr = true;
    RAISE NOTICE '✅ Aggiunto campo: created_via_ocr';
  ELSE
    RAISE NOTICE '✓ Campo created_via_ocr già presente';
  END IF;

  -- Campo: ocr_confidence_score (score di confidenza OCR 0-1)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'ocr_confidence_score'
  ) THEN
    ALTER TABLE shipments ADD COLUMN ocr_confidence_score DECIMAL(3,2);
    COMMENT ON COLUMN shipments.ocr_confidence_score IS 'Score di confidenza OCR (0.00 - 1.00)';
    RAISE NOTICE '✅ Aggiunto campo: ocr_confidence_score';
  ELSE
    RAISE NOTICE '✓ Campo ocr_confidence_score già presente';
  END IF;

  -- Campo: ecommerce_platform (piattaforma e-commerce)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'ecommerce_platform'
  ) THEN
    ALTER TABLE shipments ADD COLUMN ecommerce_platform TEXT;
    CREATE INDEX idx_shipments_ecommerce_platform ON shipments(ecommerce_platform) WHERE ecommerce_platform IS NOT NULL;
    RAISE NOTICE '✅ Aggiunto campo: ecommerce_platform';
  ELSE
    RAISE NOTICE '✓ Campo ecommerce_platform già presente';
  END IF;

  -- Campo: ecommerce_order_id (ID ordine e-commerce)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'ecommerce_order_id'
  ) THEN
    ALTER TABLE shipments ADD COLUMN ecommerce_order_id TEXT;
    CREATE INDEX idx_shipments_ecommerce_order ON shipments(ecommerce_platform, ecommerce_order_id) 
      WHERE ecommerce_platform IS NOT NULL AND ecommerce_order_id IS NOT NULL;
    RAISE NOTICE '✅ Aggiunto campo: ecommerce_order_id';
  ELSE
    RAISE NOTICE '✓ Campo ecommerce_order_id già presente';
  END IF;

  -- Campo: ecommerce_order_number (numero ordine e-commerce leggibile)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'ecommerce_order_number'
  ) THEN
    ALTER TABLE shipments ADD COLUMN ecommerce_order_number TEXT;
    RAISE NOTICE '✅ Aggiunto campo: ecommerce_order_number';
  ELSE
    RAISE NOTICE '✓ Campo ecommerce_order_number già presente';
  END IF;

  -- Campo: created_by_user_email (email utente che ha creato la spedizione)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'created_by_user_email'
  ) THEN
    ALTER TABLE shipments ADD COLUMN created_by_user_email TEXT;
    CREATE INDEX idx_shipments_created_by_email ON shipments(created_by_user_email) 
      WHERE created_by_user_email IS NOT NULL;
    RAISE NOTICE '✅ Aggiunto campo: created_by_user_email';
  ELSE
    RAISE NOTICE '✓ Campo created_by_user_email già presente';
  END IF;

  -- Campo: verified (flag verifica manuale spedizione)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'verified'
  ) THEN
    ALTER TABLE shipments ADD COLUMN verified BOOLEAN DEFAULT false;
    CREATE INDEX idx_shipments_verified ON shipments(verified) WHERE verified = true;
    RAISE NOTICE '✅ Aggiunto campo: verified';
  ELSE
    RAISE NOTICE '✓ Campo verified già presente';
  END IF;

  -- Campo: deleted (soft delete)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'deleted'
  ) THEN
    ALTER TABLE shipments ADD COLUMN deleted BOOLEAN DEFAULT false;
    CREATE INDEX idx_shipments_deleted ON shipments(deleted) WHERE deleted = false;
    RAISE NOTICE '✅ Aggiunto campo: deleted';
  ELSE
    RAISE NOTICE '✓ Campo deleted già presente';
  END IF;

  -- Campo: deleted_at (timestamp eliminazione)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE shipments ADD COLUMN deleted_at TIMESTAMPTZ;
    RAISE NOTICE '✅ Aggiunto campo: deleted_at';
  ELSE
    RAISE NOTICE '✓ Campo deleted_at già presente';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SCHEMA SHIPMENTS VERIFICATO E AGGIORNATO';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- STEP 2: Crea View per Anne AI (Tutte le Spedizioni)
-- ============================================

-- Crea o sostituisci la view che Anne userà per leggere TUTTE le spedizioni
-- Include TUTTE le fonti di dati
CREATE OR REPLACE VIEW anne_all_shipments_view AS
SELECT 
  s.id,
  s.tracking_number,
  s.external_tracking_number,
  s.status,
  s.user_id,
  s.created_by_user_email,
  
  -- Dati Mittente
  s.sender_name,
  s.sender_address,
  s.sender_city,
  s.sender_zip,
  s.sender_province,
  s.sender_country,
  s.sender_phone,
  s.sender_email,
  s.sender_reference,
  
  -- Dati Destinatario
  s.recipient_name,
  s.recipient_type,
  s.recipient_address,
  s.recipient_city,
  s.recipient_zip,
  s.recipient_province,
  s.recipient_country,
  s.recipient_phone,
  s.recipient_email,
  s.recipient_notes,
  
  -- Dati Pacco
  s.weight,
  s.length,
  s.width,
  s.height,
  s.volumetric_weight,
  s.packages_count,
  s.content,
  s.declared_value,
  s.currency,
  
  -- Corriere e Servizio
  s.courier_id,
  s.service_type,
  c.name AS courier_name,
  c.display_name AS courier_display_name,
  
  -- Pricing
  s.base_price,
  s.surcharges,
  s.total_cost,
  s.margin_percent,
  s.final_price,
  s.cash_on_delivery,
  s.cash_on_delivery_amount,
  s.insurance,
  
  -- E-commerce
  s.ecommerce_platform,
  s.ecommerce_order_id,
  s.ecommerce_order_number,
  
  -- Sorgente Importazione (CRITICO per Anne)
  s.imported,
  s.import_source,
  s.import_platform,
  s.created_via_ocr,
  s.ocr_confidence_score,
  
  -- Metadati
  s.verified,
  s.deleted,
  s.deleted_at,
  s.notes,
  s.internal_notes,
  s.ldv,
  
  -- Timestamp
  s.created_at,
  s.updated_at,
  s.shipped_at,
  s.delivered_at,
  s.pickup_time,
  s.gps_location,
  
  -- Categorizzazione sorgente (per statistiche Anne)
  CASE 
    WHEN s.created_via_ocr = true THEN 'OCR (PDF/Screenshot)'
    WHEN s.imported = true AND s.import_source = 'csv' THEN 'Import CSV'
    WHEN s.imported = true AND s.import_source IN ('xls', 'xlsx', 'excel') THEN 'Import Excel'
    WHEN s.imported = true AND s.import_source = 'pdf' THEN 'Import PDF'
    WHEN s.ecommerce_platform IS NOT NULL THEN 'E-commerce (' || s.ecommerce_platform || ')'
    WHEN s.import_platform IS NOT NULL THEN 'Piattaforma (' || s.import_platform || ')'
    ELSE 'Creata Manualmente'
  END AS source_category,
  
  -- Info utente proprietario (se esiste)
  u.email AS owner_email,
  u.name AS owner_name,
  u.role AS owner_role,
  u.account_type AS owner_account_type
  
FROM shipments s
LEFT JOIN couriers c ON s.courier_id = c.id
LEFT JOIN users u ON s.user_id = u.id
WHERE s.deleted = false; -- Escludi spedizioni eliminate (soft delete)

-- Aggiungi commenti alla view
COMMENT ON VIEW anne_all_shipments_view IS 
'View completa per Anne AI - Include TUTTE le spedizioni da tutte le fonti (manuale, CSV, Excel, PDF, OCR, E-commerce, etc.)';

-- ============================================
-- STEP 3: Crea Policy RLS per Superadmin/Anne
-- ============================================

-- Assicurati che RLS sia abilitato su shipments
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- Crea policy per SUPERADMIN: accesso completo a TUTTE le spedizioni
DO $$
BEGIN
  -- Elimina la policy se esiste già
  DROP POLICY IF EXISTS anne_superadmin_read_all_shipments ON shipments;
  
  -- Crea nuova policy per superadmin
  CREATE POLICY anne_superadmin_read_all_shipments
  ON shipments
  FOR SELECT
  TO authenticated
  USING (
    -- Superadmin può leggere TUTTE le spedizioni
    EXISTS (
      SELECT 1 FROM users
      WHERE users.email = (SELECT auth.email())
        AND (
          users.role = 'admin' 
          OR users.account_type = 'superadmin'::account_type
        )
    )
    OR
    -- Utente normale può leggere solo le sue spedizioni
    (
      user_id = (SELECT id FROM users WHERE email = (SELECT auth.email()) LIMIT 1)
      OR
      created_by_user_email = (SELECT auth.email())
    )
  );
  
  RAISE NOTICE '✅ Policy RLS creata: anne_superadmin_read_all_shipments';
END $$;

-- Verifica che la policy esista
DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'shipments'
    AND policyname = 'anne_superadmin_read_all_shipments';
  
  IF v_policy_count > 0 THEN
    RAISE NOTICE '✅ Policy RLS verificata: anne_superadmin_read_all_shipments attiva';
  ELSE
    RAISE WARNING '⚠️ Policy RLS non trovata - potrebbero esserci problemi di accesso';
  END IF;
END $$;

-- ============================================
-- STEP 4: Funzioni Helper per Anne AI
-- ============================================

-- Funzione: Ottieni statistiche spedizioni per sorgente
CREATE OR REPLACE FUNCTION anne_get_shipments_stats()
RETURNS TABLE (
  total_shipments BIGINT,
  manual_created BIGINT,
  csv_imported BIGINT,
  excel_imported BIGINT,
  pdf_imported BIGINT,
  ocr_created BIGINT,
  ecommerce_synced BIGINT,
  other_platform BIGINT,
  verified_count BIGINT,
  unverified_count BIGINT,
  deleted_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) AS total_shipments,
    COUNT(*) FILTER (WHERE NOT imported AND NOT created_via_ocr AND ecommerce_platform IS NULL) AS manual_created,
    COUNT(*) FILTER (WHERE imported = true AND import_source = 'csv') AS csv_imported,
    COUNT(*) FILTER (WHERE imported = true AND import_source IN ('xls', 'xlsx', 'excel')) AS excel_imported,
    COUNT(*) FILTER (WHERE imported = true AND import_source = 'pdf') AS pdf_imported,
    COUNT(*) FILTER (WHERE created_via_ocr = true) AS ocr_created,
    COUNT(*) FILTER (WHERE ecommerce_platform IS NOT NULL) AS ecommerce_synced,
    COUNT(*) FILTER (WHERE import_platform IS NOT NULL) AS other_platform,
    COUNT(*) FILTER (WHERE verified = true) AS verified_count,
    COUNT(*) FILTER (WHERE verified = false) AS unverified_count,
    COUNT(*) FILTER (WHERE deleted = true) AS deleted_count
  FROM shipments;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION anne_get_shipments_stats() IS 
'Statistiche complete spedizioni per sorgente - usata da Anne AI per analytics';

-- Funzione: Cerca spedizioni per Anne (ricerca full-text)
CREATE OR REPLACE FUNCTION anne_search_shipments(
  p_search_term TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  tracking_number TEXT,
  recipient_name TEXT,
  recipient_city TEXT,
  status shipment_status,
  source_category TEXT,
  created_at TIMESTAMPTZ,
  relevance REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.tracking_number,
    s.recipient_name,
    s.recipient_city,
    s.status,
    CASE 
      WHEN s.created_via_ocr = true THEN 'OCR'
      WHEN s.imported = true AND s.import_source = 'csv' THEN 'CSV'
      WHEN s.imported = true AND s.import_source IN ('xls', 'xlsx', 'excel') THEN 'Excel'
      WHEN s.ecommerce_platform IS NOT NULL THEN 'E-commerce'
      ELSE 'Manuale'
    END AS source_category,
    s.created_at,
    ts_rank(
      to_tsvector('italian', 
        COALESCE(s.tracking_number, '') || ' ' ||
        COALESCE(s.recipient_name, '') || ' ' ||
        COALESCE(s.recipient_city, '') || ' ' ||
        COALESCE(s.recipient_address, '') || ' ' ||
        COALESCE(s.sender_name, '')
      ),
      plainto_tsquery('italian', p_search_term)
    ) AS relevance
  FROM shipments s
  WHERE 
    s.deleted = false
    AND (
      to_tsvector('italian', 
        COALESCE(s.tracking_number, '') || ' ' ||
        COALESCE(s.recipient_name, '') || ' ' ||
        COALESCE(s.recipient_city, '') || ' ' ||
        COALESCE(s.recipient_address, '') || ' ' ||
        COALESCE(s.sender_name, '')
      ) @@ plainto_tsquery('italian', p_search_term)
      OR
      s.tracking_number ILIKE '%' || p_search_term || '%'
      OR
      s.recipient_name ILIKE '%' || p_search_term || '%'
    )
  ORDER BY relevance DESC, s.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION anne_search_shipments(TEXT, INTEGER) IS 
'Ricerca full-text spedizioni per Anne AI - supporta ricerca semantica in italiano';

-- ============================================
-- STEP 5: Indici Ottimizzati per Performance Anne
-- ============================================

-- Indici compositi per query comuni di Anne
CREATE INDEX IF NOT EXISTS idx_shipments_anne_stats 
ON shipments(imported, created_via_ocr, ecommerce_platform, deleted) 
WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_shipments_anne_source 
ON shipments(import_source, import_platform) 
WHERE imported = true;

CREATE INDEX IF NOT EXISTS idx_shipments_anne_timeline 
ON shipments(created_at DESC, status) 
WHERE deleted = false;

-- Full-text search ottimizzato per italiano
CREATE INDEX IF NOT EXISTS idx_shipments_anne_fulltext 
ON shipments USING GIN(
  to_tsvector('italian', 
    COALESCE(tracking_number, '') || ' ' ||
    COALESCE(recipient_name, '') || ' ' ||
    COALESCE(recipient_city, '') || ' ' ||
    COALESCE(recipient_address, '') || ' ' ||
    COALESCE(sender_name, '')
  )
);

-- ============================================
-- STEP 6: Test e Verifica Finale
-- ============================================

DO $$
DECLARE
  v_total_shipments BIGINT;
  v_view_count BIGINT;
  v_index_count INTEGER;
  v_policy_count INTEGER;
  v_function_count INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST FINALE - ACCESSO ANNE AI';
  RAISE NOTICE '========================================';
  
  -- Test 1: Conta spedizioni totali
  SELECT COUNT(*) INTO v_total_shipments FROM shipments WHERE deleted = false;
  RAISE NOTICE '📊 Spedizioni totali (non eliminate): %', v_total_shipments;
  
  -- Test 2: Verifica view
  SELECT COUNT(*) INTO v_view_count FROM anne_all_shipments_view;
  RAISE NOTICE '👁️ Record nella view Anne: %', v_view_count;
  
  -- Test 3: Verifica indici
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'shipments'
    AND indexname LIKE '%anne%';
  RAISE NOTICE '🔍 Indici ottimizzati per Anne: %', v_index_count;
  
  -- Test 4: Verifica policy RLS
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'shipments'
    AND policyname LIKE '%anne%';
  RAISE NOTICE '🔒 Policy RLS per Anne: %', v_policy_count;
  
  -- Test 5: Verifica funzioni
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname LIKE '%anne%';
  RAISE NOTICE '⚙️ Funzioni helper per Anne: %', v_function_count;
  
  RAISE NOTICE '========================================';
  
  IF v_total_shipments > 0 AND v_view_count = v_total_shipments THEN
    RAISE NOTICE '✅ TUTTO OK! Anne può accedere a tutte le % spedizioni', v_total_shipments;
  ELSIF v_total_shipments = 0 THEN
    RAISE NOTICE '⚠️ Nessuna spedizione nel database - crea alcune spedizioni di test';
  ELSE
    RAISE WARNING '⚠️ Discrepanza: % spedizioni vs % nella view', v_total_shipments, v_view_count;
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '🎉 CONFIGURAZIONE ANNE SUPERADMIN COMPLETATA!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 COME USARE:';
  RAISE NOTICE '1. Anne in modalità superadmin può ora leggere TUTTE le spedizioni';
  RAISE NOTICE '2. Usa la view: SELECT * FROM anne_all_shipments_view;';
  RAISE NOTICE '3. Statistiche: SELECT * FROM anne_get_shipments_stats();';
  RAISE NOTICE '4. Ricerca: SELECT * FROM anne_search_shipments(''termine'');';
  RAISE NOTICE '';
END $$;
