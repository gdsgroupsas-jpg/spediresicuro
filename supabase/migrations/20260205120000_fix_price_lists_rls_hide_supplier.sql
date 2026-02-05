-- ============================================
-- MIGRAZIONE: Fix RLS price_lists - Nascondere listini supplier GLOBALI
-- ============================================
--
-- PROBLEMA: La policy precedente permetteva a TUTTI gli utenti autenticati
-- di vedere i listini con workspace_id = NULL (inclusi i listini SUPPLIER).
-- Questo esponeva i costi di acquisto del superadmin ai reseller.
--
-- FIX: I reseller possono vedere:
-- 1. Listini CUSTOM del proprio workspace
-- 2. Listini SUPPLIER del proprio workspace (i LORO costi diretti con corrieri)
-- 3. Listini a loro ASSEGNATI (assigned_price_list_id)
--
-- I listini SUPPLIER GLOBALI (workspace_id = NULL) sono visibili SOLO al superadmin.
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view accessible price_lists" ON public.price_lists;

-- Nuova policy: reseller vedono solo listini del proprio workspace
-- TRANNE i listini supplier GLOBALI (workspace_id = NULL)
--
-- Logica:
-- 1. Listini del workspace dell'utente (CUSTOM o SUPPLIER del proprio workspace)
--    Il reseller può vedere i SUOI listini supplier (suoi corrieri diretti)
-- 2. Listini assegnati al workspace dell'utente
-- 3. Listini creati dall'utente stesso (ma solo se hanno workspace_id, mai globali)
--
-- NOTA: I listini con workspace_id = NULL (globali) NON sono accessibili
-- a meno che non siano assegnati tramite assigned_price_list_id
-- Questo nasconde i listini SUPPLIER del superadmin (costi piattaforma)

CREATE POLICY "Users can view accessible price_lists" ON public.price_lists
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.status = 'active'
    )
    OR
    id IN (
      SELECT w.assigned_price_list_id FROM public.workspaces w
      JOIN public.workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid() AND wm.status = 'active'
      AND w.assigned_price_list_id IS NOT NULL
    )
    OR
    (created_by = auth.uid() AND workspace_id IS NOT NULL)
  );

-- ============================================
-- NOTA: La policy "Superadmin full access price_lists" rimane invariata
-- e permette al superadmin di vedere TUTTO (inclusi supplier globali)
-- ============================================

-- Aggiungi commento esplicativo
COMMENT ON POLICY "Users can view accessible price_lists" ON public.price_lists IS
  'Reseller vedono listini del proprio workspace (custom E supplier propri). '
  'Listini SUPPLIER GLOBALI (workspace_id=NULL) nascosti (solo superadmin).';
