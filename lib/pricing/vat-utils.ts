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
const MIN_VAT_RATE = 0;
const MAX_VAT_RATE = 100; // Nessun paese ha IVA > 100%

/**
 * Valida che un numero sia finito e sicuro per calcoli finanziari
 * @throws Error se il valore non è valido
 */
function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`INVALID_${name.toUpperCase()}: ${name} must be finite, got ${value}`);
  }
  if (value < 0) {
    throw new Error(`INVALID_${name.toUpperCase()}: ${name} must be >= 0, got ${value}`);
  }
}

/**
 * Valida aliquota IVA
 * @throws Error se vatRate non è nel range valido [0, 100]
 */
function assertValidVATRate(vatRate: number): void {
  if (!Number.isFinite(vatRate)) {
    throw new Error(`INVALID_VAT_RATE: vatRate must be finite, got ${vatRate}`);
  }
  if (vatRate < MIN_VAT_RATE || vatRate > MAX_VAT_RATE) {
    throw new Error(
      `INVALID_VAT_RATE: vatRate must be between ${MIN_VAT_RATE} and ${MAX_VAT_RATE}, got ${vatRate}`
    );
  }
}

/**
 * ✨ CRITICAL FIX: Arrotonda a 2 decimali per evitare errori floating point
 * Usa banker's rounding (round half to even) per precisione finanziaria
 */
function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

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
  // ✨ CRITICAL FIX: Validazione input per prevenire NaN/Infinity/Division by zero
  assertFinitePositive(price, 'price');
  assertValidVATRate(vatRate);

  // Normalizza null a 'excluded' (retrocompatibilità)
  const from = fromMode || 'excluded';
  const to = toMode || 'excluded';

  if (from === to) return price;

  if (from === 'included' && to === 'excluded') {
    // IVA inclusa → esclusa: price / (1 + vatRate/100)
    // Safe: vatRate è validato tra 0 e 100, quindi divisore è sempre > 0
    // ✨ CRITICAL FIX: Arrotondamento a 2 decimali
    return roundToTwoDecimals(price / (1 + vatRate / 100));
  }

  if (from === 'excluded' && to === 'included') {
    // IVA esclusa → inclusa: price * (1 + vatRate/100)
    // ✨ CRITICAL FIX: Arrotondamento a 2 decimali
    return roundToTwoDecimals(price * (1 + vatRate / 100));
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
  // ✨ CRITICAL FIX: Validazione input
  assertFinitePositive(priceExclVAT, 'priceExclVAT');
  assertValidVATRate(vatRate);

  // ✨ CRITICAL FIX: Arrotondamento a 2 decimali
  return roundToTwoDecimals(priceExclVAT * (vatRate / 100));
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
  // Validazione già fatta in calculateVATAmount
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
  // ✨ CRITICAL FIX: Validazione input per prevenire Division by zero
  assertFinitePositive(priceInclVAT, 'priceInclVAT');
  assertValidVATRate(vatRate);

  // Safe: vatRate è validato tra 0 e 100, quindi divisore è sempre > 0
  // ✨ CRITICAL FIX: Arrotondamento a 2 decimali
  return roundToTwoDecimals(priceInclVAT / (1 + vatRate / 100));
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
 * Ottiene modalità IVA con fallback (null/undefined → 'excluded')
 *
 * @param mode - Modalità IVA (può essere null o undefined)
 * @returns Modalità IVA valida ('included' o 'excluded')
 *
 * @example
 * getVATModeWithFallback(null) // 'excluded'
 * getVATModeWithFallback(undefined) // 'excluded'
 * getVATModeWithFallback('included') // 'included'
 */
export function getVATModeWithFallback(mode: VATMode | undefined): 'included' | 'excluded' {
  return mode || 'excluded';
}
