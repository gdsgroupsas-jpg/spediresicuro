-- Migration: Aggiungere workspace_id a invoices, invoice_items e tabelle COD
--
-- Obiettivo: eliminare il pattern "workspace_members bridge" (1 query extra per richiesta)
-- e passare a filtro diretto workspace_id (come shipments, price_lists, wallet_transactions).
--
-- Pattern: stesso di 20260203200006_add_workspace_id_to_tables.sql
-- Colonne: nullable inizialmente (backward compatible), backfill in step separato.

-- ============================================================
-- STEP 1: ADD COLUMN workspace_id + INDEX + FK
-- ============================================================

-- invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);

CREATE INDEX IF NOT EXISTS idx_invoices_workspace
  ON public.invoices(workspace_id) WHERE workspace_id IS NOT NULL;

COMMENT ON COLUMN public.invoices.workspace_id
  IS 'Workspace proprietario della fattura. Per isolamento multi-tenant.';

-- invoice_items (eredita workspace da invoice, ma colonna diretta per query performance)
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);

CREATE INDEX IF NOT EXISTS idx_invoice_items_workspace
  ON public.invoice_items(workspace_id) WHERE workspace_id IS NOT NULL;

COMMENT ON COLUMN public.invoice_items.workspace_id
  IS 'Workspace proprietario. Denormalizzato da invoices per query performance.';

-- cod_files
ALTER TABLE public.cod_files
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);

CREATE INDEX IF NOT EXISTS idx_cod_files_workspace
  ON public.cod_files(workspace_id) WHERE workspace_id IS NOT NULL;

COMMENT ON COLUMN public.cod_files.workspace_id
  IS 'Workspace proprietario del file COD. Per isolamento multi-tenant.';

-- cod_items
ALTER TABLE public.cod_items
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);

CREATE INDEX IF NOT EXISTS idx_cod_items_workspace
  ON public.cod_items(workspace_id) WHERE workspace_id IS NOT NULL;

COMMENT ON COLUMN public.cod_items.workspace_id
  IS 'Workspace proprietario del contrassegno. Per isolamento multi-tenant.';

-- cod_distinte
ALTER TABLE public.cod_distinte
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);

CREATE INDEX IF NOT EXISTS idx_cod_distinte_workspace
  ON public.cod_distinte(workspace_id) WHERE workspace_id IS NOT NULL;

COMMENT ON COLUMN public.cod_distinte.workspace_id
  IS 'Workspace proprietario della distinta. Per isolamento multi-tenant.';

-- cod_disputes: tabella non ancora creata in produzione, verra' aggiunta in futuro


-- ============================================================
-- STEP 2: BACKFILL workspace_id da dati esistenti
-- ============================================================
-- Pattern: user_id/client_id -> users.primary_workspace_id -> workspace_id

DO $$
DECLARE
  v_invoices_updated INT := 0;
  v_invoice_items_updated INT := 0;
  v_cod_files_updated INT := 0;
  v_cod_items_updated INT := 0;
  v_cod_distinte_updated INT := 0;
BEGIN

  -- invoices: backfill da user_id -> primary_workspace_id
  UPDATE public.invoices i
  SET workspace_id = u.primary_workspace_id
  FROM public.users u
  WHERE i.user_id = u.id
    AND i.workspace_id IS NULL
    AND u.primary_workspace_id IS NOT NULL;
  GET DIAGNOSTICS v_invoices_updated = ROW_COUNT;

  -- invoice_items: backfill da invoice parent
  UPDATE public.invoice_items ii
  SET workspace_id = inv.workspace_id
  FROM public.invoices inv
  WHERE ii.invoice_id = inv.id
    AND ii.workspace_id IS NULL
    AND inv.workspace_id IS NOT NULL;
  GET DIAGNOSTICS v_invoice_items_updated = ROW_COUNT;

  -- cod_files: backfill da uploaded_by -> primary_workspace_id
  UPDATE public.cod_files cf
  SET workspace_id = u.primary_workspace_id
  FROM public.users u
  WHERE cf.uploaded_by = u.id
    AND cf.workspace_id IS NULL
    AND u.primary_workspace_id IS NOT NULL;
  GET DIAGNOSTICS v_cod_files_updated = ROW_COUNT;

  -- cod_items: backfill da client_id -> primary_workspace_id
  UPDATE public.cod_items ci
  SET workspace_id = u.primary_workspace_id
  FROM public.users u
  WHERE ci.client_id = u.id
    AND ci.workspace_id IS NULL
    AND u.primary_workspace_id IS NOT NULL;
  GET DIAGNOSTICS v_cod_items_updated = ROW_COUNT;

  -- cod_distinte: backfill da client_id -> primary_workspace_id
  UPDATE public.cod_distinte cd
  SET workspace_id = u.primary_workspace_id
  FROM public.users u
  WHERE cd.client_id = u.id
    AND cd.workspace_id IS NULL
    AND u.primary_workspace_id IS NOT NULL;
  GET DIAGNOSTICS v_cod_distinte_updated = ROW_COUNT;

  -- Report
  RAISE NOTICE '=== BACKFILL workspace_id COMPLETATO ===';
  RAISE NOTICE 'invoices aggiornate: %', v_invoices_updated;
  RAISE NOTICE 'invoice_items aggiornati: %', v_invoice_items_updated;
  RAISE NOTICE 'cod_files aggiornati: %', v_cod_files_updated;
  RAISE NOTICE 'cod_items aggiornati: %', v_cod_items_updated;
  RAISE NOTICE 'cod_distinte aggiornate: %', v_cod_distinte_updated;

  -- Verifica residui NULL
  RAISE NOTICE '--- Residui con workspace_id NULL ---';
  RAISE NOTICE 'invoices NULL: %', (SELECT COUNT(*) FROM public.invoices WHERE workspace_id IS NULL);
  RAISE NOTICE 'cod_files NULL: %', (SELECT COUNT(*) FROM public.cod_files WHERE workspace_id IS NULL);
  RAISE NOTICE 'cod_items NULL: %', (SELECT COUNT(*) FROM public.cod_items WHERE workspace_id IS NULL);
  RAISE NOTICE 'cod_distinte NULL: %', (SELECT COUNT(*) FROM public.cod_distinte WHERE workspace_id IS NULL);

END $$;


-- ============================================================
-- STEP 3: RLS POLICIES
-- ============================================================
-- Pattern: stesso di 20260203200007_workspace_rls_for_operational_tables.sql

-- Abilita RLS su tutte le tabelle
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
-- cod_files, cod_items, cod_distinte hanno gia' RLS abilitato

-- --- INVOICES ---

-- Superadmin full access
CREATE POLICY "Superadmin full access invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

-- Utente vede solo le proprie fatture del workspace
CREATE POLICY "Users can view own invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      workspace_id IS NULL
      OR workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid() AND wm.status = 'active'
      )
    )
  );

-- Service role full access (per server actions con supabaseAdmin)
CREATE POLICY "Service role full access invoices" ON public.invoices
  FOR ALL USING (true) WITH CHECK (true);

-- --- INVOICE_ITEMS ---

CREATE POLICY "Superadmin full access invoice_items" ON public.invoice_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Users can view own invoice_items" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (
    workspace_id IS NULL
    OR workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.status = 'active'
    )
  );

CREATE POLICY "Service role full access invoice_items" ON public.invoice_items
  FOR ALL USING (true) WITH CHECK (true);

-- --- COD tabelle: Aggiornare le policies esistenti ---
-- Le policy admin-only e service-role esistenti restano.
-- Aggiungiamo workspace-scoped policies per utenti normali.

-- cod_items: aggiorna policy utente per includere workspace check
DROP POLICY IF EXISTS "Users can view own cod_items" ON public.cod_items;
CREATE POLICY "Users can view own cod_items" ON public.cod_items
  FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    AND (
      workspace_id IS NULL
      OR workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid() AND wm.status = 'active'
      )
    )
  );

-- cod_distinte: aggiorna policy utente per includere workspace check
DROP POLICY IF EXISTS "Users can view own cod_distinte" ON public.cod_distinte;
CREATE POLICY "Users can view own cod_distinte" ON public.cod_distinte
  FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    AND (
      workspace_id IS NULL
      OR workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid() AND wm.status = 'active'
      )
    )
  );
