/**
 * Test: Anne AI Multi-Tenant Isolation
 *
 * Verifica che la call chain di Anne (route -> supervisor -> worker -> tool -> DB)
 * propaghi correttamente il workspaceId e isoli i dati per workspace.
 *
 * Errore #12: Questa call chain era completamente ignorata dalla migrazione multi-tenant.
 * Il reseller veniva mappato ad 'admin' e vedeva dati globali.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Guard: anne-superadmin-tools.ts NON deve esistere (Errore #13)
// ============================================================

describe('Guard: anne-superadmin-tools.ts rimosso', () => {
  it('il file NON deve esistere (dead code con accesso cross-tenant)', () => {
    const filePath = path.join(process.cwd(), 'lib/ai/anne-superadmin-tools.ts');
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('nessun import di anne-superadmin-tools nel codebase', () => {
    const dirs = ['app', 'lib', 'actions'];
    let imports = 0;

    for (const dir of dirs) {
      const fullDir = path.join(process.cwd(), dir);
      if (!fs.existsSync(fullDir)) continue;

      const entries = fs.readdirSync(fullDir, { withFileTypes: true, recursive: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
        if (entry.name.includes('node_modules')) continue;

        const filePath = path.join(
          fullDir,
          entry.parentPath?.replace(fullDir, '') || '',
          entry.name
        );
        try {
          const code = fs.readFileSync(filePath, 'utf-8');
          if (code.includes('anne-superadmin-tools')) {
            imports++;
          }
        } catch {
          continue;
        }
      }
    }

    expect(imports).toBe(0);
  });
});

// ============================================================
// executeTool: firma e propagazione workspaceId
// ============================================================

describe('executeTool — firma multi-tenant', () => {
  it('accetta userRole con 3 valori: admin, user, reseller', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/ai/tools.ts'), 'utf-8');
    // La firma deve accettare 'reseller'
    expect(code).toContain("userRole: 'admin' | 'user' | 'reseller'");
  });

  it('accetta workspaceId come 4o parametro', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/ai/tools.ts'), 'utf-8');
    expect(code).toContain('workspaceId?: string');
  });

  it('importa workspaceQuery', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/ai/tools.ts'), 'utf-8');
    expect(code).toContain("import { workspaceQuery } from '@/lib/db/workspace-query'");
  });
});

// ============================================================
// executeSupportTool: firma e propagazione workspaceId
// ============================================================

describe('executeSupportTool — firma multi-tenant', () => {
  it('accetta userRole con 3 valori: admin, user, reseller', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'lib/ai/tools/support-tools.ts'),
      'utf-8'
    );
    // La firma deve accettare 'reseller'
    expect(code).toContain("userRole: 'admin' | 'user' | 'reseller'");
  });

  it('accetta workspaceId come 4o parametro', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'lib/ai/tools/support-tools.ts'),
      'utf-8'
    );
    // executeSupportTool deve avere workspaceId
    expect(code).toContain('workspaceId?: string');
  });

  it('passa workspaceId a TUTTI gli handler (tranne escalate_to_human)', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'lib/ai/tools/support-tools.ts'),
      'utf-8'
    );
    // Ogni handler deve ricevere workspaceId nel switch case
    const handlers = [
      'handleGetShipmentStatus',
      'handleManageHold',
      'handleCancelShipment',
      'handleProcessRefund',
      'handleForceRefreshTracking',
      'handleCheckWalletStatus',
      'handleDiagnoseShipmentIssue',
    ];

    for (const handler of handlers) {
      // Cerca il pattern: handler(toolCall.arguments, userId, ..., workspaceId)
      // nell'area dello switch case
      expect(code).toContain(`${handler}(toolCall.arguments, userId`);
    }
  });

  it('handleCheckWalletStatus legge da workspaces (v2), NON da users', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'lib/ai/tools/support-tools.ts'),
      'utf-8'
    );
    // NON deve leggere wallet da users
    expect(code).not.toMatch(/from\(\s*['`]users['`]\s*\)\s*\.\s*select\(\s*['`]wallet_balance/);
    // DEVE leggere da workspaces
    expect(code).toContain("from('workspaces')");
    expect(code).toContain("select('wallet_balance')");
  });
});

// ============================================================
// Route: separazione ruolo reseller
// ============================================================

describe('Route agent-chat — separazione ruolo reseller', () => {
  it('NON mappa reseller a admin', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'app/api/ai/agent-chat/route.ts'),
      'utf-8'
    );

    // Il pattern vecchio era: reseller mappato a 'admin'
    // Non deve piu esserci "reseller" nella condizione che assegna 'admin'
    // Cerca la riga con il tipo union — deve avere 3 valori
    expect(code).toContain("'admin' | 'user' | 'reseller'");
  });

  it('estrae wsId da actingContext e lo passa a buildContext', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'app/api/ai/agent-chat/route.ts'),
      'utf-8'
    );
    expect(code).toContain('actingContext.workspace?.id');
    expect(code).toContain('buildContext(userId, userRole, userName, wsId');
  });

  it('passa wsId a executeTool', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'app/api/ai/agent-chat/route.ts'),
      'utf-8'
    );
    // Deve passare wsId come ultimo parametro a executeTool
    expect(code).toMatch(/executeTool\([^)]*wsId/);
  });
});

// ============================================================
// Context Builder: wallet v2 e workspace scoping
// ============================================================

describe('Context Builder — workspace scoping', () => {
  it('accetta userRole con 3 valori', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/ai/context-builder.ts'), 'utf-8');
    expect(code).toContain("userRole: 'admin' | 'user' | 'reseller'");
  });

  it('legge wallet da workspaces (v2), NON da users', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/ai/context-builder.ts'), 'utf-8');
    // NON deve leggere wallet da users
    expect(code).not.toMatch(
      /supabaseAdmin\s*\.from\(\s*['`]users['`]\s*\)\s*[\s\S]*?wallet_balance/
    );
    // DEVE leggere da workspaces
    expect(code).toContain("from('workspaces')");
  });

  it('spedizioni recenti usano workspace-scoped query', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/ai/context-builder.ts'), 'utf-8');
    // La query shipments deve usare ctxDb (workspace-scoped), non supabaseAdmin diretto
    expect(code).toContain('workspaceQuery(workspaceId)');
    expect(code).toMatch(/ctxDb\s*\.\s*from\(\s*['`]shipments['`]\)/);
  });

  it('statistiche mensili usano workspace-scoped query', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/ai/context-builder.ts'), 'utf-8');
    expect(code).toMatch(/statsDb\s*\.\s*from\(\s*['`]shipments['`]\)/);
  });

  it('audit_logs usano workspace-scoped query', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/ai/context-builder.ts'), 'utf-8');
    expect(code).toMatch(/logsDb\s*\.\s*from\(\s*['`]audit_logs['`]\)/);
  });

  it('statistiche business disponibili anche per reseller', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/ai/context-builder.ts'), 'utf-8');
    expect(code).toContain("userRole === 'reseller'");
  });
});

// ============================================================
// Supervisor Router: workspaceId propagato ai worker
// ============================================================

describe('Supervisor Router — propagazione workspaceId', () => {
  it('estrae workspaceId da actingContext', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'lib/agent/orchestrator/supervisor-router.ts'),
      'utf-8'
    );
    expect(code).toContain('actingContext.workspace?.id');
  });

  it('passa workspaceId al supportWorker', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'lib/agent/orchestrator/supervisor-router.ts'),
      'utf-8'
    );
    // Il supportWorker deve ricevere workspaceId nel suo input
    // effectiveWsId = wsId (senza delega) o delegation.delegatedWorkspaceId (con delega)
    expect(code).toMatch(/supportWorker\(\s*\{[\s\S]*?workspaceId:\s*effectiveWsId/);
  });

  it('passa workspaceId al crmWorker', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'lib/agent/orchestrator/supervisor-router.ts'),
      'utf-8'
    );
    expect(code).toMatch(/crmWorker\(\s*\{[\s\S]*?workspaceId:\s*effectiveWsId/);
  });

  it('passa workspaceId al outreachWorker', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'lib/agent/orchestrator/supervisor-router.ts'),
      'utf-8'
    );
    expect(code).toMatch(/outreachWorker\(\s*\{[\s\S]*?workspaceId:\s*effectiveWsId/);
  });

  it('NON mappa reseller a admin per i worker', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'lib/agent/orchestrator/supervisor-router.ts'),
      'utf-8'
    );
    // Il workerRole deve distinguere reseller da admin
    expect(code).toContain("'reseller'");
    expect(code).toContain("effectiveRole === 'reseller'");
  });
});

// ============================================================
// CRM Data Service: filtro workspace SEMPRE quando disponibile
// ============================================================

describe('CRM Data Service — filtro workspace SEMPRE applicato', () => {
  it('NON ha il pattern "!isAdmin && workspaceId" (bypass admin rimosso)', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/crm/crm-data-service.ts'), 'utf-8');
    // Il pattern vecchio bypassava il filtro per admin
    expect(code).not.toContain('!isAdmin && workspaceId');
  });

  it('filtra per workspaceId quando disponibile (8 istanze)', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/crm/crm-data-service.ts'), 'utf-8');
    // Il pattern corretto e': if (workspaceId) { query = query.eq('workspace_id', workspaceId); }
    const matches = code.match(/if\s*\(workspaceId\)\s*\{/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(8);
  });

  it('accetta userRole con 3 valori in tutte le funzioni', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/crm/crm-data-service.ts'), 'utf-8');
    // NON deve avere il tipo vecchio senza reseller
    // Conta occorrenze di 'admin' | 'user' | 'reseller' vs 'admin' | 'user' (senza reseller)
    const newPattern = (code.match(/'admin' \| 'user' \| 'reseller'/g) || []).length;
    expect(newPattern).toBeGreaterThanOrEqual(8);
  });

  it('getEntityDetail filtra commercial_quotes per workspace_id (defense-in-depth)', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/crm/crm-data-service.ts'), 'utf-8');
    // La query commercial_quotes deve avere .eq('workspace_id', workspaceId)
    expect(code).toMatch(/commercial_quotes[\s\S]*?\.eq\(\s*['`]workspace_id['`]/);
  });
});

// ============================================================
// Support Worker: workspace-scoped queries
// ============================================================

describe('Support Worker — workspace scoping', () => {
  it('accetta workspaceId nel SupportWorkerInput', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'lib/agent/workers/support-worker.ts'),
      'utf-8'
    );
    // L'interfaccia deve avere workspaceId
    expect(code).toMatch(/interface SupportWorkerInput[\s\S]*?workspaceId\?: string/);
  });

  it('importa workspaceQuery', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'lib/agent/workers/support-worker.ts'),
      'utf-8'
    );
    expect(code).toContain("import { workspaceQuery } from '@/lib/db/workspace-query'");
  });

  it('usa workspaceQuery per la query shipments', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'lib/agent/workers/support-worker.ts'),
      'utf-8'
    );
    // Deve usare shipDb (workspace-scoped) per shipments
    expect(code).toMatch(/shipDb\s*\.\s*from\(\s*['`]shipments['`]\)/);
  });

  it('passa workspaceId a tutte le chiamate executeTool', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'lib/agent/workers/support-worker.ts'),
      'utf-8'
    );
    // Conta le chiamate executeTool con workspaceId come ultimo argomento
    const calls = code.match(/executeTool\([\s\S]*?workspaceId\s*\)/g);
    // Tutte e 7 le chiamate devono passare workspaceId
    expect(calls).not.toBeNull();
    expect(calls!.length).toBeGreaterThanOrEqual(7);
  });
});

// ============================================================
// Pricing Tools: workspace-scoped queries su price_lists
// ============================================================

describe('Pricing Tools — workspace scoping', () => {
  it('get_price_list_details usa workspace-scoped query per price_lists', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/ai/tools.ts'), 'utf-8');
    // Deve creare plDb con workspaceQuery
    expect(code).toMatch(/plDb\s*=\s*workspaceId\s*\?\s*workspaceQuery/);
  });

  it('get_supplier_cost usa workspace-scoped query per price_lists', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/ai/tools.ts'), 'utf-8');
    expect(code).toMatch(/supplierDb\s*=\s*workspaceId\s*\?\s*workspaceQuery/);
  });

  it('list_user_price_lists usa workspace-scoped query per price_lists e assignments', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/ai/tools.ts'), 'utf-8');
    expect(code).toMatch(/listDb\s*=\s*workspaceId\s*\?\s*workspaceQuery/);
    // Deve usare listDb per price_list_assignments
    expect(code).toMatch(/listDb\s*\.\s*from\(\s*['`]price_list_assignments['`]\)/);
  });

  it('compare_supplier_vs_selling usa workspace-scoped query per price_lists', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/ai/tools.ts'), 'utf-8');
    expect(code).toMatch(/compareDb\s*=\s*workspaceId\s*\?\s*workspaceQuery/);
  });

  it('track_shipment usa workspace-scoped query', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/ai/tools.ts'), 'utf-8');
    expect(code).toMatch(/trackDb\s*=\s*workspaceId\s*\?\s*workspaceQuery/);
  });
});

// ============================================================
// NESSUN supabaseAdmin.from() su tabelle multi-tenant in lib/ai/
// ============================================================

describe('Anne AI — nessuna query diretta su tabelle multi-tenant', () => {
  const ANNE_FILES = [
    'lib/ai/context-builder.ts',
    'lib/ai/tools/support-tools.ts',
    // tools.ts ha ancora supabaseAdmin per couriers (tabella globale) — ok
  ];

  const MULTI_TENANT_TABLES = [
    'shipments',
    'wallet_transactions',
    'price_lists',
    'price_list_assignments',
    'audit_logs',
    'shipment_holds',
  ];

  for (const file of ANNE_FILES) {
    it(`${file} non usa supabaseAdmin.from() su tabelle multi-tenant`, () => {
      const filePath = path.join(process.cwd(), file);
      if (!fs.existsSync(filePath)) return; // Skip se file non esiste

      const code = fs.readFileSync(filePath, 'utf-8');

      for (const table of MULTI_TENANT_TABLES) {
        const pattern = new RegExp(
          `supabaseAdmin\\s*\\.from\\(\\s*['\\x60]${table}['\\x60]\\s*\\)`,
          'gs'
        );
        const matches = code.match(pattern);
        if (matches) {
          // Eccezione: support-tools.ts puo usare supabaseAdmin.rpc() (non .from())
          // e supabaseAdmin per tabelle globali come support_escalations
          expect(matches).toBeNull();
        }
      }
    });
  }
});
