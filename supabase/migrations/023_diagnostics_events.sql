-- ============================================
-- DIAGNOSTICS EVENTS TABLE
-- SpedireSicuro.it - Sistema di diagnostica e monitoring
-- ============================================
-- 
-- Tabella per tracciare eventi di diagnostica, errori, warning e performance
-- Utilizzata dal servizio automation-service per logging centralizzato

CREATE TABLE IF NOT EXISTS diagnostics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR(100) NOT NULL CHECK (type IN ('error','warning','info','performance','user_action')),
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('critical','high','medium','low','info')),
  context JSONB DEFAULT '{}',
  user_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diag_type ON diagnostics_events(type);
CREATE INDEX IF NOT EXISTS idx_diag_created ON diagnostics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diag_user_id ON diagnostics_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_diag_severity ON diagnostics_events(severity);

-- RLS: Solo service role può inserire, tutti possono leggere (per dashboard)
ALTER TABLE diagnostics_events ENABLE ROW LEVEL SECURITY;

-- Policy: Lettura pubblica (per dashboard admin)
CREATE POLICY "diagnostics_events_select_public" 
  ON diagnostics_events
  FOR SELECT
  USING (true);

-- Commenti per documentazione
COMMENT ON TABLE diagnostics_events IS 'Tabella per eventi di diagnostica, errori e monitoring del sistema';
COMMENT ON COLUMN diagnostics_events.type IS 'Tipo evento: error, warning, info, performance, user_action';
COMMENT ON COLUMN diagnostics_events.severity IS 'Severità: critical, high, medium, low, info';
COMMENT ON COLUMN diagnostics_events.context IS 'Contesto JSON con dettagli aggiuntivi dell''evento (max 10KB, max 3 livelli profondità)';
