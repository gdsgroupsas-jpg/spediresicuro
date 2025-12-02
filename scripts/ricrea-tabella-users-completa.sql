-- ============================================
-- Script SQL per Ricreare Tabella Users da Zero
-- ============================================
-- ⚠️ ATTENZIONE: Questo script ELIMINA la tabella users esistente!
-- Esegui questo script in Supabase Dashboard → SQL Editor
-- ============================================

-- PASSO 1: Elimina la tabella users se esiste (e tutte le dipendenze)
DROP TABLE IF EXISTS users CASCADE;

-- PASSO 2: Crea la tabella users con schema completo
CREATE TABLE users (
  -- ID primario (UUID auto-generato)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dati autenticazione
  email TEXT UNIQUE NOT NULL,
  password TEXT, -- Hash bcrypt (null per utenti OAuth)
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'user' o 'admin'
  
  -- Provider OAuth
  provider TEXT DEFAULT 'credentials', -- 'credentials', 'google', 'github', 'facebook'
  provider_id TEXT, -- ID dal provider OAuth
  image TEXT, -- Avatar URL
  
  -- Dati cliente completi (JSONB per flessibilità)
  dati_cliente JSONB,
  
  -- Mittente predefinito (JSONB)
  default_sender JSONB,
  
  -- Integrazioni e-commerce (JSONB)
  integrazioni JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PASSO 3: Crea indici per performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_provider ON users(provider, provider_id);

-- PASSO 4: Crea trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_modtime
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_users_updated_at();

-- PASSO 5: Aggiungi commenti per documentazione
COMMENT ON TABLE users IS 'Tabella utenti con supporto per NextAuth, OAuth e dati cliente';
COMMENT ON COLUMN users.id IS 'UUID primario auto-generato';
COMMENT ON COLUMN users.email IS 'Email univoca per autenticazione';
COMMENT ON COLUMN users.password IS 'Hash password (null per utenti OAuth)';
COMMENT ON COLUMN users.role IS 'Ruolo utente: user o admin';
COMMENT ON COLUMN users.provider IS 'Provider autenticazione: credentials, google, github, facebook';
COMMENT ON COLUMN users.dati_cliente IS 'Dati cliente completi in formato JSONB';
COMMENT ON COLUMN users.default_sender IS 'Mittente predefinito per spedizioni in formato JSONB';
COMMENT ON COLUMN users.integrazioni IS 'Integrazioni e-commerce in formato JSONB';

-- PASSO 6: Verifica che la tabella sia stata creata correttamente
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Messaggio di conferma
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Tabella users creata con successo!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Campi creati:';
  RAISE NOTICE '  - id (UUID, PRIMARY KEY)';
  RAISE NOTICE '  - email (TEXT, UNIQUE, NOT NULL)';
  RAISE NOTICE '  - password (TEXT, nullable)';
  RAISE NOTICE '  - name (TEXT, NOT NULL)';
  RAISE NOTICE '  - role (TEXT, default: user)';
  RAISE NOTICE '  - provider (TEXT, default: credentials)';
  RAISE NOTICE '  - provider_id (TEXT, nullable)';
  RAISE NOTICE '  - image (TEXT, nullable)';
  RAISE NOTICE '  - dati_cliente (JSONB, nullable)';
  RAISE NOTICE '  - default_sender (JSONB, nullable)';
  RAISE NOTICE '  - integrazioni (JSONB, nullable)';
  RAISE NOTICE '  - created_at (TIMESTAMPTZ, default: NOW())';
  RAISE NOTICE '  - updated_at (TIMESTAMPTZ, default: NOW())';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Ora puoi ricreare gli utenti demo!';
  RAISE NOTICE '========================================';
END $$;

