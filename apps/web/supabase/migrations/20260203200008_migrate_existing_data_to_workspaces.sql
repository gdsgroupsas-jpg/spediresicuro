-- ============================================
-- MIGRAZIONE: Assegna workspace_id ai dati esistenti
-- ============================================
-- Parte del refactoring Architecture V2
--
-- STRATEGIA:
-- 1. Per ogni utente esistente, crea un workspace "personale"
-- 2. Assegna tutti i record esistenti al workspace dell'utente
-- 3. Mantiene backward-compatibility (workspace_id rimane nullable)
--
-- NOTA: Questa migrazione è IDEMPOTENTE - può essere eseguita più volte
-- ============================================

-- ============================================
-- STEP 1: Crea Organization di default per utenti esistenti
-- ============================================
DO $$
DECLARE
  v_default_org_id UUID;
  v_user RECORD;
  v_workspace_id UUID;
BEGIN
  -- Crea Organization di default "SpedireSicuro" se non esiste
  INSERT INTO public.organizations (
    name,
    slug,
    billing_email,
    white_label_level,
    status,
    created_by
  )
  SELECT
    'SpedireSicuro',
    'spediresicuro',
    'billing@spediresicuro.it',
    1,
    'active',
    NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organizations WHERE slug = 'spediresicuro'
  )
  RETURNING id INTO v_default_org_id;

  -- Se già esisteva, ottieni l'ID
  IF v_default_org_id IS NULL THEN
    SELECT id INTO v_default_org_id FROM public.organizations WHERE slug = 'spediresicuro';
  END IF;

  RAISE NOTICE 'Organization default ID: %', v_default_org_id;

  -- ============================================
  -- STEP 2: Per ogni utente senza primary_workspace_id, crea workspace personale
  -- ============================================
  -- IMPORTANTE: Seleziona SOLO utenti che esistono in ENTRAMBE le tabelle
  -- (public.users E auth.users) per evitare FK violation
  FOR v_user IN
    SELECT u.id, u.email, u.name, u.account_type, u.is_reseller
    FROM public.users u
    WHERE u.primary_workspace_id IS NULL
      AND u.email IS NOT NULL
      AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id)
  LOOP
    -- Genera slug univoco dal email
    DECLARE
      v_slug TEXT;
      v_workspace_type TEXT;
      v_workspace_depth INTEGER;
    BEGIN
      v_slug := LOWER(REGEXP_REPLACE(SPLIT_PART(v_user.email, '@', 1), '[^a-z0-9]', '-', 'g'));
      v_slug := v_slug || '-' || SUBSTRING(v_user.id::TEXT, 1, 8);

      -- Determina tipo workspace in base ad account_type
      IF v_user.account_type = 'superadmin' THEN
        v_workspace_type := 'platform';
        v_workspace_depth := 0;
      ELSIF v_user.is_reseller = TRUE OR v_user.account_type = 'reseller' THEN
        v_workspace_type := 'reseller';
        v_workspace_depth := 1;
      ELSE
        v_workspace_type := 'client';
        v_workspace_depth := 2;
      END IF;

      -- Crea workspace per l'utente
      -- NOTA: created_by è NULL per evitare FK violation se utente non esiste in auth.users
      INSERT INTO public.workspaces (
        organization_id,
        name,
        slug,
        type,
        depth,
        wallet_balance,
        status,
        created_by
      )
      SELECT
        v_default_org_id,
        COALESCE(v_user.name, SPLIT_PART(v_user.email, '@', 1)) || ' Workspace',
        v_slug,
        v_workspace_type,
        v_workspace_depth,
        COALESCE((SELECT wallet_balance FROM public.users WHERE id = v_user.id), 0),
        'active',
        NULL  -- Evita FK violation se utente non in auth.users
      WHERE NOT EXISTS (
        SELECT 1 FROM public.workspaces WHERE slug = v_slug
      )
      RETURNING id INTO v_workspace_id;

      -- Se workspace già esisteva, ottieni ID
      IF v_workspace_id IS NULL THEN
        SELECT id INTO v_workspace_id FROM public.workspaces WHERE slug = v_slug;
      END IF;

      IF v_workspace_id IS NOT NULL THEN
        -- Aggiungi utente come owner del workspace
        -- NOTA: invited_by è NULL per evitare FK violation se utente non esiste in auth.users
        INSERT INTO public.workspace_members (
          workspace_id,
          user_id,
          role,
          status,
          accepted_at,
          invited_by
        )
        SELECT
          v_workspace_id,
          v_user.id,
          'owner',
          'active',
          NOW(),
          NULL  -- Evita FK violation se utente non in auth.users
        WHERE NOT EXISTS (
          SELECT 1 FROM public.workspace_members
          WHERE workspace_id = v_workspace_id AND user_id = v_user.id
        );

        -- Aggiorna primary_workspace_id dell'utente
        UPDATE public.users
        SET primary_workspace_id = v_workspace_id
        WHERE id = v_user.id
          AND primary_workspace_id IS NULL;

        RAISE NOTICE 'Creato workspace % (%) per utente %', v_slug, v_workspace_id, v_user.email;
      END IF;
    END;
  END LOOP;

  -- ============================================
  -- STEP 3: Assegna workspace_id ai record esistenti
  -- ============================================

  -- Shipments: assegna workspace_id basato su user_id
  UPDATE public.shipments s
  SET workspace_id = u.primary_workspace_id
  FROM public.users u
  WHERE s.user_id = u.id
    AND s.workspace_id IS NULL
    AND u.primary_workspace_id IS NOT NULL;

  RAISE NOTICE 'Aggiornate spedizioni con workspace_id';

  -- Wallet transactions: assegna workspace_id basato su user_id
  UPDATE public.wallet_transactions wt
  SET workspace_id = u.primary_workspace_id
  FROM public.users u
  WHERE wt.user_id = u.id
    AND wt.workspace_id IS NULL
    AND u.primary_workspace_id IS NOT NULL;

  RAISE NOTICE 'Aggiornate wallet_transactions con workspace_id';

  -- Audit logs: assegna workspace_id basato su user_id
  UPDATE public.audit_logs al
  SET workspace_id = u.primary_workspace_id
  FROM public.users u
  WHERE al.user_id = u.id
    AND al.workspace_id IS NULL
    AND u.primary_workspace_id IS NOT NULL;

  RAISE NOTICE 'Aggiornate audit_logs con workspace_id';

  -- Price lists: per ora rimangono NULL (gestite manualmente dal superadmin)
  RAISE NOTICE 'Price lists rimangono con workspace_id NULL (gestione manuale)';

END;
$$;

-- ============================================
-- STEP 4: Report finale
-- ============================================
DO $$
DECLARE
  v_orgs_count INTEGER;
  v_workspaces_count INTEGER;
  v_members_count INTEGER;
  v_shipments_with_ws INTEGER;
  v_shipments_without_ws INTEGER;
  v_tx_with_ws INTEGER;
  v_tx_without_ws INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_orgs_count FROM public.organizations;
  SELECT COUNT(*) INTO v_workspaces_count FROM public.workspaces;
  SELECT COUNT(*) INTO v_members_count FROM public.workspace_members;
  SELECT COUNT(*) INTO v_shipments_with_ws FROM public.shipments WHERE workspace_id IS NOT NULL;
  SELECT COUNT(*) INTO v_shipments_without_ws FROM public.shipments WHERE workspace_id IS NULL;
  SELECT COUNT(*) INTO v_tx_with_ws FROM public.wallet_transactions WHERE workspace_id IS NOT NULL;
  SELECT COUNT(*) INTO v_tx_without_ws FROM public.wallet_transactions WHERE workspace_id IS NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'REPORT MIGRAZIONE WORKSPACE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Organizations: %', v_orgs_count;
  RAISE NOTICE 'Workspaces: %', v_workspaces_count;
  RAISE NOTICE 'Members: %', v_members_count;
  RAISE NOTICE 'Shipments con workspace: %', v_shipments_with_ws;
  RAISE NOTICE 'Shipments senza workspace: %', v_shipments_without_ws;
  RAISE NOTICE 'Transactions con workspace: %', v_tx_with_ws;
  RAISE NOTICE 'Transactions senza workspace: %', v_tx_without_ws;
  RAISE NOTICE '========================================';
END;
$$;

-- ============================================
-- FINE MIGRAZIONE dati esistenti
-- ============================================
