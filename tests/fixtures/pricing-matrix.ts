/**
 * Test Matrix: Pricing Intent Detection
 * 
 * Matrice di casi test per pricing intent detection
 * Usata per test parametrizzati
 */

export interface PricingTestCase {
  message: string;
  shouldUsePricingGraph: boolean;
  shouldAskClarification: boolean;
  shouldFallbackLegacy: boolean;
  expectedStatus: number;
  description: string;
}

export const PRICING_TEST_MATRIX: PricingTestCase[] = [
  // Positive cases - should use pricing graph
  {
    message: 'Preventivo per 2 kg a 00100 Roma',
    shouldUsePricingGraph: true,
    shouldAskClarification: false,
    shouldFallbackLegacy: false,
    expectedStatus: 200,
    description: 'Pricing intent con keyword + peso + CAP',
  },
  {
    message: 'Quanto costa spedire 1.5 kg a 20100 Milano?',
    shouldUsePricingGraph: true,
    shouldAskClarification: false,
    shouldFallbackLegacy: false,
    expectedStatus: 200,
    description: 'Pricing intent con "quanto costa" + peso + CAP',
  },
  {
    message: 'Prezzo per 3 chili destinazione 50100',
    shouldUsePricingGraph: true,
    shouldAskClarification: false,
    shouldFallbackLegacy: false,
    expectedStatus: 200,
    description: 'Pricing intent con "prezzo" + peso "chili" + CAP',
  },
  {
    message: 'Preventivo per 2 kg', // Manca CAP
    shouldUsePricingGraph: true,
    shouldAskClarification: true,
    shouldFallbackLegacy: false,
    expectedStatus: 200,
    description: 'Pricing intent ma mancano dati -> clarification',
  },
  {
    message: 'Preventivo per 00100', // Manca peso
    shouldUsePricingGraph: true,
    shouldAskClarification: true,
    shouldFallbackLegacy: false,
    expectedStatus: 200,
    description: 'Pricing intent ma manca peso -> clarification',
  },

  // Negative cases - should NOT use pricing graph
  {
    message: 'Ciao Anne, come va?',
    shouldUsePricingGraph: false,
    shouldAskClarification: false,
    shouldFallbackLegacy: true,
    expectedStatus: 200,
    description: 'Greeting -> legacy path',
  },
  {
    message: 'Spedizione internazionale',
    shouldUsePricingGraph: false,
    shouldAskClarification: false,
    shouldFallbackLegacy: true,
    expectedStatus: 200,
    description: 'Spedizione senza dati -> legacy path',
  },
  {
    message: 'Prenota una spedizione',
    shouldUsePricingGraph: false,
    shouldAskClarification: false,
    shouldFallbackLegacy: true,
    expectedStatus: 200,
    description: 'Booking intent -> legacy path',
  },
  {
    message: 'Report fatturato spedizioni',
    shouldUsePricingGraph: false,
    shouldAskClarification: false,
    shouldFallbackLegacy: true,
    expectedStatus: 200,
    description: 'Report intent (exclude keyword) -> legacy path',
  },
  {
    message: 'Analisi margine mensile',
    shouldUsePricingGraph: false,
    shouldAskClarification: false,
    shouldFallbackLegacy: true,
    expectedStatus: 200,
    description: 'Analisi intent (exclude keyword) -> legacy path',
  },
  {
    message: 'Ricavo da spedizioni',
    shouldUsePricingGraph: false,
    shouldAskClarification: false,
    shouldFallbackLegacy: true,
    expectedStatus: 200,
    description: 'Ricavo intent (exclude keyword) -> legacy path',
  },
  {
    message: 'Statistiche spedizioni',
    shouldUsePricingGraph: false,
    shouldAskClarification: false,
    shouldFallbackLegacy: true,
    expectedStatus: 200,
    description: 'Statistiche intent (exclude keyword) -> legacy path',
  },
  {
    message: 'Vorrei un preventivo', // Keyword senza dati
    shouldUsePricingGraph: false,
    shouldAskClarification: false,
    shouldFallbackLegacy: true,
    expectedStatus: 200,
    description: 'Keyword senza dati -> legacy path (safe)',
  },
  {
    message: 'Spedire a 00100', // Dati senza keyword
    shouldUsePricingGraph: false,
    shouldAskClarification: false,
    shouldFallbackLegacy: true,
    expectedStatus: 200,
    description: 'Dati senza keyword -> legacy path',
  },

  // Edge cases
  {
    message: '[VOX] Preventivo per 2 kg a 00100',
    shouldUsePricingGraph: true,
    shouldAskClarification: false,
    shouldFallbackLegacy: false,
    expectedStatus: 200,
    description: 'Voice input prefix -> pricing graph',
  },
  {
    message: '💰 Preventivo per 2 kg a 00100',
    shouldUsePricingGraph: true,
    shouldAskClarification: false,
    shouldFallbackLegacy: false,
    expectedStatus: 200,
    description: 'Emoji in message -> pricing graph',
  },
  {
    message: 'PREVENTIVO per 2 KG a 00100',
    shouldUsePricingGraph: true,
    shouldAskClarification: false,
    shouldFallbackLegacy: false,
    expectedStatus: 200,
    description: 'Uppercase -> pricing graph',
  },
  {
    message: 'Preventivo per 1,5 kg a 00100', // Virgola
    shouldUsePricingGraph: true,
    shouldAskClarification: false,
    shouldFallbackLegacy: false,
    expectedStatus: 200,
    description: 'Peso con virgola -> pricing graph',
  },
  {
    message: 'Preventivo per 2.5kg a 00100', // Punto, no spazio
    shouldUsePricingGraph: true,
    shouldAskClarification: false,
    shouldFallbackLegacy: false,
    expectedStatus: 200,
    description: 'Peso con punto, no spazio -> pricing graph',
  },

  // Error cases
  {
    message: '',
    shouldUsePricingGraph: false,
    shouldAskClarification: false,
    shouldFallbackLegacy: true,
    expectedStatus: 200,
    description: 'Empty input -> legacy path (no crash)',
  },
  {
    message: '{}',
    shouldUsePricingGraph: false,
    shouldAskClarification: false,
    shouldFallbackLegacy: true,
    expectedStatus: 200,
    description: 'Invalid JSON string -> legacy path',
  },
];



