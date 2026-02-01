/**
 * Unit tests per lib/ai/case-learning.ts
 *
 * Testa: extractKeywords, sanitizePII (via extractKeywords), calculateMatchScore (via findSimilarPatterns)
 */

import { describe, it, expect } from 'vitest';
import { extractKeywords } from '@/lib/ai/case-learning';

// ═══════════════════════════════════════════════════════════════════════════
// extractKeywords
// ═══════════════════════════════════════════════════════════════════════════

describe('extractKeywords', () => {
  it('estrae parole di dominio dal testo', () => {
    const result = extractKeywords('La mia spedizione è in giacenza, il pacco è bloccato');
    expect(result).toContain('spedizione');
    expect(result).toContain('giacenza');
    expect(result).toContain('pacco');
    expect(result).toContain('bloccato');
  });

  it('rimuove stop words italiane', () => {
    const result = extractKeywords('il mio pacco non è arrivato della spedizione');
    expect(result).not.toContain('mio');
    expect(result).not.toContain('non');
    expect(result).not.toContain('della');
    expect(result).toContain('pacco');
    expect(result).toContain('arrivato');
    expect(result).toContain('spedizione');
  });

  it('ignora parole non nel dominio (nomi propri, parole generiche)', () => {
    const result = extractKeywords('Giovanni Rossi ha un problema con il pacco');
    // Giovanni e Rossi non sono nel dominio
    expect(result).not.toContain('giovanni');
    expect(result).not.toContain('rossi');
    expect(result).toContain('problema');
    expect(result).toContain('pacco');
  });

  it('riconosce nomi corrieri', () => {
    const result = extractKeywords('problema con GLS il pacco è in ritardo');
    expect(result).toContain('gls');
    expect(result).toContain('pacco');
    expect(result).toContain('ritardo');
  });

  it('sanitizza email prima di estrarre keywords', () => {
    const result = extractKeywords('contattare mario@example.com per il pacco in giacenza');
    expect(result).not.toContain('mario');
    expect(result).not.toContain('example');
    expect(result).toContain('pacco');
    expect(result).toContain('giacenza');
  });

  it('sanitizza numeri di telefono italiani', () => {
    const result = extractKeywords('chiamare +39 333 1234567 per il pacco smarrito');
    expect(result).not.toContain('333');
    expect(result).not.toContain('1234567');
    expect(result).toContain('pacco');
    expect(result).toContain('smarrito');
  });

  it('sanitizza codici fiscali', () => {
    const result = extractKeywords('codice fiscale RSSMRA80A01H501U pacco in giacenza');
    expect(result).not.toContain('rssmra80a01h501u');
    expect(result).toContain('pacco');
    expect(result).toContain('giacenza');
  });

  it('sanitizza tracking numbers lunghi', () => {
    const result = extractKeywords('tracking BRT1234567890 spedizione in transito');
    expect(result).not.toContain('brt1234567890');
    expect(result).toContain('tracking');
    expect(result).toContain('spedizione');
    expect(result).toContain('transito');
  });

  it('limita a max 10 keywords', () => {
    const longText =
      'giacenza smarrita persa danneggiata ritardo bloccata consegnata rifiutata mancante errato sbagliato pacco spedizione tracking rimborso';
    const result = extractKeywords(longText);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it('ritorna array vuoto per testo vuoto', () => {
    expect(extractKeywords('')).toEqual([]);
  });

  it('ritorna array vuoto per testo senza parole di dominio', () => {
    const result = extractKeywords('buongiorno come stai oggi');
    expect(result).toEqual([]);
  });

  it('converte tutto in lowercase', () => {
    const result = extractKeywords('GIACENZA PACCO BLOCCATO');
    expect(result).toContain('giacenza');
    expect(result).toContain('pacco');
    expect(result).toContain('bloccato');
  });

  it('gestisce caratteri accentati italiani', () => {
    const result = extractKeywords('spedizione già consegnata è arrivata');
    expect(result).toContain('spedizione');
    expect(result).toContain('consegnata');
    expect(result).toContain('arrivata');
  });

  it('sanitizza CAP (5 cifre)', () => {
    const result = extractKeywords('spedizione a 20100 Milano pacco in transito');
    // 20100 dovrebbe essere rimosso
    expect(result).not.toContain('20100');
    expect(result).toContain('spedizione');
    expect(result).toContain('pacco');
    expect(result).toContain('transito');
  });

  it('sanitizza partita IVA (11 cifre)', () => {
    const result = extractKeywords('P.IVA 12345678901 pacco in giacenza');
    expect(result).not.toContain('12345678901');
    expect(result).toContain('pacco');
    expect(result).toContain('giacenza');
  });
});
