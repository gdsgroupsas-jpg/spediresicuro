/**
 * Pricing Helpers - Milestone 2
 *
 * Funzioni helper estratte da price-lists-advanced.ts per ridurre complessità.
 * Decomposizione di calculateWithDefaultMargin().
 *
 * @module lib/pricing/pricing-helpers
 */

import { calculatePriceFromList } from '@/lib/pricing/calculator';
import { getVATModeWithFallback } from '@/lib/pricing/vat-utils';
import type { PriceList } from '@/types/listini';
import type { CourierServiceType } from '@/types/shipments';

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
  getCachedMasterList: (id: string) => Promise<any | null>
): Promise<MasterListPriceResult> {
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
      console.warn(`⚠️ [MASTER PRICE] Master list non trovato (ID: ${masterListId})`);
      return defaultResult;
    }

    if (!masterList.entries || masterList.entries.length === 0) {
      console.warn(`⚠️ [MASTER PRICE] Master list "${masterList.name}" non ha entries!`);
      return defaultResult;
    }

    console.log(
      `✅ [MASTER PRICE] Master list trovato: "${masterList.name}" con ${masterList.entries.length} entries`
    );

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
      console.warn(
        `⚠️ [MASTER PRICE] calculatePriceFromList ha restituito null per master "${masterList.name}"`
      );
      return { ...defaultResult, masterVATMode, masterVATRate };
    }

    const supplierBasePrice = masterMatrixResult.basePrice;
    const supplierSurcharges = masterMatrixResult.surcharges || 0;
    const supplierTotalCostOriginal = supplierBasePrice + supplierSurcharges;

    console.log(
      `✅ [MASTER PRICE] Prezzo fornitore: €${supplierTotalCostOriginal.toFixed(2)} (vat_mode: ${masterVATMode})`
    );

    return {
      supplierBasePrice,
      supplierSurcharges,
      supplierTotalCostOriginal,
      masterVATMode,
      masterVATRate,
      found: true,
    };
  } catch (error) {
    console.warn(`⚠️ [MASTER PRICE] Errore recupero prezzo fornitore:`, error);
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
  params: PricingParams
): MatrixPriceResult {
  const defaultResult: MatrixPriceResult = {
    basePrice: 10.0, // Default fallback
    surcharges: 0,
    totalCostOriginal: 10.0,
    found: false,
  };

  if (!priceList.entries || priceList.entries.length === 0) {
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
    console.warn(`⚠️ [MATRIX PRICE] Nessuna entry matcha per listino "${priceList.name}"`);
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
  priceListName: string
): number | undefined {
  if (supplierTotalCostExclVAT > 0) {
    console.log(
      `✅ [SUPPLIER PRICE] Costo fornitore da master: €${supplierTotalCostExclVAT.toFixed(2)}`
    );
    return supplierTotalCostExclVAT;
  }

  if (listType === 'supplier') {
    console.log(`✅ [SUPPLIER PRICE] Listino supplier: €${totalCostExclVAT.toFixed(2)}`);
    return totalCostExclVAT;
  }

  console.warn(
    `⚠️ [SUPPLIER PRICE] Listino "${priceListName}" (tipo: ${listType}) senza master_list_id - costo fornitore non determinabile`
  );
  return undefined;
}
