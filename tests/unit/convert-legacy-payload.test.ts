import { describe, it, expect } from 'vitest';
import {
  convertLegacyPayload,
  type LegacyPayload,
  type StandardPayload,
} from '@/lib/shipments/convert-legacy-payload';

describe('convertLegacyPayload', () => {
  describe('passthrough for standard format', () => {
    it('should return standard payload unchanged', () => {
      const standardPayload: StandardPayload = {
        sender: {
          name: 'Mario Rossi',
          address: 'Via Roma 1',
          city: 'Milano',
          province: 'MI',
          postalCode: '20100',
          country: 'IT',
          email: 'mario@example.com',
        },
        recipient: {
          name: 'Luigi Verdi',
          address: 'Via Napoli 2',
          city: 'Roma',
          province: 'RM',
          postalCode: '00100',
          country: 'IT',
        },
        packages: [{ weight: 5, length: 20, width: 15, height: 10 }],
        carrier: 'GLS',
        provider: 'spediscionline',
      };

      const result = convertLegacyPayload(standardPayload);
      expect(result).toEqual(standardPayload);
    });
  });

  describe('legacy to standard conversion', () => {
    it('should convert complete legacy payload', () => {
      const legacyPayload: LegacyPayload = {
        mittenteNome: 'Mario Rossi',
        mittenteAzienda: 'Rossi SRL',
        mittenteIndirizzo: 'Via Roma 1',
        mittenteIndirizzo2: 'Piano 3',
        mittenteCitta: 'Milano',
        mittenteProvincia: 'MI',
        mittenteCap: '20100',
        mittenteCountry: 'IT',
        mittenteTelefono: '0212345678',
        mittenteEmail: 'mario@rossi.it',
        destinatarioNome: 'Luigi Verdi',
        destinatarioAzienda: 'Verdi SPA',
        destinatarioIndirizzo: 'Via Napoli 2',
        destinatarioIndirizzo2: 'Interno 5',
        destinatarioCitta: 'Roma',
        destinatarioProvincia: 'RM',
        destinatarioCap: '00100',
        destinatarioCountry: 'IT',
        destinatarioTelefono: '0698765432',
        destinatarioEmail: 'luigi@verdi.it',
        peso: '5.5',
        lunghezza: '30',
        larghezza: '20',
        altezza: '15',
        corriere: 'gls',
        provider: 'spediscionline',
        note: 'Fragile',
        configId: 'config-123',
        selectedContractId: 'contract-456',
      };

      const result = convertLegacyPayload(legacyPayload);

      expect(result.sender.name).toBe('Mario Rossi');
      expect(result.sender.company).toBe('Rossi SRL');
      expect(result.sender.address).toBe('Via Roma 1');
      expect(result.sender.address2).toBe('Piano 3');
      expect(result.sender.city).toBe('Milano');
      expect(result.sender.province).toBe('MI');
      expect(result.sender.postalCode).toBe('20100');
      expect(result.sender.country).toBe('IT');
      expect(result.sender.phone).toBe('0212345678');
      expect(result.sender.email).toBe('mario@rossi.it');

      expect(result.recipient.name).toBe('Luigi Verdi');
      expect(result.recipient.company).toBe('Verdi SPA');
      expect(result.recipient.address).toBe('Via Napoli 2');
      expect(result.recipient.city).toBe('Roma');
      expect(result.recipient.province).toBe('RM');
      expect(result.recipient.postalCode).toBe('00100');

      expect(result.packages[0].weight).toBe(5.5);
      expect(result.packages[0].length).toBe(30);
      expect(result.packages[0].width).toBe(20);
      expect(result.packages[0].height).toBe(15);

      expect(result.carrier).toBe('GLS'); // uppercase
      expect(result.provider).toBe('spediscionline');
      expect(result.notes).toBe('Fragile');
      expect(result.configId).toBe('config-123');
      expect(result.contract_id).toBe('contract-456');
    });

    it('should use defaults for missing fields', () => {
      const minimalLegacy: LegacyPayload = {
        mittenteNome: 'Test Sender',
        destinatarioNome: 'Test Recipient',
      };

      const result = convertLegacyPayload(minimalLegacy);

      // Sender defaults
      expect(result.sender.name).toBe('Test Sender');
      expect(result.sender.address).toBe('');
      expect(result.sender.city).toBe('');
      expect(result.sender.province).toBe('');
      expect(result.sender.postalCode).toBe('');
      expect(result.sender.country).toBe('IT');
      expect(result.sender.email).toBe('noemail@spediresicuro.it');

      // Package defaults
      expect(result.packages[0].weight).toBe(1);
      expect(result.packages[0].length).toBe(10);
      expect(result.packages[0].width).toBe(10);
      expect(result.packages[0].height).toBe(10);

      // Provider default
      expect(result.provider).toBe('spediscionline');
    });

    it('should handle carrier field variations', () => {
      // Test with corriere field
      const withCorriere: LegacyPayload = {
        mittenteNome: 'Test',
        corriere: 'brt',
      };
      expect(convertLegacyPayload(withCorriere).carrier).toBe('BRT');

      // Test with carrier field
      const withCarrier: LegacyPayload = {
        mittenteNome: 'Test',
        carrier: 'dhl',
      };
      expect(convertLegacyPayload(withCarrier).carrier).toBe('DHL');

      // Test with both (corriere takes precedence)
      const withBoth: LegacyPayload = {
        mittenteNome: 'Test',
        corriere: 'gls',
        carrier: 'ups',
      };
      expect(convertLegacyPayload(withBoth).carrier).toBe('GLS');
    });

    it('should handle numeric weight/dimension values', () => {
      const withNumericValues: LegacyPayload = {
        mittenteNome: 'Test',
        peso: 10.5,
        lunghezza: 25,
        larghezza: 18,
        altezza: 12,
      };

      const result = convertLegacyPayload(withNumericValues);
      expect(result.packages[0].weight).toBe(10.5);
      expect(result.packages[0].length).toBe(25);
      expect(result.packages[0].width).toBe(18);
      expect(result.packages[0].height).toBe(12);
    });

    it('should handle invalid weight/dimension values', () => {
      const withInvalidValues: LegacyPayload = {
        mittenteNome: 'Test',
        peso: 'invalid',
        lunghezza: '',
        larghezza: undefined,
        altezza: 'abc',
      };

      const result = convertLegacyPayload(withInvalidValues);
      // Should use defaults for NaN values
      expect(result.packages[0].weight).toBe(1);
      expect(result.packages[0].length).toBe(10);
      expect(result.packages[0].width).toBe(10);
      expect(result.packages[0].height).toBe(10);
    });
  });

  describe('COD handling', () => {
    it('should add COD when contrassegnoAmount is positive', () => {
      const withCOD: LegacyPayload = {
        mittenteNome: 'Test',
        contrassegnoAmount: '150.50',
      };

      const result = convertLegacyPayload(withCOD);
      expect(result.cod).toEqual({ value: 150.5 });
    });

    it('should not add COD when contrassegnoAmount is zero', () => {
      const withZeroCOD: LegacyPayload = {
        mittenteNome: 'Test',
        contrassegnoAmount: '0',
      };

      const result = convertLegacyPayload(withZeroCOD);
      expect(result.cod).toBeUndefined();
    });

    it('should not add COD when contrassegnoAmount is negative', () => {
      const withNegativeCOD: LegacyPayload = {
        mittenteNome: 'Test',
        contrassegnoAmount: '-50',
      };

      const result = convertLegacyPayload(withNegativeCOD);
      expect(result.cod).toBeUndefined();
    });

    it('should handle numeric contrassegnoAmount', () => {
      const withNumericCOD: LegacyPayload = {
        mittenteNome: 'Test',
        contrassegnoAmount: 200,
      };

      const result = convertLegacyPayload(withNumericCOD);
      expect(result.cod).toEqual({ value: 200 });
    });
  });

  describe('VAT and pricing fields', () => {
    it('should preserve VAT fields', () => {
      const withVAT: LegacyPayload = {
        mittenteNome: 'Test',
        vat_mode: 'included',
        vat_rate: 22,
      };

      const result = convertLegacyPayload(withVAT);
      expect(result.vat_mode).toBe('included');
      expect(result.vat_rate).toBe(22);
    });

    it('should preserve pricing fields', () => {
      const withPricing: LegacyPayload = {
        mittenteNome: 'Test',
        base_price: 10.0,
        final_price: 12.2,
        priceListId: 'price-list-123',
      };

      const result = convertLegacyPayload(withPricing);
      expect(result.base_price).toBe(10.0);
      expect(result.final_price).toBe(12.2);
      expect(result.priceListId).toBe('price-list-123');
    });
  });

  describe('edge cases', () => {
    it('should handle empty object', () => {
      const emptyPayload = {};
      // Not legacy format, returned as-is (may fail validation later)
      const result = convertLegacyPayload(emptyPayload as any);
      expect(result).toEqual({});
    });

    it('should handle partial standard format', () => {
      // Has sender but not recipient - not standard format but also not legacy
      const partialStandard = {
        sender: { name: 'Test' },
      };
      const result = convertLegacyPayload(partialStandard as any);
      expect(result).toEqual(partialStandard);
    });

    it('should handle only destinatarioNome', () => {
      const onlyRecipient: LegacyPayload = {
        destinatarioNome: 'Test Recipient',
      };

      const result = convertLegacyPayload(onlyRecipient);
      expect(result.sender.name).toBe('');
      expect(result.recipient.name).toBe('Test Recipient');
    });
  });
});
