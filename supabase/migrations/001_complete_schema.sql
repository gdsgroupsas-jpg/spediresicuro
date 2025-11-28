-- ============================================
-- FERRARI LOGISTICS PLATFORM - COMPLETE SCHEMA
-- SpedireSicuro.it - Production Database
-- ============================================
-- Migration: 001 - Complete Schema
-- Description: Schema completo per piattaforma logistica/e-commerce
-- ============================================

-- Estensioni necessarie
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================
-- ENUMS
-- ============================================

-- Tipo di utente
CREATE TYPE user_role AS ENUM ('admin', 'user', 'merchant');

-- Provider autenticazione
CREATE TYPE auth_provider AS ENUM ('credentials', 'google', 'github', 'facebook');

-- Status spedizione
CREATE TYPE shipment_status AS ENUM (
  'draft',           -- Bozza
  'pending',         -- In attesa
  'processing',      -- In elaborazione
  'shipped',         -- Spedita
  'in_transit',      -- In transito
  'out_for_delivery',-- In consegna
  'delivered',       -- Consegnata
  'failed',          -- Fallita
  'cancelled',       -- Cancellata
  'returned'         -- Resa
);

-- Tipo di servizio corriere
CREATE TYPE courier_service_type AS ENUM (
  'standard',
  'express',
  'economy',
  'same_day',
  'next_day'
);

-- Tipo di destinatario
CREATE TYPE recipient_type AS ENUM ('B2C', 'B2B');

-- Tipo di listino
CREATE TYPE price_list_status AS ENUM ('draft', 'active', 'archived');

-- Tipo di movimento magazzino
CREATE TYPE warehouse_movement_type AS ENUM (
  'inbound',        -- Carico
  'outbound',       -- Scarico
  'transfer',       -- Trasferimento
  'adjustment',     -- Rettifica
  'reservation',    -- Riserva
  'release'         -- Rilascio riserva
);

-- Status ordine e-commerce
CREATE TYPE ecommerce_order_status AS ENUM (
  'pending',
  'processing',
  'on_hold',
  'completed',
  'cancelled',
  'refunded',
  'failed'
);

-- Tipo di prodotto
CREATE TYPE product_type AS ENUM (
  'physical',       -- Prodotto fisico
  'digital',        -- Prodotto digitale
  'service',        -- Servizio
  'dropshipping'    -- Dropshipping
);

-- ============================================
-- TABELLA: users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password TEXT, -- Hash bcrypt (vuoto per OAuth)
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  provider auth_provider DEFAULT 'credentials',
  provider_id TEXT, -- ID dal provider OAuth
  image TEXT, -- Avatar URL
  company_name TEXT,
  vat_number TEXT, -- P.IVA
  phone TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Indici users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_provider ON users(provider, provider_id);

-- ============================================
-- TABELLA: couriers (corrieri)
-- ============================================
CREATE TABLE IF NOT EXISTS couriers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- es. "poste", "bartolini", "gls"
  name TEXT NOT NULL, -- Nome visualizzato
  active BOOLEAN DEFAULT true,
  logo_url TEXT,
  website TEXT,
  tracking_url_template TEXT, -- es. "https://track.poste.it/{tracking_number}"

  -- API Integration (opzionale)
  api_enabled BOOLEAN DEFAULT false,
  api_endpoint TEXT,
  api_key_encrypted TEXT, -- Chiave API criptata

  -- Configurazione
  config JSONB DEFAULT '{}', -- Configurazioni specifiche corriere

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici couriers
CREATE INDEX idx_couriers_code ON couriers(code);
CREATE INDEX idx_couriers_active ON couriers(active);

-- ============================================
-- TABELLA: price_lists (listini prezzi)
-- ============================================
CREATE TABLE IF NOT EXISTS price_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  courier_id UUID REFERENCES couriers(id) ON DELETE CASCADE,

  -- Metadata listino
  name TEXT NOT NULL, -- es. "Listino Poste 2024 Q1"
  version TEXT NOT NULL, -- es. "v1.0", "v2.1"
  status price_list_status DEFAULT 'draft',

  -- Validità
  valid_from DATE,
  valid_until DATE,

  -- Sorgente dati
  source_type TEXT, -- 'csv', 'pdf', 'manual', 'api'
  source_file_url TEXT, -- URL file originale (se upload)

  -- Note
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Indici price_lists
CREATE INDEX idx_price_lists_courier ON price_lists(courier_id);
CREATE INDEX idx_price_lists_status ON price_lists(status);
CREATE INDEX idx_price_lists_valid ON price_lists(valid_from, valid_until);

-- ============================================
-- TABELLA: price_list_entries (righe listino)
-- ============================================
CREATE TABLE IF NOT EXISTS price_list_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  price_list_id UUID REFERENCES price_lists(id) ON DELETE CASCADE,

  -- Fasce peso (kg)
  weight_from DECIMAL(10,3) NOT NULL,
  weight_to DECIMAL(10,3) NOT NULL,

  -- Zone geografiche
  zone_code TEXT, -- es. "Z1", "Z2", "ISOLE", "NORD", "SUD"
  zip_code_from TEXT, -- CAP da (opzionale)
  zip_code_to TEXT, -- CAP a (opzionale)
  province_code TEXT, -- Sigla provincia (opzionale)
  region TEXT, -- Nome regione (opzionale)

  -- Tipo servizio
  service_type courier_service_type DEFAULT 'standard',

  -- Prezzi
  base_price DECIMAL(10,2) NOT NULL,

  -- Supplementi
  fuel_surcharge_percent DECIMAL(5,2) DEFAULT 0, -- Contributo carburante %
  island_surcharge DECIMAL(10,2) DEFAULT 0, -- Supplemento isole
  ztl_surcharge DECIMAL(10,2) DEFAULT 0, -- Supplemento ZTL
  cash_on_delivery_surcharge DECIMAL(10,2) DEFAULT 0, -- Supplemento contrassegno
  insurance_rate_percent DECIMAL(5,2) DEFAULT 0, -- Tasso assicurazione %

  -- SLA
  estimated_delivery_days_min INTEGER, -- Giorni minimi consegna
  estimated_delivery_days_max INTEGER, -- Giorni massimi consegna

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici price_list_entries
CREATE INDEX idx_price_entries_list ON price_list_entries(price_list_id);
CREATE INDEX idx_price_entries_weight ON price_list_entries(weight_from, weight_to);
CREATE INDEX idx_price_entries_zone ON price_list_entries(zone_code);
CREATE INDEX idx_price_entries_zip ON price_list_entries(zip_code_from, zip_code_to);
CREATE INDEX idx_price_entries_service ON price_list_entries(service_type);

-- ============================================
-- TABELLA: shipments (spedizioni)
-- ============================================
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),

  -- Tracking
  tracking_number TEXT UNIQUE NOT NULL,
  external_tracking_number TEXT, -- Numero tracking del corriere

  -- Status
  status shipment_status DEFAULT 'draft',

  -- Mittente
  sender_name TEXT NOT NULL,
  sender_address TEXT,
  sender_city TEXT,
  sender_zip TEXT,
  sender_province TEXT,
  sender_country TEXT DEFAULT 'IT',
  sender_phone TEXT,
  sender_email TEXT,

  -- Destinatario
  recipient_name TEXT NOT NULL,
  recipient_type recipient_type DEFAULT 'B2C',
  recipient_address TEXT NOT NULL,
  recipient_address_number TEXT,
  recipient_city TEXT NOT NULL,
  recipient_zip TEXT NOT NULL,
  recipient_province TEXT NOT NULL,
  recipient_country TEXT DEFAULT 'IT',
  recipient_phone TEXT NOT NULL,
  recipient_email TEXT,
  recipient_notes TEXT,

  -- Pacco
  weight DECIMAL(10,3) NOT NULL, -- kg
  length DECIMAL(10,2), -- cm
  width DECIMAL(10,2), -- cm
  height DECIMAL(10,2), -- cm
  volumetric_weight DECIMAL(10,3), -- Peso volumetrico calcolato

  -- Valore merce
  declared_value DECIMAL(10,2),
  currency TEXT DEFAULT 'EUR',

  -- Servizio
  courier_id UUID REFERENCES couriers(id),
  service_type courier_service_type DEFAULT 'standard',
  cash_on_delivery BOOLEAN DEFAULT false,
  cash_on_delivery_amount DECIMAL(10,2),
  insurance BOOLEAN DEFAULT false,

  -- Pricing
  base_price DECIMAL(10,2),
  surcharges DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,2), -- Costo totale (base + supplementi)
  margin_percent DECIMAL(5,2) DEFAULT 15,
  final_price DECIMAL(10,2), -- Prezzo finale al cliente

  -- Geo-analytics
  geo_zone TEXT, -- Zona geografica calcolata
  courier_quality_score DECIMAL(3,2), -- Score qualità corriere per quella zona (0-10)

  -- Integrazione e-commerce
  ecommerce_platform TEXT, -- 'shopify', 'woocommerce', etc.
  ecommerce_order_id TEXT, -- ID ordine sulla piattaforma
  ecommerce_order_number TEXT, -- Numero ordine leggibile

  -- OCR data (se creata via OCR)
  created_via_ocr BOOLEAN DEFAULT false,
  ocr_confidence_score DECIMAL(3,2), -- Score confidenza OCR (0-1)

  -- Note
  notes TEXT,
  internal_notes TEXT, -- Note interne non visibili al cliente

  -- Timestamps
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici shipments
CREATE INDEX idx_shipments_user ON shipments(user_id);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_courier ON shipments(courier_id);
CREATE INDEX idx_shipments_recipient_zip ON shipments(recipient_zip);
CREATE INDEX idx_shipments_created_at ON shipments(created_at DESC);
CREATE INDEX idx_shipments_ecommerce ON shipments(ecommerce_platform, ecommerce_order_id);

-- Full-text search su destinatario e città
CREATE INDEX idx_shipments_recipient_search ON shipments
  USING GIN(to_tsvector('italian', recipient_name || ' ' || recipient_city));

-- ============================================
-- TABELLA: shipment_events (tracking eventi)
-- ============================================
CREATE TABLE IF NOT EXISTS shipment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,

  -- Evento
  status shipment_status NOT NULL,
  description TEXT,
  location TEXT, -- Località evento

  -- Timestamps
  event_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici shipment_events
CREATE INDEX idx_shipment_events_shipment ON shipment_events(shipment_id);
CREATE INDEX idx_shipment_events_date ON shipment_events(event_date DESC);

-- ============================================
-- TABELLA: quotes (preventivi)
-- ============================================
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),

  -- Dati spedizione
  weight DECIMAL(10,3) NOT NULL,
  length DECIMAL(10,2),
  width DECIMAL(10,2),
  height DECIMAL(10,2),

  -- Destinazione
  destination_zip TEXT NOT NULL,
  destination_city TEXT,
  destination_province TEXT,

  -- Risultati
  results JSONB, -- Array di preventivi da vari corrieri
  selected_courier_id UUID REFERENCES couriers(id),

  -- Conversione
  converted_to_shipment_id UUID REFERENCES shipments(id),
  converted_at TIMESTAMPTZ,

  -- Timestamps
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici quotes
CREATE INDEX idx_quotes_user ON quotes(user_id);
CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);

-- ============================================
-- TABELLA: suppliers (fornitori)
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Anagrafica
  name TEXT NOT NULL,
  code TEXT UNIQUE, -- Codice interno fornitore
  company_name TEXT,
  vat_number TEXT,

  -- Contatti
  email TEXT,
  phone TEXT,
  website TEXT,

  -- Indirizzo
  address TEXT,
  city TEXT,
  zip TEXT,
  province TEXT,
  country TEXT DEFAULT 'IT',

  -- Condizioni commerciali
  payment_terms TEXT, -- es. "30gg FM", "60gg DF"
  min_order_quantity INTEGER, -- MOQ
  min_order_value DECIMAL(10,2), -- Minimo valore ordine

  -- Logistica
  ships_from_city TEXT, -- Da dove spedisce
  ships_from_zip TEXT,
  default_courier_id UUID REFERENCES couriers(id),
  average_processing_days INTEGER, -- Giorni medi di evasione

  -- Rating
  quality_rating DECIMAL(2,1), -- 0-5 stelle
  reliability_rating DECIMAL(2,1), -- 0-5 stelle

  -- Status
  active BOOLEAN DEFAULT true,
  is_dropshipper BOOLEAN DEFAULT false,

  -- Note
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici suppliers
CREATE INDEX idx_suppliers_code ON suppliers(code);
CREATE INDEX idx_suppliers_active ON suppliers(active);

-- ============================================
-- TABELLA: products (prodotti)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identificativi
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,

  -- Categoria
  category TEXT,
  subcategory TEXT,
  tags TEXT[], -- Array di tag

  -- Tipo
  type product_type DEFAULT 'physical',

  -- Dimensioni e peso
  weight DECIMAL(10,3), -- kg
  length DECIMAL(10,2), -- cm
  width DECIMAL(10,2), -- cm
  height DECIMAL(10,2), -- cm

  -- Prezzi
  cost_price DECIMAL(10,2), -- Costo acquisto
  sale_price DECIMAL(10,2), -- Prezzo vendita
  suggested_retail_price DECIMAL(10,2), -- PVP suggerito

  -- Immagini
  image_url TEXT,
  images JSONB, -- Array di URL immagini

  -- Status
  active BOOLEAN DEFAULT true,

  -- SEO / Marketing
  seo_title TEXT,
  seo_description TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici products
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_products_tags ON products USING GIN(tags);

-- Full-text search su nome e descrizione
CREATE INDEX idx_products_search ON products
  USING GIN(to_tsvector('italian', name || ' ' || COALESCE(description, '')));

-- ============================================
-- TABELLA: product_suppliers (relazione prodotto-fornitore)
-- ============================================
CREATE TABLE IF NOT EXISTS product_suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Prezzi fornitore
  supplier_sku TEXT, -- SKU del fornitore (potrebbe essere diverso)
  cost_price DECIMAL(10,2) NOT NULL,
  min_order_quantity INTEGER DEFAULT 1,

  -- Lead time
  lead_time_days INTEGER, -- Giorni di consegna dal fornitore

  -- Priorità (1 = fornitore preferito, 2 = backup, etc.)
  priority INTEGER DEFAULT 1,

  -- Status
  active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(product_id, supplier_id)
);

-- Indici product_suppliers
CREATE INDEX idx_product_suppliers_product ON product_suppliers(product_id);
CREATE INDEX idx_product_suppliers_supplier ON product_suppliers(supplier_id);
CREATE INDEX idx_product_suppliers_priority ON product_suppliers(priority);

-- ============================================
-- TABELLA: warehouses (magazzini)
-- ============================================
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identificazione
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,

  -- Tipo
  type TEXT DEFAULT 'internal', -- 'internal', 'external', 'dropshipper'

  -- Indirizzo
  address TEXT,
  city TEXT,
  zip TEXT,
  province TEXT,
  country TEXT DEFAULT 'IT',

  -- Contatti
  manager_name TEXT,
  phone TEXT,
  email TEXT,

  -- Status
  active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici warehouses
CREATE INDEX idx_warehouses_code ON warehouses(code);
CREATE INDEX idx_warehouses_active ON warehouses(active);

-- ============================================
-- TABELLA: inventory (inventario/stock)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,

  -- Quantità
  quantity_available INTEGER DEFAULT 0, -- Disponibile
  quantity_reserved INTEGER DEFAULT 0, -- Riservato (ordini in corso)
  quantity_on_order INTEGER DEFAULT 0, -- In arrivo da fornitori

  -- Stock management
  reorder_point INTEGER DEFAULT 0, -- Punto di riordino
  reorder_quantity INTEGER DEFAULT 0, -- Quantità di riordino

  -- Timestamps
  last_stock_take_at TIMESTAMPTZ, -- Ultimo inventario fisico
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(product_id, warehouse_id)
);

-- Indici inventory
CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX idx_inventory_low_stock ON inventory(quantity_available)
  WHERE quantity_available <= reorder_point;

-- ============================================
-- TABELLA: warehouse_movements (movimenti magazzino)
-- ============================================
CREATE TABLE IF NOT EXISTS warehouse_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Riferimenti
  product_id UUID REFERENCES products(id),
  warehouse_id UUID REFERENCES warehouses(id),

  -- Tipo movimento
  type warehouse_movement_type NOT NULL,

  -- Quantità (positiva per carico, negativa per scarico)
  quantity INTEGER NOT NULL,

  -- Destinazione (per trasferimenti)
  to_warehouse_id UUID REFERENCES warehouses(id),

  -- Riferimenti esterni
  shipment_id UUID REFERENCES shipments(id), -- Se legato a spedizione
  reference_type TEXT, -- 'purchase_order', 'sales_order', 'adjustment', etc.
  reference_id TEXT, -- ID del documento di riferimento

  -- Note
  notes TEXT,

  -- User
  created_by UUID REFERENCES users(id),

  -- Timestamp
  movement_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici warehouse_movements
CREATE INDEX idx_warehouse_movements_product ON warehouse_movements(product_id);
CREATE INDEX idx_warehouse_movements_warehouse ON warehouse_movements(warehouse_id);
CREATE INDEX idx_warehouse_movements_type ON warehouse_movements(type);
CREATE INDEX idx_warehouse_movements_date ON warehouse_movements(movement_date DESC);

-- ============================================
-- TABELLA: ecommerce_integrations (integrazioni e-commerce)
-- ============================================
CREATE TABLE IF NOT EXISTS ecommerce_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Piattaforma
  platform TEXT NOT NULL, -- 'shopify', 'woocommerce', 'prestashop', 'magento'

  -- Credenziali (criptate)
  store_url TEXT NOT NULL,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  access_token_encrypted TEXT,

  -- Configurazione
  config JSONB DEFAULT '{}', -- Configurazioni specifiche piattaforma

  -- Mapping
  field_mapping JSONB, -- Mappatura campi personalizzati

  -- Status
  active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT, -- 'success', 'error', 'partial'
  last_sync_error TEXT,

  -- Webhooks
  webhook_secret TEXT,
  webhook_enabled BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici ecommerce_integrations
CREATE INDEX idx_ecommerce_integrations_user ON ecommerce_integrations(user_id);
CREATE INDEX idx_ecommerce_integrations_platform ON ecommerce_integrations(platform);
CREATE INDEX idx_ecommerce_integrations_active ON ecommerce_integrations(active);

-- ============================================
-- TABELLA: ecommerce_orders (ordini e-commerce)
-- ============================================
CREATE TABLE IF NOT EXISTS ecommerce_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID REFERENCES ecommerce_integrations(id) ON DELETE CASCADE,

  -- Identificativi piattaforma
  platform_order_id TEXT NOT NULL,
  platform_order_number TEXT NOT NULL,

  -- Cliente
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,

  -- Indirizzo spedizione
  shipping_address JSONB,

  -- Items
  items JSONB, -- Array di prodotti ordinati

  -- Totali
  subtotal DECIMAL(10,2),
  shipping_cost DECIMAL(10,2),
  tax DECIMAL(10,2),
  total DECIMAL(10,2),
  currency TEXT DEFAULT 'EUR',

  -- Status
  status ecommerce_order_status,
  financial_status TEXT,
  fulfillment_status TEXT,

  -- Spedizione associata
  shipment_id UUID REFERENCES shipments(id),

  -- Sync
  synced_at TIMESTAMPTZ,

  -- Timestamps piattaforma
  platform_created_at TIMESTAMPTZ,
  platform_updated_at TIMESTAMPTZ,

  -- Timestamps locali
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(integration_id, platform_order_id)
);

-- Indici ecommerce_orders
CREATE INDEX idx_ecommerce_orders_integration ON ecommerce_orders(integration_id);
CREATE INDEX idx_ecommerce_orders_platform_id ON ecommerce_orders(platform_order_id);
CREATE INDEX idx_ecommerce_orders_status ON ecommerce_orders(status);
CREATE INDEX idx_ecommerce_orders_shipment ON ecommerce_orders(shipment_id);

-- ============================================
-- TABELLA: social_insights (dati social trend)
-- ============================================
CREATE TABLE IF NOT EXISTS social_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Piattaforma
  platform TEXT NOT NULL, -- 'facebook', 'instagram', 'tiktok', 'google_trends'

  -- Metriche
  metric_type TEXT NOT NULL, -- 'engagement', 'reach', 'impressions', 'trend_score'
  metric_value DECIMAL(15,2),

  -- Dimensioni
  product_category TEXT,
  geographic_zone TEXT, -- CAP, provincia, regione

  -- Periodo
  period_start DATE,
  period_end DATE,

  -- Dati raw
  raw_data JSONB,

  -- Timestamp
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici social_insights
CREATE INDEX idx_social_insights_platform ON social_insights(platform);
CREATE INDEX idx_social_insights_category ON social_insights(product_category);
CREATE INDEX idx_social_insights_zone ON social_insights(geographic_zone);
CREATE INDEX idx_social_insights_period ON social_insights(period_start, period_end);

-- ============================================
-- TABELLA: geo_analytics (analytics geografiche)
-- ============================================
CREATE TABLE IF NOT EXISTS geo_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Zona geografica
  zip_code TEXT,
  city TEXT,
  province TEXT,
  region TEXT,
  zone_type TEXT, -- 'urban', 'suburban', 'rural', 'island'

  -- Periodo
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Metriche spedizioni
  total_shipments INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  average_shipment_value DECIMAL(10,2) DEFAULT 0,

  -- Prodotti
  top_product_categories JSONB, -- Array categorie più vendute

  -- Performance corrieri
  courier_performance JSONB, -- { courier_id: { deliveries, success_rate, avg_days } }

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(zip_code, period_start, period_end)
);

-- Indici geo_analytics
CREATE INDEX idx_geo_analytics_zip ON geo_analytics(zip_code);
CREATE INDEX idx_geo_analytics_province ON geo_analytics(province);
CREATE INDEX idx_geo_analytics_period ON geo_analytics(period_start, period_end);

-- ============================================
-- TABELLA: fulfillment_rules (regole orchestrator)
-- ============================================
CREATE TABLE IF NOT EXISTS fulfillment_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Nome e descrizione
  name TEXT NOT NULL,
  description TEXT,

  -- Priorità (1 = massima)
  priority INTEGER DEFAULT 100,

  -- Condizioni (JSONB per flessibilità)
  conditions JSONB, -- es. { "product_category": "electronics", "destination_zone": "islands" }

  -- Azione
  action_type TEXT NOT NULL, -- 'prefer_warehouse', 'prefer_supplier', 'use_courier', 'block'
  action_params JSONB, -- Parametri azione

  -- Pesi scoring (per decisioni multi-criterio)
  cost_weight DECIMAL(3,2) DEFAULT 0.30,
  time_weight DECIMAL(3,2) DEFAULT 0.30,
  quality_weight DECIMAL(3,2) DEFAULT 0.20,
  margin_weight DECIMAL(3,2) DEFAULT 0.20,

  -- Status
  active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici fulfillment_rules
CREATE INDEX idx_fulfillment_rules_priority ON fulfillment_rules(priority);
CREATE INDEX idx_fulfillment_rules_active ON fulfillment_rules(active);

-- ============================================
-- TABELLA: courier_zone_performance (performance corrieri per zona)
-- ============================================
CREATE TABLE IF NOT EXISTS courier_zone_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  courier_id UUID REFERENCES couriers(id) ON DELETE CASCADE,

  -- Zona
  zip_code TEXT,
  province TEXT,
  region TEXT,
  zone_code TEXT, -- Codice macro-zona

  -- Metriche
  total_deliveries INTEGER DEFAULT 0,
  successful_deliveries INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2), -- %
  average_delivery_days DECIMAL(4,1),
  on_time_deliveries INTEGER DEFAULT 0,
  on_time_rate DECIMAL(5,2), -- %

  -- Score qualità (0-10)
  quality_score DECIMAL(3,1),

  -- Periodo
  period_start DATE,
  period_end DATE,

  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(courier_id, zip_code, period_start)
);

-- Indici courier_zone_performance
CREATE INDEX idx_courier_zone_perf_courier ON courier_zone_performance(courier_id);
CREATE INDEX idx_courier_zone_perf_zip ON courier_zone_performance(zip_code);
CREATE INDEX idx_courier_zone_perf_score ON courier_zone_performance(quality_score DESC);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Funzione: aggiorna updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger updated_at per tutte le tabelle
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_couriers_updated_at BEFORE UPDATE ON couriers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_price_lists_updated_at BEFORE UPDATE ON price_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_suppliers_updated_at BEFORE UPDATE ON product_suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ecommerce_integrations_updated_at BEFORE UPDATE ON ecommerce_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ecommerce_orders_updated_at BEFORE UPDATE ON ecommerce_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_geo_analytics_updated_at BEFORE UPDATE ON geo_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fulfillment_rules_updated_at BEFORE UPDATE ON fulfillment_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Funzione: calcola peso volumetrico
CREATE OR REPLACE FUNCTION calculate_volumetric_weight(
  p_length DECIMAL,
  p_width DECIMAL,
  p_height DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
  -- Formula standard: (L x W x H) / 5000
  IF p_length IS NULL OR p_width IS NULL OR p_height IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN (p_length * p_width * p_height) / 5000;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger: calcola peso volumetrico automaticamente per shipments
CREATE OR REPLACE FUNCTION auto_calculate_volumetric_weight()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.length IS NOT NULL AND NEW.width IS NOT NULL AND NEW.height IS NOT NULL THEN
    NEW.volumetric_weight = calculate_volumetric_weight(NEW.length, NEW.width, NEW.height);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shipments_volumetric_weight BEFORE INSERT OR UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION auto_calculate_volumetric_weight();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Abilita RLS su tutte le tabelle sensibili
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Policy users: ogni utente vede solo se stesso (admin vede tutti)
CREATE POLICY users_select_own ON users
  FOR SELECT USING (
    auth.uid()::text = id::text
    OR EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

-- Policy shipments: utenti vedono solo le proprie spedizioni (admin vede tutto)
CREATE POLICY shipments_select_own ON shipments
  FOR SELECT USING (
    user_id::text = auth.uid()::text
    OR EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

CREATE POLICY shipments_insert_own ON shipments
  FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY shipments_update_own ON shipments
  FOR UPDATE USING (
    user_id::text = auth.uid()::text
    OR EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

-- Policy simili per altre tabelle...
-- (In produzione: creare policy complete per ogni tabella)

-- ============================================
-- DATI INIZIALI (SEED)
-- ============================================

-- Inserisci corrieri predefiniti
INSERT INTO couriers (code, name, active, tracking_url_template) VALUES
  ('poste', 'Poste Italiane', true, 'https://www.poste.it/cerca/index.html#/risultati-spedizioni/{tracking_number}'),
  ('bartolini', 'BRT Bartolini', true, 'https://vas.brt.it/vas/sped_det_show.hsm?referer=sped_numspe_par.htm&Nspediz={tracking_number}'),
  ('gls', 'GLS', true, 'https://www.gls-italy.com/?option=com_gls&view=track_e_trace&numero_spedizione={tracking_number}'),
  ('dhl', 'DHL Express', true, 'https://www.dhl.com/it-it/home/tracking.html?tracking-id={tracking_number}'),
  ('ups', 'UPS', true, 'https://www.ups.com/track?tracknum={tracking_number}'),
  ('fedex', 'FedEx', true, 'https://www.fedex.com/fedextrack/?trknbr={tracking_number}'),
  ('tnt', 'TNT', true, 'https://www.tnt.it/tracking/tracking.do?respCountry=it&respLang=it&searchType=CON&cons={tracking_number}'),
  ('sda', 'SDA Express Courier', true, 'https://www.sda.it/wps/portal/Servizi_online/dettaglio-spedizione?locale=it&tracing.letteraVettura={tracking_number}')
ON CONFLICT (code) DO NOTHING;

-- Inserisci magazzino di default
INSERT INTO warehouses (code, name, type, active) VALUES
  ('MAIN', 'Magazzino Principale', 'internal', true),
  ('VIRTUAL', 'Stock Virtuale Dropshipping', 'dropshipper', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- COMMENTI PER DOCUMENTAZIONE
-- ============================================

COMMENT ON TABLE shipments IS 'Spedizioni complete con tracking, pricing e geo-analytics';
COMMENT ON TABLE price_lists IS 'Listini prezzi corrieri con supporto versioning';
COMMENT ON TABLE products IS 'Catalogo prodotti unificato (fisici, digitali, dropshipping)';
COMMENT ON TABLE inventory IS 'Inventario multi-magazzino con stock disponibile e riservato';
COMMENT ON TABLE ecommerce_integrations IS 'Configurazioni integrazioni piattaforme e-commerce';
COMMENT ON TABLE social_insights IS 'Dati trend social (Meta, TikTok, Google Trends)';
COMMENT ON TABLE fulfillment_rules IS 'Regole business per Smart Fulfillment Orchestrator';
COMMENT ON TABLE courier_zone_performance IS 'Performance storiche corrieri per zona geografica';

-- Fine migrazione
