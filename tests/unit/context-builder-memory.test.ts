/**
 * Test C6: Memory integrata in buildContext
 *
 * Verifica:
 * - buildContext include memory quando presente
 * - buildContext gestisce memory mancante (null)
 * - formatContextForPrompt renderizza sezione memory
 * - Errore memory non rompe buildContext (try/catch)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock user-memory
let mockMemoryResult: any = null;

vi.mock('@/lib/ai/user-memory', () => ({
  getUserMemory: vi.fn(() => Promise.resolve(mockMemoryResult)),
  upsertUserMemory: vi.fn(),
}));

// Mock supabaseAdmin (per wallet e shipments)
vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { wallet_balance: '100.00' }, error: null }),
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      })),
    })),
  },
}));

// Mock workspace-query
vi.mock('@/lib/db/workspace-query', () => ({
  workspaceQuery: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
        gte: vi.fn().mockResolvedValue({ data: [], error: null }),
        in: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        })),
      })),
    })),
  })),
}));

// Mock CRM
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

import { buildContext, formatContextForPrompt, type UserContext } from '@/lib/ai/context-builder';

describe('buildContext — memory integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMemoryResult = null;
  });

  it('include memory nel context quando presente', async () => {
    mockMemoryResult = {
      defaultSender: { name: 'Mario Rossi', city: 'Roma' },
      preferredCouriers: ['BRT', 'GLS'],
      communicationStyle: { emoji: false, tables: true },
      notes: 'Spedizioni fragili',
    };

    const ctx = await buildContext('user-1', 'user', 'Mario', 'ws-1');

    expect(ctx.user.memory).toBeDefined();
    expect(ctx.user.memory!.defaultSender!.name).toBe('Mario Rossi');
    expect(ctx.user.memory!.preferredCouriers).toEqual(['BRT', 'GLS']);
    expect(ctx.user.memory!.notes).toBe('Spedizioni fragili');
  });

  it('gestisce memory mancante (null)', async () => {
    mockMemoryResult = null;

    const ctx = await buildContext('user-1', 'user', 'Mario', 'ws-1');

    // Memory non presente ma non rompe il context
    expect(ctx.user.memory).toBeUndefined();
    expect(ctx.user.userId).toBe('user-1');
  });

  it('errore memory non rompe buildContext', async () => {
    // Forza errore nel getUserMemory
    const { getUserMemory } = await import('@/lib/ai/user-memory');
    (getUserMemory as any).mockRejectedValueOnce(new Error('DB down'));

    const ctx = await buildContext('user-1', 'user', 'Mario', 'ws-1');

    // Context costruito senza memory
    expect(ctx.user.userId).toBe('user-1');
    expect(ctx.user.memory).toBeUndefined();
  });
});

describe('formatContextForPrompt — memory rendering', () => {
  it('renderizza sezione PREFERENZE UTENTE con mittente e corrieri', () => {
    const context = {
      user: {
        userId: 'user-1',
        userRole: 'user' as const,
        userName: 'Mario',
        recentShipments: [],
        walletBalance: 100,
        memory: {
          defaultSender: { name: 'Mario Rossi', city: 'Roma' },
          preferredCouriers: ['BRT', 'GLS'],
          notes: 'Sempre fragile',
        },
      },
    };

    const prompt = formatContextForPrompt(context);

    expect(prompt).toContain('PREFERENZE UTENTE');
    expect(prompt).toContain('Mittente predefinito: Mario Rossi, Roma');
    expect(prompt).toContain('Corrieri preferiti: BRT, GLS');
    expect(prompt).toContain('Note: Sempre fragile');
  });

  it('non renderizza sezione se memory vuota', () => {
    const context = {
      user: {
        userId: 'user-1',
        userRole: 'user' as const,
        userName: 'Mario',
        recentShipments: [],
      },
    };

    const prompt = formatContextForPrompt(context);

    expect(prompt).not.toContain('PREFERENZE UTENTE');
  });

  it('renderizza solo campi presenti', () => {
    const context = {
      user: {
        userId: 'user-1',
        userRole: 'user' as const,
        userName: 'Mario',
        recentShipments: [],
        memory: {
          preferredCouriers: ['TNT'],
        },
      },
    };

    const prompt = formatContextForPrompt(context);

    expect(prompt).toContain('PREFERENZE UTENTE');
    expect(prompt).toContain('Corrieri preferiti: TNT');
    expect(prompt).not.toContain('Mittente predefinito');
  });
});
