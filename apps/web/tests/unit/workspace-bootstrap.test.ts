/**
 * Test: Workspace Bootstrap — Zero Lockout
 *
 * DoD 1 dell'auditor: "zero percorsi che lasciano utente autenticato senza workspace valido"
 *
 * Verifica che ensureUserWorkspace():
 * - Assegna utenti normali al platform workspace
 * - Non crea duplicati (idempotente)
 * - Non interferisce con reseller (path dedicato)
 * - Gestisce errori senza crash
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock supabaseAdmin
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: (...args: any[]) => mockFrom(...args),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

// Import dopo il mock
import { ensureUserWorkspace } from '@/lib/workspace-auth';

// Helper per creare mock chain Supabase
function createMockChain(result: any) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.insert = vi.fn().mockResolvedValue({ error: null });
  chain.update = vi.fn().mockReturnValue(chain);
  return chain;
}

describe('ensureUserWorkspace — Workspace Bootstrap', () => {
  const PLATFORM_WS_ID = '11111111-1111-1111-1111-111111111111';
  const USER_ID = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ritorna workspace_id esistente se utente ha gia primary_workspace_id', async () => {
    const existingWsId = '33333333-3333-3333-3333-333333333333';
    const userChain = createMockChain({
      data: { primary_workspace_id: existingWsId, is_reseller: false, account_type: 'user' },
      error: null,
    });
    mockFrom.mockReturnValue(userChain);

    const result = await ensureUserWorkspace(USER_ID, 'test@example.com');

    expect(result).toBe(existingWsId);
    // Non deve cercare platform workspace
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('users');
  });

  it('assegna utente normale al platform workspace', async () => {
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      callCount++;
      if (table === 'users' && callCount === 1) {
        // Prima chiamata: select primary_workspace_id
        return createMockChain({
          data: { primary_workspace_id: null, is_reseller: false, account_type: 'user' },
          error: null,
        });
      }
      if (table === 'workspaces') {
        // Cerca platform workspace
        return createMockChain({
          data: { id: PLATFORM_WS_ID },
          error: null,
        });
      }
      if (table === 'workspace_members' && callCount <= 4) {
        // Check membership (non esiste)
        return createMockChain({
          data: null,
          error: null,
        });
      }
      if (table === 'workspace_members') {
        // Insert membership
        const chain = createMockChain({ error: null });
        return chain;
      }
      if (table === 'users') {
        // Update primary_workspace_id
        return createMockChain({ error: null });
      }
      return createMockChain({ data: null, error: null });
    });

    const result = await ensureUserWorkspace(USER_ID, 'newuser@example.com');

    expect(result).toBe(PLATFORM_WS_ID);
  });

  it('ritorna null per reseller (path dedicato)', async () => {
    const userChain = createMockChain({
      data: { primary_workspace_id: null, is_reseller: true, account_type: 'reseller' },
      error: null,
    });
    mockFrom.mockReturnValue(userChain);

    const result = await ensureUserWorkspace(USER_ID, 'reseller@example.com');

    expect(result).toBeNull();
  });

  it('ritorna null se nessun platform workspace esiste', async () => {
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      callCount++;
      if (table === 'users') {
        return createMockChain({
          data: { primary_workspace_id: null, is_reseller: false, account_type: 'user' },
          error: null,
        });
      }
      if (table === 'workspaces') {
        // Nessun platform workspace
        return createMockChain({ data: null, error: { message: 'Not found', code: 'PGRST116' } });
      }
      return createMockChain({ data: null, error: null });
    });

    const result = await ensureUserWorkspace(USER_ID, 'orphan@example.com');

    expect(result).toBeNull();
  });

  it('e idempotente se utente e gia membro del platform workspace', async () => {
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      callCount++;
      if (table === 'users' && callCount === 1) {
        return createMockChain({
          data: { primary_workspace_id: null, is_reseller: false, account_type: 'user' },
          error: null,
        });
      }
      if (table === 'workspaces') {
        return createMockChain({ data: { id: PLATFORM_WS_ID }, error: null });
      }
      if (table === 'workspace_members') {
        // Gia' membro — maybeSingle ritorna record esistente
        const chain = createMockChain({ data: { id: 'existing-member-id' }, error: null });
        return chain;
      }
      if (table === 'users') {
        return createMockChain({ error: null });
      }
      return createMockChain({ data: null, error: null });
    });

    const result = await ensureUserWorkspace(USER_ID, 'already-member@example.com');

    expect(result).toBe(PLATFORM_WS_ID);
  });

  it('gestisce errori database senza crash', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Connection timeout');
    });

    const result = await ensureUserWorkspace(USER_ID, 'error@example.com');

    expect(result).toBeNull();
  });
});
