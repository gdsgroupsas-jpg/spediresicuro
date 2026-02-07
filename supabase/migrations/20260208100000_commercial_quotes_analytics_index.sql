-- ============================================
-- Indici per analytics preventivi commerciali
-- Fase B: Dashboard Analytics + Self-Learning
-- ============================================

-- Indice composito per aggregazioni analytics (solo root quotes)
CREATE INDEX IF NOT EXISTS idx_commercial_quotes_analytics
  ON public.commercial_quotes(workspace_id, status, carrier_code, prospect_sector)
  WHERE parent_quote_id IS NULL;

-- Indice timeline (preventivi per settimana/mese)
CREATE INDEX IF NOT EXISTS idx_commercial_quotes_created_at
  ON public.commercial_quotes(workspace_id, created_at DESC);

-- FIX: indice expires_at deve coprire anche 'negotiating' (non solo 'sent')
DROP INDEX IF EXISTS idx_commercial_quotes_expires_at;
CREATE INDEX IF NOT EXISTS idx_commercial_quotes_expires_at
  ON public.commercial_quotes(expires_at)
  WHERE expires_at IS NOT NULL AND status IN ('sent', 'negotiating');
