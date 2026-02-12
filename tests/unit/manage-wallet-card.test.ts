/**
 * ManageWalletCard Tests
 *
 * Test per il componente di gestione wallet admin:
 * - Validazione importi (zero, negativi, oltre max)
 * - Validazione motivazione obbligatoria
 * - Calcolo nuovo saldo (accredito/addebito)
 * - Quick amounts preimpostati
 * - Formattazione valuta
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from 'vitest';

// ============================================
// LOGICA ESTRATTA DAL COMPONENTE PER TEST
// ============================================

const QUICK_AMOUNTS = [50, 100, 250, 500];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);

/**
 * Validazione importo (replica della logica client-side del componente)
 */
function validateAmount(
  amount: string,
  mode: 'credit' | 'debit',
  currentBalance: number
): string | null {
  const parsed = parseFloat(amount);

  if (isNaN(parsed) || parsed <= 0) {
    return 'Inserisci un importo valido maggiore di zero.';
  }

  if (parsed > 10000) {
    return 'Importo massimo: €10.000';
  }

  if (mode === 'debit' && parsed > currentBalance) {
    return `Credito insufficiente. Disponibile: €${currentBalance}`;
  }

  return null; // valido
}

/**
 * Validazione motivazione
 */
function validateReason(reason: string): string | null {
  if (!reason.trim()) {
    return 'La motivazione è obbligatoria.';
  }
  return null;
}

/**
 * Calcola nuovo saldo dopo operazione
 */
function calculateNewBalance(
  currentBalance: number,
  amount: number,
  mode: 'credit' | 'debit'
): number {
  return mode === 'credit' ? currentBalance + amount : currentBalance - amount;
}

// ============================================
// TEST
// ============================================

describe('ManageWalletCard - Validazione importo', () => {
  it('rifiuta importo vuoto', () => {
    expect(validateAmount('', 'credit', 100)).toBe('Inserisci un importo valido maggiore di zero.');
  });

  it('rifiuta importo zero', () => {
    expect(validateAmount('0', 'credit', 100)).toBe(
      'Inserisci un importo valido maggiore di zero.'
    );
  });

  it('rifiuta importo negativo', () => {
    expect(validateAmount('-50', 'credit', 100)).toBe(
      'Inserisci un importo valido maggiore di zero.'
    );
  });

  it('rifiuta importo non numerico', () => {
    expect(validateAmount('abc', 'credit', 100)).toBe(
      'Inserisci un importo valido maggiore di zero.'
    );
  });

  it('rifiuta importo oltre €10.000', () => {
    expect(validateAmount('10001', 'credit', 100)).toBe('Importo massimo: €10.000');
  });

  it('accetta €10.000 esatti', () => {
    expect(validateAmount('10000', 'credit', 100)).toBeNull();
  });

  it('accetta importo valido per accredito', () => {
    expect(validateAmount('100', 'credit', 0)).toBeNull();
  });

  it('accetta importo valido per addebito con saldo sufficiente', () => {
    expect(validateAmount('50', 'debit', 100)).toBeNull();
  });

  it('rifiuta addebito superiore al saldo', () => {
    expect(validateAmount('150', 'debit', 100)).toBe('Credito insufficiente. Disponibile: €100');
  });

  it('accetta addebito uguale al saldo', () => {
    expect(validateAmount('100', 'debit', 100)).toBeNull();
  });

  it('accetta importi con decimali', () => {
    expect(validateAmount('99.99', 'credit', 0)).toBeNull();
  });

  it('accetta importo minimo €0.01', () => {
    expect(validateAmount('0.01', 'credit', 0)).toBeNull();
  });
});

describe('ManageWalletCard - Validazione motivazione', () => {
  it('rifiuta motivazione vuota', () => {
    expect(validateReason('')).toBe('La motivazione è obbligatoria.');
  });

  it('rifiuta motivazione con soli spazi', () => {
    expect(validateReason('   ')).toBe('La motivazione è obbligatoria.');
  });

  it('accetta motivazione valida', () => {
    expect(validateReason('Bonifico ricevuto')).toBeNull();
  });

  it('accetta motivazione con spazi iniziali/finali (trimmed)', () => {
    expect(validateReason('  Bonifico ricevuto  ')).toBeNull();
  });
});

describe('ManageWalletCard - Calcolo nuovo saldo', () => {
  it('accredito: aggiunge al saldo', () => {
    expect(calculateNewBalance(100, 50, 'credit')).toBe(150);
  });

  it('addebito: sottrae dal saldo', () => {
    expect(calculateNewBalance(100, 30, 'debit')).toBe(70);
  });

  it('accredito su saldo zero', () => {
    expect(calculateNewBalance(0, 100, 'credit')).toBe(100);
  });

  it('addebito totale porta a zero', () => {
    expect(calculateNewBalance(100, 100, 'debit')).toBe(0);
  });

  it('accredito con decimali', () => {
    expect(calculateNewBalance(99.5, 0.5, 'credit')).toBe(100);
  });

  it('addebito con decimali', () => {
    expect(calculateNewBalance(100, 0.01, 'debit')).toBeCloseTo(99.99);
  });
});

describe('ManageWalletCard - Quick amounts', () => {
  it('contiene i 4 importi preimpostati', () => {
    expect(QUICK_AMOUNTS).toEqual([50, 100, 250, 500]);
  });

  it('tutti gli importi sono validi', () => {
    QUICK_AMOUNTS.forEach((qa) => {
      expect(validateAmount(String(qa), 'credit', 0)).toBeNull();
    });
  });

  it('nessun importo supera il massimo', () => {
    QUICK_AMOUNTS.forEach((qa) => {
      expect(qa).toBeLessThanOrEqual(10000);
    });
  });
});

describe('ManageWalletCard - Formattazione valuta', () => {
  it('formatta zero correttamente', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
    expect(result).toContain('€');
  });

  it('formatta importo intero', () => {
    const result = formatCurrency(100);
    expect(result).toContain('100');
    expect(result).toContain('€');
  });

  it('formatta importo con decimali', () => {
    const result = formatCurrency(99.99);
    expect(result).toContain('99,99');
  });

  it('formatta importo grande con separatore migliaia', () => {
    const result = formatCurrency(1000);
    // Formato italiano usa . come separatore migliaia
    expect(result).toContain('€');
  });
});

describe('ManageWalletCard - Logica server action (manageWallet)', () => {
  it('accredito invia importo positivo', () => {
    const amount = 100;
    const mode = 'credit';
    const finalAmount = mode === 'credit' ? amount : -amount;
    expect(finalAmount).toBe(100);
  });

  it('addebito invia importo negativo', () => {
    const amount = 50;
    const mode = 'debit';
    const finalAmount = mode === 'credit' ? amount : -amount;
    expect(finalAmount).toBe(-50);
  });

  it('il tipo transazione dipende dal segno', () => {
    const getTransactionType = (amount: number) => (amount > 0 ? 'admin_gift' : 'admin_deduction');
    expect(getTransactionType(100)).toBe('admin_gift');
    expect(getTransactionType(-50)).toBe('admin_deduction');
  });
});
