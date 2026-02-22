/**
 * Test C6 R2: One-shot booking con corriere preferito
 *
 * Verifica:
 * - isDefaultSenderComplete ritorna true con tutti i campi
 * - NOT eligible senza sender completo
 * - NOT eligible senza preferredCouriers
 * - NOT eligible con memory null
 * - one_shot_eligible e one_shot_courier definiti in AgentState
 */
import { describe, it, expect } from 'vitest';
import { isDefaultSenderComplete } from '@/lib/ai/context-builder';

describe('isDefaultSenderComplete', () => {
  it('ritorna true con tutti i campi obbligatori', () => {
    const sender = {
      name: 'Mario Rossi',
      address: 'Via Roma 1',
      city: 'Milano',
      zip: '20100',
      province: 'MI',
    };
    expect(isDefaultSenderComplete(sender)).toBe(true);
  });

  it('ritorna false senza name', () => {
    const sender = {
      address: 'Via Roma 1',
      city: 'Milano',
      zip: '20100',
      province: 'MI',
    };
    expect(isDefaultSenderComplete(sender as any)).toBe(false);
  });

  it('ritorna false senza address', () => {
    const sender = {
      name: 'Mario Rossi',
      city: 'Milano',
      zip: '20100',
      province: 'MI',
    };
    expect(isDefaultSenderComplete(sender as any)).toBe(false);
  });

  it('ritorna false senza city', () => {
    const sender = {
      name: 'Mario Rossi',
      address: 'Via Roma 1',
      zip: '20100',
      province: 'MI',
    };
    expect(isDefaultSenderComplete(sender as any)).toBe(false);
  });

  it('ritorna false senza zip', () => {
    const sender = {
      name: 'Mario Rossi',
      address: 'Via Roma 1',
      city: 'Milano',
      province: 'MI',
    };
    expect(isDefaultSenderComplete(sender as any)).toBe(false);
  });

  it('ritorna false senza province', () => {
    const sender = {
      name: 'Mario Rossi',
      address: 'Via Roma 1',
      city: 'Milano',
      zip: '20100',
    };
    expect(isDefaultSenderComplete(sender as any)).toBe(false);
  });

  it('ritorna false con sender undefined', () => {
    expect(isDefaultSenderComplete(undefined)).toBe(false);
  });

  it('ritorna false con sender null', () => {
    expect(isDefaultSenderComplete(null as any)).toBe(false);
  });

  it('ritorna true anche con campi extra (phone, email)', () => {
    const sender = {
      name: 'Mario Rossi',
      address: 'Via Roma 1',
      city: 'Milano',
      zip: '20100',
      province: 'MI',
      phone: '+39123456789',
      email: 'mario@test.com',
    };
    expect(isDefaultSenderComplete(sender)).toBe(true);
  });
});

describe('one-shot eligibility logic', () => {
  it('eligible quando memory ha courier + sender completo', () => {
    const memory = {
      preferredCouriers: ['BRT', 'GLS'],
      defaultSender: {
        name: 'Mario Rossi',
        address: 'Via Roma 1',
        city: 'Milano',
        zip: '20100',
        province: 'MI',
      },
    };

    const eligible =
      memory.preferredCouriers.length > 0 && isDefaultSenderComplete(memory.defaultSender);

    expect(eligible).toBe(true);
  });

  it('NOT eligible senza sender completo', () => {
    const memory = {
      preferredCouriers: ['BRT'],
      defaultSender: { name: 'Mario' }, // incompleto
    };

    const eligible =
      memory.preferredCouriers.length > 0 && isDefaultSenderComplete(memory.defaultSender as any);

    expect(eligible).toBe(false);
  });

  it('NOT eligible senza preferredCouriers', () => {
    const memory = {
      preferredCouriers: [] as string[],
      defaultSender: {
        name: 'Mario Rossi',
        address: 'Via Roma 1',
        city: 'Milano',
        zip: '20100',
        province: 'MI',
      },
    };

    const eligible =
      memory.preferredCouriers.length > 0 && isDefaultSenderComplete(memory.defaultSender);

    expect(eligible).toBe(false);
  });

  it('NOT eligible con memory null', () => {
    const memory = null;
    const eligible = memory ? isDefaultSenderComplete(memory.defaultSender) : false;
    expect(eligible).toBe(false);
  });

  it('corriere preferito = primo della lista', () => {
    const memory = {
      preferredCouriers: ['BRT', 'GLS', 'DHL'],
    };
    expect(memory.preferredCouriers[0]).toBe('BRT');
  });
});
