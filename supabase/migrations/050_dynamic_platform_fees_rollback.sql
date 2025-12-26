-- ============================================
-- ROLLBACK: 050_dynamic_platform_fees_rollback.sql
-- DESCRIZIONE: Rollback della migrazione 050 - Dynamic Platform Fees
-- DATA: 2025-12-26
-- ============================================
--
-- ⚠️ ATTENZIONE: Questo script rimuove:
-- - Trigger e funzioni per audit
-- - Tabella platform_fee_history (PERDITA DATI AUDIT)
-- - Colonne platform_fee_override e platform_fee_notes dalla tabella users
--
-- Eseguire solo se necessario annullare completamente la feature.
-- ============================================

-- ============================================
-- STEP 1: Rimuovi trigger
-- ============================================

DROP TRIGGER IF EXISTS trigger_audit_platform_fee ON users;

-- ============================================
-- STEP 2: Rimuovi funzioni
-- ============================================

DROP FUNCTION IF EXISTS audit_platform_fee_change() CASCADE;
DROP FUNCTION IF EXISTS get_platform_fee(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_user_platform_fee(UUID, DECIMAL, TEXT) CASCADE;

-- ============================================
-- STEP 3: Rimuovi RLS policies su platform_fee_history
-- ============================================

DROP POLICY IF EXISTS "SuperAdmin can view fee history" ON platform_fee_history;

-- ============================================
-- STEP 4: Droppa tabella audit
-- ============================================

DROP TABLE IF EXISTS platform_fee_history CASCADE;

-- ============================================
-- STEP 5: Rimuovi constraint da users
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_platform_fee_positive'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users DROP CONSTRAINT check_platform_fee_positive;
    RAISE NOTICE '✅ Rimosso constraint: check_platform_fee_positive';
  END IF;
END $$;

-- ============================================
-- STEP 6: Rimuovi colonne da users
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'platform_fee_override'
  ) THEN
    ALTER TABLE users DROP COLUMN platform_fee_override;
    RAISE NOTICE '✅ Rimossa colonna: users.platform_fee_override';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'platform_fee_notes'
  ) THEN
    ALTER TABLE users DROP COLUMN platform_fee_notes;
    RAISE NOTICE '✅ Rimossa colonna: users.platform_fee_notes';
  END IF;
END $$;

-- ============================================
-- COMPLETAMENTO ROLLBACK
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔄 Rollback 050 completato';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'RIMOSSO:';
  RAISE NOTICE '  - Trigger: trigger_audit_platform_fee';
  RAISE NOTICE '  - Funzioni: get_platform_fee, update_user_platform_fee, audit_platform_fee_change';
  RAISE NOTICE '  - Tabella: platform_fee_history';
  RAISE NOTICE '  - Constraint: check_platform_fee_positive';
  RAISE NOTICE '  - Colonne: platform_fee_override, platform_fee_notes';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ I dati audit sono stati persi!';
  RAISE NOTICE '========================================';
END $$;
