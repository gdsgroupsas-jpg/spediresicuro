/**
 * Test: PDF Generator preventivi commerciali — Premium Corporate
 *
 * Verifica generazione PDF: buffer valido, branding, clausole,
 * footer white-label, numerazione pagine.
 * Mock di jsPDF per test unit (no rendering reale).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CommercialQuote } from '@/types/commercial-quotes';
import type { OrganizationBranding, OrganizationFooterInfo } from '@/types/workspace';

// Mock jsPDF
const mockText = vi.fn();
const mockSetFontSize = vi.fn();
const mockSetFont = vi.fn();
const mockSetTextColor = vi.fn();
const mockSetDrawColor = vi.fn();
const mockSetFillColor = vi.fn();
const mockSetLineWidth = vi.fn();
const mockLine = vi.fn();
const mockRect = vi.fn();
const mockRoundedRect = vi.fn();
const mockAddImage = vi.fn();
const mockAddPage = vi.fn();
const mockSetPage = vi.fn();
const mockGetNumberOfPages = vi.fn().mockReturnValue(1);
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
  rect: mockRect,
  roundedRect: mockRoundedRect,
  addImage: mockAddImage,
  addPage: mockAddPage,
  setPage: mockSetPage,
  getNumberOfPages: mockGetNumberOfPages,
  output: mockOutput,
  autoTable: mockAutoTable,
  lastAutoTable: { finalY: 150 },
};

vi.mock('jspdf', () => ({
  jsPDF: vi.fn(() => mockDoc),
}));

vi.mock('jspdf-autotable', () => ({
  autoTable: mockAutoTable,
  default: mockAutoTable,
}));

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

// Org info mock per test white-label
const createMockOrgInfo = (
  overrides?: Partial<OrganizationFooterInfo>
): OrganizationFooterInfo => ({
  name: 'GDS Group SAS',
  vat_number: '12345678901',
  billing_email: 'info@gdsgroup.it',
  billing_address: {
    via: 'Via Roma 42',
    cap: '80100',
    citta: 'Napoli',
    provincia: 'NA',
  },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockOutput.mockReturnValue(new ArrayBuffer(100));
  mockAutoTable.mockImplementation(() => {});
  mockGetNumberOfPages.mockReturnValue(1);
  (mockDoc as any).lastAutoTable = { finalY: 150 };
});

describe('generateCommercialQuotePDF', () => {
  it('dovrebbe generare un Buffer valido', async () => {
    const result = await generateCommercialQuotePDF(createMockQuote());
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it('dovrebbe scrivere il titolo PREVENTIVO COMMERCIALE', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    expect(mockText).toHaveBeenCalledWith(
      'PREVENTIVO COMMERCIALE',
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

  it('dovrebbe usare margini simmetrici (15mm) nella matrice', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    const tableCall = mockAutoTable.mock.calls[0];
    const options = tableCall[1];
    expect(options.margin.left).toBe(15);
    expect(options.margin.right).toBe(15);
  });

  it('dovrebbe scrivere la data di emissione', async () => {
    await generateCommercialQuotePDF(createMockQuote());
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
    mockGetNumberOfPages.mockReturnValue(1);
    (mockDoc as any).lastAutoTable = { finalY: 150 };

    await generateCommercialQuotePDF(createMockQuote({ revision: 3 }));
    const rev3Calls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('Rev. 3')
    );
    expect(rev3Calls.length).toBe(1);
  });

  it('dovrebbe includere le clausole nel PDF', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    const clauseCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('\u2022')
    );
    expect(clauseCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('dovrebbe gestire quote senza clausole', async () => {
    const result = await generateCommercialQuotePDF(createMockQuote({ clauses: [] }));
    expect(result).toBeInstanceOf(Buffer);
  });

  it('dovrebbe scrivere "SpedireSicuro.it" come fallback senza logo/orgInfo', async () => {
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

  it('dovrebbe includere il footer SPEDIRESICURO senza orgInfo', async () => {
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

  it('dovrebbe usare divisore volumetrico personalizzato nel PDF', async () => {
    await generateCommercialQuotePDF(createMockQuote(), null, null, null, 6000);
    const formulaCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('/ 6000')
    );
    expect(formulaCalls.length).toBeGreaterThanOrEqual(1);
    // Verifica che 5000 NON appaia nella formula
    const oldFormula = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('/ 5000')
    );
    expect(oldFormula.length).toBe(0);
  });

  it('dovrebbe usare 5000 come divisore volumetrico di default', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    const formulaCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('/ 5000')
    );
    expect(formulaCalls.length).toBeGreaterThanOrEqual(1);
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
    mockGetNumberOfPages.mockReturnValue(1);
    (mockDoc as any).lastAutoTable = { finalY: 150 };

    await generateCommercialQuotePDF(createMockQuote({ additional_carriers: null }));
    // Solo 1 autoTable per matrice primaria
    expect(mockAutoTable.mock.calls.length).toBe(1);
  });

  // --- Test Footer White-Label ---

  it('dovrebbe mostrare nome reseller nel footer con orgInfo', async () => {
    const orgInfo = createMockOrgInfo();
    await generateCommercialQuotePDF(createMockQuote(), null, orgInfo);
    const orgNameCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0] === 'GDS GROUP SAS'
    );
    expect(orgNameCalls.length).toBeGreaterThan(0);
  });

  it('dovrebbe mostrare P.IVA reseller nel footer con orgInfo', async () => {
    const orgInfo = createMockOrgInfo();
    await generateCommercialQuotePDF(createMockQuote(), null, orgInfo);
    const pivaCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('P.IVA: 12345678901')
    );
    expect(pivaCalls.length).toBeGreaterThan(0);
  });

  it('dovrebbe mostrare "Powered by SpedireSicuro.it" con orgInfo', async () => {
    const orgInfo = createMockOrgInfo();
    await generateCommercialQuotePDF(createMockQuote(), null, orgInfo);
    const poweredCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('Powered by SpedireSicuro.it')
    );
    expect(poweredCalls.length).toBeGreaterThan(0);
  });

  it('dovrebbe mostrare footer SpedireSicuro senza orgInfo', async () => {
    await generateCommercialQuotePDF(createMockQuote(), null, null);
    const spedireCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0] === 'SPEDIRESICURO.IT'
    );
    expect(spedireCalls.length).toBeGreaterThan(0);

    const poweredCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('Powered by SpedireSicuro')
    );
    expect(poweredCalls.length).toBe(0);
  });

  it('dovrebbe avere numerazione pagine nel footer', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    const pageNumCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('1 / 1')
    );
    expect(pageNumCalls.length).toBe(1);
  });

  it('dovrebbe usare nome organizzazione nell header se orgInfo presente', async () => {
    const orgInfo = createMockOrgInfo();
    await generateCommercialQuotePDF(createMockQuote(), null, orgInfo);
    const headerCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0] === 'GDS Group SAS'
    );
    // Nome originale (non uppercase) nell'header
    expect(headerCalls.length).toBeGreaterThan(0);
  });

  it('dovrebbe usare DESTINATARIO come label box prospect', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    const destCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0] === 'DESTINATARIO'
    );
    expect(destCalls.length).toBe(1);
  });

  it('dovrebbe usare CONDIZIONI come titolo clausole', async () => {
    await generateCommercialQuotePDF(createMockQuote());
    const condCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0] === 'CONDIZIONI'
    );
    expect(condCalls.length).toBe(1);
  });

  it('dovrebbe usare OPZIONE B per alternative multi-corriere', async () => {
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
    const opzioneCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('OPZIONE B')
    );
    expect(opzioneCalls.length).toBe(1);
  });

  // --- Test Servizi Dinamici ---

  it('dovrebbe mostrare servizi dinamici nel PDF quando enabledServices presente', async () => {
    const enabledServices = [
      { service: 'Preavviso Telefonico', price: 0.61, percent: 0 },
      { service: 'Consegna Sabato', price: 122.0, percent: 0 },
    ];
    await generateCommercialQuotePDF(createMockQuote(), null, null, enabledServices);

    const preavvisoCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('Preavviso Telefonico')
    );
    expect(preavvisoCalls.length).toBe(1);

    const sabatoCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('Consegna Sabato')
    );
    expect(sabatoCalls.length).toBe(1);
  });

  it('dovrebbe mostrare servizi fallback quando enabledServices vuoto/null', async () => {
    await generateCommercialQuotePDF(createMockQuote(), null, null, null);
    const fallbackCalls = mockText.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('Assicurazione integrativa')
    );
    expect(fallbackCalls.length).toBe(1);
  });

  it('dovrebbe mostrare prezzo e percentuale per servizi dinamici', async () => {
    const enabledServices = [{ service: 'Assicurazione', price: 1.5, percent: 5 }];
    await generateCommercialQuotePDF(createMockQuote(), null, null, enabledServices);

    const assicCalls = mockText.mock.calls.filter(
      (call: any) =>
        typeof call[0] === 'string' &&
        call[0].includes('Assicurazione') &&
        call[0].includes('\u20AC1.50') &&
        call[0].includes('5%')
    );
    expect(assicCalls.length).toBe(1);
  });
});
