-- ============================================
-- Migration: Integration Hub Schema Extension
-- 
-- Estende courier_configs per supportare:
-- - Status/health check
-- - BYOC (Bring Your Own Carrier)
-- - Reseller multi-account
-- - Test credenziali
-- 
-- ⚠️ ZERO DOWNTIME: Tutte le colonne sono nullable/default per backward compatibility
-- ============================================

-- STEP 1: Aggiungi colonne status e health check
DO $$
BEGIN
  -- Status: 'active', 'error', 'testing', 'inactive'
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.courier_configs 
    ADD COLUMN status TEXT DEFAULT 'active';
    
    -- Aggiungi constraint dopo che la colonna esiste
    ALTER TABLE public.courier_configs
    ADD CONSTRAINT check_status 
      CHECK (status IN ('active', 'error', 'testing', 'inactive'));
    
    RAISE NOTICE '✅ Colonna status aggiunta a courier_configs';
  ELSE
    RAISE NOTICE '⚠️ Colonna status già esistente';
  END IF;

  -- Last tested timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs' 
    AND column_name = 'last_tested_at'
  ) THEN
    ALTER TABLE public.courier_configs 
    ADD COLUMN last_tested_at TIMESTAMPTZ;
    RAISE NOTICE '✅ Colonna last_tested_at aggiunta a courier_configs';
  ELSE
    RAISE NOTICE '⚠️ Colonna last_tested_at già esistente';
  END IF;

  -- Test result (JSONB)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs' 
    AND column_name = 'test_result'
  ) THEN
    ALTER TABLE public.courier_configs 
    ADD COLUMN test_result JSONB DEFAULT '{}'::JSONB;
    RAISE NOTICE '✅ Colonna test_result aggiunta a courier_configs';
  ELSE
    RAISE NOTICE '⚠️ Colonna test_result già esistente';
  END IF;
END $$;

-- STEP 2: Aggiungi colonne multi-tenant (BYOC + Reseller)
DO $$
BEGIN
  -- Account type: 'admin', 'byoc', 'reseller'
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs' 
    AND column_name = 'account_type'
  ) THEN
    ALTER TABLE public.courier_configs 
    ADD COLUMN account_type TEXT DEFAULT 'admin';
    
    -- Aggiungi constraint dopo che la colonna esiste
    ALTER TABLE public.courier_configs
    ADD CONSTRAINT check_account_type 
      CHECK (account_type IN ('admin', 'byoc', 'reseller'));
    
    RAISE NOTICE '✅ Colonna account_type aggiunta a courier_configs';
  ELSE
    RAISE NOTICE '⚠️ Colonna account_type già esistente';
  END IF;

  -- Owner user ID (per BYOC/reseller)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs' 
    AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE public.courier_configs 
    ADD COLUMN owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Colonna owner_user_id aggiunta a courier_configs';
  ELSE
    RAISE NOTICE '⚠️ Colonna owner_user_id già esistente';
  END IF;
END $$;

-- STEP 3: Aggiungi colonne automation (se non già presenti da migration 015)
DO $$
BEGIN
  -- automation_encrypted flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs' 
    AND column_name = 'automation_encrypted'
  ) THEN
    ALTER TABLE public.courier_configs 
    ADD COLUMN automation_encrypted BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Colonna automation_encrypted aggiunta a courier_configs';
  ELSE
    RAISE NOTICE '⚠️ Colonna automation_encrypted già esistente';
  END IF;

  -- last_automation_sync (se non presente)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs' 
    AND column_name = 'last_automation_sync'
  ) THEN
    ALTER TABLE public.courier_configs 
    ADD COLUMN last_automation_sync TIMESTAMPTZ;
    RAISE NOTICE '✅ Colonna last_automation_sync aggiunta a courier_configs';
  ELSE
    RAISE NOTICE '⚠️ Colonna last_automation_sync già esistente';
  END IF;
END $$;

-- STEP 4: Migra dati esistenti
DO $$
BEGIN
  -- Migra status da is_active
  UPDATE public.courier_configs
  SET status = CASE 
    WHEN is_active = false THEN 'inactive'
    ELSE 'active'
  END
  WHERE status IS NULL OR status = 'active';

  -- Migra account_type da created_by
  UPDATE public.courier_configs
  SET account_type = CASE
    WHEN created_by IS NOT NULL 
      AND created_by != 'system' 
      AND created_by != ''
    THEN 'byoc'
    ELSE 'admin'
  END
  WHERE account_type IS NULL OR account_type = 'admin';

  -- Migra owner_user_id da created_by (se possibile)
  UPDATE public.courier_configs cc
  SET owner_user_id = u.id
  FROM users u
  WHERE cc.created_by = u.email
    AND cc.owner_user_id IS NULL
    AND cc.account_type = 'byoc';

  RAISE NOTICE '✅ Dati esistenti migrati';
END $$;

-- STEP 5: Indici per performance
CREATE INDEX IF NOT EXISTS idx_carrier_configs_status 
  ON public.courier_configs(status) 
  WHERE status IN ('error', 'testing');

CREATE INDEX IF NOT EXISTS idx_carrier_configs_account_type 
  ON public.courier_configs(account_type);

CREATE INDEX IF NOT EXISTS idx_carrier_configs_owner 
  ON public.courier_configs(owner_user_id) 
  WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_carrier_configs_provider_status 
  ON public.courier_configs(provider_id, status) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_carrier_configs_test_result 
  ON public.courier_configs USING GIN(test_result) 
  WHERE test_result IS NOT NULL;

-- STEP 6: Commenti per documentazione
COMMENT ON COLUMN public.courier_configs.status IS 
  'Stato configurazione: active (funzionante), error (errore credenziali), testing (in test), inactive (disattivata)';

COMMENT ON COLUMN public.courier_configs.last_tested_at IS 
  'Timestamp ultimo test credenziali';

COMMENT ON COLUMN public.courier_configs.test_result IS 
  'Risultato ultimo test: { success: boolean, error?: string, tested_at: string }';

COMMENT ON COLUMN public.courier_configs.account_type IS 
  'Tipo account: admin (configurazione admin), byoc (Bring Your Own Carrier - utente), reseller (reseller)';

COMMENT ON COLUMN public.courier_configs.owner_user_id IS 
  'ID utente proprietario (per BYOC/reseller). NULL per configurazioni admin.';

-- STEP 7: Verifica finale
DO $$
DECLARE
  v_status_exists BOOLEAN;
  v_account_type_exists BOOLEAN;
  v_owner_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs' 
    AND column_name = 'status'
  ) INTO v_status_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs' 
    AND column_name = 'account_type'
  ) INTO v_account_type_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs' 
    AND column_name = 'owner_user_id'
  ) INTO v_owner_exists;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration Integration Hub Schema';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Status column: %', CASE WHEN v_status_exists THEN '✅ Presente' ELSE '❌ Mancante' END;
  RAISE NOTICE 'Account type column: %', CASE WHEN v_account_type_exists THEN '✅ Presente' ELSE '❌ Mancante' END;
  RAISE NOTICE 'Owner user_id column: %', CASE WHEN v_owner_exists THEN '✅ Presente' ELSE '❌ Mancante' END;
  RAISE NOTICE '========================================';
END $$;
