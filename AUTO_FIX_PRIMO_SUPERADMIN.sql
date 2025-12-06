/**
 * Script Auto-Fix: Promuovi Primo Utente a Superadmin
 * 
 * Questo script trova automaticamente il primo utente registrato
 * e lo promuove a Superadmin se non ha già permessi admin.
 * 
 * SICURO: Esegue solo se NON esistono già superadmin
 */

-- ============================================
-- VERIFICA: Esistono già superadmin?
-- ============================================
DO $$
DECLARE
  superadmin_count INTEGER;
  first_user_email TEXT;
BEGIN
  -- Conta superadmin esistenti
  SELECT COUNT(*) INTO superadmin_count
  FROM users
  WHERE account_type = 'superadmin' OR admin_level = 0;
  
  RAISE NOTICE 'Superadmin esistenti: %', superadmin_count;
  
  IF superadmin_count = 0 THEN
    -- Nessun superadmin, trova il primo utente
    SELECT email INTO first_user_email
    FROM users
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF first_user_email IS NOT NULL THEN
      RAISE NOTICE '🔧 Promozione primo utente a Superadmin: %', first_user_email;
      
      -- Promuovi a superadmin
      UPDATE users 
      SET 
        account_type = 'superadmin',
        admin_level = 0,
        parent_admin_id = NULL,
        role = 'admin',
        updated_at = NOW()
      WHERE email = first_user_email;
      
      RAISE NOTICE '✅ Utente % promosso a Superadmin con successo!', first_user_email;
      
      -- Mostra risultato
      RAISE NOTICE '---';
      RAISE NOTICE 'Dettagli Superadmin:';
      RAISE NOTICE '  Email: %', first_user_email;
      RAISE NOTICE '  Account Type: superadmin';
      RAISE NOTICE '  Admin Level: 0';
      RAISE NOTICE '  Role: admin';
    ELSE
      RAISE NOTICE '⚠️ Nessun utente trovato nel database';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️ Esistono già % superadmin. Nessuna azione necessaria.', superadmin_count;
  END IF;
END $$;


-- ============================================
-- VERIFICA FINALE: Mostra tutti i superadmin
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
WHERE account_type = 'superadmin' OR admin_level = 0
ORDER BY created_at ASC;
