-- ============================================
-- MIGRATION: 057_update_rls_listini_fornitore.sql
-- DESCRIZIONE: Aggiorna RLS Policies per supportare listini fornitore isolati per Reseller e BYOC
-- DATA: 2026-01 (Listini Fornitore - Fase 2)
-- 
-- ⚠️ IMPORTANTE: Esegui PRIMA la migration 056.5_add_byoc_to_account_type_enum.sql
-- per aggiungere il valore 'byoc' all'enum account_type.
-- PostgreSQL non permette di usare un nuovo valore enum nella stessa transazione
-- in cui viene aggiunto. Quindi:
-- 1. Esegui PRIMA la migration 056.5 (aggiunge 'byoc' all'enum)
-- 2. Poi esegui questa migration 057 (aggiorna RLS Policies)
-- ============================================

-- ============================================
-- STEP 1: Aggiorna SELECT Policy
-- ============================================

-- Elimina policy esistente
DROP POLICY IF EXISTS price_lists_select ON price_lists;

-- Crea nuova policy con supporto list_type
CREATE POLICY price_lists_select ON price_lists
  FOR SELECT USING (
    -- Super Admin vede tutto
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.account_type = 'superadmin'
    )
    OR
    -- Listini globali visibili a tutti ORA FILTRATI PER RESELLER/BYOC (Audit Fix P0)
    (
      is_global = true 
      AND list_type = 'global'
      AND NOT EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid()::text::uuid 
        AND (users.is_reseller = true OR users.account_type = 'byoc')
      )
    )
    OR
    -- Listini fornitore creati dall'utente
    (list_type = 'supplier' AND created_by = auth.uid()::text::uuid)
    OR
    -- Listini personalizzati creati dall'utente
    (list_type = 'custom' AND created_by = auth.uid()::text::uuid)
    OR
    -- Listini personalizzati assegnati all'utente
    (list_type = 'custom' AND assigned_to_user_id = auth.uid()::text::uuid)
    OR
    -- Listini assegnati all'utente (retrocompatibilità)
    (assigned_to_user_id = auth.uid()::text::uuid)
    OR
    -- Listini creati dall'utente (retrocompatibilità)
    (created_by = auth.uid()::text::uuid)
    OR
    -- Listini di default (retrocompatibilità)
    (priority = 'default')
  );

COMMENT ON POLICY price_lists_select ON price_lists IS 
'RLS: Super Admin vede tutto, utenti vedono listini fornitore propri, personalizzati assegnati, o globali (filtro applicato in Server Action)';

-- ============================================
-- STEP 2: Aggiorna INSERT Policy
-- ============================================

-- Elimina policy esistente
DROP POLICY IF EXISTS price_lists_insert ON price_lists;

-- Crea nuova policy con supporto BYOC
CREATE POLICY price_lists_insert ON price_lists
  FOR INSERT WITH CHECK (
    -- Admin/Super Admin
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.account_type IN ('admin', 'superadmin')
    )
    OR
    -- Reseller
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.is_reseller = true
    )
    OR
    -- BYOC (può creare solo listini fornitore)
    (
      EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid()::text::uuid 
        AND users.account_type = 'byoc'
      )
      AND list_type = 'supplier'
      AND is_global = false
    )
    OR
    -- Utente può creare listino per se stesso
    (assigned_to_user_id = auth.uid()::text::uuid AND is_global = false)
  );

COMMENT ON POLICY price_lists_insert ON price_lists IS 
'RLS: Admin/Reseller/BYOC possono creare listini. BYOC solo listini fornitore. Utenti possono creare listini per se stessi.';

-- ============================================
-- STEP 3: Aggiorna UPDATE Policy
-- ============================================

-- Elimina policy esistente
DROP POLICY IF EXISTS price_lists_update ON price_lists;

-- Crea nuova policy con supporto assigned_to_user_id
CREATE POLICY price_lists_update ON price_lists
  FOR UPDATE USING (
    -- Admin/Super Admin
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.account_type IN ('admin', 'superadmin')
    )
    OR
    -- Creatore
    created_by = auth.uid()::text::uuid
    OR
    -- Proprietario (assigned_to_user_id)
    assigned_to_user_id = auth.uid()::text::uuid
  );

COMMENT ON POLICY price_lists_update ON price_lists IS 
'RLS: Admin, creatore o proprietario (assigned_to_user_id) possono modificare listini.';

-- ============================================
-- STEP 4: Aggiorna DELETE Policy
-- ============================================

-- Elimina policy esistente
DROP POLICY IF EXISTS price_lists_delete ON price_lists;

-- Crea nuova policy con supporto assigned_to_user_id
CREATE POLICY price_lists_delete ON price_lists
  FOR DELETE USING (
    -- Admin/Super Admin
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.account_type IN ('admin', 'superadmin')
    )
    OR
    -- Creatore
    created_by = auth.uid()::text::uuid
    OR
    -- Proprietario (assigned_to_user_id)
    assigned_to_user_id = auth.uid()::text::uuid
  );

COMMENT ON POLICY price_lists_delete ON price_lists IS 
'RLS: Admin, creatore o proprietario (assigned_to_user_id) possono eliminare listini.';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 057 completata con successo';
  RAISE NOTICE '✅ RLS Policies aggiornate per listini fornitore';
  RAISE NOTICE '';
  RAISE NOTICE 'Modifiche applicate:';
  RAISE NOTICE '  - SELECT: Supporto list_type (supplier, custom, global)';
  RAISE NOTICE '  - INSERT: Supporto BYOC (solo listini fornitore)';
  RAISE NOTICE '  - UPDATE: Supporto assigned_to_user_id';
  RAISE NOTICE '  - DELETE: Supporto assigned_to_user_id';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 ISOLAMENTO LISTINI FORNITORE:';
  RAISE NOTICE '  - Reseller/BYOC vedono solo i propri listini fornitore';
  RAISE NOTICE '  - Listini globali non visibili a Reseller/BYOC (filtro Server Action)';
  RAISE NOTICE '  - BYOC può creare solo listini fornitore';
  RAISE NOTICE '';
  RAISE NOTICE '📋 NOTA: Assicurati che la migration 056.5 sia stata eseguita';
  RAISE NOTICE '   per aggiungere "byoc" all''enum account_type';
  RAISE NOTICE '========================================';
END $$;

