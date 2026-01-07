/**
 * Tier Helpers
 * 
 * Funzioni helper per gestire reseller_tier (small, medium, enterprise)
 * Calcolo automatico basato su numero sub-users
 */

import { supabaseAdmin } from '@/lib/db/client'

export type ResellerTier = 'small' | 'medium' | 'enterprise'

export interface TierLimits {
  maxSubUsers: number | null // null = unlimited
  features: string[]
  description: string
}

/**
 * Calcola tier da numero sub-users (pure function)
 */
export function calculateTierFromSubUsers(subUsersCount: number): ResellerTier {
  if (subUsersCount < 10) {
    return 'small'
  } else if (subUsersCount <= 100) {
    return 'medium'
  } else {
    return 'enterprise'
  }
}

/**
 * Recupera limiti per un tier specifico
 */
export function getTierLimits(tier: ResellerTier): TierLimits {
  switch (tier) {
    case 'small':
      return {
        maxSubUsers: 10,
        features: ['base'],
        description: 'Reseller piccolo: max 10 sub-users, base features',
      }
    case 'medium':
      return {
        maxSubUsers: 100,
        features: ['base', 'advanced'],
        description: 'Reseller medio: max 100 sub-users, advanced features',
      }
    case 'enterprise':
      return {
        maxSubUsers: null, // Unlimited
        features: ['base', 'advanced', 'unlimited', 'sla'],
        description: 'Reseller enterprise: unlimited sub-users, all features, SLA dedicato',
      }
    default:
      throw new Error(`Tier non valido: ${tier}`)
  }
}

/**
 * Verifica se un tier ha raggiunto il limite di sub-users
 */
export function isTierAtLimit(tier: ResellerTier, currentSubUsersCount: number): boolean {
  const limits = getTierLimits(tier)
  
  // Enterprise è sempre unlimited
  if (limits.maxSubUsers === null) {
    return false
  }
  
  return currentSubUsersCount >= limits.maxSubUsers
}

/**
 * Recupera tier di un reseller dal database
 * 
 * Se tier è NULL nel database, la funzione DB calcola automaticamente
 * Se fallbackUser è fornito e ha sub-users count, usa quello per performance
 */
export async function getResellerTier(
  userId: string,
  fallbackUser?: { id: string; is_reseller?: boolean; subUsersCount?: number }
): Promise<ResellerTier | null> {
  try {
    // Se fallbackUser ha subUsersCount, calcola direttamente (performance)
    // Questo evita chiamata DB se abbiamo già il count
    if (fallbackUser?.subUsersCount !== undefined && fallbackUser.is_reseller) {
      return calculateTierFromSubUsers(fallbackUser.subUsersCount)
    }

    // Se fallbackUser indica che non è reseller, restituisci null senza chiamare DB
    if (fallbackUser && fallbackUser.is_reseller === false) {
      return null
    }

    // Chiama funzione database
    const { data: tier, error } = await supabaseAdmin.rpc('get_reseller_tier', {
      p_user_id: userId,
    })

    if (error) {
      console.error('Errore get_reseller_tier:', error)
      return null
    }

    return tier as ResellerTier | null
  } catch (error: any) {
    console.error('Errore in getResellerTier:', error)
    return null
  }
}

/**
 * Recupera tier con query sub-users (se non fornito)
 */
export async function getResellerTierWithQuery(userId: string): Promise<ResellerTier | null> {
  try {
    // 1. Verifica se è reseller
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, is_reseller')
      .eq('id', userId)
      .single()

    if (userError || !user || !user.is_reseller) {
      return null
    }

    // 2. Conta sub-users
    const { data: subUsers, error: subUsersError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('parent_id', userId)
      .eq('is_reseller', false)

    if (subUsersError) {
      console.error('Errore conteggio sub-users:', subUsersError)
      return null
    }

    const subUsersCount = subUsers?.length || 0

    // 3. Calcola tier
    return calculateTierFromSubUsers(subUsersCount)
  } catch (error: any) {
    console.error('Errore in getResellerTierWithQuery:', error)
    return null
  }
}

/**
 * Aggiorna tier di un reseller (opzionale, per override manuale)
 */
export async function updateResellerTier(
  userId: string,
  tier: ResellerTier,
  updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verifica che sia reseller
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, is_reseller')
      .eq('id', userId)
      .single()

    if (userError || !user || !user.is_reseller) {
      return {
        success: false,
        error: 'Utente non è un reseller',
      }
    }

    // Aggiorna tier
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ reseller_tier: tier })
      .eq('id', userId)

    if (updateError) {
      console.error('Errore aggiornamento tier:', updateError)
      return {
        success: false,
        error: updateError.message || 'Errore durante aggiornamento tier',
      }
    }

    // Audit log (opzionale)
    try {
      await supabaseAdmin.from('audit_logs').insert({
        action: 'reseller_tier_updated',
        resource_type: 'user',
        resource_id: userId,
        user_email: updatedBy,
        user_id: updatedBy,
        metadata: {
          new_tier: tier,
          updated_by: updatedBy,
        },
      })
    } catch (auditError) {
      console.warn('Errore audit log:', auditError)
      // Non bloccante
    }

    return { success: true }
  } catch (error: any) {
    console.error('Errore in updateResellerTier:', error)
    return {
      success: false,
      error: error.message || 'Errore sconosciuto',
    }
  }
}
