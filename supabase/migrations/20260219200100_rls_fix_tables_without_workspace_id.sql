-- ============================================================================
-- MIGRAZIONE: Fix RLS per tabelle senza workspace_id diretto
-- ============================================================================
-- Aggiorna le policy per le 5 tabelle che non hanno workspace_id come colonna
-- diretta, ma che sono filtrabili tramite FK → tabella parent con workspace_id.
--
-- Tabelle:
--   price_list_entries     → price_list_id → price_lists.workspace_id
--   price_list_assignments → price_list_id → price_lists.workspace_id
--   commercial_quote_events → quote_id    → commercial_quotes.workspace_id
--   prospect_events         → prospect_id → reseller_prospects.workspace_id
--   lead_events             → lead_id     → leads.workspace_id
-- ============================================================================

-- ============================================================================
-- PRICE_LIST_ENTRIES
-- ============================================================================
DROP POLICY IF EXISTS "Member access own workspace price_list_entries" ON public.price_list_entries;

-- Sostituisce la policy member che usava workspace_id (non esiste su questa tabella)
CREATE POLICY "Member access own workspace price_list_entries" ON public.price_list_entries
  FOR ALL TO authenticated
  USING (
    price_list_id IN (
      SELECT id FROM public.price_lists
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
        UNION
        SELECT w.id FROM public.workspaces w
        WHERE w.parent_workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
        )
      )
    )
  )
  WITH CHECK (
    price_list_id IN (
      SELECT id FROM public.price_lists
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
        UNION
        SELECT w.id FROM public.workspaces w
        WHERE w.parent_workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
        )
      )
    )
  );

-- ============================================================================
-- PRICE_LIST_ASSIGNMENTS
-- ============================================================================
DROP POLICY IF EXISTS "Member access own workspace price_list_assignments" ON public.price_list_assignments;

CREATE POLICY "Member access own workspace price_list_assignments" ON public.price_list_assignments
  FOR ALL TO authenticated
  USING (
    price_list_id IN (
      SELECT id FROM public.price_lists
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
        UNION
        SELECT w.id FROM public.workspaces w
        WHERE w.parent_workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
        )
      )
    )
  )
  WITH CHECK (
    price_list_id IN (
      SELECT id FROM public.price_lists
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
        UNION
        SELECT w.id FROM public.workspaces w
        WHERE w.parent_workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
        )
      )
    )
  );

-- ============================================================================
-- COMMERCIAL_QUOTE_EVENTS
-- ============================================================================
DROP POLICY IF EXISTS "Member access own workspace commercial_quote_events" ON public.commercial_quote_events;

CREATE POLICY "Member access own workspace commercial_quote_events" ON public.commercial_quote_events
  FOR ALL TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM public.commercial_quotes
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
        UNION
        SELECT w.id FROM public.workspaces w
        WHERE w.parent_workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
        )
      )
    )
  )
  WITH CHECK (
    quote_id IN (
      SELECT id FROM public.commercial_quotes
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
        UNION
        SELECT w.id FROM public.workspaces w
        WHERE w.parent_workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
        )
      )
    )
  );

-- ============================================================================
-- PROSPECT_EVENTS
-- ============================================================================
DROP POLICY IF EXISTS "Member access own workspace prospect_events" ON public.prospect_events;

CREATE POLICY "Member access own workspace prospect_events" ON public.prospect_events
  FOR ALL TO authenticated
  USING (
    prospect_id IN (
      SELECT id FROM public.reseller_prospects
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
        UNION
        SELECT w.id FROM public.workspaces w
        WHERE w.parent_workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
        )
      )
    )
  )
  WITH CHECK (
    prospect_id IN (
      SELECT id FROM public.reseller_prospects
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
        UNION
        SELECT w.id FROM public.workspaces w
        WHERE w.parent_workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
        )
      )
    )
  );

-- ============================================================================
-- LEAD_EVENTS
-- ============================================================================
DROP POLICY IF EXISTS "Member access own workspace lead_events" ON public.lead_events;

CREATE POLICY "Member access own workspace lead_events" ON public.lead_events
  FOR ALL TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
        UNION
        SELECT w.id FROM public.workspaces w
        WHERE w.parent_workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
        )
      )
    )
  )
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
        UNION
        SELECT w.id FROM public.workspaces w
        WHERE w.parent_workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
        )
      )
    )
  );

-- ============================================================================
-- FINE MIGRAZIONE: Fix policy RLS per tabelle senza workspace_id diretto
-- ============================================================================
