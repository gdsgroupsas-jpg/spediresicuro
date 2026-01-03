-- ============================================
-- FIX: Creazione tabella couriers mancante
-- Eseguire in Supabase Dashboard → SQL Editor
-- ============================================

-- Estensione UUID (se non esiste)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELLA: couriers
-- ============================================
CREATE TABLE IF NOT EXISTS public.couriers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  code TEXT UNIQUE,
  logo_url TEXT,
  website_url TEXT,
  tracking_url_template TEXT,
  is_active BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true, -- Alias per compatibilità
  supported_countries TEXT[] DEFAULT ARRAY['IT'],
  min_weight DECIMAL(10,2),
  max_weight DECIMAL(10,2),
  min_dimensions JSONB,
  max_dimensions JSONB,
  estimated_delivery_days_min INTEGER,
  estimated_delivery_days_max INTEGER,
  pricing_model TEXT,
  api_endpoint TEXT,
  api_key_required BOOLEAN DEFAULT false,
  supports_tracking BOOLEAN DEFAULT true,
  supports_insurance BOOLEAN DEFAULT false,
  supports_cod BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici couriers
CREATE INDEX IF NOT EXISTS idx_couriers_name ON couriers(name);
CREATE INDEX IF NOT EXISTS idx_couriers_code ON couriers(code);
CREATE INDEX IF NOT EXISTS idx_couriers_active ON couriers(is_active) WHERE is_active = true;

-- ============================================
-- DATI DI DEFAULT: Corrieri Italiani
-- ============================================
INSERT INTO public.couriers (name, display_name, code, is_active, active, tracking_url_template) VALUES
  ('gls', 'GLS', 'GLS', true, true, 'https://www.gls-italy.com/?option=com_gls&view=track_e_trace&numero_spedizione={tracking_number}'),
  ('bartolini', 'BRT Bartolini', 'BRT', true, true, 'https://vas.brt.it/vas/sped_det_show.hsm?referer=sped_numspe_par.htm&Nspediz={tracking_number}'),
  ('dhl', 'DHL Express', 'DHL', true, true, 'https://www.dhl.com/it-it/home/tracking.html?tracking-id={tracking_number}'),
  ('ups', 'UPS', 'UPS', true, true, 'https://www.ups.com/track?tracknum={tracking_number}'),
  ('fedex', 'FedEx', 'FDX', true, true, 'https://www.fedex.com/fedextrack/?trknbr={tracking_number}'),
  ('sda', 'SDA Express Courier', 'SDA', true, true, 'https://www.sda.it/wps/portal/Servizi_online/dettaglio-spedizione?locale=it&tracing.letteraVettura={tracking_number}'),
  ('tnt', 'TNT', 'TNT', true, true, 'https://www.tnt.it/tracking/tracking.do?respCountry=it&respLang=it&searchType=CON&cons={tracking_number}'),
  ('poste', 'Poste Italiane', 'PTI', true, true, 'https://www.poste.it/cerca/index.html#/risultati-spedizioni/{tracking_number}'),
  ('postedeliverybusiness', 'Poste Delivery Business', 'PDB', true, true, 'https://www.poste.it/cerca/index.html#/risultati-spedizioni/{tracking_number}')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  code = EXCLUDED.code,
  is_active = EXCLUDED.is_active,
  active = EXCLUDED.active,
  tracking_url_template = EXCLUDED.tracking_url_template;

-- ============================================
-- ABILITA RLS (Row Level Security)
-- ============================================
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

-- Policy: tutti possono leggere corrieri attivi
DROP POLICY IF EXISTS "Couriers are viewable by everyone" ON public.couriers;
CREATE POLICY "Couriers are viewable by everyone" 
  ON public.couriers FOR SELECT 
  USING (is_active = true);

-- Policy: solo admin può modificare
DROP POLICY IF EXISTS "Admins can manage couriers" ON public.couriers;
CREATE POLICY "Admins can manage couriers" 
  ON public.couriers FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.account_type IN ('admin', 'superadmin')
    )
  );

-- ============================================
-- VERIFICA
-- ============================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.couriers;
  RAISE NOTICE '✅ Tabella couriers creata con % corrieri', v_count;
END $$;
