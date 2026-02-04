-- ============================================
-- MIGRAZIONE: Aggiunge workspace_id alle tabelle operative
-- ============================================
-- Parte del refactoring Architecture V2
--
-- Tabelle modificate:
-- - shipments: workspace_id per isolamento
-- - wallet_transactions: workspace_id per tracking
-- - audit_logs: workspace_id per context
--
-- NOTA: workspace_id e' nullable inizialmente per backward compatibility
-- Sara' reso NOT NULL dopo la migrazione dati
-- ============================================

-- ============================================
-- SHIPMENTS
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'shipments'
    AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.shipments ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);
    RAISE NOTICE 'Aggiunta colonna workspace_id a shipments';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_shipments_workspace ON public.shipments(workspace_id) WHERE workspace_id IS NOT NULL;

COMMENT ON COLUMN public.shipments.workspace_id IS 'Workspace proprietario della spedizione. Per isolamento multi-tenant.';

-- ============================================
-- WALLET_TRANSACTIONS
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'wallet_transactions'
    AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.wallet_transactions ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);
    RAISE NOTICE 'Aggiunta colonna workspace_id a wallet_transactions';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_wallet_tx_workspace ON public.wallet_transactions(workspace_id) WHERE workspace_id IS NOT NULL;

COMMENT ON COLUMN public.wallet_transactions.workspace_id IS 'Workspace della transazione. Per wallet a cascata.';

-- ============================================
-- AUDIT_LOGS
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'audit_logs'
    AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);
    RAISE NOTICE 'Aggiunta colonna workspace_id a audit_logs';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_audit_workspace ON public.audit_logs(workspace_id) WHERE workspace_id IS NOT NULL;

COMMENT ON COLUMN public.audit_logs.workspace_id IS 'Workspace context dell azione. Per audit trail.';

-- ============================================
-- PRICE_LISTS
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'price_lists'
    AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.price_lists ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);
    RAISE NOTICE 'Aggiunta colonna workspace_id a price_lists';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_pricelist_workspace ON public.price_lists(workspace_id) WHERE workspace_id IS NOT NULL;

COMMENT ON COLUMN public.price_lists.workspace_id IS 'Workspace proprietario del listino. Per isolamento.';

-- ============================================
-- FIX CRITICO: is_sub_user_of()
-- ============================================
-- Questa funzione era USATA in RLS ma NON ESISTEVA!
-- Ora usiamo workspace, ma manteniamo per backward compatibility
CREATE OR REPLACE FUNCTION public.is_sub_user_of(
  p_user_id UUID,
  p_parent_id UUID,
  max_depth INTEGER DEFAULT 10
)
RETURNS BOOLEAN AS $$
DECLARE
  current_id UUID := p_user_id;
  current_depth INTEGER := 0;
BEGIN
  -- Stesso utente = true (l'utente e' "sotto" se stesso)
  IF p_user_id = p_parent_id THEN
    RETURN TRUE;
  END IF;

  -- NULL check
  IF p_user_id IS NULL OR p_parent_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Walk up usando parent_id nella tabella users (legacy)
  WHILE current_id IS NOT NULL AND current_depth < max_depth LOOP
    SELECT parent_id INTO current_id
    FROM public.users
    WHERE id = current_id;

    IF current_id = p_parent_id THEN
      RETURN TRUE;
    END IF;

    current_depth := current_depth + 1;
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.is_sub_user_of(UUID, UUID, INTEGER) IS 'LEGACY: Verifica se user_id e sotto parent_id. Usare is_sub_workspace_of per nuovo codice.';

-- ============================================
-- Tabella users: aggiungi primary_workspace_id
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'primary_workspace_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN primary_workspace_id UUID REFERENCES public.workspaces(id);
    RAISE NOTICE 'Aggiunta colonna primary_workspace_id a users';
  END IF;
END;
$$;

COMMENT ON COLUMN public.users.primary_workspace_id IS 'Workspace default dell utente. Usato per redirect dopo login.';

-- ============================================
-- FINE MIGRAZIONE workspace_id
-- ============================================
