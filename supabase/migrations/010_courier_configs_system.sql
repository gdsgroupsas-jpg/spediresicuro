/**
 * Courier Configs System - Database-Backed API Credentials
 * 
 * Migration: 010 - Sistema Multi-Tenant per Gestione Dinamica API Corrieri
 * Description: Abbandona dipendenza da variabili d'ambiente, gestione configurazioni nel DB
 * 
 * ⚠️ IMPORTANTE: Questa migration crea un sistema completo per gestire
 * configurazioni API corrieri in modo dinamico, permettendo al Superadmin
 * di assegnare diverse configurazioni a utenti specifici.
 */

-- ============================================
-- STEP 1: Crea Tabella courier_configs
-- ============================================

CREATE TABLE IF NOT EXISTS public.courier_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificazione
  name TEXT NOT NULL, -- Es: "Account Standard", "Account VIP", "Account Dropshipping"
  provider_id TEXT NOT NULL, -- Es: 'spedisci_online', 'gls', 'brt', etc.
  
  -- Credenziali API
  api_key TEXT NOT NULL, -- Chiave API segreta (crittografare in produzione)
  api_secret TEXT, -- Secret opzionale (se richiesto dal provider)
  base_url TEXT NOT NULL, -- Es: 'https://ecommerceitalia.spedisci.online/api/v2'
  
  -- Configurazione Contratti
  contract_mapping JSONB DEFAULT '{}', -- Mappa dinamica servizi/contratti
  -- Esempio: { "poste": "CODE123", "gls": "CODE456", "brt": "CODE789" }
  
  -- Stato e Priorità
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Se true, usata come fallback per utenti senza assegnazione
  
  -- Metadata
  description TEXT, -- Descrizione opzionale della configurazione
  notes TEXT, -- Note interne per admin
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT, -- Email dell'admin che ha creato la configurazione
  
  -- Vincoli
  CONSTRAINT valid_contract_mapping CHECK (jsonb_typeof(contract_mapping) = 'object')
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_courier_configs_provider ON public.courier_configs(provider_id);
CREATE INDEX IF NOT EXISTS idx_courier_configs_active ON public.courier_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_courier_configs_default ON public.courier_configs(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_courier_configs_provider_active ON public.courier_configs(provider_id, is_active);

-- Unique index parziale: solo una config default per provider
-- Questo garantisce che per ogni provider_id ci sia al massimo una configurazione con is_default = true
CREATE UNIQUE INDEX IF NOT EXISTS idx_courier_configs_unique_default 
  ON public.courier_configs(provider_id) 
  WHERE is_default = true;

-- Commenti per documentazione
COMMENT ON TABLE public.courier_configs IS 
  'Configurazioni API corrieri gestite dinamicamente dal Superadmin. 
   Sostituisce le variabili d''ambiente statiche.';
COMMENT ON COLUMN public.courier_configs.name IS 
  'Nome descrittivo della configurazione (es. "Account Standard")';
COMMENT ON COLUMN public.courier_configs.provider_id IS 
  'Identificativo del provider (es. "spedisci_online", "gls", "brt")';
COMMENT ON COLUMN public.courier_configs.api_key IS 
  'Chiave API segreta. ⚠️ In produzione, considerare crittografia campo';
COMMENT ON COLUMN public.courier_configs.contract_mapping IS 
  'Mappa JSONB dei contratti per servizio: {"poste": "CODE123", "gls": "CODE456"}';
COMMENT ON COLUMN public.courier_configs.is_default IS 
  'Se true, usata come fallback per utenti senza assigned_config_id';

-- ============================================
-- STEP 2: Aggiorna Tabella users
-- ============================================

-- Aggiungi colonna assigned_config_id se non esiste
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'assigned_config_id'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN assigned_config_id UUID REFERENCES public.courier_configs(id) ON DELETE SET NULL;
    
    -- Indice per performance
    CREATE INDEX IF NOT EXISTS idx_users_assigned_config ON public.users(assigned_config_id);
    
    RAISE NOTICE '✅ Colonna assigned_config_id aggiunta a users';
  ELSE
    RAISE NOTICE '⚠️ Colonna assigned_config_id già esistente';
  END IF;
END $$;

-- Commento colonna
COMMENT ON COLUMN public.users.assigned_config_id IS 
  'Configurazione corriere assegnata specificamente a questo utente. 
   Se NULL, viene usata la configurazione default per il provider.';

-- ============================================
-- STEP 3: Trigger per updated_at
-- ============================================

-- Funzione per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_courier_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per courier_configs
DROP TRIGGER IF EXISTS update_courier_configs_modtime ON public.courier_configs;
CREATE TRIGGER update_courier_configs_modtime
BEFORE UPDATE ON public.courier_configs
FOR EACH ROW
EXECUTE FUNCTION update_courier_configs_updated_at();

-- ============================================
-- STEP 4: Row Level Security (RLS)
-- ============================================

-- Abilita RLS
ALTER TABLE public.courier_configs ENABLE ROW LEVEL SECURITY;

-- Rimuovi policy esistenti se presenti (per permettere re-esecuzione)
DROP POLICY IF EXISTS "Admin può vedere tutte le configurazioni" ON public.courier_configs;
DROP POLICY IF EXISTS "Admin può inserire configurazioni" ON public.courier_configs;
DROP POLICY IF EXISTS "Admin può aggiornare configurazioni" ON public.courier_configs;
DROP POLICY IF EXISTS "Admin può eliminare configurazioni" ON public.courier_configs;

-- Policy: Solo Admin possono vedere tutte le configurazioni
CREATE POLICY "Admin può vedere tutte le configurazioni"
ON public.courier_configs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE email = (SELECT auth.email())
    AND role = 'admin'
  )
);

-- Policy: Solo Admin possono inserire configurazioni
CREATE POLICY "Admin può inserire configurazioni"
ON public.courier_configs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE email = (SELECT auth.email())
    AND role = 'admin'
  )
);

-- Policy: Solo Admin possono aggiornare configurazioni
CREATE POLICY "Admin può aggiornare configurazioni"
ON public.courier_configs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE email = (SELECT auth.email())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE email = (SELECT auth.email())
    AND role = 'admin'
  )
);

-- Policy: Solo Admin possono eliminare configurazioni
CREATE POLICY "Admin può eliminare configurazioni"
ON public.courier_configs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE email = (SELECT auth.email())
    AND role = 'admin'
  )
);

-- ============================================
-- STEP 5: Funzioni Helper
-- ============================================

/**
 * Funzione: Ottieni configurazione corriere per utente
 * 
 * Logica:
 * 1. Se utente ha assigned_config_id, usa quella
 * 2. Altrimenti, usa configurazione default per provider
 * 3. Se nessuna trovata, ritorna NULL
 */
CREATE OR REPLACE FUNCTION get_courier_config_for_user(
  p_user_id UUID,
  p_provider_id TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  provider_id TEXT,
  api_key TEXT,
  api_secret TEXT,
  base_url TEXT,
  contract_mapping JSONB,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.id,
    cc.name,
    cc.provider_id,
    cc.api_key,
    cc.api_secret,
    cc.base_url,
    cc.contract_mapping,
    cc.is_active
  FROM public.courier_configs cc
  WHERE cc.provider_id = p_provider_id
    AND cc.is_active = true
    AND (
      -- Caso 1: Configurazione assegnata specificamente all'utente
      cc.id = (SELECT assigned_config_id FROM public.users WHERE id = p_user_id)
      OR
      -- Caso 2: Configurazione default (solo se utente non ha assegnazione)
      (cc.is_default = true AND (SELECT assigned_config_id FROM public.users WHERE id = p_user_id) IS NULL)
    )
  ORDER BY 
    -- Priorità: prima assigned, poi default
    CASE WHEN cc.id = (SELECT assigned_config_id FROM public.users WHERE id = p_user_id) THEN 0 ELSE 1 END
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_courier_config_for_user IS 
  'Recupera la configurazione corriere per un utente specifico.
   Priorità: 1) Config assegnata, 2) Config default per provider.';

/**
 * Funzione: Verifica se configurazione è in uso
 * Utile prima di eliminare una configurazione
 */
CREATE OR REPLACE FUNCTION is_courier_config_in_use(
  p_config_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_user_count
  FROM public.users
  WHERE assigned_config_id = p_config_id;
  
  RETURN v_user_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_courier_config_in_use IS 
  'Verifica se una configurazione è assegnata ad almeno un utente.';

-- ============================================
-- STEP 6: Dati Iniziali (Opzionale)
-- ============================================

-- Inserisci configurazione di esempio (solo se non esiste già)
-- ⚠️ NOTA: Sostituisci con valori reali o rimuovi questa sezione
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.courier_configs 
    WHERE provider_id = 'spedisci_online' AND is_default = true
  ) THEN
    INSERT INTO public.courier_configs (
      name,
      provider_id,
      api_key,
      base_url,
      contract_mapping,
      is_active,
      is_default,
      description
    ) VALUES (
      'Configurazione Default Spedisci.Online',
      'spedisci_online',
      'REPLACE_WITH_REAL_API_KEY', -- ⚠️ SOSTITUIRE CON CHIAVE REALE
      'https://ecommerceitalia.spedisci.online/api/v2',
      '{"poste": "REPLACE_WITH_CONTRACT_CODE", "gls": "REPLACE_WITH_CONTRACT_CODE"}'::jsonb,
      true,
      true,
      'Configurazione predefinita per Spedisci.Online. Sostituire con valori reali.'
    );
    
    RAISE NOTICE '✅ Configurazione default di esempio creata (⚠️ SOSTITUIRE CON VALORI REALI)';
  ELSE
    RAISE NOTICE '⚠️ Configurazione default già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 7: Verifica Finale
-- ============================================

DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_column_exists BOOLEAN;
  v_policy_count INTEGER;
BEGIN
  -- Verifica tabella
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'courier_configs'
  ) INTO v_table_exists;
  
  -- Verifica colonna
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'assigned_config_id'
  ) INTO v_column_exists;
  
  -- Conta policy
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
  AND tablename = 'courier_configs';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration Courier Configs System';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tabella courier_configs: %', CASE WHEN v_table_exists THEN '✅ Creata' ELSE '❌ Mancante' END;
  RAISE NOTICE 'Colonna assigned_config_id: %', CASE WHEN v_column_exists THEN '✅ Aggiunta' ELSE '❌ Mancante' END;
  RAISE NOTICE 'Policy RLS: %', v_policy_count;
  RAISE NOTICE 'Funzioni helper: ✅ Create';
  RAISE NOTICE '========================================';
  RAISE NOTICE '⚠️ IMPORTANTE: Sostituire valori placeholder nelle configurazioni di esempio';
  RAISE NOTICE '========================================';
END $$;

