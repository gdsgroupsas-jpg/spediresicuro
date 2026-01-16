-- ============================================
-- MIGRATION: 110_add_vat_semantics_to_price_lists.sql
-- DESCRIZIONE: Aggiunge semantica IVA a price_lists e shipments (ADR-001)
-- DATA: 2026-01-XX
-- BASATO SU: ADR-001: VAT Semantics in Price Lists
-- CRITICITÀ: P1 - Implementazione semantica IVA
-- ============================================
--
-- OBIETTIVO:
-- Aggiungere campi vat_mode e vat_rate a price_lists e shipments per supportare
-- prezzi con IVA inclusa o esclusa, garantendo backward compatibility.
--
-- STRATEGIA:
-- - Colonne nullable (NULL = legacy, assume 'excluded')
-- - Default conservativi (vat_rate = 22.00)
-- - Idempotente (safe to run multiple times)
-- - Zero downtime (non bloccante)
-- ============================================
-- ============================================
-- STEP 1: Aggiungi vat_mode a price_lists (nullable, default NULL)
-- ============================================
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
        AND table_name = 'price_lists'
        AND column_name = 'vat_mode'
) THEN
ALTER TABLE public.price_lists
ADD COLUMN vat_mode TEXT CHECK (vat_mode IN ('included', 'excluded')) DEFAULT NULL;
COMMENT ON COLUMN public.price_lists.vat_mode IS 'Modalità IVA: included = prezzi con IVA inclusa, excluded = prezzi con IVA esclusa, NULL = legacy (assume esclusa)';
RAISE NOTICE '✅ Aggiunto campo: price_lists.vat_mode';
ELSE RAISE NOTICE '⚠️ Campo price_lists.vat_mode già esistente';
END IF;
END $$;
-- ============================================
-- STEP 2: Aggiungi vat_rate a price_lists (nullable, default 22.00)
-- ============================================
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
        AND table_name = 'price_lists'
        AND column_name = 'vat_rate'
) THEN
ALTER TABLE public.price_lists
ADD COLUMN vat_rate DECIMAL(5, 2) DEFAULT 22.00 CHECK (
        vat_rate >= 0
        AND vat_rate <= 100
    );
COMMENT ON COLUMN public.price_lists.vat_rate IS 'Aliquota IVA in percentuale (default 22% per Italia). Usato solo se vat_mode = included per calcolo reverse.';
-- Popola vat_rate per listini esistenti (default 22%)
UPDATE public.price_lists
SET vat_rate = 22.00
WHERE vat_rate IS NULL;
RAISE NOTICE '✅ Aggiunto campo: price_lists.vat_rate';
ELSE RAISE NOTICE '⚠️ Campo price_lists.vat_rate già esistente';
END IF;
END $$;
-- ============================================
-- STEP 3: Aggiungi vat_mode a shipments (nullable, default NULL)
-- ============================================
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
        AND table_name = 'shipments'
        AND column_name = 'vat_mode'
) THEN
ALTER TABLE public.shipments
ADD COLUMN vat_mode TEXT CHECK (vat_mode IN ('included', 'excluded')) DEFAULT NULL;
COMMENT ON COLUMN public.shipments.vat_mode IS 'Modalità IVA del prezzo finale: included = IVA inclusa, excluded = IVA esclusa, NULL = legacy (assume esclusa)';
RAISE NOTICE '✅ Aggiunto campo: shipments.vat_mode';
ELSE RAISE NOTICE '⚠️ Campo shipments.vat_mode già esistente';
END IF;
END $$;
-- ============================================
-- STEP 4: Aggiungi vat_rate a shipments (nullable, default 22.00)
-- ============================================
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
        AND table_name = 'shipments'
        AND column_name = 'vat_rate'
) THEN
ALTER TABLE public.shipments
ADD COLUMN vat_rate DECIMAL(5, 2) DEFAULT 22.00 CHECK (
        vat_rate >= 0
        AND vat_rate <= 100
    );
COMMENT ON COLUMN public.shipments.vat_rate IS 'Aliquota IVA applicata (default 22% per Italia)';
-- Popola vat_rate per spedizioni esistenti (default 22%)
UPDATE public.shipments
SET vat_rate = 22.00
WHERE vat_rate IS NULL;
RAISE NOTICE '✅ Aggiunto campo: shipments.vat_rate';
ELSE RAISE NOTICE '⚠️ Campo shipments.vat_rate già esistente';
END IF;
END $$;
-- ============================================
-- STEP 5: Indici per performance (parziali, solo per valori non NULL)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_price_lists_vat_mode ON public.price_lists(vat_mode)
WHERE vat_mode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_vat_mode ON public.shipments(vat_mode)
WHERE vat_mode IS NOT NULL;
-- ============================================
-- COMPLETAMENTO
-- ============================================
DO $$
DECLARE price_lists_vat_mode_exists BOOLEAN;
price_lists_vat_rate_exists BOOLEAN;
shipments_vat_mode_exists BOOLEAN;
shipments_vat_rate_exists BOOLEAN;
BEGIN -- Verifica colonne aggiunte
SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'price_lists'
            AND column_name = 'vat_mode'
    ) INTO price_lists_vat_mode_exists;
SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'price_lists'
            AND column_name = 'vat_rate'
    ) INTO price_lists_vat_rate_exists;
SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'shipments'
            AND column_name = 'vat_mode'
    ) INTO shipments_vat_mode_exists;
SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'shipments'
            AND column_name = 'vat_rate'
    ) INTO shipments_vat_rate_exists;
RAISE NOTICE '========================================';
RAISE NOTICE '✅ Migration 110 completata: VAT Semantics';
RAISE NOTICE '========================================';
RAISE NOTICE 'Colonne aggiunte:';
RAISE NOTICE '  - price_lists.vat_mode: %',
CASE
    WHEN price_lists_vat_mode_exists THEN '✅'
    ELSE '❌'
END;
RAISE NOTICE '  - price_lists.vat_rate: %',
CASE
    WHEN price_lists_vat_rate_exists THEN '✅'
    ELSE '❌'
END;
RAISE NOTICE '  - shipments.vat_mode: %',
CASE
    WHEN shipments_vat_mode_exists THEN '✅'
    ELSE '❌'
END;
RAISE NOTICE '  - shipments.vat_rate: %',
CASE
    WHEN shipments_vat_rate_exists THEN '✅'
    ELSE '❌'
END;
RAISE NOTICE '';
RAISE NOTICE '📋 BASATO SU: ADR-001: VAT Semantics in Price Lists';
RAISE NOTICE '🔒 SICUREZZA: Colonne nullable, backward compatible';
RAISE NOTICE '⚡ PERFORMANCE: Indici parziali creati';
RAISE NOTICE '========================================';
END $$;