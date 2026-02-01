-- ============================================
-- SUPPORT SYSTEM MIGRATION
-- Created: 2026-02-01
-- Description: Sistema completo di assistenza e ticketing
-- ============================================

-- ============================================
-- 1. SUPPORT_TICKETS - Tabella principale ticket
-- ============================================

CREATE TABLE support_tickets (
  -- Identificatori
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  
  -- Ownership & Multi-tenant
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reseller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Classificazione
  category TEXT NOT NULL CHECK (category IN (
    'spedizione',
    'giacenza',
    'wallet',
    'fattura',
    'tecnico',
    'configurazione',
    'altro'
  )),
  
  priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN (
    'bassa',
    'media',
    'alta',
    'urgente'
  )),
  
  status TEXT NOT NULL DEFAULT 'nuovo' CHECK (status IN (
    'nuovo',
    'in_lavorazione',
    'attesa_cliente',
    'attesa_corriere',
    'risolto',
    'chiuso'
  )),
  
  -- Contenuto
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Riferimenti Contestuali (tutti opzionali)
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  
  -- Assignment
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  
  -- SLA Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_response_at TIMESTAMPTZ,
  first_response_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Valutazione Cliente
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}',
  
  -- Audit
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indici per performance
CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_reseller_id ON support_tickets(reseller_id) WHERE reseller_id IS NOT NULL;
CREATE INDEX idx_support_tickets_assigned_to ON support_tickets(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_category ON support_tickets(category);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX idx_support_tickets_shipment_id ON support_tickets(shipment_id) WHERE shipment_id IS NOT NULL;

-- Full-text search
CREATE INDEX idx_support_tickets_search ON support_tickets 
  USING gin(to_tsvector('italian', subject || ' ' || description));

-- Sequence per ticket_number
CREATE SEQUENCE support_ticket_number_seq START 1;

-- Function per generare ticket_number automatico
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number := 'TKT-' || 
                       TO_CHAR(NOW(), 'YYYY') || '-' || 
                       LPAD(nextval('support_ticket_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per auto-incremento ticket_number
CREATE TRIGGER trg_generate_ticket_number
  BEFORE INSERT ON support_tickets
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL)
  EXECUTE FUNCTION generate_ticket_number();

-- Trigger per updated_at
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. SUPPORT_MESSAGES - Messaggi/Conversazioni
-- ============================================

CREATE TABLE support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  
  -- Autore
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_role TEXT NOT NULL,
  
  -- Contenuto
  message TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_messages_ticket_id ON support_messages(ticket_id);
CREATE INDEX idx_support_messages_created_at ON support_messages(created_at);
CREATE INDEX idx_support_messages_user_id ON support_messages(user_id);

-- ============================================
-- 3. SUPPORT_ATTACHMENTS - Allegati
-- ============================================

CREATE TABLE support_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Riferimenti
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  message_id UUID REFERENCES support_messages(id) ON DELETE CASCADE,
  
  -- File info
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  
  -- Metadata
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Almeno uno dei due deve essere NOT NULL
  CONSTRAINT chk_attachment_reference CHECK (
    ticket_id IS NOT NULL OR message_id IS NOT NULL
  )
);

CREATE INDEX idx_support_attachments_ticket_id ON support_attachments(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX idx_support_attachments_message_id ON support_attachments(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_support_attachments_uploaded_by ON support_attachments(uploaded_by);

-- ============================================
-- 4. SUPPORT_ACTIONS - Log azioni
-- ============================================

CREATE TABLE support_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  
  -- Chi ha eseguito l'azione
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tipo azione
  action_type TEXT NOT NULL CHECK (action_type IN (
    'created',
    'status_change',
    'priority_change',
    'assignment',
    'shipment_action',
    'giacenza_action',
    'wallet_action',
    'note_added',
    'rating_submitted'
  )),
  
  -- Dati azione (JSON flessibile)
  action_data JSONB NOT NULL,
  
  -- Risultato
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_actions_ticket_id ON support_actions(ticket_id);
CREATE INDEX idx_support_actions_action_type ON support_actions(action_type);
CREATE INDEX idx_support_actions_created_at ON support_actions(created_at DESC);
CREATE INDEX idx_support_actions_user_id ON support_actions(user_id);

-- ============================================
-- 5. SUPPORT_KB_ARTICLES - Knowledge Base
-- ============================================

CREATE TABLE support_kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contenuto
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  
  -- Classificazione
  category TEXT NOT NULL CHECK (category IN (
    'spedizioni',
    'giacenze',
    'wallet',
    'fatture',
    'configurazione',
    'integrazioni',
    'faq'
  )),
  
  tags TEXT[] DEFAULT '{}',
  
  -- Metriche
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  
  -- Publishing
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  
  -- SEO
  meta_description TEXT,
  
  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_support_kb_articles_category ON support_kb_articles(category);
CREATE INDEX idx_support_kb_articles_published ON support_kb_articles(published);
CREATE INDEX idx_support_kb_articles_slug ON support_kb_articles(slug);
CREATE INDEX idx_support_kb_articles_created_by ON support_kb_articles(created_by);

-- Full-text search
CREATE INDEX idx_support_kb_articles_search ON support_kb_articles 
  USING gin(to_tsvector('italian', title || ' ' || content || ' ' || COALESCE(excerpt, '')));

-- Trigger per updated_at
CREATE TRIGGER trg_support_kb_articles_updated_at
  BEFORE UPDATE ON support_kb_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. SUPPORT_CANNED_RESPONSES - Risposte Predefinite
-- ============================================

CREATE TABLE support_canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  title TEXT NOT NULL,
  shortcut TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  
  category TEXT,
  
  usage_count INTEGER DEFAULT 0,
  
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_canned_responses_shortcut ON support_canned_responses(shortcut);
CREATE INDEX idx_support_canned_responses_category ON support_canned_responses(category) WHERE category IS NOT NULL;

-- Trigger per updated_at
CREATE TRIGGER trg_support_canned_responses_updated_at
  BEFORE UPDATE ON support_canned_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================

-- SUPPORT_TICKETS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- SELECT: Utenti vedono solo i propri ticket
CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT
  USING (user_id = auth.uid());

-- SELECT: Reseller vedono ticket propri e dei sub-users
CREATE POLICY "Resellers can view sub-users tickets"
  ON support_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = support_tickets.user_id
      AND u.reseller_id = auth.uid()
    )
  );

-- SELECT: Operatori/Admin vedono tutto
CREATE POLICY "Operators can view all tickets"
  ON support_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'operator', 'superadmin')
    )
  );

-- INSERT: Utenti possono creare ticket
CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Utenti possono aggiornare solo i propri ticket (limitato)
CREATE POLICY "Users can update own tickets"
  ON support_tickets FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Operatori possono aggiornare tutti i ticket
CREATE POLICY "Operators can update all tickets"
  ON support_tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'operator', 'superadmin')
    )
  );

-- SUPPORT_MESSAGES
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: Eredita visibilità dal ticket
CREATE POLICY "Users can view messages of accessible tickets"
  ON support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_messages.ticket_id
      AND (
        t.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM auth.users u
          WHERE u.id = t.user_id
          AND u.reseller_id = auth.uid()
        ) OR
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() 
          AND role IN ('admin', 'operator', 'superadmin')
        )
      )
    )
    AND (
      -- Non mostrare note interne ai clienti
      NOT is_internal OR
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'operator', 'superadmin')
      )
    )
  );

-- INSERT: Utenti possono aggiungere messaggi ai propri ticket
CREATE POLICY "Users can add messages to own tickets"
  ON support_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = ticket_id
      AND t.user_id = auth.uid()
    )
  );

-- INSERT: Operatori possono aggiungere messaggi a tutti i ticket
CREATE POLICY "Operators can add messages to all tickets"
  ON support_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'operator', 'superadmin')
    )
  );

-- SUPPORT_ATTACHMENTS
ALTER TABLE support_attachments ENABLE ROW LEVEL SECURITY;

-- SELECT: Eredita visibilità dal ticket
CREATE POLICY "Users can view attachments of accessible tickets"
  ON support_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_attachments.ticket_id
      AND (
        t.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM auth.users u
          WHERE u.id = t.user_id
          AND u.reseller_id = auth.uid()
        ) OR
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() 
          AND role IN ('admin', 'operator', 'superadmin')
        )
      )
    )
  );

-- INSERT: Utenti possono caricare allegati ai propri ticket
CREATE POLICY "Users can upload attachments to own tickets"
  ON support_attachments FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = ticket_id
      AND t.user_id = auth.uid()
    )
  );

-- INSERT: Operatori possono caricare allegati a tutti i ticket
CREATE POLICY "Operators can upload attachments to all tickets"
  ON support_attachments FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'operator', 'superadmin')
    )
  );

-- SUPPORT_ACTIONS
ALTER TABLE support_actions ENABLE ROW LEVEL SECURITY;

-- SELECT: Solo operatori possono vedere le azioni
CREATE POLICY "Operators can view all actions"
  ON support_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'operator', 'superadmin')
    )
  );

-- INSERT: Solo operatori possono registrare azioni
CREATE POLICY "Operators can log actions"
  ON support_actions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'operator', 'superadmin')
    )
  );

-- SUPPORT_KB_ARTICLES
ALTER TABLE support_kb_articles ENABLE ROW LEVEL SECURITY;

-- SELECT: Tutti possono vedere articoli pubblicati
CREATE POLICY "Anyone can view published articles"
  ON support_kb_articles FOR SELECT
  USING (published = TRUE);

-- SELECT: Admin/Operatori vedono anche bozze
CREATE POLICY "Operators can view all articles"
  ON support_kb_articles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'operator', 'superadmin')
    )
  );

-- INSERT/UPDATE/DELETE: Solo admin
CREATE POLICY "Admins can manage articles"
  ON support_kb_articles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- SUPPORT_CANNED_RESPONSES
ALTER TABLE support_canned_responses ENABLE ROW LEVEL SECURITY;

-- SELECT: Solo operatori
CREATE POLICY "Operators can view canned responses"
  ON support_canned_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'operator', 'superadmin')
    )
  );

-- INSERT/UPDATE/DELETE: Solo admin
CREATE POLICY "Admins can manage canned responses"
  ON support_canned_responses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function per ottenere statistiche ticket
CREATE OR REPLACE FUNCTION get_support_stats(p_user_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_stats JSON;
BEGIN
  SELECT json_build_object(
    'total_tickets', COUNT(*),
    'open_tickets', COUNT(*) FILTER (WHERE status IN ('nuovo', 'in_lavorazione')),
    'awaiting_customer', COUNT(*) FILTER (WHERE status = 'attesa_cliente'),
    'resolved_tickets', COUNT(*) FILTER (WHERE status = 'risolto'),
    'closed_tickets', COUNT(*) FILTER (WHERE status = 'chiuso'),
    'avg_rating', AVG(rating) FILTER (WHERE rating IS NOT NULL),
    'urgent_tickets', COUNT(*) FILTER (WHERE priority = 'urgente' AND status NOT IN ('risolto', 'chiuso'))
  ) INTO v_stats
  FROM support_tickets
  WHERE p_user_id IS NULL OR user_id = p_user_id;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function per ottenere metriche SLA
CREATE OR REPLACE FUNCTION get_support_sla_metrics(p_days INTEGER DEFAULT 7)
RETURNS JSON AS $$
DECLARE
  v_metrics JSON;
BEGIN
  SELECT json_build_object(
    'avg_first_response_minutes', 
      AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60) 
      FILTER (WHERE first_response_at IS NOT NULL),
    'avg_resolution_hours',
      AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
      FILTER (WHERE resolved_at IS NOT NULL),
    'tickets_resolved_in_period',
      COUNT(*) FILTER (WHERE resolved_at >= NOW() - (p_days || ' days')::INTERVAL),
    'sla_compliance_rate',
      (COUNT(*) FILTER (WHERE 
        first_response_at IS NOT NULL AND
        EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600 <= 2
      )::FLOAT / NULLIF(COUNT(*) FILTER (WHERE first_response_at IS NOT NULL), 0) * 100)
  ) INTO v_metrics
  FROM support_tickets
  WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL;
  
  RETURN v_metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE support_tickets IS 'Ticket di assistenza clienti';
COMMENT ON TABLE support_messages IS 'Messaggi e conversazioni nei ticket';
COMMENT ON TABLE support_attachments IS 'Allegati ai ticket';
COMMENT ON TABLE support_actions IS 'Log delle azioni eseguite sui ticket';
COMMENT ON TABLE support_kb_articles IS 'Articoli della knowledge base';
COMMENT ON TABLE support_canned_responses IS 'Risposte predefinite per operatori';

COMMENT ON COLUMN support_tickets.ticket_number IS 'Numero ticket formato TKT-YYYY-00001';
COMMENT ON COLUMN support_tickets.reseller_id IS 'ID del reseller (ereditato da user)';
COMMENT ON COLUMN support_messages.is_internal IS 'Note interne visibili solo a operatori';
COMMENT ON COLUMN support_actions.action_data IS 'Dati JSON flessibili per ogni tipo di azione';
