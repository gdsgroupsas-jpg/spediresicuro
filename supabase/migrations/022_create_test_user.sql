-- ============================================
-- Script SQL: Crea Utente di Test per E2E
-- ============================================
-- Questo script crea un utente di test per i test E2E Playwright
-- 
-- Credenziali:
--   Email: test@example.com
--   Password: testpassword123
-- 
-- Esegui questo script in Supabase Dashboard → SQL Editor
-- ============================================

-- Verifica se l'utente di test esiste già
DO $$
DECLARE
  test_user_exists BOOLEAN;
  hashed_password TEXT;
BEGIN
  -- Hash bcrypt per "testpassword123" (generato con bcryptjs, 10 rounds)
  -- Hash valido: $2b$10$nHjMcfIYcbk65eOO0bvN/usawysuE2i.WtviSigviWnou5yF9bgpq
  -- Per rigenerare: node -e "const bc=require('bcryptjs');console.log(bc.hashSync('testpassword123',10))"
  hashed_password := '$2b$10$nHjMcfIYcbk65eOO0bvN/usawysuE2i.WtviSigviWnou5yF9bgpq';
  
  -- Verifica se l'utente esiste
  SELECT EXISTS(SELECT 1 FROM users WHERE email = 'test@example.com') INTO test_user_exists;
  
  IF test_user_exists THEN
    -- Aggiorna l'utente esistente (in caso di re-esecuzione)
    RAISE NOTICE 'Utente test@example.com esiste già. Aggiornamento password...';
    
    UPDATE users
    SET 
      password = hashed_password,
      name = 'Test User E2E',
      role = 'user',
      provider = 'credentials',
      updated_at = NOW()
    WHERE email = 'test@example.com';
    
    RAISE NOTICE '✅ Utente test@example.com aggiornato con successo!';
  ELSE
    -- Crea nuovo utente di test
    RAISE NOTICE 'Creazione nuovo utente di test...';
    
    INSERT INTO users (
      email,
      password,
      name,
      role,
      provider,
      account_type,
      is_reseller,
      wallet_balance,
      created_at,
      updated_at
    ) VALUES (
      'test@example.com',
      hashed_password,
      'Test User E2E',
      'user',
      'credentials',
      'user',
      false,
      0.00,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE '✅ Utente test@example.com creato con successo!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '📋 Credenziali utente di test:';
  RAISE NOTICE '   Email: test@example.com';
  RAISE NOTICE '   Password: testpassword123';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ IMPORTANTE: Questo utente è solo per test E2E!';
  RAISE NOTICE '   Non usare in produzione.';
  
END $$;

-- Verifica che l'utente sia stato creato correttamente
SELECT 
  id,
  email,
  name,
  role,
  provider,
  account_type,
  created_at
FROM users
WHERE email = 'test@example.com';

