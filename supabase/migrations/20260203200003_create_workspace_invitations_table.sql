-- ============================================
-- MIGRAZIONE: Creazione tabella workspace_invitations
-- ============================================
-- Parte del refactoring Architecture V2
-- workspace_invitations = Sistema inviti per aggiungere membri ai workspace
--
-- Flusso:
-- 1. Admin/Owner invita email
-- 2. Sistema crea invitation con token univoco
-- 3. Utente riceve email con link
-- 4. Utente clicca link, accetta invito
-- 5. Sistema crea workspace_member
-- ============================================

-- Abilita estensione pgcrypto per gen_random_bytes (se non gia presente)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Crea tabella workspace_invitations
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Invitation details
  email TEXT NOT NULL, -- Email dell'invitato
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')), -- Owner non invitabile, solo alla creazione
  permissions TEXT[] DEFAULT '{}', -- Permessi granulari da assegnare

  -- Token sicuro per accettazione
  -- Usiamo md5 + random + timestamp per generare token univoco
  token TEXT UNIQUE NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text),

  -- Messaggio opzionale dall'invitante
  message TEXT,

  -- Status
  -- pending: in attesa di accettazione
  -- accepted: accettato, member creato
  -- expired: scaduto (7 giorni default)
  -- revoked: revocato manualmente
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),

  -- Timestamps
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES auth.users(id),

  -- Accettazione
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) -- L'utente che ha accettato (potrebbe essere diverso dall'email se gia registrato)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wi_workspace ON public.workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wi_email ON public.workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_wi_token ON public.workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_wi_status ON public.workspace_invitations(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_wi_expires ON public.workspace_invitations(expires_at) WHERE status = 'pending';

-- Constraint: non piu di 1 invito pending per email+workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_wi_unique_pending
ON public.workspace_invitations(workspace_id, email)
WHERE status = 'pending';

-- Funzione per accettare invito
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(
  p_token TEXT,
  p_user_id UUID DEFAULT NULL -- Se NULL, usa auth.uid()
)
RETURNS UUID AS $$ -- Ritorna workspace_member.id
DECLARE
  v_invitation RECORD;
  v_user_id UUID;
  v_member_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID required to accept invitation';
  END IF;

  -- Trova e locka l'invito
  SELECT * INTO v_invitation
  FROM public.workspace_invitations
  WHERE token = p_token
  FOR UPDATE;

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation token';
  END IF;

  IF v_invitation.status != 'pending' THEN
    RAISE EXCEPTION 'Invitation is not pending (status: %)', v_invitation.status;
  END IF;

  IF v_invitation.expires_at < NOW() THEN
    -- Marca come scaduto
    UPDATE public.workspace_invitations
    SET status = 'expired'
    WHERE id = v_invitation.id;

    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  -- Verifica che l'utente non sia gia membro
  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_invitation.workspace_id
      AND user_id = v_user_id
      AND status IN ('active', 'pending')
  ) THEN
    RAISE EXCEPTION 'User is already a member of this workspace';
  END IF;

  -- Crea membership
  INSERT INTO public.workspace_members (
    workspace_id,
    user_id,
    role,
    permissions,
    invited_by,
    accepted_at,
    status
  ) VALUES (
    v_invitation.workspace_id,
    v_user_id,
    v_invitation.role,
    v_invitation.permissions,
    v_invitation.invited_by,
    NOW(),
    'active'
  )
  RETURNING id INTO v_member_id;

  -- Aggiorna invito
  UPDATE public.workspace_invitations
  SET status = 'accepted',
      accepted_at = NOW(),
      accepted_by = v_user_id
  WHERE id = v_invitation.id;

  RETURN v_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per revocare invito
CREATE OR REPLACE FUNCTION public.revoke_workspace_invitation(
  p_invitation_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.workspace_invitations
  SET status = 'revoked'
  WHERE id = p_invitation_id
    AND status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Job per marcare inviti scaduti (da eseguire periodicamente)
CREATE OR REPLACE FUNCTION public.expire_old_invitations()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.workspace_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commenti
COMMENT ON TABLE public.workspace_invitations IS 'Inviti per aggiungere membri ai workspace. Token sicuro, scadenza 7 giorni.';
COMMENT ON COLUMN public.workspace_invitations.token IS 'Token sicuro 64 caratteri hex per accettazione invito';
COMMENT ON COLUMN public.workspace_invitations.role IS 'Ruolo da assegnare: admin/operator/viewer (owner non invitabile)';
COMMENT ON FUNCTION public.accept_workspace_invitation IS 'Accetta invito e crea workspace_member. Ritorna member_id.';
COMMENT ON FUNCTION public.expire_old_invitations IS 'Job per marcare inviti scaduti. Da eseguire periodicamente.';

-- ============================================
-- FINE MIGRAZIONE workspace_invitations
-- ============================================
