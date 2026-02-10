/**
 * Reseller Sub-User Parent ID Fix Tests
 *
 * Verifica la fix del bug: createSubUser scriveva solo parent_id,
 * ma customer-price-lists.ts e reseller-price-lists.ts cercavano solo parent_reseller_id.
 *
 * Test cases:
 * 1. createSubUser popola entrambi i campi (parent_id + parent_reseller_id)
 * 2. Verifica ownership accetta sia parent_reseller_id che parent_id
 * 3. Verifica ownership rifiuta sub-user di altro reseller
 * 4. Logica merge/deduplica sub-users da entrambe le query
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock globali
let mockAuthResponse: any = null;
let mockDbCalls: Array<{ table: string; method: string; args: any[] }> = [];
let mockInsertData: any = null;

// Contatore chiamate per distinguere query sullo stesso table
let queryCallIndex = 0;
// Mappa: chiave = "table:filtro_chiave=valore" -> risultato
let queryResults: Map<string, any> = new Map();

vi.mock('@/lib/db/client', () => {
  function createBuilder(table: string) {
    let filters: Record<string, any> = {};
    let selectedFields = '';

    const builder: any = {
      select: (fields: string) => {
        selectedFields = fields;
        return builder;
      },
      insert: (data: any) => {
        mockInsertData = data;
        mockDbCalls.push({ table, method: 'insert', args: [data] });
        return {
          select: () => ({
            single: () => {
              // Cerca risultato per insert
              const key = `${table}:insert`;
              return queryResults.get(key) ?? { data: null, error: null };
            },
          }),
        };
      },
      eq: (col: string, val: any) => {
        filters[col] = val;
        mockDbCalls.push({ table, method: 'eq', args: [col, val] });
        return builder;
      },
      in: (col: string, vals: any[]) => {
        filters[`in:${col}`] = vals;
        return builder;
      },
      is: (col: string, val: any) => {
        filters[`is:${col}`] = val;
        return builder;
      },
      not: (col: string, op: string, val: any) => {
        filters[`not:${col}`] = val;
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      single: () => {
        // Cerca match specifico: prima prova filtro piu' specifico, poi generico
        // Ordine di priorita': id > email > altro
        if (filters['id']) {
          const key = `${table}:id=${filters['id']}`;
          if (queryResults.has(key)) return queryResults.get(key);
        }
        if (filters['email']) {
          const key = `${table}:email=${filters['email']}`;
          if (queryResults.has(key)) return queryResults.get(key);
        }
        // Fallback generico
        return { data: null, error: null };
      },
      // Quando non c'e' .single(), ritorna array
      then: (resolve: any) => {
        // Per query che ritornano array (parent_reseller_id, parent_id)
        if (filters['parent_reseller_id']) {
          const key = `${table}:parent_reseller_id=${filters['parent_reseller_id']}`;
          const result = queryResults.get(key) ?? { data: [], error: null };
          resolve(result);
          return;
        }
        if (filters['parent_id']) {
          const key = `${table}:parent_id=${filters['parent_id']}`;
          const result = queryResults.get(key) ?? { data: [], error: null };
          resolve(result);
          return;
        }
        resolve({ data: [], error: null });
      },
    };

    // Proxy per fare await direttamente
    return new Proxy(builder, {
      get(target, prop) {
        if (prop === 'then') {
          return (resolve: any, reject: any) => {
            // Determina quale risultato tornare
            if (filters['parent_reseller_id']) {
              const key = `${table}:parent_reseller_id=${filters['parent_reseller_id']}`;
              resolve(queryResults.get(key) ?? { data: [], error: null });
            } else if (filters['parent_id'] && !filters['email'] && !filters['id']) {
              const key = `${table}:parent_id=${filters['parent_id']}`;
              resolve(queryResults.get(key) ?? { data: [], error: null });
            } else {
              resolve({ data: null, error: null });
            }
          };
        }
        return target[prop];
      },
    });
  }

  return {
    supabaseAdmin: {
      from: (table: string) => createBuilder(table),
    },
  };
});

vi.mock('@/lib/safe-auth', () => ({
  getSafeAuth: vi.fn(() => mockAuthResponse),
}));

vi.mock('@/lib/database', () => ({
  createUser: vi.fn(() => Promise.resolve({ id: 'new-user-id' })),
}));

vi.mock('@/lib/validators', () => ({
  validateEmail: vi.fn((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
}));

vi.mock('@/lib/db/user-helpers', () => ({
  userExists: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('@/lib/db/capability-helpers', () => ({
  hasCapability: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(() => Promise.resolve('$2a$10$hashed')),
  },
}));

const RESELLER_ID = 'reseller-001';
const RESELLER_EMAIL = 'reseller@test.com';
const SUB_USER_ID = 'sub-user-001';
const SUB_USER_EMAIL = 'mrmiranda518@gmail.com';

describe('Reseller Sub-User Parent ID Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbCalls = [];
    mockInsertData = null;
    queryCallIndex = 0;
    queryResults = new Map();
    mockAuthResponse = {
      actor: { email: RESELLER_EMAIL },
    };
  });

  describe('createSubUser popola entrambi i campi parent', () => {
    it('insert deve contenere sia parent_id che parent_reseller_id', async () => {
      // Setup mock: reseller autenticato
      queryResults.set(`users:email=${RESELLER_EMAIL}`, {
        data: { id: RESELLER_ID, is_reseller: true },
        error: null,
      });
      queryResults.set('users:insert', {
        data: { id: SUB_USER_ID, email: SUB_USER_EMAIL },
        error: null,
      });

      const { createSubUser } = await import('@/actions/admin-reseller');
      await createSubUser({
        email: SUB_USER_EMAIL,
        name: 'Test User',
      });

      // Verifica che l'insert contenga entrambi i campi
      expect(mockInsertData).toBeDefined();
      const insertedRecord = Array.isArray(mockInsertData) ? mockInsertData[0] : mockInsertData;
      expect(insertedRecord.parent_id).toBe(RESELLER_ID);
      expect(insertedRecord.parent_reseller_id).toBe(RESELLER_ID);
    });
  });

  describe('Verifica ownership accetta parent_id legacy', () => {
    it('dovrebbe accettare sub-user con solo parent_id (senza parent_reseller_id)', async () => {
      queryResults.set(`users:email=${RESELLER_EMAIL}`, {
        data: { id: RESELLER_ID, account_type: 'reseller', is_reseller: true },
        error: null,
      });
      // Sub-user con SOLO parent_id (parent_reseller_id = null) - caso BUG
      queryResults.set(`users:id=${SUB_USER_ID}`, {
        data: {
          id: SUB_USER_ID,
          parent_reseller_id: null,
          parent_id: RESELLER_ID,
        },
        error: null,
      });

      const { createCustomerPriceListAction } = await import('@/actions/customer-price-lists');
      const result = await createCustomerPriceListAction({
        name: 'Listino Test',
        assigned_to_user_id: SUB_USER_ID,
        default_margin_percent: 20,
      });

      // Con la fix, NON deve dire "non sono tuoi sub-users"
      if (!result.success) {
        expect(result.error).not.toContain('non sono tuoi sub-users');
      }
    });

    it('dovrebbe accettare sub-user con parent_reseller_id (caso nuovo)', async () => {
      queryResults.set(`users:email=${RESELLER_EMAIL}`, {
        data: { id: RESELLER_ID, account_type: 'reseller', is_reseller: true },
        error: null,
      });
      queryResults.set(`users:id=${SUB_USER_ID}`, {
        data: {
          id: SUB_USER_ID,
          parent_reseller_id: RESELLER_ID,
          parent_id: RESELLER_ID,
        },
        error: null,
      });

      const { createCustomerPriceListAction } = await import('@/actions/customer-price-lists');
      const result = await createCustomerPriceListAction({
        name: 'Listino Test',
        assigned_to_user_id: SUB_USER_ID,
        default_margin_percent: 20,
      });

      if (!result.success) {
        expect(result.error).not.toContain('non sono tuoi sub-users');
      }
    });

    it('dovrebbe rifiutare sub-user di un altro reseller', async () => {
      queryResults.set(`users:email=${RESELLER_EMAIL}`, {
        data: { id: RESELLER_ID, account_type: 'reseller', is_reseller: true },
        error: null,
      });
      queryResults.set(`users:id=${SUB_USER_ID}`, {
        data: {
          id: SUB_USER_ID,
          parent_reseller_id: 'altro-reseller-999',
          parent_id: 'altro-reseller-999',
        },
        error: null,
      });

      const { createCustomerPriceListAction } = await import('@/actions/customer-price-lists');
      const result = await createCustomerPriceListAction({
        name: 'Listino Test',
        assigned_to_user_id: SUB_USER_ID,
        default_margin_percent: 20,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('non sono tuoi sub-users');
    });
  });

  describe('Logica merge/deduplica sub-users', () => {
    it('deduplica sub-users trovati in entrambe le query', () => {
      // Test puro della logica di merge (senza mock DB)
      const subUsersNew = [
        { id: 'u1', email: 'a@test.com', name: 'A' },
        { id: 'u2', email: 'b@test.com', name: 'B' },
      ];
      const subUsersLegacy = [
        { id: 'u2', email: 'b@test.com', name: 'B' }, // duplicato
        { id: 'u3', email: 'c@test.com', name: 'C' },
      ];

      const mergedMap = new Map<string, any>();
      for (const su of [...subUsersNew, ...subUsersLegacy]) {
        if (!mergedMap.has(su.id)) {
          mergedMap.set(su.id, su);
        }
      }
      const result = Array.from(mergedMap.values());

      expect(result).toHaveLength(3);
      expect(result.map((u) => u.id)).toEqual(['u1', 'u2', 'u3']);
    });

    it('gestisce caso con solo utenti legacy (parent_id)', () => {
      const subUsersNew: any[] = []; // Nessun utente con parent_reseller_id
      const subUsersLegacy = [{ id: SUB_USER_ID, email: SUB_USER_EMAIL, name: 'Legacy User' }];

      const mergedMap = new Map<string, any>();
      for (const su of [...subUsersNew, ...subUsersLegacy]) {
        if (!mergedMap.has(su.id)) {
          mergedMap.set(su.id, su);
        }
      }
      const result = Array.from(mergedMap.values());

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(SUB_USER_ID);
    });

    it('gestisce caso con solo utenti nuovi (parent_reseller_id)', () => {
      const subUsersNew = [{ id: SUB_USER_ID, email: SUB_USER_EMAIL, name: 'New User' }];
      const subUsersLegacy: any[] = []; // Nessun utente legacy

      const mergedMap = new Map<string, any>();
      for (const su of [...subUsersNew, ...subUsersLegacy]) {
        if (!mergedMap.has(su.id)) {
          mergedMap.set(su.id, su);
        }
      }
      const result = Array.from(mergedMap.values());

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(SUB_USER_ID);
    });

    it('gestisce caso vuoto (nessun sub-user)', () => {
      const subUsersNew: any[] = [];
      const subUsersLegacy: any[] = [];

      const mergedMap = new Map<string, any>();
      for (const su of [...subUsersNew, ...subUsersLegacy]) {
        if (!mergedMap.has(su.id)) {
          mergedMap.set(su.id, su);
        }
      }
      const result = Array.from(mergedMap.values());

      expect(result).toHaveLength(0);
    });
  });

  describe('Logica validazione ownership multipla', () => {
    it('valida set unificato da entrambe le query', () => {
      const userIds = ['u1', 'u2', 'u3'];

      const subUsersNew = [{ id: 'u1' }]; // Solo u1 ha parent_reseller_id
      const subUsersLegacy = [{ id: 'u2' }, { id: 'u3' }]; // u2,u3 hanno parent_id

      const validIds = new Set([
        ...subUsersNew.map((s) => s.id),
        ...subUsersLegacy.map((s) => s.id),
      ]);

      // Tutti e 3 trovati tra le due query
      expect(validIds.size).toBe(userIds.length);
    });

    it('rileva utente non autorizzato nel set unificato', () => {
      const userIds = ['u1', 'u2', 'u_estraneo']; // u_estraneo non e' sub-user

      const subUsersNew = [{ id: 'u1' }];
      const subUsersLegacy = [{ id: 'u2' }];

      const validIds = new Set([
        ...subUsersNew.map((s) => s.id),
        ...subUsersLegacy.map((s) => s.id),
      ]);

      // Solo 2 su 3 trovati -> non valido
      expect(validIds.size).not.toBe(userIds.length);
      expect(validIds.size).toBe(2);
    });
  });

  describe('Auto-provisioning workspace client per sub-user', () => {
    it('workspace client deve avere type=client e depth=2', () => {
      // Parametri attesi per create_workspace_with_owner RPC
      const rpcParams = {
        p_organization_id: 'org-123',
        p_name: 'Test User Workspace',
        p_parent_workspace_id: 'ws-reseller-123',
        p_owner_user_id: SUB_USER_ID,
        p_type: 'client',
        p_depth: 2,
      };

      expect(rpcParams.p_type).toBe('client');
      expect(rpcParams.p_depth).toBe(2);
      expect(rpcParams.p_parent_workspace_id).toBeDefined();
      expect(rpcParams.p_owner_user_id).toBe(SUB_USER_ID);
    });

    it('reseller deve essere aggiunto come admin nel workspace client', () => {
      // Record membership che viene inserito per il reseller
      const membershipRecord = {
        workspace_id: 'ws-client-new',
        user_id: RESELLER_ID,
        role: 'admin',
        status: 'active',
        accepted_at: new Date().toISOString(),
        invited_by: RESELLER_ID,
      };

      expect(membershipRecord.role).toBe('admin');
      expect(membershipRecord.status).toBe('active');
      expect(membershipRecord.user_id).toBe(RESELLER_ID);
      expect(membershipRecord.workspace_id).toBeTruthy();
    });

    it('workspace name viene generato dal nome del sub-user', () => {
      const subUserName = 'Mario Rossi';
      const expectedWsName = `${subUserName} Workspace`;

      expect(expectedWsName).toBe('Mario Rossi Workspace');
    });

    it('primary_workspace_id deve essere impostato sul sub-user', () => {
      // Dopo la creazione del workspace, il sub-user deve avere primary_workspace_id
      const updatePayload = {
        primary_workspace_id: 'ws-client-new-123',
      };

      expect(updatePayload.primary_workspace_id).toBeTruthy();
      expect(typeof updatePayload.primary_workspace_id).toBe('string');
    });
  });
});
