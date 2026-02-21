-- ============================================================================
-- MIGRAZIONE: Fix policy che fanno SELECT su tabella users
-- ============================================================================
-- Problema: policy legacy su shipments fanno SELECT su users con
-- role='admin'. La tabella users non ha GRANT SELECT per authenticated.
-- Quando il ruolo authenticated esegue una query su shipments, tutte le
-- policy vengono valutate. Una policy che fa SELECT su users senza permesso
-- causa "permission denied for table users" — blocca TUTTI gli utenti.
--
-- Soluzione:
-- 1. Rimuovi le policy che fanno SELECT su users
-- 2. Sostituisci con policy che usano auth.uid() + app_metadata (JWT)
-- 3. Oppure usa is_superadmin() che è già SECURITY DEFINER
-- ============================================================================

-- Rimuovi policy legacy che accedono a users direttamente
DROP POLICY IF EXISTS "Admins can view all shipments" ON public.shipments;
DROP POLICY IF EXISTS "anne_superadmin_read_all_shipments" ON public.shipments;

-- Sostituisci con policy basata su is_superadmin() (SECURITY DEFINER — nessun accesso diretto a users)
-- Nota: is_superadmin() usa auth.users (non public.users) che è accessibile
CREATE POLICY "Admins can view all shipments" ON public.shipments
  FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- La policy anne_superadmin_read_all_shipments era un duplicato — non la ricreamo.
-- Superadmin è già coperto da "Superadmin full access shipments" (FOR ALL).

-- ============================================================================
-- FINE MIGRAZIONE: Fix permission denied for table users
-- ============================================================================
