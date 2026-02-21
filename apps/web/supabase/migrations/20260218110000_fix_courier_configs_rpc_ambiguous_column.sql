-- ============================================
-- Fix: get_user_owned_courier_configs — colonna "account_type" ambigua
-- ============================================
-- Bug: PostgreSQL errore 42702 "column reference account_type is ambiguous"
-- Causa: la funzione ha account_type sia nel RETURNS TABLE sia nella SELECT FROM users,
--        e PL/pgSQL non sa quale usare.
-- Fix: qualificare tutte le colonne con alias tabella ("u" per users, "cc" per courier_configs).
--
-- BUSINESS RULE INVARIATA:
-- Superadmin/admin: vedono SOLO config globali + proprie (privacy reseller rispettata)
-- Reseller: solo config proprie

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
    -- Recupera info utente (FIX: qualifica con alias "u" per evitare ambiguità)
    SELECT u.account_type, COALESCE(u.is_reseller, false), u.email
    INTO v_user_account_type, v_user_is_reseller, v_user_email
    FROM users u
    WHERE u.id = p_user_id;

    IF v_user_account_type IS NULL THEN
        RETURN;
    END IF;

    -- ==========================================
    -- Superadmin/Admin: config globali + proprie
    -- ==========================================
    -- NON vedono config private dei reseller (privacy business)

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

    -- Utente normale: nessuna config
    RETURN;

END;
$$;

COMMENT ON FUNCTION public.get_user_owned_courier_configs IS
'Restituisce le configurazioni API corrieri visibili all utente.
Superadmin/admin: config globali + proprie (privacy reseller rispettata).
Reseller: solo config proprie (privacy totale).
Utente normale: nessuna.';
