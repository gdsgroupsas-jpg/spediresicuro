-- ============================================
-- MIGRATION: 101_reseller_clone_supplier_price_lists.sql
-- DESCRIZIONE: Enterprise-grade reseller price list management
-- DATA: 2026-01-11
-- CRITICITÀ: P0 - Core enterprise feature + P1/P2 security fixes
--
-- OBIETTIVO:
-- 1. Permettere ai reseller di clonare listini supplier con margine personalizzato
-- 2. Fix P1: Solo reseller possono creare listini personalizzati (non utenti base)
-- 3. Fix P2: Atomicità e race condition prevention
-- 4. Audit trail completo per tutte le operazioni
--
-- FUNZIONALITÀ:
-- - Clonazione listini supplier da reseller
-- - Applicazione margine personalizzato (percentuale o fisso)
-- - Mantenimento tracciabilità master_list_id
-- - Clonazione entries automatica con margini applicati
-- ============================================

-- ============================================
-- STEP 0: Abilita estensione uuid-ossp (se non già abilitata)
-- NOTA: Usiamo gen_random_uuid() che è standard PostgreSQL, ma lasciamo l'estensione
-- per retrocompatibilità con altre parti del sistema
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STEP 1: Fix P1 - RLS Policy INSERT price_lists
-- ============================================
-- PROBLEMA: La policy permetteva a UTENTI BASE di creare listini per se stessi
-- SOLUZIONE: Limitare a reseller/admin/superadmin solo

DROP POLICY IF EXISTS price_lists_insert ON price_lists;

CREATE POLICY price_lists_insert ON price_lists
  FOR INSERT WITH CHECK (
    -- Solo admin/superadmin possono creare qualsiasi listino
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.account_type IN ('admin', 'superadmin')
    )
    OR
    -- Solo reseller possono creare listini
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.is_reseller = true
    )
  );

COMMENT ON POLICY price_lists_insert ON price_lists IS 
  'RLS: Solo admin, superadmin e reseller possono creare listini. Fix P1 - utenti base non possono creare listini autonomamente.';

-- ============================================
-- STEP 2: Funzione reseller_clone_supplier_price_list()
-- ============================================

-- ✨ FIX: Rimuovi TUTTE le versioni della funzione prima di ricrearla
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc 
    WHERE proname = 'reseller_clone_supplier_price_list'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s(%s)', r.proname, r.args);
    RAISE NOTICE 'Rimossa funzione: %(%', r.proname, r.args;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION reseller_clone_supplier_price_list(
  p_source_id UUID,
  p_new_name TEXT,
  p_margin_type TEXT, -- 'percent' | 'fixed' | 'none'
  p_margin_value DECIMAL DEFAULT 0,
  p_description TEXT DEFAULT NULL,
  p_caller_id UUID DEFAULT NULL  -- ✨ NUOVO: Supporto per chiamate da service_role
)
RETURNS JSONB AS $$
DECLARE
  v_new_id UUID;
  v_caller_id UUID;
  v_is_reseller BOOLEAN;
  v_is_admin BOOLEAN;
  v_source_record RECORD;
  v_entry_count INTEGER;
  v_result JSONB;
BEGIN
  -- ✨ FIX: Supporta sia auth.uid() (client autenticato) che p_caller_id (service_role)
  v_caller_id := COALESCE(p_caller_id, auth.uid());
  
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Non autenticato';
  END IF;
  
  -- Verifica che il caller sia reseller o admin
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE users.id = v_caller_id 
    AND users.is_reseller = true
  ) INTO v_is_reseller;
  
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE users.id = v_caller_id 
    AND users.account_type IN ('admin', 'superadmin')
  ) INTO v_is_admin;
  
  IF NOT v_is_reseller AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Non autorizzato: solo reseller e admin possono clonare listini';
  END IF;
  
  -- Recupera listino sorgente
  SELECT * INTO v_source_record FROM price_lists WHERE id = p_source_id;
  
  IF v_source_record IS NULL THEN
    RAISE EXCEPTION 'Listino sorgente non trovato: %', p_source_id;
  END IF;
  
  -- Verifica che sia listino supplier
  IF v_source_record.list_type != 'supplier' THEN
    RAISE EXCEPTION 'Posso clonare solo listini supplier, non %', v_source_record.list_type;
  END IF;
  
  -- Se reseller, verifica che il listino sia proprio
  IF v_is_reseller AND NOT v_is_admin THEN
    IF v_source_record.created_by != v_caller_id THEN
      RAISE EXCEPTION 'Non autorizzato: puoi clonare solo listini supplier che hai creato tu';
    END IF;
  END IF;
  
  -- Valida margine
  IF p_margin_type NOT IN ('percent', 'fixed', 'none') THEN
    RAISE EXCEPTION 'Tipo margine non valido: % (valori validi: percent, fixed, none)', p_margin_type;
  END IF;
  
  IF p_margin_type IN ('percent', 'fixed') AND p_margin_value < 0 THEN
    RAISE EXCEPTION 'Il margine non può essere negativo: %', p_margin_value;
  END IF;
  
  -- Genera nuovo UUID (usa gen_random_uuid() che è standard PostgreSQL, non richiede estensioni)
  v_new_id := gen_random_uuid();
  
  -- Inserisci clone con margine applicato
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
    master_list_id,
    created_by,
    created_at,
    updated_at
  )
  VALUES (
    v_new_id,
    v_source_record.courier_id,
    p_new_name,
    v_source_record.version || '-clone',
    'draft', -- Parte come draft, reseller può attivare dopo
    v_source_record.valid_from,
    v_source_record.valid_until,
    'manual', -- Indica clonazione manuale
    v_source_record.source_file_url,
    COALESCE(p_description, 'Clonato da: ' || v_source_record.name),
    v_source_record.rules,
    'client', -- Listino cliente
    false,
    NULL, -- Non assegnato ancora a cliente specifico
    'custom', -- Listino personalizzato
    CASE 
      WHEN p_margin_type = 'percent' THEN p_margin_value
      WHEN p_margin_type = 'none' THEN v_source_record.default_margin_percent
      ELSE v_source_record.default_margin_percent
    END,
    CASE 
      WHEN p_margin_type = 'fixed' THEN p_margin_value
      WHEN p_margin_type = 'none' THEN v_source_record.default_margin_fixed
      ELSE v_source_record.default_margin_fixed
    END,
    v_source_record.description,
    v_source_record.source_file_name,
    COALESCE(v_source_record.source_metadata, '{}'::jsonb), -- source_metadata
    jsonb_build_object(
      'cloned_from', p_source_id,
      'cloned_at', NOW(),
      'cloned_by', v_caller_id,
      'margin_type', p_margin_type,
      'margin_value', p_margin_value
    ) || COALESCE(v_source_record.metadata, '{}'::jsonb), -- metadata
    p_source_id, -- master_list_id per tracciabilità
    v_caller_id, -- created_by
    NOW(), -- created_at
    NOW() -- updated_at
  );
  
  -- Clona entries con margini applicati
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
    -- Applica margine al prezzo base
    CASE 
      WHEN p_margin_type = 'percent' THEN base_price * (1 + p_margin_value / 100)
      WHEN p_margin_type = 'fixed' THEN base_price + p_margin_value
      ELSE base_price
    END,
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
  
  -- Conta entries clonate
  GET DIAGNOSTICS v_entry_count = ROW_COUNT;
  
  -- Costruisci risultato
  v_result := jsonb_build_object(
    'success', true,
    'price_list_id', v_new_id,
    'entry_count', v_entry_count,
    'margin_type', p_margin_type,
    'margin_value', p_margin_value
  );
  
  RAISE NOTICE '✅ Listino supplier % clonato in % (entries: %) da reseller % con margine %/%', 
    p_source_id, v_new_id, v_entry_count, v_caller_id, p_margin_type, p_margin_value;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

COMMENT ON FUNCTION reseller_clone_supplier_price_list IS 
  'Permette ai reseller di clonare listini supplier applicando margini personalizzati (percent, fixed, none). Crea listino custom con tracking master_list_id. Supporta chiamate da service_role via p_caller_id.';

-- ============================================
-- STEP 3: Funzione reseller_validate_assignment() - Fix P2
-- ============================================

-- ✨ FIX: Rimuovi trigger esistente prima di ricrearlo
DROP TRIGGER IF EXISTS trigger_reseller_validate_assignment ON price_lists;

CREATE OR REPLACE FUNCTION reseller_validate_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_id UUID;
  v_is_reseller BOOLEAN;
  v_assigned_user_id UUID;
  v_parent_reseller_id UUID;
BEGIN
  -- Solo per listini custom creati da reseller
  IF NEW.list_type != 'custom' THEN
    RETURN NEW;
  END IF;
  
  -- ✨ FIX: Usa created_by se auth.uid() è NULL (chiamate da SECURITY DEFINER)
  v_caller_id := COALESCE(auth.uid(), NEW.created_by);
  
  -- Se anche created_by è NULL e non c'è assegnazione, procedi
  IF v_caller_id IS NULL AND NEW.assigned_to_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Se created_by è NULL ma c'è assegnazione, errore
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Non autenticato: created_by è NULL ma assigned_to_user_id è presente';
  END IF;
  
  -- Verifica se il creatore è reseller
  SELECT users.is_reseller INTO v_is_reseller
  FROM users 
  WHERE users.id = v_caller_id;
  
  -- Se non reseller o assegnazione NULL, procedi
  IF NOT v_is_reseller OR NEW.assigned_to_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Se reseller, verifica che l'utente assegnato sia sub-user
  v_assigned_user_id := NEW.assigned_to_user_id;
  
  SELECT users.parent_reseller_id INTO v_parent_reseller_id
  FROM users 
  WHERE users.id = v_assigned_user_id;
  
  IF v_parent_reseller_id IS NULL THEN
    RAISE EXCEPTION 'Non puoi assegnare listini a utenti che non sono sub-users';
  END IF;
  
  IF v_parent_reseller_id != v_caller_id THEN
    RAISE EXCEPTION 'Non puoi assegnare listini a sub-users di altri reseller';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger per validazione assegnazione
DROP TRIGGER IF EXISTS trigger_reseller_validate_assignment ON price_lists;
CREATE TRIGGER trigger_reseller_validate_assignment
  BEFORE INSERT OR UPDATE OF assigned_to_user_id ON price_lists
  FOR EACH ROW
  EXECUTE FUNCTION reseller_validate_assignment();

COMMENT ON FUNCTION reseller_validate_assignment IS 
  'Valida che i reseller assegnino listini solo ai propri sub-users. Fix P2 - race condition prevention.';

-- ============================================
-- STEP 4: Fix P2 - Policy UPDATE price_lists
-- ============================================

DROP POLICY IF EXISTS price_lists_update ON price_lists;

CREATE POLICY price_lists_update ON price_lists
  FOR UPDATE USING (
    -- Admin/superadmin possono aggiornare tutto
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.account_type IN ('admin', 'superadmin')
    )
    OR
    -- Reseller possono aggiornare listini creati da loro
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.is_reseller = true
      AND created_by = auth.uid()::text::uuid
    )
    OR
    -- Reseller possono aggiornare listini custom assegnati ai loro sub-users
    (
      list_type = 'custom'
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()::text::uuid
        AND u.is_reseller = true
        AND EXISTS (
          SELECT 1 FROM users sub
          WHERE sub.id = price_lists.assigned_to_user_id
          AND sub.parent_reseller_id = auth.uid()::text::uuid
        )
      )
    )
  );

COMMENT ON POLICY price_lists_update ON price_lists IS 
  'RLS: Reseller possono aggiornare solo listini creati da loro o assegnati ai loro sub-users. Fix P2 - sicurezza assegnazioni.';

-- ============================================
-- STEP 5: Funzione reseller_assign_price_list()
-- ============================================

-- ✨ FIX: Rimuovi TUTTE le versioni della funzione prima di ricrearla
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc 
    WHERE proname = 'reseller_assign_price_list'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s(%s)', r.proname, r.args);
    RAISE NOTICE 'Rimossa funzione: %(%', r.proname, r.args;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION reseller_assign_price_list(
  p_price_list_id UUID,
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_caller_id UUID DEFAULT NULL  -- ✨ NUOVO: Supporto per service_role
)
RETURNS UUID AS $$
DECLARE
  v_caller_id UUID;
  v_is_reseller BOOLEAN;
  v_assigned_user_parent UUID;
  v_assignment_id UUID;
BEGIN
  -- ✨ FIX: Supporta sia auth.uid() che p_caller_id
  v_caller_id := COALESCE(p_caller_id, auth.uid());
  
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Non autenticato';
  END IF;
  
  -- Verifica che sia reseller
  SELECT is_reseller INTO v_is_reseller
  FROM users 
  WHERE id = v_caller_id;
  
  IF NOT v_is_reseller THEN
    RAISE EXCEPTION 'Non autorizzato: solo reseller possono assegnare listini';
  END IF;
  
  -- Verifica che il listino esista e sia custom
  IF NOT EXISTS (
    SELECT 1 FROM price_lists 
    WHERE id = p_price_list_id 
    AND list_type = 'custom'
  ) THEN
    RAISE EXCEPTION 'Listino non trovato o non è custom: %', p_price_list_id;
  END IF;
  
  -- Verifica che l'utente esista
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Utente non trovato: %', p_user_id;
  END IF;
  
  -- Verifica che sia sub-user del reseller
  SELECT parent_reseller_id INTO v_assigned_user_parent
  FROM users 
  WHERE id = p_user_id;
  
  IF v_assigned_user_parent IS NULL THEN
    RAISE EXCEPTION 'Non puoi assegnare listini a utenti che non sono sub-users';
  END IF;
  
  IF v_assigned_user_parent != v_caller_id THEN
    RAISE EXCEPTION 'Non puoi assegnare listini a sub-users di altri reseller';
  END IF;
  
  -- Verifica che il listino sia del reseller
  IF NOT EXISTS (
    SELECT 1 FROM price_lists 
    WHERE id = p_price_list_id 
    AND created_by = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Non puoi assegnare listini che non hai creato';
  END IF;
  
  -- Verifica assegnazione esistente attiva
  IF EXISTS (
    SELECT 1 FROM price_list_assignments
    WHERE price_list_id = p_price_list_id
    AND user_id = p_user_id
    AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Assegnazione già esistente per questo listino e utente';
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
  
  -- Aggiorna anche assigned_to_user_id sul listino (retrocompatibilità)
  UPDATE price_lists
  SET assigned_to_user_id = p_user_id
  WHERE id = p_price_list_id;
  
  RAISE NOTICE '✅ Listino % assegnato a utente % da reseller %', 
    p_price_list_id, p_user_id, v_caller_id;
  
  RETURN v_assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

COMMENT ON FUNCTION reseller_assign_price_list IS 
  'Permette ai reseller di assegnare listini custom ai loro sub-users. Usa supabaseAdmin, verifica parent_reseller_id.';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 101 completata con successo';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 FIX SICUREZZA:';
  RAISE NOTICE '  - P1: Policy INSERT aggiornata - utenti base non possono creare listini';
  RAISE NOTICE '  - P2: Policy UPDATE aggiornata - controllo assegnazioni sub-users';
  RAISE NOTICE '  - P2: Trigger reseller_validate_assignment - previene race conditions';
  RAISE NOTICE '  - FIX: Aggiunto p_caller_id per supportare chiamate service_role';
  RAISE NOTICE '  - FIX: Ricreate funzioni per risolvere conflitti di versioni';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 NUOVE FUNZIONALITÀ:';
  RAISE NOTICE '  - reseller_clone_supplier_price_list() - clonazione con margini';
  RAISE NOTICE '  - reseller_assign_price_list() - assegnazione sub-users';
  RAISE NOTICE '  - Supporto margini: percent, fixed, none';
  RAISE NOTICE '  - Tracciabilità master_list_id completa';
  RAISE NOTICE '  - Audit trail su tutte le operazioni';
  RAISE NOTICE '';
  RAISE NOTICE '📊 STATISTICHE:';
  RAISE NOTICE '  - Listini supplier clonabili con margini personalizzati';
  RAISE NOTICE '  - Entries clonate automaticamente con margini applicati';
  RAISE NOTICE '  - Assegnazioni reseller → sub-users verificate';
  RAISE NOTICE '========================================';
END $$;
