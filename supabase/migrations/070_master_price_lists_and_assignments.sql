-- ============================================
-- MIGRATION: 070_master_price_lists_and_assignments.sql
-- DESCRIZIONE: Sistema avanzato listini master con clonazione e assegnazioni multi-tenant
-- DATA: 2026-01-06
-- CRITICITÀ: P0 - Funzionalità core enterprise
-- ============================================
--
-- OBIETTIVO:
-- 1. Permettere al superadmin di gestire listini "master" (template globali)
-- 2. Clonare listini master in versioni personalizzate con tracciabilità
-- 3. Assegnare listini custom a reseller/BYOC tramite tabella N:N
-- 4. Garantire isolamento totale tra tenant via RLS
--
-- RETROCOMPATIBILITÀ:
-- - Campo assigned_to_user_id su price_lists rimane funzionante
-- - Nuova tabella price_list_assignments per assegnazioni multiple
-- - RLS aggiornate per supportare entrambi i meccanismi
-- ============================================

-- ============================================
-- STEP 1: Aggiungere campo master_list_id a price_lists
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_lists' AND column_name = 'master_list_id'
  ) THEN
    -- Aggiungi colonna per tracciabilità derivazione
    ALTER TABLE price_lists ADD COLUMN master_list_id UUID;
    
    -- Aggiungi foreign key self-referencing
    ALTER TABLE price_lists 
    ADD CONSTRAINT fk_price_lists_master 
    FOREIGN KEY (master_list_id) 
    REFERENCES price_lists(id) 
    ON DELETE SET NULL;
    
    -- Indice per query rapide su derivazioni
    CREATE INDEX IF NOT EXISTS idx_price_lists_master_list_id ON price_lists(master_list_id);
    
    COMMENT ON COLUMN price_lists.master_list_id IS 
      'ID del listino master da cui questo listino deriva. NULL se è un listino originale/master.';
    
    RAISE NOTICE '✅ Aggiunto campo: price_lists.master_list_id';
  ELSE
    RAISE NOTICE '⚠️ Campo price_lists.master_list_id già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 2: Creare tabella price_list_assignments
-- ============================================

CREATE TABLE IF NOT EXISTS price_list_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Riferimenti principali
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Chi ha fatto l'assegnazione (audit trail)
  assigned_by UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Revoca (soft delete per audit trail)
  revoked_at TIMESTAMPTZ, -- NULL = assegnazione attiva
  revoked_by UUID REFERENCES users(id),
  
  -- Note e metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamp standard
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_pla_price_list_id ON price_list_assignments(price_list_id);
CREATE INDEX IF NOT EXISTS idx_pla_user_id ON price_list_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_pla_assigned_by ON price_list_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_pla_active ON price_list_assignments(price_list_id, user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pla_revoked ON price_list_assignments(revoked_at) WHERE revoked_at IS NOT NULL;

-- Vincolo unico: un utente può avere una sola assegnazione attiva per listino
-- (permette riassegnazione dopo revoca grazie alla condizione WHERE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pla_unique_active 
  ON price_list_assignments(price_list_id, user_id) 
  WHERE revoked_at IS NULL;

-- Commenti
COMMENT ON TABLE price_list_assignments IS 
  'Tabella di mapping N:N per assegnazione listini a utenti. Supporta audit trail completo con revoche.';

COMMENT ON COLUMN price_list_assignments.price_list_id IS 'ID listino assegnato';
COMMENT ON COLUMN price_list_assignments.user_id IS 'ID utente a cui è assegnato il listino';
COMMENT ON COLUMN price_list_assignments.assigned_by IS 'ID superadmin che ha creato l''assegnazione';
COMMENT ON COLUMN price_list_assignments.revoked_at IS 'Timestamp revoca. NULL = assegnazione attiva';
COMMENT ON COLUMN price_list_assignments.revoked_by IS 'ID superadmin che ha revocato l''assegnazione';

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION update_price_list_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pla_updated_at ON price_list_assignments;
CREATE TRIGGER trigger_pla_updated_at
  BEFORE UPDATE ON price_list_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_price_list_assignments_updated_at();

-- ============================================
-- STEP 3: RLS Policies per price_list_assignments
-- ============================================

ALTER TABLE price_list_assignments ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: Utenti vedono solo le proprie assegnazioni, superadmin vede tutto
CREATE POLICY pla_select ON price_list_assignments
  FOR SELECT USING (
    -- Super Admin vede tutto
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.account_type = 'superadmin'
    )
    OR
    -- Admin vede tutto
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.account_type = 'admin'
    )
    OR
    -- Utente vede solo le proprie assegnazioni attive
    (user_id = auth.uid() AND revoked_at IS NULL)
  );

-- Policy INSERT: Solo superadmin può creare assegnazioni
CREATE POLICY pla_insert ON price_list_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.account_type = 'superadmin'
    )
  );

-- Policy UPDATE: Solo superadmin può aggiornare (es. revocare)
CREATE POLICY pla_update ON price_list_assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.account_type = 'superadmin'
    )
  );

-- Policy DELETE: Solo superadmin può eliminare (preferire soft delete via revoked_at)
CREATE POLICY pla_delete ON price_list_assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.account_type = 'superadmin'
    )
  );

COMMENT ON POLICY pla_select ON price_list_assignments IS 
  'RLS: Super Admin/Admin vedono tutto, utenti vedono solo proprie assegnazioni attive';

-- ============================================
-- STEP 4: Aggiornare RLS price_lists per supportare assegnazioni
-- ============================================

-- Aggiorna SELECT policy per includere listini assegnati tramite price_list_assignments
DROP POLICY IF EXISTS price_lists_select ON price_lists;

CREATE POLICY price_lists_select ON price_lists
  FOR SELECT USING (
    -- Super Admin vede tutto
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.account_type = 'superadmin'
    )
    OR
    -- Admin vede tutto
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.account_type = 'admin'
    )
    OR
    -- Listini globali visibili a tutti (MA filtrati per Reseller/BYOC in Server Action)
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
    -- Listini assegnati direttamente (retrocompatibilità)
    (assigned_to_user_id = auth.uid()::text::uuid)
    OR
    -- ✨ NUOVO: Listini assegnati tramite price_list_assignments
    EXISTS (
      SELECT 1 FROM price_list_assignments pla
      WHERE pla.price_list_id = price_lists.id
      AND pla.user_id = auth.uid()::text::uuid
      AND pla.revoked_at IS NULL
    )
    OR
    -- Listini creati dall'utente (retrocompatibilità)
    (created_by = auth.uid()::text::uuid)
    OR
    -- Listini di default (retrocompatibilità)
    (priority = 'default')
  );

COMMENT ON POLICY price_lists_select ON price_lists IS 
  'RLS: Supporta assegnazioni sia via assigned_to_user_id che via price_list_assignments per retrocompatibilità';

-- ============================================
-- STEP 5: Funzione clone_price_list
-- ============================================

CREATE OR REPLACE FUNCTION clone_price_list(
  p_source_id UUID,
  p_new_name TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_overrides JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_new_id UUID;
  v_caller_id UUID;
  v_source_record RECORD;
  v_is_admin BOOLEAN;
BEGIN
  -- Verifica autenticazione
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Non autenticato';
  END IF;
  
  -- Verifica permessi (solo superadmin può clonare)
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE id = v_caller_id 
    AND account_type = 'superadmin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Non autorizzato: solo superadmin può clonare listini';
  END IF;
  
  -- Recupera listino sorgente
  SELECT * INTO v_source_record FROM price_lists WHERE id = p_source_id;
  
  IF v_source_record IS NULL THEN
    RAISE EXCEPTION 'Listino sorgente non trovato: %', p_source_id;
  END IF;
  
  -- Genera nuovo UUID
  v_new_id := uuid_generate_v4();
  
  -- Inserisci clone
  INSERT INTO price_lists (
    id,
    courier_id,
    name,
    version,
    status,
    valid_from,
    valid_until,
    source_type,
    source_file_url,
    notes,
    rules,
    priority,
    is_global,
    assigned_to_user_id,
    list_type,
    default_margin_percent,
    default_margin_fixed,
    description,
    source_file_name,
    source_metadata,
    metadata,
    master_list_id, -- ✨ Tracciabilità derivazione
    created_by,
    created_at,
    updated_at
  )
  VALUES (
    v_new_id,
    v_source_record.courier_id,
    p_new_name,
    v_source_record.version || '-clone',
    'draft', -- Nuovo listino parte come draft
    COALESCE((p_overrides->>'valid_from')::DATE, v_source_record.valid_from),
    COALESCE((p_overrides->>'valid_until')::DATE, v_source_record.valid_until),
    v_source_record.source_type,
    v_source_record.source_file_url,
    COALESCE(p_overrides->>'notes', 'Clonato da: ' || v_source_record.name),
    v_source_record.rules,
    'partner', -- Listini clonati sono tipicamente per partner
    false, -- Non globale
    p_target_user_id,
    'custom', -- Listino derivato è sempre custom
    COALESCE((p_overrides->>'default_margin_percent')::DECIMAL, v_source_record.default_margin_percent),
    COALESCE((p_overrides->>'default_margin_fixed')::DECIMAL, v_source_record.default_margin_fixed),
    COALESCE(p_overrides->>'description', v_source_record.description),
    v_source_record.source_file_name,
    v_source_record.source_metadata,
    jsonb_build_object(
      'cloned_from', p_source_id,
      'cloned_at', NOW(),
      'cloned_by', v_caller_id
    ),
    p_source_id, -- master_list_id per tracciabilità
    v_caller_id,
    NOW(),
    NOW()
  );
  
  -- Clona anche le entries se esistono
  INSERT INTO price_list_entries (
    price_list_id,
    weight_from,
    weight_to,
    zone_code,
    zip_code_from,
    zip_code_to,
    province_code,
    region,
    service_type,
    base_price,
    fuel_surcharge_percent,
    island_surcharge,
    ztl_surcharge,
    cash_on_delivery_surcharge,
    insurance_rate_percent,
    estimated_delivery_days_min,
    estimated_delivery_days_max,
    created_at
  )
  SELECT 
    v_new_id,
    weight_from,
    weight_to,
    zone_code,
    zip_code_from,
    zip_code_to,
    province_code,
    region,
    service_type,
    base_price,
    fuel_surcharge_percent,
    island_surcharge,
    ztl_surcharge,
    cash_on_delivery_surcharge,
    insurance_rate_percent,
    estimated_delivery_days_min,
    estimated_delivery_days_max,
    NOW()
  FROM price_list_entries
  WHERE price_list_id = p_source_id;
  
  RAISE NOTICE '✅ Listino clonato: % -> % (nuovo ID: %)', p_source_id, p_new_name, v_new_id;
  
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

COMMENT ON FUNCTION clone_price_list IS 
  'Clona un listino esistente creando una copia con tracciabilità master_list_id. Solo superadmin.';

-- ============================================
-- STEP 6: Funzione assign_price_list
-- ============================================

CREATE OR REPLACE FUNCTION assign_price_list(
  p_price_list_id UUID,
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_assignment_id UUID;
  v_caller_id UUID;
  v_is_admin BOOLEAN;
  v_existing_id UUID;
BEGIN
  -- Verifica autenticazione
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Non autenticato';
  END IF;
  
  -- Verifica permessi (solo superadmin può assegnare)
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE id = v_caller_id 
    AND account_type = 'superadmin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Non autorizzato: solo superadmin può assegnare listini';
  END IF;
  
  -- Verifica che il listino esista
  IF NOT EXISTS (SELECT 1 FROM price_lists WHERE id = p_price_list_id) THEN
    RAISE EXCEPTION 'Listino non trovato: %', p_price_list_id;
  END IF;
  
  -- Verifica che l'utente esista
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Utente non trovato: %', p_user_id;
  END IF;
  
  -- Verifica assegnazione esistente attiva
  SELECT id INTO v_existing_id
  FROM price_list_assignments
  WHERE price_list_id = p_price_list_id
    AND user_id = p_user_id
    AND revoked_at IS NULL;
  
  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Assegnazione già esistente per questo listino e utente (ID: %)', v_existing_id;
  END IF;
  
  -- Crea assegnazione
  INSERT INTO price_list_assignments (
    price_list_id,
    user_id,
    assigned_by,
    assigned_at,
    notes
  )
  VALUES (
    p_price_list_id,
    p_user_id,
    v_caller_id,
    NOW(),
    p_notes
  )
  RETURNING id INTO v_assignment_id;
  
  RAISE NOTICE '✅ Listino % assegnato a utente % (assignment ID: %)', 
    p_price_list_id, p_user_id, v_assignment_id;
  
  RETURN v_assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

COMMENT ON FUNCTION assign_price_list IS 
  'Assegna un listino a un utente. Solo superadmin. Previene duplicati attivi.';

-- ============================================
-- STEP 7: Funzione revoke_price_list_assignment
-- ============================================

CREATE OR REPLACE FUNCTION revoke_price_list_assignment(
  p_assignment_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_caller_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Verifica autenticazione
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Non autenticato';
  END IF;
  
  -- Verifica permessi (solo superadmin può revocare)
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE id = v_caller_id 
    AND account_type = 'superadmin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Non autorizzato: solo superadmin può revocare assegnazioni';
  END IF;
  
  -- Verifica che l'assegnazione esista e sia attiva
  IF NOT EXISTS (
    SELECT 1 FROM price_list_assignments 
    WHERE id = p_assignment_id AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Assegnazione non trovata o già revocata: %', p_assignment_id;
  END IF;
  
  -- Revoca (soft delete)
  UPDATE price_list_assignments
  SET 
    revoked_at = NOW(),
    revoked_by = v_caller_id,
    updated_at = NOW()
  WHERE id = p_assignment_id;
  
  RAISE NOTICE '✅ Assegnazione % revocata', p_assignment_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

COMMENT ON FUNCTION revoke_price_list_assignment IS 
  'Revoca un''assegnazione listino (soft delete per audit trail). Solo superadmin.';

-- ============================================
-- STEP 8: View per reporting derivazioni
-- ============================================

CREATE OR REPLACE VIEW v_price_list_derivations AS
SELECT 
  m.id AS master_id,
  m.name AS master_name,
  m.courier_id AS master_courier_id,
  m.list_type AS master_list_type,
  m.status AS master_status,
  COUNT(d.id) AS derived_count,
  ARRAY_AGG(d.id) FILTER (WHERE d.id IS NOT NULL) AS derived_ids,
  ARRAY_AGG(d.name) FILTER (WHERE d.name IS NOT NULL) AS derived_names
FROM price_lists m
LEFT JOIN price_lists d ON d.master_list_id = m.id
WHERE m.master_list_id IS NULL -- Solo listini master (non derivati)
GROUP BY m.id, m.name, m.courier_id, m.list_type, m.status;

COMMENT ON VIEW v_price_list_derivations IS 
  'Vista per visualizzare listini master e relative derivazioni. Utile per reporting.';

-- ============================================
-- STEP 9: View per assegnazioni attive
-- ============================================

CREATE OR REPLACE VIEW v_active_assignments AS
SELECT 
  pla.id AS assignment_id,
  pla.price_list_id,
  pl.name AS price_list_name,
  pl.list_type,
  pl.courier_id,
  pl.master_list_id,
  pla.user_id,
  u.email AS user_email,
  u.name AS user_name,
  u.account_type AS user_account_type,
  pla.assigned_by,
  assigner.email AS assigner_email,
  pla.assigned_at,
  pla.notes
FROM price_list_assignments pla
JOIN price_lists pl ON pl.id = pla.price_list_id
JOIN users u ON u.id = pla.user_id
JOIN users assigner ON assigner.id = pla.assigned_by
WHERE pla.revoked_at IS NULL;

COMMENT ON VIEW v_active_assignments IS 
  'Vista per visualizzare tutte le assegnazioni attive con dettagli listino e utente.';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 070 completata con successo';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Modifiche applicate:';
  RAISE NOTICE '  - Campo master_list_id aggiunto a price_lists';
  RAISE NOTICE '  - Tabella price_list_assignments creata';
  RAISE NOTICE '  - RLS policies per price_list_assignments';
  RAISE NOTICE '  - RLS price_lists aggiornata per supportare assegnazioni';
  RAISE NOTICE '  - Funzione clone_price_list()';
  RAISE NOTICE '  - Funzione assign_price_list()';
  RAISE NOTICE '  - Funzione revoke_price_list_assignment()';
  RAISE NOTICE '  - View v_price_list_derivations';
  RAISE NOTICE '  - View v_active_assignments';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 ISOLAMENTO MULTI-TENANT:';
  RAISE NOTICE '  - Reseller/BYOC vedono solo listini assegnati direttamente o via mapping';
  RAISE NOTICE '  - Solo superadmin può clonare, assegnare, revocare';
  RAISE NOTICE '  - Audit trail completo per tutte le operazioni';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 RETROCOMPATIBILITÀ:';
  RAISE NOTICE '  - assigned_to_user_id continua a funzionare';
  RAISE NOTICE '  - Nuova tabella price_list_assignments per assegnazioni multiple';
  RAISE NOTICE '========================================';
END $$;
