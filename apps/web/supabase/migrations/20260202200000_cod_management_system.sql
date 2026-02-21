-- ============================================
-- COD (Contrassegni) Management System
-- Created: 2026-02-02
-- Description: Tabelle per gestione contrassegni
--              admin-only: upload file, matching,
--              distinte e pagamenti.
-- ============================================

-- File caricati dai fornitori
CREATE TABLE IF NOT EXISTS cod_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  carrier TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_rows INT NOT NULL DEFAULT 0,
  processed_rows INT NOT NULL DEFAULT 0,
  total_cod_file NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cod_system NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cod_to_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cod_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  errors INT NOT NULL DEFAULT 0
);

-- Distinte raggruppate per cliente
CREATE TABLE IF NOT EXISTS cod_distinte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number SERIAL,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_initial NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_reimbursed NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT CHECK (payment_method IN ('assegno', 'sepa', 'contanti', 'compensata')),
  status TEXT NOT NULL DEFAULT 'in_lavorazione' CHECK (status IN ('in_lavorazione', 'pagata')),
  payment_date TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

-- Singoli contrassegni (righe dal file)
CREATE TABLE IF NOT EXISTS cod_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_file_id UUID NOT NULL REFERENCES cod_files(id) ON DELETE CASCADE,
  ldv TEXT NOT NULL,
  rif_mittente TEXT,
  contrassegno NUMERIC(12,2) NOT NULL DEFAULT 0,
  pagato NUMERIC(12,2) NOT NULL DEFAULT 0,
  destinatario TEXT,
  note TEXT,
  data_ldv TIMESTAMPTZ,
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
  client_id UUID REFERENCES users(id) ON DELETE SET NULL,
  distinta_id UUID REFERENCES cod_distinte(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'in_attesa' CHECK (status IN ('in_attesa', 'assegnato', 'rimborsato')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dispute / discrepanze contrassegni
CREATE TABLE IF NOT EXISTS cod_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_item_id UUID REFERENCES cod_items(id) ON DELETE CASCADE,
  cod_file_id UUID REFERENCES cod_files(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('importo_diverso', 'non_trovato', 'duplicato', 'altro')),
  status TEXT NOT NULL DEFAULT 'aperta' CHECK (status IN ('aperta', 'risolta', 'ignorata')),
  expected_amount NUMERIC(12,2),
  actual_amount NUMERIC(12,2),
  difference NUMERIC(12,2),
  ldv TEXT,
  description TEXT,
  resolution_note TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX idx_cod_items_ldv ON cod_items(ldv);
CREATE INDEX idx_cod_items_shipment_id ON cod_items(shipment_id);
CREATE INDEX idx_cod_items_client_id ON cod_items(client_id);
CREATE INDEX idx_cod_items_distinta_id ON cod_items(distinta_id);
CREATE INDEX idx_cod_items_status ON cod_items(status);
CREATE INDEX idx_cod_files_uploaded_by ON cod_files(uploaded_by);
CREATE INDEX idx_cod_distinte_client_id ON cod_distinte(client_id);
CREATE INDEX idx_cod_distinte_status ON cod_distinte(status);
CREATE INDEX idx_cod_disputes_status ON cod_disputes(status);
CREATE INDEX idx_cod_disputes_cod_file_id ON cod_disputes(cod_file_id);

-- RLS: admin-only su tutte le tabelle
ALTER TABLE cod_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE cod_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cod_distinte ENABLE ROW LEVEL SECURITY;
ALTER TABLE cod_disputes ENABLE ROW LEVEL SECURITY;

-- cod_files: solo admin
CREATE POLICY "Admins manage cod_files"
  ON cod_files FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- cod_items: solo admin
CREATE POLICY "Admins manage cod_items"
  ON cod_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- cod_distinte: solo admin
CREATE POLICY "Admins manage cod_distinte"
  ON cod_distinte FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- cod_disputes: solo admin
CREATE POLICY "Admins manage cod_disputes"
  ON cod_disputes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- Service role bypass (per API routes con supabaseAdmin)
CREATE POLICY "Service role full access cod_files"
  ON cod_files FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access cod_items"
  ON cod_items FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access cod_distinte"
  ON cod_distinte FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access cod_disputes"
  ON cod_disputes FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- RLS: Clienti possono vedere i propri dati
-- ============================================

-- cod_items: utenti vedono i propri
CREATE POLICY "Users can view own cod_items"
  ON cod_items FOR SELECT
  USING (client_id = auth.uid());

-- cod_distinte: utenti vedono le proprie
CREATE POLICY "Users can view own cod_distinte"
  ON cod_distinte FOR SELECT
  USING (client_id = auth.uid());

-- ============================================
-- Trigger: Sync cod_items.status → shipments.cod_status
-- ============================================
-- Mappa: in_attesa → collected, assegnato → collected, rimborsato → paid

CREATE OR REPLACE FUNCTION sync_cod_item_to_shipment()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo se c'è un shipment_id associato
  IF NEW.shipment_id IS NOT NULL THEN
    UPDATE shipments SET
      cod_status = CASE
        WHEN NEW.status = 'rimborsato' THEN 'paid'::cod_status_type
        ELSE 'collected'::cod_status_type
      END,
      contrassegno_amount = NEW.pagato
    WHERE id = NEW.shipment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_cod_item_sync_shipment
  AFTER INSERT OR UPDATE OF status ON cod_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_cod_item_to_shipment();

COMMENT ON TABLE cod_files IS 'File Excel/CSV contrassegni caricati dai fornitori';
COMMENT ON TABLE cod_items IS 'Singoli contrassegni estratti dai file, matchati con spedizioni';
COMMENT ON TABLE cod_distinte IS 'Distinte raggruppate per cliente per pagamento contrassegni';
