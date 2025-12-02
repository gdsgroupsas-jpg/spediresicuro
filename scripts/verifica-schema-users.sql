-- ============================================
-- Script SQL per Verificare e Correggere Schema Tabella Users
-- ============================================
-- Esegui questo script in Supabase Dashboard → SQL Editor
-- ============================================

-- Verifica se la tabella esiste
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
    RAISE NOTICE 'Tabella users non esiste. Creazione in corso...';
    
    -- Crea la tabella
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      provider TEXT DEFAULT 'credentials',
      provider_id TEXT,
      image TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Crea indici
    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_users_role ON users(role);
    
    RAISE NOTICE 'Tabella users creata con successo!';
  ELSE
    RAISE NOTICE 'Tabella users esiste già. Verifica campi...';
  END IF;
END $$;

-- Aggiungi campi mancanti (se non esistono)
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS password TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'credentials',
  ADD COLUMN IF NOT EXISTS provider_id TEXT,
  ADD COLUMN IF NOT EXISTS image TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Se id non è PRIMARY KEY, aggiungilo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_pkey' 
    AND conrelid = 'users'::regclass
  ) THEN
    -- Rimuovi eventuali constraint esistenti su id
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;
    -- Aggiungi PRIMARY KEY
    ALTER TABLE users ADD PRIMARY KEY (id);
    RAISE NOTICE 'PRIMARY KEY aggiunto a id';
  END IF;
END $$;

-- Se email non è UNIQUE, aggiungilo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_email_key' 
    AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
    RAISE NOTICE 'Constraint UNIQUE aggiunto a email';
  END IF;
END $$;

-- Se email non è NOT NULL, aggiungilo
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users ALTER COLUMN name SET NOT NULL;

-- Crea indici se non esistono
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Verifica schema finale
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Messaggio finale
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Verifica schema completata!';
  RAISE NOTICE 'Controlla i risultati sopra per verificare che tutti i campi siano corretti.';
  RAISE NOTICE '========================================';
END $$;

