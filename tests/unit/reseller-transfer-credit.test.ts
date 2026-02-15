/**
 * Reseller Transfer Credit Tests
 *
 * Verifica che manageSubUserWallet() usi la nuova RPC reseller_transfer_credit:
 * - Transfer atomico: debit reseller + credit sub-user in una transazione
 * - Saldo insufficiente reseller -> errore, nessun credito al sub-user
 * - Idempotency: doppia chiamata stessa key -> replay
 * - Ownership: reseller non puo' trasferire a utente non suo
 * - Importo invalido -> errore
 * - Audit log con tipo 'reseller_transfer'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stato mock per controllare risposte
let mockAuthResponse: any = null;

// Query tracker
type QueryMatcher = {
  table: string;
  filters: Record<string, any>;
  result: any;
};
let queryMatchers: QueryMatcher[] = [];
let rpcCalls: Array<{ name: string; params: any }> = [];
let rpcResults: Record<string, any> = {};
let auditInserts: any[] = [];

vi.mock('@/lib/db/client', () => {
  const createQueryBuilder = () => {
    let currentTable = '';
    let currentFilters: Record<string, any> = {};

    const findResult = () => {
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

    builder.then = (resolve: any) => {
      const result = findResult();
      return resolve(result);
    };

    builder.insert = (data: any) => {
      if (currentTable === 'audit_logs') {
        auditInserts.push(data);
      }
      return { data: null, error: null };
    };

    builder.rpc = (name: string, params: any) => {
      rpcCalls.push({ name, params });
      return rpcResults[name] ?? { data: null, error: { message: 'RPC not mocked' } };
    };

    return builder;
  };

  return { supabaseAdmin: createQueryBuilder() };
});

vi.mock('@/lib/safe-auth', () => ({
  getSafeAuth: vi.fn(() => mockAuthResponse),
}));

vi.mock('@/lib/workspace-auth', () => ({
  getWorkspaceAuth: vi.fn(() => mockAuthResponse),
  requireWorkspaceAuth: vi.fn(() => {
    if (!mockAuthResponse) throw new Error('UNAUTHORIZED: Workspace access required');
    return mockAuthResponse;
  }),
}));

// Import dopo i mock
import { manageSubUserWallet } from '@/actions/admin-reseller';

function mockQuery(table: string, filters: Record<string, any>, result: any) {
  queryMatchers.push({ table, filters, result });
}

describe('manageSubUserWallet - Reseller Transfer Credit (M2)', () => {
  const RESELLER_ID = 'aaaa-reseller-uuid-001';
  const RESELLER_EMAIL = 'reseller@test.com';
  const SUB_USER_ID = 'zzzz-subuser-uuid-001';

  beforeEach(() => {
    vi.clearAllMocks();
    queryMatchers = [];
    rpcCalls = [];
    rpcResults = {};
    auditInserts = [];

    // Default: autenticato come reseller
    mockAuthResponse = {
      actor: {
        id: RESELLER_ID,
        email: RESELLER_EMAIL,
        account_type: 'user',
        is_reseller: true,
        role: 'user',
      },
      workspace: { id: 'ws-test-123' },
      target: { id: RESELLER_ID, email: RESELLER_EMAIL },
      isImpersonating: false,
      metadata: {},
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

    // Default: sub-user con parent_id match (legacy)
    mockQuery(
      'users',
      { id: SUB_USER_ID },
      {
        data: {
          id: SUB_USER_ID,
          email: 'subuser@test.com',
          name: 'Sub User',
          wallet_balance: 0,
          parent_id: RESELLER_ID,
        },
        error: null,
      }
    );

    // Default: RPC reseller_transfer_credit OK
    rpcResults['reseller_transfer_credit'] = {
      data: {
        success: true,
        idempotent_replay: false,
        transaction_id_out: 'tx-out-001',
        transaction_id_in: 'tx-in-001',
        reseller_previous_balance: 500,
        reseller_new_balance: 450,
        sub_user_previous_balance: 0,
        sub_user_new_balance: 50,
        amount_transferred: 50,
      },
      error: null,
    };
  });

  describe('Usa RPC reseller_transfer_credit', () => {
    it('dovrebbe chiamare reseller_transfer_credit invece di add_wallet_credit', async () => {
      const result = await manageSubUserWallet(SUB_USER_ID, 50, 'Test transfer');

      expect(result.success).toBe(true);

      // Verifica che sia stata chiamata la nuova RPC
      const transferCall = rpcCalls.find((c) => c.name === 'reseller_transfer_credit');
      expect(transferCall).toBeDefined();
      expect(transferCall!.params.p_reseller_id).toBe(RESELLER_ID);
      expect(transferCall!.params.p_sub_user_id).toBe(SUB_USER_ID);
      expect(transferCall!.params.p_amount).toBe(50);
      expect(transferCall!.params.p_description).toBe('Test transfer');

      // Verifica che NON sia stata chiamata la vecchia RPC
      const oldCall = rpcCalls.find((c) => c.name === 'add_wallet_credit');
      expect(oldCall).toBeUndefined();
    });

    it('dovrebbe passare idempotency_key stabile alla RPC', async () => {
      await manageSubUserWallet(SUB_USER_ID, 50, 'Test');

      const transferCall = rpcCalls.find((c) => c.name === 'reseller_transfer_credit');
      expect(transferCall!.params.p_idempotency_key).toBeDefined();
      expect(transferCall!.params.p_idempotency_key).toMatch(/^reseller-transfer-[a-f0-9]{16}$/);
    });

    it('dovrebbe generare la stessa key per la stessa operazione (anti double-click)', async () => {
      // Prima chiamata
      await manageSubUserWallet(SUB_USER_ID, 50, 'Test');
      const key1 = rpcCalls.find((c) => c.name === 'reseller_transfer_credit')!.params
        .p_idempotency_key;

      // Reset e seconda chiamata (stessi parametri, stessa finestra temporale)
      rpcCalls = [];
      await manageSubUserWallet(SUB_USER_ID, 50, 'Test');
      const key2 = rpcCalls.find((c) => c.name === 'reseller_transfer_credit')!.params
        .p_idempotency_key;

      // Stessa operazione nella stessa finestra = stessa key
      expect(key1).toBe(key2);
    });

    it('dovrebbe generare key diverse per importi diversi', async () => {
      await manageSubUserWallet(SUB_USER_ID, 50, 'Test');
      const key50 = rpcCalls.find((c) => c.name === 'reseller_transfer_credit')!.params
        .p_idempotency_key;

      rpcCalls = [];
      await manageSubUserWallet(SUB_USER_ID, 100, 'Test');
      const key100 = rpcCalls.find((c) => c.name === 'reseller_transfer_credit')!.params
        .p_idempotency_key;

      expect(key50).not.toBe(key100);
    });
  });

  describe('Gestione errori RPC', () => {
    it('dovrebbe mostrare messaggio user-friendly per saldo insufficiente', async () => {
      rpcResults['reseller_transfer_credit'] = {
        data: null,
        error: {
          message:
            'Saldo reseller insufficiente (reseller@test.com). Disponibile: 10, Richiesto: 50',
        },
      };

      const result = await manageSubUserWallet(SUB_USER_ID, 50, 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Saldo insufficiente');
      expect(result.error).toContain('50');
    });

    it('dovrebbe propagare errori generici dalla RPC', async () => {
      rpcResults['reseller_transfer_credit'] = {
        data: null,
        error: { message: 'Connection timeout' },
      };

      const result = await manageSubUserWallet(SUB_USER_ID, 50, 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection timeout');
    });
  });

  describe('Audit log', () => {
    it("dovrebbe loggare con tipo 'reseller_transfer'", async () => {
      await manageSubUserWallet(SUB_USER_ID, 50, 'Ricarica test');

      expect(auditInserts.length).toBeGreaterThan(0);
      const auditEntry = auditInserts[0];
      expect(auditEntry.action).toBe('reseller_transfer_credit');
      expect(auditEntry.metadata.type).toBe('reseller_transfer');
      expect(auditEntry.metadata.amount).toBe(50);
      expect(auditEntry.metadata.target_user_id).toBe(SUB_USER_ID);
      expect(auditEntry.metadata.transaction_id_out).toBe('tx-out-001');
      expect(auditEntry.metadata.transaction_id_in).toBe('tx-in-001');
    });
  });

  describe('Risultato transfer', () => {
    it('dovrebbe ritornare nuovo balance del sub-user dalla RPC', async () => {
      const result = await manageSubUserWallet(SUB_USER_ID, 50, 'Test');

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(50);
      expect(result.transactionId).toBe('tx-in-001');
    });

    it('dovrebbe includere messaggio di conferma con importo', async () => {
      const result = await manageSubUserWallet(SUB_USER_ID, 100, 'Test');

      expect(result.success).toBe(true);
      expect(result.message).toContain('100');
    });
  });

  describe('Validazioni base (invarianti)', () => {
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

    it('dovrebbe rifiutare se non autenticato', async () => {
      mockAuthResponse = null;
      const result = await manageSubUserWallet(SUB_USER_ID, 50, 'Test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Non autenticato');
    });

    it("dovrebbe rifiutare se non e' reseller", async () => {
      // Aggiorna auth context per non-reseller
      mockAuthResponse = {
        ...mockAuthResponse,
        actor: { ...mockAuthResponse.actor, is_reseller: false },
      };
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

    it('dovrebbe rifiutare se sub-user non appartiene al reseller', async () => {
      queryMatchers = [];
      mockQuery(
        'users',
        { email: RESELLER_EMAIL },
        {
          data: { id: RESELLER_ID, is_reseller: true },
          error: null,
        }
      );
      mockQuery(
        'users',
        { id: SUB_USER_ID },
        {
          data: {
            id: SUB_USER_ID,
            email: 'other@test.com',
            name: 'Other User',
            wallet_balance: 100,
            parent_id: 'other-reseller-uuid',
          },
          error: null,
        }
      );
      mockQuery(
        'users',
        { id: RESELLER_ID },
        {
          data: { primary_workspace_id: 'reseller-ws-001' },
          error: null,
        }
      );
      mockQuery(
        'workspace_members',
        { user_id: SUB_USER_ID },
        {
          data: [{ workspace_id: 'other-ws', workspaces: { parent_workspace_id: 'other-parent' } }],
          error: null,
        }
      );

      const result = await manageSubUserWallet(SUB_USER_ID, 50, 'Test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Non hai i permessi');
    });
  });
});

describe('RPC reseller_transfer_credit - SQL contract', () => {
  it('la migrazione SQL deve esistere', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260216100000_reseller_transfer_credit.sql'
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('la migrazione deve contenere la funzione reseller_transfer_credit', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260216100000_reseller_transfer_credit.sql'
    );
    const content = fs.readFileSync(migrationPath, 'utf-8');

    // Verifica struttura funzione
    expect(content).toContain('reseller_transfer_credit');
    expect(content).toContain('p_reseller_id UUID');
    expect(content).toContain('p_sub_user_id UUID');
    expect(content).toContain('p_amount DECIMAL');
    expect(content).toContain('p_idempotency_key');
    expect(content).toContain('SECURITY DEFINER');
    expect(content).toContain("search_path = 'public'");
  });

  it('la migrazione deve implementare lock deterministico', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260216100000_reseller_transfer_credit.sql'
    );
    const content = fs.readFileSync(migrationPath, 'utf-8');

    // Lock deterministico: ordina per UUID per evitare deadlock
    expect(content).toContain('p_reseller_id < p_sub_user_id');
    expect(content).toContain('FOR UPDATE NOWAIT');
  });

  it('la migrazione deve creare 2 wallet_transactions (out + in)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260216100000_reseller_transfer_credit.sql'
    );
    const content = fs.readFileSync(migrationPath, 'utf-8');

    expect(content).toContain('RESELLER_TRANSFER_OUT');
    expect(content).toContain('RESELLER_TRANSFER_IN');
    expect(content).toContain('-p_amount'); // Debit negativo
    expect(content).toContain('p_amount'); // Credit positivo
  });

  it('la migrazione deve gestire idempotency', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260216100000_reseller_transfer_credit.sql'
    );
    const content = fs.readFileSync(migrationPath, 'utf-8');

    expect(content).toContain('idempotent_replay');
    expect(content).toContain("'-out'");
    expect(content).toContain("'-in'");
  });

  it('la migrazione deve validare input', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260216100000_reseller_transfer_credit.sql'
    );
    const content = fs.readFileSync(migrationPath, 'utf-8');

    // Validazione importo
    expect(content).toContain('p_amount <= 0');
    expect(content).toContain('10000');
    // No self-transfer
    expect(content).toContain('p_reseller_id = p_sub_user_id');
  });
});
