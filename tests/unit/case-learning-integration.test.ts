/**
 * Test C8: Learning loop — learnFromEscalation integrato nel cron
 *
 * Verifica:
 * - learnFromEscalation chiamata per escalation risolte
 * - Escalation non risolte ignorate
 * - Claim atomico: solo il primo worker processa
 * - Escalation già processata (pattern_learned=true) → skip
 * - Errore learning non rompe il cron
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track chiamate a learnFromEscalation
let learnCalls: string[] = [];

vi.mock('@/lib/ai/case-learning', () => ({
  learnFromEscalation: vi.fn((id: string) => {
    learnCalls.push(id);
    return Promise.resolve();
  }),
}));

// Mock email/telegram/whatsapp (non usati in questi test)
vi.mock('@/lib/email/resend', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('@/lib/services/telegram-bot', () => ({
  sendTelegramMessageDirect: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('@/lib/services/whatsapp', () => ({
  sendWhatsAppText: vi.fn().mockResolvedValue({ success: true }),
  isWhatsAppConfigured: vi.fn().mockReturnValue(false),
}));

// Configura le risposte del mock supabaseAdmin
// Ogni chain "from().select().eq()..." deve essere configurabile per test
let mockEscalations: any[] = [];
let claimResults: Map<string, any> = new Map();
let claimCallCount = 0;

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'support_escalations') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: string) => {
              if (col === 'status' && val === 'resolved') {
                return {
                  not: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(() => Promise.resolve({ data: mockEscalations, error: null })),
                    })),
                  })),
                  single: vi.fn(() =>
                    Promise.resolve({
                      data: mockEscalations.find((e: any) => e.status === 'resolved') || null,
                      error: null,
                    })
                  ),
                };
              }
              // Fallback per query generiche su support_escalations
              return {
                eq: vi.fn(() => ({
                  single: vi.fn(() =>
                    Promise.resolve({
                      data: mockEscalations[0] || null,
                      error: null,
                    })
                  ),
                })),
              };
            }),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  select: vi.fn(() => ({
                    maybeSingle: vi.fn(() => {
                      claimCallCount++;
                      // Simula claim atomico: solo il primo claim ha successo
                      const escalation = mockEscalations[claimCallCount - 1];
                      const id = escalation?.id;
                      if (id && claimResults.has(id)) {
                        return Promise.resolve(claimResults.get(id));
                      }
                      // Default: claim ha successo (prima volta)
                      return Promise.resolve({
                        data: escalation ? { id: escalation.id } : null,
                        error: null,
                      });
                    }),
                  })),
                })),
              })),
            })),
          })),
        };
      }
      // Tabelle notifiche, holds, shipments → rispondi vuoto
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
            gt: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            not: vi.fn(() => ({
              lt: vi.fn(() => ({
                gt: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          })),
          in: vi.fn(() => ({
            lt: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
        insert: vi.fn(() => Promise.resolve({ error: null })),
      };
    }),
  },
}));

// Import DOPO i mock
import { GET } from '@/app/api/cron/support-alerts/route';

function makeRequest(opts?: { isVercelCron?: boolean }): Request {
  const headers = new Headers();
  if (opts?.isVercelCron) {
    headers.set('x-vercel-cron', '1');
  } else {
    headers.set('authorization', `Bearer test-secret`);
  }
  return new Request('http://localhost/api/cron/support-alerts', { headers });
}

describe('Learning loop nel cron support-alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    learnCalls = [];
    mockEscalations = [];
    claimResults = new Map();
    claimCallCount = 0;
    // Imposta CRON_SECRET per auth
    process.env.CRON_SECRET = 'test-secret';
  });

  it('chiama learnFromEscalation per escalation risolta', async () => {
    mockEscalations = [
      {
        id: 'esc-1',
        status: 'resolved',
        resolution: 'Risolto contattando il corriere',
        metadata: { category: 'giacenza' },
      },
    ];

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.patternsLearned).toBe(1);
    expect(learnCalls).toContain('esc-1');
  });

  it('non processa escalation senza resolution', async () => {
    // La query filtra .not('resolution', 'is', null) → queste non appaiono
    mockEscalations = [];

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.patternsLearned).toBe(0);
    expect(learnCalls).toHaveLength(0);
  });

  it('claim atomico: secondo worker non processa', async () => {
    mockEscalations = [
      {
        id: 'esc-2',
        status: 'resolved',
        resolution: 'Fix manuale',
        metadata: { category: 'tracking' },
      },
    ];
    // Simula: claim fallito (un altro worker l'ha già presa)
    claimResults.set('esc-2', { data: null, error: null });

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.patternsLearned).toBe(0);
    expect(learnCalls).toHaveLength(0);
  });

  it('escalation già processata (pattern_learned=true) → skip', async () => {
    // La query .is('metadata->pattern_learned', null) filtra quelle già processate
    // Quindi non appaiono in mockEscalations
    mockEscalations = [];

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.patternsLearned).toBe(0);
    expect(learnCalls).toHaveLength(0);
  });

  it('errore in learnFromEscalation non rompe il cron', async () => {
    mockEscalations = [
      {
        id: 'esc-3',
        status: 'resolved',
        resolution: 'Fix',
        metadata: { category: 'generico' },
      },
    ];

    // Forza errore su learnFromEscalation
    const { learnFromEscalation } = await import('@/lib/ai/case-learning');
    (learnFromEscalation as any).mockRejectedValueOnce(new Error('DB error'));

    const res = await GET(makeRequest());
    const json = await res.json();

    // Il cron non crasha, ritorna success
    expect(json.success).toBe(true);
    // Pattern non appreso (errore)
    expect(json.patternsLearned).toBe(0);
  });

  it('processa multiple escalation in ordine', async () => {
    mockEscalations = [
      {
        id: 'esc-a',
        status: 'resolved',
        resolution: 'Fix 1',
        metadata: { category: 'giacenza' },
      },
      {
        id: 'esc-b',
        status: 'resolved',
        resolution: 'Fix 2',
        metadata: { category: 'tracking' },
      },
    ];

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.patternsLearned).toBe(2);
    expect(learnCalls).toEqual(['esc-a', 'esc-b']);
  });
});
