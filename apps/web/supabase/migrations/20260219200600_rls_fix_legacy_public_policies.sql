-- ============================================================================
-- MIGRAZIONE: Rimuovi policy legacy con ruolo 'public' che bypassano RLS workspace
-- ============================================================================
-- Problema: policy legacy su shipments usano ruolo 'public' (non 'authenticated').
-- In PostgreSQL, il ruolo 'public' include TUTTI gli utenti (anon + authenticated).
-- La policy "shipments_select_active" mostra TUTTE le spedizioni a chiunque se
-- deleted = false — bypassa completamente l'isolamento workspace.
--
-- Soluzione:
-- 1. Elimina le policy legacy con ruolo 'public' su shipments
-- 2. Le nuove policy 'authenticated' (Member access + Superadmin) già le coprono correttamente
-- ============================================================================

-- Elimina policy legacy con ruolo 'public' — bypassa workspace isolation
DROP POLICY IF EXISTS "shipments_select_active" ON public.shipments;
DROP POLICY IF EXISTS "shipments_select_reseller" ON public.shipments;
DROP POLICY IF EXISTS "shipments_insert_reseller" ON public.shipments;
DROP POLICY IF EXISTS "shipments_update_reseller" ON public.shipments;

-- ============================================================================
-- Verifica: dopo questa migration, le policy su shipments devono essere:
-- [SELECT] "Admins can view all shipments" (authenticated) — is_superadmin()
-- [ALL]    "Member access own workspace shipments" (authenticated) — get_user_accessible_workspace_ids()
-- [ALL]    "Superadmin full access shipments" (authenticated) — is_superadmin()
-- [INSERT] "Users can insert own shipments" (authenticated) — get_user_workspace_ids()
-- [UPDATE] "Users can update own shipments" (authenticated) — get_user_workspace_ids()
-- [SELECT] "Users can view own shipments" (authenticated) — get_user_workspace_ids()
-- ============================================================================

-- ============================================================================
-- FINE MIGRAZIONE: Fix policy public legacy su shipments
-- ============================================================================
