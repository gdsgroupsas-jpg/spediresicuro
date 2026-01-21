/**
 * Feature Flags System
 *
 * Centralized feature flag management for safe progressive rollout
 * of new features without code changes.
 *
 * Usage:
 *   if (FeatureFlags.API_KEY_AUTH) {
 *     // New API key auth logic
 *   }
 *
 * Environment Variables:
 *   ENABLE_API_KEY_AUTH=true|false
 *   API_KEY_SHADOW_MODE=true|false
 */

export const FeatureFlags = {
  /**
   * Enable API key authentication
   * Default: false (disabled)
   *
   * When disabled: Only cookie auth works (existing behavior)
   * When enabled: Both cookie auth + API key auth work (hybrid)
   */
  API_KEY_AUTH: process.env.ENABLE_API_KEY_AUTH === 'true',

  /**
   * Shadow mode for API key auth
   * Default: false (enforced)
   *
   * When true: API keys are validated and logged, but requests
   * are not blocked if invalid. Useful for testing in production
   * without affecting existing traffic.
   *
   * When false: Invalid API keys are rejected with 401.
   */
  API_KEY_SHADOW_MODE: process.env.API_KEY_SHADOW_MODE === 'true',

  /**
   * Default rate limit (requests per hour)
   * Default: 1000
   */
  API_KEY_DEFAULT_RATE_LIMIT: parseInt(process.env.API_KEY_DEFAULT_RATE_LIMIT || '1000', 10),

  /**
   * Default API key expiry (days)
   * Default: 90
   */
  API_KEY_DEFAULT_EXPIRY_DAYS: parseInt(process.env.API_KEY_DEFAULT_EXPIRY_DAYS || '90', 10),
} as const;

/**
 * Validate required environment variables
 * Call this on application startup
 */
export function validateFeatureFlags(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (FeatureFlags.API_KEY_AUTH) {
    // When API key auth is enabled, salt is required
    if (!process.env.API_KEY_SALT) {
      errors.push(
        'API_KEY_SALT is required when ENABLE_API_KEY_AUTH=true. ' +
          'Generate with: openssl rand -base64 32'
      );
    }

    // Validate salt strength (minimum 32 characters)
    if (process.env.API_KEY_SALT && process.env.API_KEY_SALT.length < 32) {
      errors.push('API_KEY_SALT must be at least 32 characters long');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get feature flag status for logging/monitoring
 */
export function getFeatureFlagStatus() {
  return {
    apiKeyAuth: {
      enabled: FeatureFlags.API_KEY_AUTH,
      shadowMode: FeatureFlags.API_KEY_SHADOW_MODE,
      rateLimit: FeatureFlags.API_KEY_DEFAULT_RATE_LIMIT,
      expiryDays: FeatureFlags.API_KEY_DEFAULT_EXPIRY_DAYS,
    },
  };
}
