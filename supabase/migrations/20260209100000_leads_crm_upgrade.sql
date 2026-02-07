-- ============================================
-- Platform CRM Upgrade - Leads per acquisizione reseller
-- Aggiunge: scoring, settore, volume, zona, timeline eventi, RLS workspace
-- ============================================

-- 1. Nuove colonne sulla tabella leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_source TEXT DEFAULT 'direct';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score INT DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimated_monthly_volume INT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS geographic_zone TEXT CHECK (geographic_zone IN ('nord', 'centro', 'sud', 'isole'));
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_email_opened_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_open_count INT DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_workspace_id UUID REFERENCES workspaces(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- 2. Tabella eventi timeline (come prospect_events)
CREATE TABLE IF NOT EXISTS lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'contacted', 'note_added', 'email_sent', 'email_opened',
    'qualified', 'negotiation_started', 'converted', 'lost', 'reactivated',
    'score_changed', 'assigned'
  )),
  event_data JSONB DEFAULT '{}',
  actor_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indici per performance
CREATE INDEX IF NOT EXISTS idx_leads_workspace ON leads(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(lead_source);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_sector ON leads(sector) WHERE sector IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_zone ON leads(geographic_zone) WHERE geographic_zone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_type ON lead_events(lead_id, event_type);

-- 4. RLS per lead_events
ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;

-- Admin/superadmin vedono tutti gli eventi lead
CREATE POLICY "lead_events_admin_access" ON lead_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- 5. Aggiorna policy leads esistente: manteniamo admin/superadmin access
-- La policy "Admin view all leads" gia' copre admin + superadmin per la tabella leads
-- Non serve aggiungere workspace scope perche' i leads sono platform-level (solo admin)

-- 6. Commenti
COMMENT ON TABLE lead_events IS 'Timeline eventi per lead piattaforma - CRM Livello 1';
COMMENT ON COLUMN leads.lead_score IS 'Punteggio 0-100 calcolato dall applicazione';
COMMENT ON COLUMN leads.lead_source IS 'Fonte acquisizione: direct, website_form, referral, cold_outreach, event, partner';
COMMENT ON COLUMN leads.geographic_zone IS 'Zona geografica: nord, centro, sud, isole';
COMMENT ON COLUMN leads.converted_workspace_id IS 'Workspace creato dopo conversione a reseller';
COMMENT ON COLUMN leads.converted_at IS 'Data/ora conversione a reseller';
