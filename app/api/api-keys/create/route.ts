/**
 * API Key Creation Endpoint
 *
 * POST /api/api-keys/create
 *
 * Creates a new API key for the authenticated user.
 * Requires cookie-based authentication (user must be logged in via browser).
 *
 * Security:
 * - Only authenticated users can create keys
 * - Returns plaintext key ONCE (never stored, never retrievable)
 * - Key is hashed before storage
 * - Rate limited per user
 *
 * @module app/api/api-keys/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth } from '@/lib/safe-auth';
import { generateApiKey } from '@/lib/api-key-service';
import { FeatureFlags } from '@/lib/feature-flags';

export async function POST(req: NextRequest) {
  // Feature flag check
  if (!FeatureFlags.API_KEY_AUTH) {
    return NextResponse.json({ error: 'API key authentication is not enabled' }, { status: 503 });
  }

  // Require cookie auth (user must be logged in)
  const context = await getSafeAuth();
  if (!context?.actor?.id) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'You must be logged in to create API keys' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { name, scopes, expiresInDays } = body;

    // Validation
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request', message: 'Name is required and must be a string' },
        { status: 400 }
      );
    }

    if (name.length < 3) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'Name must be at least 3 characters' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'Name must be less than 100 characters' },
        { status: 400 }
      );
    }

    // Validate scopes if provided
    const validScopes = [
      'quotes:read',
      'quotes:create',
      'shipments:read',
      'shipments:create',
      'shipments:update',
      'wallet:read',
      '*',
    ];

    if (scopes && !Array.isArray(scopes)) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'Scopes must be an array' },
        { status: 400 }
      );
    }

    if (scopes && scopes.some((scope: string) => !validScopes.includes(scope))) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: `Invalid scope. Valid scopes: ${validScopes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate expiry
    if (expiresInDays !== undefined) {
      if (typeof expiresInDays !== 'number' || expiresInDays < 1 || expiresInDays > 365) {
        return NextResponse.json(
          { error: 'Invalid request', message: 'expiresInDays must be between 1 and 365' },
          { status: 400 }
        );
      }
    }

    // Generate API key
    const { key, keyPrefix, id } = await generateApiKey(context.actor.id, name, {
      scopes: scopes || ['quotes:read'],
      expiresInDays: expiresInDays || FeatureFlags.API_KEY_DEFAULT_EXPIRY_DAYS,
    });

    // Success response
    return NextResponse.json(
      {
        success: true,
        data: {
          id,
          key, // ⚠️ SHOWN ONLY ONCE - User must save it
          keyPrefix,
          name,
          scopes: scopes || ['quotes:read'],
          expiresInDays: expiresInDays || FeatureFlags.API_KEY_DEFAULT_EXPIRY_DAYS,
        },
        message:
          '⚠️ Save this key securely. It will NEVER be shown again. If you lose it, you must create a new key.',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Failed to create API key:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to create API key. Please try again.',
      },
      { status: 500 }
    );
  }
}
