/**
 * Test: PDF Generator preventivi commerciali
 *
 * Verifica generazione PDF: buffer valido, branding, clausole.
 * Mock di jsPDF per test unit (no rendering reale).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CommercialQuote } from '@/types/commercial-quotes';
import type { OrganizationBranding } from '@/types/workspace';

// Mock jsPDF
const mockText = vi.fn();
const mockSetFontSize = vi.fn();
const mockSetFont = vi.fn();
const mockSetTextColor = vi.fn();
const mockSetDrawColor = vi.fn();
const mockSetFillColor = vi.fn();
const mockSetLineWidth = vi.fn();
const mockLine = vi.fn();
const mockRoundedRect = vi.fn();
const mockAddImage = vi.fn();
const mockAddPage = vi.fn();
const mockOutput = vi.fn().mockReturnValue(new ArrayBuffer(100));
const mockAutoTable = vi.fn();

const mockDoc = {
  text: mockText,
  setFontSize: mockSetFontSize,
  setFont: mockSetFont,
  setTextColor: mockSetTextColor,
  setDrawColor: mockSetDrawColor,
  setFillColor: mockSetFillColor,
  setLineWidth: mockSetLineWidth,
  line: mockLine,
  roundedRect: mockRoundedRect,
  addImage: mockAddImage,
  addPage: mockAddPage,
  output: mockOutput,
  autoTable: mockAutoTable,
  lastAutoTable: { finalY: 150 },
};

vi.mock('jspdf', () => ({
  jsPDF: vi.fn(() => mockDoc),
}));

vi.mock('jspdf-autotable', () => ({}));

// Mock fetch per logo
global.fetch = vi.fn();

import { generateCommercialQuotePDF } from '@/lib/commercial-quotes/pdf-generator';

// Quote mock
const createMockQuote = (overrides?: Partial<CommercialQuote>): CommercialQuote => ({
  id: 'quote-123',
  workspace_id: 'ws-123',
  created_by: 'user-123',
  prospect_company: 'SELFIE SRL',
  prospect_contact_name: 'Mario Rossi',
  prospect_email: 'mario@selfie.it',
  prospect_phone: '+39 333 1234567',
  prospect_sector: 'ecommerce',
  prospect_estimated_volume: 100,
  prospect_notes: null,
  carrier_code: 'gls-GLS-5000',
  contract_code: 'gls-GLS-5000',
  price_list_id: 'pl-123',
  margin_percent: 20,
  validity_days: 30,
  delivery_mode: 'carrier_pickup',
  pickup_fee: null,
  goods_needs_processing: false,
  processing_fee: null,
  revision: 1,
  parent_quote_id: null,
  revision_notes: null,
  price_matrix: {
    zones: ['Italia', 'Sicilia', 'Sardegna'],
    weight_ranges: [
      { from: 0, to: 5, label: '0 - 5 kg' },
      { from: 5, to: 10, label: '5 - 10 kg' },
    ],
    prices: [
      [6.0, 8.4, 9.0],
      [9.6, 12.0, 13.2],
    ],
    services_included: [],
    carrier_display_name: 'GLS',
    vat_mode: 'excluded',
    vat_rate: 22,
    pickup_fee: null,
    delivery_mode: 'carrier_pickup',
    goods_needs_processing: false,
    processing_fee: null,
    generated_at: '2026-02-07T10:00:00.000Z',
  },
  additional_carriers: null,
  price_includes: null,
  clauses: [
    { title: 'IVA', text: 'Prezzi IVA esclusa (22%)', type: 'standard' },
    { title: 'Ritiro', text: 'Ritiro gratuito presso la sede del mittente', type: 'standard' },
  ],
  currency: 'EUR',
  vat_mode: 'excluded',
  vat_rate: 22,
  status: 'draft',
  sent_at: null,
  responded_at: null,
  response_notes: null,
  expires_at: null,
  pdf_storage_path: null,
  converted_user_id: null,
  converted_price_list_id: null,
  original_margin_percent: 20,
  created_at: '2026-02-07T10:00:00.000Z',
  updated_at: '2026-02-07T10:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockOutput.mockReturnValue(new ArrayBuffer(100));
  mockAutoTable.mockImplementation(() => {});
  (mockDoc as any).lastAutoTable = { finalY: 150 };
});

describe('generateCommercialQuotePDF', () => {
  it('dovrebbe generare un Buffer valido', async () => {
    const result = await generateCommercialQuotePDF(createMockQuote());
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it('dovrebbe scrivere il titolo PREVENTIVO', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    expect(mockText).toHaveBeenCalledWith(
      'PREVENTIVO',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: 'right' })
    );
  });

  it('dovrebbe scrivere il nome del prospect', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    expect(mockText).toHaveBeenCalledWith('SELFIE SRL', expect.any(Number), expect.any(Number));
  });

  it('dovrebbe scrivere il nome del corriere nel servizio', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    expect(mockText).toHaveBeenCalledWith(
      expect.stringContaining('GLS'),
      expect.any(Number),
      expect.any(Number),
      expect.any(Object)
    );
  });

  it('dovrebbe chiamare autoTable per la matrice prezzi', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    expect(mockAutoTable).toHaveBeenCalled();
  });

  it('dovrebbe scrivere la data di emissione', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    // Verifica che almeno un testo contenga "Data:"
    const dateCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('Data:')
    );
    expect(dateCalls.length).toBeGreaterThan(0);
  });

  it('dovrebbe mostrare revisione solo se > 1', async () => {
    await generateCommercialQuotePDF(createMockQuote({ revision: 1 }));
    const rev1Calls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('Rev.')
    );
    expect(rev1Calls.length).toBe(0);

    vi.clearAllMocks();
    mockOutput.mockReturnValue(new ArrayBuffer(100));
    (mockDoc as any).lastAutoTable = { finalY: 150 };

    await generateCommercialQuotePDF(createMockQuote({ revision: 3 }));
    const rev3Calls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('Rev. 3')
    );
    expect(rev3Calls.length).toBe(1);
  });

  it('dovrebbe includere le clausole nel PDF', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    // Clausole sono scritte con bullet point
    const clauseCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('\u2022')
    );
    expect(clauseCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('dovrebbe gestire quote senza clausole', async () => {
    const result = await generateCommercialQuotePDF(createMockQuote({ clauses: [] }));
    expect(result).toBeInstanceOf(Buffer);
  });

  it('dovrebbe scrivere "SpedireSicuro.it" come fallback senza logo', async () => {
    await generateCommercialQuotePDF(createMockQuote(), null);
    const logoCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('SpedireSicuro')
    );
    expect(logoCalls.length).toBeGreaterThan(0);
  });

  it('dovrebbe tentare di caricare il logo con branding', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      headers: new Map([['content-type', 'image/png']]),
    });

    const branding: OrganizationBranding = {
      logo_url: 'https://example.com/logo.png',
      primary_color: '#ff5500',
    };

    await generateCommercialQuotePDF(createMockQuote(), branding);
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/logo.png', expect.any(Object));
  });

  it('dovrebbe includere il footer con contatti', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    const footerCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('SPEDIRESICURO')
    );
    expect(footerCalls.length).toBeGreaterThan(0);
  });

  it('dovrebbe includere sezione peso volumetrico', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    const volCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('PESO VOLUMETRICO')
    );
    expect(volCalls.length).toBe(1);
  });

  it('dovrebbe includere sezione servizi aggiuntivi', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    const servicesCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('SERVIZI AGGIUNTIVI')
    );
    expect(servicesCalls.length).toBe(1);
  });

  // --- Test Lavorazione Merce nel PDF ---

  it('dovrebbe includere sezione LAVORAZIONE MERCE se goods_needs_processing=true', async () => {
    await generateCommercialQuotePDF(
      createMockQuote({
        goods_needs_processing: true,
        processing_fee: 1.5,
        price_matrix: {
          ...createMockQuote().price_matrix,
          goods_needs_processing: true,
          processing_fee: 1.5,
        },
      })
    );
    const processingCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('LAVORAZIONE')
    );
    expect(processingCalls.length).toBeGreaterThan(0);
  });

  it('dovrebbe NON includere sezione LAVORAZIONE MERCE se goods_needs_processing=false', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    const processingCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('LAVORAZIONE MERCE')
    );
    expect(processingCalls.length).toBe(0);
  });

  // --- Test Multi-corriere nel PDF ---

  it('dovrebbe generare PDF con corrieri aggiuntivi', async () => {
    await generateCommercialQuotePDF(
      createMockQuote({
        additional_carriers: [
          {
            carrier_code: 'brt-BRT-3000',
            contract_code: 'brt-BRT-3000',
            price_matrix: {
              ...createMockQuote().price_matrix,
              carrier_display_name: 'BRT',
            },
          },
        ],
      })
    );
    // Deve chiamare autoTable almeno 2 volte (primario + alternativa)
    expect(mockAutoTable.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('dovrebbe NON generare tabelle extra senza corrieri aggiuntivi', async () => {
    vi.clearAllMocks();
    mockOutput.mockReturnValue(new ArrayBuffer(100));
    (mockDoc as any).lastAutoTable = { finalY: 150 };

    await generateCommercialQuotePDF(createMockQuote({ additional_carriers: null }));
    // Solo 1 autoTable per matrice primaria
    expect(mockAutoTable.mock.calls.length).toBe(1);
  });
});
