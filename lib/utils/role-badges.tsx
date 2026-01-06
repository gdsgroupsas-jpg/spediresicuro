/**
 * Utility per badge ruoli con colori distintivi
 * 
 * Ogni ruolo ha un colore unico e riconoscibile:
 * - Super Admin: Rosso/Arancione (error)
 * - Admin: Viola/Amber (warning)
 * - Reseller: Verde/Teal (success)
 * - BYOC: Blu (blue)
 * - User: Grigio (secondary)
 */

'use client';

import { Badge } from '@/components/ui/badge';

export interface RoleBadgeProps {
  accountType?: string | null;
  isReseller?: boolean;
  role?: string | null;
  className?: string;
}

/**
 * Ottiene le classi CSS per il badge ruolo (per span personalizzati)
 */
export function getRoleBadgeClasses(
  accountType?: string | null,
  isReseller?: boolean,
  role?: string | null
): string {
  const type = accountType || role || 'user';
  const isResellerType = isReseller === true || type === 'reseller';

  // Super Admin: Rosso/Arancione
  if (type === 'superadmin') {
    return 'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 border border-red-200';
  }

  // Admin: Viola/Amber
  if (type === 'admin') {
    return 'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200';
  }

  // Reseller: Verde/Teal
  if (isResellerType || type === 'reseller') {
    return 'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-teal-100 text-teal-800 border border-teal-200';
  }

  // BYOC: Blu
  if (type === 'byoc') {
    return 'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200';
  }

  // User: Grigio (default)
  return 'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 border border-gray-200';
}

/**
 * Ottiene il testo del ruolo da mostrare
 */
export function getRoleLabel(
  accountType?: string | null,
  isReseller?: boolean,
  role?: string | null
): string {
  const type = accountType || role || 'user';
  const isResellerType = isReseller === true || type === 'reseller';

  if (type === 'superadmin') {
    return 'Super Admin';
  }

  if (type === 'admin') {
    return 'Admin';
  }

  if (isResellerType || type === 'reseller') {
    return 'Reseller';
  }

  if (type === 'byoc') {
    return 'BYOC';
  }

  return 'Utente';
}

/**
 * Componente Badge per ruoli (usa il componente Badge UI)
 */
export function RoleBadge({ accountType, isReseller, role, className }: RoleBadgeProps) {
  const type = accountType || role || 'user';
  const isResellerType = isReseller === true || type === 'reseller';
  const label = getRoleLabel(accountType, isReseller, role);

  // Super Admin: Rosso
  if (type === 'superadmin') {
    return (
      <Badge variant="error" className={className}>
        {label}
      </Badge>
    );
  }

  // Admin: Viola/Amber
  if (type === 'admin') {
    return (
      <Badge variant="warning" className={className}>
        {label}
      </Badge>
    );
  }

  // Reseller: Verde/Teal
  if (isResellerType || type === 'reseller') {
    return (
      <Badge variant="success" className={className}>
        {label}
      </Badge>
    );
  }

  // BYOC: Blu
  if (type === 'byoc') {
    return (
      <Badge variant="default" className={`bg-blue-600 text-white border-blue-700 ${className || ''}`}>
        {label}
      </Badge>
    );
  }

  // User: Grigio
  return (
    <Badge variant="secondary" className={className}>
      {label}
    </Badge>
  );
}

/**
 * Badge span personalizzato (per tabelle e liste)
 */
export function RoleBadgeSpan({ accountType, isReseller, role, className }: RoleBadgeProps) {
  const classes = getRoleBadgeClasses(accountType, isReseller, role);
  const label = getRoleLabel(accountType, isReseller, role);

  return (
    <span className={`${classes} ${className || ''}`}>
      {label}
    </span>
  );
}
