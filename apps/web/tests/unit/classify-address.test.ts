/**
 * Unit Tests: classify-address.ts
 *
 * Test coverage per classificazione indirizzo residenziale/business:
 * - Business con P.IVA
 * - Business con forma societaria (SRL, SPA, etc.)
 * - Business con keyword indirizzo (Zona Industriale, etc.)
 * - Residenziale (nessun indicatore)
 * - Unknown (indicatori deboli)
 */

import { describe, it, expect } from 'vitest';
import { classifyAddress } from '@/lib/address/classify-address';

// ==================== BUSINESS ====================

describe('classifyAddress - business', () => {
  it('classifica come business con P.IVA valida', () => {
    const result = classifyAddress({ vatNumber: 'IT12345678901' });
    expect(result.type).toBe('business');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.reasons).toContain('P.IVA valida presente');
  });

  it('classifica come business con P.IVA senza prefisso IT', () => {
    const result = classifyAddress({ vatNumber: '12345678901' });
    expect(result.type).toBe('business');
  });

  it('classifica come business con forma societaria SRL', () => {
    const result = classifyAddress({ companyName: 'Acme S.r.l.' });
    expect(result.type).toBe('business');
    expect(result.reasons.some((r) => r.includes('Forma societaria'))).toBe(true);
  });

  it('classifica come business con forma societaria SPA', () => {
    const result = classifyAddress({ companyName: 'Grande Azienda S.p.A.' });
    expect(result.type).toBe('business');
  });

  it('classifica come business con forma societaria SNC', () => {
    const result = classifyAddress({ companyName: 'Fratelli Rossi snc' });
    expect(result.type).toBe('business');
  });

  it('classifica come business con keyword Zona Industriale', () => {
    const result = classifyAddress({
      addressLine1: 'Via della Meccanica 5, Zona Industriale',
    });
    expect(result.type).toBe('business');
  });

  it('classifica come business con c/o', () => {
    const result = classifyAddress({
      addressLine1: 'c/o Magazzino Centrale',
    });
    expect(result.type).toBe('business');
  });

  it('classifica come business con combinazione P.IVA + companyName', () => {
    const result = classifyAddress({
      companyName: 'Tech Solutions SRL',
      vatNumber: 'IT98765432101',
    });
    expect(result.type).toBe('business');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });
});

// ==================== RESIDENTIAL ====================

describe('classifyAddress - residential', () => {
  it('classifica come residenziale senza indicatori business', () => {
    const result = classifyAddress({
      fullName: 'Mario Rossi',
      addressLine1: 'Via Roma 20',
    });
    expect(result.type).toBe('residential');
  });

  it('classifica come residenziale con solo nome', () => {
    const result = classifyAddress({ fullName: 'Anna Bianchi' });
    expect(result.type).toBe('residential');
  });

  it('classifica come residenziale con input vuoto', () => {
    const result = classifyAddress({});
    expect(result.type).toBe('residential');
  });
});

// ==================== UNKNOWN ====================

describe('classifyAddress - unknown', () => {
  it('classifica come unknown con solo nome azienda generico (senza forma societaria)', () => {
    const result = classifyAddress({ companyName: 'Studio Legale Rossi' });
    expect(result.type).toBe('unknown');
  });
});

// ==================== EDGE CASES ====================

describe('classifyAddress - edge cases', () => {
  it('gestisce P.IVA con formato strano', () => {
    const result = classifyAddress({ vatNumber: 'abc' });
    // P.IVA invalida non conta come indicatore business
    expect(result.type).not.toBe('business');
  });

  it('gestisce companyName vuoto', () => {
    const result = classifyAddress({ companyName: '' });
    expect(result.type).toBe('residential');
  });

  it('keyword business nelle note', () => {
    const result = classifyAddress({
      recipientNotes: 'Consegnare al magazzino retro',
    });
    expect(result.reasons.some((r) => r.includes('note'))).toBe(true);
  });
});
