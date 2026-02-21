-- ============================================
-- MIGRAZIONE: Restrizione Cross-Assignment per Superadmin
-- ============================================
--
-- PROBLEMA RISOLTO:
-- Il superadmin poteva prendere un listino di Reseller A e assegnarlo a Reseller B.
-- Questo viola la privacy commerciale tra reseller (margini, prezzi, contratti).
--
-- NUOVA REGOLA:
-- - Superadmin può assegnare SOLO: listini globali + listini creati da lui stesso
-- - NON può assegnare listini creati da altri reseller
-- - Lo stesso vale per le configurazioni API (courier_configs)
--
-- ============================================

-- ============================================
-- 1. AGGIORNA: can_user_access_price_list
-- ============================================
-- Ora il superadmin NON ha accesso a tutti i listini.
-- Può accedere SOLO a:
--   - Listini globali (is_global = true)
--   - Listini creati da lui (created_by = user_id)

CREATE OR REPLACE FUNCTION public.can_user_access_price_list(
    p_user_id UUID,
    p_price_list_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_account_type TEXT;
    v_user_is_reseller BOOLEAN;
    v_price_list_created_by UUID;
    v_price_list_is_global BOOLEAN;
    v_price_list_assigned_to UUID;
    v_price_list_list_type TEXT;
BEGIN
    -- Recupera info utente
    SELECT account_type, COALESCE(is_reseller, false)
    INTO v_user_account_type, v_user_is_reseller
    FROM users
    WHERE id = p_user_id;

    IF v_user_account_type IS NULL THEN
        RETURN FALSE;  -- Utente non trovato
    END IF;

    -- Recupera info listino
    SELECT created_by, COALESCE(is_global, false), assigned_to_user_id, list_type
    INTO v_price_list_created_by, v_price_list_is_global, v_price_list_assigned_to, v_price_list_list_type
    FROM price_lists
    WHERE id = p_price_list_id;

    IF v_price_list_created_by IS NULL THEN
        RETURN FALSE;  -- Listino non trovato
    END IF;

    -- ==========================================
    -- NUOVA REGOLA: Superadmin/Admin LIMITATI
    -- ==========================================
    -- Possono accedere SOLO a:
    --   1. Listini globali (is_global = true)
    --   2. Listini creati da loro stessi
    --   3. Listini assegnati a loro
    -- NON possono accedere a listini di altri reseller!

    IF v_user_account_type IN ('superadmin', 'admin') THEN
        RETURN v_price_list_is_global
            OR v_price_list_created_by = p_user_id
            OR v_price_list_assigned_to = p_user_id;
    END IF;

    -- REGOLA: Reseller può accedere SOLO ai listini che ha creato
    IF v_user_is_reseller OR v_user_account_type IN ('reseller', 'reseller_admin') THEN
        -- Privacy: reseller vede SOLO i propri listini
        RETURN v_price_list_created_by = p_user_id;
    END IF;

    -- REGOLA: Utente normale può accedere solo a listini assegnati a lui
    RETURN v_price_list_assigned_to = p_user_id;

END;
$$;

COMMENT ON FUNCTION public.can_user_access_price_list IS
'Verifica se un utente può accedere a un listino.
IMPORTANTE: Anche superadmin/admin possono accedere SOLO a listini globali o propri,
NON a listini di altri reseller (privacy commerciale).';


-- ============================================
-- 2. AGGIORNA: get_user_owned_price_lists
-- ============================================
-- Stessa restrizione per l'elenco listini assegnabili

CREATE OR REPLACE FUNCTION public.get_user_owned_price_lists(
    p_user_id UUID,
    p_list_type TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    courier_id UUID,
    list_type TEXT,
    status TEXT,
    is_global BOOLEAN,
    created_by UUID,
    created_at TIMESTAMPTZ,
    valid_from DATE,
    valid_until DATE,
    default_margin_percent NUMERIC,
    metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_account_type TEXT;
    v_user_is_reseller BOOLEAN;
BEGIN
    -- Recupera info utente
    SELECT account_type, COALESCE(is_reseller, false)
    INTO v_user_account_type, v_user_is_reseller
    FROM users
    WHERE users.id = p_user_id;

    IF v_user_account_type IS NULL THEN
        RETURN;  -- Nessun risultato se utente non esiste
    END IF;

    -- ==========================================
    -- NUOVA REGOLA: Superadmin/Admin LIMITATI
    -- ==========================================
    -- Possono assegnare SOLO:
    --   1. Listini globali (is_global = true)
    --   2. Listini creati da loro stessi
    -- NON possono assegnare listini di altri reseller!

    IF v_user_account_type IN ('superadmin', 'admin') THEN
        RETURN QUERY
        SELECT
            pl.id, pl.name, pl.description, pl.courier_id, pl.list_type,
            pl.status, pl.is_global, pl.created_by, pl.created_at,
            pl.valid_from, pl.valid_until, pl.default_margin_percent, pl.metadata
        FROM price_lists pl
        WHERE (pl.is_global = true OR pl.created_by = p_user_id)
          AND (p_list_type IS NULL OR pl.list_type = p_list_type)
          AND (p_status IS NULL OR pl.status = p_status)
        ORDER BY pl.created_at DESC;
        RETURN;
    END IF;

    -- Reseller: SOLO listini creati da lui (privacy totale)
    IF v_user_is_reseller OR v_user_account_type IN ('reseller', 'reseller_admin') THEN
        RETURN QUERY
        SELECT
            pl.id, pl.name, pl.description, pl.courier_id, pl.list_type,
            pl.status, pl.is_global, pl.created_by, pl.created_at,
            pl.valid_from, pl.valid_until, pl.default_margin_percent, pl.metadata
        FROM price_lists pl
        WHERE pl.created_by = p_user_id
          AND (p_list_type IS NULL OR pl.list_type = p_list_type)
          AND (p_status IS NULL OR pl.status = p_status)
        ORDER BY pl.created_at DESC;
        RETURN;
    END IF;

    -- Utente normale: nessun listino (non può assegnare)
    RETURN;

END;
$$;

COMMENT ON FUNCTION public.get_user_owned_price_lists IS
'Restituisce i listini che un utente può assegnare ad altri.
IMPORTANTE: Superadmin/admin vedono solo listini globali + propri, NON quelli di altri reseller.';


-- ============================================
-- 3. NUOVA FUNZIONE: can_user_access_courier_config
-- ============================================
-- Stessa logica per le configurazioni API (courier_configs)
-- Previene cross-assignment di configurazioni tra reseller

CREATE OR REPLACE FUNCTION public.can_user_access_courier_config(
    p_user_id UUID,
    p_config_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_account_type TEXT;
    v_user_is_reseller BOOLEAN;
    v_config_owner_user_id UUID;
    v_config_created_by TEXT;
    v_user_email TEXT;
BEGIN
    -- Recupera info utente
    SELECT account_type, COALESCE(is_reseller, false), email
    INTO v_user_account_type, v_user_is_reseller, v_user_email
    FROM users
    WHERE id = p_user_id;

    IF v_user_account_type IS NULL THEN
        RETURN FALSE;  -- Utente non trovato
    END IF;

    -- Recupera info configurazione
    SELECT owner_user_id, created_by
    INTO v_config_owner_user_id, v_config_created_by
    FROM courier_configs
    WHERE id = p_config_id;

    IF v_config_owner_user_id IS NULL AND v_config_created_by IS NULL THEN
        -- Config globale (nessun owner) - accessibile solo a superadmin/admin
        RETURN v_user_account_type IN ('superadmin', 'admin');
    END IF;

    -- ==========================================
    -- REGOLA: Superadmin/Admin LIMITATI
    -- ==========================================
    -- Possono accedere SOLO a:
    --   1. Config globali (owner_user_id IS NULL)
    --   2. Config create da loro stessi
    -- NON possono accedere a config di altri reseller!

    IF v_user_account_type IN ('superadmin', 'admin') THEN
        -- Config globale
        IF v_config_owner_user_id IS NULL THEN
            RETURN TRUE;
        END IF;
        -- Config propria (owner_user_id match)
        IF v_config_owner_user_id = p_user_id THEN
            RETURN TRUE;
        END IF;
        -- Config creata da loro (created_by email match)
        IF v_config_created_by = v_user_email THEN
            RETURN TRUE;
        END IF;
        -- NON possono accedere a config di altri reseller
        RETURN FALSE;
    END IF;

    -- REGOLA: Reseller può accedere SOLO alle proprie configurazioni
    IF v_user_is_reseller OR v_user_account_type IN ('reseller', 'reseller_admin') THEN
        RETURN v_config_owner_user_id = p_user_id
            OR v_config_created_by = v_user_email;
    END IF;

    -- REGOLA: Utente normale può accedere solo a config assegnate a lui
    -- (tramite assigned_config_id su users, verificato altrove)
    RETURN FALSE;

END;
$$;

COMMENT ON FUNCTION public.can_user_access_courier_config IS
'Verifica se un utente può accedere a una configurazione API corriere.
IMPORTANTE: Anche superadmin/admin possono accedere SOLO a config globali o proprie,
NON a config di altri reseller (privacy commerciale).';


-- ============================================
-- 4. NUOVA FUNZIONE: get_user_owned_courier_configs
-- ============================================
-- Restituisce le configurazioni che un utente può assegnare

CREATE OR REPLACE FUNCTION public.get_user_owned_courier_configs(
    p_user_id UUID,
    p_provider_id TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    provider_id TEXT,
    base_url TEXT,
    is_active BOOLEAN,
    is_default BOOLEAN,
    description TEXT,
    account_type TEXT,
    owner_user_id UUID,
    created_by TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_account_type TEXT;
    v_user_is_reseller BOOLEAN;
    v_user_email TEXT;
BEGIN
    -- Recupera info utente
    SELECT account_type, COALESCE(is_reseller, false), email
    INTO v_user_account_type, v_user_is_reseller, v_user_email
    FROM users
    WHERE users.id = p_user_id;

    IF v_user_account_type IS NULL THEN
        RETURN;  -- Nessun risultato se utente non esiste
    END IF;

    -- ==========================================
    -- REGOLA: Superadmin/Admin LIMITATI
    -- ==========================================
    -- Possono vedere/assegnare SOLO:
    --   1. Config globali (owner_user_id IS NULL)
    --   2. Config create da loro stessi

    IF v_user_account_type IN ('superadmin', 'admin') THEN
        RETURN QUERY
        SELECT
            cc.id, cc.name, cc.provider_id, cc.base_url,
            cc.is_active, cc.is_default, cc.description,
            cc.account_type, cc.owner_user_id, cc.created_by,
            cc.created_at, cc.updated_at
        FROM courier_configs cc
        WHERE (cc.owner_user_id IS NULL OR cc.owner_user_id = p_user_id OR cc.created_by = v_user_email)
          AND (p_provider_id IS NULL OR cc.provider_id = p_provider_id)
          AND (p_is_active IS NULL OR cc.is_active = p_is_active)
        ORDER BY cc.created_at DESC;
        RETURN;
    END IF;

    -- Reseller: SOLO config create da lui (privacy totale)
    IF v_user_is_reseller OR v_user_account_type IN ('reseller', 'reseller_admin') THEN
        RETURN QUERY
        SELECT
            cc.id, cc.name, cc.provider_id, cc.base_url,
            cc.is_active, cc.is_default, cc.description,
            cc.account_type, cc.owner_user_id, cc.created_by,
            cc.created_at, cc.updated_at
        FROM courier_configs cc
        WHERE (cc.owner_user_id = p_user_id OR cc.created_by = v_user_email)
          AND (p_provider_id IS NULL OR cc.provider_id = p_provider_id)
          AND (p_is_active IS NULL OR cc.is_active = p_is_active)
        ORDER BY cc.created_at DESC;
        RETURN;
    END IF;

    -- Utente normale: nessuna config (non può assegnare)
    RETURN;

END;
$$;

COMMENT ON FUNCTION public.get_user_owned_courier_configs IS
'Restituisce le configurazioni API che un utente può assegnare ad altri.
IMPORTANTE: Superadmin/admin vedono solo config globali + proprie, NON quelle di altri reseller.';


-- ============================================
-- 5. NUOVA FUNZIONE: assign_config_to_user_secure
-- ============================================
-- Assegna una configurazione API a un utente con verifica ownership

CREATE OR REPLACE FUNCTION public.assign_config_to_user_secure(
    p_caller_id UUID,
    p_user_id UUID,
    p_config_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_can_access BOOLEAN;
    v_user_exists BOOLEAN;
    v_target_parent_id UUID;
    v_caller_account_type TEXT;
BEGIN
    -- Verifica che il chiamante possa accedere alla configurazione
    v_can_access := can_user_access_courier_config(p_caller_id, p_config_id);

    IF NOT v_can_access THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Non hai accesso a questa configurazione'
            USING ERRCODE = 'P0001';
    END IF;

    -- Verifica che l'utente target esista
    SELECT EXISTS(SELECT 1 FROM users WHERE id = p_user_id), parent_id
    INTO v_user_exists, v_target_parent_id
    FROM users
    WHERE id = p_user_id;

    IF NOT v_user_exists THEN
        RAISE EXCEPTION 'USER_NOT_FOUND: Utente non trovato'
            USING ERRCODE = 'P0002';
    END IF;

    -- Verifica che il caller sia superadmin/admin OPPURE parent dell'utente
    SELECT account_type
    INTO v_caller_account_type
    FROM users
    WHERE id = p_caller_id;

    IF v_caller_account_type NOT IN ('superadmin', 'admin') AND v_target_parent_id != p_caller_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Puoi assegnare configurazioni solo ai tuoi clienti'
            USING ERRCODE = 'P0003';
    END IF;

    -- Verifica che la config sia attiva
    IF NOT EXISTS (
        SELECT 1 FROM courier_configs
        WHERE id = p_config_id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'CONFIG_NOT_ACTIVE: La configurazione selezionata non è attiva'
            USING ERRCODE = 'P0004';
    END IF;

    -- Aggiorna utente con nuova configurazione
    UPDATE users
    SET
        assigned_config_id = p_config_id,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'config_id', p_config_id,
        'assigned_by', p_caller_id,
        'assigned_at', NOW()
    );

END;
$$;

COMMENT ON FUNCTION public.assign_config_to_user_secure IS
'Assegna una configurazione API a un utente con verifica ownership e parentela.
IMPORTANTE: Verifica che il caller possa accedere alla config (no cross-assignment tra reseller).';


-- ============================================
-- 6. GRANT permessi
-- ============================================
GRANT EXECUTE ON FUNCTION public.can_user_access_courier_config TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_access_courier_config TO service_role;

GRANT EXECUTE ON FUNCTION public.get_user_owned_courier_configs TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_owned_courier_configs TO service_role;

GRANT EXECUTE ON FUNCTION public.assign_config_to_user_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_config_to_user_secure TO service_role;


-- ============================================
-- 7. INDICI per performance
-- ============================================
-- Indice per ricerche config per owner
CREATE INDEX IF NOT EXISTS idx_courier_configs_owner_user_id
ON courier_configs(owner_user_id)
WHERE owner_user_id IS NOT NULL;

-- Indice per ricerche config per created_by
CREATE INDEX IF NOT EXISTS idx_courier_configs_created_by
ON courier_configs(created_by)
WHERE created_by IS NOT NULL;


-- ============================================
-- FINE MIGRAZIONE
-- ============================================
