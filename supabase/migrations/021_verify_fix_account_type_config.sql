/**
 * Migration: Verifica e Fix Configurazioni account_type
 * 
 * Questo script:
 * 1. Verifica che l'ENUM account_type esista
 * 2. Verifica che la colonna account_type esista nella tabella users
 * 3. Fixa inconsistenze tra role e account_type
 * 4. Assicura che gli admin con role='admin' abbiano account_type corretto
 * 5. Assicura che i superadmin abbiano admin_level = 0
 * 
 * Data: Dicembre 2024
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
  -- lascia account_type così com'è (può essere corretto)
  -- ma aggiorna role se necessario (per compatibilità)
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
-- STEP 8: Verifica e crea indici
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_account_type 
ON public.users(account_type) 
WHERE account_type IN ('admin', 'superadmin');

CREATE INDEX IF NOT EXISTS idx_users_admin_level 
ON public.users(admin_level) 
WHERE admin_level > 0;

-- ============================================
-- STEP 9: Report finale
-- ============================================

DO $$
DECLARE
  v_total_users INTEGER;
  v_superadmin_count INTEGER;
  v_admin_count INTEGER;
  v_user_count INTEGER;
  v_null_account_type INTEGER;
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
  
  IF v_null_account_type > 0 THEN
    RAISE WARNING '⚠️ ATTENZIONE: Trovati % utenti con account_type NULL', v_null_account_type;
  END IF;
  
  IF v_superadmin_count = 0 THEN
    RAISE NOTICE '⚠️ ATTENZIONE: Nessun superadmin trovato';
    RAISE NOTICE '   Per creare/promuovere un superadmin:';
    RAISE NOTICE '   UPDATE users SET account_type = ''superadmin'', admin_level = 0 WHERE email = ''EMAIL_SUPERADMIN'';';
  END IF;
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration completata: Verifica e Fix Configurazioni account_type';
  RAISE NOTICE '   - Verificato ENUM account_type';
  RAISE NOTICE '   - Verificata colonna account_type';
  RAISE NOTICE '   - Fixati account_type NULL';
  RAISE NOTICE '   - Corrette inconsistenze role vs account_type';
  RAISE NOTICE '   - Verificato admin_level per superadmin';
  RAISE NOTICE '   - Creati indici per performance';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Controlla il report sopra per statistiche';
END $$;

