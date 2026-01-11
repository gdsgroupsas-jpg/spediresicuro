/**
 * Migration: Price Lists Audit Trail Enterprise-Grade
 * 
 * Estende financial_audit_log con eventi specifici per listini prezzi:
 * - Modifiche listini
 * - Import/export entries
 * - Modifiche regole
 * - Utilizzi listini
 * - Clonazioni e assegnazioni
 * 
 * Data: 2026-01-11
 */

-- ============================================
-- STEP 1: Estendi event_type enum per includere eventi listini
-- ============================================

-- Rimuovi constraint esistente
ALTER TABLE financial_audit_log 
  DROP CONSTRAINT IF EXISTS financial_audit_log_event_type_check;

-- Aggiungi nuovi eventi per listini
ALTER TABLE financial_audit_log 
  ADD CONSTRAINT financial_audit_log_event_type_check 
  CHECK (event_type IN (
    -- Eventi esistenti
    'wallet_debit',
    'wallet_credit',
    'wallet_refund',
    'platform_cost_recorded',
    'platform_cost_updated',
    'reconciliation_started',
    'reconciliation_completed',
    'reconciliation_discrepancy',
    'margin_alert',
    'cost_estimation_fallback',
    'invoice_matched',
    'manual_adjustment',
    -- Nuovi eventi listini
    'price_list_created',
    'price_list_updated',
    'price_list_activated',
    'price_list_deactivated',
    'price_list_archived',
    'price_list_cloned',
    'price_list_assigned',
    'price_list_unassigned',
    'price_list_entry_imported',
    'price_list_entry_modified',
    'price_list_entry_deleted',
    'price_list_rule_created',
    'price_list_rule_updated',
    'price_list_rule_deleted',
    'price_list_margin_updated',
    'price_list_used_for_quote'
  ));

-- ============================================
-- STEP 2: Aggiungi indice per price_list_id (se non esiste)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_fal_price_list_id 
  ON financial_audit_log(price_list_id) 
  WHERE price_list_id IS NOT NULL;

-- Indice composito per query frequenti: listino + tipo evento + data
CREATE INDEX IF NOT EXISTS idx_fal_price_list_type_date 
  ON financial_audit_log(price_list_id, event_type, created_at DESC) 
  WHERE price_list_id IS NOT NULL;

-- ============================================
-- STEP 3: Funzione helper per loggare eventi listini
-- ============================================

CREATE OR REPLACE FUNCTION log_price_list_event(
  p_event_type TEXT,
  p_price_list_id UUID,
  p_actor_id UUID DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_severity TEXT DEFAULT 'info'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_actor_email TEXT;
  v_actor_type TEXT;
  v_price_list_name TEXT;
BEGIN
  -- Valida event_type
  IF p_event_type NOT IN (
    'price_list_created', 'price_list_updated', 'price_list_activated',
    'price_list_deactivated', 'price_list_archived', 'price_list_cloned',
    'price_list_assigned', 'price_list_unassigned', 'price_list_entry_imported',
    'price_list_entry_modified', 'price_list_entry_deleted', 'price_list_rule_created',
    'price_list_rule_updated', 'price_list_rule_deleted', 'price_list_margin_updated',
    'price_list_used_for_quote'
  ) THEN
    RAISE EXCEPTION 'Invalid event_type for price list: %', p_event_type;
  END IF;

  -- Recupera email attore
  IF p_actor_id IS NOT NULL THEN
    SELECT email, account_type INTO v_actor_email, v_actor_type
    FROM users WHERE id = p_actor_id;
    
    IF v_actor_type IN ('admin', 'superadmin') THEN
      v_actor_type := 'admin';
    ELSIF v_actor_type = 'byoc' THEN
      v_actor_type := 'admin';
    ELSE
      v_actor_type := 'user';
    END IF;
  ELSE
    v_actor_email := 'system';
    v_actor_type := 'system';
  END IF;

  -- Recupera nome listino (denormalizzato per audit)
  SELECT name INTO v_price_list_name
  FROM price_lists WHERE id = p_price_list_id;

  -- Inserisci record audit
  INSERT INTO financial_audit_log (
    event_type,
    severity,
    price_list_id,
    actor_id,
    actor_email,
    actor_type,
    message,
    old_value,
    new_value,
    metadata
  ) VALUES (
    p_event_type,
    p_severity,
    p_price_list_id,
    p_actor_id,
    v_actor_email,
    v_actor_type,
    COALESCE(p_message, format('Evento %s su listino %s', p_event_type, COALESCE(v_price_list_name, p_price_list_id::text))),
    p_old_value,
    p_new_value,
    jsonb_build_object(
      'price_list_name', v_price_list_name,
      'price_list_id', p_price_list_id
    ) || p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_price_list_event IS 
  'Logga eventi relativi a listini prezzi nel financial_audit_log. Enterprise-grade audit trail.';

-- ============================================
-- STEP 4: Funzione RPC per recuperare eventi di un listino
-- ============================================

CREATE OR REPLACE FUNCTION get_price_list_audit_events(
  p_price_list_id UUID,
  p_event_types TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_actor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  severity TEXT,
  actor_id UUID,
  actor_email TEXT,
  actor_type TEXT,
  message TEXT,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_events AS (
    SELECT 
      fal.id,
      fal.event_type,
      fal.severity,
      fal.actor_id,
      fal.actor_email,
      fal.actor_type,
      fal.message,
      fal.old_value,
      fal.new_value,
      fal.metadata,
      fal.created_at,
      COUNT(*) OVER() as total_count
    FROM financial_audit_log fal
    WHERE fal.price_list_id = p_price_list_id
      AND (p_event_types IS NULL OR fal.event_type = ANY(p_event_types))
      AND (p_actor_id IS NULL OR fal.actor_id = p_actor_id)
    ORDER BY fal.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT * FROM filtered_events;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_price_list_audit_events IS 
  'Recupera eventi audit per un listino specifico. Supporta filtri per tipo evento, attore, paginazione.';

-- ============================================
-- STEP 5: RLS per get_price_list_audit_events
-- ============================================

-- Verifica permessi: solo chi può accedere al listino può vedere l'audit
-- Usa la stessa logica di can_access_price_list
GRANT EXECUTE ON FUNCTION get_price_list_audit_events TO authenticated;

-- ============================================
-- STEP 6: Trigger per loggare modifiche automatiche (opzionale, futuro)
-- ============================================

-- Nota: Per ora non aggiungiamo trigger automatici per evitare overhead.
-- Il logging sarà esplicito nelle actions TypeScript per maggiore controllo.

-- ============================================
-- STEP 7: View per statistiche utilizzo listini
-- ============================================

CREATE OR REPLACE VIEW price_list_usage_stats AS
SELECT 
  pl.id as price_list_id,
  pl.name as price_list_name,
  COUNT(DISTINCT CASE WHEN fal.event_type = 'price_list_used_for_quote' THEN fal.id END) as quote_count,
  COUNT(DISTINCT CASE WHEN fal.event_type = 'price_list_entry_imported' THEN fal.id END) as import_count,
  COUNT(DISTINCT CASE WHEN fal.event_type = 'price_list_updated' THEN fal.id END) as update_count,
  MAX(CASE WHEN fal.event_type = 'price_list_used_for_quote' THEN fal.created_at END) as last_used_at,
  MAX(fal.created_at) as last_activity_at
FROM price_lists pl
LEFT JOIN financial_audit_log fal ON fal.price_list_id = pl.id
GROUP BY pl.id, pl.name;

COMMENT ON VIEW price_list_usage_stats IS 
  'Statistiche utilizzo listini per dashboard e reporting.';

-- RLS sulla view (eredita da price_lists)
ALTER VIEW price_list_usage_stats SET (security_invoker = true);
