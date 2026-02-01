-- ============================================
-- ANNE CASE PATTERNS (Apprendimento)
-- Created: 2026-02-02
-- Description: Tabella per i pattern appresi da
--              Anne durante la risoluzione dei casi.
--              Anne impara dai casi risolti e migliora
--              le risposte per casi simili futuri.
-- ============================================

-- Pattern appresi da casi risolti
CREATE TABLE support_case_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tipo di problema
  category TEXT NOT NULL CHECK (category IN (
    'giacenza', 'cancellazione', 'rimborso', 'tracking', 'creazione', 'generico'
  )),

  -- Corriere specifico (NULL = tutti)
  carrier TEXT,

  -- Pattern di riconoscimento (keywords, motivo giacenza, status, etc.)
  trigger_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- es: { "hold_reason": "destinatario_assente", "carrier": "GLS" }
  -- es: { "keywords": ["non arriva", "smarrita"], "days_stale": 7 }

  -- Soluzione applicata con successo
  resolution_action TEXT NOT NULL,
  -- es: "riconsegna", "reso_mittente", "refund", "escalate"

  -- Parametri usati nella risoluzione
  resolution_params JSONB DEFAULT '{}'::jsonb,

  -- Messaggio template che ha funzionato
  successful_message TEXT,

  -- Contatore: quante volte questo pattern e stato applicato con successo
  success_count INTEGER NOT NULL DEFAULT 1,

  -- Contatore: quante volte e fallito
  failure_count INTEGER NOT NULL DEFAULT 0,

  -- Score di affidabilita (calcolato: success / (success + failure))
  confidence_score NUMERIC(3,2) NOT NULL DEFAULT 1.00,

  -- Tempo medio di risoluzione (secondi)
  avg_resolution_time_seconds INTEGER,

  -- Feedback utente medio (1-5, NULL se non disponibile)
  avg_user_satisfaction NUMERIC(2,1),

  -- Da quale escalation/caso e stato appreso
  source_escalation_id UUID REFERENCES support_escalations(id) ON DELETE SET NULL,

  -- Se il pattern e stato validato da un operatore umano
  human_validated BOOLEAN NOT NULL DEFAULT false,
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,

  -- Attivo/disattivo
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Indici
CREATE INDEX idx_case_patterns_category ON support_case_patterns(category);
CREATE INDEX idx_case_patterns_carrier ON support_case_patterns(carrier) WHERE carrier IS NOT NULL;
CREATE INDEX idx_case_patterns_confidence ON support_case_patterns(confidence_score DESC) WHERE is_active = true;
CREATE INDEX idx_case_patterns_active ON support_case_patterns(is_active, category);

-- Interaction log: ogni volta che Anne usa un pattern, registra il risultato
CREATE TABLE support_pattern_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  pattern_id UUID NOT NULL REFERENCES support_case_patterns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,

  -- Esito
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'partial', 'escalated')),

  -- Tempo di risoluzione (secondi dall'inizio alla conferma/chiusura)
  resolution_time_seconds INTEGER,

  -- Il messaggio utente che ha triggato il pattern
  user_message TEXT,

  -- Feedback esplicito dell'utente (opzionale)
  user_feedback INTEGER CHECK (user_feedback BETWEEN 1 AND 5),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pattern_usage_pattern ON support_pattern_usage(pattern_id);
CREATE INDEX idx_pattern_usage_outcome ON support_pattern_usage(outcome);

-- Trigger: aggiorna confidence_score dopo ogni usage
CREATE OR REPLACE FUNCTION update_pattern_confidence()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_case_patterns SET
    success_count = CASE
      WHEN NEW.outcome IN ('success', 'partial') THEN success_count + 1
      ELSE success_count
    END,
    failure_count = CASE
      WHEN NEW.outcome IN ('failure', 'escalated') THEN failure_count + 1
      ELSE failure_count
    END,
    confidence_score = ROUND(
      (success_count + CASE WHEN NEW.outcome IN ('success', 'partial') THEN 1 ELSE 0 END)::numeric /
      GREATEST(
        (success_count + failure_count + 1)::numeric,
        1
      ),
      2
    ),
    last_used_at = NOW(),
    updated_at = NOW(),
    avg_resolution_time_seconds = CASE
      WHEN NEW.resolution_time_seconds IS NOT NULL THEN
        COALESCE(
          (COALESCE(avg_resolution_time_seconds, 0) * (success_count + failure_count) + NEW.resolution_time_seconds) /
          (success_count + failure_count + 1),
          NEW.resolution_time_seconds
        )
      ELSE avg_resolution_time_seconds
    END
  WHERE id = NEW.pattern_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_pattern_confidence
  AFTER INSERT ON support_pattern_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_pattern_confidence();

-- RLS
ALTER TABLE support_case_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_pattern_usage ENABLE ROW LEVEL SECURITY;

-- Patterns: leggibili da tutti (sono conoscenza globale di Anne)
CREATE POLICY "Anyone can read active patterns"
  ON support_case_patterns FOR SELECT
  USING (is_active = true);

-- Solo admin puo modificare patterns
CREATE POLICY "Admins manage patterns"
  ON support_case_patterns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- Service role inserisce (Anne backend)
CREATE POLICY "Service role inserts patterns"
  ON support_case_patterns FOR INSERT
  WITH CHECK (true);

-- Usage: service role only (Anne registra internamente)
CREATE POLICY "Service role manages usage"
  ON support_pattern_usage FOR ALL
  USING (true);

COMMENT ON TABLE support_case_patterns IS
  'Pattern appresi da Anne durante la risoluzione dei casi di supporto. Migliora nel tempo.';
COMMENT ON TABLE support_pattern_usage IS
  'Log di utilizzo dei pattern: traccia successi/fallimenti per aggiornare confidence.';
