-- ============================================
-- FIX: Remove public read access to case patterns
-- Created: 2026-02-02
-- Reason: Audit finding P0 - patterns may contain
--         PII (names, addresses) in trigger_conditions
--         keywords. Public read = data leak risk.
--         Backend uses supabaseAdmin (service role)
--         so this policy was never needed.
-- ============================================

-- Drop the dangerous public read policy
DROP POLICY IF EXISTS "Anyone can read active patterns" ON support_case_patterns;

-- Replace with admin-only read
CREATE POLICY "Admins read patterns"
  ON support_case_patterns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin')
    )
  );
