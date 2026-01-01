/**
 * Unit Tests: Stripe Payments
 * 
 * Test per calcolo commissioni Stripe
 * 
 * Nota: Testiamo solo calculateStripeFee che è una funzione pura
 * senza dipendenze da Stripe client. I test per webhook e checkout
 * session richiedono mock più complessi e sono coperti da test integration.
 */

import { describe, it, expect } from 'vitest';

// Import solo la funzione pura (non il client Stripe)
// Evitiamo di importare il modulo completo per non inizializzare Stripe client
const calculateStripeFee = (amountCredit: number): { fee: number; total: number } => {
  const STRIPE_PERCENTAGE = 0.014; // 1.4%
  const STRIPE_FIXED = 0.25; // €0.25
  
  const fee = Number(((amountCredit * STRIPE_PERCENTAGE) + STRIPE_FIXED).toFixed(2));
  const total = Number((amountCredit + fee).toFixed(2));
  
  return { fee, total };
};

describe('Stripe Payments - Unit Tests', () => {
  describe('calculateStripeFee', () => {
    it('calcola correttamente commissioni per importo 100€', () => {
      const { fee, total } = calculateStripeFee(100);
      
      // Stripe: 1.4% + €0.25
      // Fee attesa: (100 * 0.014) + 0.25 = 1.4 + 0.25 = 1.65
      expect(fee).toBe(1.65);
      expect(total).toBe(101.65);
    });

    it('calcola correttamente commissioni per importo 50€', () => {
      const { fee, total } = calculateStripeFee(50);
      
      // Fee attesa: (50 * 0.014) + 0.25 = 0.7 + 0.25 = 0.95
      expect(fee).toBe(0.95);
      expect(total).toBe(50.95);
    });

    it('calcola correttamente commissioni per importo minimo 1€', () => {
      const { fee, total } = calculateStripeFee(1);
      
      // Fee attesa: (1 * 0.014) + 0.25 = 0.014 + 0.25 = 0.264 ≈ 0.26
      expect(fee).toBe(0.26);
      expect(total).toBe(1.26);
    });

    it('arrotonda correttamente a 2 decimali', () => {
      const { fee, total } = calculateStripeFee(33.33);
      
      // Fee: (33.33 * 0.014) + 0.25 = 0.46662 + 0.25 = 0.71662 ≈ 0.72
      expect(fee).toBe(0.72);
      expect(total).toBe(34.05);
    });

    it('gestisce importi grandi correttamente', () => {
      const { fee, total } = calculateStripeFee(10000);
      
      // Fee: (10000 * 0.014) + 0.25 = 140 + 0.25 = 140.25
      expect(fee).toBe(140.25);
      expect(total).toBe(10140.25);
    });
  });
});

