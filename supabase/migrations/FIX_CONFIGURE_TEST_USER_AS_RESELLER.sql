-- ============================================
-- FIX: Configura account test come Reseller
-- Eseguire in Supabase SQL Editor
-- ============================================

-- NOTA: account_type enum ha valori: user, admin, superadmin, byoc
-- Il reseller è indicato dal campo is_reseller, NON da account_type

-- Trova e aggiorna l'utente test
UPDATE users
SET 
  is_reseller = true,
  reseller_role = 'admin'  -- Admin può eliminare listini
  -- account_type rimane invariato (user, admin, ecc.)
WHERE email = 'testspediresicuro+postaexpress@gmail.com';

-- Verifica aggiornamento
SELECT 
  id,
  email,
  name,
  account_type,
  is_reseller,
  reseller_role
FROM users
WHERE email = 'testspediresicuro+postaexpress@gmail.com';

-- Se l'utente non esiste, mostra messaggio
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count 
  FROM users 
  WHERE email = 'testspediresicuro+postaexpress@gmail.com';
  
  IF v_count = 0 THEN
    RAISE NOTICE '⚠️ Utente testspediresicuro+postaexpress@gmail.com non trovato!';
  ELSE
    RAISE NOTICE '✅ Utente configurato come Reseller Admin';
  END IF;
END
$$;
