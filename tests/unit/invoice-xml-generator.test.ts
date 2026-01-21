/**
 * Unit Tests: Invoice XML Generator (FatturaPA)
 *
 * Testa generazione XML conforme formato FatturaPA 1.2.1
 *
 * @module tests/unit/invoice-xml-generator.test
 */

import { describe, it, expect } from 'vitest';
import {
  generateInvoiceXML,
  validateFatturaPAData,
  FatturaPAData,
} from '@/lib/invoices/xml-generator';

describe('Invoice XML Generator (FatturaPA)', () => {
  const baseInvoiceData: FatturaPAData = {
    invoiceNumber: '2026-0001',
    issueDate: new Date('2026-01-15'),
    dueDate: new Date('2026-02-14'),
    sender: {
      companyName: 'GDS Group SAS',
      vatNumber: 'IT12345678901',
      taxCode: 'GDSGRP1234567890',
      address: 'Via Test 123',
      city: 'Milano',
      province: 'MI',
      zip: '20100',
      country: 'Italia',
      sdiCode: 'XXXXXXX',
      pec: 'test@pec.it',
    },
    recipient: {
      name: 'Cliente Test SRL',
      vatNumber: 'IT98765432109',
      taxCode: 'CLITST9876543210',
      address: 'Via Cliente 456',
      city: 'Roma',
      province: 'RM',
      zip: '00100',
      country: 'Italia',
    },
    items: [
      {
        description: 'Ricarica wallet',
        quantity: 1,
        unitPrice: 100.0,
        vatRate: 22,
        total: 100.0,
      },
    ],
    paymentMethod: 'Bonifico bancario',
    iban: 'IT60X0542811101000000123456',
    sdiCode: 'XXXXXXX',
  };

  describe('validateFatturaPAData', () => {
    it('dovrebbe validare dati corretti', () => {
      const errors = validateFatturaPAData(baseInvoiceData);
      expect(errors).toHaveLength(0);
    });

    it('dovrebbe rilevare P.IVA mittente mancante', () => {
      const invalid = { ...baseInvoiceData, sender: { ...baseInvoiceData.sender, vatNumber: '' } };
      const errors = validateFatturaPAData(invalid);
      expect(errors).toContain('P.IVA mittente obbligatoria e deve essere di almeno 11 caratteri');
    });

    it('dovrebbe rilevare Codice Fiscale mittente mancante', () => {
      const invalid = { ...baseInvoiceData, sender: { ...baseInvoiceData.sender, taxCode: '' } };
      const errors = validateFatturaPAData(invalid);
      expect(errors).toContain(
        'Codice Fiscale mittente obbligatorio e deve essere di 16 caratteri'
      );
    });

    it('dovrebbe rilevare Codice SDI mancante', () => {
      const invalid = { ...baseInvoiceData, sdiCode: undefined, pec: undefined };
      const errors = validateFatturaPAData(invalid);
      expect(errors).toContain(
        'Codice SDI o PEC destinatario obbligatorio per fatturazione elettronica'
      );
    });

    it('dovrebbe accettare PEC invece di SDI', () => {
      const withPEC = { ...baseInvoiceData, sdiCode: undefined, pec: 'cliente@pec.it' };
      const errors = validateFatturaPAData(withPEC);
      expect(errors).toHaveLength(0);
    });

    it('dovrebbe rilevare items vuoti', () => {
      const invalid = { ...baseInvoiceData, items: [] };
      const errors = validateFatturaPAData(invalid);
      expect(errors).toContain('Almeno una riga fattura obbligatoria');
    });
  });

  describe('generateInvoiceXML', () => {
    it('dovrebbe generare XML valido', async () => {
      const xml = await generateInvoiceXML(baseInvoiceData);
      expect(xml).toBeInstanceOf(Buffer);
      expect(xml.length).toBeGreaterThan(0);
    });

    it('dovrebbe includere tutti i dati obbligatori', async () => {
      const xml = await generateInvoiceXML(baseInvoiceData);
      const xmlString = xml.toString('utf-8');

      expect(xmlString).toContain('FatturaElettronica');
      expect(xmlString).toContain('GDS Group SAS');
      expect(xmlString).toContain('Cliente Test SRL');
      // L'XML FatturaPA separa IdPaese e IdCodice, quindi cerchiamo solo il codice numerico
      expect(xmlString).toContain('12345678901');
      expect(xmlString).toContain('<IdPaese>IT</IdPaese>');
      // Il numero fattura nel formato FatturaPA non include l'anno con prefisso
      expect(xmlString).toContain('0001');
      expect(xmlString).toContain('100.00');
    });

    it('dovrebbe escape caratteri XML speciali', async () => {
      const withSpecialChars = {
        ...baseInvoiceData,
        items: [
          {
            description: 'Test & < > " \' caratteri speciali',
            quantity: 1,
            unitPrice: 50.0,
            vatRate: 22,
            total: 50.0,
          },
        ],
      };

      const xml = await generateInvoiceXML(withSpecialChars);
      const xmlString = xml.toString('utf-8');

      expect(xmlString).toContain('&amp;');
      expect(xmlString).toContain('&lt;');
      expect(xmlString).toContain('&gt;');
      expect(xmlString).not.toContain('<description>Test & < >');
    });

    it('dovrebbe generare XML conforme FatturaPA 1.2.1', async () => {
      const xml = await generateInvoiceXML(baseInvoiceData);
      const xmlString = xml.toString('utf-8');

      // Verifica namespace e versione
      expect(xmlString).toContain(
        'xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"'
      );
      expect(xmlString).toContain('versione="FPA12"');

      // Verifica struttura base
      expect(xmlString).toContain('<FatturaElettronicaHeader>');
      expect(xmlString).toContain('<FatturaElettronicaBody>');
      expect(xmlString).toContain('<DatiTrasmissione>');
      expect(xmlString).toContain('<CedentePrestatore>');
      expect(xmlString).toContain('<CessionarioCommittente>');
    });

    it('dovrebbe fallire con dati incompleti', async () => {
      const invalid = { ...baseInvoiceData, sender: { ...baseInvoiceData.sender, vatNumber: '' } };

      await expect(generateInvoiceXML(invalid)).rejects.toThrow();
    });

    it('dovrebbe supportare fatture con più righe', async () => {
      const multiItem = {
        ...baseInvoiceData,
        items: [
          {
            description: 'Ricarica wallet - Gennaio',
            quantity: 1,
            unitPrice: 100.0,
            vatRate: 22,
            total: 100.0,
          },
          {
            description: 'Ricarica wallet - Febbraio',
            quantity: 1,
            unitPrice: 150.0,
            vatRate: 22,
            total: 150.0,
          },
        ],
      };

      const xml = await generateInvoiceXML(multiItem);
      const xmlString = xml.toString('utf-8');

      expect(xmlString).toContain('<NumeroLinea>1</NumeroLinea>');
      expect(xmlString).toContain('<NumeroLinea>2</NumeroLinea>');
      expect(xmlString).toContain('250.00'); // Totale imponibile
    });

    it('dovrebbe calcolare correttamente IVA e totali', async () => {
      const xml = await generateInvoiceXML(baseInvoiceData);
      const xmlString = xml.toString('utf-8');

      // Imponibile: 100.00
      expect(xmlString).toContain('<ImponibileImporto>100.00</ImponibileImporto>');
      // IVA 22%: 22.00
      expect(xmlString).toContain('<Imposta>22.00</Imposta>');
      // Totale: 122.00
      expect(xmlString).toContain('<ImportoPagamento>122.00</ImportoPagamento>');
    });
  });
});
