/**
 * Setup Superadmin Iniziali - Salvatore Squillante
 * 
 * Promuove le 4 email principali a Superadmin:
 * - sigorn@hotmail.it
 * - gdsgroupsas@gmail.com
 * - admin@spediresicuro.it
 * - salvatore.squillante@gmail.com
 * 
 * ESEGUI SU: Supabase Dashboard → SQL Editor
 */

-- ============================================
-- PROMUOVI TUTTE LE EMAIL A SUPERADMIN
-- ============================================

-- 1. sigorn@hotmail.it
UPDATE users 
SET 
  account_type = 'superadmin',
  admin_level = 0,
  parent_admin_id = NULL,
  role = 'admin',
  updated_at = NOW()
WHERE email = 'sigorn@hotmail.it';

-- 2. gdsgroupsas@gmail.com
UPDATE users 
SET 
  account_type = 'superadmin',
  admin_level = 0,
  parent_admin_id = NULL,
  role = 'admin',
  updated_at = NOW()
WHERE email = 'gdsgroupsas@gmail.com';

-- 3. admin@spediresicuro.it
UPDATE users 
SET 
  account_type = 'superadmin',
  admin_level = 0,
  parent_admin_id = NULL,
  role = 'admin',
  updated_at = NOW()
WHERE email = 'admin@spediresicuro.it';

-- 4. salvatore.squillante@gmail.com
UPDATE users 
SET 
  account_type = 'superadmin',
  admin_level = 0,
  parent_admin_id = NULL,
  role = 'admin',
  updated_at = NOW()
WHERE email = 'salvatore.squillante@gmail.com';


-- ============================================
-- CREA UTENTI SE NON ESISTONO
-- ============================================
-- Se qualche email non esiste ancora, creala

INSERT INTO users (
  email,
  name,
  role,
  account_type,
  admin_level,
  parent_admin_id,
  provider,
  password,
  created_at,
  updated_at
)
SELECT 
  email_value,
  name_value,
  'admin',
  'superadmin',
  0,
  NULL,
  'credentials',
  'admin123', -- ⚠️ Password temporanea, cambiala al primo accesso
  NOW(),
  NOW()
FROM (
  VALUES 
    ('sigorn@hotmail.it', 'Salvatore Squillante'),
    ('gdsgroupsas@gmail.com', 'GDS Group SAS'),
    ('admin@spediresicuro.it', 'Admin SpedireSecuro'),
    ('salvatore.squillante@gmail.com', 'Salvatore Squillante')
) AS temp(email_value, name_value)
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = temp.email_value
);


-- ============================================
-- VERIFICA FINALE: Mostra tutti i Superadmin
-- ============================================
SELECT 
  email,
  name,
  account_type,
  admin_level,
  role,
  provider,
  created_at
FROM users
WHERE email IN (
  'sigorn@hotmail.it',
  'gdsgroupsas@gmail.com',
  'admin@spediresicuro.it',
  'salvatore.squillante@gmail.com'
)
ORDER BY email;


-- ============================================
-- CONTEGGIO FINALE
-- ============================================
SELECT 
  '✅ SETUP COMPLETATO' as status,
  COUNT(*) as superadmin_count
FROM users
WHERE account_type = 'superadmin'
  AND email IN (
    'sigorn@hotmail.it',
    'gdsgroupsas@gmail.com',
    'admin@spediresicuro.it',
    'salvatore.squillante@gmail.com'
  );


-- ============================================
-- NOTE IMPORTANTI
-- ============================================
-- 
-- ✅ Dopo l'esecuzione:
-- 1. Fai LOGOUT da SpedireSecuro
-- 2. Fai LOGIN con una delle 4 email
-- 3. Avrai accesso completo a:
--    - Dashboard Admin
--    - Team Management
--    - Gestione Utenti
--    - Configurazioni Sistema
-- 
-- 🔒 Sicurezza:
-- - Se hai creato nuovi utenti, CAMBIA le password al primo accesso
-- - Usa password forti per gli account superadmin
-- 
-- 👥 Gestione Team:
-- - Vai su /dashboard/team per invitare collaboratori
-- - Potrai assegnare livelli admin personalizzati
-- - Gerarchia: superadmin (livello 0) > admin (livello 1,2,3...)
