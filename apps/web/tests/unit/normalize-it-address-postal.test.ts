/**
 * Unit Tests: normalize-it-address.ts - Postal Normalization
 *
 * Test coverage per le nuove funzionalità di normalizzazione postale:
 * - normalizeStreetForPostal: abbreviazioni standard postali italiane
 * - extractStreetNumber: separazione via e numero civico
 */

import { describe, it, expect } from 'vitest';
import { normalizeStreetForPostal, extractStreetNumber } from '@/lib/address/normalize-it-address';

// ==================== normalizeStreetForPostal ====================

describe('normalizeStreetForPostal', () => {
  it('abbrevia "Via" in "V."', () => {
    expect(normalizeStreetForPostal('Via Roma 20')).toBe('V. Roma 20');
  });

  it('abbrevia "Piazza" in "P.zza"', () => {
    expect(normalizeStreetForPostal('Piazza Garibaldi 1')).toBe('P.zza Garibaldi 1');
  });

  it('abbrevia "Corso" in "C.so"', () => {
    expect(normalizeStreetForPostal('Corso Vittorio Emanuele II')).toBe(
      'C.so Vittorio Emanuele II'
    );
  });

  it('abbrevia "Viale" in "V.le"', () => {
    expect(normalizeStreetForPostal('Viale dei Giardini 5')).toBe('V.le dei Giardini 5');
  });

  it('abbrevia "Largo" in "L.go"', () => {
    expect(normalizeStreetForPostal('Largo Augusto 3')).toBe('L.go Augusto 3');
  });

  it('abbrevia "Vicolo" in "Vic."', () => {
    expect(normalizeStreetForPostal('Vicolo Stretto 7')).toBe('Vic. Stretto 7');
  });

  it('abbrevia "Contrada" in "C.da"', () => {
    expect(normalizeStreetForPostal('Contrada San Giovanni')).toBe('C.da San Giovanni');
  });

  it('abbrevia "Piazzale" in "P.le"', () => {
    expect(normalizeStreetForPostal('Piazzale Loreto')).toBe('P.le Loreto');
  });

  it('gestisce case insensitive', () => {
    expect(normalizeStreetForPostal('VIA ROMA 20')).toBe('V. ROMA 20');
    expect(normalizeStreetForPostal('via roma 20')).toBe('V. roma 20');
  });

  it('gestisce stringa vuota', () => {
    expect(normalizeStreetForPostal('')).toBe('');
  });

  it('non modifica indirizzi già abbreviati', () => {
    expect(normalizeStreetForPostal('V. Roma 20')).toBe('V. Roma 20');
  });

  it('normalizza spazi multipli', () => {
    expect(normalizeStreetForPostal('Via  Roma   20')).toBe('V. Roma 20');
  });
});

// ==================== extractStreetNumber ====================

describe('extractStreetNumber', () => {
  it('estrae numero civico semplice', () => {
    const result = extractStreetNumber('Via Roma 20');
    expect(result.street).toBe('Via Roma');
    expect(result.number).toBe('20');
  });

  it('estrae numero civico con lettera', () => {
    const result = extractStreetNumber('Via Roma 20/A');
    expect(result.street).toBe('Via Roma');
    expect(result.number).toBe('20/A');
  });

  it('estrae numero civico con "bis"', () => {
    const result = extractStreetNumber('Via Roma 20 bis');
    expect(result.street).toBe('Via Roma');
    expect(result.number).toBe('20BIS');
  });

  it('gestisce indirizzo senza numero civico', () => {
    const result = extractStreetNumber('Via Roma');
    expect(result.street).toBe('Via Roma');
    expect(result.number).toBeNull();
  });

  it('gestisce stringa vuota', () => {
    const result = extractStreetNumber('');
    expect(result.street).toBe('');
    expect(result.number).toBeNull();
  });

  it('gestisce indirizzo complesso', () => {
    const result = extractStreetNumber('Corso Vittorio Emanuele II 104');
    expect(result.street).toBe('Corso Vittorio Emanuele II');
    expect(result.number).toBe('104');
  });

  it('gestisce numero con slash e sotto-numero', () => {
    const result = extractStreetNumber('Via Manzoni 15/3');
    expect(result.street).toBe('Via Manzoni');
    expect(result.number).toBe('15/3');
  });
});
