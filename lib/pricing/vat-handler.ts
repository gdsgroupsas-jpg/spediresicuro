/**
 * VAT Handler - Milestone 1
 *
 * Funzioni helper per normalizzazione prezzi VAT in contesti pricing.
 * Riusa le funzioni pure da vat-utils.ts e fornisce pattern ad alto livello.
 *
 * @module lib/pricing/vat-handler
 */

import { normalizePrice, type VATMode } from './vat-utils';

/**
 * Risultato normalizzazione prezzi a IVA esclusa
 */
export interface NormalizedPrices {
  basePriceExclVAT: number;
  surchargesExclVAT: number;
  totalCostExclVAT: number;
}

/**
 * Risultato normalizzazione prezzi fornitore a IVA esclusa
 */
export interface NormalizedSupplierPrices extends NormalizedPrices {
  supplierBasePriceExclVAT: number;
  supplierSurchargesExclVAT: number;
  supplierTotalCostExclVAT: number;
}

/**
 * Normalizza basePrice e surcharges a IVA esclusa
 *
 * Pattern comune estratto da price-lists-advanced.ts.
 * Usato in calculatePriceWithRule, calculateWithDefaultMargin, e fallback.
 *
 * @param basePrice - Prezzo base (nella modalità VAT del listino)
 * @param surcharges - Sovrapprezzi (nella stessa modalità VAT del basePrice)
 * @param vatMode - Modalità IVA del listino ('included' | 'excluded' | null)
 * @param vatRate - Aliquota IVA (default 22%)
 * @returns Prezzi normalizzati a IVA esclusa
 *
 * @example
 * // Listino con IVA inclusa
 * normalizePricesToExclVAT(122, 12.2, 'included', 22)
 * // { basePriceExclVAT: 100, surchargesExclVAT: 10, totalCostExclVAT: 110 }
 *
 * // Listino con IVA esclusa (passthrough)
 * normalizePricesToExclVAT(100, 10, 'excluded', 22)
 * // { basePriceExclVAT: 100, surchargesExclVAT: 10, totalCostExclVAT: 110 }
 */
export function normalizePricesToExclVAT(
  basePrice: number,
  surcharges: number,
  vatMode: VATMode,
  vatRate: number = 22.0
): NormalizedPrices {
  const mode = vatMode || 'excluded';

  let basePriceExclVAT = basePrice;
  let surchargesExclVAT = surcharges;

  if (mode === 'included') {
    basePriceExclVAT = normalizePrice(basePrice, 'included', 'excluded', vatRate);
    surchargesExclVAT = normalizePrice(surcharges, 'included', 'excluded', vatRate);
  }

  return {
    basePriceExclVAT,
    surchargesExclVAT,
    totalCostExclVAT: basePriceExclVAT + surchargesExclVAT,
  };
}

/**
 * Normalizza prezzi listino personalizzato E prezzi fornitore (master) a IVA esclusa
 *
 * Pattern comune per listini CUSTOM con master_list_id.
 * Gestisce il caso in cui custom e master abbiano vat_mode diversi.
 *
 * @param customPrices - Prezzi dal listino personalizzato
 * @param customVATMode - Modalità IVA del listino personalizzato
 * @param customVATRate - Aliquota IVA del listino personalizzato
 * @param supplierBasePrice - Prezzo base fornitore (dal master)
 * @param supplierSurcharges - Sovrapprezzi fornitore (dal master)
 * @param masterVATMode - Modalità IVA del master list
 * @param masterVATRate - Aliquota IVA del master list
 * @returns Tutti i prezzi normalizzati a IVA esclusa per confronto corretto
 *
 * @example
 * // Custom list IVA inclusa, Master list IVA esclusa
 * normalizeCustomAndSupplierPrices(
 *   { basePrice: 122, surcharges: 0 },
 *   'included', 22,
 *   100, 0,
 *   'excluded', 22
 * )
 * // { basePriceExclVAT: 100, supplierTotalCostExclVAT: 100, ... }
 */
export function normalizeCustomAndSupplierPrices(
  customPrices: { basePrice: number; surcharges: number },
  customVATMode: VATMode,
  customVATRate: number,
  supplierBasePrice: number,
  supplierSurcharges: number,
  masterVATMode: VATMode,
  masterVATRate: number
): NormalizedSupplierPrices {
  // Normalizza prezzi custom
  const customNormalized = normalizePricesToExclVAT(
    customPrices.basePrice,
    customPrices.surcharges,
    customVATMode,
    customVATRate
  );

  // Normalizza prezzi supplier (master)
  const supplierNormalized = normalizePricesToExclVAT(
    supplierBasePrice,
    supplierSurcharges,
    masterVATMode,
    masterVATRate
  );

  return {
    ...customNormalized,
    supplierBasePriceExclVAT: supplierNormalized.basePriceExclVAT,
    supplierSurchargesExclVAT: supplierNormalized.surchargesExclVAT,
    supplierTotalCostExclVAT: supplierNormalized.totalCostExclVAT,
  };
}

/**
 * Determina se i prezzi sono stati modificati manualmente
 *
 * Confronta prezzi listino personalizzato vs master (su base IVA esclusa).
 * Usato per decidere se applicare margine di default o usare prezzo custom.
 *
 * @param customTotalExclVAT - Totale listino personalizzato (IVA esclusa)
 * @param supplierTotalExclVAT - Totale fornitore (IVA esclusa)
 * @param tolerance - Tolleranza per confronto (default 0.01)
 * @returns true se i prezzi differiscono (modificati manualmente)
 */
export function isManuallyModified(
  customTotalExclVAT: number,
  supplierTotalExclVAT: number,
  tolerance: number = 0.01
): boolean {
  return (
    supplierTotalExclVAT > 0 && Math.abs(customTotalExclVAT - supplierTotalExclVAT) > tolerance
  );
}
