-- ============================================
-- ADD CORRELATION ID TO DIAGNOSTICS EVENTS
-- SpedireSicuro.it - Tracciamento richieste
-- ============================================
-- 
-- Aggiunge colonna correlation_id opzionale per tracciare le richieste
-- attraverso diversi eventi di diagnostica

-- Aggiunge colonna correlation_id opzionale
ALTER TABLE diagnostics_events 
ADD COLUMN IF NOT EXISTS correlation_id UUID NULL;

-- Aggiunge un indice per velocizzare la ricerca per correlation_id
CREATE INDEX IF NOT EXISTS idx_diag_correlation_id ON diagnostics_events(correlation_id);
