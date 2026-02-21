-- ============================================
-- MIGRAZIONE: Creazione tabella organizations
-- ============================================
-- Parte del refactoring Architecture V2
-- Organization = Entita fiscale/billing
--
-- REGOLA CRITICA: NESSUN DEFAULT PER FEE/MARGINI
-- Tutto deve essere configurato manualmente dal Superadmin
-- ============================================

-- Crea tabella organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- per URL: logistica-milano.spediresicuro.it

  -- Fiscal/Billing
  vat_number TEXT, -- P.IVA
  fiscal_code TEXT, -- Codice Fiscale
  billing_email TEXT NOT NULL,
  billing_address JSONB DEFAULT '{}', -- {via, citta, cap, provincia, paese}

  -- Branding (White-label Livello 2 FREE)
  branding JSONB DEFAULT '{}', -- {logo_url, primary_color, secondary_color, favicon}
  white_label_level INTEGER DEFAULT 1 CHECK (white_label_level IN (1, 2, 3)),
  -- 1 = base (logo + colori)
  -- 2 = subdomain (logistica-milano.spediresicuro.it) - FREE
  -- 3 = custom domain (spedizioni.logisticamilano.it) - PREMIUM
  custom_domain TEXT, -- solo livello 3

  -- Settings generali organization
  settings JSONB DEFAULT '{}',

  -- IMPORTANTE: Nessun campo fee/margine qui!
  -- Le fee sono a livello WORKSPACE, non organization
  -- E sono SEMPRE NULL di default (configurazione manuale Superadmin)

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON public.organizations(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON public.organizations(created_by);
CREATE INDEX IF NOT EXISTS idx_organizations_vat ON public.organizations(vat_number) WHERE vat_number IS NOT NULL;

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION public.update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_organizations_updated_at ON public.organizations;
CREATE TRIGGER trigger_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_organizations_updated_at();

-- Funzione per generare slug da nome
CREATE OR REPLACE FUNCTION public.generate_organization_slug(p_name TEXT)
RETURNS TEXT AS $$
DECLARE
  v_slug TEXT;
  v_counter INTEGER := 0;
  v_base_slug TEXT;
BEGIN
  -- Normalizza: lowercase, rimuovi caratteri speciali, sostituisci spazi con -
  v_base_slug := lower(trim(p_name));
  v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9\s-]', '', 'g');
  v_base_slug := regexp_replace(v_base_slug, '\s+', '-', 'g');
  v_base_slug := regexp_replace(v_base_slug, '-+', '-', 'g');
  v_base_slug := trim(both '-' from v_base_slug);

  -- Limita lunghezza
  v_base_slug := left(v_base_slug, 50);

  v_slug := v_base_slug;

  -- Verifica unicita e aggiungi counter se necessario
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) LOOP
    v_counter := v_counter + 1;
    v_slug := v_base_slug || '-' || v_counter;
  END LOOP;

  RETURN v_slug;
END;
$$ LANGUAGE plpgsql;

-- Commenti
COMMENT ON TABLE public.organizations IS 'Entita fiscale/billing - contiene P.IVA, branding, settings organizzazione';
COMMENT ON COLUMN public.organizations.slug IS 'Slug univoco per URL white-label (es: logistica-milano.spediresicuro.it)';
COMMENT ON COLUMN public.organizations.white_label_level IS '1=base, 2=subdomain FREE, 3=custom domain PREMIUM';
COMMENT ON COLUMN public.organizations.branding IS 'JSON: {logo_url, primary_color, secondary_color, favicon}';

-- ============================================
-- FINE MIGRAZIONE organizations
-- ============================================
