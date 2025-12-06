/**
 * Migration: Campi Resi per Spedizioni
 * 
 * Aggiunge campi per gestire i resi delle spedizioni:
 * - is_return: flag per identificare spedizioni di reso
 * - original_shipment_id: riferimento alla spedizione originale
 * - return_reason: motivo del reso
 * - return_status: stato del reso (requested, processing, completed, cancelled)
 * 
 * Data: 2024
 */

-- ============================================
-- STEP 1: Aggiungi ENUM per stato reso (se non esiste)
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'return_status') THEN
    CREATE TYPE return_status AS ENUM ('requested', 'processing', 'completed', 'cancelled');
    RAISE NOTICE '✅ Creato ENUM: return_status';
  ELSE
    RAISE NOTICE '⚠️ ENUM return_status già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 2: Aggiungi campo is_return
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'is_return'
  ) THEN
    ALTER TABLE shipments ADD COLUMN is_return BOOLEAN DEFAULT false;
    COMMENT ON COLUMN shipments.is_return IS 'Flag per identificare spedizioni di reso';
    RAISE NOTICE '✅ Aggiunto campo: is_return';
  ELSE
    RAISE NOTICE '⚠️ Campo is_return già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 3: Aggiungi campo original_shipment_id
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'original_shipment_id'
  ) THEN
    ALTER TABLE shipments ADD COLUMN original_shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL;
    COMMENT ON COLUMN shipments.original_shipment_id IS 'Riferimento alla spedizione originale (per resi)';
    RAISE NOTICE '✅ Aggiunto campo: original_shipment_id';
  ELSE
    RAISE NOTICE '⚠️ Campo original_shipment_id già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 4: Aggiungi campo return_reason
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'return_reason'
  ) THEN
    ALTER TABLE shipments ADD COLUMN return_reason TEXT;
    COMMENT ON COLUMN shipments.return_reason IS 'Motivo del reso (es: "Prodotto difettoso", "Cambio taglia", etc.)';
    RAISE NOTICE '✅ Aggiunto campo: return_reason';
  ELSE
    RAISE NOTICE '⚠️ Campo return_reason già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 5: Aggiungi campo return_status
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'return_status'
  ) THEN
    ALTER TABLE shipments ADD COLUMN return_status TEXT;
    COMMENT ON COLUMN shipments.return_status IS 'Stato del reso: requested, processing, completed, cancelled';
    RAISE NOTICE '✅ Aggiunto campo: return_status';
  ELSE
    RAISE NOTICE '⚠️ Campo return_status già esistente';
  END IF;
END $$;

-- Aggiungi constraint per return_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'shipments_return_status_check'
  ) THEN
    ALTER TABLE shipments 
    ADD CONSTRAINT shipments_return_status_check 
    CHECK (
      return_status IS NULL 
      OR return_status IN ('requested', 'processing', 'completed', 'cancelled')
    );
    
    RAISE NOTICE '✅ Aggiunto constraint: return_status';
  ELSE
    RAISE NOTICE '⚠️ Constraint return_status già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 6: Crea indici per performance
-- ============================================

-- Indice per is_return
CREATE INDEX IF NOT EXISTS idx_shipments_is_return 
ON shipments(is_return) 
WHERE is_return = true;

-- Indice per original_shipment_id
CREATE INDEX IF NOT EXISTS idx_shipments_original_shipment 
ON shipments(original_shipment_id) 
WHERE original_shipment_id IS NOT NULL;

-- Indice per return_status
CREATE INDEX IF NOT EXISTS idx_shipments_return_status 
ON shipments(return_status) 
WHERE return_status IS NOT NULL;

-- Indice composito per query resi comuni
CREATE INDEX IF NOT EXISTS idx_shipments_return_composite 
ON shipments(is_return, return_status) 
WHERE is_return = true;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration completata: Campi resi aggiunti a shipments';
  RAISE NOTICE '   - Campo is_return';
  RAISE NOTICE '   - Campo original_shipment_id';
  RAISE NOTICE '   - Campo return_reason';
  RAISE NOTICE '   - Campo return_status';
  RAISE NOTICE '   - Indici creati per performance';
END $$;





