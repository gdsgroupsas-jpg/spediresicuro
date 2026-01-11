/**
 * Pricing Calculator - Pure Function
 * 
 * Single Source of Truth per la logica di calcolo prezzi.
 * Funzione pura senza dipendenze da DB, rete o API esterne.
 */

import type { PriceList, PriceListEntry } from '@/types/listini';

export interface PriceCalculationOptions {
  declaredValue?: number;
  cashOnDelivery?: boolean;
  insurance?: boolean;
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

  // Trova la riga corrispondente con matching migliorato
  const entry = (priceList.entries as PriceListEntry[]).find(e => {
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

  if (!entry) {
    return null;
  }

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

  // Supplemento contrassegno
  if (options?.cashOnDelivery && entry.cash_on_delivery_surcharge) {
    surcharges += parseFloat(entry.cash_on_delivery_surcharge as any);
  }

  // Assicurazione
  if (options?.insurance && options?.declaredValue && entry.insurance_rate_percent) {
    surcharges += options.declaredValue * (parseFloat(entry.insurance_rate_percent as any) / 100);
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

