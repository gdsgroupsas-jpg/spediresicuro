-- ============================================
-- MIGRATION: 060_supplier_price_list_config.sql
-- DESCRIZIONE: Tabella per configurazioni manuali listini fornitore
-- DATA: 2026-01-XX
-- CRITICITÀ: P1 - Completamento task listini fornitore
-- ============================================
--
-- PROBLEMA:
-- Le sezioni Assicurazione, Contrassegni, Servizi accessori, Giacenze, Ritiro, Extra
-- non sono disponibili via API e devono essere configurate manualmente dal reseller.
-- Ogni corriere/contratto ha configurazioni diverse.
--
-- SOLUZIONE:
-- Crea tabella supplier_price_list_config per salvare configurazioni manuali
-- collegate ai listini fornitore esistenti (via price_list_id).
-- ============================================

-- ============================================
-- TABELLA: supplier_price_list_config
-- ============================================

CREATE TABLE IF NOT EXISTS supplier_price_list_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Collegamento al listino fornitore
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  
  -- Identificazione corriere/contratto (per query rapide)
  carrier_code TEXT NOT NULL, -- es. "gls", "postedeliverybusiness"
  contract_code TEXT, -- es. "gls-standard", "postedeliverybusiness-SDA---Express---H24+"
  courier_config_id UUID, -- ID configurazione Spedisci.Online (per multi-account)
  
  -- Configurazioni per sezione (JSONB flessibile)
  -- Ogni sezione ha la sua struttura specifica
  insurance_config JSONB DEFAULT '{}'::jsonb, -- Assicurazione
  cod_config JSONB DEFAULT '[]'::jsonb, -- Contrassegni (array di righe)
  accessory_services_config JSONB DEFAULT '[]'::jsonb, -- Servizi accessori (array di servizi)
  storage_config JSONB DEFAULT '{}'::jsonb, -- Giacenze
  pickup_config JSONB DEFAULT '[]'::jsonb, -- Ritiro (array di servizi)
  extra_config JSONB DEFAULT '{}'::jsonb, -- Extra
  
  -- Metadata
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  -- Vincolo: un solo config per price_list_id
  UNIQUE(price_list_id)
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_supplier_price_list_config_price_list 
  ON supplier_price_list_config(price_list_id);
CREATE INDEX IF NOT EXISTS idx_supplier_price_list_config_carrier 
  ON supplier_price_list_config(carrier_code);
CREATE INDEX IF NOT EXISTS idx_supplier_price_list_config_contract 
  ON supplier_price_list_config(contract_code);
CREATE INDEX IF NOT EXISTS idx_supplier_price_list_config_courier_config 
  ON supplier_price_list_config(courier_config_id);

-- Indici GIN per query JSONB
CREATE INDEX IF NOT EXISTS idx_supplier_price_list_config_insurance 
  ON supplier_price_list_config USING GIN (insurance_config);
CREATE INDEX IF NOT EXISTS idx_supplier_price_list_config_cod 
  ON supplier_price_list_config USING GIN (cod_config);
CREATE INDEX IF NOT EXISTS idx_supplier_price_list_config_services 
  ON supplier_price_list_config USING GIN (accessory_services_config);

-- Commenti
COMMENT ON TABLE supplier_price_list_config IS 
  'Configurazioni manuali per sezioni listini fornitore non disponibili via API (Assicurazione, Contrassegni, Servizi, Giacenze, Ritiro, Extra)';

COMMENT ON COLUMN supplier_price_list_config.price_list_id IS 
  'Collegamento al listino fornitore sincronizzato via API';

COMMENT ON COLUMN supplier_price_list_config.carrier_code IS 
  'Codice corriere (es. "gls", "postedeliverybusiness") per query rapide';

COMMENT ON COLUMN supplier_price_list_config.contract_code IS 
  'Codice contratto completo (es. "gls-standard", "postedeliverybusiness-SDA---Express---H24+")';

COMMENT ON COLUMN supplier_price_list_config.courier_config_id IS 
  'ID configurazione Spedisci.Online (per distinguere account multipli)';

COMMENT ON COLUMN supplier_price_list_config.insurance_config IS 
  'Configurazione Assicurazione: { max_value: number, fixed_price: number, percent: number, percent_on: "totale" | "base" }';

COMMENT ON COLUMN supplier_price_list_config.cod_config IS 
  'Configurazione Contrassegni: array di { max_value: number, fixed_price: number, percent: number, percent_on: "totale" | "base" }';

COMMENT ON COLUMN supplier_price_list_config.accessory_services_config IS 
  'Configurazione Servizi accessori: array di { service: string, price: number, percent: number }';

COMMENT ON COLUMN supplier_price_list_config.storage_config IS 
  'Configurazione Giacenze: { services: array di { service: string, price: number, percent: number }, dossier_opening_cost: number }';

COMMENT ON COLUMN supplier_price_list_config.pickup_config IS 
  'Configurazione Ritiro: array di { service: string, fixed_price: number, percent_of_freight: number }';

COMMENT ON COLUMN supplier_price_list_config.extra_config IS 
  'Configurazione Extra: oggetto flessibile per configurazioni aggiuntive';

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION update_supplier_price_list_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_supplier_price_list_config_updated_at
  BEFORE UPDATE ON supplier_price_list_config
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_price_list_config_updated_at();

-- ============================================
-- RLS (Row Level Security)
-- ============================================

ALTER TABLE supplier_price_list_config ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT - Reseller può vedere solo i propri config
CREATE POLICY supplier_price_list_config_select ON supplier_price_list_config
  FOR SELECT
  USING (
    -- Admin può vedere tutto
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.account_type IN ('admin', 'superadmin')
    )
    OR
    -- Reseller/BYOC può vedere solo i propri (via price_list_id -> created_by)
    EXISTS (
      SELECT 1 FROM price_lists pl
      WHERE pl.id = supplier_price_list_config.price_list_id
      AND pl.created_by = auth.uid()
    )
  );

-- Policy: INSERT - Solo reseller/BYOC/admin può creare
CREATE POLICY supplier_price_list_config_insert ON supplier_price_list_config
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (
        users.account_type IN ('admin', 'superadmin', 'byoc')
        OR users.is_reseller = true
      )
    )
    AND
    -- Verifica che il price_list_id appartenga all'utente
    EXISTS (
      SELECT 1 FROM price_lists pl
      WHERE pl.id = supplier_price_list_config.price_list_id
      AND pl.created_by = auth.uid()
    )
  );

-- Policy: UPDATE - Solo owner o admin può aggiornare
CREATE POLICY supplier_price_list_config_update ON supplier_price_list_config
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.account_type IN ('admin', 'superadmin')
    )
    OR
    EXISTS (
      SELECT 1 FROM price_lists pl
      WHERE pl.id = supplier_price_list_config.price_list_id
      AND pl.created_by = auth.uid()
    )
  );

-- Policy: DELETE - Solo owner o admin può eliminare
CREATE POLICY supplier_price_list_config_delete ON supplier_price_list_config
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.account_type IN ('admin', 'superadmin')
    )
    OR
    EXISTS (
      SELECT 1 FROM price_lists pl
      WHERE pl.id = supplier_price_list_config.price_list_id
      AND pl.created_by = auth.uid()
    )
  );

-- ============================================
-- FUNZIONE HELPER: Crea/aggiorna config per price_list
-- ============================================

CREATE OR REPLACE FUNCTION upsert_supplier_price_list_config(
  p_price_list_id UUID,
  p_carrier_code TEXT,
  p_contract_code TEXT DEFAULT NULL,
  p_courier_config_id UUID DEFAULT NULL,
  p_insurance_config JSONB DEFAULT NULL,
  p_cod_config JSONB DEFAULT NULL,
  p_accessory_services_config JSONB DEFAULT NULL,
  p_storage_config JSONB DEFAULT NULL,
  p_pickup_config JSONB DEFAULT NULL,
  p_extra_config JSONB DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_config_id UUID;
  v_user_id UUID;
BEGIN
  -- Verifica autenticazione
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non autenticato';
  END IF;
  
  -- Verifica permessi
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = v_user_id 
    AND (
      account_type IN ('admin', 'superadmin', 'byoc')
      OR is_reseller = true
    )
  ) THEN
    RAISE EXCEPTION 'Non autorizzato: solo admin, reseller e BYOC possono configurare';
  END IF;
  
  -- Verifica ownership del price_list
  IF NOT EXISTS (
    SELECT 1 FROM price_lists 
    WHERE id = p_price_list_id 
    AND created_by = v_user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = v_user_id 
    AND account_type IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Non autorizzato: il listino non appartiene all''utente';
  END IF;
  
  -- Upsert
  INSERT INTO supplier_price_list_config (
    price_list_id,
    carrier_code,
    contract_code,
    courier_config_id,
    insurance_config,
    cod_config,
    accessory_services_config,
    storage_config,
    pickup_config,
    extra_config,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_price_list_id,
    p_carrier_code,
    p_contract_code,
    p_courier_config_id,
    COALESCE(p_insurance_config, '{}'::jsonb),
    COALESCE(p_cod_config, '[]'::jsonb),
    COALESCE(p_accessory_services_config, '[]'::jsonb),
    COALESCE(p_storage_config, '{}'::jsonb),
    COALESCE(p_pickup_config, '[]'::jsonb),
    COALESCE(p_extra_config, '{}'::jsonb),
    p_notes,
    v_user_id,
    v_user_id
  )
  ON CONFLICT (price_list_id) 
  DO UPDATE SET
    carrier_code = EXCLUDED.carrier_code,
    contract_code = EXCLUDED.contract_code,
    courier_config_id = EXCLUDED.courier_config_id,
    insurance_config = COALESCE(EXCLUDED.insurance_config, supplier_price_list_config.insurance_config),
    cod_config = COALESCE(EXCLUDED.cod_config, supplier_price_list_config.cod_config),
    accessory_services_config = COALESCE(EXCLUDED.accessory_services_config, supplier_price_list_config.accessory_services_config),
    storage_config = COALESCE(EXCLUDED.storage_config, supplier_price_list_config.storage_config),
    pickup_config = COALESCE(EXCLUDED.pickup_config, supplier_price_list_config.pickup_config),
    extra_config = COALESCE(EXCLUDED.extra_config, supplier_price_list_config.extra_config),
    notes = EXCLUDED.notes,
    updated_by = v_user_id,
    updated_at = NOW()
  RETURNING id INTO v_config_id;
  
  RETURN v_config_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION upsert_supplier_price_list_config IS 
  'Crea o aggiorna configurazione manuale per listino fornitore. Verifica permessi e ownership.';

-- ============================================
-- LOG MIGRATION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 060_supplier_price_list_config completata';
  RAISE NOTICE '  - Tabella supplier_price_list_config creata';
  RAISE NOTICE '  - RLS policies configurate';
  RAISE NOTICE '  - Funzione upsert_supplier_price_list_config creata';
END $$;

