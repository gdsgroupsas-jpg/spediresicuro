-- Migration: 026_add_leads_system.sql
-- Descrizione: Aggiunge tabella leads per il CRM

-- Enum per lo stato del lead
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'negotiation', 'won', 'lost');

-- Tabella Leads
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Se il lead è convertito in utente o assegnato
    company_name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    status lead_status DEFAULT 'new',
    source TEXT, -- es. 'website', 'referral', 'manual'
    notes TEXT,
    estimated_value DECIMAL(10, 2),
    assigned_to UUID REFERENCES auth.users(id), -- Agente assegnato
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_contact_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);

-- Trigger aggiornamento updated_at
CREATE TRIGGER update_leads_modtime
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- RLS Policies
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- 1. Admin/Superadmin vedono tutto
CREATE POLICY "Admin view all leads" ON leads
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- 2. Reseller/Agenti vedono solo i propri lead (assegnati o creati da loro se implementiamo created_by)
-- Per ora semplifichiamo: Admin vede tutto.
-- TODO: Aggiungere policy per Sales Agent specifici se necessario.

-- Grant permissions
GRANT ALL ON leads TO service_role;
GRANT ALL ON leads TO authenticated; -- L'accesso è controllato da RLS
