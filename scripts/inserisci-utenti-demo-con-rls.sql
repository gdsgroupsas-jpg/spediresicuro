-- ============================================
-- Script SQL per Inserire Utenti Demo (con RLS)
-- ============================================
-- Questo script gestisce correttamente RLS se abilitato
-- Esegui questo script in Supabase Dashboard → SQL Editor
-- ============================================

-- PASSO 1: Verifica se RLS è abilitato
DO $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = 'users';
  
  IF rls_enabled THEN
    RAISE NOTICE 'RLS è abilitato sulla tabella users';
    RAISE NOTICE 'Usando Service Role per bypassare RLS...';
  ELSE
    RAISE NOTICE 'RLS non è abilitato sulla tabella users';
  END IF;
END $$;

-- PASSO 2: Elimina utenti demo esistenti se presenti (per evitare duplicati)
-- Nota: Questo usa la Service Role che bypassa RLS
DELETE FROM users 
WHERE email IN ('admin@spediresicuro.it', 'demo@spediresicuro.it');

-- PASSO 3: Inserisci utente Admin
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

-- PASSO 4: Inserisci utente Demo
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

-- PASSO 5: Verifica che gli utenti siano stati creati
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

-- PASSO 6: Messaggio di conferma
DO $$
DECLARE
  admin_count INTEGER;
  demo_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM users WHERE email = 'admin@spediresicuro.it';
  SELECT COUNT(*) INTO demo_count FROM users WHERE email = 'demo@spediresicuro.it';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Utenti demo creati con successo!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Utente Admin: % (dovrebbe essere 1)', admin_count;
  RAISE NOTICE '  Email: admin@spediresicuro.it';
  RAISE NOTICE '  Password: admin123';
  RAISE NOTICE '  Ruolo: admin';
  RAISE NOTICE '';
  RAISE NOTICE 'Utente Demo: % (dovrebbe essere 1)', demo_count;
  RAISE NOTICE '  Email: demo@spediresicuro.it';
  RAISE NOTICE '  Password: demo123';
  RAISE NOTICE '  Ruolo: user';
  RAISE NOTICE '========================================';
  
  IF admin_count = 1 AND demo_count = 1 THEN
    RAISE NOTICE '✅ Tutti gli utenti demo sono stati creati correttamente!';
  ELSE
    RAISE WARNING '⚠️  Attenzione: alcuni utenti potrebbero non essere stati creati!';
  END IF;
END $$;


