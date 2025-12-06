/**
 * Script Helper: Crea/Promuovi Superadmin
 * 
 * Questo script permette di creare o promuovere un utente a superadmin.
 * 
 * ⚠️ IMPORTANTE: Esegui questo script DOPO la migration 008_admin_user_system.sql
 * 
 * Istruzioni:
 * 1. Sostituisci 'admin@spediresicuro.it' con l'email del superadmin desiderato
 * 2. Esegui lo script in Supabase Dashboard → SQL Editor
 * 3. Verifica che il superadmin sia stato creato correttamente
 */

-- ============================================
-- OPZIONE 1: Promuovi Admin Esistente a Superadmin
-- ============================================

-- Sostituisci l'email con quella del tuo admin
UPDATE users 
SET 
  account_type = 'superadmin',
  admin_level = 0,
  parent_admin_id = NULL,
  role = 'admin',
  updated_at = NOW()
WHERE email = 'admin@spediresicuro.it'; -- ⚠️ CAMBIA QUESTA EMAIL

-- Verifica che sia stato aggiornato
SELECT 
  email,
  name,
  account_type,
  admin_level,
  parent_admin_id,
  role
FROM users
WHERE email = 'admin@spediresicuro.it'; -- ⚠️ CAMBIA QUESTA EMAIL

-- ============================================
-- OPZIONE 2: Crea Nuovo Superadmin (se non esiste)
-- ============================================

-- ⚠️ CAMBIA QUESTI VALORI con i dati del tuo superadmin
INSERT INTO users (
  email,
  name,
  role,
  account_type,
  admin_level,
  parent_admin_id,
  provider,
  created_at,
  updated_at
) VALUES (
  'superadmin@spediresicuro.it',  -- ⚠️ CAMBIA EMAIL
  'Super Admin',                    -- ⚠️ CAMBIA NOME
  'admin',
  'superadmin',
  0,
  NULL,
  'credentials',
  NOW(),
  NOW()
) 
ON CONFLICT (email) DO UPDATE 
SET 
  account_type = 'superadmin',
  admin_level = 0,
  parent_admin_id = NULL,
  role = 'admin',
  updated_at = NOW()
RETURNING *;

-- ============================================
-- Verifica Superadmin
-- ============================================

-- Mostra tutti i superadmin
SELECT 
  id,
  email,
  name,
  account_type,
  admin_level,
  parent_admin_id,
  role,
  created_at
FROM users
WHERE account_type = 'superadmin'
ORDER BY created_at DESC;

-- ============================================
-- Nota
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Script completato!';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ IMPORTANTE:';
  RAISE NOTICE '   - Verifica che il superadmin sia stato creato/aggiornato';
  RAISE NOTICE '   - Il superadmin può ora gestire tutti gli utenti e admin';
  RAISE NOTICE '   - Usa l''email del superadmin per accedere e gestire la piattaforma';
END $$;





