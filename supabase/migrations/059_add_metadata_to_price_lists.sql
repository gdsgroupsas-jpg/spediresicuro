-- ============================================
-- MIGRATION: 059_add_metadata_to_price_lists.sql
-- DESCRIZIONE: Aggiunge colonna metadata (JSONB) a price_lists se non esiste
-- DATA: 2026-01-04
-- CRITICITÀ: P1 - Fix sync listini
-- ============================================
--
-- PROBLEMA:
-- La colonna metadata non esiste in produzione, causando errore PGRST204
-- durante la sincronizzazione listini da Spedisci.Online.
--
-- SOLUZIONE:
-- Aggiunge colonna metadata JSONB se non esiste, con fallback a source_metadata
-- per retrocompatibilità.
-- ============================================

-- ============================================
-- STEP 1: Aggiungi colonna metadata se non esiste
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'price_lists' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.price_lists 
    ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    
    -- Indice GIN per query JSONB efficienti
    CREATE INDEX IF NOT EXISTS idx_price_lists_metadata 
    ON public.price_lists USING GIN (metadata);
    
    COMMENT ON COLUMN public.price_lists.metadata IS 
    'Metadati flessibili (JSONB) per informazioni aggiuntive, es. courier_config_id per sync listini';
    
    RAISE NOTICE '✅ Colonna metadata aggiunta a price_lists';
  ELSE
    RAISE NOTICE '⚠️ Colonna metadata già esistente in price_lists';
  END IF;
END $$;

-- ============================================
-- STEP 2: Migra dati da source_metadata a metadata (se source_metadata esiste e ha dati)
-- ============================================

DO $$
BEGIN
  -- Verifica se source_metadata esiste e ha dati
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'price_lists' 
    AND column_name = 'source_metadata'
  ) THEN
    -- Migra dati da source_metadata a metadata (solo se metadata è vuoto/null)
    UPDATE public.price_lists
    SET metadata = source_metadata
    WHERE (metadata IS NULL OR metadata = '{}'::jsonb)
      AND source_metadata IS NOT NULL
      AND source_metadata != '{}'::jsonb;
    
    IF FOUND THEN
      RAISE NOTICE '✅ Dati migrati da source_metadata a metadata';
    ELSE
      RAISE NOTICE 'ℹ️ Nessun dato da migrare da source_metadata';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️ source_metadata non esiste, skip migrazione';
  END IF;
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 059 completata con successo';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Colonna aggiunta:';
  RAISE NOTICE '  - price_lists.metadata (JSONB)';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 FIX SYNC LISTINI:';
  RAISE NOTICE '  - Errore PGRST204 risolto';
  RAISE NOTICE '  - Sync listini ora funziona correttamente';
  RAISE NOTICE '========================================';
END $$;

