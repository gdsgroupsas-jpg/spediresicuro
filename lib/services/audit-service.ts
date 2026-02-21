/**
 * Audit Trail Service - M4 Business Dashboards
 *
 * Centralized service for logging all business events with consistent format.
 * Integrates with existing audit_logs table from M3.
 */

import { createClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

// Audit action constants - standardized event names
export const AUDIT_ACTIONS = {
  // Shipment events
  SHIPMENT_CREATED: 'shipment.created',
  SHIPMENT_STATUS_CHANGED: 'shipment.status_changed',
  SHIPMENT_CANCELLED: 'shipment.cancelled',
  SHIPMENT_DELETED: 'shipment.deleted',
  SHIPMENT_LABEL_GENERATED: 'shipment.label_generated',
  SHIPMENT_TRACKING_UPDATED: 'shipment.tracking_updated',

  // User events
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_LOGIN_FAILED: 'user.login_failed',
  USER_LOGOUT: 'user.logout',
  USER_PROFILE_UPDATED: 'user.profile_updated',
  USER_ROLE_CHANGED: 'user.role_changed',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_PASSWORD_RESET_REQUESTED: 'user.password_reset_requested',
  USER_DEACTIVATED: 'user.deactivated',
  USER_REACTIVATED: 'user.reactivated',

  // Financial/Wallet events
  WALLET_TOPUP_REQUESTED: 'wallet.topup_requested',
  WALLET_TOPUP_APPROVED: 'wallet.topup_approved',
  WALLET_TOPUP_REJECTED: 'wallet.topup_rejected',
  WALLET_CHARGED: 'wallet.charged',
  WALLET_REFUNDED: 'wallet.refunded',
  WALLET_ADJUSTED: 'wallet.adjusted',
  WALLET_CREDIT_ADDED: 'wallet.credit_added',

  // Admin events
  ADMIN_IMPERSONATION_STARTED: 'admin.impersonation_started',
  ADMIN_IMPERSONATION_ENDED: 'admin.impersonation_ended',
  ADMIN_USER_CREATED: 'admin.user_created',
  ADMIN_FEE_CHANGED: 'admin.fee_changed',
  ADMIN_SETTINGS_CHANGED: 'admin.settings_changed',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// Resource types for categorization
export type ResourceType = 'shipment' | 'user' | 'wallet' | 'topup' | 'admin' | 'system';

// Audit event interface
export interface AuditEvent {
  action: AuditAction;
  resource_type: ResourceType;
  resource_id: string;
  actor_id: string;
  actor_email?: string;
  target_id?: string; // For impersonation or actions on other users
  impersonation_active?: boolean;
  metadata?: Record<string, unknown>;
  ip_address?: string;
}

// Audit log record as stored in DB
export interface AuditLogRecord {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  actor_id: string | null;
  target_id: string | null;
  user_id: string | null; // Legacy compatibility
  user_email: string | null;
  impersonation_active: boolean;
  audit_metadata: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Shipment-specific metadata
export interface ShipmentAuditMetadata {
  tracking_number?: string;
  courier?: string;
  old_status?: string;
  new_status?: string;
  cost?: number;
  final_price?: number;
  recipient_city?: string;
  recipient_zip?: string;
  cancellation_reason?: string;
  deletion_reason?: string;
}

// User-specific metadata
export interface UserAuditMetadata {
  email?: string;
  old_role?: string;
  new_role?: string;
  changed_fields?: string[];
  registration_source?: string;
  login_method?: string;
  failure_reason?: string;
}

// Wallet-specific metadata
export interface WalletAuditMetadata {
  amount: number;
  balance_before?: number;
  balance_after?: number;
  transaction_type?: string;
  reference_id?: string;
  description?: string;
  topup_id?: string;
  approved_by?: string;
  rejection_reason?: string;
}

// Create supabase admin client for audit logging
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials for audit logging');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

/**
 * Hash IP address for privacy (GDPR compliance)
 */
function hashIpAddress(ip: string): string {
  // Simple hash - in production, use crypto
  const hash = ip.split('').reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);
  return `ip_${Math.abs(hash).toString(16)}`;
}

/**
 * Log an audit event to the database
 */
export async function logAuditEvent(
  event: AuditEvent,
  requestId?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const logger = createLogger(requestId || 'audit-service');

  try {
    const supabase = getSupabaseAdmin();

    // Prepare audit metadata (separate from general metadata for queries)
    const auditMetadata: Record<string, unknown> = {
      ip_hash: event.ip_address ? hashIpAddress(event.ip_address) : undefined,
      timestamp: new Date().toISOString(),
      request_id: requestId,
    };

    // Insert audit log
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        action: event.action,
        resource_type: event.resource_type,
        resource_id: event.resource_id,
        actor_id: event.actor_id,
        target_id: event.target_id || event.actor_id,
        user_id: event.target_id || event.actor_id, // Legacy compatibility
        user_email: event.actor_email,
        impersonation_active: event.impersonation_active || false,
        metadata: {
          ...(event.metadata || {}),
          ...auditMetadata,
        },
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to log audit event', {
        action: event.action,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    logger.info('Audit event logged', {
      action: event.action,
      resource_type: event.resource_type,
      resource_id: event.resource_id,
      audit_id: data?.id,
    });

    return { success: true, id: data?.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Audit logging exception', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

// ============================================================
// Convenience functions for common audit events
// ============================================================

/**
 * Log shipment creation
 */
export async function auditShipmentCreated(
  actorId: string,
  shipmentId: string,
  metadata: ShipmentAuditMetadata,
  options?: { ipAddress?: string; requestId?: string }
): Promise<void> {
  await logAuditEvent(
    {
      action: AUDIT_ACTIONS.SHIPMENT_CREATED,
      resource_type: 'shipment',
      resource_id: shipmentId,
      actor_id: actorId,
      metadata: metadata as Record<string, unknown>,
      ip_address: options?.ipAddress,
    },
    options?.requestId
  );
}

/**
 * Log shipment status change
 */
export async function auditShipmentStatusChanged(
  actorId: string,
  shipmentId: string,
  oldStatus: string,
  newStatus: string,
  metadata?: Partial<ShipmentAuditMetadata>,
  options?: { ipAddress?: string; requestId?: string }
): Promise<void> {
  await logAuditEvent(
    {
      action: AUDIT_ACTIONS.SHIPMENT_STATUS_CHANGED,
      resource_type: 'shipment',
      resource_id: shipmentId,
      actor_id: actorId,
      metadata: {
        old_status: oldStatus,
        new_status: newStatus,
        ...metadata,
      },
      ip_address: options?.ipAddress,
    },
    options?.requestId
  );
}

/**
 * Log shipment cancellation
 */
export async function auditShipmentCancelled(
  actorId: string,
  shipmentId: string,
  reason: string,
  metadata?: Partial<ShipmentAuditMetadata>,
  options?: { ipAddress?: string; requestId?: string }
): Promise<void> {
  await logAuditEvent(
    {
      action: AUDIT_ACTIONS.SHIPMENT_CANCELLED,
      resource_type: 'shipment',
      resource_id: shipmentId,
      actor_id: actorId,
      metadata: {
        cancellation_reason: reason,
        ...metadata,
      },
      ip_address: options?.ipAddress,
    },
    options?.requestId
  );
}

/**
 * Log user registration
 */
export async function auditUserRegistered(
  userId: string,
  email: string,
  metadata?: Partial<UserAuditMetadata>,
  options?: { ipAddress?: string; requestId?: string }
): Promise<void> {
  await logAuditEvent(
    {
      action: AUDIT_ACTIONS.USER_REGISTERED,
      resource_type: 'user',
      resource_id: userId,
      actor_id: userId,
      actor_email: email,
      metadata: {
        email,
        ...metadata,
      },
      ip_address: options?.ipAddress,
    },
    options?.requestId
  );
}

/**
 * Log user login
 */
export async function auditUserLogin(
  userId: string,
  email: string,
  success: boolean,
  metadata?: Partial<UserAuditMetadata>,
  options?: { ipAddress?: string; requestId?: string }
): Promise<void> {
  await logAuditEvent(
    {
      action: success ? AUDIT_ACTIONS.USER_LOGIN : AUDIT_ACTIONS.USER_LOGIN_FAILED,
      resource_type: 'user',
      resource_id: userId,
      actor_id: userId,
      actor_email: email,
      metadata: {
        email,
        login_method: metadata?.login_method || 'email',
        ...metadata,
      },
      ip_address: options?.ipAddress,
    },
    options?.requestId
  );
}

/**
 * Log user profile update
 */
export async function auditUserProfileUpdated(
  actorId: string,
  targetUserId: string,
  changedFields: string[],
  metadata?: Partial<UserAuditMetadata>,
  options?: {
    ipAddress?: string;
    requestId?: string;
    impersonationActive?: boolean;
  }
): Promise<void> {
  await logAuditEvent(
    {
      action: AUDIT_ACTIONS.USER_PROFILE_UPDATED,
      resource_type: 'user',
      resource_id: targetUserId,
      actor_id: actorId,
      target_id: targetUserId,
      impersonation_active: options?.impersonationActive,
      metadata: {
        changed_fields: changedFields,
        ...metadata,
      },
      ip_address: options?.ipAddress,
    },
    options?.requestId
  );
}

/**
 * Log wallet top-up request
 */
export async function auditWalletTopupRequested(
  userId: string,
  topupId: string,
  amount: number,
  metadata?: Partial<WalletAuditMetadata>,
  options?: { ipAddress?: string; requestId?: string }
): Promise<void> {
  await logAuditEvent(
    {
      action: AUDIT_ACTIONS.WALLET_TOPUP_REQUESTED,
      resource_type: 'topup',
      resource_id: topupId,
      actor_id: userId,
      metadata: {
        amount,
        topup_id: topupId,
        ...metadata,
      },
      ip_address: options?.ipAddress,
    },
    options?.requestId
  );
}

/**
 * Log wallet top-up approval
 */
export async function auditWalletTopupApproved(
  adminId: string,
  userId: string,
  topupId: string,
  amount: number,
  balanceBefore: number,
  balanceAfter: number,
  metadata?: Partial<WalletAuditMetadata>,
  options?: { ipAddress?: string; requestId?: string }
): Promise<void> {
  await logAuditEvent(
    {
      action: AUDIT_ACTIONS.WALLET_TOPUP_APPROVED,
      resource_type: 'topup',
      resource_id: topupId,
      actor_id: adminId,
      target_id: userId,
      metadata: {
        amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        topup_id: topupId,
        approved_by: adminId,
        ...metadata,
      },
      ip_address: options?.ipAddress,
    },
    options?.requestId
  );
}

/**
 * Log wallet top-up rejection
 */
export async function auditWalletTopupRejected(
  adminId: string,
  userId: string,
  topupId: string,
  amount: number,
  reason: string,
  options?: { ipAddress?: string; requestId?: string }
): Promise<void> {
  await logAuditEvent(
    {
      action: AUDIT_ACTIONS.WALLET_TOPUP_REJECTED,
      resource_type: 'topup',
      resource_id: topupId,
      actor_id: adminId,
      target_id: userId,
      metadata: {
        amount,
        topup_id: topupId,
        rejection_reason: reason,
      },
      ip_address: options?.ipAddress,
    },
    options?.requestId
  );
}

/**
 * Log wallet charge (shipment payment)
 */
export async function auditWalletCharged(
  userId: string,
  transactionId: string,
  amount: number,
  balanceBefore: number,
  balanceAfter: number,
  referenceId: string,
  metadata?: Partial<WalletAuditMetadata>,
  options?: { ipAddress?: string; requestId?: string }
): Promise<void> {
  await logAuditEvent(
    {
      action: AUDIT_ACTIONS.WALLET_CHARGED,
      resource_type: 'wallet',
      resource_id: transactionId,
      actor_id: userId,
      metadata: {
        amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference_id: referenceId,
        transaction_type: 'SHIPMENT_CHARGE',
        ...metadata,
      },
      ip_address: options?.ipAddress,
    },
    options?.requestId
  );
}

/**
 * Log wallet refund
 */
export async function auditWalletRefunded(
  adminId: string,
  userId: string,
  transactionId: string,
  amount: number,
  balanceBefore: number,
  balanceAfter: number,
  reason: string,
  options?: { ipAddress?: string; requestId?: string }
): Promise<void> {
  await logAuditEvent(
    {
      action: AUDIT_ACTIONS.WALLET_REFUNDED,
      resource_type: 'wallet',
      resource_id: transactionId,
      actor_id: adminId,
      target_id: userId,
      metadata: {
        amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: reason,
        transaction_type: 'refund',
      },
      ip_address: options?.ipAddress,
    },
    options?.requestId
  );
}

/**
 * Log admin impersonation start
 */
export async function auditImpersonationStarted(
  adminId: string,
  targetUserId: string,
  reason: string,
  options?: { ipAddress?: string; requestId?: string }
): Promise<void> {
  await logAuditEvent(
    {
      action: AUDIT_ACTIONS.ADMIN_IMPERSONATION_STARTED,
      resource_type: 'admin',
      resource_id: targetUserId,
      actor_id: adminId,
      target_id: targetUserId,
      impersonation_active: true,
      metadata: {
        reason,
      },
      ip_address: options?.ipAddress,
    },
    options?.requestId
  );
}

/**
 * Log admin impersonation end
 */
export async function auditImpersonationEnded(
  adminId: string,
  targetUserId: string,
  options?: { ipAddress?: string; requestId?: string }
): Promise<void> {
  await logAuditEvent(
    {
      action: AUDIT_ACTIONS.ADMIN_IMPERSONATION_ENDED,
      resource_type: 'admin',
      resource_id: targetUserId,
      actor_id: adminId,
      target_id: targetUserId,
      impersonation_active: false,
      metadata: {},
      ip_address: options?.ipAddress,
    },
    options?.requestId
  );
}

// ============================================================
// Query functions for audit logs
// ============================================================

/**
 * Get audit logs for a specific resource
 */
export async function getAuditLogsForResource(
  resourceType: ResourceType,
  resourceId: string,
  limit = 50
): Promise<AuditLogRecord[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  return data || [];
}

/**
 * Get audit logs for a specific user (as actor)
 */
export async function getAuditLogsByActor(actorId: string, limit = 100): Promise<AuditLogRecord[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('actor_id', actorId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  return data || [];
}

/**
 * Get recent audit logs (for admin dashboard)
 */
export async function getRecentAuditLogs(
  limit = 100,
  actionFilter?: AuditAction[]
): Promise<AuditLogRecord[]> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (actionFilter && actionFilter.length > 0) {
    query = query.in('action', actionFilter);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  return data || [];
}

/**
 * Get audit log counts by action (for metrics)
 */
export async function getAuditLogCounts(
  startDate: Date,
  endDate: Date
): Promise<Record<string, number>> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('audit_logs')
    .select('action')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (error) {
    throw new Error(`Failed to fetch audit log counts: ${error.message}`);
  }

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    counts[row.action] = (counts[row.action] || 0) + 1;
  }

  return counts;
}
