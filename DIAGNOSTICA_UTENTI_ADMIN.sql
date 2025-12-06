/**
 * Script Diagnostico: Verifica Utenti Admin
 * 
 * Esegui questo script su Supabase Dashboard → SQL Editor
 * per vedere tutti gli utenti e il loro livello di accesso
 */

-- ============================================
-- TUTTI GLI UTENTI CON I LORO PERMESSI
-- ============================================
SELECT 
  id,
  email,
  name,
  role,
  account_type,
  admin_level,
  parent_admin_id,
  provider,
  created_at,
  updated_at
FROM users
ORDER BY 
  CASE 
    WHEN account_type = 'superadmin' THEN 1
    WHEN account_type = 'admin' THEN 2
    WHEN account_type = 'reseller' THEN 3
    ELSE 4
  END,
  admin_level ASC,
  created_at DESC;


-- ============================================
-- SOLO ADMIN E SUPERADMIN
-- ============================================
SELECT 
  email,
  name,
  role,
  account_type,
  admin_level,
  parent_admin_id
FROM users
WHERE account_type IN ('admin', 'superadmin')
   OR role = 'admin'
ORDER BY admin_level ASC;


-- ============================================
-- CONTEGGIO PER TIPO ACCOUNT
-- ============================================
SELECT 
  account_type,
  COUNT(*) as count
FROM users
GROUP BY account_type
ORDER BY count DESC;


-- ============================================
-- UTENTI CON PROVIDER OAUTH
-- ============================================
SELECT 
  email,
  name,
  provider,
  account_type,
  role
FROM users
WHERE provider IN ('google', 'github')
ORDER BY created_at DESC;
