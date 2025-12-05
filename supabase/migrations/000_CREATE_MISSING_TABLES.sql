-- ============================================
-- QUICK FIX: Crea Tabelle Mancanti (Couriers + Users)
-- ============================================
-- 
-- Esegui questo script SOLO se Migration 018 da errore
-- per tabelle couriers o users mancanti.
--
-- Questo script crea le tabelle base necessarie.
-- Dopo aver eseguito questo, ri-esegui Migration 018.
--
-- Data: 6 Dicembre 2024
-- ============================================

-- Estensioni
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUM user_role (se non esiste)
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
  END IF;
END $$;

-- ENUM account_type (se non esiste)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
    CREATE TYPE account_type AS ENUM ('user', 'admin', 'superadmin');
  END IF;
END $$;

-- ============================================
-- TABELLA: users
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  name TEXT,
  role user_role DEFAULT 'user',
  account_type account_type DEFAULT 'user',
  parent_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_level INTEGER DEFAULT 0,
  provider TEXT,
  provider_id TEXT,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type);

-- ============================================
-- TABELLA: couriers
-- ============================================
CREATE TABLE IF NOT EXISTS public.couriers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  code TEXT UNIQUE,
  logo_url TEXT,
  website_url TEXT,
  tracking_url_template TEXT,
  is_active BOOLEAN DEFAULT true,
  supported_countries TEXT[] DEFAULT ARRAY['IT'],
  min_weight DECIMAL(10,2),
  max_weight DECIMAL(10,2),
  min_dimensions JSONB,
  max_dimensions JSONB,
  estimated_delivery_days_min INTEGER,
  estimated_delivery_days_max INTEGER,
  pricing_model TEXT,
  api_endpoint TEXT,
  api_key_required BOOLEAN DEFAULT false,
  supports_tracking BOOLEAN DEFAULT true,
  supports_insurance BOOLEAN DEFAULT false,
  supports_cod BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici couriers
CREATE INDEX IF NOT EXISTS idx_couriers_name ON couriers(name);
CREATE INDEX IF NOT EXISTS idx_couriers_code ON couriers(code);
CREATE INDEX IF NOT EXISTS idx_couriers_active ON couriers(is_active) WHERE is_active = true;

-- ============================================
-- DATI DI DEFAULT: Corrieri Italiani
-- ============================================
INSERT INTO public.couriers (name, display_name, code, is_active) VALUES
  ('bartolini', 'Bartolini', 'BRT', true),
  ('gls', 'GLS', 'GLS', true),
  ('dhl', 'DHL Express', 'DHL', true),
  ('ups', 'UPS', 'UPS', true),
  ('fedex', 'FedEx', 'FDX', true),
  ('sda', 'SDA Express Courier', 'SDA', true),
  ('tnt', 'TNT', 'TNT', true),
  ('posteitaliane', 'Poste Italiane', 'PTI', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- VERIFICA FINALE
-- ============================================
DO $$
DECLARE
  v_users_count BIGINT;
  v_couriers_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_users_count FROM users;
  SELECT COUNT(*) INTO v_couriers_count FROM couriers;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ TABELLE CREATE CON SUCCESSO';
  RAISE NOTICE '========================================';
  RAISE NOTICE '👥 Utenti: %', v_users_count;
  RAISE NOTICE '🚚 Corrieri: %', v_couriers_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE '🎯 ORA PUOI ESEGUIRE: 018_FINAL_UNIFIED_ANNE_COMPLETE.sql';
  RAISE NOTICE '========================================';
END $$;
