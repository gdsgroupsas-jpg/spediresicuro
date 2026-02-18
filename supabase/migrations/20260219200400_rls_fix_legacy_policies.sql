-- ============================================================================
-- MIGRAZIONE: Fix policy legacy su shipments che causano ricorsione RLS
-- ============================================================================
-- Problema: policy legacy su shipments fanno SELECT su workspace_members
-- direttamente. Postgres combina tutte le policy con OR e valuta tutte.
-- workspace_members ha RLS ON con policy che fa SELECT su se stessa → loop.
--
-- Soluzione: sostituire le policy legacy che accedono a workspace_members
-- con versioni che usano get_user_workspace_ids() (SECURITY DEFINER).
-- ============================================================================

-- ---- Rimuovi policy legacy che accedono a workspace_members direttamente ----

DROP POLICY IF EXISTS "Users can view own shipments" ON public.shipments;
DROP POLICY IF EXISTS "Users can insert own shipments" ON public.shipments;
DROP POLICY IF EXISTS "Users can update own shipments" ON public.shipments;
DROP POLICY IF EXISTS "Users can see own shipments" ON public.shipments;

-- ---- Ricrea le policy usando get_user_workspace_ids (SECURITY DEFINER) ----

-- SELECT: utente vede le proprie spedizioni + quelle nel proprio workspace
CREATE POLICY "Users can view own shipments" ON public.shipments
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      workspace_id IS NOT NULL
      AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
    )
  );

-- INSERT: utente può creare spedizioni nel proprio workspace
CREATE POLICY "Users can insert own shipments" ON public.shipments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      workspace_id IS NULL
      OR workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
    )
  );

-- UPDATE: utente può aggiornare le proprie spedizioni
CREATE POLICY "Users can update own shipments" ON public.shipments
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND (deleted = false OR deleted IS NULL)
    AND (
      workspace_id IS NULL
      OR workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      workspace_id IS NULL
      OR workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
    )
  );

-- ---- Stessa correzione per wallet_transactions (prevenire futuri problemi) ----

DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;

CREATE POLICY "Users can view own transactions" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      workspace_id IS NOT NULL
      AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
    )
  );

-- ============================================================================
-- FINE MIGRAZIONE: Fix policy legacy anti-ricorsione
-- ============================================================================
