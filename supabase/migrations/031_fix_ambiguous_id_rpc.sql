-- ============================================
-- FIX: RPC Function get_courier_config_for_user
-- Problema: Column reference "id" is ambiguous (error 42702)
-- Causa: Subquery su users usa "id" senza qualificare tabella
-- ============================================

CREATE OR REPLACE FUNCTION get_courier_config_for_user(
  p_user_id UUID,
  p_provider_id TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  provider_id TEXT,
  api_key TEXT,
  api_secret TEXT,
  base_url TEXT,
  contract_mapping JSONB,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.id,
    cc.name,
    cc.provider_id,
    cc.api_key,
    cc.api_secret,
    cc.base_url,
    cc.contract_mapping,
    cc.is_active
  FROM public.courier_configs cc
  WHERE cc.provider_id = p_provider_id
    AND cc.is_active = true
    AND (
      -- Caso 1: Configurazione assegnata specificamente all'utente
      cc.id = (SELECT u.assigned_config_id FROM public.users u WHERE u.id = p_user_id)
      OR
      -- Caso 2: Configurazione default (solo se utente non ha assegnazione)
      (cc.is_default = true AND (SELECT u.assigned_config_id FROM public.users u WHERE u.id = p_user_id) IS NULL)
    )
  ORDER BY 
    -- Priorità: prima assigned, poi default
    CASE WHEN cc.id = (SELECT u.assigned_config_id FROM public.users u WHERE u.id = p_user_id) THEN 0 ELSE 1 END
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_courier_config_for_user IS 
  'Recupera la configurazione corriere per un utente specifico.
   Priorità: 1) Config assegnata, 2) Config default per provider.
   FIX: Qualificato "id" nelle subquery per evitare errore 42702.';
