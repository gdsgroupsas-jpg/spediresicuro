-- ============================================
-- FIX CONFLITTI: Pulizia oggetti esistenti
-- ============================================
-- IMPORTANTE: Usa DO block per verificare esistenza tabella prima di DROP
-- Questo evita errori se la tabella non esiste ancora

DO $$
BEGIN
  -- Verifica se la tabella esiste prima di fare DROP su trigger e policy
  IF EXISTS (
    SELECT 1 FROM pg_class c 
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = 'user_integrations'
  ) THEN
    -- Tabella esiste: possiamo fare DROP su trigger e policy
    EXECUTE 'DROP TRIGGER IF EXISTS update_user_integrations_modtime ON public.user_integrations';
    EXECUTE 'DROP POLICY IF EXISTS "Utenti vedono solo le loro integrazioni" ON public.user_integrations';
  END IF;

  -- Funzione può essere eliminata indipendentemente (IF EXISTS gestisce non esistenza)
  -- CASCADE rimuove anche le dipendenze (trigger che la usa)
  EXECUTE 'DROP FUNCTION IF EXISTS update_user_integrations_updated_at() CASCADE';
END;
$$;

-- ============================================
-- ESTENSIONI (se necessario)
-- ============================================
-- Verifica che pgcrypto sia disponibile per gen_random_uuid()
-- Supabase di solito lo ha già, ma meglio essere sicuri
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABELLA: user_integrations
-- Cassaforte per le chiavi API delle integrazioni e-commerce
-- ============================================

-- Crea la tabella se non esiste
CREATE TABLE IF NOT EXISTS public.user_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Provider supportati: WooCommerce, Shopify, Magento, PrestaShop, Amazon, Custom API
    provider TEXT NOT NULL CHECK (provider IN ('woocommerce', 'shopify', 'magento', 'prestashop', 'amazon', 'custom')),
    
    -- Cassaforte Credenziali (JSONB è perfetto per flessibilità)
    -- Esempio Woo: { "store_url": "...", "api_key": "ck_...", "api_secret": "cs_..." }
    -- Esempio Shopify: { "store_url": "...", "access_token": "shpat_..." }
    -- Esempio Amazon: { "lwa_client_id": "...", "lwa_client_secret": "...", "lwa_refresh_token": "...", "aws_access_key": "...", "aws_secret_key": "...", "seller_id": "...", "region": "eu-west-1" }
    credentials JSONB NOT NULL, 
    
    -- Settings addizionali (es. stato default ordini, webhook URL, configurazioni personalizzate)
    settings JSONB DEFAULT '{}'::JSONB,
    
    -- Status e sincronizzazione
    is_active BOOLEAN DEFAULT true,
    last_sync TIMESTAMP WITH TIME ZONE,
    error_log TEXT, -- Se la connessione fallisce, scriviamo qui perché (utile per debugging)
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint: Un solo account per provider per utente (evita duplicati sporchi)
    UNIQUE(user_id, provider) 
);

-- ============================================
-- PERFORMANCE & SICUREZZA
-- ============================================

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON public.user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_provider ON public.user_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_user_integrations_active ON public.user_integrations(is_active) WHERE is_active = true;

-- Row Level Security (RLS)
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- Policy: Utenti autenticati vedono solo le loro integrazioni
-- Migliorato: usa TO authenticated e SELECT auth.uid() per plan caching
CREATE POLICY "Utenti vedono solo le loro integrazioni" 
ON public.user_integrations 
FOR ALL 
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- ============================================
-- AUTOMAZIONE: Aggiornamento data
-- ============================================

-- Funzione per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_user_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger che chiama la funzione ad ogni UPDATE
CREATE TRIGGER update_user_integrations_modtime
BEFORE UPDATE ON public.user_integrations
FOR EACH ROW EXECUTE PROCEDURE update_user_integrations_updated_at();

-- ============================================
-- DOCUMENTAZIONE
-- ============================================

COMMENT ON TABLE public.user_integrations IS 'Cassaforte integrazioni e-commerce (WooCommerce, Shopify, Amazon, Magento, PrestaShop, Custom API)';
COMMENT ON COLUMN public.user_integrations.credentials IS 'Credenziali in formato JSONB, struttura varia per provider. Le chiavi sono crittografate in produzione.';
COMMENT ON COLUMN public.user_integrations.settings IS 'Configurazioni opzionali (es. stato default ordini, webhook URL, sync automatico)';
COMMENT ON COLUMN public.user_integrations.error_log IS 'Ultimo errore di connessione, utile per debugging e supporto utente';
COMMENT ON COLUMN public.user_integrations.last_sync IS 'Data/ora ultima sincronizzazione riuscita con la piattaforma e-commerce';
