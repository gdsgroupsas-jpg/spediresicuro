-- ============================================
-- MIGRATION: 071_price_lists_security_fixes.sql
-- DESCRIZIONE: Fix P0 vulnerabilities in price lists system
-- DATA: 2026-01-06
-- CRITICITÀ: P0 - SECURITY FIX
-- ============================================

-- ============================================
-- FIX P0-1: SQL Injection in listPriceListsAction
-- ============================================

-- RPC function per query sicura listini utente
CREATE OR REPLACE FUNCTION get_user_price_lists(
  p_user_id UUID,
  p_courier_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  courier_id UUID,
  name TEXT,
  version TEXT,
  status TEXT,
  valid_from DATE,
  valid_until DATE,
  list_type TEXT,
  is_global BOOLEAN,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  priority TEXT,
  assigned_to_user_id UUID,
  master_list_id UUID,
  description TEXT,
  notes TEXT,
  rules JSONB,
  default_margin_percent DECIMAL,
  default_margin_fixed DECIMAL,
  source_type TEXT,
  source_file_name TEXT,
  source_file_url TEXT,
  source_metadata JSONB,
  metadata JSONB
) AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check se utente è admin/superadmin
  SELECT EXISTS(
    SELECT 1 FROM users
    WHERE users.id = p_user_id
    AND users.account_type IN ('admin', 'superadmin')
  ) INTO v_is_admin;

  -- Se admin, ritorna tutti i listini (con filtri opzionali)
  IF v_is_admin THEN
    RETURN QUERY
    SELECT
      pl.id, pl.courier_id, pl.name, pl.version, pl.status,
      pl.valid_from, pl.valid_until, pl.list_type, pl.is_global,
      pl.created_by, pl.created_at, pl.updated_at, pl.priority,
      pl.assigned_to_user_id, pl.master_list_id, pl.description,
      pl.notes, pl.rules, pl.default_margin_percent, pl.default_margin_fixed,
      pl.source_type, pl.source_file_name, pl.source_file_url,
      pl.source_metadata, pl.metadata
    FROM price_lists pl
    WHERE (p_courier_id IS NULL OR pl.courier_id = p_courier_id)
      AND (p_status IS NULL OR pl.status = p_status)
    ORDER BY pl.created_at DESC;

  -- Se NON admin, filtra per ownership
  ELSE
    RETURN QUERY
    SELECT
      pl.id, pl.courier_id, pl.name, pl.version, pl.status,
      pl.valid_from, pl.valid_until, pl.list_type, pl.is_global,
      pl.created_by, pl.created_at, pl.updated_at, pl.priority,
      pl.assigned_to_user_id, pl.master_list_id, pl.description,
      pl.notes, pl.rules, pl.default_margin_percent, pl.default_margin_fixed,
      pl.source_type, pl.source_file_name, pl.source_file_url,
      pl.source_metadata, pl.metadata
    FROM price_lists pl
    WHERE (
      -- Listini supplier creati dall'utente
      (pl.list_type = 'supplier' AND pl.created_by = p_user_id)
      OR
      -- Listini custom creati dall'utente
      (pl.list_type = 'custom' AND pl.created_by = p_user_id)
      OR
      -- Listini custom assegnati all'utente
      (pl.list_type = 'custom' AND pl.assigned_to_user_id = p_user_id)
      OR
      -- Listini assegnati via price_list_assignments
      EXISTS (
        SELECT 1 FROM price_list_assignments pla
        WHERE pla.price_list_id = pl.id
        AND pla.user_id = p_user_id
        AND pla.revoked_at IS NULL
      )
    )
    AND (p_courier_id IS NULL OR pl.courier_id = p_courier_id)
    AND (p_status IS NULL OR pl.status = p_status)
    ORDER BY pl.created_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

COMMENT ON FUNCTION get_user_price_lists IS
  'Recupera listini per utente con filtering sicuro. Previene SQL injection usando parametri typed.';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 071 completata';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 P0-1 FIX: SQL Injection in listPriceListsAction';
  RAISE NOTICE '   - Creata funzione get_user_price_lists()';
  RAISE NOTICE '   - Query parametrizzate sicure';
  RAISE NOTICE '========================================';
END $$;
