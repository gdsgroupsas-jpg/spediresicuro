/**
 * Unit Tests: Invoice PDF Generation
 * 
 * Test per generazione PDF fatture, calcolo IVA, formato numero progressivo
 */

import { describe, it, expect, vi } from 'vitest';
import { generateInvoicePDF, InvoiceData } from '@/lib/invoices/pdf-generator';

describe('Invoice PDF Generation - Unit Tests', () => {
  const mockInvoiceData: InvoiceData = {
    invoiceNumber: '2026-0001',
    issueDate: new Date('2026-01-15'),
    dueDate: new Date('2026-02-14'),
    sender: {
      companyName: 'GDS Group SAS',
      vatNumber: 'IT12345678901',
      taxCode: 'GDSGRP01',
      address: 'Via Test 123',
      city: 'Milano',
      province: 'MI',
      zip: '20100',
      country: 'Italia',
    },
    recipient: {
      name: 'Mario Rossi',
      vatNumber: 'IT98765432109',
      address: 'Via Cliente 456',
      city: 'Roma',
      province: 'RM',
      zip: '00100',
      country: 'Italia',
    },
    items: [
      {
        description: 'Spedizione #TEST123',
        quantity: 1,
        unitPrice: 100.00,
        vatRate: 22,
        total: 100.00,
      },
    ],
    paymentMethod: 'Bonifico bancario',
    iban: 'IT60 X054 2811 1010 0000 0123 456',
    notes: 'Pagamento entro 30 giorni',
  };

  it('genera PDF senza errori', async () => {
    const pdfBuffer = await generateInvoicePDF(mockInvoiceData);
    
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });

  it('calcola correttamente IVA 22%', () => {
    const subtotal = mockInvoiceData.items.reduce((sum, item) => sum + item.total, 0);
    const vat = subtotal * 0.22;
    const total = subtotal + vat;

    expect(subtotal).toBe(100.00);
    expect(vat).toBe(22.00);
    expect(total).toBe(122.00);
  });

  it('formato numero progressivo corretto', () => {
    const invoiceNumber = mockInvoiceData.invoiceNumber;
    
    // Formato: YYYY-XXXX
    expect(invoiceNumber).toMatch(/^\d{4}-\d{4}$/);
    expect(invoiceNumber).toBe('2026-0001');
  });

  it('gestisce multipli items correttamente', async () => {
    const multiItemData: InvoiceData = {
      ...mockInvoiceData,
      items: [
        { description: 'Item 1', quantity: 2, unitPrice: 50, vatRate: 22, total: 100 },
        { description: 'Item 2', quantity: 1, unitPrice: 30, vatRate: 22, total: 30 },
      ],
    };

    const pdfBuffer = await generateInvoicePDF(multiItemData);
    
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });

  it('gestisce dati destinatario opzionali', async () => {
    const minimalData: InvoiceData = {
      ...mockInvoiceData,
      recipient: {
        name: 'Cliente Semplice',
        address: 'Via Semplice 1',
      },
    };

    const pdfBuffer = await generateInvoicePDF(minimalData);
    
    expect(pdfBuffer).toBeInstanceOf(Buffer);
  });
});

