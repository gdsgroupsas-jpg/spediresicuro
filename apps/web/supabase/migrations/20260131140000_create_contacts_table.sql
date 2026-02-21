-- ============================================================
-- Migration: Create contacts table for Rubrica (Address Book)
-- Superadmin-only contact management
-- Security: RLS + input validation via CHECK constraints
-- ============================================================

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 100),
  last_name TEXT NOT NULL CHECK (char_length(last_name) BETWEEN 1 AND 100),
  email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  phone TEXT CHECK (phone IS NULL OR phone ~* '^\+?[0-9\s\-()]{6,20}$'),
  company TEXT CHECK (company IS NULL OR char_length(company) <= 200),
  tags TEXT[] DEFAULT '{}',
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Unique constraint: no duplicate emails
CREATE UNIQUE INDEX idx_contacts_email_unique ON contacts(LOWER(email));

-- Performance indexes
CREATE INDEX idx_contacts_created_by ON contacts(created_by);
CREATE INDEX idx_contacts_last_name ON contacts(last_name);
CREATE INDEX idx_contacts_company ON contacts(company) WHERE company IS NOT NULL;
CREATE INDEX idx_contacts_created_at ON contacts(created_at DESC);

-- Full-text search index for fast autocomplete
CREATE INDEX idx_contacts_search ON contacts USING GIN (
  to_tsvector('simple', coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(company, ''))
);

-- Tags GIN index for filtering
CREATE INDEX idx_contacts_tags ON contacts USING GIN (tags);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

-- RLS: Only superadmin has access
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_full_access_on_contacts"
  ON contacts FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.account_type = 'superadmin'
    )
  );
