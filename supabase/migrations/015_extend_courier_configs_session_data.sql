/**
 * Estensione Courier Configs - Session Data per Browser Emulation
 * 
 * Migration: 015 - Aggiunge supporto per session cookies e dati browser emulation
 * Description: Estende courier_configs per supportare automazione browser
 * 
 * ⚠️ IMPORTANTE: Questo sistema permette di salvare session cookies e dati
 * estratti automaticamente da agent automation per Spedisci.Online.
 * 
 * USO: Automazione del proprio account Spedisci.Online (legale se account proprio)
 */

-- ============================================
-- STEP 1: Aggiungi campo session_data JSONB
-- ============================================

DO $$
BEGIN
  -- Aggiungi colonna session_data se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs' 
    AND column_name = 'session_data'
  ) THEN
    ALTER TABLE public.courier_configs 
    ADD COLUMN session_data JSONB DEFAULT NULL;
    
    RAISE NOTICE '✅ Colonna session_data aggiunta a courier_configs';
  ELSE
    RAISE NOTICE '⚠️ Colonna session_data già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 2: Aggiungi campo automation_settings JSONB
-- ============================================

DO $$
BEGIN
  -- Aggiungi colonna automation_settings se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs' 
    AND column_name = 'automation_settings'
  ) THEN
    ALTER TABLE public.courier_configs 
    ADD COLUMN automation_settings JSONB DEFAULT NULL;
    
    RAISE NOTICE '✅ Colonna automation_settings aggiunta a courier_configs';
  ELSE
    RAISE NOTICE '⚠️ Colonna automation_settings già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 3: Aggiungi campo last_automation_sync
-- ============================================

DO $$
BEGIN
  -- Aggiungi colonna last_automation_sync se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs' 
    AND column_name = 'last_automation_sync'
  ) THEN
    ALTER TABLE public.courier_configs 
    ADD COLUMN last_automation_sync TIMESTAMPTZ DEFAULT NULL;
    
    RAISE NOTICE '✅ Colonna last_automation_sync aggiunta a courier_configs';
  ELSE
    RAISE NOTICE '⚠️ Colonna last_automation_sync già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 4: Aggiungi campo automation_enabled
-- ============================================

DO $$
BEGIN
  -- Aggiungi colonna automation_enabled se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs' 
    AND column_name = 'automation_enabled'
  ) THEN
    ALTER TABLE public.courier_configs 
    ADD COLUMN automation_enabled BOOLEAN DEFAULT false;
    
    RAISE NOTICE '✅ Colonna automation_enabled aggiunta a courier_configs';
  ELSE
    RAISE NOTICE '⚠️ Colonna automation_enabled già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 5: Commenti per documentazione
-- ============================================

COMMENT ON COLUMN public.courier_configs.session_data IS 
  'Dati sessione estratti automaticamente (cookie, CSRF token, etc).
   Formato JSONB: {
     "session_cookie": "stringa_cookie_lunghissima",
     "csrf_token": "token_csrf",
     "client_id_internal": "2667",
     "vector_contract_id": "77",
     "expires_at": "2025-12-04T10:00:00Z",
     "extracted_at": "2025-12-03T10:00:00Z"
   }';

COMMENT ON COLUMN public.courier_configs.automation_settings IS 
  'Impostazioni automazione agent.
   Formato JSONB: {
     "email_2fa": "email@example.com",
     "imap_server": "imap.gmail.com",
     "imap_port": 993,
     "imap_username": "email@example.com",
     "imap_password": "app_password",
     "spedisci_online_username": "username",
     "spedisci_online_password": "password",
     "auto_refresh_interval_hours": 24,
     "enabled": true
   }';

COMMENT ON COLUMN public.courier_configs.last_automation_sync IS 
  'Timestamp ultimo sync automatico eseguito dall''agent';

COMMENT ON COLUMN public.courier_configs.automation_enabled IS 
  'Se true, agent automation è attivo per questa configurazione';

-- ============================================
-- STEP 6: Indice per query automation
-- ============================================

CREATE INDEX IF NOT EXISTS idx_courier_configs_automation_enabled 
  ON public.courier_configs(automation_enabled) 
  WHERE automation_enabled = true;

CREATE INDEX IF NOT EXISTS idx_courier_configs_last_sync 
  ON public.courier_configs(last_automation_sync) 
  WHERE automation_enabled = true;

-- ============================================
-- STEP 7: Funzione helper per validazione session_data
-- ============================================

CREATE OR REPLACE FUNCTION validate_session_data(data JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verifica che session_data abbia struttura valida
  IF data IS NULL THEN
    RETURN true; -- NULL è valido (opzionale)
  END IF;
  
  -- Verifica che sia un oggetto JSON
  IF jsonb_typeof(data) != 'object' THEN
    RETURN false;
  END IF;
  
  -- Verifica campi obbligatori se presenti
  -- (session_cookie è obbligatorio se session_data è presente)
  IF data ? 'session_cookie' AND data->>'session_cookie' IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- STEP 8: Trigger per aggiornare updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_courier_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_courier_configs_updated_at ON public.courier_configs;

CREATE TRIGGER trigger_update_courier_configs_updated_at
  BEFORE UPDATE ON public.courier_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_courier_configs_updated_at();

-- ============================================
-- STEP 9: Funzione per ottenere config con session valida
-- ============================================

CREATE OR REPLACE FUNCTION get_courier_config_with_valid_session(
  p_provider_id TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  provider_id TEXT,
  api_key TEXT,
  base_url TEXT,
  contract_mapping JSONB,
  session_data JSONB,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.id,
    cc.name,
    cc.provider_id,
    cc.api_key,
    cc.base_url,
    cc.contract_mapping,
    cc.session_data,
    cc.is_active
  FROM public.courier_configs cc
  WHERE cc.provider_id = p_provider_id
    AND cc.is_active = true
    AND (
      -- Se session_data esiste, verifica che non sia scaduto
      cc.session_data IS NULL 
      OR (
        cc.session_data->>'expires_at' IS NULL 
        OR (cc.session_data->>'expires_at')::TIMESTAMPTZ > NOW()
      )
    )
  ORDER BY 
    -- Priorità: config assegnata all'utente
    CASE WHEN EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = p_user_id 
      AND u.assigned_config_id = cc.id
    ) THEN 0 ELSE 1 END,
    -- Poi: config default
    CASE WHEN cc.is_default THEN 0 ELSE 1 END
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- RIEPILOGO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 015 completata:';
  RAISE NOTICE '  - Aggiunto campo session_data (JSONB) per cookie e CSRF token';
  RAISE NOTICE '  - Aggiunto campo automation_settings (JSONB) per impostazioni agent';
  RAISE NOTICE '  - Aggiunto campo last_automation_sync (TIMESTAMPTZ) per tracking';
  RAISE NOTICE '  - Aggiunto campo automation_enabled (BOOLEAN) per abilitazione';
  RAISE NOTICE '  - Creati indici per performance';
  RAISE NOTICE '  - Creata funzione get_courier_config_with_valid_session()';
END $$;

