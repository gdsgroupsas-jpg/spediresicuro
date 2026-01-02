-- ============================================
-- MIGRATION: 056_add_list_type.sql
-- DESCRIZIONE: Aggiunge campo list_type a price_lists per distinguere listini fornitore, personalizzati e globali
-- DATA: 2026-01 (Listini Fornitore - Fase 1)
-- ============================================

-- ============================================
-- STEP 1: Aggiungi campo list_type
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_lists' AND column_name = 'list_type'
  ) THEN
    -- Aggiungi colonna list_type
    ALTER TABLE price_lists 
    ADD COLUMN list_type TEXT;
    
    -- Aggiungi CHECK constraint per valori validi
    ALTER TABLE price_lists 
    ADD CONSTRAINT check_list_type_values 
    CHECK (list_type IS NULL OR list_type IN ('supplier', 'custom', 'global'));
    
    -- Commento colonna
    COMMENT ON COLUMN price_lists.list_type IS 
    'Tipo listino: supplier (fornitore Reseller/BYOC), custom (personalizzato Reseller), global (globale Super Admin)';
    
    RAISE NOTICE '✅ Aggiunto campo: price_lists.list_type';
  ELSE
    RAISE NOTICE '⚠️ Campo price_lists.list_type già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 2: Crea indice per performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_price_lists_list_type 
ON price_lists(list_type) 
WHERE list_type IS NOT NULL;

COMMENT ON INDEX idx_price_lists_list_type IS 
'Indice parziale per query su list_type (solo valori non NULL)';

-- ============================================
-- STEP 3: Verifica finale
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 056 completata con successo';
  RAISE NOTICE '✅ Campo list_type aggiunto a price_lists';
  RAISE NOTICE '✅ CHECK constraint creato';
  RAISE NOTICE '✅ Indice parziale creato';
  RAISE NOTICE '========================================';
END $$;

