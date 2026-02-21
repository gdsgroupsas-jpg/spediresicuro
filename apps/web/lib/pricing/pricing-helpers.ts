/**
 * Pricing Helpers - Milestone 2 + Milestone 4 (Logging)
 *
 * Funzioni helper estratte da price-lists-advanced.ts per ridurre complessità.
 * Decomposizione di calculateWithDefaultMargin().
 *
 * @module lib/pricing/pricing-helpers
 */

import { createPriceLogger, type PriceLogger } from '@/lib/logging/price-logger';
import { calculatePriceFromList } from '@/lib/pricing/calculator';
import { getVATModeWithFallback } from '@/lib/pricing/vat-utils';
import type { PriceList, PriceListEntry } from '@/types/listini';
import type { CourierServiceType } from '@/types/shipments';

/**
 * Tipo per master list con entries (per type safety invece di any)
 */
export interface MasterListWithEntries {
  id: string;
  name: string;
  vat_mode?: 'included' | 'excluded' | null;
  vat_rate?: number;
  entries?: PriceListEntry[];
}

/**
 * Parametri per calcolo prezzo
 */
export interface PricingParams {
  weight: number;
  volume?: number;
  destination: {
    zip?: string;
    province?: string;
    region?: string;
    country?: string;
  };
  courierId?: string;
  serviceType?: CourierServiceType;
  options?: {
    declaredValue?: number;
    cashOnDelivery?: boolean;
    insurance?: boolean;
  };
}

/**
 * Risultato recupero prezzo da master list
 */
export interface MasterListPriceResult {
  supplierBasePrice: number;
  supplierSurcharges: number;
  supplierTotalCostOriginal: number;
  masterVATMode: 'included' | 'excluded';
  masterVATRate: number;
  found: boolean;
}

/**
 * Risultato calcolo prezzo da matrice
 */
export interface MatrixPriceResult {
  basePrice: number;
  surcharges: number;
  totalCostOriginal: number;
  found: boolean;
}

/**
 * Recupera prezzo originale dal master list (listino fornitore)
 *
 * Usato per listini CUSTOM con master_list_id per calcolare il margine.
 *
 * @param masterListId - ID del master list
 * @param params - Parametri calcolo prezzo
 * @param getCachedMasterList - Funzione per recuperare master list (con cache)
 * @returns Prezzo fornitore e informazioni VAT del master
 */
export async function recoverMasterListPrice(
  masterListId: string,
  params: PricingParams,
  getCachedMasterList: (id: string) => Promise<MasterListWithEntries | null>,
  logger?: PriceLogger
): Promise<MasterListPriceResult> {
  const log = logger || createPriceLogger({ operation: 'recoverMasterListPrice', masterListId });

  const defaultResult: MasterListPriceResult = {
    supplierBasePrice: 0,
    supplierSurcharges: 0,
    supplierTotalCostOriginal: 0,
    masterVATMode: 'excluded',
    masterVATRate: 22.0,
    found: false,
  };

  try {
    const masterList = await getCachedMasterList(masterListId);

    if (!masterList) {
      log.warn('Master list non trovato', { masterListId });
      return defaultResult;
    }

    if (!masterList.entries || masterList.entries.length === 0) {
      log.warn('Master list senza entries', { masterListName: masterList.name });
      return defaultResult;
    }

    log.info('Master list trovato', {
      masterListName: masterList.name,
      entriesCount: masterList.entries.length,
    });

    const masterVATMode = getVATModeWithFallback(masterList.vat_mode);
    const masterVATRate = masterList.vat_rate || 22.0;

    const masterMatrixResult = calculatePriceFromList(
      masterList as PriceList,
      params.weight,
      params.destination.zip || '',
      params.serviceType || 'standard',
      params.options,
      params.destination.province,
      params.destination.region
    );

    if (!masterMatrixResult) {
      log.warn('calculatePriceFromList restituito null', { masterListName: masterList.name });
      return { ...defaultResult, masterVATMode, masterVATRate };
    }

    const supplierBasePrice = masterMatrixResult.basePrice;
    const supplierSurcharges = masterMatrixResult.surcharges || 0;
    const supplierTotalCostOriginal = supplierBasePrice + supplierSurcharges;

    log.info('Prezzo fornitore recuperato', {
      supplierPrice: supplierTotalCostOriginal.toFixed(2),
      vatMode: masterVATMode,
    });

    return {
      supplierBasePrice,
      supplierSurcharges,
      supplierTotalCostOriginal,
      masterVATMode,
      masterVATRate,
      found: true,
    };
  } catch (error) {
    log.error('Errore recupero prezzo fornitore', {
      error: error instanceof Error ? error.message : String(error),
    });
    return defaultResult;
  }
}

/**
 * Calcola prezzo dalla matrice del listino
 *
 * @param priceList - Listino con entries (matrice)
 * @param params - Parametri calcolo prezzo
 * @returns Prezzo base e surcharges dalla matrice
 */
export function calculateMatrixPrice(
  priceList: PriceList,
  params: PricingParams,
  logger?: PriceLogger
): MatrixPriceResult {
  const log =
    logger || createPriceLogger({ operation: 'calculateMatrixPrice', priceListId: priceList.id });

  const defaultResult: MatrixPriceResult = {
    basePrice: 10.0, // Default fallback
    surcharges: 0,
    totalCostOriginal: 10.0,
    found: false,
  };

  if (!priceList.entries || priceList.entries.length === 0) {
    log.verbose('Nessuna entry nel listino', { priceListName: priceList.name });
    return defaultResult;
  }

  const matrixResult = calculatePriceFromList(
    priceList,
    params.weight,
    params.destination.zip || '',
    params.serviceType || 'standard',
    params.options,
    params.destination.province,
    params.destination.region
  );

  if (!matrixResult) {
    log.warn('Nessuna entry matcha', { priceListName: priceList.name });
    return defaultResult;
  }

  const basePrice = matrixResult.basePrice;
  const surcharges = matrixResult.surcharges || 0;
  const totalCostOriginal = basePrice + surcharges;

  return {
    basePrice,
    surcharges,
    totalCostOriginal,
    found: true,
  };
}

/**
 * Determina il costo fornitore da usare nel risultato
 *
 * Logica:
 * 1. Se c'è supplierTotalCost dal master → usa quello
 * 2. Se listino è di tipo 'supplier' → totalCost È il costo fornitore
 * 3. Altrimenti → undefined (non determinabile)
 *
 * @param supplierTotalCostExclVAT - Costo fornitore dal master (IVA esclusa)
 * @param totalCostExclVAT - Costo dal listino (IVA esclusa)
 * @param listType - Tipo listino ('custom' | 'supplier' | 'master')
 * @param priceListName - Nome listino per logging
 * @returns Costo fornitore o undefined
 */
export function determineSupplierPrice(
  supplierTotalCostExclVAT: number,
  totalCostExclVAT: number,
  listType: string,
  priceListName: string,
  logger?: PriceLogger
): number | undefined {
  const log = logger || createPriceLogger({ operation: 'determineSupplierPrice' });

  if (supplierTotalCostExclVAT > 0) {
    log.verbose('Costo fornitore da master', {
      supplierPrice: supplierTotalCostExclVAT.toFixed(2),
    });
    return supplierTotalCostExclVAT;
  }

  if (listType === 'supplier') {
    log.verbose('Listino supplier', { supplierPrice: totalCostExclVAT.toFixed(2) });
    return totalCostExclVAT;
  }

  log.warn('Costo fornitore non determinabile', {
    priceListName,
    listType,
    reason: 'senza master_list_id',
  });
  return undefined;
}
