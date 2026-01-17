/**
 * Pricing Calculator - Pure Function
 * 
 * Single Source of Truth per la logica di calcolo prezzi.
 * Funzione pura senza dipendenze da DB, rete o API esterne.
 */

import type { PriceList, PriceListEntry } from '@/types/listini';
import type {
  InsuranceConfig,
  CODConfigRow,
  AccessoryServiceConfig,
} from '@/types/supplier-price-list-config';

export interface PriceCalculationOptions {
  declaredValue?: number;
  cashOnDelivery?: boolean;
  insurance?: boolean;
  // ✨ NUOVO: Manual configurations (opzionali, da supplier_price_list_config)
  insuranceConfig?: InsuranceConfig;
  codConfig?: CODConfigRow[];
  accessoryServices?: AccessoryServiceConfig[];
}

export interface PriceCalculationResult {
  basePrice: number;
  surcharges: number;
  totalCost: number;
  details: {
    entry: PriceListEntry;
    estimatedDeliveryDays: {
      min: number;
      max: number;
    };
  };
}

/**
 * Helper: Mappa provincia/regione a zona geografica (stesso mapping di price-lists-advanced.ts)
 */
function getZoneFromDestination(province?: string, region?: string): string | null {
  if (!province && !region) return null

  const provinceToZone: Record<string, string> = {
    'CA': 'IT-SARDEGNA', 'NU': 'IT-SARDEGNA', 'OR': 'IT-SARDEGNA', 'SS': 'IT-SARDEGNA',
    'RC': 'IT-CALABRIA', 'CZ': 'IT-CALABRIA', 'CS': 'IT-CALABRIA', 'KR': 'IT-CALABRIA', 'VV': 'IT-CALABRIA',
    'PA': 'IT-SICILIA', 'CT': 'IT-SICILIA', 'ME': 'IT-SICILIA', 'AG': 'IT-SICILIA', 'CL': 'IT-SICILIA',
    'EN': 'IT-SICILIA', 'RG': 'IT-SICILIA', 'SR': 'IT-SICILIA', 'TP': 'IT-SICILIA',
    'SO': 'IT-LIVIGNO',
  }

  const regionToZone: Record<string, string> = {
    'Sardegna': 'IT-SARDEGNA',
    'Calabria': 'IT-CALABRIA',
    'Sicilia': 'IT-SICILIA',
  }

  if (province && provinceToZone[province]) {
    return provinceToZone[province]
  }

  if (region && regionToZone[region]) {
    return regionToZone[region]
  }

  return 'IT-ITALIA' // Default
}

/**
 * Calcola il prezzo da una price list (funzione pura).
 * 
 * @param priceList - Listino prezzi completo con entries
 * @param weight - Peso della spedizione in kg
 * @param destinationZip - CAP destinazione (5 cifre)
 * @param serviceType - Tipo servizio ('standard', 'express', 'economy')
 * @param options - Opzioni aggiuntive (contrassegno, assicurazione)
 * @param destinationProvince - Provincia destinazione (opzionale, per matching zone_code)
 * @param destinationRegion - Regione destinazione (opzionale, per matching zone_code)
 * @returns Risultato calcolo prezzo o null se nessuna entry matcha
 */
export function calculatePriceFromList(
  priceList: PriceList,
  weight: number,
  destinationZip: string,
  serviceType: string = 'standard',
  options?: PriceCalculationOptions,
  destinationProvince?: string,
  destinationRegion?: string
): PriceCalculationResult | null {
  if (!priceList || !priceList.entries) {
    return null;
  }

  // Calcola zona geografica dalla destinazione
  const destinationZone = getZoneFromDestination(destinationProvince, destinationRegion);

  // ✨ FIX: Trova tutte le entry che matchano, poi seleziona la più specifica
  // (preferisce fasce di peso più strette e entry con più criteri specifici)
  const matchingEntries = (priceList.entries as PriceListEntry[]).filter(e => {
    // Match peso
    const weightMatch = weight >= e.weight_from && weight <= e.weight_to;
    if (!weightMatch) return false;

    // Match service type
    const serviceMatch = e.service_type === serviceType;
    if (!serviceMatch) return false;

    // Match ZIP se specificato nell'entry
    if (e.zip_code_from && e.zip_code_to) {
      if (destinationZip < e.zip_code_from || destinationZip > e.zip_code_to) {
        return false;
      }
    }

    // ✨ ENTERPRISE: Match zone_code se specificato nell'entry
    if (e.zone_code) {
      if (destinationZone && e.zone_code !== destinationZone) {
        return false;
      }
      // Se destinationZone è null ma entry ha zone_code, non matcha (a meno che non sia IT-ITALIA default)
      if (!destinationZone && e.zone_code !== 'IT-ITALIA') {
        return false;
      }
    }

    // ✨ ENTERPRISE: Match province_code se specificato nell'entry
    if (e.province_code && destinationProvince) {
      if (e.province_code !== destinationProvince) {
        return false;
      }
    }

    return true;
  });

  // ✨ FIX: Seleziona l'entry più specifica (fasce di peso più strette hanno priorità)
  // Ordina per: 1) Larghezza fascia peso (più stretta = migliore), 2) Priorità criteri specifici
  const entry = matchingEntries.length > 0
    ? matchingEntries.sort((a, b) => {
        // 1. Preferisci fasce di peso più strette (weight_to - weight_from più piccolo)
        const rangeA = a.weight_to - a.weight_from;
        const rangeB = b.weight_to - b.weight_from;
        if (rangeA !== rangeB) {
          return rangeA - rangeB; // Fasce più strette prima
        }
        
        // 2. Se fasce uguali, preferisci entry con più criteri specifici
        const specificityA = [
          a.zip_code_from && a.zip_code_to,
          a.zone_code,
          a.province_code,
        ].filter(Boolean).length;
        const specificityB = [
          b.zip_code_from && b.zip_code_to,
          b.zone_code,
          b.province_code,
        ].filter(Boolean).length;
        
        return specificityB - specificityA; // Più specifiche prima
      })[0]
    : null;

  // 🔍 LOGGING: Verifica entry selezionata (solo se multiple match)
  if (matchingEntries.length > 1) {
    console.log(`🔍 [CALCULATOR] Trovate ${matchingEntries.length} entry che matchano per listino "${priceList.name}" (peso: ${weight}kg, zona: ${destinationZone || 'N/A'}, service: ${serviceType}):`);
    matchingEntries.forEach((e, idx) => {
      const isSelected = e === entry;
      console.log(`   ${idx + 1}. Fascia ${e.weight_from}-${e.weight_to}kg, prezzo: €${e.base_price}, ${isSelected ? '✅ SELEZIONATA' : ''}`);
    });
  }

  if (!entry) {
    console.log(`⚠️ [CALCULATOR] Nessuna entry trovata per listino "${priceList.name}" (peso: ${weight}kg, zona: ${destinationZone || 'N/A'}, service: ${serviceType})`);
    return null;
  }

  // 🔍 LOGGING: Entry selezionata (sempre, per debug)
  console.log(`✅ [CALCULATOR] Entry selezionata per listino "${priceList.name}": fascia ${entry.weight_from}-${entry.weight_to}kg, prezzo: €${entry.base_price}`);

  // Calcola prezzo
  let basePrice = parseFloat(entry.base_price as any);
  let surcharges = 0;

  // Supplemento carburante
  if (entry.fuel_surcharge_percent) {
    surcharges += basePrice * (parseFloat(entry.fuel_surcharge_percent as any) / 100);
  }

  // Supplemento isole
  if (entry.island_surcharge) {
    surcharges += parseFloat(entry.island_surcharge as any);
  }

  // Supplemento ZTL
  if (entry.ztl_surcharge) {
    surcharges += parseFloat(entry.ztl_surcharge as any);
  }

  // Supplemento contrassegno (standard da entry)
  if (options?.cashOnDelivery && entry.cash_on_delivery_surcharge) {
    surcharges += parseFloat(entry.cash_on_delivery_surcharge as any);
  }

  // Assicurazione (standard da entry)
  if (options?.insurance && options?.declaredValue && entry.insurance_rate_percent) {
    surcharges += options.declaredValue * (parseFloat(entry.insurance_rate_percent as any) / 100);
  }

  // ✨ NUOVO: Assicurazione custom da config (sovrascrive standard se presente)
  if (options?.insurance && options?.insuranceConfig && options?.declaredValue) {
    const cfg = options.insuranceConfig;
    let customInsuranceFee = 0;

    if (cfg.fixed_price) {
      customInsuranceFee = cfg.fixed_price;
    } else if (cfg.percent) {
      customInsuranceFee = options.declaredValue * (cfg.percent / 100);
    }

    // Sovrascrivi assicurazione standard con custom
    if (customInsuranceFee > 0) {
      // Rimuovi assicurazione standard già applicata
      if (entry.insurance_rate_percent) {
        surcharges -= options.declaredValue * (parseFloat(entry.insurance_rate_percent as any) / 100);
      }
      // Applica custom
      surcharges += customInsuranceFee;
    }
  }

  // ✨ NUOVO: Contrassegno custom da config (sovrascrive standard se presente)
  if (options?.cashOnDelivery && options?.codConfig && options?.declaredValue) {
    const applicableCOD = options.codConfig.find(
      row => options.declaredValue! <= row.max_value
    );

    if (applicableCOD) {
      let customCODFee = applicableCOD.fixed_price || 0;
      if (applicableCOD.percent) {
        customCODFee += options.declaredValue * (applicableCOD.percent / 100);
      }

      // Sovrascrivi COD standard con custom
      if (customCODFee > 0) {
        // Rimuovi COD standard già applicato
        if (entry.cash_on_delivery_surcharge) {
          surcharges -= parseFloat(entry.cash_on_delivery_surcharge as any);
        }
        // Applica custom
        surcharges += customCODFee;
      }
    }
  }

  // ✨ NUOVO: Servizi accessori custom
  if (options?.accessoryServices && options.accessoryServices.length > 0) {
    options.accessoryServices.forEach(svc => {
      if (svc.price) {
        surcharges += svc.price;
      }
      if (svc.percent) {
        surcharges += basePrice * (svc.percent / 100);
      }
    });
  }

  const totalCost = basePrice + surcharges;

  return {
    basePrice,
    surcharges,
    totalCost,
    details: {
      entry,
      estimatedDeliveryDays: {
        min: entry.estimated_delivery_days_min ?? 3,
        max: entry.estimated_delivery_days_max ?? 5,
      },
    },
  };
}

