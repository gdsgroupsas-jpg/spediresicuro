import { describe, it, expect } from 'vitest';
import { normalizeStatus } from '@/lib/services/tracking/tracking-service';

describe('normalizeStatus - giacenza patterns', () => {
  // Direct giacenza keywords
  it.each([
    ['In giacenza', 'in_giacenza'],
    ['GIACENZA', 'in_giacenza'],
    ['Spedizione in giacenza presso filiale', 'in_giacenza'],
    ['Fermo deposito', 'in_giacenza'],
    ['In deposito', 'in_giacenza'],
    ['Mancata consegna', 'in_giacenza'],
    ['Tentativo di consegna fallito', 'in_giacenza'],
    ['Non consegnabile', 'in_giacenza'],
    ['Destinatario assente', 'in_giacenza'],
  ])('should normalize "%s" to "%s"', (raw, expected) => {
    expect(normalizeStatus(raw)).toBe(expected);
  });

  // Giacenza should take priority over exception
  it('should map "destinatario assente" to in_giacenza, not exception', () => {
    expect(normalizeStatus('Destinatario assente')).toBe('in_giacenza');
  });

  it('should map "mancata consegna - destinatario assente" to in_giacenza', () => {
    expect(normalizeStatus('Mancata consegna - destinatario assente')).toBe('in_giacenza');
  });

  // Other statuses should still work
  it.each([
    ['Consegnata', 'delivered'],
    ['In transito', 'in_transit'],
    ['In consegna', 'out_for_delivery'],
    ['Spedizione generata', 'created'],
    ['Reso al mittente', 'returned'],
    ['Annullata', 'cancelled'],
  ])('should still normalize "%s" to "%s"', (raw, expected) => {
    expect(normalizeStatus(raw)).toBe(expected);
  });

  // Edge cases
  it('should return unknown for empty-like strings', () => {
    expect(normalizeStatus('foo bar')).toBe('unknown');
  });

  // Italian courier specific patterns
  it.each([
    ['GIACENZA APERTA - DESTINATARIO ASSENTE', 'in_giacenza'],
    ['giacenza - indirizzo errato', 'in_giacenza'],
    ['TENTATIVO DI CONSEGNA FALLITO - PORTA CHIUSA', 'in_giacenza'],
    ['Pacco in giacenza presso sede GLS', 'in_giacenza'],
    ['FERMO DEPOSITO SU RICHIESTA', 'in_giacenza'],
  ])('should handle courier pattern "%s"', (raw, expected) => {
    expect(normalizeStatus(raw)).toBe(expected);
  });
});
