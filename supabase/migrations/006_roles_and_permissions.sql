-- ============================================
-- SISTEMA RUOLI E PERMESSI - SpedireSicuro.it
-- ============================================
-- Migration: 006 - Roles and Permissions System
-- Description: Sistema completo per gestione ruoli e permessi killer features
-- ============================================

-- ============================================
-- STEP 1: Crea o Estendi ENUM user_role
-- ============================================

DO $$ 
BEGIN
  -- Verifica se l'ENUM esiste già
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    -- Crea l'ENUM con tutti i valori
    CREATE TYPE user_role AS ENUM ('admin', 'user', 'merchant', 'agent', 'manager', 'support', 'viewer');
    RAISE NOTICE '✅ Creato ENUM user_role con tutti i valori';
  ELSE
    -- ENUM esiste già, aggiungi solo i valori mancanti
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'agent' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
      ALTER TYPE user_role ADD VALUE 'agent';
      RAISE NOTICE '✅ Aggiunto valore "agent" a user_role';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'manager' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
      ALTER TYPE user_role ADD VALUE 'manager';
      RAISE NOTICE '✅ Aggiunto valore "manager" a user_role';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'support' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
      ALTER TYPE user_role ADD VALUE 'support';
      RAISE NOTICE '✅ Aggiunto valore "support" a user_role';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'viewer' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
      ALTER TYPE user_role ADD VALUE 'viewer';
      RAISE NOTICE '✅ Aggiunto valore "viewer" a user_role';
    END IF;
    
    -- Verifica se mancano anche i valori base
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'admin' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
      -- Se manca admin, probabilmente l'ENUM è vuoto o corrotto
      RAISE WARNING '⚠️ Valore "admin" mancante in user_role - potrebbe essere necessario ricreare l''ENUM';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'user' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
      RAISE WARNING '⚠️ Valore "user" mancante in user_role - potrebbe essere necessario ricreare l''ENUM';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'merchant' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
      ALTER TYPE user_role ADD VALUE 'merchant';
      RAISE NOTICE '✅ Aggiunto valore "merchant" a user_role';
    END IF;
  END IF;
END $$;

-- ============================================
-- STEP 2: Tabella Killer Features
-- ============================================

CREATE TABLE IF NOT EXISTS public.killer_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificativo univoco feature (es. 'ocr_scan', 'bulk_import', 'api_access')
  code TEXT UNIQUE NOT NULL,
  
  -- Nome visualizzato
  name TEXT NOT NULL,
  
  -- Descrizione
  description TEXT,
  
  -- Categoria (es. 'automation', 'integration', 'analytics', 'premium')
  category TEXT DEFAULT 'premium',
  
  -- Prezzo mensile (in centesimi, 0 = gratuito)
  price_monthly_cents INTEGER DEFAULT 0,
  
  -- Prezzo annuale (in centesimi, 0 = gratuito)
  price_yearly_cents INTEGER DEFAULT 0,
  
  -- Se è attualmente gratuita
  is_free BOOLEAN DEFAULT true,
  
  -- Se è disponibile per acquisto
  is_available BOOLEAN DEFAULT true,
  
  -- Ordine di visualizzazione
  display_order INTEGER DEFAULT 0,
  
  -- Icona (nome icona Lucide React)
  icon TEXT,
  
  -- Metadata aggiuntivi (JSONB)
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_killer_features_code ON public.killer_features(code);
CREATE INDEX IF NOT EXISTS idx_killer_features_category ON public.killer_features(category);
CREATE INDEX IF NOT EXISTS idx_killer_features_available ON public.killer_features(is_available) WHERE is_available = true;

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION update_killer_features_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_killer_features_updated_at ON public.killer_features;
CREATE TRIGGER trigger_update_killer_features_updated_at
  BEFORE UPDATE ON public.killer_features
  FOR EACH ROW
  EXECUTE FUNCTION update_killer_features_updated_at();

-- ============================================
-- STEP 3: Tabella User Features (Associazione Utente-Feature)
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Riferimento a user_profiles (email-based) o users (UUID-based)
  -- Usiamo email per compatibilità con NextAuth
  user_email TEXT NOT NULL,
  
  -- Riferimento a killer_features
  feature_id UUID REFERENCES public.killer_features(id) ON DELETE CASCADE NOT NULL,
  
  -- Se la feature è attiva per questo utente
  is_active BOOLEAN DEFAULT true,
  
  -- Data di attivazione
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Data di scadenza (NULL = senza scadenza)
  expires_at TIMESTAMPTZ,
  
  -- Tipo di attivazione (gratuita, pagata, trial, admin_grant)
  activation_type TEXT DEFAULT 'free' CHECK (activation_type IN ('free', 'paid', 'trial', 'admin_grant', 'subscription')),
  
  -- ID sottoscrizione (se pagata)
  subscription_id TEXT,
  
  -- Metadata aggiuntivi
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: un utente può avere una feature solo una volta
  UNIQUE(user_email, feature_id)
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_user_features_user_email ON public.user_features(user_email);
CREATE INDEX IF NOT EXISTS idx_user_features_feature_id ON public.user_features(feature_id);
CREATE INDEX IF NOT EXISTS idx_user_features_active ON public.user_features(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_features_expires ON public.user_features(expires_at) WHERE expires_at IS NOT NULL;

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION update_user_features_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_features_updated_at ON public.user_features;
CREATE TRIGGER trigger_update_user_features_updated_at
  BEFORE UPDATE ON public.user_features
  FOR EACH ROW
  EXECUTE FUNCTION update_user_features_updated_at();

-- ============================================
-- STEP 4: Tabella Role Permissions (Permessi per Ruolo)
-- ============================================

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ruolo
  role user_role NOT NULL,
  
  -- Feature code (riferimento a killer_features.code)
  feature_code TEXT NOT NULL,
  
  -- Se il ruolo ha accesso di default a questa feature
  has_access BOOLEAN DEFAULT false,
  
  -- Se può gestire (attivare/disattivare) questa feature per altri utenti
  can_manage BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: un ruolo può avere una feature solo una volta
  UNIQUE(role, feature_code)
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_feature_code ON public.role_permissions(feature_code);

-- ============================================
-- STEP 5: Funzioni Helper
-- ============================================

-- Funzione: Verifica se un utente ha accesso a una feature
CREATE OR REPLACE FUNCTION user_has_feature(
  p_user_email TEXT,
  p_feature_code TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_role user_role;
  v_feature_active BOOLEAN;
  v_user_feature_active BOOLEAN;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- 1. Ottieni ruolo utente
  SELECT role INTO v_user_role
  FROM public.users
  WHERE email = p_user_email
  LIMIT 1;
  
  -- Se utente non esiste, controlla user_profiles
  IF v_user_role IS NULL THEN
    SELECT 'user'::user_role INTO v_user_role; -- Default: user
  END IF;
  
  -- 2. Verifica se la feature esiste ed è disponibile
  SELECT is_available INTO v_feature_active
  FROM public.killer_features
  WHERE code = p_feature_code;
  
  IF NOT v_feature_active THEN
    RETURN false;
  END IF;
  
  -- 3. Se admin, ha sempre accesso
  IF v_user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- 4. Verifica permesso ruolo
  SELECT has_access INTO v_feature_active
  FROM public.role_permissions
  WHERE role = v_user_role AND feature_code = p_feature_code;
  
  IF v_feature_active THEN
    RETURN true;
  END IF;
  
  -- 5. Verifica se l'utente ha la feature attivata esplicitamente
  SELECT is_active, expires_at INTO v_user_feature_active, v_expires_at
  FROM public.user_features uf
  JOIN public.killer_features kf ON uf.feature_id = kf.id
  WHERE uf.user_email = p_user_email AND kf.code = p_feature_code;
  
  IF v_user_feature_active THEN
    -- Verifica scadenza
    IF v_expires_at IS NULL OR v_expires_at > NOW() THEN
      RETURN true;
    END IF;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione: Ottieni tutte le features attive per un utente
CREATE OR REPLACE FUNCTION get_user_active_features(
  p_user_email TEXT
)
RETURNS TABLE (
  feature_code TEXT,
  feature_name TEXT,
  category TEXT,
  is_free BOOLEAN,
  activation_type TEXT,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    kf.code,
    kf.name,
    kf.category,
    kf.is_free,
    uf.activation_type,
    uf.expires_at
  FROM public.killer_features kf
  LEFT JOIN public.user_features uf ON kf.id = uf.feature_id AND uf.user_email = p_user_email AND uf.is_active = true
  LEFT JOIN public.users u ON u.email = p_user_email
  LEFT JOIN public.role_permissions rp ON rp.role = COALESCE(u.role, 'user'::user_role) AND rp.feature_code = kf.code
  WHERE kf.is_available = true
    AND (
      -- Feature attiva esplicitamente per l'utente
      (uf.is_active = true AND (uf.expires_at IS NULL OR uf.expires_at > NOW()))
      OR
      -- Feature disponibile per ruolo
      (rp.has_access = true)
      OR
      -- Admin ha sempre accesso
      (COALESCE(u.role, 'user'::user_role) = 'admin')
      OR
      -- Feature gratuita
      (kf.is_free = true)
    )
  ORDER BY kf.display_order, kf.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 6: Inserisci Killer Features Predefinite
-- ============================================

INSERT INTO public.killer_features (code, name, description, category, is_free, display_order, icon) VALUES
  ('ocr_scan', 'OCR Scan Automatico', 'Scansione automatica documenti con riconoscimento testo', 'automation', true, 1, 'Scan'),
  ('bulk_import', 'Import Massivo', 'Importa centinaia di spedizioni da CSV/Excel', 'automation', true, 2, 'Upload'),
  ('api_access', 'API Access', 'Accesso completo alle API per integrazioni personalizzate', 'integration', false, 3, 'Code'),
  ('advanced_analytics', 'Analytics Avanzati', 'Dashboard analytics con grafici e report dettagliati', 'analytics', false, 4, 'BarChart'),
  ('white_label', 'White Label', 'Rimuovi branding e personalizza completamente la piattaforma', 'premium', false, 5, 'Palette'),
  ('webhook_integration', 'Webhook Integration', 'Ricevi notifiche in tempo reale su eventi spedizioni', 'integration', false, 6, 'Webhook'),
  ('multi_warehouse', 'Multi Warehouse', 'Gestisci più magazzini e punti di spedizione', 'premium', false, 7, 'Warehouse'),
  ('custom_labels', 'Etichette Personalizzate', 'Crea etichette spedizione con il tuo branding', 'premium', false, 8, 'Tag'),
  ('priority_support', 'Supporto Prioritario', 'Supporto tecnico prioritario via email e chat', 'premium', false, 9, 'Headphones'),
  ('unlimited_shipments', 'Spedizioni Illimitate', 'Nessun limite sul numero di spedizioni mensili', 'premium', false, 10, 'Infinity')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- STEP 7: Configura Permessi Default per Ruoli
-- ============================================

-- Admin: ha accesso a tutto
INSERT INTO public.role_permissions (role, feature_code, has_access, can_manage) VALUES
  ('admin', 'ocr_scan', true, true),
  ('admin', 'bulk_import', true, true),
  ('admin', 'api_access', true, true),
  ('admin', 'advanced_analytics', true, true),
  ('admin', 'white_label', true, true),
  ('admin', 'webhook_integration', true, true),
  ('admin', 'multi_warehouse', true, true),
  ('admin', 'custom_labels', true, true),
  ('admin', 'priority_support', true, true),
  ('admin', 'unlimited_shipments', true, true)
ON CONFLICT (role, feature_code) DO UPDATE SET has_access = true, can_manage = true;

-- Manager: ha accesso a features avanzate
INSERT INTO public.role_permissions (role, feature_code, has_access, can_manage) VALUES
  ('manager', 'ocr_scan', true, false),
  ('manager', 'bulk_import', true, false),
  ('manager', 'api_access', true, false),
  ('manager', 'advanced_analytics', true, false),
  ('manager', 'webhook_integration', true, false),
  ('manager', 'multi_warehouse', true, false),
  ('manager', 'custom_labels', true, false)
ON CONFLICT (role, feature_code) DO NOTHING;

-- Agent: ha accesso base
INSERT INTO public.role_permissions (role, feature_code, has_access, can_manage) VALUES
  ('agent', 'ocr_scan', true, false),
  ('agent', 'bulk_import', true, false)
ON CONFLICT (role, feature_code) DO NOTHING;

-- User: solo features gratuite (di default)
INSERT INTO public.role_permissions (role, feature_code, has_access, can_manage) VALUES
  ('user', 'ocr_scan', true, false),
  ('user', 'bulk_import', true, false)
ON CONFLICT (role, feature_code) DO NOTHING;

-- Merchant: come user + alcune features business
INSERT INTO public.role_permissions (role, feature_code, has_access, can_manage) VALUES
  ('merchant', 'ocr_scan', true, false),
  ('merchant', 'bulk_import', true, false),
  ('merchant', 'api_access', true, false),
  ('merchant', 'webhook_integration', true, false)
ON CONFLICT (role, feature_code) DO NOTHING;

-- Support: accesso limitato per troubleshooting
INSERT INTO public.role_permissions (role, feature_code, has_access, can_manage) VALUES
  ('support', 'ocr_scan', true, false),
  ('support', 'bulk_import', true, false),
  ('support', 'advanced_analytics', true, false)
ON CONFLICT (role, feature_code) DO NOTHING;

-- Viewer: solo visualizzazione
INSERT INTO public.role_permissions (role, feature_code, has_access, can_manage) VALUES
  ('viewer', 'ocr_scan', false, false),
  ('viewer', 'bulk_import', false, false)
ON CONFLICT (role, feature_code) DO NOTHING;

-- ============================================
-- STEP 8: Row Level Security (RLS)
-- ============================================

-- Abilita RLS
ALTER TABLE public.killer_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: killer_features - tutti possono vedere le features disponibili
CREATE POLICY "Chiunque può vedere killer_features disponibili"
ON public.killer_features
FOR SELECT
TO authenticated
USING (is_available = true);

-- Policy: user_features - utenti vedono solo le loro features
CREATE POLICY "Utenti vedono solo le loro features"
ON public.user_features
FOR SELECT
TO authenticated
USING (
  (SELECT auth.email()) = user_email
  OR
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE email = (SELECT auth.email()) 
    AND role = 'admin'
  )
);

-- Policy: role_permissions - tutti possono vedere i permessi
CREATE POLICY "Chiunque può vedere role_permissions"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- STEP 9: View per God View (Admin Dashboard)
-- ============================================

-- Prima verifica se la colonna last_login_at esiste, altrimenti creala
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN last_login_at TIMESTAMPTZ;
    RAISE NOTICE '✅ Aggiunta colonna last_login_at a users';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.god_view_users AS
SELECT 
  u.id,
  u.email,
  u.name,
  u.role,
  u.provider,
  u.created_at,
  u.updated_at,
  u.last_login_at,
  up.supabase_user_id,
  COUNT(DISTINCT s.id) FILTER (WHERE s.deleted = false) as active_shipments_count,
  COUNT(DISTINCT uf.id) FILTER (WHERE uf.is_active = true) as active_features_count,
  ARRAY_AGG(DISTINCT kf.code) FILTER (WHERE uf.is_active = true) as active_features
FROM public.users u
LEFT JOIN public.user_profiles up ON u.email = up.email
LEFT JOIN public.shipments s ON s.user_id = u.id OR s.created_by_user_email = u.email
LEFT JOIN public.user_features uf ON uf.user_email = u.email AND uf.is_active = true
LEFT JOIN public.killer_features kf ON kf.id = uf.feature_id
GROUP BY u.id, u.email, u.name, u.role, u.provider, u.created_at, u.updated_at, u.last_login_at, up.supabase_user_id;

-- ⚠️ NOTA: Le policy RLS non possono essere applicate alle view in PostgreSQL
-- L'accesso alla view god_view_users deve essere controllato a livello applicativo
-- Solo gli admin possono accedere a questa view (verificare ruolo nel codice)

-- ============================================
-- STEP 10: Funzione per Gestione Utenti (God View)
-- ============================================

-- Funzione: Cambia ruolo utente (solo admin)
CREATE OR REPLACE FUNCTION change_user_role(
  p_admin_email TEXT,
  p_target_user_email TEXT,
  p_new_role user_role
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_role user_role;
BEGIN
  -- Verifica che l'utente che chiama sia admin
  SELECT role INTO v_admin_role
  FROM public.users
  WHERE email = p_admin_email;
  
  IF v_admin_role != 'admin' THEN
    RAISE EXCEPTION 'Solo gli admin possono cambiare i ruoli';
  END IF;
  
  -- Cambia ruolo
  UPDATE public.users
  SET role = p_new_role, updated_at = NOW()
  WHERE email = p_target_user_email;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione: Attiva/Disattiva feature per utente (solo admin/manager)
CREATE OR REPLACE FUNCTION toggle_user_feature(
  p_admin_email TEXT,
  p_target_user_email TEXT,
  p_feature_code TEXT,
  p_activate BOOLEAN,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_activation_type TEXT DEFAULT 'admin_grant'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_role user_role;
  v_feature_id UUID;
BEGIN
  -- Verifica che l'utente che chiama sia admin o manager
  SELECT role INTO v_admin_role
  FROM public.users
  WHERE email = p_admin_email;
  
  IF v_admin_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Solo admin e manager possono gestire le features';
  END IF;
  
  -- Verifica che manager abbia can_manage
  IF v_admin_role = 'manager' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.role_permissions
      WHERE role = 'manager' AND feature_code = p_feature_code AND can_manage = true
    ) THEN
      RAISE EXCEPTION 'Manager non ha permesso di gestire questa feature';
    END IF;
  END IF;
  
  -- Ottieni feature_id
  SELECT id INTO v_feature_id
  FROM public.killer_features
  WHERE code = p_feature_code;
  
  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'Feature non trovata: %', p_feature_code;
  END IF;
  
  -- Inserisci o aggiorna user_feature
  INSERT INTO public.user_features (user_email, feature_id, is_active, expires_at, activation_type)
  VALUES (p_target_user_email, v_feature_id, p_activate, p_expires_at, p_activation_type)
  ON CONFLICT (user_email, feature_id) 
  DO UPDATE SET 
    is_active = p_activate,
    expires_at = p_expires_at,
    activation_type = p_activation_type,
    updated_at = NOW();
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 11: Notifiche e Log
-- ============================================

-- Tabella per log modifiche ruoli/features (audit trail)
CREATE TABLE IF NOT EXISTS public.admin_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Chi ha fatto l'azione
  admin_email TEXT NOT NULL,
  
  -- Tipo di azione
  action_type TEXT NOT NULL CHECK (action_type IN ('role_change', 'feature_toggle', 'user_create', 'user_delete')),
  
  -- Utente target
  target_user_email TEXT,
  
  -- Dettagli azione (JSONB)
  action_details JSONB DEFAULT '{}'::JSONB,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice
CREATE INDEX IF NOT EXISTS idx_admin_actions_log_admin ON public.admin_actions_log(admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_actions_log_target ON public.admin_actions_log(target_user_email);
CREATE INDEX IF NOT EXISTS idx_admin_actions_log_type ON public.admin_actions_log(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_log_created ON public.admin_actions_log(created_at DESC);

-- ============================================
-- STEP 12: Trigger per Audit Trail
-- ============================================

-- Trigger: Log quando viene cambiato un ruolo
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role != NEW.role THEN
    INSERT INTO public.admin_actions_log (admin_email, action_type, target_user_email, action_details)
    VALUES (
      NEW.email, -- In produzione, dovrebbe essere l'email dell'admin che fa il cambio
      'role_change',
      NEW.email,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_role_change ON public.users;
CREATE TRIGGER trigger_log_role_change
  AFTER UPDATE OF role ON public.users
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION log_role_change();

-- ============================================
-- STEP 13: Commenti e Documentazione
-- ============================================

COMMENT ON TABLE public.killer_features IS 'Catalogo delle killer features disponibili nella piattaforma';
COMMENT ON TABLE public.user_features IS 'Associazione utente-feature: quali features ha attive ogni utente';
COMMENT ON TABLE public.role_permissions IS 'Permessi di default per ogni ruolo sulle killer features';
COMMENT ON TABLE public.admin_actions_log IS 'Log di tutte le azioni amministrative per audit trail';
COMMENT ON VIEW public.god_view_users IS 'Vista completa utenti per dashboard admin (god view)';

COMMENT ON FUNCTION user_has_feature IS 'Verifica se un utente ha accesso a una specifica killer feature';
COMMENT ON FUNCTION get_user_active_features IS 'Ottiene tutte le features attive per un utente';
COMMENT ON FUNCTION change_user_role IS 'Cambia il ruolo di un utente (solo admin)';
COMMENT ON FUNCTION toggle_user_feature IS 'Attiva/disattiva una feature per un utente (admin/manager)';

-- ============================================
-- FINE SCRIPT
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Sistema ruoli e permessi creato con successo!';
  RAISE NOTICE '📋 Features create: %', (SELECT COUNT(*) FROM public.killer_features);
  RAISE NOTICE '👥 Ruoli supportati: admin, user, agent, manager, merchant, support, viewer';
  RAISE NOTICE '🔐 Funzioni helper disponibili: user_has_feature(), get_user_active_features(), change_user_role(), toggle_user_feature()';
END $$;

