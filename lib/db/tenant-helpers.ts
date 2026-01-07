/**
 * Tenant Helpers
 *
 * Utility per gestire tenant_id con fallback a parent_id/user_id
 * Non breaking: mantiene compatibilità con sistema esistente
 */

import { supabaseAdmin } from '@/lib/db/client';

/**
 * Recupera tenant_id di un utente con fallback automatico
 * 
 * Fallback strategy:
 * 1. Se tenant_id è popolato → usa tenant_id
 * 2. Se tenant_id è NULL e parent_id esiste → usa parent_id
 * 3. Altrimenti → usa user_id (self-tenant)
 * 
 * @param userId - ID utente
 * @param fallbackUser - Dati utente per fallback (opzionale, evita query extra)
 * @returns tenant_id o fallback (parent_id o user_id)
 * 
 * @example
 * const tenantId = await getUserTenant(userId);
 * // Query utenti dello stesso tenant
 * const users = await getUsersByTenant(tenantId);
 */
export async function getUserTenant(
  userId: string,
  fallbackUser?: {
    parent_id?: string | null;
    tenant_id?: string | null;
  }
): Promise<string> {
  try {
    // Se abbiamo già i dati utente, usa quelli
    if (fallbackUser) {
      // 1. Se tenant_id è popolato, usa quello
      if (fallbackUser.tenant_id) {
        return fallbackUser.tenant_id;
      }
      
      // 2. Fallback: usa parent_id se esiste
      if (fallbackUser.parent_id) {
        return fallbackUser.parent_id;
      }
      
      // 3. Fallback: usa user_id (self-tenant)
      return userId;
    }

    // Altrimenti, usa funzione database
    const { data: tenantId, error } = await supabaseAdmin
      .rpc('get_user_tenant', {
        p_user_id: userId,
      });

    if (error) {
      console.warn(`⚠️ [TENANT] Errore get_user_tenant:`, error);
      // Fallback: usa user_id (self-tenant)
      return userId;
    }

    return tenantId || userId;
  } catch (error: any) {
    console.warn(`⚠️ [TENANT] Errore getUserTenant:`, error.message);
    // Fallback: usa user_id (self-tenant)
    return userId;
  }
}

/**
 * Recupera tenant_id di un utente (versione con query utente automatica)
 * 
 * Utile quando non hai già i dati utente in memoria
 * 
 * @param userId - ID utente
 * @returns tenant_id o fallback
 */
export async function getUserTenantWithQuery(userId: string): Promise<string> {
  try {
    // Recupera dati utente per fallback
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('tenant_id, parent_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.warn(`⚠️ [TENANT] Utente non trovato:`, userError);
      // Fallback: usa user_id (self-tenant)
      return userId;
    }

    // Usa funzione principale con fallback user
    return getUserTenant(userId, {
      tenant_id: user.tenant_id,
      parent_id: user.parent_id,
    });
  } catch (error: any) {
    console.warn(`⚠️ [TENANT] Errore getUserTenantWithQuery:`, error.message);
    return userId;
  }
}

/**
 * Verifica se due utenti appartengono allo stesso tenant
 * 
 * @param userId1 - ID primo utente
 * @param userId2 - ID secondo utente
 * @returns true se stesso tenant, false altrimenti
 */
export async function isSameTenant(
  userId1: string,
  userId2: string
): Promise<boolean> {
  try {
    const tenant1 = await getUserTenant(userId1);
    const tenant2 = await getUserTenant(userId2);
    return tenant1 === tenant2;
  } catch (error: any) {
    console.warn(`⚠️ [TENANT] Errore isSameTenant:`, error.message);
    return false;
  }
}

/**
 * Recupera tutti gli utenti di un tenant
 * 
 * @param tenantId - ID tenant
 * @returns Array di ID utenti del tenant
 */
export async function getUsersByTenant(tenantId: string): Promise<string[]> {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .or(`tenant_id.eq.${tenantId},id.eq.${tenantId}`);

    if (error || !users) {
      console.warn(`⚠️ [TENANT] Errore getUsersByTenant:`, error);
      return [];
    }

    return users.map((u) => u.id);
  } catch (error: any) {
    console.warn(`⚠️ [TENANT] Errore getUsersByTenant:`, error.message);
    return [];
  }
}
