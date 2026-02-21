/**
 * Test di sicurezza per i nuovi file Anne v2.
 * Verifica che non ci siano violazioni multi-tenant, file pericolosi, e ruoli corretti.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../');

// ─── File pericolosi ─────────────────────────────────────────────────

describe('anne-v2 security: file pericolosi', () => {
  it('anne-superadmin-tools.ts NON deve esistere', () => {
    const dangerousPaths = [
      'lib/agent/workers/anne-superadmin-tools.ts',
      'lib/agent/anne-superadmin-tools.ts',
      'lib/ai/anne-superadmin-tools.ts',
    ];
    for (const p of dangerousPaths) {
      const fullPath = path.join(ROOT, p);
      expect(fs.existsSync(fullPath), `File pericoloso trovato: ${p}`).toBe(false);
    }
  });
});

// ─── Multi-tenant: nuovi file non usano supabaseAdmin su tabelle scoped ─

describe('anne-v2 security: multi-tenant isolation', () => {
  const WORKSPACE_SCOPED_TABLES = [
    'shipments',
    'price_lists',
    'price_list_entries',
    'price_list_assignments',
    'wallet_transactions',
    'commercial_quotes',
    'commercial_quote_events',
    'emails',
    'leads',
    'reseller_prospects',
    'audit_logs',
  ];

  // Tutte le directory nuove/modificate dal merge anne-pensa-fa
  const NEW_V2_DIRS = [
    'lib/agent/v2',
    'lib/agent/chains',
    'lib/agent/flows',
    'lib/agent/workers/shipment-creation-v2',
  ];

  // File singoli nuovi fuori dalle directory sopra
  const NEW_STANDALONE_FILES = [
    'lib/agent/supervisor.ts',
    'lib/agent/specific-flows.ts',
    'lib/agent/format-pricing.ts',
    'lib/ai/ollama.ts',
  ];

  // Pattern: supabaseAdmin.from('table_name')
  const VIOLATION_PATTERN = /supabaseAdmin\.from\(\s*['"](\w+)['"]\s*\)/g;

  function scanDirectory(dir: string): { file: string; table: string }[] {
    const violations: { file: string; table: string }[] = [];
    const fullDir = path.join(ROOT, dir);
    if (!fs.existsSync(fullDir)) return violations;

    const files = fs.readdirSync(fullDir, { recursive: true }) as string[];
    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
      const filePath = path.join(fullDir, file);
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      let match;
      while ((match = VIOLATION_PATTERN.exec(content)) !== null) {
        const tableName = match[1];
        if (WORKSPACE_SCOPED_TABLES.includes(tableName)) {
          violations.push({ file: path.join(dir, file), table: tableName });
        }
      }
    }
    return violations;
  }

  function scanFile(filePath: string): { file: string; table: string }[] {
    const violations: { file: string; table: string }[] = [];
    const fullPath = path.join(ROOT, filePath);
    if (!fs.existsSync(fullPath)) return violations;
    const content = fs.readFileSync(fullPath, 'utf-8');
    let match;
    // Reset lastIndex per regex globale
    const pattern = /supabaseAdmin\.from\(\s*['"](\w+)['"]\s*\)/g;
    while ((match = pattern.exec(content)) !== null) {
      if (WORKSPACE_SCOPED_TABLES.includes(match[1])) {
        violations.push({ file: filePath, table: match[1] });
      }
    }
    return violations;
  }

  it('nuovi file v2 non usano supabaseAdmin su tabelle multi-tenant', () => {
    const allViolations: { file: string; table: string }[] = [];

    // Scansiona directory
    for (const dir of NEW_V2_DIRS) {
      allViolations.push(...scanDirectory(dir));
    }

    // Scansiona file standalone
    for (const file of NEW_STANDALONE_FILES) {
      allViolations.push(...scanFile(file));
    }

    if (allViolations.length > 0) {
      const details = allViolations
        .map((v) => `  ${v.file}: supabaseAdmin.from('${v.table}')`)
        .join('\n');
      throw new Error(
        `Violazioni multi-tenant nei nuovi file v2:\n${details}\n` +
          `Usare workspaceQuery(workspaceId) da @/lib/db/workspace-query.`
      );
    }
    expect(allViolations).toHaveLength(0);
  });
});

// ─── 3-way role type ─────────────────────────────────────────────────

describe('anne-v2 security: 3-way role type', () => {
  it('FlowContext.userRole accetta reseller', () => {
    // Se questo compila, la tipizzazione e' corretta
    const ctx: import('@/lib/agent/flows/types').FlowContext = {
      message: 'test',
      userId: 'u1',
      userRole: 'reseller',
    };
    expect(ctx.userRole).toBe('reseller');
  });

  it('FlowContext.userRole accetta admin', () => {
    const ctx: import('@/lib/agent/flows/types').FlowContext = {
      message: 'test',
      userId: 'u1',
      userRole: 'admin',
    };
    expect(ctx.userRole).toBe('admin');
  });

  it('FlowContext.userRole accetta user', () => {
    const ctx: import('@/lib/agent/flows/types').FlowContext = {
      message: 'test',
      userId: 'u1',
      userRole: 'user',
    };
    expect(ctx.userRole).toBe('user');
  });
});

// ─── Guardian baseline ───────────────────────────────────────────────

describe('anne-v2 security: guardian baseline', () => {
  it('workspace-query-guardian resta a 0 violazioni nuove dai file v2', () => {
    // Questo test verifica che i nuovi file NON aumentino il baseline del guardian.
    // Il guardian principale (workspace-query-guardian.test.ts) monitora il numero totale.
    // Qui verifichiamo solo i file nuovi.
    const NEW_FILES = [
      'lib/agent/supervisor.ts',
      'lib/agent/specific-flows.ts',
      'lib/agent/format-pricing.ts',
      'lib/agent/flows/richiesta-preventivo.ts',
      'lib/agent/flows/types.ts',
      'lib/agent/chains/run-flow-chain.ts',
      'lib/agent/chains/index.ts',
      'lib/ai/ollama.ts',
    ];

    const PATTERN = /supabaseAdmin\.from\(/g;
    let violations = 0;

    for (const file of NEW_FILES) {
      const fullPath = path.join(ROOT, file);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, 'utf-8');
      const matches = content.match(PATTERN);
      if (matches) {
        violations += matches.length;
      }
    }

    expect(violations).toBe(0);
  });
});

// ─── domain-ai: nessun import @/ (package standalone) ────────────────

describe('anne-v2 security: domain-ai isolation', () => {
  it('packages/domain-ai non importa da @/ (standalone)', () => {
    const domainAiDir = path.join(ROOT, 'packages/domain-ai/src');
    if (!fs.existsSync(domainAiDir)) {
      throw new Error('packages/domain-ai/src non trovato');
    }

    const files = fs.readdirSync(domainAiDir, { recursive: true }) as string[];
    const violations: string[] = [];

    for (const file of files) {
      if (!file.endsWith('.ts')) continue;
      const filePath = path.join(domainAiDir, file);
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes("from '@/") || content.includes('from "@/')) {
        violations.push(file);
      }
    }

    expect(violations, `domain-ai importa da @/: ${violations.join(', ')}`).toHaveLength(0);
  });
});
