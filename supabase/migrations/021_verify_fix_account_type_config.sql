/**
 * Migration: Verifica e Fix Configurazioni account_type
 * 
 * Questo script:
 * 1. Verifica che l'ENUM account_type esista (crea se mancante)
 * 2. Verifica che la colonna account_type esista nella tabella users (crea se mancante)
 * 3. Verifica che la colonna admin_level esista (crea se mancante)
 * 4. Fixa account_type NULL o non impostato
 * 5. Corregge inconsistenze tra role e account_type
 * 6. Assicura che i superadmin abbiano admin_level = 0
 * 7. Valida che admin_level sia nel range 0-5
 * 8. Crea indici per performance
 * 9. Genera report statistiche finale
 * 
 * Data: 6 Dicembre 2025
 * Creato: 6 Dicembre 2025 - 22:30
 * 
 * ISTRUZIONI:
 * 1. Copia tutto il contenuto di questo file
 * 2. Vai su Supabase Dashboard → SQL Editor
 * 3. Incolla lo script
 * 4. Clicca "Run" o premi F5
 * 5. Controlla il report finale nella console
 */

-- ============================================
-- STEP 1: Verifica e crea ENUM account_type
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
    CREATE TYPE account_type AS ENUM ('user', 'admin', 'superadmin');
    RAISE NOTICE '✅ Creato ENUM: account_type';
  ELSE
    RAISE NOTICE '✅ ENUM account_type già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 2: Verifica e aggiungi colonna account_type
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'users' 
      AND column_name = 'account_type'
  ) THEN
    ALTER TABLE public.users ADD COLUMN account_type account_type DEFAULT 'user';
    COMMENT ON COLUMN public.users.account_type IS 'Tipo account: user (base), admin (avanzato), superadmin (gestione completa)';
    RAISE NOTICE '✅ Aggiunta colonna: account_type';
  ELSE
    RAISE NOTICE '✅ Colonna account_type già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 3: Verifica e aggiungi colonna admin_level
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'users' 
      AND column_name = 'admin_level'
  ) THEN
    ALTER TABLE public.users ADD COLUMN admin_level INTEGER DEFAULT 0;
    COMMENT ON COLUMN public.users.admin_level IS 'Livello nella gerarchia: 0=superadmin, 1-5=admin normali (max 5 livelli)';
    RAISE NOTICE '✅ Aggiunta colonna: admin_level';
  ELSE
    RAISE NOTICE '✅ Colonna admin_level già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 4: Fix account_type NULL o non impostato
-- ============================================

DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Imposta account_type per utenti che non lo hanno
  UPDATE public.users 
  SET account_type = CASE 
    WHEN role = 'admin' THEN 'admin'::account_type
    ELSE 'user'::account_type
  END
  WHERE account_type IS NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count > 0 THEN
    RAISE NOTICE '✅ Aggiornati % utenti con account_type NULL', v_updated_count;
  ELSE
    RAISE NOTICE '✅ Nessun utente con account_type NULL trovato';
  END IF;
END $$;

-- ============================================
-- STEP 5: Fix inconsistenze role vs account_type
-- ============================================

DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Se role='admin' ma account_type='user', aggiorna a 'admin'
  UPDATE public.users 
  SET account_type = 'admin'::account_type
  WHERE role = 'admin' 
    AND account_type = 'user';
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count > 0 THEN
    RAISE NOTICE '✅ Corretti % utenti: role=admin ma account_type=user', v_updated_count;
  END IF;
  
  -- Se role!='admin' ma account_type='admin' o 'superadmin', 
  -- aggiorna role per compatibilità
  UPDATE public.users 
  SET role = 'admin'::user_role
  WHERE account_type IN ('admin', 'superadmin')
    AND role != 'admin';
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count > 0 THEN
    RAISE NOTICE '✅ Aggiornati % utenti: account_type=admin/superadmin ma role!=admin', v_updated_count;
  END IF;
END $$;

-- ============================================
-- STEP 6: Fix admin_level per superadmin
-- ============================================

DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Assicura che tutti i superadmin abbiano admin_level = 0
  UPDATE public.users 
  SET admin_level = 0
  WHERE account_type = 'superadmin' 
    AND admin_level != 0;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count > 0 THEN
    RAISE NOTICE '✅ Corretti % superadmin: admin_level impostato a 0', v_updated_count;
  ELSE
    RAISE NOTICE '✅ Tutti i superadmin hanno già admin_level = 0';
  END IF;
END $$;

-- ============================================
-- STEP 7: Assicura che admin_level sia valido (0-5)
-- ============================================

DO $$
DECLARE
  v_fixed_count INTEGER;
BEGIN
  -- Fix admin_level fuori range
  UPDATE public.users 
  SET admin_level = CASE
    WHEN admin_level < 0 THEN 0
    WHEN admin_level > 5 THEN 5
    ELSE admin_level
  END
  WHERE admin_level < 0 OR admin_level > 5;
  
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  
  IF v_fixed_count > 0 THEN
    RAISE NOTICE '✅ Corretti % utenti: admin_level fuori range (0-5)', v_fixed_count;
  ELSE
    RAISE NOTICE '✅ Tutti gli admin_level sono nel range valido (0-5)';
  END IF;
END $$;

-- ============================================
-- STEP 8: Verifica e crea indici per performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_account_type 
ON public.users(account_type) 
WHERE account_type IN ('admin', 'superadmin');

CREATE INDEX IF NOT EXISTS idx_users_admin_level 
ON public.users(admin_level) 
WHERE admin_level > 0;

DO $$
BEGIN
  RAISE NOTICE '✅ Indici creati/verificati';
END $$;

-- ============================================
-- STEP 9: Report finale con statistiche
-- ============================================

DO $$
DECLARE
  v_total_users INTEGER;
  v_superadmin_count INTEGER;
  v_admin_count INTEGER;
  v_user_count INTEGER;
  v_null_account_type INTEGER;
  v_users_list TEXT;
BEGIN
  -- Conta utenti totali
  SELECT COUNT(*) INTO v_total_users FROM public.users;
  
  -- Conta per tipo account
  SELECT COUNT(*) INTO v_superadmin_count 
  FROM public.users 
  WHERE account_type = 'superadmin';
  
  SELECT COUNT(*) INTO v_admin_count 
  FROM public.users 
  WHERE account_type = 'admin';
  
  SELECT COUNT(*) INTO v_user_count 
  FROM public.users 
  WHERE account_type = 'user';
  
  SELECT COUNT(*) INTO v_null_account_type 
  FROM public.users 
  WHERE account_type IS NULL;
  
  -- Lista superadmin
  SELECT string_agg(email, ', ') INTO v_users_list
  FROM public.users 
  WHERE account_type = 'superadmin';
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 REPORT FINALE VERIFICA ACCOUNT_TYPE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Totale utenti: %', v_total_users;
  RAISE NOTICE 'Superadmin: %', v_superadmin_count;
  RAISE NOTICE 'Admin: %', v_admin_count;
  RAISE NOTICE 'User: %', v_user_count;
  RAISE NOTICE 'Account Type NULL: %', v_null_account_type;
  RAISE NOTICE '========================================';
  
  IF v_users_list IS NOT NULL THEN
    RAISE NOTICE 'Superadmin trovati: %', v_users_list;
  END IF;
  
  IF v_null_account_type > 0 THEN
    RAISE WARNING '⚠️ ATTENZIONE: Trovati % utenti con account_type NULL', v_null_account_type;
  END IF;
  
  IF v_superadmin_count = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ ATTENZIONE: Nessun superadmin trovato!';
    RAISE NOTICE '';
    RAISE NOTICE 'Per promuovere un utente a superadmin, esegui:';
    RAISE NOTICE 'UPDATE users SET account_type = ''superadmin'', admin_level = 0, role = ''admin'' WHERE email = ''TUA_EMAIL_QUI'';';
    RAISE NOTICE '';
  END IF;
END $$;

-- ============================================
-- STEP 10: Verifica struttura finale
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION COMPLETATA CON SUCCESSO';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Verifiche completate:';
  RAISE NOTICE '  ✅ ENUM account_type verificato/creato';
  RAISE NOTICE '  ✅ Colonna account_type verificata/creata';
  RAISE NOTICE '  ✅ Colonna admin_level verificata/creata';
  RAISE NOTICE '  ✅ Account_type NULL fixati';
  RAISE NOTICE '  ✅ Inconsistenze role vs account_type corrette';
  RAISE NOTICE '  ✅ Admin_level per superadmin verificato';
  RAISE NOTICE '  ✅ Admin_level validato (range 0-5)';
  RAISE NOTICE '  ✅ Indici creati per performance';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Controlla il report sopra per statistiche dettagliate';
  RAISE NOTICE '';
END $$;

-- ============================================
-- FINE SCRIPT
-- ============================================
