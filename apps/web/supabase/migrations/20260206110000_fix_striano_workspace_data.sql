-- Fix workspace data per striano@postaexpress.it
--
-- Problemi trovati:
-- 1. workspaces.status = 'deleted' (dovrebbe essere 'active')
-- 2. workspaces.type = 'platform' (dovrebbe essere 'reseller')
-- 3. workspaces.depth = 0 (dovrebbe essere 1)
-- 4. workspaces.parent_workspace_id = NULL (serve parent platform)
-- 5. users.account_type = 'user' (dovrebbe essere 'reseller')
--
-- Root cause: la migration 20260203200008 ha letto account_type='user'
-- prima di is_reseller=true, assegnando type='platform' con depth=0.
-- Successivamente il workspace e' stato marcato 'deleted' (causa sconosciuta).

BEGIN;

-- Step 1: Fix workspace - riattiva e correggi tipo/depth/parent
UPDATE public.workspaces
SET
  status = 'active',
  type = 'reseller',
  depth = 1,
  parent_workspace_id = '2d890a8d-36c9-48be-b3a2-f54fba001db9', -- SpedireSicuro Platform
  updated_at = NOW()
WHERE id = '99d3ae7c-7273-4e54-8e74-c208b7f55dd7'
  AND status = 'deleted'; -- Safety: solo se ancora deleted

-- Step 2: Fix account_type in public.users
UPDATE public.users
SET
  account_type = 'reseller',
  updated_at = NOW()
WHERE id = '68ac74fc-31e7-4aff-8e07-42cc790d6dce'
  AND email = 'striano@postaexpress.it';

-- Step 3: Verifica che il fix sia andato a buon fine
DO $$
DECLARE
  v_ws_status TEXT;
  v_ws_type TEXT;
  v_ws_depth INTEGER;
  v_user_type TEXT;
BEGIN
  SELECT status, type, depth INTO v_ws_status, v_ws_type, v_ws_depth
  FROM public.workspaces
  WHERE id = '99d3ae7c-7273-4e54-8e74-c208b7f55dd7';

  SELECT account_type INTO v_user_type
  FROM public.users
  WHERE id = '68ac74fc-31e7-4aff-8e07-42cc790d6dce';

  -- Verifica workspace
  IF v_ws_status != 'active' THEN
    RAISE EXCEPTION 'Workspace fix FALLITO: status = % (expected active)', v_ws_status;
  END IF;
  IF v_ws_type != 'reseller' THEN
    RAISE EXCEPTION 'Workspace fix FALLITO: type = % (expected reseller)', v_ws_type;
  END IF;
  IF v_ws_depth != 1 THEN
    RAISE EXCEPTION 'Workspace fix FALLITO: depth = % (expected 1)', v_ws_depth;
  END IF;

  -- Verifica user
  IF v_user_type != 'reseller' THEN
    RAISE EXCEPTION 'User fix FALLITO: account_type = % (expected reseller)', v_user_type;
  END IF;

  RAISE NOTICE 'Fix completato: workspace active/reseller/depth=1, user account_type=reseller';
END $$;

COMMIT;
