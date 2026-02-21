/**
 * Test C1: Batch shipments - workspace_id obbligatorio (fail-closed)
 *
 * Verifica che createBatchShipments:
 * - Richieda workspaceId obbligatorio (throw se manca)
 * - Usi workspaceQuery (non supabaseAdmin) per insert su shipments
 * - Guardian baseline invariato (0 violazioni)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock workspaceQuery
const mockInsert = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({
      data: { id: 'ship-1', tracking_number: 'TRK-001' },
      error: null,
    }),
  }),
});

const mockFrom = vi.fn().mockReturnValue({
  insert: mockInsert,
});

vi.mock('@/lib/db/workspace-query', () => ({
  workspaceQuery: vi.fn((wsId: string) => {
    if (!wsId) throw new Error('workspaceQuery: workspaceId è obbligatorio');
    return { from: mockFrom };
  }),
}));

// Mock supabaseAdmin (per calculateQuotesComparison — price_rules_advanced)
vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

// Mock validators
vi.mock('@/lib/validators', () => ({
  assertValidUserId: vi.fn(),
}));

import { createBatchShipments, parseShipmentsData } from '@/lib/ai/tools/shipments-batch';

const sampleShipments = [
  {
    recipient_name: 'Mario Rossi',
    recipient_address: 'Via Roma 1',
    recipient_city: 'Milano',
    recipient_zip: '20100',
    packages: 1,
    weight: 2,
  },
];

describe('createBatchShipments — workspace_id fail-closed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lancia errore se workspaceId non fornito (undefined)', async () => {
    await expect(
      createBatchShipments(sampleShipments, 'user-123', undefined, undefined)
    ).rejects.toThrow('workspaceId is required for batch shipment creation');
  });

  it('lancia errore se workspaceId e stringa vuota', async () => {
    await expect(createBatchShipments(sampleShipments, 'user-123', undefined, '')).rejects.toThrow(
      'workspaceId is required for batch shipment creation'
    );
  });

  it('lancia errore se workspaceId non passato (omesso)', async () => {
    await expect(createBatchShipments(sampleShipments, 'user-123')).rejects.toThrow(
      'workspaceId is required for batch shipment creation'
    );
  });

  it('usa workspaceQuery per insert su shipments quando workspaceId presente', async () => {
    const wsId = 'ws-abc-123';
    const result = await createBatchShipments(sampleShipments, 'user-123', undefined, wsId);

    // Verifica che workspaceQuery sia stato chiamato con wsId corretto
    const { workspaceQuery } = await import('@/lib/db/workspace-query');
    expect(workspaceQuery).toHaveBeenCalledWith(wsId);

    // Verifica che from('shipments') sia stato chiamato
    expect(mockFrom).toHaveBeenCalledWith('shipments');

    // Verifica insert chiamato
    expect(mockInsert).toHaveBeenCalled();

    // Verifica che l'insert contenga user_id
    const insertedData = mockInsert.mock.calls[0][0];
    expect(insertedData).toHaveProperty('user_id', 'user-123');

    // Verifica risultato
    expect(result.created).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('non usa supabaseAdmin.from(shipments) direttamente', async () => {
    const { supabaseAdmin } = await import('@/lib/db/client');
    vi.clearAllMocks();

    await createBatchShipments(sampleShipments, 'user-123', undefined, 'ws-abc-123');

    // supabaseAdmin.from viene chiamato solo per price_rules_advanced (in calculateQuotesComparison)
    // NON per shipments
    const fromCalls = (supabaseAdmin.from as any).mock?.calls || [];
    const shipmentCalls = fromCalls.filter((c: string[]) => c[0] === 'shipments');
    expect(shipmentCalls).toHaveLength(0);
  });
});

describe('parseShipmentsData — validazione input', () => {
  it('parse CSV con header italiani', () => {
    const csv = 'nome,indirizzo,citta,cap,peso\nMario Rossi,Via Roma 1,Milano,20100,2';
    const result = parseShipmentsData(csv);
    expect(result).toHaveLength(1);
    expect(result[0].recipient_name).toBe('Mario Rossi');
    expect(result[0].weight).toBe(2);
  });

  it('lancia errore per file vuoto', () => {
    expect(() => parseShipmentsData('')).toThrow();
  });

  it('ignora righe senza campi obbligatori', () => {
    const csv = 'nome,indirizzo,citta,cap,peso\nMario Rossi,,,20100,2';
    const result = parseShipmentsData(csv);
    expect(result).toHaveLength(0);
  });
});
