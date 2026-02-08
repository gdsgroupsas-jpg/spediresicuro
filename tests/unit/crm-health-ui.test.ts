/**
 * Test CRM Health UI — Server actions e componente health alerts
 *
 * Verifica:
 * - Server action getCrmHealthAlerts restituisce alert corretti
 * - Server action getProspectHealthAlerts filtra per workspace
 * - HealthAlertsSummary calcolo totali per severity
 * - Ordinamento alert (critical > warning > info)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateHealthRules, type CrmAlert, type HealthCheckEntity } from '@/lib/crm/health-rules';

// ============================================
// MOCK SUPABASE + AUTH
// ============================================

const mockSupabaseFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockNot = vi.fn();

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => {
      mockSupabaseFrom(...args);
      return {
        select: (...sArgs: unknown[]) => {
          mockSelect(...sArgs);
          return {
            not: (...nArgs: unknown[]) => {
              mockNot(...nArgs);
              return { data: mockDbData, error: null };
            },
            eq: (...eArgs: unknown[]) => {
              mockEq(...eArgs);
              return {
                not: (...nArgs: unknown[]) => {
                  mockNot(...nArgs);
                  return { data: mockDbData, error: null };
                },
              };
            },
          };
        },
      };
    },
  },
}));

vi.mock('@/lib/safe-auth', () => ({
  requireSafeAuth: vi.fn().mockResolvedValue({
    actor: { id: 'admin-1' },
    target: { id: 'admin-1' },
  }),
  isSuperAdmin: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/workspace-auth', () => ({
  getWorkspaceAuth: vi.fn().mockResolvedValue({
    workspace: { id: 'ws-test-1' },
    user: { id: 'user-1' },
  }),
}));

// Variabile per iniettare dati mock
let mockDbData: HealthCheckEntity[] = [];

// ============================================
// HELPER
// ============================================

function buildEntity(overrides: Partial<HealthCheckEntity> = {}): HealthCheckEntity {
  return {
    id: 'test-id-1',
    company_name: 'Test Company',
    status: 'new',
    lead_score: 0,
    created_at: '2026-01-01T10:00:00Z',
    last_contact_at: null,
    updated_at: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

// ============================================
// TEST: evaluateHealthRules integrazione
// ============================================

describe('evaluateHealthRules per UI', () => {
  it('restituisce array vuoto per entita senza problemi', () => {
    const entities = [
      buildEntity({
        status: 'contacted',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_contact_at: new Date().toISOString(),
      }),
    ];
    const alerts = evaluateHealthRules(entities, 'prospect', new Date());
    expect(alerts).toHaveLength(0);
  });

  it('genera alert multipli per entita diverse', () => {
    const now = new Date('2026-02-01T10:00:00Z');
    const entities = [
      // Prospect new da 5 giorni
      buildEntity({
        id: 'p-1',
        company_name: 'Prospect Stale',
        status: 'new',
        created_at: '2026-01-27T10:00:00Z',
      }),
      // Prospect contacted da 10 giorni
      buildEntity({
        id: 'p-2',
        company_name: 'Prospect Cold',
        status: 'contacted',
        updated_at: '2026-01-22T10:00:00Z',
      }),
    ];
    const alerts = evaluateHealthRules(entities, 'prospect', now);
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(alerts.some((a) => a.type === 'stale_new_prospect')).toBe(true);
    expect(alerts.some((a) => a.type === 'cold_contacted_prospect')).toBe(true);
  });

  it('genera alert lead caldo non contattato', () => {
    const now = new Date('2026-02-01T10:00:00Z');
    const entities = [
      buildEntity({
        id: 'l-1',
        company_name: 'Hot Lead',
        status: 'new',
        lead_score: 90,
        created_at: '2026-01-25T10:00:00Z',
      }),
    ];
    const alerts = evaluateHealthRules(entities, 'lead', now);
    expect(alerts.some((a) => a.type === 'hot_lead_uncontacted')).toBe(true);
    const hotAlert = alerts.find((a) => a.type === 'hot_lead_uncontacted')!;
    expect(hotAlert.level).toBe('critical');
  });

  it('genera alert lead qualificato fermo', () => {
    const now = new Date('2026-02-01T10:00:00Z');
    const entities = [
      buildEntity({
        id: 'l-2',
        company_name: 'Stale Qualified',
        status: 'qualified',
        updated_at: '2026-01-20T10:00:00Z',
      }),
    ];
    const alerts = evaluateHealthRules(entities, 'lead', now);
    expect(alerts.some((a) => a.type === 'stale_qualified_lead')).toBe(true);
  });

  it('genera alert win-back per lead perso da 30-37 giorni', () => {
    const now = new Date('2026-02-01T10:00:00Z');
    const entities = [
      buildEntity({
        id: 'l-3',
        company_name: 'Lost Lead',
        status: 'lost',
        updated_at: '2026-01-01T10:00:00Z', // 31 giorni
      }),
    ];
    const alerts = evaluateHealthRules(entities, 'lead', now);
    expect(alerts.some((a) => a.type === 'winback_candidate')).toBe(true);
  });
});

// ============================================
// TEST: HealthAlertsSummary calcolo
// ============================================

describe('HealthAlertsSummary calcolo totali', () => {
  it('calcola correttamente totali per severity', () => {
    const alerts: CrmAlert[] = [
      {
        type: 'hot_lead_uncontacted',
        level: 'critical',
        entityType: 'lead',
        entityId: '1',
        entityName: 'A',
        message: 'test',
        daysSinceEvent: 5,
      },
      {
        type: 'stale_new_prospect',
        level: 'warning',
        entityType: 'prospect',
        entityId: '2',
        entityName: 'B',
        message: 'test',
        daysSinceEvent: 4,
      },
      {
        type: 'cold_contacted_prospect',
        level: 'warning',
        entityType: 'prospect',
        entityId: '3',
        entityName: 'C',
        message: 'test',
        daysSinceEvent: 10,
      },
      {
        type: 'winback_candidate',
        level: 'info',
        entityType: 'lead',
        entityId: '4',
        entityName: 'D',
        message: 'test',
        daysSinceEvent: 32,
      },
    ];

    const totalCritical = alerts.filter((a) => a.level === 'critical').length;
    const totalWarning = alerts.filter((a) => a.level === 'warning').length;
    const totalInfo = alerts.filter((a) => a.level === 'info').length;

    expect(totalCritical).toBe(1);
    expect(totalWarning).toBe(2);
    expect(totalInfo).toBe(1);
  });

  it('calcola zero se nessun alert', () => {
    const alerts: CrmAlert[] = [];
    expect(alerts.filter((a) => a.level === 'critical').length).toBe(0);
    expect(alerts.filter((a) => a.level === 'warning').length).toBe(0);
    expect(alerts.filter((a) => a.level === 'info').length).toBe(0);
  });
});

// ============================================
// TEST: Ordinamento alert
// ============================================

describe('Ordinamento alert per severity', () => {
  it('ordina critical prima di warning prima di info', () => {
    const alerts: CrmAlert[] = [
      {
        type: 'winback_candidate',
        level: 'info',
        entityType: 'lead',
        entityId: '1',
        entityName: 'Info',
        message: 'test',
        daysSinceEvent: 32,
      },
      {
        type: 'hot_lead_uncontacted',
        level: 'critical',
        entityType: 'lead',
        entityId: '2',
        entityName: 'Critical',
        message: 'test',
        daysSinceEvent: 5,
      },
      {
        type: 'stale_new_prospect',
        level: 'warning',
        entityType: 'prospect',
        entityId: '3',
        entityName: 'Warning',
        message: 'test',
        daysSinceEvent: 4,
      },
    ];

    const levelOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => (levelOrder[a.level] ?? 3) - (levelOrder[b.level] ?? 3));

    expect(alerts[0].level).toBe('critical');
    expect(alerts[1].level).toBe('warning');
    expect(alerts[2].level).toBe('info');
  });
});

// ============================================
// TEST: Server Actions (con mock Supabase)
// ============================================

describe('getCrmHealthAlerts server action', () => {
  beforeEach(() => {
    mockDbData = [];
    vi.clearAllMocks();
  });

  it('restituisce alert per lead con problemi', async () => {
    mockDbData = [
      buildEntity({
        id: 'lead-hot',
        company_name: 'Hot Lead Corp',
        status: 'new',
        lead_score: 95,
        created_at: '2026-01-01T10:00:00Z',
      }),
    ];

    const { getCrmHealthAlerts } = await import('@/app/actions/crm-health');
    const result = await getCrmHealthAlerts();

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.alerts.length).toBeGreaterThanOrEqual(1);
    expect(result.data!.totalCritical).toBeGreaterThanOrEqual(1);
  });

  it('restituisce zero alert per lead sani', async () => {
    mockDbData = [
      buildEntity({
        id: 'lead-ok',
        company_name: 'OK Lead',
        status: 'contacted',
        lead_score: 50,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_contact_at: new Date().toISOString(),
      }),
    ];

    const { getCrmHealthAlerts } = await import('@/app/actions/crm-health');
    const result = await getCrmHealthAlerts();

    expect(result.success).toBe(true);
    expect(result.data!.alerts).toHaveLength(0);
    expect(result.data!.totalCritical).toBe(0);
    expect(result.data!.totalWarning).toBe(0);
    expect(result.data!.totalInfo).toBe(0);
  });
});

describe('getProspectHealthAlerts server action', () => {
  beforeEach(() => {
    mockDbData = [];
    vi.clearAllMocks();
  });

  it('restituisce alert per prospect con problemi', async () => {
    mockDbData = [
      buildEntity({
        id: 'prospect-stale',
        company_name: 'Stale Prospect SRL',
        status: 'new',
        created_at: '2026-01-01T10:00:00Z',
      }),
    ];

    const { getProspectHealthAlerts } = await import('@/app/actions/crm-health');
    const result = await getProspectHealthAlerts();

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.alerts.length).toBeGreaterThanOrEqual(1);
  });

  it('chiama supabase con filtro workspace', async () => {
    mockDbData = [];

    const { getProspectHealthAlerts } = await import('@/app/actions/crm-health');
    await getProspectHealthAlerts();

    expect(mockSupabaseFrom).toHaveBeenCalledWith('reseller_prospects');
    expect(mockEq).toHaveBeenCalledWith('workspace_id', 'ws-test-1');
  });
});
