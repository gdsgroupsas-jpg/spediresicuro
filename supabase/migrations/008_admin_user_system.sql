/**
 * Migration: Sistema Admin/User con Gerarchia Multi-Livello
 * 
 * Aggiunge:
 * 1. Tipo account (user/admin/superadmin) con scelta in registrazione
 * 2. Sistema gerarchico admin (parent_admin_id, admin_level)
 * 3. Supporto per max 5 livelli di admin
 * 4. Killer feature multi_level_admin
 * 
 * Data: 2024
 */

-- ============================================
-- STEP 1: Aggiungi ENUM per tipo account
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
    CREATE TYPE account_type AS ENUM ('user', 'admin', 'superadmin');
    RAISE NOTICE '✅ Creato ENUM: account_type';
  ELSE
    RAISE NOTICE '⚠️ ENUM account_type già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 2: Aggiungi campi alla tabella users
-- ============================================

-- Campo account_type (tipo account: user, admin, superadmin)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE users ADD COLUMN account_type account_type DEFAULT 'user';
    COMMENT ON COLUMN users.account_type IS 'Tipo account: user (base), admin (avanzato), superadmin (gestione completa)';
    RAISE NOTICE '✅ Aggiunto campo: account_type';
  ELSE
    RAISE NOTICE '⚠️ Campo account_type già esistente';
  END IF;
END $$;

-- Campo parent_admin_id (riferimento all''admin superiore nella gerarchia)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'parent_admin_id'
  ) THEN
    ALTER TABLE users ADD COLUMN parent_admin_id UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN users.parent_admin_id IS 'ID dell''admin superiore nella gerarchia (NULL per superadmin e admin di livello 1)';
    RAISE NOTICE '✅ Aggiunto campo: parent_admin_id';
  ELSE
    RAISE NOTICE '⚠️ Campo parent_admin_id già esistente';
  END IF;
END $$;

-- Campo admin_level (livello nella gerarchia: 0=superadmin, 1-5=admin normali)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'admin_level'
  ) THEN
    ALTER TABLE users ADD COLUMN admin_level INTEGER DEFAULT 0;
    COMMENT ON COLUMN users.admin_level IS 'Livello nella gerarchia: 0=superadmin, 1-5=admin normali (max 5 livelli)';
    RAISE NOTICE '✅ Aggiunto campo: admin_level';
  ELSE
    RAISE NOTICE '⚠️ Campo admin_level già esistente';
  END IF;
END $$;

-- Aggiorna account_type basandosi sul ruolo esistente (backward compatibility)
DO $$
BEGIN
  -- Se esiste già un utente con role='admin', impostalo come superadmin o admin
  UPDATE users 
  SET account_type = CASE 
    WHEN role = 'admin' THEN 'admin'::account_type
    ELSE 'user'::account_type
  END
  WHERE account_type IS NULL;
  
  RAISE NOTICE '✅ Aggiornati account_type esistenti basandosi su role';
END $$;

-- ============================================
-- STEP 3: Crea indici per performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_account_type 
ON users(account_type) 
WHERE account_type IN ('admin', 'superadmin');

CREATE INDEX IF NOT EXISTS idx_users_parent_admin 
ON users(parent_admin_id) 
WHERE parent_admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_admin_level 
ON users(admin_level) 
WHERE admin_level > 0;

-- ============================================
-- STEP 4: Aggiungi constraint per validazione
-- ============================================

-- Constraint: admin_level deve essere 0-5
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_admin_level_check'
  ) THEN
    ALTER TABLE users 
    ADD CONSTRAINT users_admin_level_check 
    CHECK (admin_level >= 0 AND admin_level <= 5);
    
    RAISE NOTICE '✅ Aggiunto constraint: admin_level 0-5';
  ELSE
    RAISE NOTICE '⚠️ Constraint admin_level già esistente';
  END IF;
END $$;

-- Constraint: solo admin/superadmin possono avere parent_admin_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_parent_admin_check'
  ) THEN
    ALTER TABLE users 
    ADD CONSTRAINT users_parent_admin_check 
    CHECK (
      (account_type IN ('admin', 'superadmin') AND parent_admin_id IS NULL) OR
      (account_type = 'user') OR
      (parent_admin_id IS NULL)
    );
    
    RAISE NOTICE '✅ Aggiunto constraint: parent_admin_id solo per admin';
  ELSE
    RAISE NOTICE '⚠️ Constraint parent_admin già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 5: Funzione per ottenere tutti i sotto-admin ricorsivamente
-- ============================================

CREATE OR REPLACE FUNCTION get_all_sub_admins(
  p_admin_id UUID,
  p_max_level INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  account_type account_type,
  admin_level INTEGER,
  parent_admin_id UUID
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE admin_tree AS (
    -- Anchor: admin iniziale
    SELECT u.id, u.email, u.name, u.account_type, u.admin_level, u.parent_admin_id
    FROM users u
    WHERE u.id = p_admin_id
      AND u.account_type IN ('admin', 'superadmin')
    
    UNION ALL
    
    -- Recursive: sotto-admin
    SELECT u.id, u.email, u.name, u.account_type, u.admin_level, u.parent_admin_id
    FROM users u
    INNER JOIN admin_tree at ON u.parent_admin_id = at.id
    WHERE u.account_type IN ('admin', 'superadmin')
      AND u.admin_level <= p_max_level
      AND u.admin_level > 0
  )
  SELECT * FROM admin_tree WHERE id != p_admin_id; -- Escludi l'admin stesso
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_all_sub_admins IS 'Ottiene tutti i sotto-admin ricorsivamente fino a max 5 livelli';

-- ============================================
-- STEP 6: Funzione per verificare se un admin può creare sotto-admin
-- ============================================

CREATE OR REPLACE FUNCTION can_create_sub_admin(
  p_admin_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_level INTEGER;
  v_account_type account_type;
  v_has_feature BOOLEAN;
BEGIN
  -- Ottieni livello e tipo account
  SELECT admin_level, account_type 
  INTO v_admin_level, v_account_type
  FROM users
  WHERE id = p_admin_id;
  
  -- Superadmin può sempre creare admin
  IF v_account_type = 'superadmin' THEN
    RETURN true;
  END IF;
  
  -- Admin normale può creare sotto-admin solo se:
  -- 1. Ha il livello < 5 (non può superare 5 livelli)
  -- 2. Ha la killer feature multi_level_admin attiva
  
  IF v_account_type = 'admin' AND v_admin_level < 5 THEN
    -- Verifica se ha la killer feature (via funzione esistente)
    SELECT user_has_feature(
      (SELECT email FROM users WHERE id = p_admin_id),
      'multi_level_admin'
    ) INTO v_has_feature;
    
    RETURN v_has_feature;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_create_sub_admin IS 'Verifica se un admin può creare sotto-admin';

-- ============================================
-- STEP 7: Funzione per ottenere il livello gerarchico di un admin
-- ============================================

CREATE OR REPLACE FUNCTION get_admin_level(
  p_admin_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_level INTEGER := 0;
  v_parent_id UUID;
BEGIN
  SELECT parent_admin_id, admin_level
  INTO v_parent_id, v_level
  FROM users
  WHERE id = p_admin_id;
  
  -- Se è superadmin, livello 0
  IF (SELECT account_type FROM users WHERE id = p_admin_id) = 'superadmin' THEN
    RETURN 0;
  END IF;
  
  -- Se non ha parent, è livello 1
  IF v_parent_id IS NULL THEN
    RETURN 1;
  END IF;
  
  -- Altrimenti usa il livello salvato
  RETURN COALESCE(v_level, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_admin_level IS 'Ottiene il livello gerarchico di un admin (0=superadmin, 1-5=admin)';

-- ============================================
-- STEP 8: Aggiungi killer feature multi_level_admin
-- ============================================

INSERT INTO public.killer_features (
  code, 
  name, 
  description, 
  category, 
  is_free, 
  is_available,
  display_order, 
  icon,
  price_monthly_cents,
  price_yearly_cents
) VALUES (
  'multi_level_admin',
  'Multi-Livello Admin',
  'Gestisci fino a 5 livelli di admin gerarchici. Crea sotto-admin che possono a loro volta gestire altri admin e utenti.',
  'premium',
  false,
  true,
  11,
  'Users',
  999,  -- 9.99€ al mese (esempio)
  9999  -- 99.99€ all'anno (esempio)
)
ON CONFLICT (code) DO UPDATE 
SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_yearly_cents = EXCLUDED.price_yearly_cents;

-- ============================================
-- STEP 9: Crea utente superadmin se non esiste
-- ============================================

DO $$
DECLARE
  v_superadmin_exists BOOLEAN;
BEGIN
  -- Verifica se esiste già un superadmin
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE account_type = 'superadmin'
  ) INTO v_superadmin_exists;
  
  IF NOT v_superadmin_exists THEN
    -- Crea superadmin di default (o aggiorna admin esistente)
    -- ⚠️ NOTA: Crea manualmente il primo superadmin o aggiorna un admin esistente
    RAISE NOTICE '⚠️ Nessun superadmin trovato. Aggiorna manualmente un admin a superadmin se necessario.';
    RAISE NOTICE '   Esempio SQL: UPDATE users SET account_type = ''superadmin'', admin_level = 0 WHERE email = ''admin@spediresicuro.it'';';
  ELSE
    RAISE NOTICE '✅ Superadmin già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 10: Trigger per aggiornare admin_level automaticamente
-- ============================================

CREATE OR REPLACE FUNCTION update_admin_level()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_level INTEGER;
BEGIN
  -- Se è superadmin, livello 0
  IF NEW.account_type = 'superadmin' THEN
    NEW.admin_level := 0;
    RETURN NEW;
  END IF;
  
  -- Se ha parent_admin_id, calcola livello
  IF NEW.parent_admin_id IS NOT NULL THEN
    SELECT admin_level INTO v_parent_level
    FROM users
    WHERE id = NEW.parent_admin_id;
    
    -- Livello = parent_level + 1 (max 5)
    NEW.admin_level := LEAST(COALESCE(v_parent_level, 0) + 1, 5);
  ELSE
    -- Senza parent, è livello 1
    IF NEW.account_type = 'admin' THEN
      NEW.admin_level := 1;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_admin_level ON users;
CREATE TRIGGER trigger_update_admin_level
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  WHEN (NEW.account_type IN ('admin', 'superadmin'))
  EXECUTE FUNCTION update_admin_level();

COMMENT ON TRIGGER trigger_update_admin_level ON users IS 'Aggiorna automaticamente admin_level basandosi su parent_admin_id';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration completata: Sistema Admin/User con Gerarchia Multi-Livello';
  RAISE NOTICE '   - Aggiunti campi: account_type, parent_admin_id, admin_level';
  RAISE NOTICE '   - Creata killer feature: multi_level_admin';
  RAISE NOTICE '   - Create funzioni: get_all_sub_admins, can_create_sub_admin, get_admin_level';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ IMPORTANTE: Crea o aggiorna un superadmin manualmente se necessario:';
  RAISE NOTICE '   UPDATE users SET account_type = ''superadmin'', admin_level = 0 WHERE email = ''admin@spediresicuro.it'';';
END $$;




