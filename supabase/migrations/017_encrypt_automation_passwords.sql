/**
 * Migration: 017 - Criptazione Password Automation
 * 
 * ⚠️ CRITICO: Questa migration aggiunge supporto per criptazione
 * delle password in automation_settings.
 * 
 * Le password Spedisci.Online e IMAP verranno criptate usando AES-256-GCM
 * prima di essere salvate nel database.
 */

-- ============================================
-- STEP 1: Aggiungi colonna per tracciare criptazione
-- ============================================

DO $$
BEGIN
  -- Aggiungi colonna per sapere se automation_settings è criptato
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs' 
    AND column_name = 'automation_encrypted'
  ) THEN
    ALTER TABLE public.courier_configs 
    ADD COLUMN automation_encrypted BOOLEAN DEFAULT false;
    
    RAISE NOTICE '✅ Colonna automation_encrypted aggiunta';
  END IF;
END $$;

-- ============================================
-- STEP 2: Commenti per documentazione
-- ============================================

COMMENT ON COLUMN public.courier_configs.automation_encrypted IS 
  'Se true, automation_settings contiene password criptate. 
   Le password devono essere decriptate usando ENCRYPTION_KEY prima dell''uso.';

-- ============================================
-- STEP 3: Funzione per verificare se password sono criptate
-- ============================================

CREATE OR REPLACE FUNCTION is_automation_encrypted(p_config_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_encrypted BOOLEAN;
BEGIN
  SELECT automation_encrypted INTO v_encrypted
  FROM courier_configs
  WHERE id = p_config_id;
  
  RETURN COALESCE(v_encrypted, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- RIEPILOGO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 017 completata:';
  RAISE NOTICE '  - Aggiunta colonna automation_encrypted';
  RAISE NOTICE '  - Le password in automation_settings devono essere criptate lato applicazione';
  RAISE NOTICE '  - Usa encryptCredential() prima di salvare';
  RAISE NOTICE '  - Usa decryptCredential() quando leggi';
END $$;

