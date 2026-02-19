/**
 * Safe Auth Helper - Acting Context (Impersonation)
 *
 * CRITICAL: Questo è il SOLO modo sicuro per ottenere il contesto di autenticazione
 * quando il sistema supporta impersonation.
 *
 * ARCHITECTURAL RULES:
 * 1. Business logic DEVE usare getSafeAuth(), MAI auth() direttamente
 * 2. Solo middleware può iniettare l'header x-sec-impersonate-target
 * 3. L'header è trusted perché validato dal middleware (SuperAdmin check)
 * 4. Fail-closed: se qualcosa non è valido, ritorna null/error
 *
 * FLOW:
 * 1. Middleware valida cookie sp_impersonate_id + session SuperAdmin
 * 2. Se valido, middleware inietta header x-sec-impersonate-target
 * 3. getSafeAuth() legge header e costruisce ActingContext
 * 4. Business logic usa ActingContext.target per operazioni (non actor)
 */

import { auth } from '@/lib/auth-config';
import { headers } from 'next/headers';

/**
 * User info minimo per Acting Context
 */
export interface ActingUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  account_type?: string;
  is_reseller?: boolean;
}

/**
 * Acting Context: distingue chi fa (actor) e per chi (target)
 *
 * - isImpersonating = false: actor = target (operazione normale)
 * - isImpersonating = true: actor != target (SuperAdmin opera per cliente)
 */
export interface ActingContext {
  /**
   * ACTOR: chi ESEGUE l'azione (SuperAdmin se impersonating)
   */
  actor: ActingUser;

  /**
   * TARGET: per CHI viene eseguita l'azione (il cliente)
   *
   * ⚠️ IMPORTANTE: Business logic deve usare target.id per:
   * - Addebiti wallet
   * - Creazione spedizioni
   * - Query dati
   */
  target: ActingUser;

  /**
   * Flag impersonation attiva
   */
  isImpersonating: boolean;

  /**
   * Metadata per audit (opzionale)
   */
  metadata?: {
    reason?: string;
    requestId?: string;
    ip?: string;
  };
}

/**
 * Header iniettato dal middleware (TRUSTED)
 */
const IMPERSONATE_HEADER = 'x-sec-impersonate-target';

/**
 * Ruoli autorizzati a fare impersonation
 */
const AUTHORIZED_IMPERSONATORS = ['superadmin'];

/**
 * Get Safe Auth - L'UNICO modo per ottenere contesto autenticazione
 *
 * Questa funzione:
 * 1. Ottiene sessione NextAuth
 * 2. Legge header x-sec-impersonate-target (se presente, significa middleware ha validato)
 * 3. Costruisce ActingContext con actor + target
 * 4. Fail-closed: se qualcosa non è valido, ritorna null
 *
 * @returns ActingContext o null se non autenticato
 */
export async function getSafeAuth(): Promise<ActingContext | null> {
  try {
    // 1. Ottieni sessione NextAuth
    const session = await auth();

    if (!session || !session.user) {
      console.log('🔒 [SAFE-AUTH] No session found');
      return null;
    }

    const sessionUser = session.user as any;

    // Valida che session user abbia almeno id ed email
    if (!sessionUser.id || !sessionUser.email) {
      console.error('❌ [SAFE-AUTH] Invalid session: missing id or email');
      return null;
    }

    // Costruisci actor da sessione
    const actor: ActingUser = {
      id: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.name || null,
      role: sessionUser.role || 'user',
      account_type: sessionUser.account_type,
      is_reseller: sessionUser.is_reseller || false,
    };

    // 2. Leggi headers impersonation (iniettati dal middleware se valido)
    const headersList = await headers();
    const impersonateTargetId = headersList.get('x-sec-impersonate-target');
    const impersonateActive = headersList.get('x-sec-impersonate-active');
    const impersonateReason = headersList.get('x-sec-impersonate-reason');

    // 3. Se NO impersonation header → operazione normale (actor = target)
    if (!impersonateTargetId) {
      return {
        actor,
        target: actor, // Target = Actor (operazione normale)
        isImpersonating: false,
      };
    }

    // 4. Se impersonation header presente → VALIDA e costruisci target
    console.log('🔐 [SAFE-AUTH] Impersonation header detected:', {
      actorId: actor.id,
      targetId: impersonateTargetId,
    });

    // 4.1. Verifica che actor sia autorizzato (double-check, middleware già controlla)
    const actorRole = actor.role.toLowerCase();
    const actorAccountType = actor.account_type?.toLowerCase();

    const isAuthorized =
      AUTHORIZED_IMPERSONATORS.includes(actorRole) ||
      AUTHORIZED_IMPERSONATORS.includes(actorAccountType || '');

    if (!isAuthorized) {
      console.error(
        '❌ [SAFE-AUTH] SECURITY VIOLATION: Impersonation header present but actor not authorized',
        {
          actorId: actor.id,
          actorRole,
          actorAccountType,
        }
      );
      // Fail-closed: ritorna contesto normale, NON impersonation
      return {
        actor,
        target: actor,
        isImpersonating: false,
      };
    }

    // 4.2. Valida formato target ID (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(impersonateTargetId)) {
      console.error('❌ [SAFE-AUTH] Invalid target ID format:', impersonateTargetId);
      return {
        actor,
        target: actor,
        isImpersonating: false,
      };
    }

    // 4.3. Carica target user dal database (COMPLETO, no placeholder)
    let targetUser: ActingUser;

    try {
      const { supabaseAdmin } = await import('@/lib/db/client');

      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, email, name, role, account_type, is_reseller')
        .eq('id', impersonateTargetId)
        .single();

      if (error || !data) {
        console.error('❌ [SAFE-AUTH] Target user not found:', {
          targetId: impersonateTargetId,
          error: error?.message,
        });

        // Log security event (target not found)
        try {
          const { logImpersonationTargetNotFound } = await import('@/lib/security/security-events');
          await logImpersonationTargetNotFound(actor.id, impersonateTargetId, {
            error: error?.message || 'Target user not found in database',
          });
        } catch {
          // Ignore log errors
        }

        // Fail-closed: target non trovato, ritorna contesto normale
        return {
          actor,
          target: actor,
          isImpersonating: false,
        };
      }

      // CRITICAL: Valida che target abbia dati completi (NO placeholder)
      if (!data.email || !data.name) {
        console.error('❌ [SAFE-AUTH] Target user incomplete (missing email/name):', {
          targetId: impersonateTargetId,
          hasEmail: !!data.email,
          hasName: !!data.name,
        });

        // Fail-closed: dati incompleti
        return {
          actor,
          target: actor,
          isImpersonating: false,
        };
      }

      targetUser = {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role || 'user',
        account_type: data.account_type,
        is_reseller: data.is_reseller || false,
      };

      console.log('✅ [SAFE-AUTH] Impersonation active:', {
        actor: {
          id: actor.id,
          email: actor.email,
          role: actor.role,
        },
        target: {
          id: targetUser.id,
          email: targetUser.email,
          role: targetUser.role,
        },
        reason: impersonateReason?.substring(0, 50),
      });
    } catch (error: any) {
      console.error('❌ [SAFE-AUTH] Error loading target user:', error?.message);
      // Fail-closed: errore caricamento, ritorna contesto normale
      return {
        actor,
        target: actor,
        isImpersonating: false,
      };
    }

    // 5. Ritorna ActingContext con impersonation attiva
    return {
      actor,
      target: targetUser,
      isImpersonating: true,
      metadata: {
        reason: impersonateReason || undefined,
        requestId: headersList.get('x-request-id') || undefined,
      },
    };
  } catch (error: any) {
    console.error('❌ [SAFE-AUTH] Unexpected error:', error?.message);
    return null;
  }
}

/**
 * Require Safe Auth - Wrapper che fa throw se non autenticato
 *
 * Usa questo nelle Server Actions che RICHIEDONO autenticazione
 *
 * @throws Error se non autenticato
 * @returns ActingContext garantito non-null
 */
export async function requireSafeAuth(): Promise<ActingContext> {
  const context = await getSafeAuth();

  if (!context) {
    throw new Error('UNAUTHORIZED: Authentication required');
  }

  return context;
}

/**
 * Tipi account supportati (source of truth: campo account_type nel DB users)
 *
 * REGOLA: account_type e' la SOURCE OF TRUTH. Il campo role e' deprecated.
 */
export type AccountType = 'user' | 'admin' | 'superadmin' | 'byoc' | 'reseller';

/**
 * Check se utente corrente è SuperAdmin (può fare impersonation, accesso totale)
 *
 * FIX F1: Usa SOLO account_type come source of truth.
 * Il campo role e' deprecated e viene ignorato.
 *
 * @param context - ActingContext da getSafeAuth()
 * @returns true se actor è SuperAdmin
 */
export function isSuperAdmin(context: ActingContext): boolean {
  const accountType = context.actor.account_type?.toLowerCase();
  return accountType === 'superadmin';
}

/**
 * Check se utente corrente è Admin o SuperAdmin (accesso admin panel)
 *
 * Usa questo per gate che richiedono almeno livello admin.
 * Per gate superadmin-only, usa isSuperAdmin().
 *
 * @param context - ActingContext da getSafeAuth()
 * @returns true se actor è Admin o SuperAdmin
 */
export function isAdminOrAbove(context: ActingContext): boolean {
  const accountType = context.actor.account_type?.toLowerCase();
  return accountType === 'admin' || accountType === 'superadmin';
}

/**
 * Check se utente corrente è Reseller (può vedere sub-users)
 *
 * @param context - ActingContext da getSafeAuth()
 * @returns true se actor è Reseller
 */
export function isReseller(context: ActingContext): boolean {
  return context.actor.is_reseller === true;
}

/**
 * Helper per audit log con Acting Context
 *
 * Usa questo per creare audit log che tracciano actor + target
 */
export async function logActingContextAudit(
  context: ActingContext,
  action: string,
  resourceType: string,
  resourceId: string,
  auditMetadata: Record<string, any> = {}
): Promise<void> {
  try {
    const { supabaseAdmin } = await import('@/lib/db/client');

    // Usa funzione SQL se disponibile
    const { error } = await supabaseAdmin.rpc('log_acting_context_audit', {
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_actor_id: context.actor.id,
      p_target_id: context.target.id,
      p_impersonation_active: context.isImpersonating,
      p_audit_metadata: {
        ...auditMetadata,
        actor_email: context.actor.email,
        target_email: context.target.email,
        request_id: context.metadata?.requestId,
      },
    });

    if (error) {
      console.error('❌ [AUDIT] Error logging acting context:', error.message);
    } else {
      console.log('✅ [AUDIT] Acting context logged:', {
        action,
        actor: context.actor.email,
        target: context.target.email,
        impersonating: context.isImpersonating,
      });
    }
  } catch (error: any) {
    console.error('❌ [AUDIT] Unexpected error:', error?.message);
  }
}

/**
 * DEPRECATION WARNING per codice legacy
 *
 * Se vedi questo warning, il codice deve essere migrato a getSafeAuth()
 */
export function warnLegacyAuthUsage(location: string): void {
  console.warn(
    `⚠️ [DEPRECATED] Direct auth() usage at ${location}. ` +
      `Use getSafeAuth() instead to support impersonation.`
  );
}
