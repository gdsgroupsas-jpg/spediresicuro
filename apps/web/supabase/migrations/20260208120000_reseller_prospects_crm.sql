-- ============================================
-- Reseller Prospects CRM (Livello 2)
-- Pipeline prospect per reseller con scoring
-- ============================================

-- 1. Tabella principale: reseller_prospects
CREATE TABLE IF NOT EXISTS reseller_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Dati contatto
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  sector TEXT CHECK (sector IN ('ecommerce', 'food', 'pharma', 'artigianato', 'industria', 'altro')),

  -- Qualificazione
  estimated_monthly_volume INT,
  estimated_monthly_value NUMERIC(10,2),
  geographic_corridors TEXT[] DEFAULT '{}',
  shipment_types TEXT[] DEFAULT '{}',
  notes TEXT,
  tags TEXT[] DEFAULT '{}',

  -- Pipeline
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'quote_sent', 'negotiating', 'won', 'lost')),
  lost_reason TEXT,

  -- Scoring (0-100, calcolato da applicazione)
  lead_score INT DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),

  -- Assignment
  assigned_to UUID REFERENCES users(id),

  -- Collegamento preventivi commerciali
  linked_quote_ids UUID[] DEFAULT '{}',

  -- Conversione
  converted_user_id UUID REFERENCES users(id),
  converted_workspace_id UUID REFERENCES workspaces(id),
  converted_at TIMESTAMPTZ,

  -- Engagement tracking
  last_contact_at TIMESTAMPTZ,
  last_email_opened_at TIMESTAMPTZ,
  email_open_count INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabella eventi timeline
CREATE TABLE IF NOT EXISTS prospect_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES reseller_prospects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'contacted', 'note_added', 'email_sent', 'email_opened',
    'quote_created', 'quote_sent', 'quote_accepted', 'quote_rejected',
    'converted', 'lost', 'reactivated', 'score_changed'
  )),
  event_data JSONB DEFAULT '{}',
  actor_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indici per performance
CREATE INDEX idx_prospects_workspace ON reseller_prospects(workspace_id);
CREATE INDEX idx_prospects_status ON reseller_prospects(workspace_id, status);
CREATE INDEX idx_prospects_email ON reseller_prospects(email);
CREATE INDEX idx_prospects_score ON reseller_prospects(workspace_id, lead_score DESC);
CREATE INDEX idx_prospects_assigned ON reseller_prospects(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_prospects_created ON reseller_prospects(created_at DESC);
CREATE INDEX idx_prospect_events_prospect ON prospect_events(prospect_id);
CREATE INDEX idx_prospect_events_type ON prospect_events(prospect_id, event_type);

-- 4. RLS: workspace-scoped + superadmin
ALTER TABLE reseller_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_events ENABLE ROW LEVEL SECURITY;

-- Prospect: accesso per membri workspace o superadmin
CREATE POLICY "prospect_workspace_select" ON reseller_prospects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = reseller_prospects.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "prospect_workspace_insert" ON reseller_prospects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = reseller_prospects.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'operator')
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "prospect_workspace_update" ON reseller_prospects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = reseller_prospects.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'operator')
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "prospect_workspace_delete" ON reseller_prospects
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = reseller_prospects.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- Eventi: visibili a chi vede il prospect (via workspace)
CREATE POLICY "prospect_events_select" ON prospect_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reseller_prospects rp
      JOIN workspace_members wm ON wm.workspace_id = rp.workspace_id
      WHERE rp.id = prospect_events.prospect_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "prospect_events_insert" ON prospect_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM reseller_prospects rp
      JOIN workspace_members wm ON wm.workspace_id = rp.workspace_id
      WHERE rp.id = prospect_events.prospect_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin', 'operator')
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- 5. Trigger updated_at
CREATE OR REPLACE FUNCTION update_prospect_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prospect_updated_at
  BEFORE UPDATE ON reseller_prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_prospect_updated_at();

-- 6. Commenti
COMMENT ON TABLE reseller_prospects IS 'Pipeline prospect per reseller - CRM Livello 2';
COMMENT ON TABLE prospect_events IS 'Timeline eventi per prospect reseller';
COMMENT ON COLUMN reseller_prospects.lead_score IS 'Punteggio 0-100 calcolato dall applicazione';
COMMENT ON COLUMN reseller_prospects.linked_quote_ids IS 'UUID dei preventivi commerciali collegati';
