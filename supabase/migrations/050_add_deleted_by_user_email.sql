-- Migration: Aggiungi campo deleted_by_user_email per tracciabilità completa cancellazioni
-- Data: 2025-12-31
-- Descrizione: Aggiunge campo deleted_by_user_email alla tabella shipments per tracciare chi ha cancellato una spedizione

-- Aggiungi colonna deleted_by_user_email se non esiste
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'deleted_by_user_email'
  ) THEN
    ALTER TABLE shipments ADD COLUMN deleted_by_user_email TEXT;
    RAISE NOTICE '✅ Aggiunto campo: deleted_by_user_email';
  ELSE
    RAISE NOTICE 'ℹ️ Campo deleted_by_user_email già esistente';
  END IF;
END $$;

-- Crea indice per query veloci su spedizioni cancellate
CREATE INDEX IF NOT EXISTS idx_shipments_deleted_by_email 
ON shipments(deleted_by_user_email) 
WHERE deleted = true AND deleted_by_user_email IS NOT NULL;

-- Crea indice per query veloci su spedizioni cancellate per data
CREATE INDEX IF NOT EXISTS idx_shipments_deleted_at 
ON shipments(deleted_at DESC) 
WHERE deleted = true;

