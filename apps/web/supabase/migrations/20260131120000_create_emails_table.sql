-- ============================================================
-- Migration: Create emails table for Posta (Email Inbox)
-- Superadmin-only email management with Resend integration
-- ============================================================

CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT, -- Resend message ID
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_address TEXT NOT NULL,
  to_address TEXT[] NOT NULL DEFAULT '{}',
  cc TEXT[] DEFAULT '{}',
  bcc TEXT[] DEFAULT '{}',
  subject TEXT NOT NULL DEFAULT '(nessun oggetto)',
  body_html TEXT,
  body_text TEXT,
  reply_to_message_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'sent', 'draft', 'failed')),
  read BOOLEAN NOT NULL DEFAULT false,
  starred BOOLEAN NOT NULL DEFAULT false,
  folder TEXT NOT NULL DEFAULT 'inbox' CHECK (folder IN ('inbox', 'sent', 'drafts', 'trash')),
  raw_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_emails_folder ON emails(folder);
CREATE INDEX idx_emails_direction ON emails(direction);
CREATE INDEX idx_emails_created_at ON emails(created_at DESC);
CREATE INDEX idx_emails_read ON emails(read) WHERE read = false;
CREATE INDEX idx_emails_message_id ON emails(message_id) WHERE message_id IS NOT NULL;

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_emails_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_emails_updated_at
  BEFORE UPDATE ON emails
  FOR EACH ROW
  EXECUTE FUNCTION update_emails_updated_at();

-- RLS: Only superadmin
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_full_access_on_emails"
  ON emails FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.account_type = 'superadmin'
    )
  );
