/**
 * Test: Isolamento Workspace Listini
 *
 * Verifica che listPriceListsAction e listUsersForAssignmentAction
 * rispettino l'isolamento multi-tenant per workspace.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock workspace-auth
const mockGetWorkspaceAuth = vi.fn();
vi.mock('@/lib/workspace-auth', () => ({
  getWorkspaceAuth: () => mockGetWorkspaceAuth(),
}));

// Mock safe-auth (non dovrebbe essere usato dalle funzioni fixate)
vi.mock('@/lib/safe-auth', () => ({
  getSafeAuth: vi.fn(),
}));

// Mock supabase
const mockFrom = vi.fn();
const mockRpc = vi.fn();
vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: (...args: any[]) => mockFrom(...args),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

// Mock db/price-lists (non usate direttamente in list actions)
vi.mock('@/lib/db/price-lists', () => ({
  createPriceList: vi.fn(),
  deletePriceList: vi.fn(),
  getApplicablePriceList: vi.fn(),
  getPriceListById: vi.fn(),
  updatePriceList: vi.fn(),
}));

// Mock security
vi.mock('@/lib/security/audit-log', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/security/audit-actions', () => ({
  AUDIT_ACTIONS: {},
  AUDIT_RESOURCE_TYPES: {},
}));
vi.mock('@/lib/security/rate-limit', () => ({ rateLimit: vi.fn() }));
vi.mock('@/lib/validators', () => ({ validateUUID: vi.fn(() => true) }));

// Import dopo i mock
import { listPriceListsAction, listUsersForAssignmentAction } from '@/actions/price-lists';

describe('Isolamento Workspace - listPriceListsAction', () => {
  const WORKSPACE_A = 'workspace-aaa-111';
  const WORKSPACE_B = 'workspace-bbb-222';

  // Listini simulati
  const listinoWsA = {
    id: 'pl-1',
    name: 'Listino WS-A',
    workspace_id: WORKSPACE_A,
    courier_id: null,
  };
  const listinoWsB = {
    id: 'pl-2',
    name: 'Listino WS-B',
    workspace_id: WORKSPACE_B,
    courier_id: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupSuperadminInWorkspace(workspaceId: string) {
    mockGetWorkspaceAuth.mockResolvedValue({
      actor: { id: 'superadmin-id', email: 'admin@spediresicuro.it' },
      workspace: { id: workspaceId },
    });

    // Mock: from('users').select().eq().single()
    const mockUserQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'superadmin-id', account_type: 'superadmin', is_reseller: false },
        error: null,
      }),
    };

    // Mock: from('workspaces').select().eq().single()
    const mockWsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { assigned_price_list_id: null, selling_price_list_id: null },
        error: null,
      }),
    };

    // Mock: from('price_lists').select().eq().order()
    const mockPlQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: workspaceId === WORKSPACE_A ? [listinoWsA] : [listinoWsB],
        error: null,
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') return mockUserQuery;
      if (table === 'workspaces') return mockWsQuery;
      if (table === 'price_lists') return mockPlQuery;
      return mockUserQuery;
    });
  }

  it('superadmin in workspace A vede SOLO listini di workspace A', async () => {
    setupSuperadminInWorkspace(WORKSPACE_A);

    const result = await listPriceListsAction();

    expect(result.success).toBe(true);
    expect(result.priceLists).toHaveLength(1);
    expect(result.priceLists![0].name).toBe('Listino WS-A');
  });

  it('superadmin in workspace B vede SOLO listini di workspace B', async () => {
    setupSuperadminInWorkspace(WORKSPACE_B);

    const result = await listPriceListsAction();

    expect(result.success).toBe(true);
    expect(result.priceLists).toHaveLength(1);
    expect(result.priceLists![0].name).toBe('Listino WS-B');
  });

  it('usa getWorkspaceAuth e NON getSafeAuth', async () => {
    setupSuperadminInWorkspace(WORKSPACE_A);

    await listPriceListsAction();

    // getWorkspaceAuth deve essere stato chiamato
    expect(mockGetWorkspaceAuth).toHaveBeenCalled();
  });

  it('filtra per workspace_id nella query price_lists', async () => {
    setupSuperadminInWorkspace(WORKSPACE_A);

    await listPriceListsAction();

    // Verifica che from('price_lists') sia stato chiamato
    expect(mockFrom).toHaveBeenCalledWith('price_lists');

    // Verifica che .eq sia stato chiamato con workspace_id
    const plCall = mockFrom.mock.results.find(
      (_: any, i: number) => mockFrom.mock.calls[i][0] === 'price_lists'
    );
    if (plCall) {
      const chain = plCall.value;
      expect(chain.eq).toHaveBeenCalledWith('workspace_id', WORKSPACE_A);
    }
  });

  it('ritorna errore se non autenticato', async () => {
    mockGetWorkspaceAuth.mockResolvedValue(null);

    const result = await listPriceListsAction();

    expect(result.success).toBe(false);
    expect(result.error).toContain('autenticato');
  });
});

describe('Isolamento Workspace - listUsersForAssignmentAction', () => {
  const WORKSPACE_ID = 'workspace-aaa-111';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupSuperadmin() {
    mockGetWorkspaceAuth.mockResolvedValue({
      actor: { id: 'superadmin-id', email: 'admin@spediresicuro.it' },
      workspace: { id: WORKSPACE_ID },
    });

    const mockUserQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'superadmin-id', account_type: 'superadmin' },
        error: null,
      }),
    };

    // Mock per query workspace_members
    const mockMembersQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
    // Simula 1 reseller nel workspace
    mockMembersQuery.eq.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            user: {
              id: 'user-ws',
              email: 'reseller@ws.com',
              name: 'Reseller WS',
              account_type: 'reseller',
              is_reseller: true,
            },
          },
        ],
        error: null,
      }),
    });

    // Mock per query globale users
    const mockGlobalUsersQuery = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'user-ws',
            email: 'reseller@ws.com',
            name: 'Reseller WS',
            account_type: 'reseller',
            is_reseller: true,
          },
          {
            id: 'user-other',
            email: 'other@reseller.com',
            name: 'Altro Reseller',
            account_type: 'reseller',
            is_reseller: true,
          },
        ],
        error: null,
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        // Distingui tra query singola (auth) e query lista globale
        return {
          select: vi.fn().mockImplementation((fields: string) => {
            if (fields === 'id, account_type') {
              return {
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: { id: 'superadmin-id', account_type: 'superadmin' },
                  error: null,
                }),
              };
            }
            // Query globale users
            return {
              or: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'user-ws',
                    email: 'reseller@ws.com',
                    name: 'Reseller WS',
                    account_type: 'reseller',
                    is_reseller: true,
                  },
                  {
                    id: 'user-other',
                    email: 'other@reseller.com',
                    name: 'Altro Reseller',
                    account_type: 'reseller',
                    is_reseller: true,
                  },
                ],
                error: null,
              }),
            };
          }),
        };
      }
      if (table === 'workspace_members') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  user: {
                    id: 'user-ws',
                    email: 'reseller@ws.com',
                    name: 'Reseller WS',
                    account_type: 'reseller',
                    is_reseller: true,
                  },
                },
              ],
              error: null,
            }),
          })),
        };
      }
      return mockUserQuery;
    });
  }

  it('default (no global): restituisce SOLO utenti del workspace corrente', async () => {
    setupSuperadmin();

    const result = await listUsersForAssignmentAction();

    expect(result.success).toBe(true);
    expect(result.users).toHaveLength(1);
    expect(result.users![0].email).toBe('reseller@ws.com');
  });

  it('global=true: restituisce TUTTI gli utenti reseller/BYOC', async () => {
    setupSuperadmin();

    const result = await listUsersForAssignmentAction({ global: true });

    expect(result.success).toBe(true);
    expect(result.users!.length).toBeGreaterThanOrEqual(2);
    expect(result.users!.some((u) => u.email === 'other@reseller.com')).toBe(true);
  });

  it('usa getWorkspaceAuth e NON getSafeAuth', async () => {
    setupSuperadmin();

    await listUsersForAssignmentAction();

    expect(mockGetWorkspaceAuth).toHaveBeenCalled();
  });

  it('ritorna errore se non autenticato', async () => {
    mockGetWorkspaceAuth.mockResolvedValue(null);

    const result = await listUsersForAssignmentAction();

    expect(result.success).toBe(false);
    expect(result.error).toContain('autenticato');
  });
});
