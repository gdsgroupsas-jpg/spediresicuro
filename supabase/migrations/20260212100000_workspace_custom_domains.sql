-- ============================================================
-- Migration: workspace_custom_domains
-- Fase 5: Dominio email custom per reseller
--
-- Un workspace ha max 1 dominio custom (es. logisticamilano.it)
-- ma N indirizzi email su quel dominio.
-- Metadata dominio (DNS records, status Resend) separati dagli indirizzi.
-- ============================================================

-- Tabella dominio custom workspace
CREATE TABLE workspace_custom_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL,
  resend_domain_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  dns_records JSONB,
  region TEXT DEFAULT 'eu-west-1',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_workspace_domain UNIQUE (workspace_id),
  CONSTRAINT uq_domain_name UNIQUE (domain_name)
);

-- RLS
ALTER TABLE workspace_custom_domains ENABLE ROW LEVEL SECURITY;

-- Membri attivi possono leggere il dominio del proprio workspace
CREATE POLICY "ws_members_read_custom_domain" ON workspace_custom_domains
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- Owner/admin gestiscono (INSERT, UPDATE, DELETE)
CREATE POLICY "ws_owner_manage_custom_domain" ON workspace_custom_domains
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
  ));

-- Trigger updated_at (riusa funzione esistente)
CREATE TRIGGER update_workspace_custom_domains_updated_at
  BEFORE UPDATE ON workspace_custom_domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index per lookup rapido dominio per nome
CREATE INDEX idx_workspace_custom_domains_name ON workspace_custom_domains(domain_name);
