-- ============================================
-- MIGRATION: 20260120090000_anne_user_memory
-- DESCRIZIONE: Memoria persistente per Anne (preferenze utente)
-- DATA: 2026-01-20
-- CRITICITA: P2 - User personalization
-- ============================================

CREATE TABLE IF NOT EXISTS anne_user_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_sender JSONB NOT NULL DEFAULT '{}'::jsonb,
  preferred_couriers TEXT[] NOT NULL DEFAULT '{}'::text[],
  communication_style JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_anne_user_memory_user_id
  ON anne_user_memory(user_id);

CREATE OR REPLACE FUNCTION update_anne_user_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_anne_user_memory_updated_at
  BEFORE UPDATE ON anne_user_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_anne_user_memory_updated_at();

ALTER TABLE anne_user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User read own Anne memory"
  ON anne_user_memory
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "User write own Anne memory"
  ON anne_user_memory
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "User update own Anne memory"
  ON anne_user_memory
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "SuperAdmin full access on anne_user_memory"
  ON anne_user_memory FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.account_type = 'superadmin'
    )
  );

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20260120090000_anne_user_memory completata';
END $$;
