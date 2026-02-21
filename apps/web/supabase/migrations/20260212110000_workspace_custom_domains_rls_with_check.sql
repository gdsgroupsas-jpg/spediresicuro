-- ============================================================
-- Migration: RLS WITH CHECK esplicito per workspace_custom_domains
--
-- La policy FOR ALL senza WITH CHECK usa implicitamente USING,
-- ma best practice richiede WITH CHECK esplicito per prevenire
-- INSERT/UPDATE con workspace_id non appartenente all'utente.
-- ============================================================

-- Drop e ricrea la policy con WITH CHECK esplicito
DROP POLICY IF EXISTS "ws_owner_manage_custom_domain" ON workspace_custom_domains;

CREATE POLICY "ws_owner_manage_custom_domain" ON workspace_custom_domains
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
  ));
