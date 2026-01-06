-- ============================================
-- MIGRATION: 061_audit_security_fixes.sql
-- DESCRIZIONE: Fix integrità dati evidenziati nell'audit di sicurezza
-- DATA: 2026-01
-- ============================================

-- STEP 1: Pulizia dati incoerenti (Orphan Supplier Lists)
-- Rimuove listini di tipo 'supplier' che non hanno un courier_id
-- Questo è necessario prima di applicare il vincolo NOT NULL
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM price_lists 
  WHERE list_type = 'supplier' AND courier_id IS NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE '⚠️ Rimossi % listini fornitore orfani (senza courier_id)', deleted_count;
  ELSE
    RAISE NOTICE '✅ Nessun listino orfano trovato. Database pulito.';
  END IF;
END $$;

-- STEP 2: Aggiunta Vincolo di Integrità (Constraint)
-- Assicura che ogni listino 'supplier' abbia un courier_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_supplier_has_courier' 
    AND table_name = 'price_lists'
  ) THEN
    ALTER TABLE price_lists 
    ADD CONSTRAINT check_supplier_has_courier 
    CHECK (list_type != 'supplier' OR courier_id IS NOT NULL);
    
    RAISE NOTICE '✅ Constraint check_supplier_has_courier aggiunto con successo';
  ELSE
    RAISE NOTICE 'ℹ️ Constraint check_supplier_has_courier già presente';
  END IF;
END $$;

-- STEP 3: Hardening su colonne critiche (Opzionale ma raccomandato)
-- Assicura che list_type non sia nullo (dovrebbe già esserlo, ma rafforziamo)
ALTER TABLE price_lists ALTER COLUMN list_type SET DEFAULT 'custom';
-- (Nota: non mettiamo NOT NULL ora per evitare rischi su deploy, ma mettiamo default sicuro)
