/**
 * AuthContext: Contesto di autenticazione esplicito e sicuro
 * 
 * Elimina la logica "email null => admin" e introduce un contesto esplicito:
 * - user: utente autenticato con userId
 * - service_role: operazione admin/service role verificata
 * - anonymous: non autenticato (bloccato)
 * 
 * ⚠️ SICUREZZA: Nessun percorso può chiamare getSpedizioni/addSpedizione senza contesto valido
 */

import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/supabase';
import { getSupabaseUserIdFromEmail } from '@/lib/database';

export type AuthContextType = 'user' | 'service_role' | 'anonymous';

export interface AuthContext {
  type: AuthContextType;
  userId?: string; // UUID Supabase (obbligatorio per 'user')
  userEmail?: string; // Email utente (opzionale, per audit)
  isAdmin?: boolean; // Se l'utente ha ruolo admin (verificato)
  serviceRoleMetadata?: {
    adminId?: string; // ID admin che esegue l'operazione
    reason?: string; // Motivo operazione service_role
  };
}

/**
 * Crea AuthContext da sessione NextAuth
 * 
 * @param session Sessione NextAuth (opzionale, se null usa auth())
 * @returns AuthContext (user o anonymous)
 */
export async function createAuthContextFromSession(session?: any): Promise<AuthContext> {
  // Se non fornita, recupera sessione
  if (!session) {
    session = await auth();
  }

  // Se non autenticato, ritorna anonymous
  if (!session?.user?.email) {
    return {
      type: 'anonymous',
    };
  }

  // Verifica ruolo admin
  const userRole = (session.user as any).role || 'user';
  const isAdmin = userRole === 'admin' || (session.user as any).account_type === 'admin' || (session.user as any).account_type === 'superadmin';

  // Ottieni userId Supabase
  let supabaseUserId: string | null = null;
  try {
    supabaseUserId = await getSupabaseUserIdFromEmail(session.user.email, session.user.id);
  } catch (error: any) {
    console.warn('⚠️ [AUTH CONTEXT] Errore recupero userId:', error.message);
  }

  // Se non abbiamo userId, NON possiamo permettere operazioni
  // Questo è un hard fail per sicurezza
  if (!supabaseUserId) {
    console.error('❌ [AUTH CONTEXT] Impossibile ottenere userId Supabase per:', session.user.email);
    // Ritorna anonymous invece di user senza userId
    return {
      type: 'anonymous',
    };
  }

  return {
    type: 'user',
    userId: supabaseUserId,
    userEmail: session.user.email,
    isAdmin,
  };
}

/**
 * Crea AuthContext per operazioni service_role
 * 
 * ⚠️ USARE SOLO per operazioni amministrative verificate
 * Richiede verifica esplicita che si stia usando service_role
 * 
 * @param adminId ID admin che esegue l'operazione (opzionale)
 * @param reason Motivo operazione service_role (opzionale)
 * @returns AuthContext service_role
 */
export function createServiceRoleContext(adminId?: string, reason?: string): AuthContext {
  // ⚠️ SICUREZZA: Verifica che stiamo usando service_role key
  const isServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY && 
                        !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('placeholder');
  
  if (!isServiceRole) {
    throw new Error('Service role context richiede SUPABASE_SERVICE_ROLE_KEY configurata');
  }

  return {
    type: 'service_role',
    serviceRoleMetadata: {
      adminId,
      reason: reason || 'Operazione amministrativa',
    },
  };
}

/**
 * Verifica se AuthContext permette operazioni
 * 
 * @param context AuthContext da verificare
 * @returns true se autorizzato, false altrimenti
 */
export function isAuthorized(context: AuthContext): boolean {
  return context.type !== 'anonymous';
}

/**
 * Verifica se AuthContext è service_role
 * 
 * @param context AuthContext da verificare
 * @returns true se service_role, false altrimenti
 */
export function isServiceRole(context: AuthContext): boolean {
  return context.type === 'service_role';
}

/**
 * Verifica se AuthContext è user (non anonymous)
 * 
 * @param context AuthContext da verificare
 * @returns true se user, false altrimenti
 */
export function isUser(context: AuthContext): boolean {
  return context.type === 'user';
}

/**
 * Log audit per operazioni service_role
 * 
 * @param context AuthContext
 * @param operation Nome operazione
 * @param details Dettagli aggiuntivi
 */
export function logServiceRoleOperation(
  context: AuthContext,
  operation: string,
  details?: Record<string, any>
): void {
  if (context.type !== 'service_role') {
    return; // Non loggare se non è service_role
  }

  console.log('🔐 [AUDIT] Service Role Operation:', {
    operation,
    adminId: context.serviceRoleMetadata?.adminId,
    reason: context.serviceRoleMetadata?.reason,
    timestamp: new Date().toISOString(),
    ...details,
  });
}
