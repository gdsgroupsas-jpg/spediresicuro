-- ============================================
-- MIGRATION: 104_get_platform_stats_function.sql
-- DESCRIZIONE: Funzione RPC per calcolare statistiche piattaforma (esclude test e cancellate)
-- DATA: 2026-01-16
-- CRITICITÀ: P0 - FIX DATI FINANZIARI
-- ============================================
--
-- PROBLEMA:
-- getPlatformStatsAction() fa query dirette su platform_provider_costs
-- senza filtrare spedizioni di test o cancellate
--
-- SOLUZIONE:
-- Creare funzione SQL RPC che calcola statistiche corrette
-- con filtri per test e cancellate
--
-- ============================================
-- ============================================
-- FUNZIONE: get_platform_stats()
-- ============================================
CREATE OR REPLACE FUNCTION get_platform_stats() RETURNS TABLE (
        total_shipments BIGINT,
        total_revenue NUMERIC,
        total_cost NUMERIC,
        total_margin NUMERIC,
        avg_margin_percent NUMERIC,
        pending_reconciliation BIGINT,
        negative_margin_count BIGINT,
        last_30_days_shipments BIGINT
    ) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_thirty_days_ago TIMESTAMPTZ;
BEGIN -- Calcola data 30 giorni fa
v_thirty_days_ago := NOW() - INTERVAL '30 days';
-- Statistiche totali (esclude test e cancellate)
RETURN QUERY
SELECT COUNT(*)::BIGINT AS total_shipments,
    COALESCE(SUM(ppc.billed_amount), 0)::NUMERIC AS total_revenue,
    COALESCE(SUM(ppc.provider_cost), 0)::NUMERIC AS total_cost,
    COALESCE(SUM(ppc.platform_margin), 0)::NUMERIC AS total_margin,
    CASE
        WHEN SUM(ppc.provider_cost) > 0 THEN ROUND(
            (
                SUM(ppc.platform_margin) / SUM(ppc.provider_cost) * 100
            )::NUMERIC,
            2
        )
        ELSE 0::NUMERIC
    END AS avg_margin_percent,
    -- Pending reconciliation (esclude test e cancellate)
    (
        SELECT COUNT(*)::BIGINT
        FROM platform_provider_costs ppc2
            JOIN shipments s2 ON s2.id = ppc2.shipment_id
        WHERE ppc2.api_source = 'platform'
            AND ppc2.reconciliation_status IN ('pending', 'discrepancy')
            AND s2.tracking_number NOT LIKE '%TEST%'
            AND (
                s2.deleted = false
                OR s2.deleted IS NULL
            )
    ) AS pending_reconciliation,
    -- Negative margins (esclude test e cancellate)
    (
        SELECT COUNT(*)::BIGINT
        FROM platform_provider_costs ppc3
            JOIN shipments s3 ON s3.id = ppc3.shipment_id
        WHERE ppc3.api_source = 'platform'
            AND ppc3.platform_margin < 0
            AND s3.tracking_number NOT LIKE '%TEST%'
            AND (
                s3.deleted = false
                OR s3.deleted IS NULL
            )
    ) AS negative_margin_count,
    -- Last 30 days (esclude test e cancellate)
    (
        SELECT COUNT(*)::BIGINT
        FROM platform_provider_costs ppc4
            JOIN shipments s4 ON s4.id = ppc4.shipment_id
        WHERE ppc4.api_source = 'platform'
            AND ppc4.created_at >= v_thirty_days_ago
            AND s4.tracking_number NOT LIKE '%TEST%'
            AND (
                s4.deleted = false
                OR s4.deleted IS NULL
            )
    ) AS last_30_days_shipments
FROM platform_provider_costs ppc
    JOIN shipments s ON s.id = ppc.shipment_id
WHERE ppc.api_source = 'platform'
    AND s.tracking_number NOT LIKE '%TEST%' -- 🚫 ESCLUDE SPEDIZIONI DI TEST
    AND (
        s.deleted = false
        OR s.deleted IS NULL
    );
-- 🚫 ESCLUDE SPEDIZIONI CANCELLATE
END;
$$;
-- ============================================
-- COMMENTI
-- ============================================
COMMENT ON FUNCTION get_platform_stats() IS 'Calcola statistiche piattaforma per Financial Dashboard.
   ⚠️ ESCLUDE spedizioni di test (tracking_number LIKE ''%TEST%'')
   ⚠️ ESCLUDE spedizioni cancellate (deleted = true)
   Restituisce: total_shipments, total_revenue, total_cost, total_margin, avg_margin_percent, pending_reconciliation, negative_margin_count, last_30_days_shipments';
-- ============================================
-- GRANTS (solo superadmin può eseguire)
-- ============================================
-- La funzione usa SECURITY DEFINER, quindi solo service_role può eseguirla
-- (gestito via verifySuperAdmin() nel codice TypeScript)
-- ============================================
-- FUNZIONE: get_margin_by_courier()
-- ============================================
CREATE OR REPLACE FUNCTION get_margin_by_courier(p_start_date TIMESTAMPTZ DEFAULT NULL) RETURNS TABLE (
        courier_code TEXT,
        total_shipments BIGINT,
        total_revenue NUMERIC,
        total_cost NUMERIC,
        gross_margin NUMERIC,
        avg_margin_percent NUMERIC
    ) LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN QUERY
SELECT ppc.courier_code,
    COUNT(*)::BIGINT AS total_shipments,
    COALESCE(SUM(ppc.billed_amount), 0)::NUMERIC AS total_revenue,
    COALESCE(SUM(ppc.provider_cost), 0)::NUMERIC AS total_cost,
    COALESCE(SUM(ppc.platform_margin), 0)::NUMERIC AS gross_margin,
    CASE
        WHEN SUM(ppc.provider_cost) > 0 THEN ROUND(
            (
                SUM(ppc.platform_margin) / SUM(ppc.provider_cost) * 100
            )::NUMERIC,
            2
        )
        ELSE 0::NUMERIC
    END AS avg_margin_percent
FROM platform_provider_costs ppc
    JOIN shipments s ON s.id = ppc.shipment_id
WHERE ppc.api_source = 'platform'
    AND s.tracking_number NOT LIKE '%TEST%' -- 🚫 ESCLUDE SPEDIZIONI DI TEST
    AND (
        s.deleted = false
        OR s.deleted IS NULL
    ) -- 🚫 ESCLUDE SPEDIZIONI CANCELLATE
    AND (
        p_start_date IS NULL
        OR ppc.created_at >= p_start_date
    )
GROUP BY ppc.courier_code
ORDER BY gross_margin DESC;
END;
$$;
COMMENT ON FUNCTION get_margin_by_courier(TIMESTAMPTZ) IS 'Calcola margini aggregati per corriere.
   ⚠️ ESCLUDE spedizioni di test e cancellate
   Parametri: p_start_date (opzionale) - filtra da data specifica';
-- ============================================
-- FUNZIONE: get_top_resellers()
-- ============================================
CREATE OR REPLACE FUNCTION get_top_resellers(
        p_limit INTEGER DEFAULT 20,
        p_start_date TIMESTAMPTZ DEFAULT NULL
    ) RETURNS TABLE (
        user_id UUID,
        user_email TEXT,
        user_name TEXT,
        total_shipments BIGINT,
        total_billed NUMERIC,
        margin_generated NUMERIC
    ) LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN QUERY
SELECT ppc.billed_user_id AS user_id,
    u.email AS user_email,
    u.name AS user_name,
    COUNT(*)::BIGINT AS total_shipments,
    COALESCE(SUM(ppc.billed_amount), 0)::NUMERIC AS total_billed,
    COALESCE(SUM(ppc.platform_margin), 0)::NUMERIC AS margin_generated
FROM platform_provider_costs ppc
    JOIN shipments s ON s.id = ppc.shipment_id
    LEFT JOIN users u ON u.id = ppc.billed_user_id
WHERE ppc.api_source = 'platform'
    AND s.tracking_number NOT LIKE '%TEST%' -- 🚫 ESCLUDE SPEDIZIONI DI TEST
    AND (
        s.deleted = false
        OR s.deleted IS NULL
    ) -- 🚫 ESCLUDE SPEDIZIONI CANCELLATE
    AND (
        p_start_date IS NULL
        OR ppc.created_at >= p_start_date
    )
GROUP BY ppc.billed_user_id,
    u.email,
    u.name
ORDER BY total_billed DESC
LIMIT p_limit;
END;
$$;
COMMENT ON FUNCTION get_top_resellers(INTEGER, TIMESTAMPTZ) IS 'Calcola top resellers per platform usage.
   ⚠️ ESCLUDE spedizioni di test e cancellate
   Parametri: p_limit (default 20), p_start_date (opzionale)';
-- ============================================
-- VERIFICA
-- ============================================
DO $$ BEGIN RAISE NOTICE '========================================';
RAISE NOTICE '✅ Migration 104 completata con successo';
RAISE NOTICE '';
RAISE NOTICE '📊 FUNZIONI CREATE:';
RAISE NOTICE '   1. get_platform_stats()';
RAISE NOTICE '   2. get_margin_by_courier(p_start_date)';
RAISE NOTICE '   3. get_top_resellers(p_limit, p_start_date)';
RAISE NOTICE '';
RAISE NOTICE '🔍 FILTRI APPLICATI (tutte le funzioni):';
RAISE NOTICE '   - tracking_number NOT LIKE ''%%TEST%%''';
RAISE NOTICE '   - deleted = false OR deleted IS NULL';
RAISE NOTICE '';
RAISE NOTICE '📈 USO:';
RAISE NOTICE '   SELECT * FROM get_platform_stats();';
RAISE NOTICE '   SELECT * FROM get_margin_by_courier(''2026-01-01''::timestamptz);';
RAISE NOTICE '   SELECT * FROM get_top_resellers(20, ''2026-01-01''::timestamptz);';
RAISE NOTICE '';
RAISE NOTICE '========================================';
END $$;