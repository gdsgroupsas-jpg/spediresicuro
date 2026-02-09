-- ============================================================
-- Migration: Infrastruttura Email Workspace-Scoped
--
-- Aggiunge:
-- 1. workspace_id alla tabella emails (con backfill NULL per email esistenti)
-- 2. Tabella workspace_email_addresses (mapping indirizzo → workspace)
-- 3. Tabella workspace_announcements (bacheca broadcast)
-- 4. RLS policies per isolamento workspace rigoroso
-- 5. Funzione RPC per invio email workspace-scoped (atomica)
-- 6. Funzione RPC mark_announcement_read (atomica)
-- ============================================================

-- ============================================================
-- 1. AGGIUNGERE workspace_id ALLA TABELLA emails
-- ============================================================

ALTER TABLE emails ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

-- Indice per filtrare email per workspace (query principale)
CREATE INDEX IF NOT EXISTS idx_emails_workspace_id ON emails(workspace_id) WHERE workspace_id IS NOT NULL;

-- Indice composto per lista email workspace + folder (paginazione)
CREATE INDEX IF NOT EXISTS idx_emails_workspace_folder ON emails(workspace_id, folder, created_at DESC) WHERE workspace_id IS NOT NULL;

-- ============================================================
-- 2. TABELLA workspace_email_addresses
-- Mapping: un indirizzo email ↔ un workspace (1:1 rigoroso)
-- ============================================================

CREATE TABLE IF NOT EXISTS workspace_email_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  -- Resend domain management
  resend_domain_id TEXT,           -- ID dominio verificato in Resend
  domain_verified_at TIMESTAMPTZ,  -- Quando il dominio è stato verificato
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- CRITICO: Un indirizzo = un solo workspace. Nessun overlap possibile.
  CONSTRAINT uq_workspace_email_address UNIQUE (email_address)
);

-- Indice funzionale per lookup case-insensitive (FIX #3: indice su lower())
CREATE INDEX IF NOT EXISTS idx_workspace_email_addresses_email_lower ON workspace_email_addresses(lower(email_address));
-- Indice per lista indirizzi workspace
CREATE INDEX IF NOT EXISTS idx_workspace_email_addresses_workspace ON workspace_email_addresses(workspace_id);

-- FIX #6: Partial unique index per garantire max 1 primary per workspace (race-condition safe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_primary_email_per_workspace
  ON workspace_email_addresses(workspace_id) WHERE is_primary = true;

-- Trigger: forza email_address in lowercase all'INSERT/UPDATE (FIX #3)
CREATE OR REPLACE FUNCTION normalize_email_address_lowercase()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_address = lower(trim(NEW.email_address));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_normalize_email_address
  BEFORE INSERT OR UPDATE ON workspace_email_addresses
  FOR EACH ROW
  EXECUTE FUNCTION normalize_email_address_lowercase();

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_workspace_email_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workspace_email_addresses_updated_at
  BEFORE UPDATE ON workspace_email_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_email_addresses_updated_at();

-- Garantisci max 1 primary per workspace (trigger per unset precedenti)
CREATE OR REPLACE FUNCTION enforce_single_primary_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE workspace_email_addresses
    SET is_primary = false
    WHERE workspace_id = NEW.workspace_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_enforce_single_primary_email
  BEFORE INSERT OR UPDATE ON workspace_email_addresses
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION enforce_single_primary_email();

-- ============================================================
-- 3. TABELLA workspace_announcements (bacheca broadcast)
-- ============================================================

CREATE TABLE IF NOT EXISTS workspace_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,  -- Versione testo per email/accessibilità
  -- Target: chi vede l'annuncio
  target TEXT NOT NULL CHECK (target IN ('all', 'team', 'clients')),
  -- Priorità visiva
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  pinned BOOLEAN NOT NULL DEFAULT false,
  -- Canali di distribuzione
  channels TEXT[] NOT NULL DEFAULT ARRAY['in_app'],  -- in_app, email
  -- Tracking lettura (array UUID per performance con pochi utenti per workspace)
  read_by UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indici per query principali
CREATE INDEX IF NOT EXISTS idx_workspace_announcements_workspace ON workspace_announcements(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_announcements_target ON workspace_announcements(workspace_id, target);
CREATE INDEX IF NOT EXISTS idx_workspace_announcements_pinned ON workspace_announcements(workspace_id, pinned) WHERE pinned = true;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_workspace_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workspace_announcements_updated_at
  BEFORE UPDATE ON workspace_announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_announcements_updated_at();

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- ─── 4.1 workspace_email_addresses ───

ALTER TABLE workspace_email_addresses ENABLE ROW LEVEL SECURITY;

-- Superadmin: accesso completo
CREATE POLICY "superadmin_full_access_workspace_email_addresses"
  ON workspace_email_addresses FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.account_type = 'superadmin'
    )
  );

-- Owner/admin workspace: gestione indirizzi del proprio workspace
CREATE POLICY "workspace_admins_manage_email_addresses"
  ON workspace_email_addresses FOR ALL TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Membri workspace: solo lettura (per selezionare FROM in composizione)
CREATE POLICY "workspace_members_read_email_addresses"
  ON workspace_email_addresses FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- ─── 4.2 Policy emails per workspace (FIX #4: separate per operazione) ───

-- SELECT: tutti i membri attivi del workspace
CREATE POLICY "workspace_members_read_own_emails"
  ON emails FOR SELECT TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- INSERT/UPDATE/DELETE: solo owner, admin, operator
CREATE POLICY "workspace_operators_manage_emails"
  ON emails FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin', 'operator')
    )
  );

CREATE POLICY "workspace_operators_update_emails"
  ON emails FOR UPDATE TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin', 'operator')
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin', 'operator')
    )
  );

CREATE POLICY "workspace_operators_delete_emails"
  ON emails FOR DELETE TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin', 'operator')
    )
  );

-- NOTA: La policy "superadmin_full_access_on_emails" esistente resta invariata.
-- Email senza workspace_id (legacy) restano visibili solo al superadmin.

-- ─── 4.3 workspace_announcements ───

ALTER TABLE workspace_announcements ENABLE ROW LEVEL SECURITY;

-- Superadmin: accesso completo
CREATE POLICY "superadmin_full_access_workspace_announcements"
  ON workspace_announcements FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.account_type = 'superadmin'
    )
  );

-- Owner/admin: creazione e gestione annunci del proprio workspace
CREATE POLICY "workspace_admins_manage_announcements"
  ON workspace_announcements FOR ALL TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Tutti i membri del workspace: lettura annunci
CREATE POLICY "workspace_members_read_announcements"
  ON workspace_announcements FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- Clienti del reseller: vedono annunci target 'all' o 'clients' del parent workspace
CREATE POLICY "child_workspace_members_read_parent_announcements"
  ON workspace_announcements FOR SELECT TO authenticated
  USING (
    target IN ('all', 'clients')
    AND workspace_id IN (
      SELECT w.parent_workspace_id
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND w.parent_workspace_id IS NOT NULL
    )
  );

-- ============================================================
-- 5. FUNZIONE RPC: Invio email workspace-scoped (atomica)
-- FIX #1: Aggiunto check auth.uid() membership
-- FIX #11: Aggiunto check is_verified sull'indirizzo
-- ============================================================

CREATE OR REPLACE FUNCTION send_workspace_email(
  p_workspace_id UUID,
  p_from_address_id UUID,
  p_to_addresses TEXT[],
  p_cc TEXT[] DEFAULT '{}',
  p_bcc TEXT[] DEFAULT '{}',
  p_subject TEXT DEFAULT '(nessun oggetto)',
  p_body_html TEXT DEFAULT NULL,
  p_body_text TEXT DEFAULT NULL,
  p_reply_to_email_id UUID DEFAULT NULL,
  p_is_draft BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_address TEXT;
  v_display_name TEXT;
  v_email_id UUID;
  v_folder TEXT;
  v_status TEXT;
BEGIN
  -- FIX #1: Verifica che il chiamante sia membro attivo del workspace
  -- con ruolo sufficiente per inviare email
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role IN ('owner', 'admin', 'operator')
  ) THEN
    -- Permetti anche al service_role (supabaseAdmin) di chiamare
    -- auth.uid() è NULL per service_role, quindi controlliamo separatamente
    IF auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Utente non autorizzato per questo workspace';
    END IF;
  END IF;

  -- 1. Verifica che l'indirizzo FROM appartenga al workspace E sia verificato (FIX #11)
  SELECT email_address, display_name
  INTO v_from_address, v_display_name
  FROM workspace_email_addresses
  WHERE id = p_from_address_id
    AND workspace_id = p_workspace_id
    AND is_verified = true;

  IF v_from_address IS NULL THEN
    RAISE EXCEPTION 'SENDER_NOT_OWNED: L''indirizzo mittente non appartiene a questo workspace o non è verificato';
  END IF;

  -- 2. Verifica che il reply_to_email_id appartenga al workspace (se fornito)
  IF p_reply_to_email_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM emails
      WHERE id = p_reply_to_email_id
        AND workspace_id = p_workspace_id
    ) THEN
      RAISE EXCEPTION 'REPLY_NOT_OWNED: L''email di risposta non appartiene a questo workspace';
    END IF;
  END IF;

  -- 3. Determina folder e status
  IF p_is_draft THEN
    v_folder := 'drafts';
    v_status := 'draft';
  ELSE
    v_folder := 'sent';
    v_status := 'sent';
  END IF;

  -- 4. Inserisci record email
  INSERT INTO emails (
    workspace_id,
    direction,
    from_address,
    to_address,
    cc,
    bcc,
    subject,
    body_html,
    body_text,
    reply_to_message_id,
    status,
    read,
    starred,
    folder
  ) VALUES (
    p_workspace_id,
    'outbound',
    v_display_name || ' <' || v_from_address || '>',
    p_to_addresses,
    p_cc,
    p_bcc,
    p_subject,
    p_body_html,
    p_body_text,
    p_reply_to_email_id,
    v_status,
    true,  -- outbound = automaticamente letta
    false,
    v_folder
  )
  RETURNING id INTO v_email_id;

  RETURN v_email_id;
END;
$$;

-- ============================================================
-- 6. FUNZIONE HELPER: Lookup workspace da indirizzo email inbound
-- Usata dal webhook per routing automatico
-- ============================================================

CREATE OR REPLACE FUNCTION lookup_workspace_by_email(p_email_address TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_clean_email TEXT;
BEGIN
  -- Estrai email pura se formato "Name <email@domain.com>"
  IF p_email_address LIKE '%<%>%' THEN
    v_clean_email := lower(trim(split_part(split_part(p_email_address, '<', 2), '>', 1)));
  ELSE
    v_clean_email := lower(trim(p_email_address));
  END IF;

  -- Usa indice funzionale idx_workspace_email_addresses_email_lower
  SELECT workspace_id INTO v_workspace_id
  FROM workspace_email_addresses
  WHERE lower(email_address) = v_clean_email
  LIMIT 1;

  -- NULL se nessun workspace mappato (email va al superadmin, legacy)
  RETURN v_workspace_id;
END;
$$;

-- ============================================================
-- 7. FUNZIONE RPC: Mark announcement as read (FIX #5: atomica)
-- Permette a qualsiasi membro di marcare come letto senza
-- poter sovrascrivere l'intero array read_by
-- ============================================================

CREATE OR REPLACE FUNCTION mark_announcement_read(p_announcement_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws_id UUID;
BEGIN
  -- Trova il workspace dell'annuncio
  SELECT workspace_id INTO v_ws_id
  FROM workspace_announcements
  WHERE id = p_announcement_id;

  IF v_ws_id IS NULL THEN
    RETURN false;
  END IF;

  -- Verifica che il chiamante sia membro del workspace
  -- (o di un child workspace per annunci 'all'/'clients')
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE user_id = auth.uid()
      AND status = 'active'
      AND (
        workspace_id = v_ws_id
        OR workspace_id IN (
          SELECT w.id FROM workspaces w
          WHERE w.parent_workspace_id = v_ws_id
        )
      )
  ) THEN
    RETURN false;
  END IF;

  -- Atomic append (idempotente: non duplica se già presente)
  UPDATE workspace_announcements
  SET read_by = array_append(read_by, auth.uid())
  WHERE id = p_announcement_id
    AND NOT (auth.uid() = ANY(read_by));

  RETURN true;
END;
$$;

-- ============================================================
-- 8. GRANT e REVOKE per sicurezza (FIX #2)
-- ============================================================

-- send_workspace_email: solo service_role e authenticated (con check interno)
GRANT EXECUTE ON FUNCTION send_workspace_email TO service_role;
GRANT EXECUTE ON FUNCTION send_workspace_email TO authenticated;

-- lookup_workspace_by_email: SOLO service_role (webhook usa supabaseAdmin)
-- FIX #2: Revoca accesso a public/authenticated per evitare enumeration
GRANT EXECUTE ON FUNCTION lookup_workspace_by_email TO service_role;
REVOKE EXECUTE ON FUNCTION lookup_workspace_by_email FROM public;
REVOKE EXECUTE ON FUNCTION lookup_workspace_by_email FROM anon;

-- mark_announcement_read: solo authenticated
GRANT EXECUTE ON FUNCTION mark_announcement_read TO authenticated;
