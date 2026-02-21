-- ============================================================
-- Migration: Atomic Bulk Update User Listini + Performance Indexes
--
-- 1. RPC `bulk_update_user_listini`: aggiorna listini utente in singola transazione
-- 2. Indici parziali su price_list_assignments per query veloci
-- ============================================================

-- ============================================================
-- 1. RPC ATOMICA: bulk_update_user_listini
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_update_user_listini(
  p_caller_id UUID,
  p_user_id UUID,
  p_selected_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_account_type TEXT;
  v_caller_is_reseller BOOLEAN;
  v_target_parent_id UUID;
  v_added INT := 0;
  v_removed INT := 0;
  v_pl_id UUID;
BEGIN
  -- 1. Verifica caller
  SELECT account_type, is_reseller
  INTO v_caller_account_type, v_caller_is_reseller
  FROM users WHERE id = p_caller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN: Caller non trovato';
  END IF;

  -- 2. Verifica target user
  SELECT parent_id INTO v_target_parent_id
  FROM users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: Utente non trovato';
  END IF;

  -- 3. Verifica parentela (reseller può gestire solo i propri sub-user)
  IF v_caller_account_type NOT IN ('admin', 'superadmin') THEN
    IF v_target_parent_id IS NULL OR v_target_parent_id != p_caller_id THEN
      RAISE EXCEPTION 'FORBIDDEN: Puoi gestire listini solo dei tuoi clienti';
    END IF;
  END IF;

  -- 4. Verifica accesso a tutti i listini selezionati
  FOR v_pl_id IN SELECT unnest(p_selected_ids)
  LOOP
    IF NOT can_user_access_price_list(p_caller_id, v_pl_id) THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Non hai accesso al listino %', v_pl_id;
    END IF;
  END LOOP;

  -- 5. REVOKE: soft-delete listini attivi NON più nella selezione
  WITH revoked AS (
    UPDATE price_list_assignments
    SET revoked_at = NOW(), revoked_by = p_caller_id
    WHERE user_id = p_user_id
      AND revoked_at IS NULL
      AND price_list_id != ALL(p_selected_ids)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_removed FROM revoked;

  -- 6. ASSIGN: inserisci nuovi listini (evita duplicati)
  WITH inserted AS (
    INSERT INTO price_list_assignments (user_id, price_list_id, assigned_by)
    SELECT p_user_id, sel_id, p_caller_id
    FROM unnest(p_selected_ids) AS sel_id
    WHERE NOT EXISTS (
      SELECT 1 FROM price_list_assignments
      WHERE user_id = p_user_id
        AND price_list_id = sel_id
        AND revoked_at IS NULL
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_added FROM inserted;

  -- 7. Backward compat: aggiorna users.assigned_price_list_id con l'ultimo
  IF array_length(p_selected_ids, 1) > 0 THEN
    UPDATE users
    SET assigned_price_list_id = p_selected_ids[array_length(p_selected_ids, 1)]
    WHERE id = p_user_id;
  ELSE
    UPDATE users
    SET assigned_price_list_id = NULL
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object('added', v_added, 'removed', v_removed);
END;
$$;

-- Permessi
GRANT EXECUTE ON FUNCTION public.bulk_update_user_listini(UUID, UUID, UUID[]) TO service_role;

-- ============================================================
-- 2. INDICI PARZIALI su price_list_assignments
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pla_user_active
  ON price_list_assignments(user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pla_pricelist_active
  ON price_list_assignments(price_list_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pla_user_pricelist_active
  ON price_list_assignments(user_id, price_list_id)
  WHERE revoked_at IS NULL;
