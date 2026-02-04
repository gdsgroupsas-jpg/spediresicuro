-- ============================================
-- FEATURE: Visibilita gerarchica workspace
-- ============================================
-- Pattern: Parent vede dati di tutti i discendenti
--
-- Platform (depth 0) -> vede tutto sotto di se
-- Reseller (depth 1) -> vede suoi + client
-- Client (depth 2)   -> vede solo suoi
--
-- Basato su best practices 2025:
-- - Stripe Connect (platform vede tutti connected accounts)
-- - Hierarchical Data Models for Multi-Tenant SaaS
-- ============================================

-- ============================================
-- FUNZIONE: Ottieni tutti i workspace visibili
-- ============================================
-- Ritorna array di UUID: workspace corrente + tutti i discendenti
-- Usata per filtrare spedizioni, transazioni, ecc.

CREATE OR REPLACE FUNCTION public.get_visible_workspace_ids(
  p_workspace_id UUID
)
RETURNS UUID[] AS $$
DECLARE
  v_result UUID[];
BEGIN
  -- Query ricorsiva: self + tutti i discendenti
  WITH RECURSIVE descendants AS (
    -- Base: workspace corrente
    SELECT id, depth
    FROM public.workspaces
    WHERE id = p_workspace_id
      AND status = 'active'

    UNION ALL

    -- Ricorsione: figli diretti dei nodi gia trovati
    SELECT w.id, w.depth
    FROM public.workspaces w
    INNER JOIN descendants d ON w.parent_workspace_id = d.id
    WHERE w.status = 'active'
      AND w.depth <= 2  -- Max 3 livelli (safety)
  )
  SELECT array_agg(id) INTO v_result
  FROM descendants;

  -- Se nessun risultato, ritorna array con solo self
  IF v_result IS NULL THEN
    v_result := ARRAY[p_workspace_id];
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_visible_workspace_ids IS
  'Ritorna workspace_id corrente + tutti i discendenti. Per filtri gerarchici.';

-- ============================================
-- FUNZIONE: Verifica se workspace A e visibile da workspace B
-- ============================================
-- Utile per check puntuali (es: puo vedere questa spedizione?)

CREATE OR REPLACE FUNCTION public.can_workspace_see(
  p_viewer_workspace_id UUID,
  p_target_workspace_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Stesso workspace = sempre visibile
  IF p_viewer_workspace_id = p_target_workspace_id THEN
    RETURN TRUE;
  END IF;

  -- Target e NULL = visibile (backward-compatible per dati vecchi)
  IF p_target_workspace_id IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Verifica se target e nei discendenti di viewer
  RETURN p_target_workspace_id = ANY(
    get_visible_workspace_ids(p_viewer_workspace_id)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.can_workspace_see IS
  'Verifica se viewer_workspace puo vedere dati di target_workspace.';

-- ============================================
-- FUNZIONE: Conta spedizioni visibili per workspace
-- ============================================
-- Utility per dashboard - conta spedizioni nell'albero

CREATE OR REPLACE FUNCTION public.count_visible_shipments(
  p_workspace_id UUID
)
RETURNS BIGINT AS $$
DECLARE
  v_count BIGINT;
  v_visible_ids UUID[];
BEGIN
  v_visible_ids := get_visible_workspace_ids(p_workspace_id);

  SELECT COUNT(*) INTO v_count
  FROM public.shipments
  WHERE deleted = false
    AND (
      workspace_id = ANY(v_visible_ids)
      OR workspace_id IS NULL  -- Include dati legacy senza workspace
    );

  RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.count_visible_shipments IS
  'Conta spedizioni visibili da un workspace (include discendenti).';

-- ============================================
-- FUNZIONE: Get spedizioni con filtro gerarchico
-- ============================================
-- RPC per ottenere spedizioni con visibilita gerarchica

CREATE OR REPLACE FUNCTION public.get_shipments_for_workspace(
  p_workspace_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  tracking_number TEXT,
  status TEXT,
  recipient_name TEXT,
  recipient_city TEXT,
  final_price NUMERIC,
  created_at TIMESTAMPTZ,
  workspace_id UUID
) AS $$
DECLARE
  v_visible_ids UUID[];
BEGIN
  v_visible_ids := get_visible_workspace_ids(p_workspace_id);

  RETURN QUERY
  SELECT
    s.id,
    s.tracking_number,
    s.status,
    s.recipient_name,
    s.recipient_city,
    s.final_price,
    s.created_at,
    s.workspace_id
  FROM public.shipments s
  WHERE s.deleted = false
    AND (
      s.workspace_id = ANY(v_visible_ids)
      OR s.workspace_id IS NULL  -- Backward-compatible
    )
  ORDER BY s.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_shipments_for_workspace IS
  'Ottieni spedizioni visibili da un workspace con paginazione.';

-- ============================================
-- FUNZIONE: Statistiche aggregate per workspace
-- ============================================
-- Per dashboard: totali, fatturato, ecc.

CREATE OR REPLACE FUNCTION public.get_workspace_stats(
  p_workspace_id UUID
)
RETURNS TABLE (
  total_shipments BIGINT,
  shipments_today BIGINT,
  shipments_this_month BIGINT,
  total_revenue NUMERIC,
  revenue_this_month NUMERIC,
  in_transit BIGINT,
  delivered BIGINT
) AS $$
DECLARE
  v_visible_ids UUID[];
  v_today DATE := CURRENT_DATE;
  v_month_start DATE := DATE_TRUNC('month', CURRENT_DATE);
BEGIN
  v_visible_ids := get_visible_workspace_ids(p_workspace_id);

  RETURN QUERY
  SELECT
    -- Totale spedizioni
    COUNT(*)::BIGINT AS total_shipments,

    -- Spedizioni oggi
    COUNT(*) FILTER (WHERE s.created_at::DATE = v_today)::BIGINT AS shipments_today,

    -- Spedizioni questo mese
    COUNT(*) FILTER (WHERE s.created_at >= v_month_start)::BIGINT AS shipments_this_month,

    -- Fatturato totale
    COALESCE(SUM(s.final_price), 0)::NUMERIC AS total_revenue,

    -- Fatturato questo mese
    COALESCE(SUM(s.final_price) FILTER (WHERE s.created_at >= v_month_start), 0)::NUMERIC AS revenue_this_month,

    -- In transito
    COUNT(*) FILTER (WHERE s.status IN ('in_transit', 'shipped', 'pending'))::BIGINT AS in_transit,

    -- Consegnate
    COUNT(*) FILTER (WHERE s.status = 'delivered')::BIGINT AS delivered

  FROM public.shipments s
  WHERE s.deleted = false
    AND (
      s.workspace_id = ANY(v_visible_ids)
      OR s.workspace_id IS NULL
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_workspace_stats IS
  'Statistiche aggregate per dashboard workspace (include discendenti).';

-- ============================================
-- INDEX per performance query gerarchiche
-- ============================================

-- Index su parent_workspace_id per query ricorsive
CREATE INDEX IF NOT EXISTS idx_workspaces_parent_active
  ON public.workspaces(parent_workspace_id)
  WHERE status = 'active';

-- Index su shipments.workspace_id per filtri
CREATE INDEX IF NOT EXISTS idx_shipments_workspace_active
  ON public.shipments(workspace_id)
  WHERE deleted = false;

-- ============================================
-- FINE MIGRAZIONE
-- ============================================
