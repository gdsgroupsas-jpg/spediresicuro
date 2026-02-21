-- =====================================================
-- Fix API Keys Foreign Key Constraint
-- =====================================================
-- Version: 1.0.0
-- Date: 2026-01-21
-- Purpose: Change foreign key from auth.users to public.users
--
-- This fixes the error:
-- "violates foreign key constraint api_keys_user_id_fkey"
-- =====================================================

-- Drop existing table (if exists)
DROP TABLE IF EXISTS public.api_keys CASCADE;
DROP TABLE IF EXISTS public.api_audit_log CASCADE;

-- Recreate api_keys table with correct foreign key
CREATE TABLE IF NOT EXISTS public.api_keys (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key to user (using public.users table)
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Security Fields
  key_prefix TEXT NOT NULL UNIQUE,
  key_hash TEXT NOT NULL,

  -- Metadata
  name TEXT NOT NULL,
  description TEXT,

  -- Permissions (Scopes)
  scopes TEXT[] NOT NULL DEFAULT ARRAY['quotes:read'],

  -- Rate Limiting
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 1000,

  -- Lifecycle Management
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,

  -- Audit Fields
  created_by_ip INET,

  -- Constraints
  CONSTRAINT valid_key_prefix CHECK (
    key_prefix ~ '^sk_live_[a-z0-9]{8}$'
  ),
  CONSTRAINT valid_expiry CHECK (
    expires_at IS NULL OR expires_at > created_at
  ),
  CONSTRAINT valid_rate_limit CHECK (
    rate_limit_per_hour > 0 AND rate_limit_per_hour <= 100000
  )
);

-- Indexes
CREATE INDEX idx_api_keys_key_prefix ON public.api_keys(key_prefix) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_active ON public.api_keys(user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_last_used ON public.api_keys(last_used_at) WHERE revoked_at IS NULL;

-- RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_select_own" ON public.api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "api_keys_insert_own" ON public.api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "api_keys_update_own" ON public.api_keys FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Recreate api_audit_log table
CREATE TABLE IF NOT EXISTS public.api_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  ip_address INET,
  user_agent TEXT,
  response_time_ms INTEGER,
  error_message TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_log_api_key_id ON public.api_audit_log(api_key_id, timestamp DESC);
CREATE INDEX idx_audit_log_timestamp ON public.api_audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_api_key_timestamp ON public.api_audit_log(api_key_id, timestamp DESC);
CREATE INDEX idx_audit_log_errors ON public.api_audit_log(api_key_id, status_code) WHERE status_code >= 400;

-- RLS
ALTER TABLE public.api_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_audit_log_select_own" ON public.api_audit_log FOR SELECT
  USING (
    api_key_id IN (
      SELECT id FROM public.api_keys WHERE user_id = auth.uid()
    )
  );

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.api_keys TO authenticated;
GRANT SELECT ON public.api_audit_log TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
GRANT ALL ON public.api_audit_log TO service_role;

-- Functions
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.api_audit_log
  WHERE timestamp < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_api_key_stats(key_id UUID)
RETURNS TABLE (
  total_requests BIGINT,
  requests_last_24h BIGINT,
  requests_last_7d BIGINT,
  avg_response_time_ms NUMERIC,
  error_rate NUMERIC,
  last_used TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_requests,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours')::BIGINT AS requests_last_24h,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '7 days')::BIGINT AS requests_last_7d,
    AVG(response_time_ms) AS avg_response_time_ms,
    (COUNT(*) FILTER (WHERE status_code >= 400)::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS error_rate,
    MAX(timestamp) AS last_used
  FROM public.api_audit_log
  WHERE api_key_id = key_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_stale_api_keys()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  last_used_at TIMESTAMP WITH TIME ZONE,
  days_since_use INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.user_id,
    k.name,
    k.last_used_at,
    EXTRACT(DAY FROM NOW() - k.last_used_at)::INTEGER AS days_since_use
  FROM public.api_keys k
  WHERE
    k.revoked_at IS NULL
    AND (
      k.last_used_at IS NULL AND k.created_at < NOW() - INTERVAL '90 days'
      OR
      k.last_used_at < NOW() - INTERVAL '90 days'
    )
  ORDER BY k.last_used_at ASC NULLS FIRST;
END;
$$;

-- Comments
COMMENT ON TABLE public.api_keys IS 'API key authentication for external server integrations. Keys are hashed with SHA-256 + salt.';
COMMENT ON TABLE public.api_audit_log IS 'Audit trail for all API key usage. Used for security monitoring and rate limiting.';

-- Verify
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'api_keys') THEN
    RAISE EXCEPTION 'Table api_keys was not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'api_audit_log') THEN
    RAISE EXCEPTION 'Table api_audit_log was not created';
  END IF;

  RAISE NOTICE 'Migration fix completed successfully';
END $$;
