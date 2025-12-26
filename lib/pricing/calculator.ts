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
 * Calcola il prezzo da una price list (funzione pura).
 * 
 * @param priceList - Listino prezzi completo con entries
 * @param weight - Peso della spedizione in kg
 * @param destinationZip - CAP destinazione (5 cifre)
 * @param serviceType - Tipo servizio ('standard', 'express', 'economy')
 * @param options - Opzioni aggiuntive (contrassegno, assicurazione)
 * @returns Risultato calcolo prezzo o null se nessuna entry matcha
 */
export function calculatePriceFromList(
  priceList: PriceList,
  weight: number,
  destinationZip: string,
  serviceType: string = 'standard',
  options?: PriceCalculationOptions
): PriceCalculationResult | null {
  if (!priceList || !priceList.entries) {
    return null;
  }

  // Trova la riga corrispondente
  const entry = (priceList.entries as PriceListEntry[]).find(e => {
    const weightMatch = weight >= e.weight_from && weight <= e.weight_to;
    const serviceMatch = e.service_type === serviceType;

    // Match ZIP se specificato
    let zipMatch = true;
    if (e.zip_code_from && e.zip_code_to) {
      zipMatch = destinationZip >= e.zip_code_from && destinationZip <= e.zip_code_to;
    }

    return weightMatch && serviceMatch && zipMatch;
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
        min: entry.estimated_delivery_days_min,
        max: entry.estimated_delivery_days_max,
      },
    },
  };
}

