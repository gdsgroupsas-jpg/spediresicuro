/**
 * API Middleware Utilities
 *
 * Utility condivise per autenticazione e autorizzazione nelle API routes
 * Consolida i pattern duplicati di auth check, admin verification, etc.
 */

import { auth } from "@/lib/auth-config";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export interface AuthResult {
  authorized: boolean;
  session?: any;
  response?: NextResponse;
}

export interface AdminAuthResult extends AuthResult {
  user?: any;
}

/**
 * Verifica che l'utente sia autenticato
 * Consolida il pattern ripetuto 30+ volte nelle API routes
 *
 * @returns AuthResult con session se autorizzato, altrimenti response di errore
 *
 * @example
 * const authResult = await requireAuth();
 * if (!authResult.authorized) return authResult.response;
 * const { session } = authResult;
 */
export async function requireAuth(): Promise<AuthResult> {
  // ⚠️ E2E TEST BYPASS (Solo CI/Test Environment)
  try {
    const headersList = headers();
    const testHeader = headersList.get("x-test-mode");
    const isPlaywrightMode = process.env.PLAYWRIGHT_TEST_MODE === "true";

    if (
      (testHeader === "playwright" || isPlaywrightMode) &&
      process.env.NODE_ENV !== "production"
    ) {
      console.log("🧪 [API AUTH] Test mode bypass active");
      return {
        authorized: true,
        session: {
          user: {
            id: "00000000-0000-0000-0000-000000000000",
            email: process.env.TEST_USER_EMAIL || "test@example.com",
            name: "Test User E2E",
            role: "admin", // Force admin role for tests
            account_type: "superadmin",
            is_reseller: true,
          },
        },
      };
    }
  } catch (e) {
    // Ignore error if headers() is not available (e.g. outside request context)
  }

  const session = await auth();

  if (!session?.user?.email) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Non autenticato" },
        { status: 401 }
      ),
    };
  }

  return {
    authorized: true,
    session,
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
    return NextResponse.json(
      { error: "Supabase non configurato" },
      { status: 500 }
    );
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
  select: string = "id, email, role"
): Promise<{
  id: string;
  email: string;
  role: string;
  [key: string]: any;
} | null> {
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select(select)
    .eq("email", email)
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
 * @returns AdminAuthResult con user se autorizzato, altrimenti response di errore
 *
 * @example
 * const adminAuth = await requireAdminRole();
 * if (!adminAuth.authorized) return adminAuth.response;
 * const { user } = adminAuth;
 */
export async function requireAdminRole(
  customErrorMessage?: string
): Promise<AdminAuthResult> {
  // Prima verifica autenticazione
  const authResult = await requireAuth();
  if (!authResult.authorized) {
    return authResult;
  }

  const { session } = authResult;

  // Verifica Supabase configurato
  const configCheck = checkSupabaseConfig();
  if (configCheck) {
    return {
      authorized: false,
      response: configCheck,
    };
  }

  // Cerca utente e verifica ruolo admin
  const user = await findUserByEmail(session.user.email);

  if (!user || user.role !== "admin") {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error:
            customErrorMessage ||
            "Accesso negato. Solo gli admin possono accedere a questa risorsa.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    session,
    user,
  };
}

/**
 * Verifica che l'utente abbia ruolo reseller
 * Utility per verificare permessi reseller
 *
 * @returns AdminAuthResult con user se autorizzato, altrimenti response di errore
 */
export async function requireResellerRole(): Promise<AdminAuthResult> {
  const authResult = await requireAuth();
  if (!authResult.authorized) {
    return authResult;
  }

  const { session } = authResult;

  const configCheck = checkSupabaseConfig();
  if (configCheck) {
    return {
      authorized: false,
      response: configCheck,
    };
  }

  const user = await findUserByEmail(session.user.email);

  if (!user || (user.role !== "reseller" && user.role !== "admin")) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error:
            "Accesso negato. Solo i reseller possono accedere a questa risorsa.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    session,
    user,
  };
}
