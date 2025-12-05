-- ============================================
-- MIGRATION: Anne AI Assistant Setup
-- ============================================
-- Data: 2024-12-05
-- Descrizione: Setup completo per Anne, Executive Business Partner
-- Include: audit_logs, aggiornamenti shipments, users
-- ============================================

-- ========== AUDIT LOGS TABLE ==========
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  message TEXT NOT NULL,
  stack_trace TEXT,
  metadata JSONB,
  endpoint TEXT,
  ip_address INET
);

-- Indici audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity_created ON audit_logs(severity, created_at DESC);

-- ========== AGGIORNAMENTI SHIPMENTS TABLE ==========
-- Aggiungi colonne se non esistono (per compatibilità con schema esistente)

-- Verifica e aggiungi colonne mancanti
DO $$ 
BEGIN
  -- recipient_name (potrebbe già esistere come recipient_name)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'recipient_name') THEN
    ALTER TABLE shipments ADD COLUMN recipient_name TEXT;
  END IF;

  -- recipient_address
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'recipient_address') THEN
    ALTER TABLE shipments ADD COLUMN recipient_address TEXT;
  END IF;

  -- recipient_city
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'recipient_city') THEN
    ALTER TABLE shipments ADD COLUMN recipient_city TEXT;
  END IF;

  -- recipient_postal_code
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'recipient_postal_code') THEN
    ALTER TABLE shipments ADD COLUMN recipient_postal_code TEXT;
  END IF;

  -- recipient_province
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'recipient_province') THEN
    ALTER TABLE shipments ADD COLUMN recipient_province TEXT;
  END IF;

  -- recipient_phone
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'recipient_phone') THEN
    ALTER TABLE shipments ADD COLUMN recipient_phone TEXT;
  END IF;

  -- recipient_email
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'recipient_email') THEN
    ALTER TABLE shipments ADD COLUMN recipient_email TEXT;
  END IF;

  -- weight (potrebbe già esistere)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'weight') THEN
    ALTER TABLE shipments ADD COLUMN weight NUMERIC(6,2);
  END IF;

  -- packages
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'packages') THEN
    ALTER TABLE shipments ADD COLUMN packages INTEGER DEFAULT 1;
  END IF;

  -- carrier (potrebbe già esistere)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'carrier') THEN
    ALTER TABLE shipments ADD COLUMN carrier TEXT;
  END IF;

  -- service_type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'service_type') THEN
    ALTER TABLE shipments ADD COLUMN service_type TEXT;
  END IF;

  -- tracking_number (potrebbe già esistere)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'tracking_number') THEN
    ALTER TABLE shipments ADD COLUMN tracking_number TEXT UNIQUE;
  END IF;

  -- base_price
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'base_price') THEN
    ALTER TABLE shipments ADD COLUMN base_price NUMERIC(10,2);
  END IF;

  -- final_price (potrebbe già esistere)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'final_price') THEN
    ALTER TABLE shipments ADD COLUMN final_price NUMERIC(10,2);
  END IF;

  -- contrassegno_amount
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'contrassegno_amount') THEN
    ALTER TABLE shipments ADD COLUMN contrassegno_amount NUMERIC(10,2) DEFAULT 0;
  END IF;

  -- status (potrebbe già esistere)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'status') THEN
    ALTER TABLE shipments ADD COLUMN status TEXT DEFAULT 'draft';
  END IF;

  -- notes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'notes') THEN
    ALTER TABLE shipments ADD COLUMN notes TEXT;
  END IF;

  -- metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'metadata') THEN
    ALTER TABLE shipments ADD COLUMN metadata JSONB;
  END IF;

  -- updated_at (potrebbe già esistere)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shipments' AND column_name = 'updated_at') THEN
    ALTER TABLE shipments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Aggiungi constraint se non esistono
DO $$
BEGIN
  -- Constraint peso
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE table_name = 'shipments' AND constraint_name = 'shipments_weight_check') THEN
    ALTER TABLE shipments ADD CONSTRAINT shipments_weight_check 
      CHECK (weight IS NULL OR (weight > 0 AND weight <= 200));
  END IF;

  -- Constraint contrassegno
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE table_name = 'shipments' AND constraint_name = 'shipments_contrassegno_check') THEN
    ALTER TABLE shipments ADD CONSTRAINT shipments_contrassegno_check 
      CHECK (contrassegno_amount IS NULL OR contrassegno_amount >= 0);
  END IF;

  -- Constraint CAP
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE table_name = 'shipments' AND constraint_name = 'shipments_postal_code_check') THEN
    ALTER TABLE shipments ADD CONSTRAINT shipments_postal_code_check 
      CHECK (recipient_postal_code IS NULL OR recipient_postal_code ~ '^\d{5}$');
  END IF;

  -- Constraint provincia
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE table_name = 'shipments' AND constraint_name = 'shipments_province_check') THEN
    ALTER TABLE shipments ADD CONSTRAINT shipments_province_check 
      CHECK (recipient_province IS NULL OR recipient_province ~ '^[A-Z]{2}$');
  END IF;
END $$;

-- Indici shipments (se non esistono)
CREATE INDEX IF NOT EXISTS idx_shipments_user_id ON shipments(user_id);
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier ON shipments(carrier);
CREATE INDEX IF NOT EXISTS idx_shipments_user_created ON shipments(user_id, created_at DESC);

-- Trigger per updated_at (se non esiste)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_shipments_updated_at ON shipments;
CREATE TRIGGER update_shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========== AGGIORNAMENTI USERS TABLE ==========
-- Aggiungi colonne se non esistono

DO $$
BEGIN
  -- role
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'role') THEN
    ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user' 
      CHECK (role IN ('admin', 'user'));
  END IF;

  -- full_name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'full_name') THEN
    ALTER TABLE users ADD COLUMN full_name TEXT;
  END IF;
END $$;

-- Indice users role
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ========== RLS POLICIES ==========

-- Shipments RLS
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- Rimuovi policy esistenti se ci sono
DROP POLICY IF EXISTS "Users can view own shipments" ON shipments;
DROP POLICY IF EXISTS "Users can insert own shipments" ON shipments;
DROP POLICY IF EXISTS "Users can update own shipments" ON shipments;
DROP POLICY IF EXISTS "Admins can view all shipments" ON shipments;

-- Crea nuove policy
CREATE POLICY "Users can view own shipments"
  ON shipments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shipments"
  ON shipments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shipments"
  ON shipments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all shipments"
  ON shipments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Audit Logs RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;

CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- ========== PERFORMANCE VIEWS ==========

-- View per statistiche rapide admin
CREATE OR REPLACE VIEW admin_monthly_stats AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS total_shipments,
  SUM(final_price) AS total_revenue,
  SUM(final_price - COALESCE(base_price, 0)) AS total_margin,
  AVG(final_price - COALESCE(base_price, 0)) AS avg_margin,
  carrier,
  COUNT(DISTINCT user_id) AS unique_customers
FROM shipments
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at), carrier
ORDER BY month DESC, total_revenue DESC;

-- View per top clienti
CREATE OR REPLACE VIEW top_customers AS
SELECT
  u.id AS user_id,
  u.full_name,
  COUNT(s.id) AS total_shipments,
  SUM(s.final_price) AS total_spent,
  SUM(s.final_price - COALESCE(s.base_price, 0)) AS total_margin,
  MAX(s.created_at) AS last_shipment_date
FROM users u
INNER JOIN shipments s ON u.id = s.user_id
WHERE s.created_at >= NOW() - INTERVAL '6 months'
GROUP BY u.id, u.full_name
ORDER BY total_spent DESC
LIMIT 50;

-- ========== COMMENTI ==========
COMMENT ON TABLE audit_logs IS 'Log di audit per tracciare operazioni e errori di sistema';
COMMENT ON VIEW admin_monthly_stats IS 'Statistiche mensili per admin dashboard';
COMMENT ON VIEW top_customers IS 'Top 50 clienti per fatturato ultimi 6 mesi';

