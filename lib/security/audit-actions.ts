/**
 * Audit Actions Taxonomy - Azioni Canoniche per Audit Log
 *
 * Definisce il set completo di azioni tracciabili nel sistema.
 * Ogni azione ha un nome canonico e una descrizione.
 *
 * USAGE:
 * - import { AUDIT_ACTIONS } from '@/lib/security/audit-actions'
 * - writeAuditLog({ action: AUDIT_ACTIONS.CREATE_SHIPMENT, ... })
 */

/**
 * Set completo di azioni audit (canoniche)
 *
 * Naming convention: VERB_NOUN (snake_case)
 */
export const AUDIT_ACTIONS = {
  // ============================================
  // SHIPMENT OPERATIONS
  // ============================================
  CREATE_SHIPMENT: 'create_shipment',
  UPDATE_SHIPMENT: 'update_shipment',
  DELETE_SHIPMENT: 'delete_shipment',
  CANCEL_SHIPMENT: 'cancel_shipment',
  VIEW_SHIPMENT: 'view_shipment',
  DOWNLOAD_LABEL: 'download_label',
  TRACK_SHIPMENT: 'track_shipment',
  SHIPMENT_ADJUSTMENT: 'shipment_adjustment', // Conguaglio peso

  // ============================================
  // WALLET OPERATIONS
  // ============================================
  WALLET_RECHARGE: 'wallet_recharge',
  WALLET_DEBIT: 'wallet_debit',
  WALLET_CREDIT: 'wallet_credit',
  WALLET_ADJUSTMENT: 'wallet_adjustment',
  WALLET_REFUND: 'wallet_refund',
  VIEW_WALLET_BALANCE: 'view_wallet_balance',
  VIEW_WALLET_TRANSACTIONS: 'view_wallet_transactions',
  SUPERADMIN_WALLET_BYPASS: 'superadmin_wallet_bypass', // P0: Audit fix - bypass tracking

  // ============================================
  // IMPERSONATION (ACTING CONTEXT)
  // ============================================
  IMPERSONATION_STARTED: 'impersonation_started',
  IMPERSONATION_ENDED: 'impersonation_ended',
  IMPERSONATION_DENIED: 'impersonation_denied',
  IMPERSONATION_INVALID_COOKIE: 'impersonation_invalid_cookie',
  IMPERSONATION_EXPIRED: 'impersonation_expired',
  IMPERSONATION_TARGET_NOT_FOUND: 'impersonation_target_not_found',
  IMPERSONATION_AUTHZ_FAILED: 'impersonation_authz_failed',

  // ============================================
  // USER OPERATIONS
  // ============================================
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  USER_PASSWORD_CHANGED: 'user_password_changed',
  USER_ROLE_CHANGED: 'user_role_changed',

  // ============================================
  // COURIER CONFIG OPERATIONS
  // ============================================
  COURIER_CONFIG_CREATED: 'courier_config_created',
  COURIER_CONFIG_UPDATED: 'courier_config_updated',
  COURIER_CONFIG_DELETED: 'courier_config_deleted',
  COURIER_CONFIG_ACTIVATED: 'courier_config_activated',
  COURIER_CONFIG_DEACTIVATED: 'courier_config_deactivated',
  COURIER_CREDENTIAL_VIEWED: 'courier_credential_viewed',
  COURIER_CREDENTIAL_DECRYPTED: 'courier_credential_decrypted',

  // ============================================
  // SYSTEM EVENTS
  // ============================================
  SYSTEM_ERROR: 'system_error',
  SYSTEM_MAINTENANCE: 'system_maintenance', // P2: Cleanup automatico (compensation_queue, etc.)
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  SECURITY_VIOLATION: 'security_violation',

  // ============================================
  // COD (CONTRASSEGNI) OPERATIONS
  // ============================================
  COD_FILE_UPLOADED: 'cod_file_uploaded',
  COD_DISTINTA_CREATED: 'cod_distinta_created',
  COD_DISTINTA_PAID: 'cod_distinta_paid',
  COD_DISTINTA_DELETED: 'cod_distinta_deleted',

  // ============================================
  // AI AGENT OPERATIONS
  // ============================================
  AGENT_QUERY: 'agent_query',
  AGENT_MENTOR_RESPONSE: 'agent_mentor_response',
  AGENT_SESSION_CREATED: 'agent_session_created',
  AGENT_SESSION_UPDATED: 'agent_session_updated',
} as const;

/**
 * Type per azioni audit (type-safe)
 */
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * Resource types per audit log
 */
export const AUDIT_RESOURCE_TYPES = {
  SHIPMENT: 'shipment',
  COMPENSATION_QUEUE: 'compensation_queue', // P2: Compensation queue records
  WALLET: 'wallet',
  WALLET_TRANSACTION: 'wallet_transaction',
  IMPERSONATION: 'impersonation',
  USER: 'user',
  COURIER_CONFIG: 'courier_config',
  SECURITY_EVENT: 'security_event',
  SYSTEM: 'system',
  AGENT_SESSION: 'agent_session',
  COD_FILE: 'cod_file',
  COD_DISTINTA: 'cod_distinta',
} as const;

/**
 * Type per resource types (type-safe)
 */
export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[keyof typeof AUDIT_RESOURCE_TYPES];

/**
 * Metadata standard per audit log
 *
 * Campi comuni che DOVREBBERO essere presenti in ogni log:
 * - reason: motivo dell'azione (opzionale)
 * - ip: IP address del client
 * - userAgent: User agent del client
 * - requestId: Request ID per correlazione
 * - impersonationActive: Flag se impersonation è attiva
 */
export interface AuditMetadataStandard {
  reason?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  impersonationActive?: boolean;
  [key: string]: any; // Altri campi custom
}

/**
 * Helper: verifica se un'azione è valida (canonizzata)
 */
export function isValidAuditAction(action: string): action is AuditAction {
  return Object.values(AUDIT_ACTIONS).includes(action as AuditAction);
}

/**
 * Helper: verifica se un resource type è valido (canonizzato)
 */
export function isValidResourceType(resourceType: string): resourceType is AuditResourceType {
  return Object.values(AUDIT_RESOURCE_TYPES).includes(resourceType as AuditResourceType);
}
