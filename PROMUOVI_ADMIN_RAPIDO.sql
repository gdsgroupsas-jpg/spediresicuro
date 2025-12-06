/**
 * Script Rapido: Promuovi Utente ad Admin
 * 
 * ISTRUZIONI:
 * 1. Sostituisci 'TUA_EMAIL@example.com' con la tua email
 * 2. Copia tutto lo script
 * 3. Vai su Supabase Dashboard → SQL Editor
 * 4. Incolla ed esegui
 */

-- ============================================
-- PASSO 1: Verifica utente esistente
-- ============================================
SELECT 
  id,
  email,
  name,
  role,
  account_type,
  admin_level,
  created_at
FROM users
WHERE email = 'TUA_EMAIL@example.com'; -- ⚠️ SOSTITUISCI QUESTA EMAIL


-- ============================================
-- PASSO 2: Promuovi a SUPERADMIN
-- ============================================
UPDATE users 
SET 
  account_type = 'superadmin',  -- Tipo account (superadmin > admin > reseller > user)
  admin_level = 0,               -- Livello 0 = Superadmin root
  parent_admin_id = NULL,        -- Nessun parent (sei il top)
  role = 'admin',                -- Role per NextAuth
  updated_at = NOW()
WHERE email = 'TUA_EMAIL@example.com'; -- ⚠️ SOSTITUISCI QUESTA EMAIL


-- ============================================
-- PASSO 3: Verifica aggiornamento
-- ============================================
SELECT 
  email,
  name,
  role,
  account_type,
  admin_level,
  parent_admin_id,
  updated_at
FROM users
WHERE email = 'TUA_EMAIL@example.com'; -- ⚠️ SOSTITUISCI QUESTA EMAIL


-- ============================================
-- RISULTATO ATTESO:
-- ============================================
-- email: tua_email@example.com
-- role: admin
-- account_type: superadmin
-- admin_level: 0
-- parent_admin_id: NULL
