/**
 * Audit Log - Logger Unificato per Acting Context
 * 
 * CRITICAL: Questo è il logger UNICO per tutte le operazioni audit.
 * Supporta Acting Context (impersonation) e traccia actor + target.
 * 
 * USAGE:
 * ```typescript
 * import { writeAuditLog } from '@/lib/security/audit-log';
 * import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '@/lib/security/audit-actions';
 * 
 * await writeAuditLog({
 *   context,  // ActingContext da requireSafeAuth()
 *   action: AUDIT_ACTIONS.CREATE_SHIPMENT,
 *   resourceType: AUDIT_RESOURCE_TYPES.SHIPMENT,
 *   resourceId: shipment.id,
 *   metadata: { carrier, cost }
 * });
 * ```
 * 
 * ARCHITECTURAL RULES:
 * 1. Sempre passare ActingContext (da getSafeAuth/requireSafeAuth)
 * 2. Usa azioni canoniche da AUDIT_ACTIONS (no stringhe custom)
 * 3. Metadata deve includere campi standard (reason, ip, requestId)
 * 4. NON bloccare operazione se log fallisce (fail-open sul logging)
 */

import { supabaseAdmin } from '@/lib/db/client';
import type { ActingContext } from '@/lib/safe-auth';
import type { AuditAction, AuditResourceType, AuditMetadataStandard } from './audit-actions';

/**
 * Payload per writeAuditLog
 */
export interface AuditLogPayload {
  /**
   * Acting Context (da requireSafeAuth)
   * Obbligatorio per tracciare actor + target
   */
  context: ActingContext;
  
  /**
   * Azione canonica (da AUDIT_ACTIONS)
   */
  action: AuditAction | string;
  
  /**
   * Tipo risorsa (da AUDIT_RESOURCE_TYPES)
   */
  resourceType: AuditResourceType | string;
  
  /**
   * ID risorsa (es. shipment.id, user.id)
   */
  resourceId: string;
  
  /**
   * Metadata custom (estende AuditMetadataStandard)
   */
  metadata?: AuditMetadataStandard;
}

/**
 * Write Audit Log - Logger Unificato
 * 
 * Scrive un log audit con Acting Context completo:
 * - actor_id: chi ESEGUE l'azione (SuperAdmin se impersonation)
 * - target_id: per CHI viene eseguita (cliente)
 * - impersonation_active: flag se impersonation attiva
 * - audit_metadata: metadata standard + custom
 * 
 * @param payload - AuditLogPayload completo
 * @returns Promise<void> (non blocca mai, fail-open)
 */
export async function writeAuditLog(payload: AuditLogPayload): Promise<void> {
  try {
    const { context, action, resourceType, resourceId, metadata = {} } = payload;
    
    // 1. Estrai actor + target da context
    const actorId = context.actor.id;
    const targetId = context.target.id;
    const impersonationActive = context.isImpersonating;
    
    // 2. Prepara metadata standard
    const auditMetadata: AuditMetadataStandard = {
      ...metadata,
      actor_email: context.actor.email,
      target_email: context.target.email,
      impersonationActive,
      reason: context.metadata?.reason || metadata.reason,
      requestId: context.metadata?.requestId || metadata.requestId,
    };
    
    // 3. Prepara payload per insert
    const logEntry = {
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      
      // Actor/Target (impersonation-aware)
      actor_id: actorId,
      target_id: targetId,
      impersonation_active: impersonationActive,
      
      // Legacy compatibility (user_id = target_id per backward compat)
      user_id: targetId,
      user_email: context.target.email,
      
      // Metadata
      audit_metadata: auditMetadata,
      
      // Timestamp
      created_at: new Date().toISOString(),
    };
    
    // 4. Usa SQL function se disponibile (fallback a insert)
    try {
      const { error: rpcError } = await supabaseAdmin.rpc('log_acting_context_audit', {
        p_action: action,
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_actor_id: actorId,
        p_target_id: targetId,
        p_impersonation_active: impersonationActive,
        p_audit_metadata: auditMetadata,
      });
      
      if (rpcError) {
        // Fallback: insert diretto
        console.warn('⚠️ [AUDIT] RPC fallback to direct insert:', rpcError.message);
        const { error: insertError } = await supabaseAdmin
          .from('audit_logs')
          .insert([logEntry]);
        
        if (insertError) {
          throw insertError;
        }
      }
    } catch (rpcError) {
      // RPC non disponibile: fallback a insert
      const { error: insertError } = await supabaseAdmin
        .from('audit_logs')
        .insert([logEntry]);
      
      if (insertError) {
        throw insertError;
      }
    }
    
    // 5. Success log (console)
    console.log('✅ [AUDIT]', {
      action,
      actor: `${context.actor.email} (${actorId.substring(0, 8)}...)`,
      target: impersonationActive 
        ? `${context.target.email} (${targetId.substring(0, 8)}...)` 
        : 'self',
      resource: `${resourceType}:${resourceId.substring(0, 8)}...`,
      impersonating: impersonationActive,
    });
  } catch (error: any) {
    // FAIL-OPEN: non bloccare operazione se log fallisce
    console.error('❌ [AUDIT] Logging failed (fail-open):', error.message);
    console.log('📋 [AUDIT] (fallback console)', JSON.stringify(payload, null, 2));
  }
}

/**
 * Helper: Write audit log per wallet operations
 * 
 * Shortcut per operazioni wallet (common case)
 */
export async function writeWalletAuditLog(
  context: ActingContext,
  action: AuditAction | string,
  amount: number,
  transactionId: string,
  additionalMetadata?: Record<string, any>
): Promise<void> {
  await writeAuditLog({
    context,
    action,
    resourceType: 'wallet',
    resourceId: context.target.id,
    metadata: {
      amount,
      transaction_id: transactionId,
      ...additionalMetadata,
    },
  });
}

/**
 * Helper: Write audit log per shipment operations
 * 
 * Shortcut per operazioni shipment (common case)
 */
export async function writeShipmentAuditLog(
  context: ActingContext,
  action: AuditAction | string,
  shipmentId: string,
  additionalMetadata?: Record<string, any>
): Promise<void> {
  await writeAuditLog({
    context,
    action,
    resourceType: 'shipment',
    resourceId: shipmentId,
    metadata: additionalMetadata,
  });
}
