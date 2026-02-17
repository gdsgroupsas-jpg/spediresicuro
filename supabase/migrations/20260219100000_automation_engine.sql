-- Migration: Automation Engine
-- Crea tabelle globali per il motore di automazione governabile.
-- Le automazioni nascono DISATTIVATE, l'admin le accende/spegne/configura.
-- Tabelle GLOBALI (non multi-tenant, non in WORKSPACE_SCOPED_TABLES).

-- ============================================
-- TABELLA: automations
-- ============================================

CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',

  -- Stato: OGNI automazione nasce DISATTIVATA
  enabled BOOLEAN NOT NULL DEFAULT false,

  -- Schedule cron (es. '0 2 1 * *' = 1° del mese alle 2:00)
  schedule TEXT NOT NULL,

  -- Configurazione dinamica (parametri modificabili dall'admin)
  config JSONB NOT NULL DEFAULT '{}',

  -- Schema per generazione form UI (JSON Schema-like)
  config_schema JSONB NOT NULL DEFAULT '{}',

  -- Stato ultimo run (cache per UI veloce)
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'failure', 'partial', 'running')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indice per dispatcher: cerca solo automazioni attive
CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations (enabled) WHERE enabled = true;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_automations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_automations_updated_at ON automations;
CREATE TRIGGER trg_automations_updated_at
  BEFORE UPDATE ON automations
  FOR EACH ROW
  EXECUTE FUNCTION update_automations_updated_at();

-- ============================================
-- TABELLA: automation_runs
-- ============================================

CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,

  -- Chi ha triggerato
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('cron', 'manual', 'api')),
  triggered_by_user_id UUID,

  -- Stato esecuzione
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failure', 'partial')),

  -- Tempi
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Risultati
  result JSONB,
  error_message TEXT,
  items_processed INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0
);

-- Indice per storico: ultimo run per automazione
CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_started
  ON automation_runs (automation_id, started_at DESC);

-- Indice per pulizia/query temporali
CREATE INDEX IF NOT EXISTS idx_automation_runs_started_at
  ON automation_runs (started_at);

-- ============================================
-- GRANTS — solo service_role (backend)
-- ============================================

REVOKE ALL ON automations FROM authenticated;
REVOKE ALL ON automation_runs FROM authenticated;

GRANT ALL ON automations TO service_role;
GRANT ALL ON automation_runs TO service_role;

-- ============================================
-- COMMENTI
-- ============================================

COMMENT ON TABLE automations IS 'Automazioni governabili piattaforma — ogni automazione nasce DISATTIVATA';
COMMENT ON COLUMN automations.slug IS 'Identificativo unico leggibile (es. postpaid-monthly-billing)';
COMMENT ON COLUMN automations.enabled IS 'DISATTIVATO di default — admin attiva esplicitamente';
COMMENT ON COLUMN automations.schedule IS 'Espressione cron (es. 0 2 1 * * = 1° del mese alle 2:00)';
COMMENT ON COLUMN automations.config IS 'Parametri configurabili (dryRun, soglie, notifiche, ecc.)';
COMMENT ON COLUMN automations.config_schema IS 'JSON Schema per generazione form UI dinamica';

COMMENT ON TABLE automation_runs IS 'Storico esecuzioni automazioni con risultati e metriche';
COMMENT ON COLUMN automation_runs.triggered_by IS 'Origine: cron (scheduler), manual (admin UI), api (endpoint)';
