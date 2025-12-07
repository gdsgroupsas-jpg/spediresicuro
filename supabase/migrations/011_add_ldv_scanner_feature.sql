/**
 * Migration: Killer Feature Scanner LDV Import
 * 
 * Aggiunge la killer feature per lo scanner LDV a pagamento
 * che permette di importare spedizioni direttamente dalla lista
 */

-- ============================================
-- STEP 1: Aggiungi Killer Feature LDV Scanner
-- ============================================

INSERT INTO public.killer_features (
  code, 
  name, 
  description, 
  category, 
  is_free, 
  is_available,
  display_order, 
  icon,
  price_monthly_cents,
  price_yearly_cents
) VALUES (
  'ldv_scanner_import',
  'Scanner LDV Import',
  'Scansiona e importa spedizioni direttamente dalla lista tramite fotocamera. Legge codici a barre e QR code delle lettere di vettura per creare spedizioni automaticamente.',
  'automation',
  false,  -- A pagamento
  true,
  12,     -- Dopo multi_level_admin
  'Camera',
  499,    -- 4.99€ al mese (esempio, da configurare)
  4999    -- 49.99€ all'anno (esempio, da configurare)
)
ON CONFLICT (code) DO UPDATE 
SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_free = EXCLUDED.is_free,
  is_available = EXCLUDED.is_available,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_yearly_cents = EXCLUDED.price_yearly_cents,
  updated_at = NOW();

-- ============================================
-- STEP 2: Configura Permessi per Ruoli
-- ============================================

-- Solo superadmin può gestire questa feature (non accesso di default)
-- Gli utenti devono acquistarla o averla concessa dal superadmin

-- Admin può avere accesso se concessa (ma non di default)
INSERT INTO public.role_permissions (role, feature_code, has_access, can_manage) VALUES
  ('admin', 'ldv_scanner_import', false, false)  -- Non ha accesso di default, deve essere concessa
ON CONFLICT (role, feature_code) DO NOTHING;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Killer feature "ldv_scanner_import" aggiunta/aggiornata';
  RAISE NOTICE '   - Feature a pagamento per scanner LDV import';
  RAISE NOTICE '   - Solo superadmin può concederla agli utenti';
END $$;






