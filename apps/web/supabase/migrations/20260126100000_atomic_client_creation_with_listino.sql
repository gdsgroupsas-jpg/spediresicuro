-- ============================================
-- MIGRAZIONE: Creazione Atomica Cliente + Listino
-- ============================================
--
-- Questa migrazione implementa:
-- 1. Funzione atomica create_client_with_listino (SECURITY DEFINER)
-- 2. Controllo ownership su listini (can_user_access_price_list)
-- 3. Funzione get_user_owned_price_lists per filtrare listini per proprietario
--
-- OBIETTIVO: Garantire privacy e atomicità nella creazione clienti
-- Un reseller può SOLO assegnare listini che ha creato lui stesso.
-- Un superadmin può assegnare qualsiasi listino globale.
--
-- ============================================

-- ============================================
-- 1. FUNZIONE: can_user_access_price_list
-- ============================================
-- Verifica se un utente può accedere/assegnare un listino specifico
-- Regole:
--   - Superadmin: accesso a tutti i listini globali + propri
--   - Reseller: solo listini creati da lui (created_by)
--   - Utente normale: solo listini assegnati a lui

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

    -- REGOLA 1: Superadmin può accedere a tutto
    IF v_user_account_type = 'superadmin' THEN
        RETURN TRUE;
    END IF;

    -- REGOLA 2: Admin può accedere a listini globali + propri
    IF v_user_account_type = 'admin' THEN
        RETURN v_price_list_is_global
            OR v_price_list_created_by = p_user_id
            OR v_price_list_assigned_to = p_user_id;
    END IF;

    -- REGOLA 3: Reseller può accedere SOLO ai listini che ha creato
    IF v_user_is_reseller OR v_user_account_type IN ('reseller', 'reseller_admin') THEN
        -- Privacy: reseller vede SOLO i propri listini fornitore
        RETURN v_price_list_created_by = p_user_id;
    END IF;

    -- REGOLA 4: Utente normale può accedere solo a listini assegnati a lui
    RETURN v_price_list_assigned_to = p_user_id;

END;
$$;

-- Commento descrittivo
COMMENT ON FUNCTION public.can_user_access_price_list IS
'Verifica se un utente può accedere a un listino. Garantisce isolamento privacy tra reseller.';


-- ============================================
-- 2. FUNZIONE: get_user_owned_price_lists
-- ============================================
-- Restituisce solo i listini di cui l'utente è proprietario (per assegnazione)
-- Questo è più restrittivo di can_user_access_price_list

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

    -- Superadmin: vede tutti i listini
    IF v_user_account_type = 'superadmin' THEN
        RETURN QUERY
        SELECT
            pl.id, pl.name, pl.description, pl.courier_id, pl.list_type,
            pl.status, pl.is_global, pl.created_by, pl.created_at,
            pl.valid_from, pl.valid_until, pl.default_margin_percent, pl.metadata
        FROM price_lists pl
        WHERE (p_list_type IS NULL OR pl.list_type = p_list_type)
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

    -- Admin normale: listini globali + propri
    IF v_user_account_type = 'admin' THEN
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

    -- Utente normale: nessun listino (non può assegnare)
    RETURN;

END;
$$;

COMMENT ON FUNCTION public.get_user_owned_price_lists IS
'Restituisce i listini che un utente può assegnare ad altri. Reseller vedono SOLO i propri listini.';


-- ============================================
-- 3. FUNZIONE: create_client_with_listino (ATOMICA)
-- ============================================
-- Crea un cliente E assegna un listino in una singola transazione atomica.
-- Se una delle due operazioni fallisce, NESSUNA viene eseguita.

CREATE OR REPLACE FUNCTION public.create_client_with_listino(
    -- Dati chiamante (reseller)
    p_reseller_id UUID,

    -- Dati utente base
    p_email TEXT,
    p_password_hash TEXT,
    p_name TEXT,

    -- Dati cliente (JSONB per flessibilità)
    p_dati_cliente JSONB,

    -- Listino opzionale (NULL se non si vuole assegnare)
    p_price_list_id UUID DEFAULT NULL,

    -- Metadati opzionali
    p_company_name TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reseller_is_valid BOOLEAN;
    v_reseller_account_type TEXT;
    v_new_user_id UUID;
    v_can_assign_listino BOOLEAN;
    v_result JSONB;
    v_email_lower TEXT;
BEGIN
    -- ========================================
    -- STEP 1: Validazione reseller
    -- ========================================
    SELECT
        COALESCE(is_reseller, false) OR account_type IN ('reseller', 'reseller_admin', 'superadmin'),
        account_type
    INTO v_reseller_is_valid, v_reseller_account_type
    FROM users
    WHERE id = p_reseller_id;

    IF NOT v_reseller_is_valid THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Solo reseller/admin possono creare clienti'
            USING ERRCODE = 'P0001';
    END IF;

    -- ========================================
    -- STEP 2: Validazione email unicità
    -- ========================================
    v_email_lower := LOWER(TRIM(p_email));

    IF EXISTS (SELECT 1 FROM users WHERE LOWER(email) = v_email_lower) THEN
        RAISE EXCEPTION 'EMAIL_EXISTS: Un utente con questa email esiste già'
            USING ERRCODE = 'P0002';
    END IF;

    -- ========================================
    -- STEP 3: Validazione listino (se specificato)
    -- ========================================
    IF p_price_list_id IS NOT NULL THEN
        -- Verifica che il reseller possa accedere al listino
        v_can_assign_listino := can_user_access_price_list(p_reseller_id, p_price_list_id);

        IF NOT v_can_assign_listino THEN
            RAISE EXCEPTION 'LISTINO_NOT_OWNED: Non puoi assegnare questo listino. Un reseller può assegnare solo listini che ha creato.'
                USING ERRCODE = 'P0003';
        END IF;

        -- Verifica che il listino sia attivo
        IF NOT EXISTS (
            SELECT 1 FROM price_lists
            WHERE id = p_price_list_id
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'LISTINO_NOT_ACTIVE: Il listino selezionato non è attivo'
                USING ERRCODE = 'P0004';
        END IF;
    END IF;

    -- ========================================
    -- STEP 4: Creazione utente (ATOMICA)
    -- ========================================
    INSERT INTO users (
        email,
        password,
        name,
        role,
        account_type,
        parent_id,
        is_reseller,
        wallet_balance,
        company_name,
        phone,
        provider,
        dati_cliente,
        assigned_price_list_id,
        created_at,
        updated_at
    ) VALUES (
        v_email_lower,
        p_password_hash,
        p_name,
        'user',
        'user',
        p_reseller_id,
        false,
        0.00,
        p_company_name,
        p_phone,
        'credentials',
        p_dati_cliente,
        p_price_list_id,  -- Assegnato atomicamente!
        NOW(),
        NOW()
    )
    RETURNING id INTO v_new_user_id;

    -- ========================================
    -- STEP 5: Log audit (opzionale, non blocca se fallisce)
    -- ========================================
    BEGIN
        INSERT INTO admin_actions_log (
            admin_email,
            action_type,
            target_user_email,
            action_details
        )
        SELECT
            u.email,
            'CREATE_CLIENT_WITH_LISTINO',
            v_email_lower,
            jsonb_build_object(
                'client_id', v_new_user_id,
                'price_list_id', p_price_list_id,
                'tipo_cliente', p_dati_cliente->>'tipoCliente',
                'created_at', NOW()
            )
        FROM users u
        WHERE u.id = p_reseller_id;
    EXCEPTION WHEN OTHERS THEN
        -- Log silenzioso, non blocca la transazione
        RAISE WARNING 'Audit log failed: %', SQLERRM;
    END;

    -- ========================================
    -- STEP 6: Costruisci risultato
    -- ========================================
    v_result := jsonb_build_object(
        'success', true,
        'client_id', v_new_user_id,
        'email', v_email_lower,
        'name', p_name,
        'price_list_id', p_price_list_id,
        'reseller_id', p_reseller_id
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        -- In caso di qualsiasi errore, la transazione viene rollbackata
        RAISE EXCEPTION '%', SQLERRM USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION public.create_client_with_listino IS
'Crea un cliente E assegna un listino in modo ATOMICO. Garantisce che entrambe le operazioni avvengano o nessuna.';


-- ============================================
-- 4. FUNZIONE: assign_listino_to_user_secure
-- ============================================
-- Assegna un listino a un utente esistente con controllo ownership

CREATE OR REPLACE FUNCTION public.assign_listino_to_user_secure(
    p_caller_id UUID,
    p_user_id UUID,
    p_price_list_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_can_assign BOOLEAN;
    v_user_exists BOOLEAN;
    v_target_parent_id UUID;
    v_caller_is_superadmin BOOLEAN;
BEGIN
    -- Verifica che il chiamante possa accedere al listino
    v_can_assign := can_user_access_price_list(p_caller_id, p_price_list_id);

    IF NOT v_can_assign THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Non hai accesso a questo listino'
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

    -- Verifica che il caller sia superadmin OPPURE parent dell'utente
    SELECT account_type = 'superadmin'
    INTO v_caller_is_superadmin
    FROM users
    WHERE id = p_caller_id;

    IF NOT v_caller_is_superadmin AND v_target_parent_id != p_caller_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Puoi assegnare listini solo ai tuoi clienti'
            USING ERRCODE = 'P0003';
    END IF;

    -- Aggiorna utente con nuovo listino
    UPDATE users
    SET
        assigned_price_list_id = p_price_list_id,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'price_list_id', p_price_list_id,
        'assigned_by', p_caller_id,
        'assigned_at', NOW()
    );

END;
$$;

COMMENT ON FUNCTION public.assign_listino_to_user_secure IS
'Assegna un listino a un utente con verifica ownership e parentela.';


-- ============================================
-- 5. INDICI per performance
-- ============================================
-- Indice per ricerche listini per created_by (ownership)
CREATE INDEX IF NOT EXISTS idx_price_lists_created_by
ON price_lists(created_by);

-- Indice per ricerche utenti per parent_id (gerarchia reseller)
CREATE INDEX IF NOT EXISTS idx_users_parent_id
ON users(parent_id)
WHERE parent_id IS NOT NULL;

-- Indice per assigned_price_list_id
CREATE INDEX IF NOT EXISTS idx_users_assigned_price_list_id
ON users(assigned_price_list_id)
WHERE assigned_price_list_id IS NOT NULL;


-- ============================================
-- 6. GRANT permessi
-- ============================================
GRANT EXECUTE ON FUNCTION public.can_user_access_price_list TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_access_price_list TO service_role;

GRANT EXECUTE ON FUNCTION public.get_user_owned_price_lists TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_owned_price_lists TO service_role;

GRANT EXECUTE ON FUNCTION public.create_client_with_listino TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_client_with_listino TO service_role;

GRANT EXECUTE ON FUNCTION public.assign_listino_to_user_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_listino_to_user_secure TO service_role;


-- ============================================
-- FINE MIGRAZIONE
-- ============================================
