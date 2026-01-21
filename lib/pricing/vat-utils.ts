/**
 * VAT Utilities - ADR-001
 *
 * Funzioni pure per gestione semantica IVA.
 * Backward compatible: gestisce vat_mode = null come 'excluded'
 *
 * @module lib/pricing/vat-utils
 */

export type VATMode = 'included' | 'excluded' | null;

const DEFAULT_VAT_RATE = 22.0;

/**
 * Normalizza prezzo da una modalità IVA a un'altra
 *
 * @param price - Prezzo da normalizzare
 * @param fromMode - Modalità IVA corrente (null = 'excluded' per retrocompatibilità)
 * @param toMode - Modalità IVA target (null = 'excluded' per retrocompatibilità)
 * @param vatRate - Aliquota IVA (default 22%)
 * @returns Prezzo normalizzato
 *
 * @example
 * // IVA esclusa → inclusa
 * normalizePrice(100, 'excluded', 'included', 22) // 122.00
 *
 * // IVA inclusa → esclusa
 * normalizePrice(122, 'included', 'excluded', 22) // 100.00
 *
 * // Retrocompatibilità: null = 'excluded'
 * normalizePrice(100, null, 'included', 22) // 122.00
 */
export function normalizePrice(
  price: number,
  fromMode: VATMode,
  toMode: VATMode,
  vatRate: number = DEFAULT_VAT_RATE
): number {
  // Normalizza null a 'excluded' (retrocompatibilità)
  const from = fromMode || 'excluded';
  const to = toMode || 'excluded';

  if (from === to) return price;

  if (from === 'included' && to === 'excluded') {
    // IVA inclusa → esclusa: price / (1 + vatRate/100)
    return price / (1 + vatRate / 100);
  }

  if (from === 'excluded' && to === 'included') {
    // IVA esclusa → inclusa: price * (1 + vatRate/100)
    return price * (1 + vatRate / 100);
  }

  return price;
}

/**
 * Calcola importo IVA da prezzo escluso
 *
 * @param priceExclVAT - Prezzo escluso IVA
 * @param vatRate - Aliquota IVA (default 22%)
 * @returns Importo IVA
 *
 * @example
 * calculateVATAmount(100, 22) // 22.00
 */
export function calculateVATAmount(
  priceExclVAT: number,
  vatRate: number = DEFAULT_VAT_RATE
): number {
  return priceExclVAT * (vatRate / 100);
}

/**
 * Calcola prezzo totale con IVA da prezzo escluso
 *
 * @param priceExclVAT - Prezzo escluso IVA
 * @param vatRate - Aliquota IVA (default 22%)
 * @returns Prezzo totale con IVA inclusa
 *
 * @example
 * calculatePriceWithVAT(100, 22) // 122.00
 */
export function calculatePriceWithVAT(
  priceExclVAT: number,
  vatRate: number = DEFAULT_VAT_RATE
): number {
  return priceExclVAT + calculateVATAmount(priceExclVAT, vatRate);
}

/**
 * Estrae prezzo escluso IVA da prezzo incluso
 *
 * @param priceInclVAT - Prezzo con IVA inclusa
 * @param vatRate - Aliquota IVA (default 22%)
 * @returns Prezzo escluso IVA
 *
 * @example
 * extractPriceExclVAT(122, 22) // 100.00
 */
export function extractPriceExclVAT(
  priceInclVAT: number,
  vatRate: number = DEFAULT_VAT_RATE
): number {
  return priceInclVAT / (1 + vatRate / 100);
}

/**
 * Verifica se vat_mode è valido (non null o 'excluded'/'included')
 *
 * @param mode - Modalità IVA da verificare
 * @returns true se valido, false altrimenti
 */
export function isValidVATMode(mode: VATMode): mode is 'included' | 'excluded' {
  return mode === 'included' || mode === 'excluded';
}

/**
 * Ottiene modalità IVA con fallback (null → 'excluded')
 *
 * @param mode - Modalità IVA (può essere null)
 * @returns Modalità IVA valida ('included' o 'excluded')
 *
 * @example
 * getVATModeWithFallback(null) // 'excluded'
 * getVATModeWithFallback('included') // 'included'
 */
export function getVATModeWithFallback(mode: VATMode): 'included' | 'excluded' {
  return mode || 'excluded';
}
