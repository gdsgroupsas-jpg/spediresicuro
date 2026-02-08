-- ============================================
-- Outreach Multi-Canale (Sprint S3)
-- Sequenze automatiche via Email, WhatsApp, Telegram
-- ============================================

-- 1. Configurazione canali per workspace
CREATE TABLE IF NOT EXISTS outreach_channel_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'telegram')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}',
  daily_limit INT DEFAULT NULL,
  -- Gap 5 fix: retry policy per provider (Telegram ha propria queue, Resend fire-and-forget)
  max_retries INT NOT NULL DEFAULT 3,
  -- Gap 2 fix: non tutti i canali supportano open/read tracking
  supports_open_tracking BOOLEAN NOT NULL DEFAULT false,
  supports_read_tracking BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, channel)
);

-- 2. Template messaggi con Handlebars
CREATE TABLE IF NOT EXISTS outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'telegram')),
  subject TEXT,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN (
    'intro', 'followup', 'quote_reminder', 'winback', 'general'
  )),
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, name, channel)
);

-- 3. Definizione sequenze
CREATE TABLE IF NOT EXISTS outreach_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_on TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_on IN (
    'manual', 'new_lead', 'new_prospect', 'status_change', 'stale', 'winback'
  )),
  target_statuses TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Step dentro una sequenza
CREATE TABLE IF NOT EXISTS outreach_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'telegram')),
  template_id UUID NOT NULL REFERENCES outreach_templates(id),
  delay_days INT NOT NULL DEFAULT 0,
  condition TEXT NOT NULL DEFAULT 'always' CHECK (condition IN (
    'always', 'no_reply', 'no_open', 'replied', 'opened'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sequence_id, step_order)
);

-- 5. Enrollment: entita' iscritta a una sequenza
CREATE TABLE IF NOT EXISTS outreach_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES outreach_sequences(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'prospect')),
  entity_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  current_step INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'paused', 'completed', 'cancelled', 'bounced'
  )),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  next_execution_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  idempotency_key TEXT UNIQUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Gap 4 fix: entity_type incluso nel UNIQUE perche' lead e prospect
  -- possono avere stesso UUID (tabelle diverse)
  UNIQUE(sequence_id, entity_type, entity_id)
);

-- 6. Esecuzioni singole (audit trail + delivery tracking)
-- Gap 1 fix: workspace_id, entity_type, entity_id denormalizzati per query rate limit/cooldown
-- senza JOIN su enrollment (performance critica per cron batch)
CREATE TABLE IF NOT EXISTS outreach_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES outreach_enrollments(id),
  step_id UUID NOT NULL REFERENCES outreach_sequence_steps(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'prospect')),
  entity_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'telegram')),
  recipient TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES outreach_templates(id),
  rendered_subject TEXT,
  rendered_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'delivered', 'opened', 'replied', 'failed', 'bounced', 'skipped'
  )),
  provider_message_id TEXT,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Consenso GDPR (modello completo: legal basis + provenance + audit)
-- Gap 3 fix: non solo boolean, serve legal basis GDPR-compliant + tracciabilita' completa
CREATE TABLE IF NOT EXISTS outreach_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'prospect')),
  entity_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'telegram')),
  consented BOOLEAN NOT NULL DEFAULT false,
  legal_basis TEXT NOT NULL DEFAULT 'consent' CHECK (legal_basis IN (
    'consent', 'legitimate_interest', 'contract', 'legal_obligation'
  )),
  consented_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'form', 'api', 'import')),
  collected_by UUID REFERENCES users(id),
  provenance_detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id, channel)
);

-- ============================================
-- INDICI
-- ============================================

CREATE INDEX idx_outreach_channel_config_workspace ON outreach_channel_config(workspace_id);
CREATE INDEX idx_outreach_templates_workspace ON outreach_templates(workspace_id, category);
CREATE INDEX idx_outreach_sequences_workspace ON outreach_sequences(workspace_id);
CREATE INDEX idx_outreach_enrollments_next ON outreach_enrollments(next_execution_at)
  WHERE status = 'active' AND next_execution_at IS NOT NULL;
CREATE INDEX idx_outreach_enrollments_workspace ON outreach_enrollments(workspace_id);
CREATE INDEX idx_outreach_enrollments_entity ON outreach_enrollments(entity_type, entity_id);
CREATE INDEX idx_outreach_executions_enrollment ON outreach_executions(enrollment_id);
CREATE INDEX idx_outreach_executions_provider_id ON outreach_executions(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX idx_outreach_executions_sent ON outreach_executions(sent_at)
  WHERE sent_at IS NOT NULL;
-- Gap 1 fix: indici per query rate limit e cooldown (colonne denormalizzate)
CREATE INDEX idx_outreach_executions_rate_limit ON outreach_executions(workspace_id, channel, sent_at)
  WHERE sent_at IS NOT NULL;
CREATE INDEX idx_outreach_executions_cooldown ON outreach_executions(entity_type, entity_id, channel, sent_at)
  WHERE sent_at IS NOT NULL;
CREATE INDEX idx_outreach_consent_entity ON outreach_consent(entity_type, entity_id, channel);

-- ============================================
-- RLS: workspace-scoped + superadmin
-- Pattern identico a reseller_prospects
-- ============================================

ALTER TABLE outreach_channel_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_consent ENABLE ROW LEVEL SECURITY;

-- Policy helper: workspace member check
-- Applicata a tutte le tabelle con workspace_id diretto

-- outreach_channel_config
CREATE POLICY "outreach_channel_config_select" ON outreach_channel_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = outreach_channel_config.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "outreach_channel_config_insert" ON outreach_channel_config
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = outreach_channel_config.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "outreach_channel_config_update" ON outreach_channel_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = outreach_channel_config.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

-- outreach_templates
CREATE POLICY "outreach_templates_select" ON outreach_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = outreach_templates.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "outreach_templates_insert" ON outreach_templates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = outreach_templates.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'operator')
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "outreach_templates_update" ON outreach_templates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = outreach_templates.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'operator')
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

-- outreach_sequences
CREATE POLICY "outreach_sequences_select" ON outreach_sequences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = outreach_sequences.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "outreach_sequences_insert" ON outreach_sequences
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = outreach_sequences.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "outreach_sequences_update" ON outreach_sequences
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = outreach_sequences.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

-- outreach_sequence_steps: accesso via sequenza
CREATE POLICY "outreach_steps_select" ON outreach_sequence_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM outreach_sequences os
      JOIN workspace_members wm ON wm.workspace_id = os.workspace_id
      WHERE os.id = outreach_sequence_steps.sequence_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "outreach_steps_insert" ON outreach_sequence_steps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM outreach_sequences os
      JOIN workspace_members wm ON wm.workspace_id = os.workspace_id
      WHERE os.id = outreach_sequence_steps.sequence_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

-- outreach_enrollments
CREATE POLICY "outreach_enrollments_select" ON outreach_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = outreach_enrollments.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "outreach_enrollments_insert" ON outreach_enrollments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = outreach_enrollments.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'operator')
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "outreach_enrollments_update" ON outreach_enrollments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = outreach_enrollments.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'operator')
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

-- outreach_executions: accesso diretto via workspace_id (denormalizzato, no JOIN)
CREATE POLICY "outreach_executions_select" ON outreach_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = outreach_executions.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "outreach_executions_insert" ON outreach_executions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = outreach_executions.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'operator')
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "outreach_executions_update" ON outreach_executions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = outreach_executions.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

-- outreach_consent: superadmin only (dati sensibili GDPR)
CREATE POLICY "outreach_consent_superadmin" ON outreach_consent
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

-- ============================================
-- TRIGGER updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_outreach_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_outreach_channel_config_updated_at
  BEFORE UPDATE ON outreach_channel_config
  FOR EACH ROW EXECUTE FUNCTION update_outreach_updated_at();

CREATE TRIGGER trg_outreach_templates_updated_at
  BEFORE UPDATE ON outreach_templates
  FOR EACH ROW EXECUTE FUNCTION update_outreach_updated_at();

CREATE TRIGGER trg_outreach_sequences_updated_at
  BEFORE UPDATE ON outreach_sequences
  FOR EACH ROW EXECUTE FUNCTION update_outreach_updated_at();

CREATE TRIGGER trg_outreach_enrollments_updated_at
  BEFORE UPDATE ON outreach_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_outreach_updated_at();

CREATE TRIGGER trg_outreach_executions_updated_at
  BEFORE UPDATE ON outreach_executions
  FOR EACH ROW EXECUTE FUNCTION update_outreach_updated_at();

CREATE TRIGGER trg_outreach_consent_updated_at
  BEFORE UPDATE ON outreach_consent
  FOR EACH ROW EXECUTE FUNCTION update_outreach_updated_at();

-- ============================================
-- COMMENTI
-- ============================================

COMMENT ON TABLE outreach_channel_config IS 'Configurazione canali outreach per workspace (email, whatsapp, telegram)';
COMMENT ON TABLE outreach_templates IS 'Template messaggi con Handlebars per outreach multi-canale';
COMMENT ON TABLE outreach_sequences IS 'Definizioni sequenze outreach multi-step';
COMMENT ON TABLE outreach_sequence_steps IS 'Step individuali dentro una sequenza outreach';
COMMENT ON TABLE outreach_enrollments IS 'Enrollment: entita (lead/prospect) iscritta a una sequenza';
COMMENT ON TABLE outreach_executions IS 'Audit trail: singoli invii con delivery tracking';
COMMENT ON TABLE outreach_consent IS 'Consenso GDPR per canale outreach';
