-- ============================================
-- MIGRATION: 112_create_reseller_pricing_policies
-- DESCRIZIONE: Governance opt-in prezzi reseller
-- DATA: 2026-01-17
-- CRITICITÀ: P2 - Feature governance reseller
-- ============================================
--
-- PROBLEMA:
-- I reseller hanno libertà assoluta sui listini custom, ma SuperAdmin
-- deve poter attivare protezioni (es. markup minimo) per reseller specifici.
--
-- SOLUZIONE:
-- Tabella reseller_pricing_policies con flag enforce_limits (default: false).
-- Quando enforce_limits=true, valida min_markup_percent sulle entry.
-- SuperAdmin ha sempre bypass completo.
-- ============================================

-- Tabella policy pricing reseller
CREATE TABLE IF NOT EXISTS reseller_pricing_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Governance flags (default: libertà assoluta)
  enforce_limits BOOLEAN NOT NULL DEFAULT false,
  min_markup_percent NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  notes TEXT,

  -- Constraint semplice (check range)
  CONSTRAINT min_markup_percent_range
    CHECK (min_markup_percent >= 0 AND min_markup_percent <= 100)
);

-- UNIQUE INDEX con WHERE clause (partial index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reseller_pricing_policies_reseller_active
  ON reseller_pricing_policies(reseller_id)
  WHERE revoked_at IS NULL;

-- Index per query attive
CREATE INDEX IF NOT EXISTS idx_reseller_pricing_policies_active_lookup
  ON reseller_pricing_policies(reseller_id, enforce_limits)
  WHERE revoked_at IS NULL;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_reseller_pricing_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reseller_pricing_policies_updated_at
  BEFORE UPDATE ON reseller_pricing_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_reseller_pricing_policies_updated_at();

-- RLS Policies
ALTER TABLE reseller_pricing_policies ENABLE ROW LEVEL SECURITY;

-- SuperAdmin: Full access
CREATE POLICY "SuperAdmin full access on reseller_pricing_policies"
  ON reseller_pricing_policies FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.account_type = 'superadmin'
    )
  );

-- Reseller: Read own policy
CREATE POLICY "Reseller read own pricing policy"
  ON reseller_pricing_policies FOR SELECT TO authenticated
  USING (reseller_id = auth.uid() AND revoked_at IS NULL);

-- Commenti
COMMENT ON TABLE reseller_pricing_policies IS
  'Governance opt-in per pricing reseller. Default enforce_limits=false';

COMMENT ON COLUMN reseller_pricing_policies.enforce_limits IS
  'Flag opt-in: se false (default) nessun controllo, se true valida min_markup_percent';

COMMENT ON COLUMN reseller_pricing_policies.min_markup_percent IS
  'Margine minimo percentuale richiesto quando enforce_limits=true';

-- ============================================
-- LOG MIGRATION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 112_create_reseller_pricing_policies completata';
  RAISE NOTICE '  - Tabella reseller_pricing_policies creata';
  RAISE NOTICE '  - RLS policies configurate (SuperAdmin full, Reseller read own)';
  RAISE NOTICE '  - Default: enforce_limits=false (libertà assoluta)';
END $$;
