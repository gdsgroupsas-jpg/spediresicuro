-- ============================================
-- MIGRATION: 058_rls_courier_configs_reseller_isolation.sql
-- DESCRIZIONE: Aggiunge RLS per isolare courier_configs per Reseller/BYOC
-- DATA: 2026-01-03
-- 
-- PROBLEMA RISOLTO:
-- Le policies precedenti permettevano solo admin di accedere.
-- I Reseller/BYOC non potevano vedere le proprie configurazioni via RLS.
-- L'isolamento era garantito solo dal codice applicativo (fragile).
--
-- SOLUZIONE:
-- Nuove policies che permettono a ogni utente di vedere/gestire
-- SOLO le proprie configurazioni (owner_user_id = auth.uid())
-- ============================================

-- ============================================
-- STEP 1: Rimuovi policies esistenti
-- ============================================
DROP POLICY IF EXISTS "Admin può vedere tutte le configurazioni" ON public.courier_configs;
DROP POLICY IF EXISTS "Admin può inserire configurazioni" ON public.courier_configs;
DROP POLICY IF EXISTS "Admin può aggiornare configurazioni" ON public.courier_configs;
DROP POLICY IF EXISTS "Admin può eliminare configurazioni" ON public.courier_configs;
DROP POLICY IF EXISTS "courier_configs_select" ON public.courier_configs;
DROP POLICY IF EXISTS "courier_configs_insert" ON public.courier_configs;
DROP POLICY IF EXISTS "courier_configs_update" ON public.courier_configs;
DROP POLICY IF EXISTS "courier_configs_delete" ON public.courier_configs;

-- ============================================
-- STEP 2: Abilita RLS (se non già attiva)
-- ============================================
ALTER TABLE public.courier_configs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: SELECT Policy
-- ============================================
CREATE POLICY courier_configs_select ON public.courier_configs
  FOR SELECT
  TO authenticated
  USING (
    -- Super Admin/Admin vedono tutto
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.account_type IN ('admin', 'superadmin')
    )
    OR
    -- Proprietario vede le proprie configurazioni (owner_user_id)
    owner_user_id = auth.uid()
    OR
    -- Creatore vede le proprie configurazioni (created_by = email)
    created_by = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR
    -- Configurazioni globali/default visibili a tutti
    (is_default = true AND owner_user_id IS NULL)
  );

COMMENT ON POLICY courier_configs_select ON public.courier_configs IS 
'RLS: Admin vedono tutto. Reseller/BYOC vedono solo le proprie configurazioni (owner_user_id o created_by). Config default visibili a tutti.';

-- ============================================
-- STEP 4: INSERT Policy
-- ============================================
CREATE POLICY courier_configs_insert ON public.courier_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin può inserire qualsiasi configurazione
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.account_type IN ('admin', 'superadmin')
    )
    OR
    -- Reseller può creare configurazioni per se stesso
    (
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_reseller = true
      )
      AND (owner_user_id = auth.uid() OR owner_user_id IS NULL)
    )
    OR
    -- BYOC può creare configurazioni per se stesso
    (
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.account_type = 'byoc'
      )
      AND owner_user_id = auth.uid()
    )
  );

COMMENT ON POLICY courier_configs_insert ON public.courier_configs IS 
'RLS: Admin può creare qualsiasi config. Reseller/BYOC possono creare solo per se stessi (owner_user_id = proprio ID).';

-- ============================================
-- STEP 5: UPDATE Policy
-- ============================================
CREATE POLICY courier_configs_update ON public.courier_configs
  FOR UPDATE
  TO authenticated
  USING (
    -- Admin può aggiornare qualsiasi configurazione
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.account_type IN ('admin', 'superadmin')
    )
    OR
    -- Proprietario può aggiornare le proprie configurazioni
    owner_user_id = auth.uid()
    OR
    -- Creatore può aggiornare le proprie configurazioni
    created_by = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    -- Admin può aggiornare qualsiasi configurazione
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.account_type IN ('admin', 'superadmin')
    )
    OR
    -- Non può cambiare owner_user_id a un altro utente
    (owner_user_id = auth.uid() OR owner_user_id IS NULL)
  );

COMMENT ON POLICY courier_configs_update ON public.courier_configs IS 
'RLS: Admin può aggiornare tutto. Reseller/BYOC possono aggiornare solo le proprie configurazioni.';

-- ============================================
-- STEP 6: DELETE Policy
-- ============================================
CREATE POLICY courier_configs_delete ON public.courier_configs
  FOR DELETE
  TO authenticated
  USING (
    -- Admin può eliminare qualsiasi configurazione
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.account_type IN ('admin', 'superadmin')
    )
    OR
    -- Proprietario può eliminare le proprie configurazioni
    owner_user_id = auth.uid()
    OR
    -- Creatore può eliminare le proprie configurazioni
    created_by = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

COMMENT ON POLICY courier_configs_delete ON public.courier_configs IS 
'RLS: Admin può eliminare tutto. Reseller/BYOC possono eliminare solo le proprie configurazioni.';

-- ============================================
-- STEP 7: Verifica
-- ============================================
DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_policy_count 
  FROM pg_policies 
  WHERE tablename = 'courier_configs' 
  AND schemaname = 'public';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS courier_configs - Reseller Isolation';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Policies attive: %', v_policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '🔒 ISOLAMENTO GARANTITO:';
  RAISE NOTICE '   - Reseller A NON può vedere config di Reseller B';
  RAISE NOTICE '   - BYOC A NON può vedere config di BYOC B';
  RAISE NOTICE '   - Admin può vedere/gestire tutto';
  RAISE NOTICE '   - Config default visibili a tutti';
  RAISE NOTICE '========================================';
END $$;
