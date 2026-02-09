/**
 * Reseller Wallet Ownership Tests
 *
 * Verifica che manageSubUserWallet() supporti entrambi i sistemi di ownership:
 * - Legacy: parent_id nella tabella users
 * - Workspace V2: parent_workspace_id nella tabella workspaces
 *
 * Test cases:
 * - Legacy parent_id match -> ricarica permessa
 * - Workspace V2 match (parent_workspace_id) -> ricarica permessa
 * - Nessun match -> access denied
 * - Importo negativo -> rifiutato
 * - Sub-user non esistente -> errore
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stato mock per controllare risposte
let mockAuthResponse: any = null;

// Query tracker: registra tutte le chiamate e ritorna risultati configurati
type QueryMatcher = {
  table: string;
  filters: Record<string, any>;
  result: any;
};
let queryMatchers: QueryMatcher[] = [];
let rpcResults: Record<string, any> = {};

vi.mock('@/lib/db/client', () => {
  const createQueryBuilder = () => {
    let currentTable = '';
    let currentFilters: Record<string, any> = {};

    const findResult = () => {
      // Cerca il matcher piu' specifico (piu' filtri matching)
      let bestMatch: QueryMatcher | null = null;
      let bestScore = -1;

      for (const matcher of queryMatchers) {
        if (matcher.table !== currentTable) continue;

        let score = 0;
        let allMatch = true;
        for (const [key, val] of Object.entries(matcher.filters)) {
          if (currentFilters[key] === val) {
            score++;
          } else {
            allMatch = false;
          }
        }

        // Il matcher deve avere TUTTI i suoi filtri soddisfatti
        if (allMatch && score > bestScore) {
          bestScore = score;
          bestMatch = matcher;
        }
      }

      return bestMatch?.result ?? { data: null, error: { message: 'No mock match' } };
    };

    const builder: any = {};

    builder.from = (table: string) => {
      currentTable = table;
      currentFilters = {};
      return builder;
    };

    builder.select = (_fields: string) => builder;

    builder.eq = (field: string, value: any) => {
      currentFilters[field] = value;
      return builder;
    };

    builder.in = (field: string, values: any[]) => {
      currentFilters[`${field}__in`] = values;
      return builder;
    };

    builder.single = () => findResult();
    builder.maybeSingle = () => findResult();

    // Supabase: senza .single(), la query ritorna array via thenable
    builder.then = (resolve: any) => {
      const result = findResult();
      return resolve(result);
    };

    builder.insert = (_data: any) => {
      return { data: null, error: null };
    };

    builder.rpc = (name: string, params: any) => {
      return rpcResults[name] ?? { data: 'tx-mock-123', error: null };
    };

    return builder;
  };

  return { supabaseAdmin: createQueryBuilder() };
});

vi.mock('@/lib/safe-auth', () => ({
  getSafeAuth: vi.fn(() => mockAuthResponse),
}));

// Import dopo i mock
import { manageSubUserWallet } from '@/actions/admin-reseller';

// Helper per registrare risultati mock
function mockQuery(table: string, filters: Record<string, any>, result: any) {
  queryMatchers.push({ table, filters, result });
}

describe('manageSubUserWallet - Ownership verification', () => {
  const RESELLER_ID = 'reseller-uuid-001';
  const RESELLER_EMAIL = 'reseller@test.com';
  const SUB_USER_ID = 'subuser-uuid-001';
  const RESELLER_WS_ID = 'reseller-ws-uuid-001';
  const SUB_USER_WS_ID = 'subuser-ws-uuid-001';

  beforeEach(() => {
    vi.clearAllMocks();
    queryMatchers = [];
    rpcResults = {};

    // Default: autenticato come reseller
    mockAuthResponse = {
      actor: { email: RESELLER_EMAIL },
      target: { id: RESELLER_ID, email: RESELLER_EMAIL },
    };

    // Default: utente corrente e' reseller
    mockQuery(
      'users',
      { email: RESELLER_EMAIL },
      {
        data: { id: RESELLER_ID, is_reseller: true },
        error: null,
      }
    );

    // Default RPC: add_wallet_credit OK
    rpcResults['add_wallet_credit'] = { data: 'tx-123', error: null };
  });

  it('dovrebbe rifiutare se non autenticato', async () => {
    mockAuthResponse = null;

    const result = await manageSubUserWallet(SUB_USER_ID, 50, 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Non autenticato');
  });

  it("dovrebbe rifiutare se non e' reseller", async () => {
    // Sovrascrivi: non e' reseller
    queryMatchers = [];
    mockQuery(
      'users',
      { email: RESELLER_EMAIL },
      {
        data: { id: RESELLER_ID, is_reseller: false },
        error: null,
      }
    );

    const result = await manageSubUserWallet(SUB_USER_ID, 50, 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Solo i Reseller');
  });

  it('dovrebbe rifiutare importo negativo', async () => {
    const result = await manageSubUserWallet(SUB_USER_ID, -10, 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('positivo');
  });

  it('dovrebbe rifiutare importo zero', async () => {
    const result = await manageSubUserWallet(SUB_USER_ID, 0, 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('positivo');
  });

  it('dovrebbe rifiutare se sub-user non trovato', async () => {
    // Sub-user non esiste
    mockQuery(
      'users',
      { id: SUB_USER_ID },
      {
        data: null,
        error: { message: 'Not found' },
      }
    );

    const result = await manageSubUserWallet(SUB_USER_ID, 50, 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Sub-User non trovato');
  });

  it('dovrebbe permettere ricarica con legacy parent_id match', async () => {
    // Sub-user con parent_id = reseller
    mockQuery(
      'users',
      { id: SUB_USER_ID },
      {
        data: {
          id: SUB_USER_ID,
          email: 'subuser@test.com',
          name: 'Sub User',
          wallet_balance: 100,
          parent_id: RESELLER_ID,
        },
        error: null,
      }
    );

    const result = await manageSubUserWallet(SUB_USER_ID, 50, 'Ricarica test');

    expect(result.success).toBe(true);
    expect(result.message).toContain('50');
  });

  it('dovrebbe permettere ricarica con workspace V2 match', async () => {
    // Sub-user SENZA parent_id (creato via workspace V2)
    mockQuery(
      'users',
      { id: SUB_USER_ID },
      {
        data: {
          id: SUB_USER_ID,
          email: 'subuser@test.com',
          name: 'Sub User V2',
          wallet_balance: 0,
          parent_id: null,
        },
        error: null,
      }
    );

    // Reseller ha primary_workspace_id
    mockQuery(
      'users',
      { id: RESELLER_ID },
      {
        data: { primary_workspace_id: RESELLER_WS_ID },
        error: null,
      }
    );

    // Sub-user e' owner di un workspace figlio del reseller
    // Nota: per workspace_members la query usa eq('user_id', ...) eq('status', ...) eq('role', ...)
    // Ma single() non funziona per array, usiamo un approccio diverso
    mockQuery(
      'workspace_members',
      { user_id: SUB_USER_ID },
      {
        data: [
          {
            workspace_id: SUB_USER_WS_ID,
            workspaces: { parent_workspace_id: RESELLER_WS_ID },
          },
        ],
        error: null,
      }
    );

    const result = await manageSubUserWallet(SUB_USER_ID, 50, 'Ricarica V2');

    expect(result.success).toBe(true);
  });

  it('dovrebbe rifiutare se ne legacy ne workspace V2 match', async () => {
    // Sub-user con parent_id diverso
    mockQuery(
      'users',
      { id: SUB_USER_ID },
      {
        data: {
          id: SUB_USER_ID,
          email: 'subuser@test.com',
          name: 'Sub User Other',
          wallet_balance: 100,
          parent_id: 'other-reseller-uuid',
        },
        error: null,
      }
    );

    // Reseller ha primary_workspace_id
    mockQuery(
      'users',
      { id: RESELLER_ID },
      {
        data: { primary_workspace_id: RESELLER_WS_ID },
        error: null,
      }
    );

    // Sub-user NON e' in un workspace figlio del reseller
    mockQuery(
      'workspace_members',
      { user_id: SUB_USER_ID },
      {
        data: [
          {
            workspace_id: 'other-ws-uuid',
            workspaces: { parent_workspace_id: 'other-parent-ws-uuid' },
          },
        ],
        error: null,
      }
    );

    const result = await manageSubUserWallet(SUB_USER_ID, 50, 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Non hai i permessi');
  });
});
