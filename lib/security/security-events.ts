/**
 * Security Events - Audit Logging Standardizzato
 *
 * Estende lib/security/audit-log.ts con eventi impersonation
 *
 * CRITICAL: Usa getSafeAuth() invece di auth() per supportare impersonation
 */

import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';

/**
 * Security event types (impersonation + existing audit)
 */
export type SecurityEventType =
  // Impersonation events
  | 'impersonation_started'
  | 'impersonation_ended'
  | 'impersonation_denied'
  | 'impersonation_invalid_cookie'
  | 'impersonation_expired'
  | 'impersonation_target_not_found'
  | 'impersonation_authz_failed'
  // Wallet bypass events (P0 audit fix)
  | 'superadmin_wallet_bypass'
  // Existing credential events (compatibility)
  | 'credential_viewed'
  | 'credential_copied'
  | 'credential_created'
  | 'credential_updated'
  | 'credential_deleted'
  | 'credential_decrypted'
  | 'credential_activated'
  | 'credential_deactivated';

/**
 * Security event payload
 */
export interface SecurityEvent {
  action: SecurityEventType;
  resource_type: string; // 'impersonation' | 'courier_config' | 'api_credential' | etc.
  resource_id: string;

  // Actor/Target (per impersonation)
  actor_id?: string;
  target_id?: string;
  impersonation_active?: boolean;

  // Workspace isolation
  workspace_id?: string;

  // Legacy (compatibility)
  user_id?: string;
  user_email?: string;

  // Metadata
  metadata?: Record<string, any>;
  audit_metadata?: Record<string, any>;

  // Timestamp
  created_at?: string;
}

/**
 * Log security event (impersonation-aware)
 *
 * CRITICAL: NON usa auth() direttamente per evitare circular dependency
 * Context deve essere passato dal chiamante
 *
 * @param event - Security event da loggare
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    // Prepara payload per insert
    const wsId = event.workspace_id || null;
    const logEntry = {
      action: event.action,
      resource_type: event.resource_type,
      resource_id: event.resource_id,

      // Actor/Target (se presenti)
      actor_id: event.actor_id || null,
      target_id: event.target_id || null,
      impersonation_active: event.impersonation_active || false,

      // Workspace isolation
      workspace_id: wsId,

      // Legacy fields (compatibility)
      user_id: event.target_id || event.user_id || null,
      user_email: event.user_email || null,

      // Metadata
      metadata: event.metadata || {},
      audit_metadata: {
        ...event.audit_metadata,
        logged_at: new Date().toISOString(),
      },

      // Timestamp
      created_at: event.created_at || new Date().toISOString(),
    };

    // Insert in audit_logs (workspace-isolated)
    const db = wsId ? workspaceQuery(wsId) : supabaseAdmin;
    const { error } = await db.from('audit_logs').insert([logEntry]);

    if (error) {
      // Fallback: log in console
      console.warn('⚠️ [SECURITY-EVENT] DB insert failed, logging to console:', error.message);
      console.log('📋 [SECURITY-EVENT]', JSON.stringify(logEntry, null, 2));
      return;
    }

    // Success
    console.log('✅ [SECURITY-EVENT] Logged:', {
      action: event.action,
      resource: `${event.resource_type}:${event.resource_id.substring(0, 8)}...`,
      actor: event.actor_id ? event.actor_id.substring(0, 8) + '...' : 'N/A',
      target: event.target_id ? event.target_id.substring(0, 8) + '...' : 'N/A',
    });
  } catch (error: any) {
    // NON bloccare operazione se log fallisce
    console.error('❌ [SECURITY-EVENT] Logging error:', error.message);
    console.log('📋 [SECURITY-EVENT] (fallback console)', JSON.stringify(event, null, 2));
  }
}

/**
 * Log impersonation started
 */
export async function logImpersonationStarted(
  actorId: string,
  targetId: string,
  reason: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logSecurityEvent({
    action: 'impersonation_started',
    resource_type: 'impersonation',
    resource_id: targetId,
    actor_id: actorId,
    target_id: targetId,
    impersonation_active: true,
    audit_metadata: {
      reason,
      ...metadata,
    },
  });
}

/**
 * Log impersonation ended
 */
export async function logImpersonationEnded(
  actorId: string,
  targetId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logSecurityEvent({
    action: 'impersonation_ended',
    resource_type: 'impersonation',
    resource_id: targetId,
    actor_id: actorId,
    target_id: targetId,
    impersonation_active: false,
    audit_metadata: metadata,
  });
}

/**
 * Log impersonation denied (authorization failed)
 */
export async function logImpersonationDenied(
  actorId: string,
  targetId: string,
  reason: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logSecurityEvent({
    action: 'impersonation_denied',
    resource_type: 'impersonation',
    resource_id: targetId,
    actor_id: actorId,
    target_id: targetId,
    impersonation_active: false,
    audit_metadata: {
      deny_reason: reason,
      ...metadata,
    },
  });
}

/**
 * Log impersonation invalid cookie
 */
export async function logImpersonationInvalidCookie(
  actorId: string | null,
  error: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logSecurityEvent({
    action: 'impersonation_invalid_cookie',
    resource_type: 'impersonation',
    resource_id: actorId || 'unknown',
    actor_id: actorId || undefined,
    impersonation_active: false,
    audit_metadata: {
      error,
      ...metadata,
    },
  });
}

/**
 * Log impersonation expired
 */
export async function logImpersonationExpired(
  actorId: string,
  targetId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logSecurityEvent({
    action: 'impersonation_expired',
    resource_type: 'impersonation',
    resource_id: targetId,
    actor_id: actorId,
    target_id: targetId,
    impersonation_active: false,
    audit_metadata: metadata,
  });
}

/**
 * Log impersonation target not found
 */
export async function logImpersonationTargetNotFound(
  actorId: string,
  targetId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logSecurityEvent({
    action: 'impersonation_target_not_found',
    resource_type: 'impersonation',
    resource_id: targetId,
    actor_id: actorId,
    target_id: targetId,
    impersonation_active: false,
    audit_metadata: metadata,
  });
}

/**
 * Log impersonation authorization failed
 */
export async function logImpersonationAuthzFailed(
  actorId: string,
  targetId: string,
  reason: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logSecurityEvent({
    action: 'impersonation_authz_failed',
    resource_type: 'impersonation',
    resource_id: targetId,
    actor_id: actorId,
    target_id: targetId,
    impersonation_active: false,
    audit_metadata: {
      authz_failure_reason: reason,
      ...metadata,
    },
  });
}

/**
 * Log SuperAdmin wallet bypass (P0 AUDIT FIX)
 *
 * Traccia ogni utilizzo del bypass wallet SuperAdmin.
 * CRITICAL: Questo evento deve triggerare alerting real-time in produzione.
 *
 * @param actorId - SuperAdmin che esegue bypass
 * @param targetId - User target (può essere stesso SuperAdmin o impersonation)
 * @param amount - Importo operazione che bypasserebbe wallet check
 * @param currentBalance - Balance corrente user
 * @param metadata - Metadata aggiuntivi (impersonation, reason, etc.)
 */
export async function logSuperAdminWalletBypass(
  actorId: string,
  targetId: string,
  amount: number,
  currentBalance: number,
  metadata?: Record<string, any>
): Promise<void> {
  await logSecurityEvent({
    action: 'superadmin_wallet_bypass',
    resource_type: 'wallet',
    resource_id: targetId,
    actor_id: actorId,
    target_id: targetId,
    impersonation_active: metadata?.impersonating || false,
    audit_metadata: {
      amount,
      currentBalance,
      deficit: currentBalance < amount ? amount - currentBalance : 0,
      severity: 'CRITICAL', // P0: Alerting trigger
      requires_review: true,
      ...metadata,
    },
  });
}
