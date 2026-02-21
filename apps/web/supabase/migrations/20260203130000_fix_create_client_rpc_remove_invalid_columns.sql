-- ============================================
-- MIGRAZIONE: Fix RPC create_client_with_listino
-- ============================================
--
-- Problema: La funzione RPC usa colonne company_name e phone che non esistono
-- Soluzione: Rimuovere queste colonne dall'INSERT (i dati sono già in dati_cliente JSONB)
--
-- ============================================

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

    -- Metadati opzionali (mantenuti per compatibilità API ma non usati nell'INSERT)
    p_company_name TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,

    -- ID utente da auth.users (se fornito, usa questo invece di generare un nuovo UUID)
    p_auth_user_id UUID DEFAULT NULL
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
    v_enriched_dati_cliente JSONB;
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
    -- STEP 4: Arricchisci dati_cliente con company_name e phone se forniti
    -- ========================================
    v_enriched_dati_cliente := COALESCE(p_dati_cliente, '{}'::jsonb);

    -- Aggiungi ragioneSociale se p_company_name è fornito e non già presente
    IF p_company_name IS NOT NULL AND NOT (v_enriched_dati_cliente ? 'ragioneSociale') THEN
        v_enriched_dati_cliente := v_enriched_dati_cliente || jsonb_build_object('ragioneSociale', p_company_name);
    END IF;

    -- Aggiungi telefono se p_phone è fornito e non già presente
    IF p_phone IS NOT NULL AND NOT (v_enriched_dati_cliente ? 'telefono') THEN
        v_enriched_dati_cliente := v_enriched_dati_cliente || jsonb_build_object('telefono', p_phone);
    END IF;

    -- ========================================
    -- STEP 5: Creazione utente (ATOMICA)
    -- ========================================
    -- NOTA: company_name e phone non sono colonne della tabella users
    -- I dati azienda/telefono sono dentro dati_cliente JSONB
    -- Se p_auth_user_id è fornito, lo usa come ID (per sync con auth.users)
    INSERT INTO users (
        id,
        email,
        password,
        name,
        role,
        account_type,
        parent_id,
        is_reseller,
        wallet_balance,
        provider,
        dati_cliente,
        assigned_price_list_id,
        created_at,
        updated_at
    ) VALUES (
        COALESCE(p_auth_user_id, gen_random_uuid()),
        v_email_lower,
        p_password_hash,
        p_name,
        'user',
        'user',
        p_reseller_id,
        false,
        0.00,
        'credentials',
        v_enriched_dati_cliente,
        p_price_list_id,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_new_user_id;

    -- ========================================
    -- STEP 6: Log audit (opzionale, non blocca se fallisce)
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
                'tipo_cliente', v_enriched_dati_cliente->>'tipoCliente',
                'created_at', NOW()
            )
        FROM users u
        WHERE u.id = p_reseller_id;
    EXCEPTION WHEN OTHERS THEN
        -- Log silenzioso, non blocca la transazione
        RAISE WARNING 'Audit log failed: %', SQLERRM;
    END;

    -- ========================================
    -- STEP 7: Costruisci risultato
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
'Crea un cliente E assegna un listino in modo ATOMICO. company_name e phone sono inclusi in dati_cliente JSONB.';

-- ============================================
-- FINE MIGRAZIONE
-- ============================================
