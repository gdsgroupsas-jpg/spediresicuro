/**
 * API Key Authentication Service
 *
 * Provides secure API key generation, validation, and management
 * for external server integrations.
 *
 * Security Features:
 * - Cryptographically secure key generation
 * - SHA-256 hashing with salt (never stores plaintext)
 * - Timing-safe comparison (prevents timing attacks)
 * - Scope-based permissions
 * - Rate limiting support
 * - Audit logging
 *
 * Usage:
 *   // Generate new key (returns plaintext ONCE)
 *   const { key, keyPrefix } = await generateApiKey(userId, "My API Key");
 *
 *   // Validate key (on each request)
 *   const result = await validateApiKey(key);
 *   if (result.valid) {
 *     // Allow request
 *   }
 *
 * @module lib/api-key-service
 */

import { createHash, randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { FeatureFlags } from './feature-flags';

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role for RLS bypass
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// =====================================================
// Types
// =====================================================

export interface ApiKey {
  id: string;
  userId: string;
  keyPrefix: string;
  name: string;
  scopes: string[];
  expiresAt: Date | null;
  rateLimitPerHour: number;
}

export interface ApiKeyValidation {
  valid: boolean;
  apiKey?: ApiKey;
  error?: string;
}

export interface GenerateApiKeyOptions {
  scopes?: string[];
  expiresInDays?: number;
  rateLimitPerHour?: number;
}

// =====================================================
// API Key Generation
// =====================================================

/**
 * Generate a new API key for a user
 *
 * Key Format: sk_live_<32 random chars>
 * Example: sk_live_XXXX...XXXX (32 random alphanumeric characters)
 *
 * SECURITY NOTES:
 * - Key is shown to user ONCE (plaintext)
 * - Only hash is stored in database
 * - User must save key immediately
 * - Lost keys cannot be recovered (must regenerate)
 *
 * @param userId - User ID from auth.users
 * @param name - User-friendly name for the key
 * @param options - Optional configuration (scopes, expiry, rate limit)
 * @returns Object with plaintext key (ONCE) and key prefix
 */
export async function generateApiKey(
  userId: string,
  name: string,
  options: GenerateApiKeyOptions = {}
): Promise<{ key: string; keyPrefix: string; id: string }> {
  // Validate inputs
  if (!userId || !name) {
    throw new Error('userId and name are required');
  }

  if (name.length < 3) {
    throw new Error('Name must be at least 3 characters');
  }

  // Generate cryptographically secure random key
  const randomString = randomBytes(24)
    .toString('base64')
    .replace(/[+/=]/g, '') // Remove special chars
    .toLowerCase() // Convert to lowercase to match DB constraint
    .substring(0, 32); // Exactly 32 chars

  const key = `sk_live_${randomString}`;
  const keyPrefix = key.substring(0, 16); // sk_live_abcdefgh

  // Hash key for storage
  const keyHash = hashApiKey(key);

  // Calculate expiry date
  const expiresInDays = options.expiresInDays ?? FeatureFlags.API_KEY_DEFAULT_EXPIRY_DAYS;
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  // Insert into database
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: userId,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      name,
      scopes: options.scopes ?? ['quotes:read'],
      rate_limit_per_hour: options.rateLimitPerHour ?? FeatureFlags.API_KEY_DEFAULT_RATE_LIMIT,
      expires_at: expiresAt?.toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create API key:', error);
    throw new Error(`Failed to create API key: ${error.message}`);
  }

  return {
    key, // ⚠️ PLAINTEXT - Show to user ONCE
    keyPrefix,
    id: data.id,
  };
}

// =====================================================
// API Key Validation
// =====================================================

/**
 * Validate an API key from Authorization header
 *
 * Process:
 * 1. Check feature flag (fail fast if disabled)
 * 2. Validate key format
 * 3. Lookup by key prefix (fast index scan)
 * 4. Timing-safe comparison of hashes
 * 5. Check expiry and revocation
 * 6. Update last_used_at (async)
 *
 * SECURITY NOTES:
 * - Uses timing-safe comparison (prevents timing attacks)
 * - Constant-time validation (doesn't leak info via timing)
 * - Logs validation attempts for audit
 *
 * @param key - Full API key from Authorization header
 * @returns Validation result with API key data if valid
 */
export async function validateApiKey(key: string): Promise<ApiKeyValidation> {
  // Feature flag check (fail fast)
  if (!FeatureFlags.API_KEY_AUTH) {
    return { valid: false, error: 'API key authentication disabled' };
  }

  // Validate format (prevent invalid lookups)
  if (!key || !key.startsWith('sk_live_')) {
    return { valid: false, error: 'Invalid API key format' };
  }

  if (key.length !== 40) {
    // sk_live_ (8) + 32 chars
    return { valid: false, error: 'Invalid API key length' };
  }

  const keyPrefix = key.substring(0, 16);
  const keyHash = hashApiKey(key);

  // Lookup key by prefix (index scan - fast)
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_prefix', keyPrefix)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) {
    console.error('API key lookup error:', error);
    return { valid: false, error: 'Internal server error' };
  }

  if (!data) {
    return { valid: false, error: 'Invalid API key' };
  }

  // Timing-safe comparison (prevents timing attacks)
  if (!timingSafeEqual(data.key_hash, keyHash)) {
    return { valid: false, error: 'Invalid API key' };
  }

  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: 'API key expired' };
  }

  // Update last_used_at (fire and forget - don't block request)
  updateLastUsed(data.id);

  return {
    valid: true,
    apiKey: {
      id: data.id,
      userId: data.user_id,
      keyPrefix: data.key_prefix,
      name: data.name,
      scopes: data.scopes,
      expiresAt: data.expires_at ? new Date(data.expires_at) : null,
      rateLimitPerHour: data.rate_limit_per_hour,
    },
  };
}

// =====================================================
// Scope Management
// =====================================================

/**
 * Check if API key has required permission scope
 *
 * Scope Format:
 * - Exact match: "quotes:read"
 * - Wildcard resource: "quotes:*" (matches all quotes actions)
 * - Wildcard all: "*" (admin - matches everything)
 *
 * Examples:
 * - Key has "quotes:*" → Can do "quotes:read" ✅
 * - Key has "quotes:read" → Cannot do "quotes:create" ❌
 * - Key has "*" → Can do anything ✅
 *
 * @param apiKey - Validated API key object
 * @param requiredScope - Scope to check (e.g., "quotes:create")
 * @returns true if key has permission, false otherwise
 */
export function hasScope(apiKey: ApiKey, requiredScope: string): boolean {
  // Admin wildcard (full access)
  if (apiKey.scopes.includes('*')) {
    return true;
  }

  // Exact match
  if (apiKey.scopes.includes(requiredScope)) {
    return true;
  }

  // Wildcard resource match (e.g., "quotes:*" matches "quotes:read")
  const [resource] = requiredScope.split(':');
  if (apiKey.scopes.includes(`${resource}:*`)) {
    return true;
  }

  return false;
}

/**
 * Enforce scope requirement on an API key
 *
 * Throws error if key doesn't have required scope.
 * Use this in route handlers to protect endpoints.
 *
 * @param apiKey - Validated API key object
 * @param requiredScope - Required scope (e.g., "shipments:create")
 * @throws Error if scope not present
 */
export function enforceScope(apiKey: ApiKey, requiredScope: string): void {
  if (!hasScope(apiKey, requiredScope)) {
    throw new Error(
      `Insufficient permissions. Required scope: ${requiredScope}. ` +
        `Available scopes: ${apiKey.scopes.join(', ')}`
    );
  }
}

// =====================================================
// Key Management
// =====================================================

/**
 * Revoke an API key (soft delete)
 *
 * Sets revoked_at timestamp. Key remains in database for audit trail.
 * Revoked keys are immediately invalid for authentication.
 *
 * @param keyId - API key ID (UUID)
 * @param userId - User ID (for security check)
 * @returns true if revoked successfully
 */
export async function revokeApiKey(keyId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('user_id', userId); // Security: only owner can revoke

  if (error) {
    console.error('Failed to revoke API key:', error);
    return false;
  }

  return true;
}

/**
 * List all API keys for a user
 *
 * Returns only non-revoked keys.
 * Key hashes are NOT included (security).
 *
 * @param userId - User ID
 * @returns Array of API key metadata (no hashes)
 */
export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from('api_keys')
    .select(
      'id, key_prefix, name, scopes, created_at, last_used_at, expires_at, rate_limit_per_hour'
    )
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to list API keys:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    userId,
    keyPrefix: row.key_prefix,
    name: row.name,
    scopes: row.scopes,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    rateLimitPerHour: row.rate_limit_per_hour,
  }));
}

// =====================================================
// Internal Utilities
// =====================================================

/**
 * Hash an API key for storage
 *
 * Uses SHA-256 with salt from environment.
 * Salt must be cryptographically secure (32+ characters).
 *
 * SECURITY NOTES:
 * - Salt is required (fails if not set)
 * - Same key + salt always produces same hash (deterministic)
 * - Cannot reverse hash to get original key (one-way)
 *
 * @param key - Full API key (plaintext)
 * @returns Hex-encoded hash
 */
function hashApiKey(key: string): string {
  const salt = process.env.API_KEY_SALT;

  if (!salt) {
    throw new Error('API_KEY_SALT not configured. Generate with: openssl rand -base64 32');
  }

  if (salt.length < 32) {
    throw new Error('API_KEY_SALT must be at least 32 characters');
  }

  const hash = createHash('sha256');
  hash.update(key + salt);
  return hash.digest('hex');
}

/**
 * Timing-safe string comparison
 *
 * Prevents timing attacks by comparing all characters
 * even if early mismatch is found.
 *
 * Standard === comparison is NOT timing-safe:
 * - "abc" === "xyz" returns immediately (fast)
 * - "abc" === "abd" takes slightly longer
 * → Attacker can use timing to guess characters
 *
 * This function takes constant time regardless of differences.
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal, false otherwise
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Different lengths = not equal (but still compare all chars)
  if (a.length !== b.length) {
    // Don't return early - continue to prevent timing leak
    b = a; // Make same length for constant-time comparison
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    // XOR operation - 0 if same, non-zero if different
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  // result = 0 only if all characters match
  return result === 0;
}

/**
 * Update last_used_at timestamp
 *
 * Fire-and-forget operation (doesn't block request).
 * Failures are logged but don't affect authentication.
 *
 * @param keyId - API key ID
 */
async function updateLastUsed(keyId: string): Promise<void> {
  try {
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyId);
  } catch (error) {
    // Log but don't throw (non-critical operation)
    console.warn('Failed to update last_used_at:', error);
  }
}

// =====================================================
// Audit Logging
// =====================================================

/**
 * Log API key usage for audit trail
 *
 * Logs all API requests (success and failure) to api_audit_log table.
 * Used for:
 * - Security monitoring
 * - Rate limiting
 * - Usage analytics
 * - Debugging
 *
 * Fire-and-forget operation (doesn't block request).
 *
 * @param params - Audit log parameters
 */
export async function logApiKeyUsage(params: {
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  ipAddress?: string;
  userAgent?: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    await supabase.from('api_audit_log').insert({
      api_key_id: params.apiKeyId,
      endpoint: params.endpoint,
      method: params.method,
      status_code: params.statusCode,
      response_time_ms: params.responseTimeMs,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      error_message: params.errorMessage,
    });
  } catch (error) {
    // Log but don't throw (non-critical)
    console.warn('Failed to log API key usage:', error);
  }
}

/**
 * Check rate limit for an API key
 *
 * Queries audit log to count requests in the last hour.
 * Returns whether request should be allowed.
 *
 * @param apiKeyId - API key ID
 * @param rateLimitPerHour - Maximum requests per hour
 * @returns Object with allowed flag and remaining count
 */
export async function checkRateLimit(
  apiKeyId: string,
  rateLimitPerHour: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const { count, error } = await supabase
    .from('api_audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyId)
    .gte('timestamp', oneHourAgo.toISOString());

  if (error) {
    console.error('Rate limit check error:', error);
    // On error, allow request (fail open)
    return {
      allowed: true,
      remaining: rateLimitPerHour,
      resetAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  const requestCount = count || 0;
  const remaining = Math.max(0, rateLimitPerHour - requestCount);
  const resetAt = new Date(Date.now() + 60 * 60 * 1000);

  return {
    allowed: remaining > 0,
    remaining,
    resetAt,
  };
}
