-- ============================================
-- Espansione permessi workspace enterprise
-- ============================================
-- Aggiunge moduli: warehouse, billing, clients, quotes
-- Aggiorna has_workspace_permission() con permessi operator estesi
--
-- NOTA: La colonna permissions TEXT[] non richiede migrazione
-- perche' accetta qualsiasi stringa. Questo aggiornamento
-- riguarda solo la funzione di verifica server-side.
-- ============================================

CREATE OR REPLACE FUNCTION public.has_workspace_permission(
  p_workspace_id UUID,
  p_permission TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_member RECORD;
  v_is_superadmin BOOLEAN;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Superadmin ha tutti i permessi
  SELECT EXISTS(
    SELECT 1 FROM auth.users
    WHERE id = v_user_id
    AND raw_user_meta_data->>'account_type' = 'superadmin'
  ) INTO v_is_superadmin;

  IF v_is_superadmin THEN
    RETURN TRUE;
  END IF;

  -- Trova membership
  SELECT role, permissions INTO v_member
  FROM public.workspace_members
  WHERE workspace_id = p_workspace_id
    AND user_id = v_user_id
    AND status = 'active';

  IF v_member IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Owner e Admin hanno tutti i permessi
  IF v_member.role IN ('owner', 'admin') THEN
    RETURN TRUE;
  END IF;

  -- Verifica permesso specifico (override espliciti)
  IF p_permission = ANY(v_member.permissions) THEN
    RETURN TRUE;
  END IF;

  -- Permessi impliciti per role
  CASE v_member.role
    WHEN 'operator' THEN
      -- Operator: operativita' quotidiana (spedizioni, magazzino, clienti, preventivi)
      RETURN p_permission IN (
        'shipments:create', 'shipments:view', 'shipments:track',
        'wallet:view',
        'contacts:view', 'contacts:create',
        'warehouse:view', 'warehouse:pickup', 'warehouse:delivery',
        'clients:view',
        'quotes:view', 'quotes:create',
        'billing:view'
      );
    WHEN 'viewer' THEN
      -- Viewer: solo consultazione
      RETURN p_permission LIKE '%:view';
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.has_workspace_permission IS
  'Verifica permesso workspace. Supporta moduli: shipments, wallet, members, settings, pricelists, contacts, reports, warehouse, billing, clients, quotes.';
