/**
 * Test C1 R2: F-MT-1 — buildContext fail-closed su tabelle WORKSPACE_SCOPED
 *
 * Verifica che buildContext NON usi supabaseAdmin su tabelle multi-tenant
 * quando workspaceId è assente. Pattern fail-closed: skip senza dati.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track chiamate a supabaseAdmin.from() e workspaceQuery
let supabaseAdminFromCalls: string[] = [];
let workspaceQueryCalls: string[] = [];

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      supabaseAdminFromCalls.push(table);
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({ data: { wallet_balance: '100.00' }, error: null })
            ),
          })),
        })),
      };
    }),
  },
}));

vi.mock('@/lib/db/workspace-query', () => ({
  workspaceQuery: vi.fn((wsId: string) => {
    return {
      from: vi.fn((table: string) => {
        workspaceQueryCalls.push(table);
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
              single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
            gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
            in: vi.fn(() => ({
              gte: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
                })),
              })),
            })),
          })),
        };
      }),
    };
  }),
}));

vi.mock('@/lib/ai/user-memory', () => ({
  getUserMemory: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/crm/crm-data-service', () => ({
  getPipelineSummary: vi.fn().mockResolvedValue({
    total: 0,
    byStatus: {},
    avgScore: 0,
    pipelineValue: 0,
  }),
  getHotEntities: vi.fn().mockResolvedValue([]),
  getHealthAlerts: vi.fn().mockResolvedValue([]),
  getPendingQuotes: vi.fn().mockResolvedValue([]),
}));

import { buildContext } from '@/lib/ai/context-builder';

// Tabelle WORKSPACE_SCOPED che NON devono mai usare supabaseAdmin
const WORKSPACE_SCOPED_TABLES = ['shipments', 'cod_items', 'audit_logs'];

describe('buildContext fail-closed multi-tenant (F-MT-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseAdminFromCalls = [];
    workspaceQueryCalls = [];
  });

  it('workspaceId=undefined → nessuna query su cod_items via supabaseAdmin', async () => {
    await buildContext('user-1', 'admin', 'Test Admin');

    // supabaseAdmin NON deve toccare cod_items
    expect(supabaseAdminFromCalls).not.toContain('cod_items');
  });

  it('workspaceId=undefined → nessuna query su audit_logs via supabaseAdmin', async () => {
    await buildContext('user-1', 'admin', 'Test Admin');

    // supabaseAdmin NON deve toccare audit_logs
    expect(supabaseAdminFromCalls).not.toContain('audit_logs');
  });

  it('workspaceId=undefined → nessuna query su shipments via supabaseAdmin', async () => {
    await buildContext('user-1', 'admin', 'Test Admin');

    // supabaseAdmin NON deve toccare shipments
    expect(supabaseAdminFromCalls).not.toContain('shipments');
  });

  it('workspaceId=undefined → supabaseAdmin usato SOLO per tabelle globali (workspaces)', async () => {
    await buildContext('user-1', 'admin', 'Test Admin');

    // Le uniche chiamate supabaseAdmin consentite sono su tabelle globali
    for (const table of supabaseAdminFromCalls) {
      expect(WORKSPACE_SCOPED_TABLES).not.toContain(table);
    }
  });

  it('workspaceId presente → workspaceQuery usato per shipments, cod_items, audit_logs', async () => {
    await buildContext('user-1', 'admin', 'Test Admin', 'ws-123');

    // workspaceQuery deve essere usato per tutte le tabelle WORKSPACE_SCOPED
    expect(workspaceQueryCalls).toContain('shipments');
    expect(workspaceQueryCalls).toContain('cod_items');
    expect(workspaceQueryCalls).toContain('audit_logs');
  });

  it('workspaceId presente → supabaseAdmin NON usato per tabelle WORKSPACE_SCOPED', async () => {
    await buildContext('user-1', 'admin', 'Test Admin', 'ws-123');

    // Anche con workspaceId, supabaseAdmin non deve toccare tabelle multi-tenant
    for (const table of supabaseAdminFromCalls) {
      expect(WORKSPACE_SCOPED_TABLES).not.toContain(table);
    }
  });

  it('user role (non admin) → nessuna query stats/cod/audit anche con workspaceId', async () => {
    // User normali non entrano nel blocco admin/reseller
    await buildContext('user-1', 'user', 'Test User', 'ws-123');

    // Solo shipments (spedizioni recenti) deve essere queryato per utenti normali
    expect(workspaceQueryCalls).toContain('shipments');
    expect(workspaceQueryCalls).not.toContain('cod_items');
    expect(workspaceQueryCalls).not.toContain('audit_logs');
  });
});
