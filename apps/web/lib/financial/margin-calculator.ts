/**
 * Margin Calculator - Single Source of Truth per il calcolo margini
 *
 * PRINCIPIO NON NEGOZIABILE:
 * - Un margine esiste SOLO se esistono dati REALI (final_price + cost)
 * - MAI inventare valori
 * - MAI calcoli inversi (base_price = final_price / (1 + margin_percent/100))
 * - MAI usare percentuali hardcoded
 *
 * @module lib/financial/margin-calculator
 */

/**
 * Motivo per cui il margine è stato calcolato o non è calcolabile
 */
export type MarginReason =
  | 'CALCULATED_FROM_PROVIDER_COST' // Calcolato da costo fornitore reale
  | 'CALCULATED_FROM_BASE_PRICE' // Calcolato da prezzo base listino
  | 'MISSING_FINAL_PRICE' // Prezzo finale mancante o zero
  | 'MISSING_COST_DATA' // Nessun dato di costo disponibile
  | 'NOT_APPLICABLE_FOR_MODEL' // BYOC o reseller_own - contratto proprio
  | 'ZERO_OR_NEGATIVE_COST'; // Costo zero o negativo

/**
 * Input per il calcolo del margine
 */
export interface MarginInput {
  /** Prezzo finale addebitato al cliente */
  finalPrice: number | null | undefined;
  /** Costo fornitore reale (da platform_provider_costs) - priorità massima */
  providerCost: number | null | undefined;
  /** Prezzo base dal listino (fallback se providerCost non disponibile) */
  basePrice: number | null | undefined;
  /** Tipo di sorgente API - determina se margine è applicabile */
  apiSource?: 'platform' | 'byoc_own' | 'reseller_own' | null;
}

/**
 * Risultato del calcolo del margine
 */
export interface MarginResult {
  /** Margine in euro (null se non calcolabile) */
  margin: number | null;
  /** Margine percentuale (null se non calcolabile) */
  marginPercent: number | null;
  /** Motivo del calcolo o del fallimento */
  reason: MarginReason | null;
  /** Fonte del costo usata per il calcolo */
  costSource: 'provider_cost' | 'base_price' | null;
  /** True se il margine è stato calcolato con successo */
  isCalculable: boolean;
}

/**
 * Calcola il margine basandosi SOLO su dati reali.
 *
 * Algoritmo:
 * 1. Se apiSource !== 'platform' -> margine non applicabile (BYOC/reseller usano propri contratti)
 * 2. Se finalPrice mancante/zero -> margine non calcolabile
 * 3. Se providerCost disponibile -> usa quello (priorità massima)
 * 4. Se basePrice disponibile -> usa quello (fallback)
 * 5. Altrimenti -> margine non calcolabile
 *
 * @example
 * ```typescript
 * const result = computeMargin({
 *   finalPrice: 15.00,
 *   providerCost: 10.00,
 *   basePrice: null,
 *   apiSource: 'platform'
 * });
 * // result.margin = 5.00
 * // result.marginPercent = 50.00
 * // result.reason = 'CALCULATED_FROM_PROVIDER_COST'
 * ```
 */
export function computeMargin(input: MarginInput): MarginResult {
  const { finalPrice, providerCost, basePrice, apiSource } = input;

  // Rule 1: BYOC/reseller_own -> margine non applicabile
  // Questi modelli usano contratti propri, il margine della piattaforma non ha senso
  if (apiSource && apiSource !== 'platform') {
    return {
      margin: null,
      marginPercent: null,
      reason: 'NOT_APPLICABLE_FOR_MODEL',
      costSource: null,
      isCalculable: false,
    };
  }

  // Rule 2: finalPrice mancante o zero
  if (finalPrice === null || finalPrice === undefined || finalPrice <= 0) {
    return {
      margin: null,
      marginPercent: null,
      reason: 'MISSING_FINAL_PRICE',
      costSource: null,
      isCalculable: false,
    };
  }

  // Rule 3: Usa providerCost se disponibile (priorità massima - costo reale pagato)
  if (providerCost !== null && providerCost !== undefined && providerCost > 0) {
    const margin = finalPrice - providerCost;
    const marginPercent = (margin / providerCost) * 100;

    return {
      margin: Math.round(margin * 100) / 100,
      marginPercent: Math.round(marginPercent * 100) / 100,
      reason: 'CALCULATED_FROM_PROVIDER_COST',
      costSource: 'provider_cost',
      isCalculable: true,
    };
  }

  // Rule 4: Usa basePrice come fallback (costo da listino)
  if (basePrice !== null && basePrice !== undefined && basePrice > 0) {
    const margin = finalPrice - basePrice;
    const marginPercent = (margin / basePrice) * 100;

    return {
      margin: Math.round(margin * 100) / 100,
      marginPercent: Math.round(marginPercent * 100) / 100,
      reason: 'CALCULATED_FROM_BASE_PRICE',
      costSource: 'base_price',
      isCalculable: true,
    };
  }

  // Rule 5: Nessun dato di costo disponibile
  return {
    margin: null,
    marginPercent: null,
    reason: 'MISSING_COST_DATA',
    costSource: null,
    isCalculable: false,
  };
}

/**
 * Messaggi tooltip per ogni reason
 */
const REASON_TOOLTIPS: Record<MarginReason, string> = {
  CALCULATED_FROM_PROVIDER_COST: 'Calcolato da costo fornitore reale',
  CALCULATED_FROM_BASE_PRICE: 'Calcolato da prezzo base listino',
  MISSING_FINAL_PRICE: 'Prezzo finale mancante',
  MISSING_COST_DATA: 'Costo fornitore non disponibile',
  NOT_APPLICABLE_FOR_MODEL: 'Contratto proprio (BYOC/Reseller)',
  ZERO_OR_NEGATIVE_COST: 'Costo non valido',
};

/**
 * Helper per UI: formatta margine per visualizzazione
 */
export function formatMarginDisplay(result: MarginResult): {
  /** Valore formattato ("€5.00 (50.0%)" o "N/A") */
  value: string;
  /** Tooltip esplicativo */
  tooltip: string;
  /** Classe CSS per styling */
  cssClass: 'positive' | 'negative' | 'neutral' | 'unavailable';
} {
  if (!result.isCalculable || result.margin === null) {
    return {
      value: 'N/A',
      tooltip: result.reason ? REASON_TOOLTIPS[result.reason] : 'Margine non calcolabile',
      cssClass: 'unavailable',
    };
  }

  const formattedMargin = result.margin.toFixed(2);
  const formattedPercent = result.marginPercent?.toFixed(1) ?? '0.0';

  return {
    value: `€${formattedMargin} (${formattedPercent}%)`,
    tooltip: result.reason ? REASON_TOOLTIPS[result.reason] : '',
    cssClass: result.margin > 0 ? 'positive' : result.margin < 0 ? 'negative' : 'neutral',
  };
}

/**
 * Helper per aggregazioni: aggrega margini escludendo quelli non calcolabili
 *
 * @returns Totale margini + conteggio spedizioni escluse con breakdown per reason
 */
export function aggregateMargins(results: MarginResult[]): {
  totalMargin: number;
  calculableCount: number;
  excludedCount: number;
  excludedReasons: Partial<Record<MarginReason, number>>;
} {
  let totalMargin = 0;
  let calculableCount = 0;
  let excludedCount = 0;
  const excludedReasons: Partial<Record<MarginReason, number>> = {};

  for (const result of results) {
    if (result.isCalculable && result.margin !== null) {
      totalMargin += result.margin;
      calculableCount++;
    } else {
      excludedCount++;
      if (result.reason) {
        excludedReasons[result.reason] = (excludedReasons[result.reason] || 0) + 1;
      }
    }
  }

  return {
    totalMargin: Math.round(totalMargin * 100) / 100,
    calculableCount,
    excludedCount,
    excludedReasons,
  };
}
