-- ============================================
-- MIGRAZIONE 004: Fix Schema Tabella Shipments
-- Compatibilità Completa con Codice TypeScript
-- ============================================
-- 
-- Questo script allinea perfettamente lo schema Supabase
-- con il codice TypeScript che crea le spedizioni dal web.
--
-- ⚠️ IMPORTANTE: Lo script gestisce tutti i casi:
-- - Se la tabella NON esiste → la crea completa
-- - Se la tabella ESISTE → verifica e corregge solo ciò che serve
-- - Se è già compatibile → non fa nulla
--
-- Data: 2024
-- Descrizione: Fix schema shipments per compatibilità completa
-- ============================================

-- Estensione UUID (se non già presente)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- STEP 1: Crea ENUM se non esistono
-- ============================================

-- Status spedizione
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipment_status') THEN
    CREATE TYPE shipment_status AS ENUM (
      'draft',           -- Bozza
      'pending',         -- In attesa (in_preparazione)
      'processing',      -- In elaborazione
      'shipped',         -- Spedita
      'in_transit',      -- In transito
      'out_for_delivery',-- In consegna
      'delivered',       -- Consegnata
      'failed',          -- Fallita (eccezione)
      'cancelled',       -- Cancellata (annullata)
      'returned'         -- Resa
    );
  END IF;
END $$;

-- Tipo servizio corriere
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'courier_service_type') THEN
    CREATE TYPE courier_service_type AS ENUM (
      'standard',
      'express',
      'economy',
      'same_day',
      'next_day'
    );
  END IF;
END $$;

-- Tipo destinatario
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recipient_type') THEN
    CREATE TYPE recipient_type AS ENUM ('B2C', 'B2B');
  END IF;
END $$;

-- ============================================
-- FUNZIONE: Crea tabella completa da zero
-- ============================================

-- ============================================
-- STEP 2: Crea Funzioni Helper (PRIMA di usarle)
-- ============================================

-- Funzione per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_shipments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Funzione per calcolare peso volumetrico
CREATE OR REPLACE FUNCTION calculate_volumetric_weight(
  p_length DECIMAL,
  p_width DECIMAL,
  p_height DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
  IF p_length IS NULL OR p_width IS NULL OR p_height IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN (p_length * p_width * p_height) / 5000;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Funzione per auto-calcolo peso volumetrico
CREATE OR REPLACE FUNCTION auto_calculate_volumetric_weight()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.length IS NOT NULL AND NEW.width IS NOT NULL AND NEW.height IS NOT NULL THEN
    NEW.volumetric_weight = calculate_volumetric_weight(NEW.length, NEW.width, NEW.height);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 3: Funzione per creare tabella completa
-- ============================================

CREATE OR REPLACE FUNCTION create_shipments_table_complete()
RETURNS VOID AS $$
BEGIN
  -- Crea la tabella shipments completa
  CREATE TABLE IF NOT EXISTS shipments (
    -- ID e Multi-tenancy
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Tracking
    tracking_number TEXT UNIQUE NOT NULL,
    external_tracking_number TEXT,
    ldv TEXT, -- Lettera di Vettura (importante per Spedisci.Online)
    
    -- Status
    status shipment_status DEFAULT 'pending',
    
    -- Mittente
    sender_name TEXT NOT NULL,
    sender_address TEXT,
    sender_city TEXT,
    sender_zip TEXT,
    sender_province TEXT,
    sender_country TEXT DEFAULT 'IT',
    sender_phone TEXT,
    sender_email TEXT,
    sender_reference TEXT, -- rif_mittente
    
    -- Destinatario
    recipient_name TEXT NOT NULL,
    recipient_type recipient_type DEFAULT 'B2C',
    recipient_address TEXT, -- ⚠️ Nullable per compatibilità
    recipient_city TEXT, -- ⚠️ Nullable per compatibilità
    recipient_zip TEXT, -- ⚠️ Nullable per compatibilità
    recipient_province TEXT, -- ⚠️ Nullable per compatibilità
    recipient_country TEXT DEFAULT 'IT',
    recipient_phone TEXT, -- ⚠️ Nullable per compatibilità
    recipient_email TEXT,
    recipient_notes TEXT,
    recipient_reference TEXT, -- rif_destinatario
    
    -- Pacco
    weight DECIMAL(10,3) NOT NULL DEFAULT 1,
    length DECIMAL(10,2),
    width DECIMAL(10,2),
    height DECIMAL(10,2),
    volumetric_weight DECIMAL(10,3),
    packages_count INTEGER DEFAULT 1, -- Numero colli
    
    -- Valore merce
    declared_value DECIMAL(10,2),
    currency TEXT DEFAULT 'EUR',
    content TEXT, -- Descrizione contenuto
    
    -- Servizio
    courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL,
    service_type courier_service_type DEFAULT 'standard',
    cash_on_delivery BOOLEAN DEFAULT false,
    cash_on_delivery_amount DECIMAL(10,2),
    insurance BOOLEAN DEFAULT false,
    
    -- Pricing
    base_price DECIMAL(10,2),
    surcharges DECIMAL(10,2) DEFAULT 0,
    total_cost DECIMAL(10,2),
    margin_percent DECIMAL(5,2) DEFAULT 15,
    final_price DECIMAL(10,2),
    
    -- Geo-analytics
    geo_zone TEXT,
    courier_quality_score DECIMAL(3,2),
    
    -- Integrazione e-commerce
    ecommerce_platform TEXT,
    ecommerce_order_id TEXT,
    ecommerce_order_number TEXT,
    order_reference TEXT, -- Riferimento ordine (nullable, può essere null)
    
    -- OCR data
    created_via_ocr BOOLEAN DEFAULT false,
    ocr_confidence_score DECIMAL(3,2),
    
    -- Importazione
    imported BOOLEAN DEFAULT false,
    import_source TEXT,
    import_platform TEXT,
    verified BOOLEAN DEFAULT false,
    
    -- Note
    notes TEXT,
    internal_notes TEXT,
    
    -- Soft Delete
    deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Audit Trail (compatibilità NextAuth)
    created_by_user_email TEXT,
    
    -- Timestamps
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  -- Crea indici
  CREATE INDEX IF NOT EXISTS idx_shipments_user ON shipments(user_id);
  CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
  CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
  CREATE INDEX IF NOT EXISTS idx_shipments_courier ON shipments(courier_id);
  CREATE INDEX IF NOT EXISTS idx_shipments_recipient_zip ON shipments(recipient_zip);
  CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_shipments_ecommerce ON shipments(ecommerce_platform, ecommerce_order_id);
  CREATE INDEX IF NOT EXISTS idx_shipments_ldv ON shipments(ldv) WHERE ldv IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_shipments_deleted ON shipments(deleted) WHERE deleted = false;
  CREATE INDEX IF NOT EXISTS idx_shipments_created_by_email ON shipments(created_by_user_email) WHERE created_by_user_email IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_shipments_imported ON shipments(imported) WHERE imported = true;
  CREATE INDEX IF NOT EXISTS idx_shipments_user_deleted ON shipments(user_id, deleted) WHERE deleted = false;
  CREATE INDEX IF NOT EXISTS idx_shipments_tracking_deleted ON shipments(tracking_number, deleted) WHERE deleted = false;
  
  -- Full-text search
  CREATE INDEX IF NOT EXISTS idx_shipments_recipient_search ON shipments
    USING GIN(to_tsvector('italian', recipient_name || ' ' || COALESCE(recipient_city, '')));
  
  RAISE NOTICE '✅ Tabella shipments creata con successo!';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNZIONE: Corregge tabella esistente
-- ============================================

CREATE OR REPLACE FUNCTION fix_existing_shipments_table()
RETURNS VOID AS $$
DECLARE
  col_exists BOOLEAN;
  constraint_exists BOOLEAN;
BEGIN
  RAISE NOTICE '🔍 Verifica e correzione tabella esistente...';
  
  -- ============================================
  -- AGGIUNGI CAMPI OBBLIGATORI MANCANTI
  -- ============================================
  
  -- Tracking number (OBBLIGATORIO)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'tracking_number'
  ) THEN
    ALTER TABLE shipments ADD COLUMN tracking_number TEXT UNIQUE NOT NULL DEFAULT 'TEMP' || uuid_generate_v4()::TEXT;
    -- Aggiorna i valori di default con valori unici
    UPDATE shipments SET tracking_number = 'TRK' || id::TEXT WHERE tracking_number = 'TEMP' || id::TEXT;
    ALTER TABLE shipments ALTER COLUMN tracking_number DROP DEFAULT;
    RAISE NOTICE '✅ Aggiunto campo: tracking_number';
  END IF;
  
  -- Status (OBBLIGATORIO)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'status'
  ) THEN
    ALTER TABLE shipments ADD COLUMN status shipment_status DEFAULT 'pending';
    RAISE NOTICE '✅ Aggiunto campo: status';
  END IF;
  
  -- Sender name (OBBLIGATORIO)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'sender_name'
  ) THEN
    ALTER TABLE shipments ADD COLUMN sender_name TEXT NOT NULL DEFAULT 'Mittente Predefinito';
    ALTER TABLE shipments ALTER COLUMN sender_name DROP DEFAULT;
    RAISE NOTICE '✅ Aggiunto campo: sender_name';
  END IF;
  
  -- Recipient name (OBBLIGATORIO)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'recipient_name'
  ) THEN
    ALTER TABLE shipments ADD COLUMN recipient_name TEXT NOT NULL DEFAULT 'Destinatario Predefinito';
    ALTER TABLE shipments ALTER COLUMN recipient_name DROP DEFAULT;
    RAISE NOTICE '✅ Aggiunto campo: recipient_name';
  END IF;
  
  -- Weight (OBBLIGATORIO)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'weight'
  ) THEN
    ALTER TABLE shipments ADD COLUMN weight DECIMAL(10,3) NOT NULL DEFAULT 1;
    ALTER TABLE shipments ALTER COLUMN weight DROP DEFAULT;
    RAISE NOTICE '✅ Aggiunto campo: weight';
  END IF;
  
  -- Created at (OBBLIGATORIO)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE shipments ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE '✅ Aggiunto campo: created_at';
  END IF;
  
  -- Updated at (OBBLIGATORIO)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE shipments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE '✅ Aggiunto campo: updated_at';
  END IF;
  
  -- ============================================
  -- AGGIUNGI CAMPI OPZIONALI MANCANTI
  -- ============================================
  
  -- ⚠️ CRITICO: Campi Mittente (usati da mapSpedizioneToSupabase)
  -- Sender address
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'sender_address'
  ) THEN
    ALTER TABLE shipments ADD COLUMN sender_address TEXT;
    RAISE NOTICE '✅ Aggiunto campo: sender_address';
  END IF;
  
  -- Sender city
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'sender_city'
  ) THEN
    ALTER TABLE shipments ADD COLUMN sender_city TEXT;
    RAISE NOTICE '✅ Aggiunto campo: sender_city';
  END IF;
  
  -- Sender zip
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'sender_zip'
  ) THEN
    ALTER TABLE shipments ADD COLUMN sender_zip TEXT;
    RAISE NOTICE '✅ Aggiunto campo: sender_zip';
  END IF;
  
  -- Sender province
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'sender_province'
  ) THEN
    ALTER TABLE shipments ADD COLUMN sender_province TEXT;
    RAISE NOTICE '✅ Aggiunto campo: sender_province';
  END IF;
  
  -- Sender phone
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'sender_phone'
  ) THEN
    ALTER TABLE shipments ADD COLUMN sender_phone TEXT;
    RAISE NOTICE '✅ Aggiunto campo: sender_phone';
  END IF;
  
  -- Sender email
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'sender_email'
  ) THEN
    ALTER TABLE shipments ADD COLUMN sender_email TEXT;
    RAISE NOTICE '✅ Aggiunto campo: sender_email';
  END IF;
  
  -- ⚠️ CRITICO: Campi Destinatario (usati da mapSpedizioneToSupabase)
  -- Recipient address
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'recipient_address'
  ) THEN
    ALTER TABLE shipments ADD COLUMN recipient_address TEXT;
    RAISE NOTICE '✅ Aggiunto campo: recipient_address';
  END IF;
  
  -- Recipient city
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'recipient_city'
  ) THEN
    ALTER TABLE shipments ADD COLUMN recipient_city TEXT;
    RAISE NOTICE '✅ Aggiunto campo: recipient_city';
  END IF;
  
  -- Recipient zip
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'recipient_zip'
  ) THEN
    ALTER TABLE shipments ADD COLUMN recipient_zip TEXT;
    RAISE NOTICE '✅ Aggiunto campo: recipient_zip';
  END IF;
  
  -- Recipient province
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'recipient_province'
  ) THEN
    ALTER TABLE shipments ADD COLUMN recipient_province TEXT;
    RAISE NOTICE '✅ Aggiunto campo: recipient_province';
  END IF;
  
  -- Recipient phone
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'recipient_phone'
  ) THEN
    ALTER TABLE shipments ADD COLUMN recipient_phone TEXT;
    RAISE NOTICE '✅ Aggiunto campo: recipient_phone';
  END IF;
  
  -- Recipient email
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'recipient_email'
  ) THEN
    ALTER TABLE shipments ADD COLUMN recipient_email TEXT;
    RAISE NOTICE '✅ Aggiunto campo: recipient_email';
  END IF;
  
  -- LDV (Lettera di Vettura)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'ldv'
  ) THEN
    ALTER TABLE shipments ADD COLUMN ldv TEXT;
    RAISE NOTICE '✅ Aggiunto campo: ldv';
  END IF;
  
  -- Imported
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'imported'
  ) THEN
    ALTER TABLE shipments ADD COLUMN imported BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Aggiunto campo: imported';
  END IF;
  
  -- Import source
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'import_source'
  ) THEN
    ALTER TABLE shipments ADD COLUMN import_source TEXT;
    RAISE NOTICE '✅ Aggiunto campo: import_source';
  END IF;
  
  -- Import platform
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'import_platform'
  ) THEN
    ALTER TABLE shipments ADD COLUMN import_platform TEXT;
    RAISE NOTICE '✅ Aggiunto campo: import_platform';
  END IF;
  
  -- Verified
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'verified'
  ) THEN
    ALTER TABLE shipments ADD COLUMN verified BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Aggiunto campo: verified';
  END IF;
  
  -- Packages count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'packages_count'
  ) THEN
    ALTER TABLE shipments ADD COLUMN packages_count INTEGER DEFAULT 1;
    RAISE NOTICE '✅ Aggiunto campo: packages_count';
  END IF;
  
  -- ⚠️ CRITICO: Campi Dimensioni (usati da mapSpedizioneToSupabase)
  -- Length
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'length'
  ) THEN
    ALTER TABLE shipments ADD COLUMN length DECIMAL(10,2);
    RAISE NOTICE '✅ Aggiunto campo: length';
  END IF;
  
  -- Width
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'width'
  ) THEN
    ALTER TABLE shipments ADD COLUMN width DECIMAL(10,2);
    RAISE NOTICE '✅ Aggiunto campo: width';
  END IF;
  
  -- Height
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'height'
  ) THEN
    ALTER TABLE shipments ADD COLUMN height DECIMAL(10,2);
    RAISE NOTICE '✅ Aggiunto campo: height';
  END IF;
  
  -- Volumetric weight
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'volumetric_weight'
  ) THEN
    ALTER TABLE shipments ADD COLUMN volumetric_weight DECIMAL(10,3);
    RAISE NOTICE '✅ Aggiunto campo: volumetric_weight';
  END IF;
  
  -- Content
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'content'
  ) THEN
    ALTER TABLE shipments ADD COLUMN content TEXT;
    RAISE NOTICE '✅ Aggiunto campo: content';
  END IF;
  
  -- Sender reference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'sender_reference'
  ) THEN
    ALTER TABLE shipments ADD COLUMN sender_reference TEXT;
    RAISE NOTICE '✅ Aggiunto campo: sender_reference';
  END IF;
  
  -- Recipient reference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'recipient_reference'
  ) THEN
    ALTER TABLE shipments ADD COLUMN recipient_reference TEXT;
    RAISE NOTICE '✅ Aggiunto campo: recipient_reference';
  END IF;
  
  -- Deleted
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'deleted'
  ) THEN
    ALTER TABLE shipments ADD COLUMN deleted BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Aggiunto campo: deleted';
  END IF;
  
  -- Deleted at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE shipments ADD COLUMN deleted_at TIMESTAMPTZ;
    RAISE NOTICE '✅ Aggiunto campo: deleted_at';
  END IF;
  
  -- Deleted by user id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'deleted_by_user_id'
  ) THEN
    -- Verifica se la tabella users esiste prima di creare foreign key
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
      ALTER TABLE shipments ADD COLUMN deleted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
    ELSE
      ALTER TABLE shipments ADD COLUMN deleted_by_user_id UUID;
    END IF;
    RAISE NOTICE '✅ Aggiunto campo: deleted_by_user_id';
  END IF;
  
  -- Created by user email
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'created_by_user_email'
  ) THEN
    ALTER TABLE shipments ADD COLUMN created_by_user_email TEXT;
    RAISE NOTICE '✅ Aggiunto campo: created_by_user_email';
  END IF;
  
  -- External tracking number
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'external_tracking_number'
  ) THEN
    ALTER TABLE shipments ADD COLUMN external_tracking_number TEXT;
    RAISE NOTICE '✅ Aggiunto campo: external_tracking_number';
  END IF;
  
  -- Recipient notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'recipient_notes'
  ) THEN
    ALTER TABLE shipments ADD COLUMN recipient_notes TEXT;
    RAISE NOTICE '✅ Aggiunto campo: recipient_notes';
  END IF;
  
  -- Recipient address number
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'recipient_address_number'
  ) THEN
    ALTER TABLE shipments ADD COLUMN recipient_address_number TEXT;
    RAISE NOTICE '✅ Aggiunto campo: recipient_address_number';
  END IF;
  
  -- ⚠️ CRITICO: Campi Servizio (usati da mapSpedizioneToSupabase)
  -- Courier ID (UUID, foreign key verso couriers se esiste)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'courier_id'
  ) THEN
    -- Verifica se la tabella couriers esiste prima di creare foreign key
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'couriers') THEN
      ALTER TABLE shipments ADD COLUMN courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL;
    ELSE
      ALTER TABLE shipments ADD COLUMN courier_id UUID;
    END IF;
    RAISE NOTICE '✅ Aggiunto campo: courier_id';
  END IF;
  
  -- Service type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'service_type'
  ) THEN
    ALTER TABLE shipments ADD COLUMN service_type courier_service_type DEFAULT 'standard';
    RAISE NOTICE '✅ Aggiunto campo: service_type';
  END IF;
  
  -- Recipient type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'recipient_type'
  ) THEN
    ALTER TABLE shipments ADD COLUMN recipient_type recipient_type DEFAULT 'B2C';
    RAISE NOTICE '✅ Aggiunto campo: recipient_type';
  END IF;
  
  -- Content
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'content'
  ) THEN
    ALTER TABLE shipments ADD COLUMN content TEXT;
    RAISE NOTICE '✅ Aggiunto campo: content';
  END IF;
  
  -- Declared value
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'declared_value'
  ) THEN
    ALTER TABLE shipments ADD COLUMN declared_value DECIMAL(10,2);
    RAISE NOTICE '✅ Aggiunto campo: declared_value';
  END IF;
  
  -- Currency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'currency'
  ) THEN
    ALTER TABLE shipments ADD COLUMN currency TEXT DEFAULT 'EUR';
    RAISE NOTICE '✅ Aggiunto campo: currency';
  END IF;
  
  -- Cash on delivery (boolean) - ⚠️ CRITICO: Verifica e correggi tipo se è NUMERIC invece di BOOLEAN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'cash_on_delivery'
  ) THEN
    ALTER TABLE shipments ADD COLUMN cash_on_delivery BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Aggiunto campo: cash_on_delivery';
  ELSE
    -- Verifica se il tipo è sbagliato (NUMERIC invece di BOOLEAN)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipments' 
      AND column_name = 'cash_on_delivery'
      AND data_type IN ('numeric', 'integer', 'smallint', 'bigint', 'decimal')
    ) THEN
      -- ⚠️ CRITICO: Elimina view che dipende dalla colonna prima di cambiare il tipo
      DROP VIEW IF EXISTS shipments_active CASCADE;
      RAISE NOTICE '⚠️ View shipments_active eliminata temporaneamente per conversione tipo colonna';
      
      -- 1) Drop default (se esiste)
      BEGIN
        ALTER TABLE shipments ALTER COLUMN cash_on_delivery DROP DEFAULT;
      EXCEPTION WHEN OTHERS THEN
        -- Se non c'è DEFAULT, continua
        NULL;
      END;
      
      -- 2) Change type
      ALTER TABLE shipments 
        ALTER COLUMN cash_on_delivery TYPE BOOLEAN 
        USING CASE 
          WHEN cash_on_delivery::text = 'true' 
            OR cash_on_delivery::text = '1' 
            OR cash_on_delivery::numeric > 0 
          THEN true
          ELSE false
        END;
      
      -- 3) Set nuovo default
      ALTER TABLE shipments 
        ALTER COLUMN cash_on_delivery SET DEFAULT false;
      
      RAISE NOTICE '✅ Corretto tipo di cash_on_delivery da NUMERIC a BOOLEAN';
    END IF;
  END IF;
  
  -- Cash on delivery amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'cash_on_delivery_amount'
  ) THEN
    ALTER TABLE shipments ADD COLUMN cash_on_delivery_amount DECIMAL(10,2);
    RAISE NOTICE '✅ Aggiunto campo: cash_on_delivery_amount';
  END IF;
  
  -- Insurance (boolean) - ⚠️ CRITICO: Verifica e correggi tipo se è NUMERIC invece di BOOLEAN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'insurance'
  ) THEN
    ALTER TABLE shipments ADD COLUMN insurance BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Aggiunto campo: insurance';
  ELSE
    -- Verifica se il tipo è sbagliato (NUMERIC invece di BOOLEAN)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipments' 
      AND column_name = 'insurance'
      AND data_type IN ('numeric', 'integer', 'smallint', 'bigint', 'decimal')
    ) THEN
      -- ⚠️ CRITICO: Elimina view che dipende dalla colonna prima di cambiare il tipo (se non già eliminata)
      DROP VIEW IF EXISTS shipments_active CASCADE;
      
      -- 1) Drop default (se esiste)
      BEGIN
        ALTER TABLE shipments ALTER COLUMN insurance DROP DEFAULT;
      EXCEPTION WHEN OTHERS THEN
        -- Se non c'è DEFAULT, continua
        NULL;
      END;
      
      -- 2) Change type
      ALTER TABLE shipments 
        ALTER COLUMN insurance TYPE BOOLEAN 
        USING CASE 
          WHEN insurance::text = 'true' 
            OR insurance::text = '1' 
            OR insurance::numeric > 0 
          THEN true
          ELSE false
        END;
      
      -- 3) Set nuovo default
      ALTER TABLE shipments 
        ALTER COLUMN insurance SET DEFAULT false;
      
      RAISE NOTICE '✅ Corretto tipo di insurance da NUMERIC a BOOLEAN';
    END IF;
  END IF;
  
  -- ⚠️ CRITICO: Campi Pricing (usati da mapSpedizioneToSupabase)
  -- Base price
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'base_price'
  ) THEN
    ALTER TABLE shipments ADD COLUMN base_price DECIMAL(10,2);
    RAISE NOTICE '✅ Aggiunto campo: base_price';
  END IF;
  
  -- Surcharges
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'surcharges'
  ) THEN
    ALTER TABLE shipments ADD COLUMN surcharges DECIMAL(10,2) DEFAULT 0;
    RAISE NOTICE '✅ Aggiunto campo: surcharges';
  END IF;
  
  -- Total cost
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'total_cost'
  ) THEN
    ALTER TABLE shipments ADD COLUMN total_cost DECIMAL(10,2);
    RAISE NOTICE '✅ Aggiunto campo: total_cost';
  END IF;
  
  -- Margin percent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'margin_percent'
  ) THEN
    ALTER TABLE shipments ADD COLUMN margin_percent DECIMAL(5,2) DEFAULT 15;
    RAISE NOTICE '✅ Aggiunto campo: margin_percent';
  END IF;
  
  -- Final price
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'final_price'
  ) THEN
    ALTER TABLE shipments ADD COLUMN final_price DECIMAL(10,2);
    RAISE NOTICE '✅ Aggiunto campo: final_price';
  END IF;
  
  -- Volumetric weight
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'volumetric_weight'
  ) THEN
    ALTER TABLE shipments ADD COLUMN volumetric_weight DECIMAL(10,3);
    RAISE NOTICE '✅ Aggiunto campo: volumetric_weight';
  END IF;
  
  -- Notes (campo principale)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'notes'
  ) THEN
    ALTER TABLE shipments ADD COLUMN notes TEXT;
    RAISE NOTICE '✅ Aggiunto campo: notes';
  END IF;
  
  -- Internal notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'internal_notes'
  ) THEN
    ALTER TABLE shipments ADD COLUMN internal_notes TEXT;
    RAISE NOTICE '✅ Aggiunto campo: internal_notes';
  END IF;
  
  -- Shipped at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'shipped_at'
  ) THEN
    ALTER TABLE shipments ADD COLUMN shipped_at TIMESTAMPTZ;
    RAISE NOTICE '✅ Aggiunto campo: shipped_at';
  END IF;
  
  -- Delivered at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE shipments ADD COLUMN delivered_at TIMESTAMPTZ;
    RAISE NOTICE '✅ Aggiunto campo: delivered_at';
  END IF;
  
  -- ⚠️ CRITICO: Campi E-commerce (usati da mapSpedizioneToSupabase)
  -- E-commerce order ID
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'ecommerce_order_id'
  ) THEN
    ALTER TABLE shipments ADD COLUMN ecommerce_order_id TEXT;
    RAISE NOTICE '✅ Aggiunto campo: ecommerce_order_id';
  END IF;
  
  -- E-commerce order number
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'ecommerce_order_number'
  ) THEN
    ALTER TABLE shipments ADD COLUMN ecommerce_order_number TEXT;
    RAISE NOTICE '✅ Aggiunto campo: ecommerce_order_number';
  END IF;
  
  -- Order reference (nullable, può essere null)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'order_reference'
  ) THEN
    ALTER TABLE shipments ADD COLUMN order_reference TEXT;
    RAISE NOTICE '✅ Aggiunto campo: order_reference';
  ELSE
    -- ⚠️ CRITICO: Se esiste già ma ha NOT NULL, rimuovilo
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipments' 
      AND column_name = 'order_reference'
      AND is_nullable = 'NO'
    ) THEN
      -- Rimuovi NOT NULL constraint
      ALTER TABLE shipments ALTER COLUMN order_reference DROP NOT NULL;
      RAISE NOTICE '✅ Rimosso vincolo NOT NULL da order_reference';
    END IF;
  END IF;
  
  -- Sender country
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'sender_country'
  ) THEN
    ALTER TABLE shipments ADD COLUMN sender_country TEXT DEFAULT 'IT';
    RAISE NOTICE '✅ Aggiunto campo: sender_country';
  END IF;
  
  -- Recipient country
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'recipient_country'
  ) THEN
    ALTER TABLE shipments ADD COLUMN recipient_country TEXT DEFAULT 'IT';
    RAISE NOTICE '✅ Aggiunto campo: recipient_country';
  END IF;
  
  -- ============================================
  -- CORREGGI VINCOLI NOT NULL INCOMPATIBILI
  -- ============================================
  
  -- Verifica e rimuovi NOT NULL da recipient_address se presente
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' 
    AND column_name = 'recipient_address' 
    AND is_nullable = 'NO'
  ) THEN
    -- Prima verifica se ci sono valori NULL esistenti
    IF EXISTS (SELECT 1 FROM shipments WHERE recipient_address IS NULL) THEN
      -- Aggiorna con valore di default se vuoto
      UPDATE shipments SET recipient_address = '' WHERE recipient_address IS NULL;
    END IF;
    ALTER TABLE shipments ALTER COLUMN recipient_address DROP NOT NULL;
    RAISE NOTICE '✅ Rimosso NOT NULL da: recipient_address';
  END IF;
  
  -- Verifica e rimuovi NOT NULL da recipient_city
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' 
    AND column_name = 'recipient_city' 
    AND is_nullable = 'NO'
  ) THEN
    IF EXISTS (SELECT 1 FROM shipments WHERE recipient_city IS NULL) THEN
      UPDATE shipments SET recipient_city = '' WHERE recipient_city IS NULL;
    END IF;
    ALTER TABLE shipments ALTER COLUMN recipient_city DROP NOT NULL;
    RAISE NOTICE '✅ Rimosso NOT NULL da: recipient_city';
  END IF;
  
  -- Verifica e rimuovi NOT NULL da recipient_zip
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' 
    AND column_name = 'recipient_zip' 
    AND is_nullable = 'NO'
  ) THEN
    IF EXISTS (SELECT 1 FROM shipments WHERE recipient_zip IS NULL) THEN
      UPDATE shipments SET recipient_zip = '' WHERE recipient_zip IS NULL;
    END IF;
    ALTER TABLE shipments ALTER COLUMN recipient_zip DROP NOT NULL;
    RAISE NOTICE '✅ Rimosso NOT NULL da: recipient_zip';
  END IF;
  
  -- Verifica e rimuovi NOT NULL da recipient_province
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' 
    AND column_name = 'recipient_province' 
    AND is_nullable = 'NO'
  ) THEN
    IF EXISTS (SELECT 1 FROM shipments WHERE recipient_province IS NULL) THEN
      UPDATE shipments SET recipient_province = '' WHERE recipient_province IS NULL;
    END IF;
    ALTER TABLE shipments ALTER COLUMN recipient_province DROP NOT NULL;
    RAISE NOTICE '✅ Rimosso NOT NULL da: recipient_province';
  END IF;
  
  -- Verifica e rimuovi NOT NULL da recipient_phone
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' 
    AND column_name = 'recipient_phone' 
    AND is_nullable = 'NO'
  ) THEN
    IF EXISTS (SELECT 1 FROM shipments WHERE recipient_phone IS NULL) THEN
      UPDATE shipments SET recipient_phone = '' WHERE recipient_phone IS NULL;
    END IF;
    ALTER TABLE shipments ALTER COLUMN recipient_phone DROP NOT NULL;
    RAISE NOTICE '✅ Rimosso NOT NULL da: recipient_phone';
  END IF;
  
  -- ============================================
  -- AGGIUNGI INDICI MANCANTI (solo se le colonne esistono)
  -- ============================================
  
  -- Indice su user_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_shipments_user ON shipments(user_id);
  END IF;
  
  -- Indice su tracking_number
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'tracking_number'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
  END IF;
  
  -- Indice su status
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
  END IF;
  
  -- Indice su created_at
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'created_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments(created_at DESC);
  END IF;
  
  -- Indice su ldv (se esiste)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'ldv'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_shipments_ldv ON shipments(ldv) WHERE ldv IS NOT NULL;
  END IF;
  
  -- Indice su deleted (se esiste)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'deleted'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_shipments_deleted ON shipments(deleted) WHERE deleted = false;
  END IF;
  
  -- Indice su created_by_user_email (se esiste)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'created_by_user_email'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_shipments_created_by_email ON shipments(created_by_user_email) WHERE created_by_user_email IS NOT NULL;
  END IF;
  
  -- Indice su imported (se esiste)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'imported'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_shipments_imported ON shipments(imported) WHERE imported = true;
  END IF;
  
  -- Indice composito user_id + deleted (se entrambi esistono)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'user_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'deleted'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_shipments_user_deleted ON shipments(user_id, deleted) WHERE deleted = false;
  END IF;
  
  -- Indice composito tracking_number + deleted (se entrambi esistono)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'tracking_number'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'deleted'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_shipments_tracking_deleted ON shipments(tracking_number, deleted) WHERE deleted = false;
  END IF;
  
  RAISE NOTICE '✅ Correzione tabella completata!';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 4: Esegui la creazione o correzione tabella
-- ============================================

DO $$ 
DECLARE
  table_exists BOOLEAN;
BEGIN
  -- Verifica se la tabella shipments esiste
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'shipments'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE NOTICE '📦 Tabella shipments non esiste - creazione completa...';
    PERFORM create_shipments_table_complete();
  ELSE
    RAISE NOTICE '✅ Tabella shipments esiste - verifica e correzione...';
    PERFORM fix_existing_shipments_table();
  END IF;
END $$;

-- ============================================
-- STEP 5: Crea Trigger (DOPO che la tabella esiste)
-- ============================================

-- Trigger per updated_at (solo se la colonna esiste)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_update_shipments_updated_at ON shipments;
    CREATE TRIGGER trigger_update_shipments_updated_at
      BEFORE UPDATE ON shipments
      FOR EACH ROW
      EXECUTE FUNCTION update_shipments_updated_at();
    RAISE NOTICE '✅ Trigger updated_at creato';
  ELSE
    RAISE NOTICE '⚠️ Trigger updated_at saltato (colonna updated_at non presente)';
  END IF;
END $$;

-- Trigger per peso volumetrico (solo se le colonne esistono)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'length'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'width'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'height'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'volumetric_weight'
  ) THEN
    DROP TRIGGER IF EXISTS shipments_volumetric_weight ON shipments;
    CREATE TRIGGER shipments_volumetric_weight
      BEFORE INSERT OR UPDATE ON shipments
      FOR EACH ROW
      WHEN (NEW.length IS NOT NULL AND NEW.width IS NOT NULL AND NEW.height IS NOT NULL)
      EXECUTE FUNCTION auto_calculate_volumetric_weight();
    RAISE NOTICE '✅ Trigger volumetric_weight creato';
  ELSE
    RAISE NOTICE '⚠️ Trigger volumetric_weight saltato (colonne dimensioni non presenti)';
  END IF;
END $$;

-- ============================================
-- STEP 6: Aggiungi Funzione Soft Delete
-- ============================================

CREATE OR REPLACE FUNCTION soft_delete_shipment(
  p_shipment_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE shipments
  SET 
    deleted = true,
    deleted_at = NOW(),
    deleted_by_user_id = p_user_id,
    updated_at = NOW()
  WHERE id = p_shipment_id AND deleted = false;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
-- ⚠️ NOTA: Rimosso SECURITY DEFINER per sicurezza - la funzione userà i permessi dell'utente chiamante

COMMENT ON FUNCTION soft_delete_shipment IS 'Esegue soft delete di una spedizione';

-- ============================================
-- STEP 7: Crea View per Spedizioni Attive (SPOSTATO DOPO STEP 9)
-- ============================================
-- La view viene creata nello STEP 9 per assicurare sicurezza

-- ============================================
-- STEP 8: Aggiungi RLS Policies (se RLS è abilitato)
-- ============================================

DO $$ 
BEGIN
  -- Verifica se RLS è abilitato
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'shipments' 
    AND rowsecurity = true
  ) THEN
    -- Policy per filtrare automaticamente spedizioni eliminate
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'shipments' 
      AND policyname = 'shipments_select_active'
    ) THEN
      CREATE POLICY shipments_select_active ON shipments
        FOR SELECT
        USING (deleted = false OR deleted IS NULL);
      RAISE NOTICE '✅ Aggiunta policy RLS: shipments_select_active';
    END IF;
  END IF;
END $$;

-- ============================================
-- STEP 9: Commenti per Documentazione
-- ============================================

COMMENT ON TABLE shipments IS 'Tabella spedizioni completa - Compatibile con codice TypeScript creazione spedizioni dal web';
COMMENT ON COLUMN shipments.tracking_number IS 'Numero tracking univoco della spedizione';
COMMENT ON COLUMN shipments.ldv IS 'Lettera di Vettura (LDV) - Tracking originale da Spedisci.Online';

-- ============================================
-- STEP 9: Fix Sicurezza - Rimuovi SECURITY DEFINER da View
-- ============================================

-- ⚠️ SICUREZZA: Assicura che la view shipments_active usi SECURITY INVOKER
DO $$
BEGIN
  -- Ricrea la view senza SECURITY DEFINER (usa SECURITY INVOKER esplicito)
  DROP VIEW IF EXISTS shipments_active CASCADE;
  
  -- Crea view con SECURITY INVOKER esplicito (più sicuro)
  CREATE VIEW shipments_active
  WITH (security_invoker = true) AS
  SELECT *
  FROM shipments
  WHERE deleted = false OR deleted IS NULL;
  
  RAISE NOTICE '✅ View shipments_active ricreata con SECURITY INVOKER esplicito';
END $$;

COMMENT ON VIEW shipments_active IS 'View che mostra solo le spedizioni attive (non eliminate) - SECURITY INVOKER per sicurezza';
COMMENT ON COLUMN shipments.user_id IS 'ID utente proprietario (multi-tenancy)';
COMMENT ON COLUMN shipments.deleted IS 'Soft delete: true se eliminata, false se attiva';
COMMENT ON COLUMN shipments.created_by_user_email IS 'Email utente che ha creato (per compatibilità NextAuth)';

-- ============================================
-- RIEPILOGO FINALE
-- ============================================

DO $$
DECLARE
  column_count INTEGER;
  index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_name = 'shipments';
  
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'shipments';
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRAZIONE COMPLETATA!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Colonne totali: %', column_count;
  RAISE NOTICE 'Indici totali: %', index_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'La tabella shipments è ora compatibile';
  RAISE NOTICE 'con il codice TypeScript!';
  RAISE NOTICE '========================================';
END $$;
