/**
 * Capability Helpers
 *
 * Utility per verificare capability granulari con fallback a role/account_type
 * Non breaking: mantiene compatibilità con sistema esistente
 */

import { supabaseAdmin } from '@/lib/db/client';

/**
 * Verifica se un utente ha una capability attiva
 * 
 * Fallback strategy:
 * 1. Verifica capability in account_capabilities
 * 2. Se non trovata, usa fallback a role/account_type
 * 
 * @param userId - ID utente
 * @param capabilityName - Nome capability (es: 'can_manage_pricing')
 * @param fallbackUser - Dati utente per fallback (opzionale, evita query extra)
 * @returns true se capability attiva, false altrimenti
 * 
 * @example
 * const hasPricing = await hasCapability(userId, 'can_manage_pricing');
 * if (hasPricing) {
 *   // Permesso concesso
 * }
 */
export async function hasCapability(
  userId: string,
  capabilityName: string,
  fallbackUser?: {
    role?: string;
    account_type?: string;
    is_reseller?: boolean;
  }
): Promise<boolean> {
  try {
    // 1. Verifica capability in database
    const { data: capability, error } = await supabaseAdmin
      .rpc('has_capability', {
        p_user_id: userId,
        p_capability_name: capabilityName,
      });

    if (error) {
      console.warn(`⚠️ [CAPABILITY] Errore verifica capability ${capabilityName}:`, error);
      // Continua con fallback
    } else if (capability === true) {
      return true;
    }

    // 2. Fallback: usa role/account_type se capability non trovata
    return hasCapabilityFallback(capabilityName, fallbackUser);
  } catch (error: any) {
    console.warn(`⚠️ [CAPABILITY] Errore hasCapability:`, error.message);
    // Fallback in caso di errore
    return hasCapabilityFallback(capabilityName, fallbackUser);
  }
}

/**
 * Fallback: verifica capability basandosi su role/account_type
 * 
 * Mapping capability → role/account_type:
 * - can_manage_pricing → admin, superadmin
 * - can_create_subusers → reseller, admin, superadmin
 * - can_access_api → byoc, admin, superadmin
 * - can_manage_wallet → admin, superadmin
 * - can_view_all_clients → admin, superadmin
 * - can_manage_resellers → superadmin
 * - can_bypass_rls → superadmin
 * 
 * @param capabilityName - Nome capability
 * @param user - Dati utente per fallback
 * @returns true se capability concessa via fallback
 */
export function hasCapabilityFallback(
  capabilityName: string,
  user?: {
    role?: string;
    account_type?: string;
    is_reseller?: boolean;
  }
): boolean {
  if (!user) {
    return false;
  }

  const { role, account_type, is_reseller } = user;

  // Mapping capability → role/account_type
  switch (capabilityName) {
    case 'can_manage_pricing':
      return (
        account_type === 'admin' ||
        account_type === 'superadmin' ||
        role === 'admin' ||
        role === 'superadmin'
      );

    case 'can_create_subusers':
      return (
        is_reseller === true ||
        account_type === 'admin' ||
        account_type === 'superadmin' ||
        role === 'admin' ||
        role === 'superadmin'
      );

    case 'can_access_api':
      return (
        account_type === 'byoc' ||
        account_type === 'admin' ||
        account_type === 'superadmin'
      );

    case 'can_manage_wallet':
      return (
        account_type === 'admin' ||
        account_type === 'superadmin' ||
        role === 'admin' ||
        role === 'superadmin'
      );

    case 'can_view_all_clients':
      return (
        account_type === 'admin' ||
        account_type === 'superadmin' ||
        role === 'admin' ||
        role === 'superadmin'
      );

    case 'can_manage_resellers':
      return account_type === 'superadmin';

    case 'can_bypass_rls':
      return account_type === 'superadmin';

    default:
      // Capability sconosciuta: negato per sicurezza
      return false;
  }
}

/**
 * Verifica se un utente ha una capability (versione con query utente automatica)
 * 
 * Utile quando non hai già i dati utente in memoria
 * 
 * @param userId - ID utente
 * @param capabilityName - Nome capability
 * @returns true se capability attiva, false altrimenti
 */
export async function hasCapabilityWithUserQuery(
  userId: string,
  capabilityName: string
): Promise<boolean> {
  try {
    // Recupera dati utente per fallback
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('role, account_type, is_reseller')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.warn(`⚠️ [CAPABILITY] Utente non trovato:`, userError);
      return false;
    }

    // Usa funzione principale con fallback user
    return hasCapability(userId, capabilityName, user);
  } catch (error: any) {
    console.warn(`⚠️ [CAPABILITY] Errore hasCapabilityWithUserQuery:`, error.message);
    return false;
  }
}

/**
 * Recupera tutte le capability attive di un utente
 * 
 * @param userId - ID utente
 * @returns Array di nomi capability attive
 */
export async function getUserCapabilities(userId: string): Promise<string[]> {
  try {
    const { data: capabilities, error } = await supabaseAdmin
      .from('account_capabilities')
      .select('capability_name')
      .eq('user_id', userId)
      .is('revoked_at', null);

    if (error || !capabilities) {
      console.warn(`⚠️ [CAPABILITY] Errore recupero capability:`, error);
      return [];
    }

    return capabilities.map((c) => c.capability_name);
  } catch (error: any) {
    console.warn(`⚠️ [CAPABILITY] Errore getUserCapabilities:`, error.message);
    return [];
  }
}
