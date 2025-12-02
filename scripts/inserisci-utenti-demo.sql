-- ============================================
-- Script SQL per Inserire Utenti Demo
-- ============================================
-- Esegui questo script DOPO aver creato la tabella users
-- ============================================

-- Elimina utenti demo esistenti se presenti (per evitare duplicati)
DELETE FROM users 
WHERE email IN ('admin@spediresicuro.it', 'demo@spediresicuro.it');

-- Inserisci utente Admin
INSERT INTO users (
  email,
  password,
  name,
  role,
  provider,
  created_at,
  updated_at
) VALUES (
  'admin@spediresicuro.it',
  'admin123',
  'Admin',
  'admin',
  'credentials',
  NOW(),
  NOW()
);

-- Inserisci utente Demo
INSERT INTO users (
  email,
  password,
  name,
  role,
  provider,
  created_at,
  updated_at
) VALUES (
  'demo@spediresicuro.it',
  'demo123',
  'Demo User',
  'user',
  'credentials',
  NOW(),
  NOW()
);

-- Verifica che gli utenti siano stati creati
SELECT 
  id,
  email,
  name,
  role,
  provider,
  created_at
FROM users
WHERE email IN ('admin@spediresicuro.it', 'demo@spediresicuro.it')
ORDER BY email;

-- Messaggio di conferma
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Utenti demo creati con successo!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Utente Admin:';
  RAISE NOTICE '  Email: admin@spediresicuro.it';
  RAISE NOTICE '  Password: admin123';
  RAISE NOTICE '  Ruolo: admin';
  RAISE NOTICE '';
  RAISE NOTICE 'Utente Demo:';
  RAISE NOTICE '  Email: demo@spediresicuro.it';
  RAISE NOTICE '  Password: demo123';
  RAISE NOTICE '  Ruolo: user';
  RAISE NOTICE '========================================';
END $$;


