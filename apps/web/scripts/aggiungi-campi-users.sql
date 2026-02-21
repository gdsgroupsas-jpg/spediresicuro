-- ============================================
-- Script SQL per Aggiungere Campi Mancanti alla Tabella Users
-- ============================================
-- Esegui questo script in Supabase Dashboard → SQL Editor
-- ============================================

-- Aggiungi campo dati_cliente (JSONB per salvare dati cliente completi)
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS dati_cliente JSONB;

-- Aggiungi campo default_sender (JSONB per mittente predefinito)
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS default_sender JSONB;

-- Aggiungi campo integrazioni (JSONB per integrazioni e-commerce)
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS integrazioni JSONB;

-- Verifica che i campi siano stati aggiunti
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('dati_cliente', 'default_sender', 'integrazioni')
ORDER BY column_name;

-- Messaggio di conferma
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Campi aggiunti con successo!';
  RAISE NOTICE 'Verifica i risultati sopra per confermare.';
  RAISE NOTICE '========================================';
END $$;

