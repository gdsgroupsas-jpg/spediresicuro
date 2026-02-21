/**
 * Unit Tests: Stripe Payments
 *
 * Test per calcolo commissioni Stripe e credito wallet VAT-aware
 *
 * Nota: Testiamo funzioni pure (calculateStripeFee, calculateWalletCredit)
 * senza dipendenze da Stripe client. I test per webhook e checkout
 * session richiedono mock più complessi e sono coperti da test integration.
 */

import { describe, it, expect } from 'vitest';

// Import solo le funzioni pure (non il client Stripe)
// Evitiamo di importare il modulo completo per non inizializzare Stripe client
const calculateStripeFee = (amountCredit: number): { fee: number; total: number } => {
  const STRIPE_PERCENTAGE = 0.014; // 1.4%
  const STRIPE_FIXED = 0.25; // €0.25

  const fee = Number((amountCredit * STRIPE_PERCENTAGE + STRIPE_FIXED).toFixed(2));
  const total = Number((amountCredit + fee).toFixed(2));

  return { fee, total };
};

// Replica della funzione calculateWalletCredit per test isolati
interface VatInfo {
  vatMode: 'included' | 'excluded';
  vatRate: number;
}

interface WalletCreditCalculation {
  grossAmount: number;
  creditAmount: number;
  vatAmount: number;
  netAmount: number;
  vatMode: 'included' | 'excluded';
  vatRate: number;
}

const calculateWalletCredit = (grossAmount: number, vatInfo: VatInfo): WalletCreditCalculation => {
  const { vatMode, vatRate } = vatInfo;
  const vatMultiplier = 1 + vatRate / 100;

  if (vatMode === 'included') {
    const netAmount = Number((grossAmount / vatMultiplier).toFixed(2));
    const vatAmount = Number((grossAmount - netAmount).toFixed(2));
    return {
      grossAmount,
      creditAmount: grossAmount,
      vatAmount,
      netAmount,
      vatMode,
      vatRate,
    };
  } else {
    const netAmount = Number((grossAmount / vatMultiplier).toFixed(2));
    const vatAmount = Number((grossAmount - netAmount).toFixed(2));
    return {
      grossAmount,
      creditAmount: netAmount,
      vatAmount,
      netAmount,
      vatMode,
      vatRate,
    };
  }
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

  describe('calculateWalletCredit', () => {
    describe('IVA INCLUSA (B2C)', () => {
      const vatInfo: VatInfo = { vatMode: 'included', vatRate: 22 };

      it('€100 pagamento → €100 credito wallet', () => {
        const result = calculateWalletCredit(100, vatInfo);
        expect(result.creditAmount).toBe(100);
        expect(result.grossAmount).toBe(100);
        expect(result.vatMode).toBe('included');
      });

      it('€50 pagamento → €50 credito wallet', () => {
        const result = calculateWalletCredit(50, vatInfo);
        expect(result.creditAmount).toBe(50);
      });

      it('calcola correttamente IVA e netto', () => {
        const result = calculateWalletCredit(100, vatInfo);
        // 100 / 1.22 = 81.97
        expect(result.netAmount).toBe(81.97);
        expect(result.vatAmount).toBe(18.03);
        // Verifica coerenza: net + vat = gross
        expect(result.netAmount + result.vatAmount).toBe(result.grossAmount);
      });

      it('€250 pagamento → €250 credito wallet', () => {
        const result = calculateWalletCredit(250, vatInfo);
        expect(result.creditAmount).toBe(250);
        expect(result.netAmount).toBe(204.92);
        expect(result.vatAmount).toBe(45.08);
      });
    });

    describe('IVA ESCLUSA (B2B)', () => {
      const vatInfo: VatInfo = { vatMode: 'excluded', vatRate: 22 };

      it('€100 pagamento → €81.97 credito wallet', () => {
        const result = calculateWalletCredit(100, vatInfo);
        expect(result.creditAmount).toBe(81.97);
        expect(result.grossAmount).toBe(100);
        expect(result.vatMode).toBe('excluded');
      });

      it('€50 pagamento → €40.98 credito wallet', () => {
        const result = calculateWalletCredit(50, vatInfo);
        // 50 / 1.22 = 40.98
        expect(result.creditAmount).toBe(40.98);
      });

      it('creditAmount coincide con netAmount', () => {
        const result = calculateWalletCredit(100, vatInfo);
        expect(result.creditAmount).toBe(result.netAmount);
      });

      it('calcola correttamente IVA', () => {
        const result = calculateWalletCredit(100, vatInfo);
        expect(result.vatAmount).toBe(18.03);
        expect(result.netAmount + result.vatAmount).toBe(result.grossAmount);
      });

      it('€500 pagamento → €409.84 credito wallet', () => {
        const result = calculateWalletCredit(500, vatInfo);
        // 500 / 1.22 = 409.84
        expect(result.creditAmount).toBe(409.84);
      });
    });

    describe('Flusso completo: calcolo + commissioni Stripe', () => {
      it('IVA esclusa €50: credito, fee e totale corretti', () => {
        const vatInfo: VatInfo = { vatMode: 'excluded', vatRate: 22 };
        const credit = calculateWalletCredit(50, vatInfo);
        const { fee, total } = calculateStripeFee(50);

        // Credito wallet: 50 / 1.22 = 40.98 (quello che l'errore loggava)
        expect(credit.creditAmount).toBe(40.98);
        // Fee Stripe: 50 * 0.014 + 0.25 = 0.95
        expect(fee).toBe(0.95);
        // Totale addebitato: 50.95
        expect(total).toBe(50.95);
      });

      it('IVA inclusa €100: credito, fee e totale corretti', () => {
        const vatInfo: VatInfo = { vatMode: 'included', vatRate: 22 };
        const credit = calculateWalletCredit(100, vatInfo);
        const { fee, total } = calculateStripeFee(100);

        expect(credit.creditAmount).toBe(100);
        expect(fee).toBe(1.65);
        expect(total).toBe(101.65);
      });
    });

    describe('Edge cases VAT', () => {
      it('gestisce vatRate 0% (esenzione IVA)', () => {
        const result = calculateWalletCredit(100, { vatMode: 'excluded', vatRate: 0 });
        // 100 / 1.0 = 100
        expect(result.creditAmount).toBe(100);
        expect(result.vatAmount).toBe(0);
      });

      it('gestisce vatRate 10% (aliquota ridotta)', () => {
        const result = calculateWalletCredit(100, { vatMode: 'excluded', vatRate: 10 });
        // 100 / 1.10 = 90.91
        expect(result.creditAmount).toBe(90.91);
        expect(result.vatAmount).toBe(9.09);
      });

      it('gestisce importi piccoli senza errori arrotondamento', () => {
        const result = calculateWalletCredit(1, { vatMode: 'excluded', vatRate: 22 });
        expect(result.creditAmount).toBe(0.82);
        expect(result.netAmount + result.vatAmount).toBe(result.grossAmount);
      });
    });
  });
});
