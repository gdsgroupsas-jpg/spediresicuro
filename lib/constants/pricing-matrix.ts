/**
 * Spedisci.Online Price List Matrix Configuration
 *
 * Defines the standard Zones and Weight Brackets to probe when synchronizing price lists
 * from Spedisci.Online.
 *
 * UPDATED (2026-01-05):
 * Zone mapping allineato alla matrice ufficiale Spedisci.Online:
 * - Sardegna, Italia, Calabria, Sicilia, Livigno/Campione, Isole Minori
 * - Europa 1, Europa 2, Località Disagiate
 *
 * Weights: Scaglioni standard corrieri italiani
 * - 2, 5, 10, 20, 30, 50, 70, 100, oltre 100
 */

// Scaglioni peso allineati a Spedisci.Online
// Standard: 2, 5, 10, 20, 30, 50, 70, 100kg + probe oltre 100
const WEIGHT_BRACKETS_STANDARD = [2, 5, 10, 20, 30, 50, 70, 100, 105];

// Granulare: 1-100kg step 1 + 105 (per matrix completa)
const WEIGHT_BRACKETS_GRANULAR = Array.from({ length: 100 }, (_, i) => i + 1);
WEIGHT_BRACKETS_GRANULAR.push(105);

// Default: usa scaglioni standard per velocità, granulare per matrix mode
const WEIGHTS = WEIGHT_BRACKETS_STANDARD;

export const PRICING_MATRIX = {
  WEIGHTS,
  WEIGHT_BRACKETS_STANDARD,
  WEIGHT_BRACKETS_GRANULAR,

  /**
   * Zone allineate alla matrice Spedisci.Online
   *
   * Ordine colonne nella loro UI:
   * Sardegna | Italia | Calabria | Sicilia | Livigno/Campione | Isole Minori | Europa 1 | Europa 2 | Località Disagiate
   */
  ZONES: [
    // ===== ITALIA STANDARD =====
    {
      code: 'IT-ITALIA',
      name: 'Italia (Standard)',
      sampleAddress: {
        city: 'Milano',
        state: 'MI',
        postalCode: '20100',
        country: 'IT',
      },
      priority: 1,
    },
    // ===== SARDEGNA =====
    {
      code: 'IT-SARDEGNA',
      name: 'Sardegna',
      sampleAddress: {
        city: 'Cagliari',
        state: 'CA',
        postalCode: '09100',
        country: 'IT',
      },
      priority: 2,
    },
    // ===== CALABRIA =====
    {
      code: 'IT-CALABRIA',
      name: 'Calabria',
      sampleAddress: {
        city: 'Reggio Calabria',
        state: 'RC',
        postalCode: '89100',
        country: 'IT',
      },
      priority: 3,
    },
    // ===== SICILIA =====
    {
      code: 'IT-SICILIA',
      name: 'Sicilia',
      sampleAddress: {
        city: 'Palermo',
        state: 'PA',
        postalCode: '90100',
        country: 'IT',
      },
      priority: 4,
    },
    // ===== LIVIGNO / CAMPIONE D'ITALIA =====
    {
      code: 'IT-LIVIGNO',
      name: "Livigno / Campione d'Italia",
      sampleAddress: {
        city: 'Livigno',
        state: 'SO',
        postalCode: '23041',
        country: 'IT',
      },
      priority: 5,
    },
    // ===== ISOLE MINORI =====
    {
      code: 'IT-ISOLE-MINORI',
      name: 'Isole Minori',
      sampleAddress: {
        city: 'Capri',
        state: 'NA',
        postalCode: '80073',
        country: 'IT',
      },
      priority: 6,
    },
    // ===== LOCALITÀ DISAGIATE (Venezia Laguna, zone montane) =====
    {
      code: 'IT-DISAGIATE',
      name: 'Località Disagiate',
      sampleAddress: {
        city: 'Venezia',
        state: 'VE',
        postalCode: '30124', // Laguna
        country: 'IT',
      },
      priority: 7,
    },
    // ===== EUROPA ZONA 1 (Paesi confinanti) =====
    {
      code: 'EU-ZONA1',
      name: 'Europa Zona 1',
      sampleAddress: {
        city: 'Munich',
        state: 'Bavaria',
        postalCode: '80331',
        country: 'DE',
      },
      priority: 10,
    },
    // ===== EUROPA ZONA 2 (Resto Europa) =====
    {
      code: 'EU-ZONA2',
      name: 'Europa Zona 2',
      sampleAddress: {
        city: 'Madrid',
        state: 'Madrid',
        postalCode: '28001',
        country: 'ES',
      },
      priority: 11,
    },
  ],

  /**
   * Zone Solo Italia (esclude Europa per sync più veloci)
   */
  ZONES_ITALY_ONLY: [
    'IT-ITALIA',
    'IT-SARDEGNA',
    'IT-CALABRIA',
    'IT-SICILIA',
    'IT-LIVIGNO',
    'IT-ISOLE-MINORI',
    'IT-DISAGIATE',
  ],

  /**
   * Mapping zone legacy → nuove (backward compatibility)
   */
  ZONE_LEGACY_MAP: {
    'IT-STD': 'IT-ITALIA',
    'IT-CAL': 'IT-CALABRIA',
    'IT-SIC': 'IT-SICILIA',
    'IT-SAR': 'IT-SARDEGNA',
    'IT-VEN': 'IT-DISAGIATE',
    'IT-LIV': 'IT-LIVIGNO',
    'IT-ISO': 'IT-ISOLE-MINORI',
    'EU-Z1': 'EU-ZONA1',
  },
};

/**
 * Helper: Get zone by code (supports legacy codes)
 */
export function getZoneByCode(code: string) {
  const legacyCode =
    PRICING_MATRIX.ZONE_LEGACY_MAP[code as keyof typeof PRICING_MATRIX.ZONE_LEGACY_MAP];
  const searchCode = legacyCode || code;
  return PRICING_MATRIX.ZONES.find((z) => z.code === searchCode);
}

/**
 * Helper: Get zones for sync mode
 */
export function getZonesForMode(
  mode: 'fast' | 'balanced' | 'matrix' | 'italy-only' | 'semi-auto'
): typeof PRICING_MATRIX.ZONES {
  switch (mode) {
    case 'fast':
      // Solo Italia Standard + Calabria (2 zone rappresentative)
      return PRICING_MATRIX.ZONES.filter((z) => ['IT-ITALIA', 'IT-CALABRIA'].includes(z.code));
    case 'balanced':
      // Italia completa, no Europa (7 zone)
      return PRICING_MATRIX.ZONES.filter((z) => PRICING_MATRIX.ZONES_ITALY_ONLY.includes(z.code));
    case 'italy-only':
      // Alias per balanced
      return PRICING_MATRIX.ZONES.filter((z) => PRICING_MATRIX.ZONES_ITALY_ONLY.includes(z.code));
    case 'semi-auto':
      // Tutte le zone disponibili (per creare struttura matrice completa)
      return PRICING_MATRIX.ZONES;
    case 'matrix':
      // Tutte le zone inclusa Europa (9 zone)
      return PRICING_MATRIX.ZONES;
    default:
      return PRICING_MATRIX.ZONES;
  }
}

/**
 * Helper: Get weights for sync mode
 */
export function getWeightsForMode(mode: 'fast' | 'balanced' | 'matrix' | 'semi-auto'): number[] {
  switch (mode) {
    case 'fast':
      // 3 pesi chiave
      return [2, 10, 30];
    case 'balanced':
      // Scaglioni standard (9 pesi)
      return PRICING_MATRIX.WEIGHT_BRACKETS_STANDARD;
    case 'matrix':
      // Tutti i pesi 1-100 + 105 (101 pesi)
      return PRICING_MATRIX.WEIGHT_BRACKETS_GRANULAR;
    case 'semi-auto':
      // Solo 1 kg per creare struttura matrice (utente completa manualmente)
      return [1];
    default:
      return PRICING_MATRIX.WEIGHT_BRACKETS_STANDARD;
  }
}

/**
 * Stima numero chiamate API per sync mode
 */
export function estimateSyncCalls(mode: 'fast' | 'balanced' | 'matrix' | 'semi-auto'): {
  zones: number;
  weights: number;
  totalCalls: number;
  estimatedMinutes: number;
} {
  const zones = getZonesForMode(mode).length;
  const weights = getWeightsForMode(mode).length;
  const totalCalls = zones * weights;
  // ~200ms per chiamata + overhead
  const estimatedMinutes = Math.ceil((totalCalls * 0.25) / 60);

  return { zones, weights, totalCalls, estimatedMinutes };
}
