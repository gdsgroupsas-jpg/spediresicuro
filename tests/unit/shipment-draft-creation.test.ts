/**
 * Test: calculateMissingFieldsForShipment e hasEnoughDataForShipmentCreation
 *
 * Verifica che i campi obbligatori per creare una spedizione completa
 * vengano rilevati correttamente come mancanti o presenti.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMissingFieldsForShipment,
  hasEnoughDataForShipmentCreation,
  ShipmentDraft,
} from '@/lib/address/shipment-draft';

describe('calculateMissingFieldsForShipment', () => {
  it('dovrebbe restituire tutti i campi mancanti per draft vuoto', () => {
    const missing = calculateMissingFieldsForShipment(undefined);
    expect(missing).toContain('recipient.fullName');
    expect(missing).toContain('recipient.addressLine1');
    expect(missing).toContain('recipient.city');
    expect(missing).toContain('recipient.postalCode');
    expect(missing).toContain('recipient.province');
    expect(missing).toContain('parcel.weightKg');
    expect(missing).toHaveLength(6);
  });

  it('dovrebbe restituire lista vuota per draft completo', () => {
    const draft: ShipmentDraft = {
      recipient: {
        fullName: 'Mario Rossi',
        addressLine1: 'Via Roma 1',
        city: 'Milano',
        postalCode: '20100',
        province: 'MI',
        country: 'IT',
      },
      parcel: { weightKg: 5 },
      missingFields: [],
    };
    expect(calculateMissingFieldsForShipment(draft)).toHaveLength(0);
  });

  it('dovrebbe rilevare solo i campi effettivamente mancanti', () => {
    const draft: ShipmentDraft = {
      recipient: {
        fullName: 'Mario Rossi',
        city: 'Milano',
        province: 'MI',
        country: 'IT',
      },
      parcel: { weightKg: 5 },
      missingFields: [],
    };
    const missing = calculateMissingFieldsForShipment(draft);
    expect(missing).toContain('recipient.addressLine1');
    expect(missing).toContain('recipient.postalCode');
    expect(missing).toHaveLength(2);
  });

  it('dovrebbe rilevare peso mancante se parcel vuoto', () => {
    const draft: ShipmentDraft = {
      recipient: {
        fullName: 'Mario Rossi',
        addressLine1: 'Via Roma 1',
        city: 'Milano',
        postalCode: '20100',
        province: 'MI',
        country: 'IT',
      },
      parcel: {},
      missingFields: [],
    };
    const missing = calculateMissingFieldsForShipment(draft);
    expect(missing).toEqual(['parcel.weightKg']);
  });

  it('dovrebbe gestire recipient undefined', () => {
    const draft: ShipmentDraft = {
      parcel: { weightKg: 5 },
      missingFields: [],
    };
    const missing = calculateMissingFieldsForShipment(draft);
    expect(missing).toHaveLength(5); // tutti i campi recipient
  });
});

describe('hasEnoughDataForShipmentCreation', () => {
  it('dovrebbe restituire false per draft vuoto', () => {
    expect(hasEnoughDataForShipmentCreation(undefined)).toBe(false);
  });

  it('dovrebbe restituire false per draft parziale', () => {
    const draft: ShipmentDraft = {
      recipient: { fullName: 'Mario Rossi', country: 'IT' },
      parcel: { weightKg: 5 },
      missingFields: [],
    };
    expect(hasEnoughDataForShipmentCreation(draft)).toBe(false);
  });

  it('dovrebbe restituire true per draft completo', () => {
    const draft: ShipmentDraft = {
      recipient: {
        fullName: 'Mario Rossi',
        addressLine1: 'Via Roma 1',
        city: 'Milano',
        postalCode: '20100',
        province: 'MI',
        country: 'IT',
      },
      parcel: { weightKg: 5 },
      missingFields: [],
    };
    expect(hasEnoughDataForShipmentCreation(draft)).toBe(true);
  });
});
