-- ============================================================================
-- Migration: Wallet Sync Trigger + One-Time Backfill
--
-- STEP 1 della migrazione wallet users → workspaces
--
-- Crea un trigger che sincronizza users.wallet_balance → workspaces.wallet_balance
-- ogni volta che users.wallet_balance viene aggiornato.
-- Esegue anche un backfill one-time per allineare tutti i workspace stale.
--
-- NOTA: Il trigger usa users.primary_workspace_id per trovare il workspace.
-- Per ora 1 utente = 1 workspace (primary), in futuro supporta multi-workspace.
-- ============================================================================

-- 1. Funzione trigger: propaga aggiornamento wallet da users a workspaces
CREATE OR REPLACE FUNCTION public.sync_wallet_to_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Propaga solo se il saldo è effettivamente cambiato
  IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance THEN
    UPDATE workspaces
    SET wallet_balance = NEW.wallet_balance,
        updated_at = NOW()
    WHERE id = NEW.primary_workspace_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_wallet_to_workspace IS
'Trigger function: sincronizza users.wallet_balance → workspaces.wallet_balance.
Parte dello STEP 1 della migrazione wallet users → workspaces.';

-- 2. Crea trigger su users (AFTER UPDATE per non bloccare la transazione principale)
DROP TRIGGER IF EXISTS trg_sync_wallet_to_workspace ON users;

CREATE TRIGGER trg_sync_wallet_to_workspace
  AFTER UPDATE OF wallet_balance ON users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_wallet_to_workspace();

-- 3. One-time backfill: allinea tutti i workspace con saldo diverso da users
UPDATE workspaces w
SET wallet_balance = u.wallet_balance,
    updated_at = NOW()
FROM users u
WHERE w.id = u.primary_workspace_id
  AND u.primary_workspace_id IS NOT NULL
  AND w.wallet_balance IS DISTINCT FROM u.wallet_balance;

-- 4. Completamento
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Conta workspace aggiornati dal backfill
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 20260216120000 completata';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Trigger: trg_sync_wallet_to_workspace';
  RAISE NOTICE 'Backfill: workspace allineati con users.wallet_balance';
  RAISE NOTICE '========================================';
END $$;
