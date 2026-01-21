/**
 * API Key Revocation Endpoint
 *
 * POST /api/api-keys/revoke
 *
 * Revokes an API key (soft delete).
 * Key remains in database for audit trail but cannot be used.
 *
 * Security:
 * - Only authenticated users can revoke keys
 * - Users can only revoke their own keys
 * - Revocation is immediate (no grace period)
 * - Audit trail preserved
 *
 * @module app/api/api-keys/revoke
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { revokeApiKey } from '@/lib/api-key-service';
import { FeatureFlags } from '@/lib/feature-flags';

export async function POST(req: NextRequest) {
  // Feature flag check
  if (!FeatureFlags.API_KEY_AUTH) {
    return NextResponse.json({ error: 'API key authentication is not enabled' }, { status: 503 });
  }

  // Require cookie auth (user must be logged in)
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'You must be logged in to revoke API keys' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { keyId } = body;

    // Validation
    if (!keyId || typeof keyId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request', message: 'keyId is required and must be a string (UUID)' },
        { status: 400 }
      );
    }

    // UUID validation (basic)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(keyId)) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'keyId must be a valid UUID' },
        { status: 400 }
      );
    }

    // Revoke key (includes security check - user can only revoke own keys)
    const success = await revokeApiKey(keyId, session.user.id);

    if (!success) {
      return NextResponse.json(
        {
          error: 'Not found',
          message: 'API key not found or you do not have permission to revoke it',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        'API key has been revoked successfully. It can no longer be used for authentication.',
    });
  } catch (error: any) {
    console.error('Failed to revoke API key:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to revoke API key. Please try again.',
      },
      { status: 500 }
    );
  }
}
