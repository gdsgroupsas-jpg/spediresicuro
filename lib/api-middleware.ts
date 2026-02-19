/**
 * API Middleware Utilities
 *
 * Utility condivise per autenticazione e autorizzazione nelle API routes
 * Consolida i pattern duplicati di auth check, admin verification, etc.
 *
 * ⚠️ MIGRATED: Ora usa getSafeAuth() per supportare impersonation
 */

import { getSafeAuth, ActingContext, ActingUser } from '@/lib/safe-auth';
import { isAdminOrAbove, isResellerCheck } from '@/lib/auth-helpers';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export interface AuthResult {
  authorized: boolean;
  context?: ActingContext;
  response?: NextResponse;
}

export interface AdminAuthResult extends AuthResult {
  user?: any;
}

/**
 * Verifica che l'utente sia autenticato
 * Consolida il pattern ripetuto 30+ volte nelle API routes
 *
 * ⚠️ MIGRATED: Ora ritorna context (ActingContext) invece di session
 *
 * @returns AuthResult con context se autorizzato, altrimenti response di errore
 *
 * @example
 * const authResult = await requireAuth();
 * if (!authResult.authorized) return authResult.response;
 * const { context } = authResult;
 * // Usa context.actor per chi esegue, context.target per chi è target
 */
export async function requireAuth(): Promise<AuthResult> {
  // ⚠️ E2E TEST BYPASS — logica centralizzata in lib/test-mode.ts
  try {
    const { isE2ETestMode } = await import('@/lib/test-mode');
    const headersList = await headers();

    if (isE2ETestMode(headersList)) {
      const testUser: ActingUser = {
        id: '00000000-0000-0000-0000-000000000000',
        email: process.env.TEST_USER_EMAIL || 'test@example.com',
        name: 'Test User E2E',
        role: 'admin',
        account_type: 'superadmin',
        is_reseller: true,
      };
      return {
        authorized: true,
        context: {
          actor: testUser,
          target: testUser,
          isImpersonating: false,
        },
      };
    }
  } catch (e) {
    // Ignore error if headers() is not available (e.g. outside request context)
  }

  const context = await getSafeAuth();

  if (!context?.actor?.email) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Non autenticato' }, { status: 401 }),
    };
  }

  return {
    authorized: true,
    context,
  };
}

/**
 * Verifica che Supabase sia configurato
 * Consolida il pattern ripetuto 20+ volte nelle API routes
 *
 * @returns Response di errore se non configurato, altrimenti undefined
 *
 * @example
 * const configCheck = checkSupabaseConfig();
 * if (configCheck) return configCheck;
 */
export function checkSupabaseConfig(): NextResponse | undefined {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 });
  }
  return undefined;
}

/**
 * Trova un utente in Supabase dato l'email
 * Utility helper per evitare duplicazione di query
 *
 * @param email - Email dell'utente da cercare
 * @param select - Campi da selezionare (default: 'id, email, role')
 * @returns Utente trovato o null
 */
export async function findUserByEmail(
  email: string,
  select: string = 'id, email, role, account_type, is_reseller'
): Promise<{
  id: string;
  email: string;
  role: string;
  account_type?: string;
  is_reseller?: boolean;
  [key: string]: any;
} | null> {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select(select)
    .eq('email', email)
    .single();

  if (error || !user) {
    return null;
  }

  // Doppio cast per risolvere il tipo GenericStringError di Supabase
  return user as unknown as {
    id: string;
    email: string;
    role: string;
    [key: string]: any;
  };
}

/**
 * Verifica che l'utente abbia ruolo admin
 * Consolida il pattern ripetuto 25+ volte nelle API routes
 *
 * ⚠️ MIGRATED: Ora ritorna context invece di session
 *
 * @returns AdminAuthResult con user se autorizzato, altrimenti response di errore
 *
 * @example
 * const adminAuth = await requireAdminRole();
 * if (!adminAuth.authorized) return adminAuth.response;
 * const { context, user } = adminAuth;
 */
export async function requireAdminRole(customErrorMessage?: string): Promise<AdminAuthResult> {
  // Prima verifica autenticazione
  const authResult = await requireAuth();
  if (!authResult.authorized) {
    return authResult;
  }

  const { context } = authResult;

  // Verifica Supabase configurato
  const configCheck = checkSupabaseConfig();
  if (configCheck) {
    return {
      authorized: false,
      response: configCheck,
    };
  }

  // Cerca utente e verifica account_type admin o superadmin (source of truth)
  const user = await findUserByEmail(context!.actor.email!);

  if (!user || !isAdminOrAbove(user)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error:
            customErrorMessage ||
            'Accesso negato. Solo gli admin possono accedere a questa risorsa.',
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    context,
    user,
  };
}

/**
 * Verifica che l'utente abbia ruolo reseller
 * Utility per verificare permessi reseller
 *
 * ⚠️ MIGRATED: Ora ritorna context invece di session
 *
 * @returns AdminAuthResult con user se autorizzato, altrimenti response di errore
 */
export async function requireResellerRole(): Promise<AdminAuthResult> {
  const authResult = await requireAuth();
  if (!authResult.authorized) {
    return authResult;
  }

  const { context } = authResult;

  const configCheck = checkSupabaseConfig();
  if (configCheck) {
    return {
      authorized: false,
      response: configCheck,
    };
  }

  const user = await findUserByEmail(context!.actor.email!);

  if (!user || (!isResellerCheck(user) && !isAdminOrAbove(user))) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'Accesso negato. Solo i reseller possono accedere a questa risorsa.',
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    context,
    user,
  };
}
