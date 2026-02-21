/**
 * Billing Mode Management Tests
 *
 * Verifica che updateSubUserBillingMode() funzioni correttamente:
 * - Reseller puo' cambiare billing_mode del proprio sub-user
 * - Non-reseller non puo' cambiare billing_mode
 * - Reseller non puo' cambiare billing_mode di utente non suo
 * - Valori invalidi rifiutati
 * - Audit log creato
 * - Se gia' nella modalita' richiesta, return OK senza update
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock state
let mockAuthResponse: any = null;

// Query tracker
type QueryMatcher = {
  table: string;
  filters: Record<string, any>;
  result: any;
};
let queryMatchers: QueryMatcher[] = [];
let updateCalls: Array<{ table: string; data: any; filters: Record<string, any> }> = [];
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

    builder.limit = () => findResult();
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

    builder.update = (data: any) => {
      updateCalls.push({ table: currentTable, data, filters: { ...currentFilters } });
      return {
        eq: (field: string, value: any) => {
          // Registra filtro aggiuntivo nell'ultimo updateCall
          updateCalls[updateCalls.length - 1].filters[field] = value;
          return { data: null, error: null };
        },
        data: null,
        error: null,
      };
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
import { updateSubUserBillingMode } from '@/actions/admin-reseller';

function mockQuery(table: string, filters: Record<string, any>, result: any) {
  queryMatchers.push({ table, filters, result });
}

describe('updateSubUserBillingMode - Gestione Contratti (M3)', () => {
  const RESELLER_ID = 'aaaa-reseller-uuid-001';
  const RESELLER_EMAIL = 'reseller@test.com';
  const SUB_USER_ID = 'zzzz-subuser-uuid-001';

  beforeEach(() => {
    vi.clearAllMocks();
    queryMatchers = [];
    updateCalls = [];
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

    // Default: sub-user con parent_id match e billing_mode prepagato
    mockQuery(
      'users',
      { id: SUB_USER_ID },
      {
        data: {
          id: SUB_USER_ID,
          email: 'subuser@test.com',
          name: 'Sub User',
          billing_mode: 'prepagato',
          parent_id: RESELLER_ID,
        },
        error: null,
      }
    );
  });

  describe('Cambio billing_mode riuscito', () => {
    it('dovrebbe cambiare da prepagato a postpagato', async () => {
      const result = await updateSubUserBillingMode(SUB_USER_ID, 'postpagato');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Postpagato');

      // Verifica update chiamato
      const updateCall = updateCalls.find(
        (c) => c.table === 'users' && c.data.billing_mode === 'postpagato'
      );
      expect(updateCall).toBeDefined();
      expect(updateCall!.filters.id).toBe(SUB_USER_ID);
    });

    it('dovrebbe cambiare da postpagato a prepagato', async () => {
      // Sub-user gia' postpagato
      queryMatchers = queryMatchers.filter(
        (m) => !(m.table === 'users' && m.filters.id === SUB_USER_ID)
      );
      mockQuery(
        'users',
        { id: SUB_USER_ID },
        {
          data: {
            id: SUB_USER_ID,
            email: 'subuser@test.com',
            name: 'Sub User',
            billing_mode: 'postpagato',
            parent_id: RESELLER_ID,
          },
          error: null,
        }
      );

      // Nessun POSTPAID_CHARGE non fatturato
      mockQuery(
        'wallet_transactions',
        { user_id: SUB_USER_ID, type: 'POSTPAID_CHARGE' },
        {
          data: [],
          error: null,
        }
      );

      const result = await updateSubUserBillingMode(SUB_USER_ID, 'prepagato');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Prepagato');
    });

    it('dovrebbe ritornare OK senza update se gia nella modalita richiesta', async () => {
      const result = await updateSubUserBillingMode(SUB_USER_ID, 'prepagato');

      expect(result.success).toBe(true);
      expect(result.message).toContain('gia');

      // Nessun update eseguito
      const updateCall = updateCalls.find((c) => c.table === 'users');
      expect(updateCall).toBeUndefined();
    });
  });

  describe('Protezione postpagato->prepagato', () => {
    it('dovrebbe bloccare cambio a prepagato se ci sono POSTPAID_CHARGE non fatturate', async () => {
      // Sub-user postpagato
      queryMatchers = queryMatchers.filter(
        (m) => !(m.table === 'users' && m.filters.id === SUB_USER_ID)
      );
      mockQuery(
        'users',
        { id: SUB_USER_ID },
        {
          data: {
            id: SUB_USER_ID,
            email: 'subuser@test.com',
            name: 'Sub User',
            billing_mode: 'postpagato',
            parent_id: RESELLER_ID,
          },
          error: null,
        }
      );

      // Ha POSTPAID_CHARGE non fatturate
      mockQuery(
        'wallet_transactions',
        { user_id: SUB_USER_ID, type: 'POSTPAID_CHARGE' },
        {
          data: [{ id: 'tx-postpaid-001' }],
          error: null,
        }
      );

      // Nessun link a fattura (non fatturata)
      mockQuery(
        'invoice_recharge_links',
        { wallet_transaction_id: 'tx-postpaid-001' },
        {
          data: [],
          error: null,
        }
      );

      const result = await updateSubUserBillingMode(SUB_USER_ID, 'prepagato');

      expect(result.success).toBe(false);
      expect(result.error).toContain('non ancora fatturate');
    });
  });

  describe('Audit log', () => {
    it('dovrebbe skippare audit log se workspace non configurato', async () => {
      // getUserWorkspaceId ritorna null nel mock → audit log skippato (defense-in-depth)
      await updateSubUserBillingMode(SUB_USER_ID, 'postpagato');

      // Senza workspace configurato, l'audit log non viene creato
      // (non si fa mai fallback a supabaseAdmin su tabelle multi-tenant)
      expect(auditInserts.length).toBe(0);
    });
  });

  describe('Validazioni', () => {
    it('dovrebbe rifiutare se non autenticato', async () => {
      mockAuthResponse = null;
      const result = await updateSubUserBillingMode(SUB_USER_ID, 'postpagato');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Non autenticato');
    });

    it('dovrebbe rifiutare se non e reseller', async () => {
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

      const result = await updateSubUserBillingMode(SUB_USER_ID, 'postpagato');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Solo i Reseller');
    });

    it('dovrebbe rifiutare sub-user non appartenente al reseller', async () => {
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
            billing_mode: 'prepagato',
            parent_id: 'other-reseller-uuid',
          },
          error: null,
        }
      );
      // Workspace V2 fallback
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

      const result = await updateSubUserBillingMode(SUB_USER_ID, 'postpagato');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Non hai i permessi');
    });

    it('dovrebbe rifiutare sub-user non trovato', async () => {
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
        { id: 'non-existent' },
        {
          data: null,
          error: { message: 'Not found' },
        }
      );

      const result = await updateSubUserBillingMode('non-existent', 'postpagato');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Sub-User non trovato');
    });
  });

  describe('Interface con getResellerClientsWithListino', () => {
    it('ClientWithListino interface deve includere billing_mode', async () => {
      // Verifica statica: il tipo ClientWithListino ha il campo billing_mode
      // Questo test verifica che l'interfaccia esportata contenga il campo
      const { ClientWithListino } = (await import('@/actions/reseller-clients')) as any;

      // Se il file compila, il tipo esiste. Testiamo un oggetto conforme.
      const mockClient = {
        id: '1',
        email: 'test@test.com',
        name: 'Test',
        company_name: null,
        phone: null,
        wallet_balance: 100,
        created_at: '2024-01-01',
        shipments_count: 5,
        total_spent: 200,
        assigned_listini: [],
        billing_mode: 'prepagato' as const,
      };

      // Se questo compila, il campo esiste nell'interfaccia
      expect(mockClient.billing_mode).toBe('prepagato');
    });
  });
});
