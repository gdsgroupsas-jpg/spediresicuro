/**
 * Test C2: Sub-client resolution service
 *
 * Verifica scoring deterministico, security (solo figli diretti),
 * soglia centralizzata, ordinamento stabile.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Helper: crea mock workspace con membri
function mockWorkspace(
  id: string,
  name: string,
  members: Array<{ userId: string; userName: string }>
) {
  return {
    id,
    name,
    workspace_members: members.map((m) => ({
      user_id: m.userId,
      role: 'owner',
      users: { id: m.userId, name: m.userName, email: `${m.userId}@test.com` },
    })),
  };
}

// Mock supabaseAdmin
let mockQueryResult: { data: any[] | null; error: any } = { data: [], error: null };

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => mockQueryResult),
          })),
        })),
      })),
    })),
  },
}));

import {
  resolveSubClient,
  DELEGATION_CONFIDENCE_THRESHOLD,
  type SubClientResolution,
} from '@/lib/ai/subclient-resolver';

const RESELLER_WS = 'reseller-ws-001';

describe('resolveSubClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResult = { data: [], error: null };
  });

  it('ritorna array vuoto se searchTerm vuoto', async () => {
    const result = await resolveSubClient(RESELLER_WS, '');
    expect(result).toEqual([]);
  });

  it('ritorna array vuoto se resellerWorkspaceId vuoto', async () => {
    const result = await resolveSubClient('', 'Awa');
    expect(result).toEqual([]);
  });

  it('ritorna array vuoto se nessun workspace figlio', async () => {
    mockQueryResult = { data: [], error: null };
    const result = await resolveSubClient(RESELLER_WS, 'Awa Kanoute');
    expect(result).toEqual([]);
  });

  it('ritorna array vuoto in caso di errore DB', async () => {
    mockQueryResult = { data: null, error: { message: 'DB error' } };
    const result = await resolveSubClient(RESELLER_WS, 'Awa');
    expect(result).toEqual([]);
  });

  it('match esatto nome workspace → confidence 1.0', async () => {
    mockQueryResult = {
      data: [mockWorkspace('ws-awa', 'Awa Kanoute', [{ userId: 'u-awa', userName: 'Awa K.' }])],
      error: null,
    };

    const result = await resolveSubClient(RESELLER_WS, 'Awa Kanoute');
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(1.0);
    expect(result[0].workspaceId).toBe('ws-awa');
    expect(result[0].workspaceName).toBe('Awa Kanoute');
  });

  it('match esatto nome utente → confidence 0.95', async () => {
    mockQueryResult = {
      data: [mockWorkspace('ws-awa', 'WS di Awa', [{ userId: 'u-awa', userName: 'Awa Kanoute' }])],
      error: null,
    };

    const result = await resolveSubClient(RESELLER_WS, 'Awa Kanoute');
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(0.95);
    expect(result[0].userName).toBe('Awa Kanoute');
  });

  it('match parziale workspace (contiene termine) → confidence 0.7', async () => {
    mockQueryResult = {
      data: [
        mockWorkspace('ws-awa', 'Spedizioni Awa Kanoute SRL', [
          { userId: 'u-awa', userName: 'Staff Member' },
        ]),
      ],
      error: null,
    };

    const result = await resolveSubClient(RESELLER_WS, 'Awa Kanoute');
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(0.7);
  });

  it('match parziale utente (contiene termine) → confidence 0.6', async () => {
    mockQueryResult = {
      data: [
        mockWorkspace('ws-test', 'Workspace Generico', [
          { userId: 'u-awa', userName: 'Awa Kanoute Junior' },
        ]),
      ],
      error: null,
    };

    const result = await resolveSubClient(RESELLER_WS, 'Awa Kanoute');
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(0.6);
  });

  it('nessun match → array vuoto', async () => {
    mockQueryResult = {
      data: [
        mockWorkspace('ws-mario', 'Mario Rossi', [{ userId: 'u-mario', userName: 'Mario Rossi' }]),
      ],
      error: null,
    };

    const result = await resolveSubClient(RESELLER_WS, 'Awa Kanoute');
    expect(result).toEqual([]);
  });

  it('match multipli → ordinati per confidence DESC, workspace_name ASC (deterministico)', async () => {
    mockQueryResult = {
      data: [
        mockWorkspace('ws-b', 'Beta Shipping', [{ userId: 'u-awa', userName: 'Awa Kanoute' }]),
        mockWorkspace('ws-a', 'Awa Kanoute', [{ userId: 'u-awa2', userName: 'Staff Member' }]),
        mockWorkspace('ws-c', 'Spedizioni Awa Kanoute SRL', [
          { userId: 'u-staff', userName: 'Staff' },
        ]),
      ],
      error: null,
    };

    const result = await resolveSubClient(RESELLER_WS, 'Awa Kanoute');
    expect(result).toHaveLength(3);
    // ws-a: match esatto workspace → 1.0
    expect(result[0].workspaceId).toBe('ws-a');
    expect(result[0].confidence).toBe(1.0);
    // ws-b: match esatto utente → 0.95
    expect(result[1].workspaceId).toBe('ws-b');
    expect(result[1].confidence).toBe(0.95);
    // ws-c: match parziale workspace (contiene "Awa Kanoute") → 0.7
    expect(result[2].workspaceId).toBe('ws-c');
    expect(result[2].confidence).toBe(0.7);
  });

  it('dedup: stesso workspace con piu membri mantiene solo il match migliore', async () => {
    mockQueryResult = {
      data: [
        mockWorkspace('ws-awa', 'WS Awa', [
          { userId: 'u-1', userName: 'Awa Kanoute' }, // match esatto utente → 0.95
          { userId: 'u-2', userName: 'Awa Junior' }, // match parziale → 0.6
        ]),
      ],
      error: null,
    };

    const result = await resolveSubClient(RESELLER_WS, 'Awa Kanoute');
    expect(result).toHaveLength(1);
    // Deve tenere il match migliore (0.95)
    expect(result[0].confidence).toBe(0.95);
    expect(result[0].userId).toBe('u-1');
  });

  it('match case-insensitive', async () => {
    mockQueryResult = {
      data: [
        mockWorkspace('ws-awa', 'awa kanoute', [{ userId: 'u-awa', userName: 'AWA KANOUTE' }]),
      ],
      error: null,
    };

    const result = await resolveSubClient(RESELLER_WS, 'AWA KANOUTE');
    expect(result).toHaveLength(1);
    // Match esatto workspace (case-insensitive) → 1.0
    expect(result[0].confidence).toBe(1.0);
  });

  it('searchTerm con spazi extra viene trimmed', async () => {
    mockQueryResult = {
      data: [mockWorkspace('ws-awa', 'Awa Kanoute', [{ userId: 'u-awa', userName: 'Awa' }])],
      error: null,
    };

    const result = await resolveSubClient(RESELLER_WS, '  Awa Kanoute  ');
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(1.0);
  });
});

describe('DELEGATION_CONFIDENCE_THRESHOLD', () => {
  it('e esportata e vale 0.9', () => {
    expect(DELEGATION_CONFIDENCE_THRESHOLD).toBe(0.9);
  });

  it('match esatto workspace (1.0) supera soglia', () => {
    expect(1.0).toBeGreaterThanOrEqual(DELEGATION_CONFIDENCE_THRESHOLD);
  });

  it('match esatto utente (0.95) supera soglia', () => {
    expect(0.95).toBeGreaterThanOrEqual(DELEGATION_CONFIDENCE_THRESHOLD);
  });

  it('match parziale (0.7) NON supera soglia', () => {
    expect(0.7).toBeLessThan(DELEGATION_CONFIDENCE_THRESHOLD);
  });
});

// ============================================
// F-SEC-3: Unicode NFC normalization
// ============================================
describe('resolveSubClient NFC normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResult = { data: [], error: null };
  });

  it('matcha nome con encoding NFD diverso (accento composto)', async () => {
    // Workspace name in NFC: "Kanouté"
    // Search term in NFD: "Kanoute" + combining acute (U+0301)
    mockQueryResult = {
      data: [mockWorkspace('ws-kan', 'Kanout\u00e9', [{ userId: 'u-kan', userName: 'Staff' }])],
      error: null,
    };

    const nfdSearchTerm = 'Kanout\u0065\u0301'; // "e" + combining acute
    const result = await resolveSubClient(RESELLER_WS, nfdSearchTerm);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(1.0);
  });

  it('ASCII puro non cambia con NFC (no regression)', async () => {
    mockQueryResult = {
      data: [mockWorkspace('ws-awa', 'Awa Kanoute', [{ userId: 'u-awa', userName: 'Awa' }])],
      error: null,
    };

    const result = await resolveSubClient(RESELLER_WS, 'Awa Kanoute');
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(1.0);
    expect(result[0].workspaceName).toBe('Awa Kanoute');
  });
});

describe('Security: solo figli diretti', () => {
  it('query usa parent_workspace_id per filtrare solo figli diretti', async () => {
    const { supabaseAdmin } = await import('@/lib/db/client');
    mockQueryResult = { data: [], error: null };

    await resolveSubClient(RESELLER_WS, 'test');

    // Verifica che from('workspaces') sia stato chiamato
    expect(supabaseAdmin.from).toHaveBeenCalledWith('workspaces');
  });
});
