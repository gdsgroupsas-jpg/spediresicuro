/**
 * Database Functions: Price Lists Advanced
 * 
 * Sistema avanzato di gestione listini con regole complesse,
 * matching intelligente e calcolo prezzi dinamico.
 */

import { supabaseAdmin } from './client'
import { calculatePriceFromList } from '@/lib/pricing/calculator'
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
 * 
 * ⚠️ AGGIORNATO: Include anche listini assegnati tramite price_list_assignments
 */
async function getApplicablePriceListManual(
  userId: string,
  courierId?: string,
  date: Date = new Date()
): Promise<PriceList | null> {
  const dateStr = date.toISOString().split('T')[0]

  // 1. Prova listino assegnato direttamente (assigned_to_user_id)
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

  // 2. ✨ NUOVO: Prova listino assegnato tramite price_list_assignments
  const { data: assignments } = await supabaseAdmin
    .from('price_list_assignments')
    .select('price_list_id')
    .eq('user_id', userId)
    .is('revoked_at', null)

  if (assignments && assignments.length > 0) {
    const assignedPriceListIds = assignments.map(a => a.price_list_id)
    
    // Recupera i listini assegnati
    const { data: assignedLists } = await supabaseAdmin
      .from('price_lists')
      .select('*')
      .in('id', assignedPriceListIds)
      .eq('status', 'active')
      .lte('valid_from', dateStr)
      .or(`valid_until.is.null,valid_until.gte.${dateStr}`)
      .order('created_at', { ascending: false })

    if (assignedLists && assignedLists.length > 0) {
      // Filtra per corriere se specificato
      const filtered = courierId
        ? assignedLists.filter(pl => !pl.courier_id || pl.courier_id === courierId)
        : assignedLists

      if (filtered.length > 0) {
        return filtered[0] as PriceList
      }
    }
  }

  // 3. Prova listino globale
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

  // 4. Prova listino di default
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
      return await calculateWithDefaultMargin(priceList, params)
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
 * Helper: Mappa provincia/regione a zona geografica
 * Retrocompatibile: se non può determinare, ritorna null (regola viene comunque valutata)
 */
function getZoneFromDestination(
  province?: string,
  region?: string
): string | null {
  if (!province && !region) return null

  // Mappatura province/regioni a zone (basata su PRICING_MATRIX)
  const provinceToZone: Record<string, string> = {
    // Sardegna
    'CA': 'IT-SARDEGNA',
    'NU': 'IT-SARDEGNA',
    'OR': 'IT-SARDEGNA',
    'SS': 'IT-SARDEGNA',
    // Calabria
    'RC': 'IT-CALABRIA',
    'CZ': 'IT-CALABRIA',
    'CS': 'IT-CALABRIA',
    'KR': 'IT-CALABRIA',
    'VV': 'IT-CALABRIA',
    // Sicilia
    'PA': 'IT-SICILIA',
    'CT': 'IT-SICILIA',
    'ME': 'IT-SICILIA',
    'AG': 'IT-SICILIA',
    'CL': 'IT-SICILIA',
    'EN': 'IT-SICILIA',
    'RG': 'IT-SICILIA',
    'SR': 'IT-SICILIA',
    'TP': 'IT-SICILIA',
    // Livigno/Campione
    'SO': 'IT-LIVIGNO', // Solo per Livigno specifico
  }

  const regionToZone: Record<string, string> = {
    'Sardegna': 'IT-SARDEGNA',
    'Calabria': 'IT-CALABRIA',
    'Sicilia': 'IT-SICILIA',
  }

  // Prova prima con provincia
  if (province && provinceToZone[province]) {
    return provinceToZone[province]
  }

  // Poi con regione
  if (region && regionToZone[region]) {
    return regionToZone[region]
  }

  // Default: Italia standard (non escludere la regola)
  return 'IT-ITALIA'
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
      const destinationZone = getZoneFromDestination(
        params.destination.province,
        params.destination.region
      )
      
      // Se non può determinare la zona, la regola viene comunque valutata (retrocompatibilità)
      // Solo se la zona è determinabile E non matcha, escludi la regola
      if (destinationZone && !rule.zone_codes.includes(destinationZone)) {
        return false
      }
      // Se destinationZone è null, la regola viene valutata (non esclusa)
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

  // Se non c'è override, calcola da price_list_entries (matrice) se disponibile
  if (!rule.base_price_override && priceList.entries && priceList.entries.length > 0) {
    const matrixResult = calculatePriceFromList(
      priceList,
      params.weight,
      params.destination.zip || '',
      params.serviceType || 'standard',
      params.options,
      params.destination.province,
      params.destination.region
    )
    
    if (matrixResult) {
      basePrice = matrixResult.basePrice
    } else {
      // Se non trova entry nella matrice, usa default (retrocompatibilità)
      basePrice = 10.0
    }
  } else if (!rule.base_price_override) {
    // Nessuna matrice disponibile, usa default
    basePrice = 10.0
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
async function calculateWithDefaultMargin(
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
): Promise<PriceCalculationResult> {
  // ✨ FIX: Calcola prezzo base dalla matrice se disponibile
  let basePrice = 10.0 // Default fallback
  let surcharges = 0
  let supplierBasePrice = 0 // ✨ NUOVO: Prezzo originale fornitore (se listino personalizzato modificato manualmente)
  let supplierSurcharges = 0

  // ✨ ENTERPRISE: Se è un listino personalizzato con master_list_id, recupera prezzo originale fornitore
  if (priceList.master_list_id && priceList.list_type === 'custom') {
    try {
      const { data: masterList } = await supabaseAdmin
        .from('price_lists')
        .select('*, entries:price_list_entries(*)')
        .eq('id', priceList.master_list_id)
        .single()

      if (masterList && masterList.entries) {
        const masterMatrixResult = calculatePriceFromList(
          masterList as PriceList,
          params.weight,
          params.destination.zip || '',
          params.serviceType || 'standard',
          params.options,
          params.destination.province,
          params.destination.region
        )

        if (masterMatrixResult) {
          supplierBasePrice = masterMatrixResult.basePrice
          supplierSurcharges = masterMatrixResult.surcharges || 0
          console.log(`✅ [PRICE CALC] Listino personalizzato: recuperato prezzo fornitore originale €${(supplierBasePrice + supplierSurcharges).toFixed(2)}`)
        }
      }
    } catch (error) {
      console.warn(`⚠️ [PRICE CALC] Errore recupero prezzo fornitore originale:`, error)
    }
  }

  if (priceList.entries && priceList.entries.length > 0) {
    const matrixResult = calculatePriceFromList(
      priceList,
      params.weight,
      params.destination.zip || '',
      params.serviceType || 'standard',
      params.options,
      params.destination.province,
      params.destination.region
    )
    
    if (matrixResult) {
      basePrice = matrixResult.basePrice
      surcharges = matrixResult.surcharges || 0
      // totalCost dalla matrice include già basePrice + surcharges
      const totalCost = basePrice + surcharges
      
      // ✨ ENTERPRISE: Se abbiamo il prezzo fornitore originale, significa che i prezzi sono stati modificati manualmente
      // In questo caso, il prezzo nel listino personalizzato è già il prezzo finale (con margine incluso)
      // Quindi NON applichiamo margini aggiuntivi
      const supplierTotalCost = supplierBasePrice > 0 ? supplierBasePrice + supplierSurcharges : 0
      const isManuallyModified = supplierTotalCost > 0 && Math.abs(totalCost - supplierTotalCost) > 0.01
      
      let margin = 0
      let finalPrice = totalCost
      
      if (isManuallyModified) {
        // Prezzi modificati manualmente: il prezzo nel listino personalizzato è già il prezzo finale
        // Il margine è la differenza tra prezzo personalizzato e prezzo fornitore originale
        margin = totalCost - supplierTotalCost
        finalPrice = totalCost // Non aggiungiamo margine, è già incluso
        console.log(`✅ [PRICE CALC] Prezzi modificati manualmente: fornitore €${supplierTotalCost.toFixed(2)} → personalizzato €${totalCost.toFixed(2)} (margine €${margin.toFixed(2)})`)
      } else {
        // Prezzi non modificati: applica margine di default
        if (priceList.default_margin_percent) {
          margin = totalCost * (priceList.default_margin_percent / 100)
        } else if (priceList.default_margin_fixed) {
          margin = priceList.default_margin_fixed
        }
        finalPrice = totalCost + margin
      }

      return {
        basePrice,
        surcharges,
        margin,
        totalCost: isManuallyModified ? supplierTotalCost : totalCost, // ✨ Costo fornitore originale se modificato manualmente
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
  }

  // Fallback: se non trova entry nella matrice, usa default
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
 * ✨ FIX: Carica anche entries (matrice) per calcolo prezzi
 */
async function getPriceListById(id: string): Promise<PriceList | null> {
  const { data, error } = await supabaseAdmin
    .from('price_lists')
    .select('*, entries:price_list_entries(*)')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Errore recupero listino:', error)
    return null
  }

  return data as PriceList
}

/**
 * ✨ NUOVO: Calcola e confronta prezzi per reseller (API Reseller vs API Master)
 * 
 * Per reseller che ha accesso sia alle proprie API che a quelle Master:
 * 1. Calcola prezzo con listino fornitore reseller (API Reseller)
 * 2. Calcola prezzo con listino personalizzato assegnato (API Master)
 * 3. Confronta e seleziona il migliore
 * 
 * @param userId - ID utente reseller
 * @param params - Parametri calcolo prezzo
 * @returns Risultato con prezzo migliore e informazioni su quale API usare
 */
export async function calculateBestPriceForReseller(
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
  }
): Promise<{
  bestPrice: PriceCalculationResult
  apiSource: 'reseller' | 'master' | 'default'
  resellerPrice?: PriceCalculationResult
  masterPrice?: PriceCalculationResult
  priceDifference?: number
} | null> {
  try {
    // Verifica che l'utente sia reseller
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, is_reseller, account_type')
      .eq('id', userId)
      .single()

    if (!user || !user.is_reseller) {
      // Non è reseller, usa calcolo normale
      const normalPrice = await calculatePriceWithRules(userId, params)
      if (!normalPrice) return null
      return {
        bestPrice: normalPrice,
        apiSource: 'default',
      }
    }

    // ✨ PRIORITÀ 1: Listini personalizzati ATTIVI del reseller (list_type='custom', status='active')
    // Questi hanno la massima priorità perché sono creati e configurati dal reseller stesso
    let customPrice: PriceCalculationResult | null = null
    const { data: customPriceLists } = await supabaseAdmin
      .from('price_lists')
      .select('*')
      .eq('created_by', userId)
      .eq('list_type', 'custom')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (customPriceLists && customPriceLists.length > 0) {
      // Filtra per corriere se specificato
      const filtered = params.courierId
        ? customPriceLists.filter(pl => !pl.courier_id || pl.courier_id === params.courierId)
        : customPriceLists

      // ✨ ENTERPRISE: Se ci sono PIÙ listini attivi, calcola il prezzo per tutti e scegli il PIÙ ECONOMICO
      const priceResults: Array<{
        price: PriceCalculationResult
        list: typeof customPriceLists[0]
        metadata: any
      }> = []

      // Calcola prezzo per ogni listino personalizzato attivo
      for (const customList of filtered) {
        const calculatedPrice = await calculatePriceWithRules(userId, params, customList.id)
        if (calculatedPrice) {
          const metadata = customList.metadata || customList.source_metadata || {}
          priceResults.push({
            price: calculatedPrice,
            list: customList,
            metadata,
          })
        }
      }

      // Se ci sono risultati, scegli il PIÙ ECONOMICO (prezzo finale più basso)
      if (priceResults.length > 0) {
        // Ordina per prezzo finale (finalPrice) crescente
        priceResults.sort((a, b) => a.price.finalPrice - b.price.finalPrice)
        
        // Prendi il primo (più economico)
        const bestResult = priceResults[0]
        customPrice = bestResult.price
        
        // ✨ ENTERPRISE: Estrai courier_config_id dal metadata del listino personalizzato
        // Questo è fondamentale per usare la configurazione API corretta nella creazione spedizione
        const courierConfigId = bestResult.metadata.courier_config_id
        
        // Aggiungi courier_config_id al risultato per tracciare quale config API usare
        if (courierConfigId) {
          customPrice._courierConfigId = courierConfigId
          console.log(`✅ [RESELLER] Usato listino personalizzato PIÙ ECONOMICO: ${bestResult.list.name} (${bestResult.list.id}) con prezzo €${bestResult.price.finalPrice.toFixed(2)} e config API: ${courierConfigId}`)
        } else {
          console.log(`✅ [RESELLER] Usato listino personalizzato PIÙ ECONOMICO: ${bestResult.list.name} (${bestResult.list.id}) con prezzo €${bestResult.price.finalPrice.toFixed(2)} - ATTENZIONE: courier_config_id non presente nei metadata`)
        }
        
        // Log dei listini confrontati (solo se ce ne sono più di uno)
        if (priceResults.length > 1) {
          console.log(`📊 [RESELLER] Confrontati ${priceResults.length} listini attivi per corriere ${params.courierId || 'tutti'}:`)
          priceResults.forEach((result, index) => {
            console.log(`  ${index + 1}. ${result.list.name}: €${result.price.finalPrice.toFixed(2)} ${index === 0 ? '✅ SCELTO' : ''}`)
          })
        }
      }
    }

    // Se abbiamo trovato un listino personalizzato attivo, usalo (priorità massima)
    if (customPrice) {
      return {
        bestPrice: customPrice,
        apiSource: 'reseller', // Listino personalizzato = reseller
        resellerPrice: customPrice,
      }
    }

    // ✨ PRIORITÀ 2: Listino fornitore reseller (API Reseller)
    const resellerPriceList = await getApplicablePriceList(
      userId,
      params.courierId
    )
    
    let resellerPrice: PriceCalculationResult | null = null
    if (resellerPriceList && resellerPriceList.list_type === 'supplier') {
      resellerPrice = await calculatePriceWithRules(userId, params, resellerPriceList.id)
    }

    // ✨ PRIORITÀ 3: Listino personalizzato assegnato (API Master)
    // Cerca listini assegnati tramite price_list_assignments
    const { data: assignments } = await supabaseAdmin
      .from('price_list_assignments')
      .select('price_list_id, price_lists(*)')
      .eq('user_id', userId)
      .is('revoked_at', null)

    let masterPrice: PriceCalculationResult | null = null
    if (assignments && assignments.length > 0) {
      // Prendi il primo listino assegnato valido
      for (const assignment of assignments) {
        const assignedList = assignment.price_lists as any
        if (assignedList && assignedList.status === 'active') {
          // Verifica che sia per lo stesso corriere (se specificato)
          if (!params.courierId || !assignedList.courier_id || assignedList.courier_id === params.courierId) {
            masterPrice = await calculatePriceWithRules(userId, params, assignedList.id)
            if (masterPrice) break
          }
        }
      }
    }

    // 3. Confronta prezzi e seleziona il migliore
    const prices: Array<{ price: PriceCalculationResult; source: 'reseller' | 'master' }> = []
    
    if (resellerPrice) {
      prices.push({ price: resellerPrice, source: 'reseller' })
    }
    
    if (masterPrice) {
      prices.push({ price: masterPrice, source: 'master' })
    }

    if (prices.length === 0) {
      // Nessun prezzo disponibile, usa calcolo normale
      const normalPrice = await calculatePriceWithRules(userId, params)
      if (!normalPrice) return null
      return {
        bestPrice: normalPrice,
        apiSource: 'default',
      }
    }

    // Seleziona prezzo migliore (minore finalPrice)
    const best = prices.reduce((best, current) => 
      current.price.finalPrice < best.price.finalPrice ? current : best
    )

    const priceDifference = prices.length > 1
      ? Math.abs((prices.find(p => p.source !== best.source)?.price.finalPrice || 0) - best.price.finalPrice)
      : undefined

    return {
      bestPrice: best.price,
      apiSource: best.source,
      resellerPrice: resellerPrice || undefined,
      masterPrice: masterPrice || undefined,
      priceDifference,
    }
  } catch (error: any) {
    console.error('Errore calculateBestPriceForReseller:', error)
    return null
  }
}
