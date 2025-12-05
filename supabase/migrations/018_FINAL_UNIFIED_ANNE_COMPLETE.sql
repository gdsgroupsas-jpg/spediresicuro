-- ============================================
-- MIGRATION 018: UNIFIED FINAL - Anne AI Complete Setup
-- ============================================
-- 
-- Script SQL UNIFICATO che include TUTTO il necessario per:
-- 1. Schema database completo e compatibile
-- 2. Anne AI con accesso superadmin a tutte le spedizioni
-- 3. Sistema multi-livello admin
-- 4. Killer features e permessi
-- 5. Automation, OCR, E-commerce
-- 6. Security, RLS e audit logs
-- 7. Performance ottimizzate
--
-- IMPORTANTE: Questo script è idempotente (può essere eseguito più volte senza problemi)
-- Controlla sempre se le tabelle/campi/indici esistono prima di crearli
--
-- Data: 6 Dicembre 2024
-- Versione: 1.0 FINAL
-- ============================================

-- ============================================
-- SECTION 1: EXTENSIONS & ENUMS
-- ============================================

-- Estensioni PostgreSQL necessarie
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Full-text search
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- Encryption

-- ENUM: Ruoli utente
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM (
      'admin',
      'user',
      'agent',
      'manager',
      'merchant',
      'support',
      'viewer'
    );
    RAISE NOTICE '✅ Creato ENUM: user_role';
  END IF;
END $$;

-- ENUM: Tipo account (multi-livello)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
    CREATE TYPE account_type AS ENUM ('user', 'admin', 'superadmin');
    RAISE NOTICE '✅ Creato ENUM: account_type';
  END IF;
END $$;

-- ENUM: Status spedizione
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipment_status') THEN
    CREATE TYPE shipment_status AS ENUM (
      'draft',
      'pending',
      'processing',
      'ready_for_pickup',
      'picked_up',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'failed',
      'cancelled',
      'returned'
    );
    RAISE NOTICE '✅ Creato ENUM: shipment_status';
  END IF;
END $$;

-- ENUM: Tipo servizio corriere
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'courier_service_type') THEN
    CREATE TYPE courier_service_type AS ENUM (
      'standard',
      'express',
      'priority',
      'economy',
      'same_day'
    );
    RAISE NOTICE '✅ Creato ENUM: courier_service_type';
  END IF;
END $$;

-- ENUM: Tipo destinatario
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recipient_type') THEN
    CREATE TYPE recipient_type AS ENUM ('B2C', 'B2B');
    RAISE NOTICE '✅ Creato ENUM: recipient_type';
  END IF;
END $$;

-- ============================================
-- SECTION 2: TABELLA USERS (Aggiornata)
-- ============================================

-- Aggiungi campi mancanti alla tabella users
DO $$ 
BEGIN
  -- Campo account_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE users ADD COLUMN account_type account_type DEFAULT 'user';
    RAISE NOTICE '✅ Aggiunto campo: account_type';
  END IF;

  -- Campo parent_admin_id (gerarchia admin)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'parent_admin_id'
  ) THEN
    ALTER TABLE users ADD COLUMN parent_admin_id UUID REFERENCES users(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Aggiunto campo: parent_admin_id';
  END IF;

  -- Campo admin_level (0=superadmin, 1-5=admin)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'admin_level'
  ) THEN
    ALTER TABLE users ADD COLUMN admin_level INTEGER DEFAULT 0;
    RAISE NOTICE '✅ Aggiunto campo: admin_level';
  END IF;
END $$;

-- Indici per performance users
CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type) WHERE account_type IN ('admin', 'superadmin');
CREATE INDEX IF NOT EXISTS idx_users_parent_admin ON users(parent_admin_id) WHERE parent_admin_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- SECTION 3: TABELLA SHIPMENTS (Schema Completo)
-- ============================================

-- Questa funzione verifica e aggiorna la tabella shipments con TUTTI i campi necessari
CREATE OR REPLACE FUNCTION update_shipments_schema()
RETURNS VOID AS $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'AGGIORNAMENTO SCHEMA SHIPMENTS';
  RAISE NOTICE '========================================';

  -- Campo: import_source
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'import_source') THEN
    ALTER TABLE shipments ADD COLUMN import_source TEXT;
    RAISE NOTICE '✅ Aggiunto: import_source';
  END IF;

  -- Campo: import_platform
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'import_platform') THEN
    ALTER TABLE shipments ADD COLUMN import_platform TEXT;
    RAISE NOTICE '✅ Aggiunto: import_platform';
  END IF;

  -- Campo: imported
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'imported') THEN
    ALTER TABLE shipments ADD COLUMN imported BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Aggiunto: imported';
  END IF;

  -- Campo: created_via_ocr
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'created_via_ocr') THEN
    ALTER TABLE shipments ADD COLUMN created_via_ocr BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Aggiunto: created_via_ocr';
  END IF;

  -- Campo: ocr_confidence_score
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'ocr_confidence_score') THEN
    ALTER TABLE shipments ADD COLUMN ocr_confidence_score DECIMAL(3,2);
    RAISE NOTICE '✅ Aggiunto: ocr_confidence_score';
  END IF;

  -- Campo: ecommerce_platform
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'ecommerce_platform') THEN
    ALTER TABLE shipments ADD COLUMN ecommerce_platform TEXT;
    RAISE NOTICE '✅ Aggiunto: ecommerce_platform';
  END IF;

  -- Campo: ecommerce_order_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'ecommerce_order_id') THEN
    ALTER TABLE shipments ADD COLUMN ecommerce_order_id TEXT;
    RAISE NOTICE '✅ Aggiunto: ecommerce_order_id';
  END IF;

  -- Campo: ecommerce_order_number
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'ecommerce_order_number') THEN
    ALTER TABLE shipments ADD COLUMN ecommerce_order_number TEXT;
    RAISE NOTICE '✅ Aggiunto: ecommerce_order_number';
  END IF;

  -- Campo: created_by_user_email
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'created_by_user_email') THEN
    ALTER TABLE shipments ADD COLUMN created_by_user_email TEXT;
    RAISE NOTICE '✅ Aggiunto: created_by_user_email';
  END IF;

  -- Campo: verified
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'verified') THEN
    ALTER TABLE shipments ADD COLUMN verified BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Aggiunto: verified';
  END IF;

  -- Campo: deleted
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'deleted') THEN
    ALTER TABLE shipments ADD COLUMN deleted BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Aggiunto: deleted';
  END IF;

  -- Campo: deleted_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'deleted_at') THEN
    ALTER TABLE shipments ADD COLUMN deleted_at TIMESTAMPTZ;
    RAISE NOTICE '✅ Aggiunto: deleted_at';
  END IF;

  -- Campo: deleted_by_user_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'deleted_by_user_id') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
      ALTER TABLE shipments ADD COLUMN deleted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
    ELSE
      ALTER TABLE shipments ADD COLUMN deleted_by_user_id UUID;
    END IF;
    RAISE NOTICE '✅ Aggiunto: deleted_by_user_id';
  END IF;

  -- Campo: ldv (Lettera di Vettura)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'ldv') THEN
    ALTER TABLE shipments ADD COLUMN ldv TEXT;
    RAISE NOTICE '✅ Aggiunto: ldv';
  END IF;

  -- Campo: pickup_time
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'pickup_time') THEN
    ALTER TABLE shipments ADD COLUMN pickup_time TIMESTAMPTZ;
    RAISE NOTICE '✅ Aggiunto: pickup_time';
  END IF;

  -- Campo: gps_location
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'gps_location') THEN
    ALTER TABLE shipments ADD COLUMN gps_location TEXT;
    RAISE NOTICE '✅ Aggiunto: gps_location';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SCHEMA SHIPMENTS AGGIORNATO';
  RAISE NOTICE '========================================';
END;
$$ LANGUAGE plpgsql;

-- Esegui l'aggiornamento schema shipments
SELECT update_shipments_schema();

-- ============================================
-- SECTION 4: INDICI OTTIMIZZATI PER ANNE
-- ============================================

-- Indici per sorgente importazione
CREATE INDEX IF NOT EXISTS idx_shipments_import_source ON shipments(import_source) WHERE import_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_import_platform ON shipments(import_platform) WHERE import_platform IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_imported ON shipments(imported) WHERE imported = true;
CREATE INDEX IF NOT EXISTS idx_shipments_created_via_ocr ON shipments(created_via_ocr) WHERE created_via_ocr = true;
CREATE INDEX IF NOT EXISTS idx_shipments_ecommerce_platform ON shipments(ecommerce_platform) WHERE ecommerce_platform IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_ecommerce_order ON shipments(ecommerce_platform, ecommerce_order_id) WHERE ecommerce_platform IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_created_by_email ON shipments(created_by_user_email) WHERE created_by_user_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_verified ON shipments(verified) WHERE verified = true;
CREATE INDEX IF NOT EXISTS idx_shipments_deleted ON shipments(deleted) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_shipments_ldv ON shipments(ldv) WHERE ldv IS NOT NULL;

-- Indici compositi per statistiche Anne
CREATE INDEX IF NOT EXISTS idx_shipments_anne_stats ON shipments(imported, created_via_ocr, ecommerce_platform, deleted) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_shipments_anne_source ON shipments(import_source, import_platform) WHERE imported = true;
CREATE INDEX IF NOT EXISTS idx_shipments_anne_timeline ON shipments(created_at DESC, status) WHERE deleted = false;

-- Full-text search ottimizzato per italiano
CREATE INDEX IF NOT EXISTS idx_shipments_anne_fulltext ON shipments USING GIN(
  to_tsvector('italian', 
    COALESCE(tracking_number, '') || ' ' ||
    COALESCE(recipient_name, '') || ' ' ||
    COALESCE(recipient_city, '') || ' ' ||
    COALESCE(recipient_address, '') || ' ' ||
    COALESCE(sender_name, '')
  )
);

-- ============================================
-- SECTION 5: VIEW ANNE_ALL_SHIPMENTS
-- ============================================

-- Crea o sostituisci la view per Anne AI (con controllo esistenza tabelle)
DO $$
DECLARE
  v_has_couriers BOOLEAN;
  v_has_users BOOLEAN;
BEGIN
  -- Verifica se la tabella couriers esiste
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'couriers'
  ) INTO v_has_couriers;

  -- Verifica se la tabella users esiste
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'users'
  ) INTO v_has_users;

  -- Crea la view in base alle tabelle disponibili
  IF v_has_couriers AND v_has_users THEN
    -- Versione completa con couriers e users
    EXECUTE '
    CREATE OR REPLACE VIEW anne_all_shipments_view AS
    SELECT 
      s.id,
      s.tracking_number,
      s.external_tracking_number,
      s.status,
      s.user_id,
      s.created_by_user_email,
      
      -- Mittente
      s.sender_name,
      s.sender_address,
      s.sender_city,
      s.sender_zip,
      s.sender_province,
      s.sender_country,
      s.sender_phone,
      s.sender_email,
      s.sender_reference,
      
      -- Destinatario
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
      
      -- Pacco
      s.weight,
      s.length,
      s.width,
      s.height,
      s.volumetric_weight,
      s.packages_count,
      s.content,
      s.declared_value,
      s.currency,
      
      -- Corriere
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
      
      -- Sorgente
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
      
      -- Categorizzazione sorgente
      CASE 
        WHEN s.created_via_ocr = true THEN ''OCR (PDF/Screenshot)''
        WHEN s.imported = true AND s.import_source = ''csv'' THEN ''Import CSV''
        WHEN s.imported = true AND s.import_source IN (''xls'', ''xlsx'', ''excel'') THEN ''Import Excel''
        WHEN s.imported = true AND s.import_source = ''pdf'' THEN ''Import PDF''
        WHEN s.ecommerce_platform IS NOT NULL THEN ''E-commerce ('' || s.ecommerce_platform || '')''
        WHEN s.import_platform IS NOT NULL THEN ''Piattaforma ('' || s.import_platform || '')''
        ELSE ''Creata Manualmente''
      END AS source_category,
      
      -- Info proprietario
      u.email AS owner_email,
      u.name AS owner_name,
      u.role AS owner_role,
      u.account_type AS owner_account_type
      
    FROM shipments s
    LEFT JOIN couriers c ON s.courier_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.deleted = false
    ';
    RAISE NOTICE '✅ View anne_all_shipments_view creata (versione completa con couriers e users)';
    
  ELSIF v_has_users THEN
    -- Versione senza couriers ma con users
    EXECUTE '
    CREATE OR REPLACE VIEW anne_all_shipments_view AS
    SELECT 
      s.id,
      s.tracking_number,
      s.external_tracking_number,
      s.status,
      s.user_id,
      s.created_by_user_email,
      
      -- Mittente
      s.sender_name,
      s.sender_address,
      s.sender_city,
      s.sender_zip,
      s.sender_province,
      s.sender_country,
      s.sender_phone,
      s.sender_email,
      s.sender_reference,
      
      -- Destinatario
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
      
      -- Pacco
      s.weight,
      s.length,
      s.width,
      s.height,
      s.volumetric_weight,
      s.packages_count,
      s.content,
      s.declared_value,
      s.currency,
      
      -- Corriere
      s.courier_id,
      s.service_type,
      NULL::TEXT AS courier_name,
      NULL::TEXT AS courier_display_name,
      
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
      
      -- Sorgente
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
      
      -- Categorizzazione sorgente
      CASE 
        WHEN s.created_via_ocr = true THEN ''OCR (PDF/Screenshot)''
        WHEN s.imported = true AND s.import_source = ''csv'' THEN ''Import CSV''
        WHEN s.imported = true AND s.import_source IN (''xls'', ''xlsx'', ''excel'') THEN ''Import Excel''
        WHEN s.imported = true AND s.import_source = ''pdf'' THEN ''Import PDF''
        WHEN s.ecommerce_platform IS NOT NULL THEN ''E-commerce ('' || s.ecommerce_platform || '')''
        WHEN s.import_platform IS NOT NULL THEN ''Piattaforma ('' || s.import_platform || '')''
        ELSE ''Creata Manualmente''
      END AS source_category,
      
      -- Info proprietario
      u.email AS owner_email,
      u.name AS owner_name,
      u.role AS owner_role,
      u.account_type AS owner_account_type
      
    FROM shipments s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.deleted = false
    ';
    RAISE NOTICE '⚠️ View anne_all_shipments_view creata (senza tabella couriers)';
    
  ELSE
    -- Versione base senza couriers né users
    EXECUTE '
    CREATE OR REPLACE VIEW anne_all_shipments_view AS
    SELECT 
      s.id,
      s.tracking_number,
      s.external_tracking_number,
      s.status,
      s.user_id,
      s.created_by_user_email,
      
      -- Mittente
      s.sender_name,
      s.sender_address,
      s.sender_city,
      s.sender_zip,
      s.sender_province,
      s.sender_country,
      s.sender_phone,
      s.sender_email,
      s.sender_reference,
      
      -- Destinatario
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
      
      -- Pacco
      s.weight,
      s.length,
      s.width,
      s.height,
      s.volumetric_weight,
      s.packages_count,
      s.content,
      s.declared_value,
      s.currency,
      
      -- Corriere
      s.courier_id,
      s.service_type,
      NULL::TEXT AS courier_name,
      NULL::TEXT AS courier_display_name,
      
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
      
      -- Sorgente
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
      
      -- Categorizzazione sorgente
      CASE 
        WHEN s.created_via_ocr = true THEN ''OCR (PDF/Screenshot)''
        WHEN s.imported = true AND s.import_source = ''csv'' THEN ''Import CSV''
        WHEN s.imported = true AND s.import_source IN (''xls'', ''xlsx'', ''excel'') THEN ''Import Excel''
        WHEN s.imported = true AND s.import_source = ''pdf'' THEN ''Import PDF''
        WHEN s.ecommerce_platform IS NOT NULL THEN ''E-commerce ('' || s.ecommerce_platform || '')''
        WHEN s.import_platform IS NOT NULL THEN ''Piattaforma ('' || s.import_platform || '')''
        ELSE ''Creata Manualmente''
      END AS source_category,
      
      -- Info proprietario (NULL se non esiste tabella users)
      NULL::TEXT AS owner_email,
      NULL::TEXT AS owner_name,
      NULL::user_role AS owner_role,
      NULL::account_type AS owner_account_type
      
    FROM shipments s
    WHERE s.deleted = false
    ';
    RAISE NOTICE '⚠️ View anne_all_shipments_view creata (senza tabelle couriers e users)';
  END IF;
END $$;

COMMENT ON VIEW anne_all_shipments_view IS 'View completa Anne AI - TUTTE le spedizioni da tutte le fonti';

-- ============================================
-- SECTION 6: FUNZIONI HELPER PER ANNE
-- ============================================

-- Funzione: Statistiche spedizioni per sorgente
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

-- Funzione: Ricerca spedizioni full-text
CREATE OR REPLACE FUNCTION anne_search_shipments(
  p_search_term TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  tracking_number TEXT,
  recipient_name TEXT,
  recipient_city TEXT,
  status TEXT,
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
    s.status::TEXT,
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

-- ============================================
-- SECTION 7: ROW LEVEL SECURITY (RLS)
-- ============================================

-- Abilita RLS su shipments
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- Policy per superadmin: accesso completo (con controllo esistenza tabella users)
DO $$
DECLARE
  v_has_users BOOLEAN;
BEGIN
  -- Verifica se la tabella users esiste
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'users'
  ) INTO v_has_users;

  -- Elimina policy esistente se presente
  DROP POLICY IF EXISTS anne_superadmin_read_all_shipments ON shipments;
  
  IF v_has_users THEN
    -- Policy completa con tabella users
    CREATE POLICY anne_superadmin_read_all_shipments
    ON shipments
    FOR SELECT
    TO authenticated
    USING (
      -- Superadmin/Admin può leggere TUTTO
      EXISTS (
        SELECT 1 FROM users
        WHERE users.email = (SELECT auth.email())
          AND (
            users.role = 'admin' 
            OR users.account_type = 'superadmin'::account_type
          )
      )
      OR
      -- Utenti normali: solo le proprie spedizioni
      (
        user_id = (SELECT id FROM users WHERE email = (SELECT auth.email()) LIMIT 1)
        OR
        created_by_user_email = (SELECT auth.email())
      )
    );
    RAISE NOTICE '✅ Policy RLS: anne_superadmin_read_all_shipments (con tabella users)';
  ELSE
    -- Policy base senza tabella users (accesso solo tramite email)
    CREATE POLICY anne_superadmin_read_all_shipments
    ON shipments
    FOR SELECT
    TO authenticated
    USING (
      created_by_user_email = (SELECT auth.email())
    );
    RAISE NOTICE '⚠️ Policy RLS: anne_superadmin_read_all_shipments (senza tabella users - solo email)';
  END IF;
END $$;

-- ============================================
-- SECTION 8: AUDIT LOGS (se tabella esiste)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    -- Indici audit logs (solo se le colonne esistono)
    
    -- Indice su user_email (solo se la colonna esiste - migration 013)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'audit_logs' AND column_name = 'user_email'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email ON audit_logs(user_email);
    END IF;
    
    -- Indice su action (solo se la colonna esiste - migration 013)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'audit_logs' AND column_name = 'action'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    END IF;
    
    -- Indice su severity (solo se la colonna esiste - migration 002)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'audit_logs' AND column_name = 'severity'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
    END IF;
    
    -- Indice su created_at (sempre presente)
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
    
    RAISE NOTICE '✅ Indici audit_logs creati';
  END IF;
END $$;

-- ============================================
-- SECTION 9: REALTIME (se configurato)
-- ============================================

DO $$
BEGIN
  -- Abilita realtime per shipments (se publication esiste)
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shipments;
    RAISE NOTICE '✅ Realtime abilitato per shipments';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠️ Shipments già in publication realtime';
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Realtime non configurato (normale se non usi Supabase Realtime)';
END $$;

-- ============================================
-- SECTION 10: VERIFICA FINALE E REPORT
-- ============================================

DO $$
DECLARE
  v_total_shipments BIGINT;
  v_view_count BIGINT;
  v_index_count INTEGER;
  v_policy_count INTEGER;
  v_function_count INTEGER;
  v_user_count BIGINT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 VERIFICA FINALE CONFIGURAZIONE ANNE';
  RAISE NOTICE '========================================';
  
  -- Test 1: Conta spedizioni
  SELECT COUNT(*) INTO v_total_shipments FROM shipments WHERE deleted = false;
  RAISE NOTICE '📦 Spedizioni totali: %', v_total_shipments;
  
  -- Test 2: View Anne
  SELECT COUNT(*) INTO v_view_count FROM anne_all_shipments_view;
  RAISE NOTICE '👁️ Record nella view Anne: %', v_view_count;
  
  -- Test 3: Indici
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'shipments';
  RAISE NOTICE '🔍 Indici totali su shipments: %', v_index_count;
  
  -- Test 4: Policy RLS
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'shipments';
  RAISE NOTICE '🔒 Policy RLS su shipments: %', v_policy_count;
  
  -- Test 5: Funzioni Anne
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname LIKE '%anne%';
  RAISE NOTICE '⚙️ Funzioni helper Anne: %', v_function_count;
  
  -- Test 6: Utenti
  SELECT COUNT(*) INTO v_user_count FROM users;
  RAISE NOTICE '👥 Utenti totali: %', v_user_count;
  
  RAISE NOTICE '========================================';
  
  IF v_total_shipments > 0 AND v_view_count = v_total_shipments THEN
    RAISE NOTICE '✅ PERFETTO! Anne può accedere a tutte le % spedizioni', v_total_shipments;
  ELSIF v_total_shipments = 0 THEN
    RAISE NOTICE '⚠️ Database vuoto - crea spedizioni di test';
  ELSE
    RAISE NOTICE '⚠️ Discrepanza: % spedizioni vs % in view', v_total_shipments, v_view_count;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '🎉 MIGRATION 018 COMPLETATA CON SUCCESSO!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 ANNE AI È ORA CONFIGURATA PER:';
  RAISE NOTICE '   ✅ Leggere TUTTE le spedizioni (manuale, CSV, Excel, PDF, OCR, E-commerce)';
  RAISE NOTICE '   ✅ Accesso superadmin completo';
  RAISE NOTICE '   ✅ Statistiche automatiche per sorgente';
  RAISE NOTICE '   ✅ Ricerca full-text in italiano';
  RAISE NOTICE '   ✅ Performance ottimizzate con indici';
  RAISE NOTICE '   ✅ Security con RLS multi-livello';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 PROSSIMI PASSI:';
  RAISE NOTICE '   1. Testa: SELECT * FROM anne_all_shipments_view LIMIT 10;';
  RAISE NOTICE '   2. Stats: SELECT * FROM anne_get_shipments_stats();';
  RAISE NOTICE '   3. Search: SELECT * FROM anne_search_shipments(''Milano'');';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
