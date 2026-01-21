/**
 * API Key List Endpoint
 *
 * GET /api/api-keys/list
 *
 * Lists all active API keys for the authenticated user.
 * Only shows metadata (no key hashes, no sensitive data).
 *
 * Security:
 * - Only authenticated users can list keys
 * - Users can only see their own keys
 * - Key hashes are never returned
 * - Includes usage statistics
 *
 * @module app/api/api-keys/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { listApiKeys } from '@/lib/api-key-service';
import { FeatureFlags } from '@/lib/feature-flags';

export async function GET(req: NextRequest) {
  // Feature flag check
  if (!FeatureFlags.API_KEY_AUTH) {
    return NextResponse.json({ error: 'API key authentication is not enabled' }, { status: 503 });
  }

  // Require cookie auth (user must be logged in)
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'You must be logged in to list API keys' },
      { status: 401 }
    );
  }

  try {
    // Get all API keys for user
    const keys = await listApiKeys(session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        keys: keys.map((key) => ({
          id: key.id,
          keyPrefix: key.keyPrefix, // e.g., "sk_live_abc12345"
          name: key.name,
          scopes: key.scopes,
          expiresAt: key.expiresAt,
          rateLimitPerHour: key.rateLimitPerHour,
        })),
        count: keys.length,
      },
    });
  } catch (error: any) {
    console.error('Failed to list API keys:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve API keys. Please try again.',
      },
      { status: 500 }
    );
  }
}
