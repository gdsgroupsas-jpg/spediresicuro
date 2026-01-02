-- ============================================
-- MIGRATION: 058_ai_provider_preferences.sql
-- DESCRIZIONE: Sistema per gestire preferenze provider AI (Anthropic/DeepSeek)
-- DATA: 2026-01 (AI Provider Selection)
-- 
-- Permette al Superadmin di selezionare quale provider AI usare per Anne
-- ============================================

-- ============================================
-- STEP 1: Crea Tabella system_settings per preferenze globali
-- ============================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Chiave univoca per la configurazione
  setting_key TEXT UNIQUE NOT NULL,
  
  -- Valore della configurazione (JSONB per flessibilità)
  setting_value JSONB NOT NULL,
  
  -- Metadata
  description TEXT,
  updated_by TEXT, -- Email dell'admin che ha aggiornato
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(setting_key);

-- ============================================
-- STEP 2: Inserisci setting default per AI provider
-- ============================================

INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'ai_provider',
  '{"provider": "anthropic", "model": "claude-3-haiku-20240307"}'::jsonb,
  'Provider AI utilizzato per Anne. Valori: anthropic, deepseek'
)
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- STEP 3: RLS Policies (solo superadmin può modificare)
-- ============================================

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: Tutti gli utenti autenticati possono leggere
CREATE POLICY system_settings_select ON public.system_settings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy UPDATE: Solo superadmin può modificare
CREATE POLICY system_settings_update ON public.system_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.account_type = 'superadmin'
    )
  );

-- Policy INSERT: Solo superadmin può inserire
CREATE POLICY system_settings_insert ON public.system_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.account_type = 'superadmin'
    )
  );

-- ============================================
-- STEP 4: Funzione helper per ottenere AI provider
-- ============================================

CREATE OR REPLACE FUNCTION get_ai_provider()
RETURNS TEXT AS $$
DECLARE
  provider_value TEXT;
BEGIN
  SELECT (setting_value->>'provider')::TEXT
  INTO provider_value
  FROM public.system_settings
  WHERE setting_key = 'ai_provider';
  
  -- Fallback a 'anthropic' se non trovato
  RETURN COALESCE(provider_value, 'anthropic');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- STEP 5: Funzione helper per ottenere AI model
-- ============================================

CREATE OR REPLACE FUNCTION get_ai_model()
RETURNS TEXT AS $$
DECLARE
  model_value TEXT;
BEGIN
  SELECT (setting_value->>'model')::TEXT
  INTO model_value
  FROM public.system_settings
  WHERE setting_key = 'ai_provider';
  
  -- Fallback a modelli default per provider
  RETURN COALESCE(
    model_value,
    CASE 
      WHEN get_ai_provider() = 'deepseek' THEN 'deepseek-chat'
      ELSE 'claude-3-haiku-20240307'
    END
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- COMMENTI
-- ============================================

COMMENT ON TABLE public.system_settings IS 
  'Configurazioni globali del sistema. Solo superadmin può modificare.';

COMMENT ON COLUMN public.system_settings.setting_key IS 
  'Chiave univoca della configurazione (es: ai_provider, feature_flags)';

COMMENT ON COLUMN public.system_settings.setting_value IS 
  'Valore della configurazione in formato JSONB';

COMMENT ON FUNCTION get_ai_provider() IS 
  'Restituisce il provider AI attualmente configurato (anthropic o deepseek)';

COMMENT ON FUNCTION get_ai_model() IS 
  'Restituisce il modello AI attualmente configurato';

