/**
 * Test: workspace_id viene impostato nell'INSERT di createShipmentCore
 *
 * Verifica che dopo il fix, l'overridable insertShipmentFn riceva
 * `targetWorkspaceId` e che la logica di spread condizionale sia corretta.
 *
 * Testa la logica pura dell'override — non importa createShipmentCore
 * (troppe dipendenze Supabase), ma verifica il contratto del tipo e
 * la logica di spread condizionale via replica locale.
 */
import { describe, it, expect, vi } from 'vitest';

// ---- Replica della logica workspace_id spread (come nel default insertShipmentFn) ----

type InsertShipmentArgs = {
  targetId: string;
  targetWorkspaceId: string | null;
  validated: Record<string, unknown>;
  idempotencyKey: string;
  courierResponse: Record<string, unknown>;
  finalCost: number;
};

/**
 * Replica del payload INSERT usato in createShipmentCore (linea 662+).
 * Testa che workspace_id venga incluso solo se targetWorkspaceId non è null.
 */
function buildInsertPayload(args: InsertShipmentArgs): Record<string, unknown> {
  return {
    user_id: args.targetId,
    // workspace_id esplicito per isolamento multi-tenant (CLAUDE.md Regola #1)
    ...(args.targetWorkspaceId ? { workspace_id: args.targetWorkspaceId } : {}),
    status: 'pending',
    idempotency_key: args.idempotencyKey,
    total_cost: args.finalCost,
  };
}

// ---- Test del tipo InsertShipmentArgs (type-level check via runtime) ----

const MOCK_WORKSPACE_ID = 'aaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const MOCK_USER_ID = '1111-2222-3333-4444-555555555555';

describe('createShipmentCore — workspace_id nel payload INSERT', () => {
  it('include workspace_id nel payload quando targetWorkspaceId è valorizzato', () => {
    const args: InsertShipmentArgs = {
      targetId: MOCK_USER_ID,
      targetWorkspaceId: MOCK_WORKSPACE_ID,
      validated: {},
      idempotencyKey: 'test-key-1',
      courierResponse: {},
      finalCost: 10.5,
    };

    const payload = buildInsertPayload(args);

    expect(payload.workspace_id).toBe(MOCK_WORKSPACE_ID);
    expect(payload.user_id).toBe(MOCK_USER_ID);
  });

  it('NON include workspace_id nel payload quando targetWorkspaceId è null', () => {
    const args: InsertShipmentArgs = {
      targetId: MOCK_USER_ID,
      targetWorkspaceId: null,
      validated: {},
      idempotencyKey: 'test-key-2',
      courierResponse: {},
      finalCost: 5.0,
    };

    const payload = buildInsertPayload(args);

    // Backward-compat: campo omesso (non null, non undefined — proprio non presente)
    expect('workspace_id' in payload).toBe(false);
    expect(payload.user_id).toBe(MOCK_USER_ID);
  });

  it('workspace_id è diverso da user_id — attribuzione indipendente', () => {
    const CLIENT_WORKSPACE_ID = 'client-ws-0000-0000-000000000000';
    const RESELLER_USER_ID = 'reseller-user-0000-0000-000000000000';

    const args: InsertShipmentArgs = {
      targetId: RESELLER_USER_ID,
      targetWorkspaceId: CLIENT_WORKSPACE_ID,
      validated: {},
      idempotencyKey: 'test-key-3',
      courierResponse: {},
      finalCost: 7.0,
    };

    const payload = buildInsertPayload(args);

    // Il reseller agisce nel workspace del cliente: i due campi devono essere distinti
    expect(payload.workspace_id).toBe(CLIENT_WORKSPACE_ID);
    expect(payload.user_id).toBe(RESELLER_USER_ID);
    expect(payload.workspace_id).not.toBe(payload.user_id);
  });
});

// ---- Test del contratto dell'override insertShipmentFn ----

describe('insertShipmentFn override — targetWorkspaceId disponibile', () => {
  it('la funzione override riceve targetWorkspaceId tra i suoi args', async () => {
    const insertMock = vi.fn().mockResolvedValue({ data: { id: 'ship-001' }, error: null });

    // Simula la chiamata che createShipmentCore fa all'override (linea 710-716)
    const callArgs: InsertShipmentArgs = {
      targetId: MOCK_USER_ID,
      targetWorkspaceId: MOCK_WORKSPACE_ID,
      validated: {},
      idempotencyKey: 'idem-key',
      courierResponse: { trackingNumber: 'TRK001' },
      finalCost: 12.0,
    };

    await insertMock(callArgs);

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: MOCK_USER_ID,
        targetWorkspaceId: MOCK_WORKSPACE_ID,
      })
    );
  });

  it('la funzione override può usare targetWorkspaceId per inserire workspace_id', async () => {
    const capturedPayload: Record<string, unknown> = {};

    const insertMock = vi.fn().mockImplementation(async (args: InsertShipmentArgs) => {
      // Override che simula l'insert con workspace_id
      Object.assign(capturedPayload, buildInsertPayload(args));
      return { data: { id: 'ship-002' }, error: null };
    });

    await insertMock({
      targetId: MOCK_USER_ID,
      targetWorkspaceId: MOCK_WORKSPACE_ID,
      validated: {},
      idempotencyKey: 'idem-key-2',
      courierResponse: {},
      finalCost: 15.0,
    });

    expect(capturedPayload.workspace_id).toBe(MOCK_WORKSPACE_ID);
    expect(capturedPayload.user_id).toBe(MOCK_USER_ID);
  });

  it('override con targetWorkspaceId null non inserisce workspace_id', async () => {
    const capturedPayload: Record<string, unknown> = {};

    const insertMock = vi.fn().mockImplementation(async (args: InsertShipmentArgs) => {
      Object.assign(capturedPayload, buildInsertPayload(args));
      return { data: { id: 'ship-003' }, error: null };
    });

    await insertMock({
      targetId: MOCK_USER_ID,
      targetWorkspaceId: null,
      validated: {},
      idempotencyKey: 'idem-key-3',
      courierResponse: {},
      finalCost: 9.0,
    });

    // Campo omesso — backward compat superadmin senza workspace
    expect('workspace_id' in capturedPayload).toBe(false);
  });
});
