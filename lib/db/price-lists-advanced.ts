/**
 * Database Functions: Price Lists Advanced
 * 
 * Sistema avanzato di gestione listini con regole complesse,
 * matching intelligente e calcolo prezzi dinamico.
 */

import { supabaseAdmin } from './client'
import type { 
  PriceList, 
  PriceRule, 
  CreatePriceListInput, 
  UpdatePriceListInput,
  PriceCalculationResult 
} from '@/types/listini'
import type { CourierServiceType } from '@/types/shipments'

/**
 * Ottiene il listino applicabile per un utente
 * 
 * Algoritmo di matching:
 * 1. Listino assegnato direttamente all'utente (priorità massima)
 * 2. Listino globale (admin) con priorità alta
 * 3. Listino di default (priorità bassa)
 * 
 * Considera anche: corriere, validità temporale, priorità
 */
export async function getApplicablePriceList(
  userId: string,
  courierId?: string,
  date?: Date
): Promise<PriceList | null> {
  try {
    const checkDate = date || new Date()
    const dateStr = checkDate.toISOString().split('T')[0]

    // Usa funzione SQL se disponibile, altrimenti query manuale
    const { data, error } = await supabaseAdmin.rpc('get_applicable_price_list', {
      p_user_id: userId,
      p_courier_id: courierId || null,
      p_date: dateStr,
    })

    if (error) {
      console.warn('Errore funzione SQL, uso query manuale:', error)
      // Fallback: query manuale
      return await getApplicablePriceListManual(userId, courierId, checkDate)
    }

    if (!data || data.length === 0) {
      return null
    }

    // Recupera listino completo
    return await getPriceListById(data[0].id)
  } catch (error: any) {
    console.error('Errore getApplicablePriceList:', error)
    return null
  }
}

/**
 * Fallback: query manuale per listino applicabile
 */
async function getApplicablePriceListManual(
  userId: string,
  courierId?: string,
  date: Date = new Date()
): Promise<PriceList | null> {
  const dateStr = date.toISOString().split('T')[0]

  // 1. Prova listino assegnato direttamente
  const { data: assignedList } = await supabaseAdmin
    .from('price_lists')
    .select('*')
    .eq('assigned_to_user_id', userId)
    .eq('status', 'active')
    .lte('valid_from', dateStr)
    .or(`valid_until.is.null,valid_until.gte.${dateStr}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (assignedList) {
    return assignedList as PriceList
  }

  // 2. Prova listino globale
  const { data: globalList } = await supabaseAdmin
    .from('price_lists')
    .select('*')
    .eq('is_global', true)
    .eq('status', 'active')
    .lte('valid_from', dateStr)
    .or(`valid_until.is.null,valid_until.gte.${dateStr}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (globalList) {
    return globalList as PriceList
  }

  // 3. Prova listino di default
  const { data: defaultList } = await supabaseAdmin
    .from('price_lists')
    .select('*')
    .eq('priority', 'default')
    .eq('status', 'active')
    .lte('valid_from', dateStr)
    .or(`valid_until.is.null,valid_until.gte.${dateStr}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return defaultList as PriceList | null
}

/**
 * Calcola prezzo usando sistema PriceRule avanzato
 * 
 * Algoritmo:
 * 1. Recupera listino applicabile
 * 2. Trova tutte le regole che matchano le condizioni
 * 3. Seleziona regola con priorità più alta
 * 4. Calcola prezzo base + sovrapprezzi + margine
 */
export async function calculatePriceWithRules(
  userId: string,
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
): Promise<PriceCalculationResult | null> {
  try {
    // 1. Recupera listino
    let priceList: PriceList | null = null

    if (priceListId) {
      priceList = await getPriceListById(priceListId)
    } else {
      priceList = await getApplicablePriceList(userId, params.courierId)
    }

    if (!priceList) {
      return null
    }

    // 2. Estrai regole (se presenti)
    const rules = (priceList.rules as PriceRule[]) || []

    // 3. Trova regole che matchano
    const matchingRules = findMatchingRules(rules, params)

    if (matchingRules.length === 0) {
      // Nessuna regola matcha, usa margine di default
      return calculateWithDefaultMargin(priceList, params)
    }

    // 4. Seleziona regola con priorità più alta
    const selectedRule = selectBestRule(matchingRules)

    // 5. Calcola prezzo con regola selezionata
    return calculatePriceWithRule(priceList, selectedRule, params)
  } catch (error: any) {
    console.error('Errore calculatePriceWithRules:', error)
    return null
  }
}

/**
 * Trova tutte le regole che matchano le condizioni
 */
function findMatchingRules(
  rules: PriceRule[],
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
  }
): PriceRule[] {
  const now = new Date().toISOString()

  return rules.filter(rule => {
    // Filtra regole attive
    if (!rule.is_active) return false

    // Verifica validità temporale
    if (rule.valid_from && rule.valid_from > now) return false
    if (rule.valid_until && rule.valid_until < now) return false

    // Verifica peso
    if (rule.weight_from !== undefined && params.weight < rule.weight_from) return false
    if (rule.weight_to !== undefined && params.weight > rule.weight_to) return false

    // Verifica volume
    if (params.volume !== undefined) {
      if (rule.volume_from !== undefined && params.volume < rule.volume_from) return false
      if (rule.volume_to !== undefined && params.volume > rule.volume_to) return false
    }

    // Verifica corriere
    if (rule.courier_ids && rule.courier_ids.length > 0) {
      if (!params.courierId || !rule.courier_ids.includes(params.courierId)) return false
    }

    // Verifica servizio
    if (rule.service_types && rule.service_types.length > 0) {
      if (!params.serviceType || !rule.service_types.includes(params.serviceType)) return false
    }

    // Verifica zona geografica
    if (rule.zone_codes && rule.zone_codes.length > 0) {
      // TODO: Implementare logica zone (richiede mapping ZIP -> zone)
    }

    // Verifica CAP
    if (rule.zip_code_from && params.destination.zip) {
      if (params.destination.zip < rule.zip_code_from) return false
    }
    if (rule.zip_code_to && params.destination.zip) {
      if (params.destination.zip > rule.zip_code_to) return false
    }

    // Verifica provincia
    if (rule.province_codes && rule.province_codes.length > 0) {
      if (!params.destination.province || !rule.province_codes.includes(params.destination.province)) return false
    }

    // Verifica regione
    if (rule.regions && rule.regions.length > 0) {
      if (!params.destination.region || !rule.regions.includes(params.destination.region)) return false
    }

    // Verifica paese
    if (rule.countries && rule.countries.length > 0) {
      if (!params.destination.country || !rule.countries.includes(params.destination.country)) return false
    }

    return true
  })
}

/**
 * Seleziona la regola migliore tra quelle che matchano
 * (priorità più alta)
 */
function selectBestRule(rules: PriceRule[]): PriceRule {
  return rules.reduce((best, current) => {
    const currentPriority = current.priority || 0
    const bestPriority = best.priority || 0
    return currentPriority > bestPriority ? current : best
  })
}

/**
 * Calcola prezzo usando una regola specifica
 */
function calculatePriceWithRule(
  priceList: PriceList,
  rule: PriceRule,
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
  }
): PriceCalculationResult {
  // Prezzo base
  let basePrice = rule.base_price_override || 0

  // Se non c'è override, calcola da peso/volume (logica semplificata)
  if (!rule.base_price_override) {
    // TODO: Integrare con calcolo da price_list_entries legacy se necessario
    basePrice = 10.0 // Default temporaneo
  }

  // Calcola sovrapprezzi
  let surcharges = 0

  // Supplemento carburante
  if (rule.fuel_surcharge_percent) {
    surcharges += basePrice * (rule.fuel_surcharge_percent / 100)
  }

  // Supplemento isole
  if (rule.island_surcharge) {
    surcharges += rule.island_surcharge
  }

  // Supplemento ZTL
  if (rule.ztl_surcharge) {
    surcharges += rule.ztl_surcharge
  }

  // Supplemento express
  if (params.serviceType === 'express' && rule.express_surcharge) {
    surcharges += rule.express_surcharge
  }

  // Contrassegno
  if (params.options?.cashOnDelivery && rule.cash_on_delivery_fee) {
    surcharges += rule.cash_on_delivery_fee
  }

  // Assicurazione
  if (params.options?.insurance && params.options?.declaredValue && rule.insurance_rate_percent) {
    surcharges += params.options.declaredValue * (rule.insurance_rate_percent / 100)
  }

  const totalCost = basePrice + surcharges

  // Calcola margine
  let margin = 0
  if (rule.margin_type === 'percent' && rule.margin_value) {
    margin = totalCost * (rule.margin_value / 100)
  } else if (rule.margin_type === 'fixed' && rule.margin_value) {
    margin = rule.margin_value
  }

  const finalPrice = totalCost + margin

  return {
    basePrice,
    surcharges,
    margin,
    totalCost,
    finalPrice,
    appliedRule: rule,
    appliedPriceList: priceList,
    priceListId: priceList.id,
    calculationDetails: {
      weight: params.weight,
      volume: params.volume,
      destination: params.destination,
      courierId: params.courierId,
      serviceType: params.serviceType,
      options: params.options,
    },
  }
}

/**
 * Calcola prezzo usando margine di default (nessuna regola matcha)
 */
function calculateWithDefaultMargin(
  priceList: PriceList,
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
  }
): PriceCalculationResult {
  // Prezzo base (da calcolare o default)
  const basePrice = 10.0 // TODO: Integrare con sistema legacy
  const surcharges = 0
  const totalCost = basePrice + surcharges

  // Margine di default
  let margin = 0
  if (priceList.default_margin_percent) {
    margin = totalCost * (priceList.default_margin_percent / 100)
  } else if (priceList.default_margin_fixed) {
    margin = priceList.default_margin_fixed
  }

  const finalPrice = totalCost + margin

  return {
    basePrice,
    surcharges,
    margin,
    totalCost,
    finalPrice,
    appliedPriceList: priceList,
    priceListId: priceList.id,
    calculationDetails: {
      weight: params.weight,
      volume: params.volume,
      destination: params.destination,
      courierId: params.courierId,
      serviceType: params.serviceType,
      options: params.options,
    },
  }
}

/**
 * Importa getPriceListById dalla versione base
 */
async function getPriceListById(id: string): Promise<PriceList | null> {
  const { data, error } = await supabaseAdmin
    .from('price_lists')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Errore recupero listino:', error)
    return null
  }

  return data as PriceList
}
