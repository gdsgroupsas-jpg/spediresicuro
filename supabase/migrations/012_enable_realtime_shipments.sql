/**
 * Migration: Abilita Realtime per Tabella Shipments
 * 
 * Abilita Supabase Realtime per permettere sincronizzazione
 * in tempo reale tra dispositivi (mobile scanner → desktop lista)
 */

-- ============================================
-- STEP 1: Abilita Realtime per shipments
-- ============================================

-- Abilita publication per shipments (necessario per Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE shipments;

-- Se la publication non esiste, creala
DO $$
BEGIN
  -- Verifica se esiste già la publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
    RAISE NOTICE '✅ Creata publication supabase_realtime';
  ELSE
    -- Aggiungi shipments se non è già inclusa
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE shipments;
      RAISE NOTICE '✅ Aggiunta tabella shipments alla publication supabase_realtime';
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE '⚠️ Tabella shipments già presente nella publication';
    END;
  END IF;
END $$;

-- ============================================
-- STEP 2: Abilita Realtime per users (opzionale, per tracking)
-- ============================================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE users;
    RAISE NOTICE '✅ Aggiunta tabella users alla publication supabase_realtime';
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE '⚠️ Tabella users già presente nella publication';
  END;
END $$;

-- ============================================
-- STEP 3: Configura RLS per Realtime
-- ============================================

-- Assicurati che RLS sia abilitato su shipments
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- Policy per Realtime: gli utenti possono vedere solo le loro spedizioni
-- (già configurato nelle migration precedenti, ma verifichiamo)

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Realtime abilitato per tabella shipments';
  RAISE NOTICE '   - Sincronizzazione automatica tra dispositivi';
  RAISE NOTICE '   - Aggiornamenti in tempo reale';
  RAISE NOTICE '   - Mobile scanner → Desktop lista';
END $$;









