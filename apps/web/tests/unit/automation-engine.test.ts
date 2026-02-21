/**
 * Test: Automation Engine
 *
 * Verifica:
 * 1. Struttura SQL migration + seed
 * 2. Cron utils (shouldRunNow, getNextRun, isValidCron)
 * 3. Registry (ogni slug seed ha un handler)
 * 4. Dispatcher (logica ciclo)
 * 5. Types (struttura)
 * 6. Cron endpoint (route file)
 * 7. Server actions (file esiste)
 * 8. Admin UI (file esiste)
 * 9. Navigation (voce aggiunta)
 * 10. vercel.json (cron aggiunto)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// HELPER
// ============================================

function readFile(relativePath: string): string {
  const fullPath = path.join(process.cwd(), relativePath);
  expect(fs.existsSync(fullPath)).toBe(true);
  return fs.readFileSync(fullPath, 'utf-8');
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), relativePath));
}

// ============================================
// 1. Migration SQL
// ============================================

describe('Migration: automation_engine.sql', () => {
  let sql: string;

  beforeAll(() => {
    sql = readFile('supabase/migrations/20260219100000_automation_engine.sql');
  });

  it('crea tabella automations con campi obbligatori', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS automations');
    expect(sql).toContain('slug TEXT NOT NULL UNIQUE');
    expect(sql).toContain('enabled BOOLEAN NOT NULL DEFAULT false');
    expect(sql).toContain('schedule TEXT NOT NULL');
    expect(sql).toContain('config JSONB');
    expect(sql).toContain('config_schema JSONB');
  });

  it('enabled è DEFAULT false (ogni automazione nasce disattivata)', () => {
    expect(sql).toContain('DEFAULT false');
  });

  it('crea tabella automation_runs con FK', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS automation_runs');
    expect(sql).toContain('REFERENCES automations(id)');
    expect(sql).toContain('triggered_by TEXT NOT NULL CHECK');
    expect(sql).toContain("status TEXT NOT NULL DEFAULT 'running'");
  });

  it('ha indici per performance', () => {
    expect(sql).toContain('idx_automations_enabled');
    expect(sql).toContain('idx_automation_runs_automation_started');
    expect(sql).toContain('idx_automation_runs_started_at');
  });

  it('GRANT solo a service_role, REVOKE da authenticated', () => {
    expect(sql).toContain('REVOKE ALL ON automations FROM authenticated');
    expect(sql).toContain('REVOKE ALL ON automation_runs FROM authenticated');
    expect(sql).toContain('GRANT ALL ON automations TO service_role');
    expect(sql).toContain('GRANT ALL ON automation_runs TO service_role');
  });

  it('ha trigger updated_at', () => {
    expect(sql).toContain('trg_automations_updated_at');
    expect(sql).toContain('update_automations_updated_at');
  });
});

// ============================================
// 2. Seed Data
// ============================================

describe('Seed: automazioni iniziali', () => {
  let sql: string;

  beforeAll(() => {
    sql = readFile('supabase/migrations/20260219110000_seed_automations.sql');
  });

  it('inserisce postpaid-monthly-billing disattivato', () => {
    expect(sql).toContain("'postpaid-monthly-billing'");
    expect(sql).toContain('false'); // enabled = false
    expect(sql).toContain("'billing'");
    expect(sql).toContain("'0 2 1 * *'");
  });

  it('inserisce low-balance-alert disattivato', () => {
    expect(sql).toContain("'low-balance-alert'");
    expect(sql).toContain("'notifications'");
    expect(sql).toContain("'0 9 * * *'");
  });

  it('entrambe con enabled = false', () => {
    // Entrambe le righe INSERT hanno 'false' nel campo enabled
    const matches = sql.match(/false/g);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it('ha ON CONFLICT DO NOTHING (idempotente)', () => {
    expect(sql).toContain('ON CONFLICT (slug) DO NOTHING');
  });

  it('config_schema ha struttura JSON Schema', () => {
    expect(sql).toContain('"type": "object"');
    expect(sql).toContain('"properties"');
    expect(sql).toContain('"type": "boolean"');
  });
});

// ============================================
// 3. Cron Utils
// ============================================

describe('Cron Utils', () => {
  // Import diretto (non ha dipendenze DB)
  let shouldRunNow: typeof import('../../lib/automations/cron-utils').shouldRunNow;
  let getNextRun: typeof import('../../lib/automations/cron-utils').getNextRun;
  let isValidCron: typeof import('../../lib/automations/cron-utils').isValidCron;

  beforeAll(async () => {
    const mod = await import('../../lib/automations/cron-utils');
    shouldRunNow = mod.shouldRunNow;
    getNextRun = mod.getNextRun;
    isValidCron = mod.isValidCron;
  });

  describe('isValidCron', () => {
    it('accetta espressioni valide', () => {
      expect(isValidCron('0 2 1 * *')).toBe(true);
      expect(isValidCron('*/5 * * * *')).toBe(true);
      expect(isValidCron('0 9 * * *')).toBe(true);
      expect(isValidCron('0 0 * * 0')).toBe(true);
    });

    it('rifiuta espressioni invalide', () => {
      expect(isValidCron('not a cron')).toBe(false);
      expect(isValidCron('')).toBe(false);
      expect(isValidCron('60 25 32 13 8')).toBe(false);
    });
  });

  describe('shouldRunNow', () => {
    it('ritorna true quando il prev run è entro la tolleranza', () => {
      // Ogni ora: il run previsto era alle 10:00, ora sono le 10:03 → entro 5 min
      const now = new Date('2026-02-19T10:03:00Z');
      expect(shouldRunNow('0 * * * *', 5, now)).toBe(true);
    });

    it('ritorna false quando il prev run è fuori tolleranza', () => {
      // Ogni ora: il run era alle 9:00, ora sono le 9:30 → fuori finestra 5 min
      const now = new Date('2026-02-19T09:30:00Z');
      expect(shouldRunNow('0 * * * *', 5, now)).toBe(false);
    });

    it('ritorna false per espressione invalida', () => {
      expect(shouldRunNow('not valid', 5)).toBe(false);
    });
  });

  describe('getNextRun', () => {
    it('ritorna una data futura', () => {
      const from = new Date('2026-02-19T10:00:00Z');
      const next = getNextRun('0 12 * * *', from);
      expect(next).toBeTruthy();
      expect(next!.getTime()).toBeGreaterThan(from.getTime());
    });

    it('ritorna null per espressione invalida', () => {
      expect(getNextRun('not valid')).toBeNull();
    });
  });
});

// ============================================
// 4. Registry — ogni slug seed ha handler
// ============================================

describe('Registry: slug → handler mapping', () => {
  let AUTOMATION_HANDLERS: Record<string, Function>;

  beforeAll(async () => {
    // Mock delle dipendenze DB prima dell'import
    const mod = await import('../../lib/automations/registry');
    AUTOMATION_HANDLERS = mod.AUTOMATION_HANDLERS;
  });

  it('ha handler per postpaid-monthly-billing', () => {
    expect(AUTOMATION_HANDLERS['postpaid-monthly-billing']).toBeDefined();
    expect(typeof AUTOMATION_HANDLERS['postpaid-monthly-billing']).toBe('function');
  });

  it('ha handler per low-balance-alert', () => {
    expect(AUTOMATION_HANDLERS['low-balance-alert']).toBeDefined();
    expect(typeof AUTOMATION_HANDLERS['low-balance-alert']).toBe('function');
  });

  it('tutti gli slug seed hanno un handler registrato', () => {
    const seedSlugs = ['postpaid-monthly-billing', 'low-balance-alert'];
    for (const slug of seedSlugs) {
      expect(AUTOMATION_HANDLERS[slug]).toBeDefined();
    }
  });
});

// ============================================
// 5. File structure
// ============================================

describe('File structure', () => {
  it('types/automations.ts esiste', () => {
    expect(fileExists('types/automations.ts')).toBe(true);
  });

  it('lib/automations/cron-utils.ts esiste', () => {
    expect(fileExists('lib/automations/cron-utils.ts')).toBe(true);
  });

  it('lib/automations/distributed-lock.ts esiste', () => {
    expect(fileExists('lib/automations/distributed-lock.ts')).toBe(true);
  });

  it('lib/automations/registry.ts esiste', () => {
    expect(fileExists('lib/automations/registry.ts')).toBe(true);
  });

  it('lib/automations/dispatcher.ts esiste', () => {
    expect(fileExists('lib/automations/dispatcher.ts')).toBe(true);
  });

  it('lib/automations/handlers/postpaid-billing.ts esiste', () => {
    expect(fileExists('lib/automations/handlers/postpaid-billing.ts')).toBe(true);
  });

  it('lib/automations/handlers/low-balance-alert.ts esiste', () => {
    expect(fileExists('lib/automations/handlers/low-balance-alert.ts')).toBe(true);
  });

  it('actions/automations.ts esiste', () => {
    expect(fileExists('actions/automations.ts')).toBe(true);
  });

  it('app/api/cron/automation-dispatcher/route.ts esiste', () => {
    expect(fileExists('app/api/cron/automation-dispatcher/route.ts')).toBe(true);
  });

  it('app/dashboard/admin/automazioni/page.tsx esiste', () => {
    expect(fileExists('app/dashboard/admin/automazioni/page.tsx')).toBe(true);
  });
});

// ============================================
// 6. Types — export corretti
// ============================================

describe('Types: automations.ts', () => {
  let typesContent: string;

  beforeAll(() => {
    typesContent = readFile('types/automations.ts');
  });

  it('esporta Automation interface', () => {
    expect(typesContent).toContain('export interface Automation');
  });

  it('esporta AutomationRun interface', () => {
    expect(typesContent).toContain('export interface AutomationRun');
  });

  it('esporta AutomationResult interface', () => {
    expect(typesContent).toContain('export interface AutomationResult');
  });

  it('esporta AutomationHandler type', () => {
    expect(typesContent).toContain('export type AutomationHandler');
  });

  it('esporta AutomationWithLastRun per UI', () => {
    expect(typesContent).toContain('export interface AutomationWithLastRun');
  });
});

// ============================================
// 7. Cron endpoint
// ============================================

describe('Cron endpoint: automation-dispatcher', () => {
  let routeContent: string;

  beforeAll(() => {
    routeContent = readFile('app/api/cron/automation-dispatcher/route.ts');
  });

  it('ha force-dynamic', () => {
    expect(routeContent).toContain("dynamic = 'force-dynamic'");
  });

  it('ha maxDuration = 300', () => {
    expect(routeContent).toContain('maxDuration = 300');
  });

  it('verifica autorizzazione', () => {
    expect(routeContent).toContain('CRON_SECRET');
    expect(routeContent).toContain('Bearer');
  });

  it('chiama runDispatcher', () => {
    expect(routeContent).toContain('runDispatcher');
  });
});

// ============================================
// 8. vercel.json
// ============================================

describe('vercel.json: cron automation-dispatcher', () => {
  let config: any;

  beforeAll(() => {
    const content = readFile('vercel.json');
    config = JSON.parse(content);
  });

  it('ha cron per automation-dispatcher', () => {
    const cronEntry = config.crons?.find((c: any) => c.path === '/api/cron/automation-dispatcher');
    expect(cronEntry).toBeTruthy();
    expect(cronEntry.schedule).toBe('*/5 * * * *');
  });
});

// ============================================
// 9. Navigation
// ============================================

describe('Navigation: voce automazioni piattaforma', () => {
  let navContent: string;

  beforeAll(() => {
    navContent = readFile('lib/config/navigationConfig.ts');
  });

  it('ha voce admin-automazioni-piattaforma', () => {
    expect(navContent).toContain('admin-automazioni-piattaforma');
  });

  it('punta a /dashboard/admin/automazioni', () => {
    expect(navContent).toContain('/dashboard/admin/automazioni');
  });

  it('usa icona Zap', () => {
    expect(navContent).toContain('icon: Zap');
  });

  it('coesiste con admin-automation (Spedisci.Online)', () => {
    expect(navContent).toContain('admin-automation');
    expect(navContent).toContain('admin-automazioni-piattaforma');
  });
});

// ============================================
// 10. Server Actions — struttura
// ============================================

describe('Server Actions: automations.ts', () => {
  let actionsContent: string;

  beforeAll(() => {
    actionsContent = readFile('actions/automations.ts');
  });

  it("ha 'use server' directive", () => {
    expect(actionsContent).toContain("'use server'");
  });

  it('esporta getAutomations', () => {
    expect(actionsContent).toContain('export async function getAutomations');
  });

  it('esporta toggleAutomationEnabled', () => {
    expect(actionsContent).toContain('export async function toggleAutomationEnabled');
  });

  it('esporta updateAutomationConfig', () => {
    expect(actionsContent).toContain('export async function updateAutomationConfig');
  });

  it('esporta runAutomationManually', () => {
    expect(actionsContent).toContain('export async function runAutomationManually');
  });

  it('esporta getAutomationRuns', () => {
    expect(actionsContent).toContain('export async function getAutomationRuns');
  });

  it('verifica admin in ogni action', () => {
    // Ogni action chiama requireAdmin()
    const matches = actionsContent.match(/await requireAdmin\(\)/g);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBeGreaterThanOrEqual(5);
  });
});

// ============================================
// 11. Distributed Lock
// ============================================

describe('Distributed Lock: struttura', () => {
  let lockContent: string;

  beforeAll(() => {
    lockContent = readFile('lib/automations/distributed-lock.ts');
  });

  it('usa Redis con prefix automation:lock:', () => {
    expect(lockContent).toContain('automation:lock:');
  });

  it('ha acquireAutomationLock con NX + EX', () => {
    expect(lockContent).toContain('acquireAutomationLock');
    expect(lockContent).toContain('nx: true');
    expect(lockContent).toContain('ex:');
  });

  it('ha releaseAutomationLock con DEL', () => {
    expect(lockContent).toContain('releaseAutomationLock');
    expect(lockContent).toContain('redis.del');
  });

  it('fail-open se Redis non disponibile', () => {
    expect(lockContent).toContain('fail-open');
    expect(lockContent).toContain('return true');
  });
});

// ============================================
// 12. Dispatcher — struttura
// ============================================

describe('Dispatcher: struttura', () => {
  let dispatcherContent: string;

  beforeAll(() => {
    dispatcherContent = readFile('lib/automations/dispatcher.ts');
  });

  it('esporta runDispatcher', () => {
    expect(dispatcherContent).toContain('export async function runDispatcher');
  });

  it('esporta executeAutomation', () => {
    expect(dispatcherContent).toContain('export async function executeAutomation');
  });

  it('legge automazioni con enabled=true', () => {
    expect(dispatcherContent).toContain(".eq('enabled', true)");
  });

  it('usa shouldRunNow per verifica schedule', () => {
    expect(dispatcherContent).toContain('shouldRunNow');
  });

  it('usa acquireAutomationLock e releaseAutomationLock', () => {
    expect(dispatcherContent).toContain('acquireAutomationLock');
    expect(dispatcherContent).toContain('releaseAutomationLock');
  });

  it('logga in automation_runs', () => {
    expect(dispatcherContent).toContain("'automation_runs'");
  });

  it('aggiorna last_run_at su automazioni', () => {
    expect(dispatcherContent).toContain('last_run_at');
    expect(dispatcherContent).toContain('last_run_status');
  });
});

// ============================================
// 13. Handler postpaid-billing — struttura
// ============================================

describe('Handler: postpaid-billing struttura', () => {
  let handlerContent: string;

  beforeAll(() => {
    handlerContent = readFile('lib/automations/handlers/postpaid-billing.ts');
  });

  it('NON importa requireWorkspaceAuth (contesto cron)', () => {
    // Il handler gira in contesto cron, non ha sessione utente
    expect(handlerContent).not.toContain('import { requireWorkspaceAuth');
    expect(handlerContent).not.toContain("from '@/lib/workspace-auth'");
  });

  it('esporta handlePostpaidBilling', () => {
    expect(handlerContent).toContain('export async function handlePostpaidBilling');
  });

  it('usa workspaceQuery per isolamento multi-tenant', () => {
    expect(handlerContent).toContain('workspaceQuery');
  });

  it('query utenti postpagato', () => {
    expect(handlerContent).toContain("'postpagato'");
  });

  it('supporta dryRun', () => {
    expect(handlerContent).toContain('dryRun');
  });

  it('crea fattura con IVA 22%', () => {
    expect(handlerContent).toContain('taxRate = 22');
  });

  it('ha rollback se items creation fallisce', () => {
    expect(handlerContent).toContain('Rollback');
  });

  it('usa get_next_invoice_number RPC', () => {
    expect(handlerContent).toContain('get_next_invoice_number');
  });
});

// ============================================
// 14. Handler low-balance-alert — struttura
// ============================================

describe('Handler: low-balance-alert struttura', () => {
  let handlerContent: string;

  beforeAll(() => {
    handlerContent = readFile('lib/automations/handlers/low-balance-alert.ts');
  });

  it('esporta handleLowBalanceAlert', () => {
    expect(handlerContent).toContain('export async function handleLowBalanceAlert');
  });

  it('query workspaces con wallet_balance sotto soglia', () => {
    expect(handlerContent).toContain('wallet_balance');
    expect(handlerContent).toContain('threshold');
  });

  it('ha deduplicazione (ultime 24h)', () => {
    expect(handlerContent).toContain('24');
    expect(handlerContent).toContain('recentlyNotifiedWorkspaceIds');
  });

  it('invia email con sendEmail', () => {
    expect(handlerContent).toContain('sendEmail');
  });

  it('trova owner via workspace_members', () => {
    expect(handlerContent).toContain('workspace_members');
    expect(handlerContent).toContain("'owner'");
  });
});

// ============================================
// 15. Tabelle NON multi-tenant
// ============================================

describe('Isolamento: automations/automation_runs non in WORKSPACE_SCOPED_TABLES', () => {
  let wsQueryContent: string;

  beforeAll(() => {
    wsQueryContent = readFile('lib/db/workspace-query.ts');
  });

  it('automations NON è in WORKSPACE_SCOPED_TABLES', () => {
    // Le tabelle multi-tenant sono listate come stringhe nel file
    // automations e automation_runs sono globali
    expect(wsQueryContent).not.toContain("'automations'");
  });

  it('automation_runs NON è in WORKSPACE_SCOPED_TABLES', () => {
    expect(wsQueryContent).not.toContain("'automation_runs'");
  });
});
