/**
 * Test C7: Write memory dopo booking (tenant-safe)
 *
 * Verifica:
 * - Memory aggiornata dopo booking success
 * - Corriere aggiunto a preferredCouriers
 * - Duplicato non aggiunto
 * - Max 5 corrieri mantenuto
 * - Errore memory non rompe booking
 * - In delega: memory scritta su sub-client userId (non reseller)
 * - Senza delega: memory scritta su utente corrente
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track memory operations
let memoryGetCalls: string[] = [];
let memoryUpsertCalls: Array<{ userId: string; patch: any }> = [];
let mockExistingMemory: any = null;

vi.mock('@/lib/ai/user-memory', () => ({
  getUserMemory: vi.fn((userId: string) => {
    memoryGetCalls.push(userId);
    return Promise.resolve(mockExistingMemory);
  }),
  upsertUserMemory: vi.fn((userId: string, patch: any) => {
    memoryUpsertCalls.push({ userId, patch });
    return Promise.resolve(patch);
  }),
}));

// Mock createShipmentCore — successo
vi.mock('@/lib/shipments/create-shipment-core', () => ({
  createShipmentCore: vi.fn().mockResolvedValue({
    status: 200,
    json: {
      shipment: {
        id: 'ship-1',
        tracking_number: 'TRK-001',
      },
    },
  }),
}));

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              default_sender: {
                name: 'Test Sender',
                address: 'Via Roma 1',
                city: 'Roma',
                province: 'RM',
                postalCode: '00100',
              },
            },
            error: null,
          }),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/shipments/get-courier-client', () => ({
  getCourierClientReal: vi.fn().mockResolvedValue({
    client: {},
    configId: 'config-1',
  }),
}));

import { shipmentBookingWorker } from '@/lib/agent/workers/shipment-booking';
import type { AgentState } from '@/lib/agent/orchestrator/state';
import { HumanMessage } from '@langchain/core/messages';

function makeState(overrides?: Partial<AgentState>): AgentState {
  return {
    messages: [new HumanMessage('procedi')],
    userId: 'user-1',
    userEmail: 'user@test.com',
    shipmentData: {},
    processingStatus: 'complete',
    validationErrors: [],
    confidenceScore: 100,
    needsHumanReview: false,
    shipment_creation_phase: 'ready',
    agent_context: {
      session_id: 'sess-1',
      conversation_history: [],
      user_role: 'user',
      is_impersonating: false,
      acting_context: {
        actor: { id: 'user-1', email: 'user@test.com', name: 'User', role: 'user' },
        target: { id: 'user-1', email: 'user@test.com', name: 'User', role: 'user' },
        isImpersonating: false,
      },
    },
    shipmentDraft: {
      recipient: {
        fullName: 'Mario Rossi',
        addressLine1: 'Via Roma 1',
        city: 'Roma',
        province: 'RM',
        postalCode: '00100',
        country: 'IT',
      },
      parcel: {
        weightKg: 5,
        lengthCm: 30,
        widthCm: 20,
        heightCm: 15,
      },
      missingFields: [],
    } as any,
    pricing_options: [
      {
        courier: 'BRT',
        serviceType: 'standard',
        basePrice: 5.0,
        finalPrice: 7.5,
        estimatedDeliveryDays: { min: 2, max: 3 },
        recommendation: 'best_price',
      },
    ] as any[],
    ...overrides,
  };
}

describe('shipmentBookingWorker — memory update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoryGetCalls = [];
    memoryUpsertCalls = [];
    mockExistingMemory = null;
  });

  it('aggiorna memory con corriere dopo booking success', async () => {
    mockExistingMemory = { preferredCouriers: ['GLS'] };

    const result = await shipmentBookingWorker(makeState());

    expect(result.booking_result?.status).toBe('success');
    // Memory letta per l'utente corrente
    expect(memoryGetCalls).toContain('user-1');
    // Memory aggiornata con BRT aggiunto in testa
    expect(memoryUpsertCalls).toHaveLength(1);
    expect(memoryUpsertCalls[0].userId).toBe('user-1');
    expect(memoryUpsertCalls[0].patch.preferredCouriers).toEqual(['BRT', 'GLS']);
  });

  it('non aggiunge corriere duplicato', async () => {
    mockExistingMemory = { preferredCouriers: ['BRT', 'GLS'] };

    const result = await shipmentBookingWorker(makeState());

    expect(result.booking_result?.status).toBe('success');
    // BRT gia presente → nessun upsert
    expect(memoryUpsertCalls).toHaveLength(0);
  });

  it('mantiene max 5 corrieri', async () => {
    mockExistingMemory = {
      preferredCouriers: ['GLS', 'SDA', 'TNT', 'DHL', 'Poste'],
    };

    const result = await shipmentBookingWorker(makeState());

    expect(result.booking_result?.status).toBe('success');
    // BRT aggiunto, Poste rimosso (max 5)
    expect(memoryUpsertCalls[0].patch.preferredCouriers).toHaveLength(5);
    expect(memoryUpsertCalls[0].patch.preferredCouriers[0]).toBe('BRT');
  });

  it('errore memory non rompe booking', async () => {
    // getUserMemory viene chiamata 2 volte:
    // 1. Da getFullSenderData (per cercare mittente) — deve funzionare
    // 2. Da memory write post-booking — forziamo errore qui
    const { getUserMemory } = await import('@/lib/ai/user-memory');
    // Prima chiamata OK (getFullSenderData): ritorna null → fallback a users.default_sender
    // Seconda chiamata ERRORE (memory write): simula DB down
    (getUserMemory as any).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('DB down'));

    const result = await shipmentBookingWorker(makeState());

    // Booking comunque success (errore memory non blocca)
    expect(result.booking_result?.status).toBe('success');
    expect(result.booking_result?.carrier_reference).toBe('TRK-001');
  });

  it('in delega: memory scritta su sub-client userId (non reseller)', async () => {
    mockExistingMemory = { preferredCouriers: [] };

    const state = makeState({
      delegation_context: {
        isDelegating: true,
        delegatedWorkspaceId: 'subclient-ws-1',
        resellerWorkspaceId: 'reseller-ws-1',
        subClientName: 'Awa Kanoute',
        subClientWorkspaceName: 'Awa Shipping',
        subClientUserId: 'subclient-user-1',
      },
    });

    const result = await shipmentBookingWorker(state);

    expect(result.booking_result?.status).toBe('success');
    // Memory scritta sul sub-client, non sul reseller
    expect(memoryGetCalls).toContain('subclient-user-1');
    expect(memoryUpsertCalls[0].userId).toBe('subclient-user-1');
  });

  it('senza delega: memory scritta su utente corrente', async () => {
    mockExistingMemory = { preferredCouriers: [] };

    const result = await shipmentBookingWorker(makeState());

    expect(result.booking_result?.status).toBe('success');
    // Memory scritta sull'utente corrente
    expect(memoryGetCalls).toContain('user-1');
    expect(memoryUpsertCalls[0].userId).toBe('user-1');
  });
});
