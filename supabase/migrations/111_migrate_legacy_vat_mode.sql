-- ============================================
-- MIGRATION: 111_migrate_legacy_vat_mode.sql
-- DESCRIZIONE: Migrazione conservativa dati legacy → explicit VAT mode (ADR-001)
-- DATA: 2026-01-XX
-- BASATO SU: ADR-001: VAT Semantics in Price Lists
-- CRITICITÀ: P1 - Migrazione dati legacy
-- ============================================
--
-- OBIETTIVO:
-- Aggiornare listini e spedizioni esistenti con vat_mode = NULL a valori espliciti.
-- Strategia conservativa: assume tutti i dati legacy sono IVA esclusa (vat_mode = 'excluded').
--
-- STRATEGIA:
-- - Conservativa: assume vat_mode = 'excluded' per tutti i dati legacy
-- - Idempotente: safe to run multiple times (solo aggiorna NULL)
-- - Zero downtime: UPDATE non bloccante
-- - Superadmin può correggere manualmente se necessario
-- ============================================
-- ============================================
-- STEP 1: Migrazione Listini Esistenti
-- ============================================
-- Strategia conservativa: assume tutti i listini esistenti sono IVA esclusa
-- Superadmin può correggere manualmente se necessario
DO $$
DECLARE updated_count INTEGER;
BEGIN -- Aggiorna solo listini con vat_mode = NULL
UPDATE public.price_lists
SET vat_mode = 'excluded',
    vat_rate = COALESCE(vat_rate, 22.00) -- Mantieni vat_rate esistente o imposta default
WHERE vat_mode IS NULL;
GET DIAGNOSTICS updated_count = ROW_COUNT;
RAISE NOTICE '✅ Migrati % listini legacy → vat_mode = excluded',
updated_count;
END $$;
-- ============================================
-- STEP 2: Migrazione Spedizioni Esistenti
-- ============================================
-- Strategia conservativa: assume tutte le spedizioni esistenti sono IVA esclusa
DO $$
DECLARE updated_count INTEGER;
BEGIN -- Aggiorna solo spedizioni con vat_mode = NULL
UPDATE public.shipments
SET vat_mode = 'excluded',
    vat_rate = COALESCE(vat_rate, 22.00) -- Mantieni vat_rate esistente o imposta default
WHERE vat_mode IS NULL;
GET DIAGNOSTICS updated_count = ROW_COUNT;
RAISE NOTICE '✅ Migrate % spedizioni legacy → vat_mode = excluded',
updated_count;
END $$;
-- ============================================
-- STEP 3: Verifica Risultati
-- ============================================
-- Verifica distribuzione vat_mode nei listini
DO $$
DECLARE excluded_count INTEGER;
included_count INTEGER;
null_count INTEGER;
BEGIN
SELECT COUNT(*) INTO excluded_count
FROM public.price_lists
WHERE vat_mode = 'excluded';
SELECT COUNT(*) INTO included_count
FROM public.price_lists
WHERE vat_mode = 'included';
SELECT COUNT(*) INTO null_count
FROM public.price_lists
WHERE vat_mode IS NULL;
RAISE NOTICE '📊 [PRICE_LISTS] Distribuzione vat_mode:';
RAISE NOTICE '   - excluded: %',
excluded_count;
RAISE NOTICE '   - included: %',
included_count;
RAISE NOTICE '   - NULL (legacy): %',
null_count;
END $$;
-- Verifica distribuzione vat_mode nelle spedizioni
DO $$
DECLARE excluded_count INTEGER;
included_count INTEGER;
null_count INTEGER;
BEGIN
SELECT COUNT(*) INTO excluded_count
FROM public.shipments
WHERE vat_mode = 'excluded';
SELECT COUNT(*) INTO included_count
FROM public.shipments
WHERE vat_mode = 'included';
SELECT COUNT(*) INTO null_count
FROM public.shipments
WHERE vat_mode IS NULL;
RAISE NOTICE '📊 [SHIPMENTS] Distribuzione vat_mode:';
RAISE NOTICE '   - excluded: %',
excluded_count;
RAISE NOTICE '   - included: %',
included_count;
RAISE NOTICE '   - NULL (legacy): %',
null_count;
END $$;
-- ============================================
-- NOTA IMPORTANTE
-- ============================================
-- Questa migration è CONSERVATIVA: assume tutti i dati legacy sono IVA esclusa.
-- Se alcuni listini o spedizioni hanno IVA inclusa, devono essere corretti manualmente
-- tramite interfaccia admin o query SQL diretta.
--
-- Esempio correzione manuale (se necessario):
-- UPDATE price_lists SET vat_mode = 'included' WHERE id = 'xxx' AND ...;
-- ============================================
DO $$ BEGIN RAISE NOTICE '✅ Migration completata: Dati legacy migrati a vat_mode esplicito';
END $$;