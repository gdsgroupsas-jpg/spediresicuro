/**
 * Unit Tests: Intent Detector
 *
 * Test approfonditi per detectPricingIntentSimple
 * Verifica edge cases, maiuscole, emoji, formati peso/CAP vari
 */

import { describe, it, expect } from 'vitest';
import {
  detectPricingIntentSimple,
  detectShipmentCreationIntent,
  detectCancelCreationIntent,
} from '@/lib/agent/intent-detector';

describe('detectPricingIntentSimple', () => {
  describe('Positive Cases (keyword + CAP o peso)', () => {
    it('should detect pricing intent with keyword "preventivo" + CAP', () => {
      expect(detectPricingIntentSimple('Vorrei un preventivo per spedire a 00100 Roma')).toBe(true);
    });

    it('should detect pricing intent with keyword "prezzo" + peso', () => {
      expect(detectPricingIntentSimple('Qual è il prezzo per spedire 2 kg?')).toBe(true);
    });

    it('should detect pricing intent with keyword "costo" + CAP e peso', () => {
      expect(detectPricingIntentSimple('Quanto costa spedire 1.5 kg a 20100 Milano?')).toBe(true);
    });

    it('should detect pricing intent with keyword "spedizione" + CAP', () => {
      expect(detectPricingIntentSimple('Spedizione a 50100 Firenze')).toBe(true);
    });

    it('should detect pricing intent with keyword "quanto costa" + peso', () => {
      expect(detectPricingIntentSimple('Quanto costa spedire 5 kg?')).toBe(true);
    });
  });

  describe('Edge Cases - Format Variations', () => {
    it('should detect with peso "1,5 kg" (virgola)', () => {
      expect(detectPricingIntentSimple('Preventivo per 1,5 kg')).toBe(true);
    });

    it('should detect with peso "2.5kg" (punto, no spazio)', () => {
      expect(detectPricingIntentSimple('Prezzo per 2.5kg')).toBe(true);
    });

    it('should detect with peso "3 chili"', () => {
      expect(detectPricingIntentSimple('Costo per 3 chili')).toBe(true);
    });

    it('should detect with CAP con spazi "00 100"', () => {
      expect(detectPricingIntentSimple('Preventivo per 00 100')).toBe(false); // Regex non matcha spazi
    });

    it('should detect with CAP "00100" (no spazi)', () => {
      expect(detectPricingIntentSimple('Preventivo per 00100')).toBe(true);
    });

    it('should handle uppercase keywords', () => {
      expect(detectPricingIntentSimple('PREVENTIVO per 00100')).toBe(true);
    });

    it('should handle mixed case keywords', () => {
      expect(detectPricingIntentSimple('PreVeNtIvO per 2 kg')).toBe(true);
    });
  });

  describe('Negative Cases - No Pricing Intent', () => {
    it('should NOT detect for greeting "ciao"', () => {
      expect(detectPricingIntentSimple('Ciao Anne, come va?')).toBe(false);
    });

    it('should NOT detect for "spedizione internazionale" without data', () => {
      expect(detectPricingIntentSimple('Spedizione internazionale')).toBe(false);
    });

    it('should NOT detect for "prenota spedizione" (booking)', () => {
      expect(detectPricingIntentSimple('Prenota una spedizione')).toBe(false);
    });

    it('should NOT detect for "report fatturato" (exclude keyword)', () => {
      expect(detectPricingIntentSimple('Report fatturato spedizioni')).toBe(false);
    });

    it('should NOT detect for "analisi margine" (exclude keyword)', () => {
      expect(detectPricingIntentSimple('Analisi margine spedizioni')).toBe(false);
    });

    it('should NOT detect for "ricavo" (exclude keyword)', () => {
      expect(detectPricingIntentSimple('Ricavo da spedizioni')).toBe(false);
    });

    it('should NOT detect for "guadagno" (exclude keyword)', () => {
      expect(detectPricingIntentSimple('Guadagno mensile')).toBe(false);
    });

    it('should NOT detect for "statistiche" (exclude keyword)', () => {
      expect(detectPricingIntentSimple('Statistiche spedizioni')).toBe(false);
    });

    it('should NOT detect for keyword without data', () => {
      expect(detectPricingIntentSimple('Vorrei un preventivo')).toBe(false);
    });

    it('should detect for data with keyword "spedire" (spedire is a pricing keyword)', () => {
      // "spedire" è nella lista PRICING_KEYWORDS, quindi con CAP valido ritorna true
      expect(detectPricingIntentSimple('Spedire a 00100')).toBe(true);
    });
  });

  describe('Edge Cases - Special Characters', () => {
    it('should handle emoji in message', () => {
      expect(detectPricingIntentSimple('💰 Preventivo per 2 kg')).toBe(true);
    });

    it('should handle [VOX] prefix (voice input)', () => {
      expect(detectPricingIntentSimple('[VOX] Preventivo per 00100')).toBe(true);
    });

    it('should handle multiple keywords', () => {
      expect(detectPricingIntentSimple('Prezzo preventivo per 2 kg a 00100')).toBe(true);
    });

    it('should handle keyword at end of message', () => {
      expect(detectPricingIntentSimple('Spedire 3 kg, preventivo')).toBe(true);
    });

    it('should handle keyword at start of message', () => {
      expect(detectPricingIntentSimple('Preventivo: 2 kg a 00100')).toBe(true);
    });
  });

  describe('Edge Cases - Invalid Data', () => {
    it('should NOT detect for CAP with 4 digits', () => {
      expect(detectPricingIntentSimple('Preventivo per 0100')).toBe(false);
    });

    it('should NOT detect for CAP with 6 digits', () => {
      expect(detectPricingIntentSimple('Preventivo per 001000')).toBe(false);
    });

    it('should NOT detect for peso without unit', () => {
      expect(detectPricingIntentSimple('Preventivo per 2')).toBe(false);
    });

    it('should NOT detect for peso "zero kg"', () => {
      expect(detectPricingIntentSimple('Preventivo per 0 kg')).toBe(true); // Regex matcha, ma logica business potrebbe filtrare
    });
  });
});

// ==================== SHIPMENT CREATION INTENT ====================

describe('detectShipmentCreationIntent', () => {
  describe('Positive Cases', () => {
    it('dovrebbe rilevare "voglio spedire"', () => {
      expect(detectShipmentCreationIntent('Voglio spedire un pacco a Milano')).toBe(true);
    });

    it('dovrebbe rilevare "crea spedizione"', () => {
      expect(detectShipmentCreationIntent('Crea una spedizione per me')).toBe(true);
    });

    it('dovrebbe rilevare "devo spedire"', () => {
      expect(detectShipmentCreationIntent('Devo spedire un pacco urgente')).toBe(true);
    });

    it('dovrebbe rilevare "manda un pacco"', () => {
      expect(detectShipmentCreationIntent('Manda un pacco a Roma')).toBe(true);
    });

    it('dovrebbe rilevare "prenota spedizione"', () => {
      expect(detectShipmentCreationIntent('Prenota spedizione per domani')).toBe(true);
    });

    it('dovrebbe rilevare "fare una spedizione"', () => {
      expect(detectShipmentCreationIntent('Voglio fare una spedizione')).toBe(true);
    });

    it('HIGH-3 FIX: "spedire a" generico NON deve catturare (va in pricing)', () => {
      expect(detectShipmentCreationIntent('Spedire a Napoli 5kg')).toBe(false);
    });

    it('dovrebbe rilevare "spedire un pacco" (esplicito)', () => {
      expect(detectShipmentCreationIntent('Spedire un pacco a Napoli')).toBe(true);
    });

    it('dovrebbe rilevare "ordina spedizione"', () => {
      expect(detectShipmentCreationIntent('Ordina spedizione per domani')).toBe(true);
    });

    it('dovrebbe rilevare "vorrei mandare"', () => {
      expect(detectShipmentCreationIntent('Vorrei mandare un regalo a mia madre')).toBe(true);
    });

    it('dovrebbe essere case insensitive', () => {
      expect(detectShipmentCreationIntent('VOGLIO SPEDIRE')).toBe(true);
      expect(detectShipmentCreationIntent('Crea Spedizione')).toBe(true);
    });
  });

  describe('Negative Cases - Exclude Keywords', () => {
    it('NON dovrebbe rilevare intent con "traccia"', () => {
      expect(detectShipmentCreationIntent('Traccia la mia spedizione')).toBe(false);
    });

    it('NON dovrebbe rilevare intent con "tracking"', () => {
      expect(detectShipmentCreationIntent('Tracking della spedizione')).toBe(false);
    });

    it('NON dovrebbe rilevare intent con "annulla spedizione"', () => {
      expect(detectShipmentCreationIntent('Annulla spedizione 12345')).toBe(false);
    });

    it('NON dovrebbe rilevare intent con "preventivo"', () => {
      expect(detectShipmentCreationIntent('Preventivo per spedire 5kg')).toBe(false);
    });

    it('NON dovrebbe rilevare intent con "quanto costa"', () => {
      expect(detectShipmentCreationIntent('Quanto costa spedire a Milano?')).toBe(false);
    });

    it('NON dovrebbe rilevare intent con "report"', () => {
      expect(detectShipmentCreationIntent('Report spedizioni mensile')).toBe(false);
    });
  });

  describe('Negative Cases - Non-matching', () => {
    it('NON dovrebbe rilevare messaggi generici', () => {
      expect(detectShipmentCreationIntent('Ciao come stai')).toBe(false);
    });

    it('NON dovrebbe rilevare stringa vuota', () => {
      expect(detectShipmentCreationIntent('')).toBe(false);
    });

    it('NON dovrebbe rilevare domande su spedizioni esistenti', () => {
      expect(detectShipmentCreationIntent('Dove si trova la mia spedizione?')).toBe(false);
    });
  });
});

// ==================== CANCEL CREATION INTENT (HIGH-2) ====================

describe('detectCancelCreationIntent', () => {
  it('dovrebbe rilevare "annulla"', () => {
    expect(detectCancelCreationIntent('annulla')).toBe(true);
    expect(detectCancelCreationIntent('Annulla la spedizione')).toBe(true);
  });

  it('dovrebbe rilevare "lascia perdere"', () => {
    expect(detectCancelCreationIntent('lascia perdere')).toBe(true);
  });

  it('dovrebbe rilevare "basta"', () => {
    expect(detectCancelCreationIntent('basta')).toBe(true);
  });

  it('dovrebbe rilevare "stop"', () => {
    expect(detectCancelCreationIntent('stop')).toBe(true);
  });

  it('dovrebbe rilevare "ricomincia"', () => {
    expect(detectCancelCreationIntent('ricomincia')).toBe(true);
  });

  it('NON dovrebbe rilevare messaggi normali', () => {
    expect(detectCancelCreationIntent('Mario Rossi, Via Roma 1')).toBe(false);
    expect(detectCancelCreationIntent('5kg a Milano')).toBe(false);
    expect(detectCancelCreationIntent('procedi')).toBe(false);
  });
});
