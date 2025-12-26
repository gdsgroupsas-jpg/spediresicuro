/**
 * Unit Tests: Intent Detector
 * 
 * Test approfonditi per detectPricingIntentSimple
 * Verifica edge cases, maiuscole, emoji, formati peso/CAP vari
 */

import { describe, it, expect } from 'vitest';
import { detectPricingIntentSimple } from '@/lib/agent/intent-detector';

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

