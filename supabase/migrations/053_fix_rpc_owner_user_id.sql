-- ============================================
-- Migration: 053 - Fix RPC get_courier_config_for_user for Reseller/BYOC
-- Description: Aggiunge supporto per owner_user_id nella funzione RPC
-- ============================================
--
-- PROBLEMA:
-- La funzione get_courier_config_for_user non considera owner_user_id,
-- quindi i reseller/BYOC non trovano la loro configurazione personale.
--
-- SOLUZIONE:
-- Aggiunta priorità per configurazione personale (owner_user_id = p_user_id)
-- prima di cercare assigned_config_id o config default.
-- ============================================

-- ⚠️ DROP prima di ricreare (return type cambiato: aggiunti account_type, owner_user_id)
DROP FUNCTION IF EXISTS get_courier_config_for_user(UUID, TEXT);

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
  is_active BOOLEAN,
  account_type TEXT,
  owner_user_id UUID
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
    cc.is_active,
    cc.account_type,
    cc.owner_user_id
  FROM public.courier_configs cc
  WHERE cc.provider_id = p_provider_id
    AND cc.is_active = true
    AND (
      -- Priorità 1: Configurazione personale (owner_user_id = p_user_id)
      cc.owner_user_id = p_user_id
      OR
      -- Priorità 2: Configurazione assegnata specificamente all'utente
      cc.id = (SELECT u.assigned_config_id FROM public.users u WHERE u.id = p_user_id)
      OR
      -- Priorità 3: Configurazione default (solo se utente non ha assegnazione né config personale)
      (
        cc.is_default = true 
        AND (SELECT u.assigned_config_id FROM public.users u WHERE u.id = p_user_id) IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.courier_configs cc2 
          WHERE cc2.owner_user_id = p_user_id 
            AND cc2.provider_id = p_provider_id 
            AND cc2.is_active = true
        )
      )
    )
  ORDER BY 
    -- Priorità: prima personale, poi assigned, poi default
    CASE 
      WHEN cc.owner_user_id = p_user_id THEN 0
      WHEN cc.id = (SELECT u.assigned_config_id FROM public.users u WHERE u.id = p_user_id) THEN 1
      ELSE 2 
    END
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_courier_config_for_user IS 
  'Recupera la configurazione corriere per un utente specifico.
   Priorità: 1) Config personale (owner_user_id), 2) Config assegnata, 3) Config default.
   FIX 053: Aggiunto supporto per owner_user_id (reseller/BYOC).';

-- ============================================
-- Verifica finale
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 053 completata';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RPC get_courier_config_for_user aggiornata con supporto owner_user_id';
  RAISE NOTICE '';
  RAISE NOTICE 'Ordine di priorità:';
  RAISE NOTICE '  1. Config personale (owner_user_id = user_id)';
  RAISE NOTICE '  2. Config assegnata (assigned_config_id)';
  RAISE NOTICE '  3. Config default per provider (is_default = true)';
  RAISE NOTICE '========================================';
END $$;
