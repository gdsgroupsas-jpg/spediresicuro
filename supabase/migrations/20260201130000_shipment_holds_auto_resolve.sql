-- =====================================================
-- Migration: Shipment Holds Auto-Resolve & Auto-Expire
-- Created: 2026-02-01
-- Description: Auto-close holds when tracking status
--              changes to delivered/returned, and expire
--              holds past deadline
-- =====================================================

-- =====================================================
-- 1. Auto-resolve hold when shipment is delivered/returned
-- =====================================================
CREATE OR REPLACE FUNCTION auto_resolve_shipment_hold()
RETURNS TRIGGER AS $$
BEGIN
  -- When a tracking event shows delivered or returned, close any open hold
  IF NEW.status_normalized IN ('delivered', 'returned', 'cancelled') THEN
    UPDATE shipment_holds
    SET
      status = 'resolved',
      resolved_at = NOW(),
      notes = COALESCE(notes || ' | ', '') || 'Auto-risolto: stato tracking ' || NEW.status_normalized
    WHERE shipment_id = NEW.shipment_id
      AND status IN ('open', 'action_requested', 'action_confirmed');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER trigger_auto_resolve_shipment_hold
  AFTER INSERT ON tracking_events
  FOR EACH ROW
  WHEN (NEW.status_normalized IN ('delivered', 'returned', 'cancelled'))
  EXECUTE FUNCTION auto_resolve_shipment_hold();

-- =====================================================
-- 2. Function to expire holds past deadline (called by cron)
-- =====================================================
CREATE OR REPLACE FUNCTION expire_overdue_shipment_holds()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE shipment_holds
  SET
    status = 'expired',
    resolved_at = NOW(),
    notes = COALESCE(notes || ' | ', '') || 'Auto-scaduto: deadline superata'
  WHERE status = 'open'
    AND deadline_at IS NOT NULL
    AND deadline_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION expire_overdue_shipment_holds() IS
  'Marks open holds past their deadline as expired. Call from cron job.';
