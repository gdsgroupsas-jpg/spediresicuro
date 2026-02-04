-- ============================================
-- MIGRAZIONE: RLS Policies con workspace_id per tabelle operative
-- ============================================
-- Parte del refactoring Architecture V2
--
-- Aggiunge RLS policies che usano workspace_id per:
-- - shipments
-- - wallet_transactions
-- - price_lists
-- - audit_logs (solo insert, no select filter)
--
-- STRATEGIA:
-- 1. Superadmin: accesso totale (come prima)
-- 2. User normale: accesso SOLO ai propri dati (user_id) + workspace_id se presente
-- 3. Backward-compatible: se workspace_id è NULL, usa solo user_id filter
-- ============================================

-- ============================================
-- SHIPMENTS - RLS con workspace_id
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own shipments" ON public.shipments;
DROP POLICY IF EXISTS "Users can insert own shipments" ON public.shipments;
DROP POLICY IF EXISTS "Users can update own shipments" ON public.shipments;
DROP POLICY IF EXISTS "Superadmin full access shipments" ON public.shipments;

-- Superadmin: accesso totale
CREATE POLICY "Superadmin full access shipments" ON public.shipments
  FOR ALL
  TO authenticated
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

-- User: SELECT proprie spedizioni (user_id match)
-- Se workspace_id è presente, deve anche matchare
CREATE POLICY "Users can view own shipments" ON public.shipments
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      -- Backward-compatible: se workspace_id è NULL, permetti accesso
      workspace_id IS NULL
      OR
      -- Se workspace_id è presente, verifica membership
      workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid() AND wm.status = 'active'
      )
    )
  );

-- User: INSERT proprie spedizioni
CREATE POLICY "Users can insert own shipments" ON public.shipments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      -- Backward-compatible: workspace_id può essere NULL
      workspace_id IS NULL
      OR
      -- Se workspace_id è presente, verifica membership
      workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid() AND wm.status = 'active'
      )
    )
  );

-- User: UPDATE proprie spedizioni (solo non-deleted)
CREATE POLICY "Users can update own shipments" ON public.shipments
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND deleted = false
    AND (
      workspace_id IS NULL
      OR
      workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid() AND wm.status = 'active'
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      workspace_id IS NULL
      OR
      workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid() AND wm.status = 'active'
      )
    )
  );

-- ============================================
-- WALLET_TRANSACTIONS - RLS con workspace_id
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Superadmin full access wallet_transactions" ON public.wallet_transactions;

-- Superadmin: accesso totale
CREATE POLICY "Superadmin full access wallet_transactions" ON public.wallet_transactions
  FOR ALL
  TO authenticated
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

-- User: SELECT proprie transazioni
CREATE POLICY "Users can view own transactions" ON public.wallet_transactions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      -- Backward-compatible: workspace_id può essere NULL
      workspace_id IS NULL
      OR
      -- Se workspace_id è presente, verifica membership
      workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid() AND wm.status = 'active'
      )
    )
  );

-- ============================================
-- PRICE_LISTS - RLS con workspace_id
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view accessible price_lists" ON public.price_lists;
DROP POLICY IF EXISTS "Superadmin full access price_lists" ON public.price_lists;

-- Superadmin: accesso totale
CREATE POLICY "Superadmin full access price_lists" ON public.price_lists
  FOR ALL
  TO authenticated
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

-- User: SELECT listini accessibili
-- Un listino è accessibile se:
-- 1. workspace_id è NULL (listino globale/legacy)
-- 2. workspace_id corrisponde a un workspace dell'utente
-- 3. L'utente è assegnato al listino (assigned_price_list_id nel workspace)
CREATE POLICY "Users can view accessible price_lists" ON public.price_lists
  FOR SELECT
  TO authenticated
  USING (
    -- Listini globali (senza workspace)
    workspace_id IS NULL
    OR
    -- Listini del workspace dell'utente
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.status = 'active'
    )
    OR
    -- Listini assegnati al workspace dell'utente
    id IN (
      SELECT w.assigned_price_list_id FROM public.workspaces w
      JOIN public.workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid() AND wm.status = 'active'
      AND w.assigned_price_list_id IS NOT NULL
    )
  );

-- ============================================
-- AUDIT_LOGS - RLS (solo insert, select limitato)
-- ============================================
-- NOTA: Backward-compatible con schema senza actor_id/target_id

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view own audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Superadmin full access audit_logs" ON public.audit_logs;

-- Superadmin: accesso totale
CREATE POLICY "Superadmin full access audit_logs" ON public.audit_logs
  FOR ALL
  TO authenticated
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

-- User: INSERT audit logs (per logging azioni)
-- Solo user_id per backward-compatibility
CREATE POLICY "Users can insert audit_logs" ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

-- User: SELECT propri audit logs (limitato)
-- Solo user_id per backward-compatibility
CREATE POLICY "Users can view own audit_logs" ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- ============================================
-- CONTACTS - RLS con workspace_id (futuro)
-- ============================================
-- NOTA: contacts attualmente è superadmin-only
-- In futuro potrebbe essere workspace-scoped
-- Per ora manteniamo la policy esistente

-- ============================================
-- FINE MIGRAZIONE RLS workspace_id
-- ============================================
