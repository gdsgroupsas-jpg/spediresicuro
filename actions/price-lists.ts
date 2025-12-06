/**
 * Server Actions: Price Lists Management
 * 
 * Gestione completa listini prezzi con sistema PriceRule avanzato
 */

'use server'

import { auth } from '@/lib/auth-config'
import { supabaseAdmin } from '@/lib/db/client'
import { 
  createPriceList, 
  updatePriceList, 
  getPriceListById,
  getApplicablePriceList,
  calculatePriceWithRules
} from '@/lib/db/price-lists'
import type { 
  CreatePriceListInput, 
  UpdatePriceListInput,
  PriceRule,
  PriceCalculationResult 
} from '@/types/listini'
import type { CourierServiceType } from '@/types/shipments'

/**
 * Crea nuovo listino prezzi
 */
export async function createPriceListAction(
  data: CreatePriceListInput
): Promise<{
  success: boolean
  priceList?: any
  error?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return { success: false, error: 'Non autenticato' }
    }

    // Recupera user ID
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, account_type, is_reseller')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return { success: false, error: 'Utente non trovato' }
    }

    // Verifica permessi
    const isAdmin = user.account_type === 'admin' || user.account_type === 'superadmin'
    const isReseller = user.is_reseller === true

    if (!isAdmin && !isReseller) {
      return { success: false, error: 'Solo admin e reseller possono creare listini' }
    }

    // Se non è admin, non può creare listini globali
    if (data.is_global && !isAdmin) {
      return { success: false, error: 'Solo gli admin possono creare listini globali' }
    }

    const priceList = await createPriceList(data, user.id)

    return { success: true, priceList }
  } catch (error: any) {
    console.error('Errore creazione listino:', error)
    return { success: false, error: error.message || 'Errore sconosciuto' }
  }
}

/**
 * Aggiorna listino esistente
 */
export async function updatePriceListAction(
  id: string,
  data: UpdatePriceListInput
): Promise<{
  success: boolean
  priceList?: any
  error?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return { success: false, error: 'Non autenticato' }
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, account_type')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return { success: false, error: 'Utente non trovato' }
    }

    // Verifica permessi (solo admin o proprietario)
    const priceList = await getPriceListById(id)
    if (!priceList) {
      return { success: false, error: 'Listino non trovato' }
    }

    const isAdmin = user.account_type === 'admin' || user.account_type === 'superadmin'
    const isOwner = priceList.created_by === user.id || priceList.created_by_user_id === user.id

    if (!isAdmin && !isOwner) {
      return { success: false, error: 'Non hai i permessi per modificare questo listino' }
    }

    const updated = await updatePriceList(id, data, user.id)

    return { success: true, priceList: updated }
  } catch (error: any) {
    console.error('Errore aggiornamento listino:', error)
    return { success: false, error: error.message || 'Errore sconosciuto' }
  }
}

/**
 * Ottiene listino applicabile per utente corrente
 */
export async function getApplicablePriceListAction(
  courierId?: string
): Promise<{
  success: boolean
  priceList?: any
  error?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return { success: false, error: 'Non autenticato' }
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return { success: false, error: 'Utente non trovato' }
    }

    const priceList = await getApplicablePriceList(user.id, courierId)

    return { success: true, priceList }
  } catch (error: any) {
    console.error('Errore recupero listino applicabile:', error)
    return { success: false, error: error.message || 'Errore sconosciuto' }
  }
}

/**
 * Calcola preventivo usando sistema PriceRule
 */
export async function calculateQuoteAction(
  params: {
    weight: number
    volume?: number
    destination: {
      zip?: string
      province?: string
      region?: string
      country?: string
    }
    courierId?: string
    serviceType?: CourierServiceType
    options?: {
      declaredValue?: number
      cashOnDelivery?: boolean
      insurance?: boolean
    }
  },
  priceListId?: string
): Promise<{
  success: boolean
  result?: PriceCalculationResult
  error?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return { success: false, error: 'Non autenticato' }
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return { success: false, error: 'Utente non trovato' }
    }

    const result = await calculatePriceWithRules(user.id, params, priceListId)

    if (!result) {
      return { success: false, error: 'Impossibile calcolare preventivo. Verifica listino configurato.' }
    }

    return { success: true, result }
  } catch (error: any) {
    console.error('Errore calcolo preventivo:', error)
    return { success: false, error: error.message || 'Errore sconosciuto' }
  }
}

/**
 * Assegna listino a utente
 */
export async function assignPriceListToUserAction(
  userId: string,
  priceListId: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return { success: false, error: 'Non autenticato' }
    }

    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('id, account_type')
      .eq('email', session.user.email)
      .single()

    if (!currentUser) {
      return { success: false, error: 'Utente non trovato' }
    }

    // Solo admin può assegnare listini
    const isAdmin = currentUser.account_type === 'admin' || currentUser.account_type === 'superadmin'
    if (!isAdmin) {
      return { success: false, error: 'Solo gli admin possono assegnare listini' }
    }

    // Verifica che listino esista
    const priceList = await getPriceListById(priceListId)
    if (!priceList) {
      return { success: false, error: 'Listino non trovato' }
    }

    // Assegna listino all'utente
    const { error } = await supabaseAdmin
      .from('users')
      .update({ assigned_price_list_id: priceListId })
      .eq('id', userId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Errore assegnazione listino:', error)
    return { success: false, error: error.message || 'Errore sconosciuto' }
  }
}

/**
 * Ottiene listino per ID
 */
export async function getPriceListByIdAction(id: string): Promise<{
  success: boolean
  priceList?: any
  error?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return { success: false, error: 'Non autenticato' }
    }

    const priceList = await getPriceListById(id)

    if (!priceList) {
      return { success: false, error: 'Listino non trovato' }
    }

    return { success: true, priceList }
  } catch (error: any) {
    console.error('Errore recupero listino:', error)
    return { success: false, error: error.message || 'Errore sconosciuto' }
  }
}

/**
 * Lista tutti i listini (con filtri)
 */
export async function listPriceListsAction(filters?: {
  courierId?: string
  status?: string
  isGlobal?: boolean
  assignedToUserId?: string
}): Promise<{
  success: boolean
  priceLists?: any[]
  error?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return { success: false, error: 'Non autenticato' }
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, account_type, is_reseller')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return { success: false, error: 'Utente non trovato' }
    }

    let query = supabaseAdmin
      .from('price_lists')
      .select('*, courier:couriers(*)')
      .order('created_at', { ascending: false })

    // Filtri
    if (filters?.courierId) {
      query = query.eq('courier_id', filters.courierId)
    }
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.isGlobal !== undefined) {
      query = query.eq('is_global', filters.isGlobal)
    }
    if (filters?.assignedToUserId) {
      query = query.eq('assigned_to_user_id', filters.assignedToUserId)
    }

    // Se non è admin, mostra solo listini globali o assegnati
    const isAdmin = user.account_type === 'admin' || user.account_type === 'superadmin'
    if (!isAdmin) {
      query = query.or(`is_global.eq.true,assigned_to_user_id.eq.${user.id}`)
    }

    const { data, error } = await query

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, priceLists: data || [] }
  } catch (error: any) {
    console.error('Errore lista listini:', error)
    return { success: false, error: error.message || 'Errore sconosciuto' }
  }
}
