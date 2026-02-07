/**
 * Test CRM Intent Detection
 *
 * Verifica che detectCrmIntent() rilevi correttamente gli intent CRM
 * e NON rilevi intent pricing o support come CRM.
 */

import { describe, it, expect } from 'vitest';
import { detectCrmIntent } from '@/lib/agent/intent-detector';

describe('detectCrmIntent', () => {
  // ============================================
  // POSITIVI — deve rilevare
  // ============================================

  it('rileva "come va la pipeline?"', () => {
    expect(detectCrmIntent('come va la pipeline?')).toBe(true);
  });

  it('rileva "quanti lead abbiamo?"', () => {
    expect(detectCrmIntent('quanti lead abbiamo?')).toBe(true);
  });

  it('rileva "quanti prospect ci sono?"', () => {
    expect(detectCrmIntent('quanti prospect ci sono?')).toBe(true);
  });

  it('rileva "chi devo contattare oggi?"', () => {
    expect(detectCrmIntent('chi devo contattare oggi?')).toBe(true);
  });

  it('rileva "cosa devo fare oggi?"', () => {
    expect(detectCrmIntent('cosa devo fare oggi?')).toBe(true);
  });

  it('rileva "mostrami i prospect caldi"', () => {
    expect(detectCrmIntent('mostrami i prospect caldi')).toBe(true);
  });

  it('rileva "tasso di conversione"', () => {
    expect(detectCrmIntent('qual è il tasso di conversione?')).toBe(true);
  });

  it('rileva "azioni di oggi"', () => {
    expect(detectCrmIntent('dammi le azioni di oggi')).toBe(true);
  });

  it('rileva "salute crm"', () => {
    expect(detectCrmIntent("com'è la salute crm?")).toBe(true);
  });

  it('rileva "lead in negoziazione"', () => {
    expect(detectCrmIntent('quanti lead sono in negoziazione?')).toBe(true);
  });

  it('rileva "win-back candidati"', () => {
    expect(detectCrmIntent('ci sono candidati per win-back?')).toBe(true);
  });

  it('rileva "situazione commerciale"', () => {
    expect(detectCrmIntent('come va la situazione commerciale?')).toBe(true);
  });

  it('rileva "lead qualificati"', () => {
    expect(detectCrmIntent('quanti lead qualificato abbiamo?')).toBe(true);
  });

  it('rileva "punteggio lead"', () => {
    expect(detectCrmIntent('che punteggio ha il lead?')).toBe(true);
  });

  // ============================================
  // NEGATIVI — NON deve rilevare
  // ============================================

  it('NON rileva "quanto costa spedire a Roma?" (pricing)', () => {
    expect(detectCrmIntent('quanto costa spedire a Roma?')).toBe(false);
  });

  it('NON rileva "preventivo spedizione 5kg" (pricing)', () => {
    expect(detectCrmIntent('preventivo spedizione 5kg a 00100 RM')).toBe(false);
  });

  it('NON rileva "dove si trova il mio pacco?" (support)', () => {
    expect(detectCrmIntent('dove si trova il mio pacco?')).toBe(false);
  });

  it('NON rileva "tracking BRT123456" (support)', () => {
    expect(detectCrmIntent('traccia il pacco BRT123456')).toBe(false);
  });

  it('NON rileva "ciao come stai?" (general)', () => {
    expect(detectCrmIntent('ciao come stai?')).toBe(false);
  });

  it('NON rileva "buongiorno" (general)', () => {
    expect(detectCrmIntent('buongiorno!')).toBe(false);
  });

  it('NON rileva "stato spedizione 12345" (support)', () => {
    expect(detectCrmIntent('qual è lo stato spedizione 12345?')).toBe(false);
  });

  it('NON rileva "pacco in giacenza" (support)', () => {
    expect(detectCrmIntent('ho un pacco in giacenza')).toBe(false);
  });
});
