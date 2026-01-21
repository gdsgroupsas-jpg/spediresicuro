-- =====================================================
-- API Key Authentication System - ROLLBACK
-- =====================================================
-- Version: 1.0.0
-- Date: 2026-01-21
-- Purpose: Rollback API key authentication feature
--
-- Usage:
--   Run this migration to completely remove API key auth
--   WARNING: This will delete ALL API keys and audit logs
--
-- Safety:
--   - Does NOT affect existing authentication (cookie-based)
--   - Does NOT affect any other tables
--   - Safe to run even if tables don't exist (IF EXISTS)
-- =====================================================

-- =====================================================
-- Drop Functions (Order matters - dependencies first)
-- =====================================================

DROP FUNCTION IF EXISTS public.get_api_key_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.find_stale_api_keys() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_audit_logs() CASCADE;

-- =====================================================
-- Drop Tables (Order matters - foreign keys first)
-- =====================================================

-- Drop audit log first (has foreign key to api_keys)
DROP TABLE IF EXISTS public.api_audit_log CASCADE;

-- Drop api_keys table
DROP TABLE IF EXISTS public.api_keys CASCADE;

-- =====================================================
-- Verification
-- =====================================================

DO $$
BEGIN
  -- Verify tables are gone
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'api_keys') THEN
    RAISE EXCEPTION 'Table api_keys still exists after rollback';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'api_audit_log') THEN
    RAISE EXCEPTION 'Table api_audit_log still exists after rollback';
  END IF;

  RAISE NOTICE 'API Key Authentication rollback completed successfully';
  RAISE NOTICE 'All API keys and audit logs have been removed';
END $$;
