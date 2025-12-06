/**
 * Migration: Sistema Toggle Features Piattaforma
 * 
 * Permette al superadmin di attivare/disattivare tutte le features/moduli
 * della piattaforma da un pannello centralizzato.
 */

-- ============================================
-- STEP 1: Crea Tabella Platform Features
-- ============================================

CREATE TABLE IF NOT EXISTS public.platform_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identificativo feature
  code TEXT UNIQUE NOT NULL, -- es. 'integrations', 'automation', 'ldv_scanner', etc.
  name TEXT NOT NULL, -- Nome visualizzato
  description TEXT, -- Descrizione feature
  
  -- Categoria
  category TEXT NOT NULL, -- 'integrations', 'automation', 'admin', 'analytics', etc.
  
  -- Stato
  is_enabled BOOLEAN DEFAULT true, -- Se la feature è attiva globalmente
  is_visible BOOLEAN DEFAULT true, -- Se la feature è visibile nel menu (può essere disattivata ma visibile)
  
  -- Configurazione
  config JSONB DEFAULT '{}', -- Configurazioni specifiche feature
  
  -- Ordine visualizzazione
  display_order INTEGER DEFAULT 100,
  
  -- Icona (nome icona lucide-react)
  icon TEXT,
  
  -- Route/path associato (opzionale)
  route_path TEXT, -- es. '/dashboard/integrazioni', '/dashboard/admin', etc.
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_platform_features_code ON public.platform_features(code);
CREATE INDEX IF NOT EXISTS idx_platform_features_category ON public.platform_features(category);
CREATE INDEX IF NOT EXISTS idx_platform_features_enabled ON public.platform_features(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_platform_features_display_order ON public.platform_features(display_order);

-- Commenti
COMMENT ON TABLE public.platform_features IS 'Tabella per gestire attivazione/disattivazione globale delle features della piattaforma';
COMMENT ON COLUMN public.platform_features.code IS 'Codice univoco della feature (es. integrations, automation, ldv_scanner)';
COMMENT ON COLUMN public.platform_features.is_enabled IS 'Se true, la feature è attiva e funzionante. Se false, è disattivata globalmente.';
COMMENT ON COLUMN public.platform_features.is_visible IS 'Se true, la feature è visibile nel menu. Se false, è nascosta anche se attiva.';

-- ============================================
-- STEP 2: Trigger per updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_platform_features_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_platform_features_modtime
  BEFORE UPDATE ON public.platform_features
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_features_updated_at();

-- ============================================
-- STEP 3: Inserisci Features Esistenti
-- ============================================

-- Features Integrazioni
INSERT INTO public.platform_features (code, name, description, category, is_enabled, is_visible, display_order, icon, route_path) VALUES
  ('integrations', 'Integrazioni E-commerce', 'Collega store e-commerce (Shopify, WooCommerce, Amazon, etc.) e Universal Widget', 'integrations', true, true, 10, 'ShoppingBag', '/dashboard/integrazioni'),
  ('integrations_shopify', 'Integrazione Shopify', 'Collega il tuo store Shopify', 'integrations', true, true, 11, 'Store', NULL),
  ('integrations_woocommerce', 'Integrazione WooCommerce', 'Collega il tuo negozio WooCommerce', 'integrations', true, true, 12, 'ShoppingBag', NULL),
  ('integrations_amazon', 'Integrazione Amazon', 'Connetti Amazon Seller Central', 'integrations', true, true, 13, 'Store', NULL),
  ('integrations_magento', 'Integrazione Magento', 'Connetti il tuo store Magento', 'integrations', true, true, 14, 'Store', NULL),
  ('integrations_prestashop', 'Integrazione PrestaShop', 'Integra PrestaShop', 'integrations', true, true, 15, 'Store', NULL),
  ('integrations_custom', 'Integrazione Custom API', 'Collega tramite API personalizzata', 'integrations', true, true, 16, 'Code', NULL),
  ('universal_widget', 'Universal Widget', 'Widget universale per importare ordini in 1 click', 'integrations', true, true, 20, 'Zap', NULL)
ON CONFLICT (code) DO UPDATE 
SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  route_path = EXCLUDED.route_path,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Features Automation
INSERT INTO public.platform_features (code, name, description, category, is_enabled, is_visible, display_order, icon, route_path) VALUES
  ('automation', 'Automazione Spedisci.Online', 'Sistema di automazione per creare spedizioni automaticamente', 'automation', true, true, 30, 'Zap', NULL),
  ('automation_spedisci_online', 'Automazione Spedisci.Online', 'Configura automazioni per Spedisci.Online con crittografia password e lock system', 'automation', true, true, 31, 'Settings', NULL)
ON CONFLICT (code) DO UPDATE 
SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  route_path = EXCLUDED.route_path,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Features Admin
INSERT INTO public.platform_features (code, name, description, category, is_enabled, is_visible, display_order, icon, route_path) VALUES
  ('admin_dashboard', 'Dashboard Admin', 'Panoramica completa della piattaforma (God View)', 'admin', true, true, 40, 'Shield', '/dashboard/admin'),
  ('admin_configurations', 'Configurazioni Corrieri', 'Gestione dinamica API corrieri - Multi-Tenant', 'admin', true, true, 41, 'Settings', '/dashboard/admin/configurations'),
  ('admin_team', 'Gestione Team', 'Gestisci utenti e amministratori', 'admin', true, true, 42, 'Users', '/dashboard/team'),
  ('admin_features', 'Gestione Features Utenti', 'Attiva/disattiva killer features per gli utenti', 'admin', true, true, 43, 'Sparkles', NULL)
ON CONFLICT (code) DO UPDATE 
SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  route_path = EXCLUDED.route_path,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Features Scanner
INSERT INTO public.platform_features (code, name, description, category, is_enabled, is_visible, display_order, icon, route_path) VALUES
  ('ldv_scanner', 'Scanner LDV', 'Scansiona e importa spedizioni dalla lista tramite fotocamera', 'automation', true, true, 50, 'Camera', NULL)
ON CONFLICT (code) DO UPDATE 
SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  route_path = EXCLUDED.route_path,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Features Utente Base
INSERT INTO public.platform_features (code, name, description, category, is_enabled, is_visible, display_order, icon, route_path) VALUES
  ('dashboard', 'Dashboard Utente', 'Dashboard principale con statistiche e attività recente', 'user', true, true, 1, 'LayoutDashboard', '/dashboard'),
  ('spedizioni', 'Gestione Spedizioni', 'Crea e gestisci le tue spedizioni', 'user', true, true, 2, 'Package', '/dashboard/spedizioni'),
  ('preventivi', 'Calcolo Preventivi', 'Calcola preventivi per le tue spedizioni', 'user', true, true, 3, 'Calculator', '/preventivo'),
  ('tracking', 'Tracking Spedizioni', 'Traccia lo stato delle tue spedizioni', 'user', true, true, 4, 'Search', '/track'),
  ('impostazioni', 'Impostazioni', 'Gestisci le tue impostazioni account', 'user', true, true, 5, 'Settings', '/dashboard/impostazioni'),
  ('privacy', 'Privacy', 'Gestisci la tua privacy e dati', 'user', true, true, 6, 'Lock', '/dashboard/profile/privacy')
ON CONFLICT (code) DO UPDATE 
SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  route_path = EXCLUDED.route_path,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ============================================
-- STEP 4: Funzione Helper per Verificare Feature
-- ============================================

CREATE OR REPLACE FUNCTION is_platform_feature_enabled(p_feature_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_enabled BOOLEAN;
BEGIN
  SELECT is_enabled INTO v_is_enabled
  FROM public.platform_features
  WHERE code = p_feature_code;
  
  -- Se la feature non esiste, ritorna false (sicurezza)
  IF v_is_enabled IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN v_is_enabled;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_platform_feature_enabled IS 'Verifica se una feature piattaforma è attiva globalmente';

-- ============================================
-- STEP 5: Funzione Helper per Verificare Visibilità
-- ============================================

CREATE OR REPLACE FUNCTION is_platform_feature_visible(p_feature_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_visible BOOLEAN;
BEGIN
  SELECT is_visible INTO v_is_visible
  FROM public.platform_features
  WHERE code = p_feature_code;
  
  -- Se la feature non esiste, ritorna false (sicurezza)
  IF v_is_visible IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN v_is_visible;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_platform_feature_visible IS 'Verifica se una feature piattaforma è visibile nel menu';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Sistema toggle features piattaforma creato';
  RAISE NOTICE '   - Tabella platform_features creata';
  RAISE NOTICE '   - Features esistenti inserite';
  RAISE NOTICE '   - Funzioni helper create';
  RAISE NOTICE '   - Solo superadmin può modificare le features';
END $$;



