import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/supabase'; // OR imported from db client
import { NextRequest } from 'next/server';

/**
 * Unified User Interface
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  authMethod: 'cookie' | 'api_key';
  apiKeyId?: string;
  scopes?: string[];
}

/**
 * Get current user from request (Unified Auth)
 *
 * Supports:
 * 1. NextAuth Session (Cookie)
 * 2. API Key (x-user-id header trusted from middleware)
 *
 * @param req NextRequest
 * @returns AuthenticatedUser or null
 */
export async function getCurrentUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    // 1. Check Session (Cookie) - Priority 1
    const session = await auth();
    if (session?.user?.id && session?.user?.email) {
      return {
        id: session.user.id,
        email: session.user.email,
        authMethod: 'cookie',
      };
    }

    // 2. Check API Key Headers (Trusted from Middleware)
    // Middleware MUST sanitize these headers to prevent spoofing
    const apiKeyUserId = req.headers.get('x-user-id');
    const apiKeyId = req.headers.get('x-api-key-id');
    const apiKeyScopes = req.headers.get('x-api-key-scopes');

    if (apiKeyUserId && apiKeyId) {
      // Need to fetch email for the user since API key flow only gives ID so far
      // We use admin client to fetch user details by ID
      const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(apiKeyUserId);

      if (error || !user?.user) {
        console.error('Failed to resolve user from API Key ID:', error);
        return null;
      }

      return {
        id: apiKeyUserId,
        email: user.user.email || '', // Should exist
        authMethod: 'api_key',
        apiKeyId: apiKeyId,
        scopes: apiKeyScopes ? apiKeyScopes.split(',') : [],
      };
    }

    return null;
  } catch (error) {
    // Catch any unexpected errors (e.g., RLS policy failures, malformed UUIDs)
    console.error('Error in getCurrentUser:', error);
    return null;
  }
}
