-- =====================================================
-- API Key Authentication System
-- =====================================================
-- Version: 1.0.1 (Fixed IMMUTABLE function error)
-- Date: 2026-01-21
-- Purpose: Enable API key authentication for external integrations
--
-- Security Notes:
-- - API keys are hashed (never stored in plaintext)
-- - Row Level Security (RLS) enabled
-- - Users can only access their own keys
-- - Audit logging for all API key usage
-- =====================================================

-- =====================================================
-- TABLE: api_keys
-- =====================================================
-- Stores API keys for external server integrations
-- Keys are hashed using SHA-256 + salt (from environment)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key to user (using public.users table)
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Security Fields
  key_prefix TEXT NOT NULL UNIQUE,
    -- First 16 chars of key (e.g., "sk_live_abc12345")
    -- Used for fast lookup without exposing full key
    -- Format: sk_live_XXXXXXXX
  key_hash TEXT NOT NULL,
    -- SHA-256 hash of (full_key + salt)
    -- Salt stored in environment variable (API_KEY_SALT)
    -- Never store plaintext keys

  -- Metadata
  name TEXT NOT NULL,
    -- User-friendly name (e.g., "Production Server", "Staging Integration")
    -- Helps users identify which key is which
  description TEXT,
    -- Optional detailed description

  -- Permissions (Scopes)
  scopes TEXT[] NOT NULL DEFAULT ARRAY['quotes:read'],
    -- Array of permission scopes
    -- Examples:
    --   - quotes:read
    --   - quotes:create
    --   - shipments:read
    --   - shipments:create
    --   - shipments:update
    --   - wallet:read
    --   - * (admin - full access)

  -- Rate Limiting
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 1000,
    -- Maximum requests per hour for this key
    -- Can be customized per key
    -- Default from environment: API_KEY_DEFAULT_RATE_LIMIT

  -- Lifecycle Management
  last_used_at TIMESTAMP WITH TIME ZONE,
    -- Updated on each successful API call
    -- Used for identifying stale keys
  expires_at TIMESTAMP WITH TIME ZONE,
    -- Auto-expire date (NULL = never expires)
    -- Default: NOW() + API_KEY_DEFAULT_EXPIRY_DAYS
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,
    -- Soft delete - set when user revokes key
    -- Keeps audit trail

  -- Audit Fields
  created_by_ip INET,
    -- IP address when key was created
    -- For security audit trail

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

-- =====================================================
-- INDEXES: api_keys
-- =====================================================

-- Fast lookup by key prefix (used on every API request)
CREATE INDEX idx_api_keys_key_prefix
  ON public.api_keys(key_prefix)
  WHERE revoked_at IS NULL;

-- Fast lookup by user_id (list user's keys)
CREATE INDEX idx_api_keys_user_id
  ON public.api_keys(user_id)
  WHERE revoked_at IS NULL;

-- Find active keys only (most common query)
CREATE INDEX idx_api_keys_active
  ON public.api_keys(user_id, expires_at)
  WHERE revoked_at IS NULL;

-- Find stale keys by last_used_at (without NOW() in predicate)
CREATE INDEX idx_api_keys_last_used
  ON public.api_keys(last_used_at)
  WHERE revoked_at IS NULL;

-- =====================================================
-- ROW LEVEL SECURITY: api_keys
-- =====================================================

-- Enable RLS (security requirement)
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own API keys
CREATE POLICY "api_keys_select_own"
  ON public.api_keys
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own API keys
CREATE POLICY "api_keys_insert_own"
  ON public.api_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own API keys (e.g., revoke)
CREATE POLICY "api_keys_update_own"
  ON public.api_keys
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users cannot hard-delete keys (audit trail)
-- No DELETE policy = delete blocked for all users

-- =====================================================
-- TABLE: api_audit_log
-- =====================================================
-- Audit trail for all API key usage
-- Used for security monitoring, rate limiting, debugging
-- =====================================================

CREATE TABLE IF NOT EXISTS public.api_audit_log (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key to API key (nullable - key might be deleted)
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,

  -- Request Details
  endpoint TEXT NOT NULL,
    -- Full path (e.g., /api/quotes/realtime)
  method TEXT NOT NULL,
    -- HTTP method (GET, POST, PUT, DELETE)
  status_code INTEGER,
    -- HTTP response code (200, 401, 500, etc.)

  -- Network Information
  ip_address INET,
    -- Client IP address
  user_agent TEXT,
    -- Client User-Agent header

  -- Performance Metrics
  response_time_ms INTEGER,
    -- Time to process request (milliseconds)

  -- Error Details (if any)
  error_message TEXT,
    -- Error message if request failed

  -- Timestamp
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES: api_audit_log
-- =====================================================

-- Fast lookup by API key (view key's usage history)
CREATE INDEX idx_audit_log_api_key_id
  ON public.api_audit_log(api_key_id, timestamp DESC);

-- Fast time-based queries (last 24h, last 7d, etc.)
CREATE INDEX idx_audit_log_timestamp
  ON public.api_audit_log(timestamp DESC);

-- Rate limiting query - simple index on timestamp
CREATE INDEX idx_audit_log_api_key_timestamp
  ON public.api_audit_log(api_key_id, timestamp DESC);

-- Error monitoring (find failing keys)
CREATE INDEX idx_audit_log_errors
  ON public.api_audit_log(api_key_id, status_code)
  WHERE status_code >= 400;

-- =====================================================
-- ROW LEVEL SECURITY: api_audit_log
-- =====================================================

-- Enable RLS
ALTER TABLE public.api_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view audit logs for their own API keys
CREATE POLICY "api_audit_log_select_own"
  ON public.api_audit_log
  FOR SELECT
  USING (
    api_key_id IN (
      SELECT id FROM public.api_keys WHERE user_id = auth.uid()
    )
  );

-- Policy: Only system can insert audit logs (not users)
-- No INSERT policy for users
-- App uses service role key to insert

-- Policy: No updates or deletes (immutable audit trail)
-- No UPDATE or DELETE policies

-- =====================================================
-- FUNCTIONS: Utility functions
-- =====================================================

-- Function: Clean up old audit logs (>90 days)
-- Run this periodically via cron job
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete audit logs older than 90 days
  DELETE FROM public.api_audit_log
  WHERE timestamp < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_audit_logs() IS
  'Delete audit logs older than 90 days. Run via cron job.';

-- Function: Get API key usage stats
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

COMMENT ON FUNCTION public.get_api_key_stats(UUID) IS
  'Get usage statistics for an API key';

-- Function: Find stale API keys (unused for >90 days)
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

COMMENT ON FUNCTION public.find_stale_api_keys() IS
  'Find API keys unused for more than 90 days';

-- =====================================================
-- COMMENTS: Documentation
-- =====================================================

COMMENT ON TABLE public.api_keys IS
  'API key authentication for external server integrations. Keys are hashed with SHA-256 + salt.';

COMMENT ON TABLE public.api_audit_log IS
  'Audit trail for all API key usage. Used for security monitoring and rate limiting.';

COMMENT ON COLUMN public.api_keys.key_prefix IS
  'First 16 characters of API key (sk_live_XXXXXXXX). Used for fast lookup.';

COMMENT ON COLUMN public.api_keys.key_hash IS
  'SHA-256 hash of (full_key + API_KEY_SALT). Never store plaintext keys.';

COMMENT ON COLUMN public.api_keys.scopes IS
  'Permission scopes (e.g., quotes:read, shipments:create, *). Controls API access.';

COMMENT ON COLUMN public.api_keys.rate_limit_per_hour IS
  'Maximum requests per hour. Default from API_KEY_DEFAULT_RATE_LIMIT environment variable.';

-- =====================================================
-- GRANTS: Permissions
-- =====================================================

-- Grant usage to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.api_keys TO authenticated;
GRANT SELECT ON public.api_audit_log TO authenticated;

-- Grant all to service role (for audit logging)
GRANT ALL ON public.api_keys TO service_role;
GRANT ALL ON public.api_audit_log TO service_role;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify tables created
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'api_keys') THEN
    RAISE EXCEPTION 'Table api_keys was not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'api_audit_log') THEN
    RAISE EXCEPTION 'Table api_audit_log was not created';
  END IF;

  RAISE NOTICE 'Migration completed successfully';
END $$;
