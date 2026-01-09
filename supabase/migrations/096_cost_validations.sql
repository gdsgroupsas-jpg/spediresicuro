-- ============================================
-- MIGRATION: 096_cost_validations.sql
-- DESCRIZIONE: Tabella per validazione costi DB vs API (solo superadmin)
-- ============================================

-- Tabella per tracciare differenze tra prezzi DB e API
-- Usata per validazione silenziosa quando superadmin crea spedizioni
CREATE TABLE IF NOT EXISTS cost_validations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- ============================================
  -- RIFERIMENTO SPEDIZIONE
  -- ============================================
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  tracking_number TEXT,
  
  -- ============================================
  -- PREZZI CONFRONTATI
  -- ============================================
  -- Prezzo calcolato da DB (listino master)
  db_price DECIMAL(10,2) NOT NULL,
  
  -- Prezzo ottenuto da API reale
  api_price DECIMAL(10,2) NOT NULL,
  
  -- Differenza assoluta
  price_difference DECIMAL(10,2) GENERATED ALWAYS AS (api_price - db_price) STORED,
  
  -- Differenza percentuale
  price_difference_percent DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN db_price > 0 
    THEN ((api_price - db_price) / db_price * 100)
    ELSE 0 END
  ) STORED,
  
  -- ============================================
  -- DETTAGLI CONTRATTO
  -- ============================================
  courier_code TEXT NOT NULL,
  contract_code TEXT,
  config_id UUID, -- Configurazione API usata
  
  -- ============================================
  -- PARAMETRI SPEDIZIONE
  -- ============================================
  weight DECIMAL(10,2),
  destination_zip TEXT,
  destination_province TEXT,
  
  -- ============================================
  -- STATO VALIDAZIONE
  -- ============================================
  -- Se differenza > soglia (default 5%), richiede attenzione
  -- ⚠️ FIX: Non possiamo usare price_difference_percent (colonna generata)
  -- Calcoliamo direttamente dalla formula
  requires_attention BOOLEAN GENERATED ALWAYS AS (
    CASE 
      WHEN db_price > 0 THEN ABS((api_price - db_price) / db_price * 100) > 5.0
      ELSE false
    END
  ) STORED,
  
  -- Soglia personalizzata (opzionale)
  threshold_percent DECIMAL(5,2) DEFAULT 5.0,
  
  -- ============================================
  -- AZIONI
  -- ============================================
  -- Se superadmin ha sincronizzato il listino dopo questa validazione
  listino_synced BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ,
  
  -- ============================================
  -- METADATA
  -- ============================================
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- ============================================
  -- AUDIT
  -- ============================================
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- ============================================
  -- CONSTRAINTS
  -- ============================================
  CONSTRAINT price_difference_check CHECK (ABS(price_difference) >= 0)
);

-- Indici per query veloci
CREATE INDEX IF NOT EXISTS idx_cost_validations_shipment ON cost_validations(shipment_id);
CREATE INDEX IF NOT EXISTS idx_cost_validations_requires_attention ON cost_validations(requires_attention) WHERE requires_attention = true;
CREATE INDEX IF NOT EXISTS idx_cost_validations_created_at ON cost_validations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_validations_courier ON cost_validations(courier_code);

-- RLS: Solo superadmin può vedere le validazioni
ALTER TABLE cost_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY cost_validations_select ON cost_validations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.account_type = 'superadmin'
    )
  );

CREATE POLICY cost_validations_insert ON cost_validations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.account_type = 'superadmin'
    )
  );

CREATE POLICY cost_validations_update ON cost_validations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.account_type = 'superadmin'
    )
  );

COMMENT ON TABLE cost_validations IS 
  'Traccia differenze tra prezzi DB (listino master) e API reali per validazione costi superadmin';

COMMENT ON COLUMN cost_validations.requires_attention IS 
  'True se differenza percentuale > soglia (default 5%)';
