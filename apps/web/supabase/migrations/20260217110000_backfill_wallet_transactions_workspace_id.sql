-- ============================================================================
-- Migration: Backfill wallet_transactions.workspace_id per record storici
--
-- PROBLEMA: Le RPC wallet ora inseriscono workspace_id nelle nuove transazioni
-- (dal 2026-02-16), ma i record storici hanno workspace_id = NULL.
--
-- SOLUZIONE: Backfill da user_id -> users.primary_workspace_id
-- Pattern identico a invoices/cod backfill (20260217100000).
--
-- SICUREZZA: Solo UPDATE, nessuna modifica strutturale.
-- Condizione IS NULL: non sovrascrive record gia' popolati.
-- ============================================================================

DO $$
DECLARE
  v_updated_count INTEGER := 0;
  v_total_null INTEGER := 0;
  v_total_rows INTEGER := 0;
BEGIN
  -- Report iniziale
  SELECT COUNT(*) INTO v_total_rows FROM wallet_transactions;
  SELECT COUNT(*) INTO v_total_null FROM wallet_transactions WHERE workspace_id IS NULL;

  RAISE NOTICE '=== BACKFILL wallet_transactions.workspace_id ===';
  RAISE NOTICE 'Totale transazioni: %', v_total_rows;
  RAISE NOTICE 'Con workspace_id NULL: %', v_total_null;

  -- Backfill: user_id -> users.primary_workspace_id
  UPDATE wallet_transactions wt
  SET workspace_id = u.primary_workspace_id
  FROM users u
  WHERE wt.user_id = u.id
    AND wt.workspace_id IS NULL
    AND u.primary_workspace_id IS NOT NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Report finale
  RAISE NOTICE 'Transazioni aggiornate: %', v_updated_count;
  RAISE NOTICE 'Residui NULL: %', (SELECT COUNT(*) FROM wallet_transactions WHERE workspace_id IS NULL);
  RAISE NOTICE '=== BACKFILL COMPLETATO ===';
END $$;
