/**
 * RBAC (Role-Based Access Control) Helper
 *
 * Centralized role and permission management for SpedireSicuro.
 *
 * Roles hierarchy:
 * - superadmin: Full system access
 * - admin: Administrative access
 * - reseller: Reseller account with sub-users
 * - user: Standard user access
 */

import { Session } from 'next-auth';

/**
 * Application roles
 */
export type UserRole = 'user' | 'admin' | 'reseller' | 'superadmin';

/**
 * Account types (extended role info)
 */
export type AccountType = 'user' | 'admin' | 'reseller' | 'superadmin';

/**
 * Permission levels for fine-grained access control
 */
export type Permission =
  | 'view_dashboard'
  | 'create_shipment'
  | 'view_shipments'
  | 'manage_users'
  | 'manage_integrations'
  | 'view_analytics'
  | 'manage_wallet'
  | 'manage_platform'
  | 'view_audit_logs';

/**
 * Role-to-permissions mapping
 * Define what each role can do
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: ['view_dashboard', 'create_shipment', 'view_shipments', 'view_analytics'],
  reseller: [
    'view_dashboard',
    'create_shipment',
    'view_shipments',
    'manage_users', // Can manage sub-users
    'manage_integrations',
    'view_analytics',
    'manage_wallet',
  ],
  admin: [
    'view_dashboard',
    'create_shipment',
    'view_shipments',
    'manage_users',
    'manage_integrations',
    'view_analytics',
    'manage_wallet',
    'view_audit_logs',
  ],
  superadmin: [
    'view_dashboard',
    'create_shipment',
    'view_shipments',
    'manage_users',
    'manage_integrations',
    'view_analytics',
    'manage_wallet',
    'manage_platform',
    'view_audit_logs',
  ],
};

/**
 * Check if user has specific role
 *
 * @param session - NextAuth session
 * @param role - Role to check
 * @returns true if user has role
 */
export function hasRole(session: Session | null, role: UserRole): boolean {
  if (!session?.user) return false;

  const userRole = (session.user as any).role as UserRole | undefined;
  if (!userRole) return false;

  return userRole === role;
}

/**
 * Check if user has ANY of the specified roles
 *
 * @param session - NextAuth session
 * @param roles - Array of roles to check
 * @returns true if user has any of the roles
 */
export function hasAnyRole(session: Session | null, roles: UserRole[]): boolean {
  if (!session?.user) return false;

  const userRole = (session.user as any).role as UserRole | undefined;
  if (!userRole) return false;

  return roles.includes(userRole);
}

/**
 * Check if user has specific permission
 *
 * @param session - NextAuth session
 * @param permission - Permission to check
 * @returns true if user has permission
 */
export function hasPermission(session: Session | null, permission: Permission): boolean {
  if (!session?.user) return false;

  const userRole = (session.user as any).role as UserRole | undefined;
  if (!userRole) return false;

  const permissions = ROLE_PERMISSIONS[userRole];
  return permissions.includes(permission);
}

/**
 * Check if user is admin (admin or superadmin)
 *
 * @param session - NextAuth session
 * @returns true if user is admin
 */
export function isAdmin(session: Session | null): boolean {
  return hasAnyRole(session, ['admin', 'superadmin']);
}

/**
 * Check if user is superadmin
 *
 * @param session - NextAuth session
 * @returns true if user is superadmin
 */
export function isSuperAdmin(session: Session | null): boolean {
  return hasRole(session, 'superadmin');
}

/**
 * Check if user is reseller
 *
 * @param session - NextAuth session
 * @returns true if user is reseller
 */
export function isReseller(session: Session | null): boolean {
  if (!session?.user) return false;

  // Check both role and is_reseller flag
  const userRole = (session.user as any).role as UserRole | undefined;
  const isResellerFlag = (session.user as any).is_reseller;

  return userRole === 'reseller' || isResellerFlag === true;
}

/**
 * Get user's role from session
 *
 * @param session - NextAuth session
 * @returns User role or null
 */
export function getUserRole(session: Session | null): UserRole | null {
  if (!session?.user) return null;

  return ((session.user as any).role as UserRole) || 'user';
}

/**
 * Get all permissions for user's role
 *
 * @param session - NextAuth session
 * @returns Array of permissions
 */
export function getUserPermissions(session: Session | null): Permission[] {
  const role = getUserRole(session);
  if (!role) return [];

  return ROLE_PERMISSIONS[role];
}

/**
 * Require specific role (throw error if not authorized)
 * Use in API routes for access control
 *
 * @param session - NextAuth session
 * @param requiredRole - Required role
 * @throws Error if unauthorized
 */
export function requireRole(session: Session | null, requiredRole: UserRole): void {
  if (!hasRole(session, requiredRole)) {
    throw new Error(`Forbidden: ${requiredRole} role required`);
  }
}

/**
 * Require ANY of specified roles (throw error if not authorized)
 *
 * @param session - NextAuth session
 * @param requiredRoles - Array of acceptable roles
 * @throws Error if unauthorized
 */
export function requireAnyRole(session: Session | null, requiredRoles: UserRole[]): void {
  if (!hasAnyRole(session, requiredRoles)) {
    throw new Error(`Forbidden: One of [${requiredRoles.join(', ')}] role required`);
  }
}

/**
 * Require specific permission (throw error if not authorized)
 *
 * @param session - NextAuth session
 * @param requiredPermission - Required permission
 * @throws Error if unauthorized
 */
export function requirePermission(session: Session | null, requiredPermission: Permission): void {
  if (!hasPermission(session, requiredPermission)) {
    throw new Error(`Forbidden: ${requiredPermission} permission required`);
  }
}

/**
 * Require admin role (admin or superadmin)
 *
 * @param session - NextAuth session
 * @throws Error if not admin
 */
export function requireAdmin(session: Session | null): void {
  if (!isAdmin(session)) {
    throw new Error('Forbidden: Admin access required');
  }
}

/**
 * Require superadmin role
 *
 * @param session - NextAuth session
 * @throws Error if not superadmin
 */
export function requireSuperAdmin(session: Session | null): void {
  if (!isSuperAdmin(session)) {
    throw new Error('Forbidden: Superadmin access required');
  }
}
