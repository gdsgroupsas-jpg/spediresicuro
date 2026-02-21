/**
 * RBAC Inline Guardian — DoD 2 (esteso)
 *
 * Verifica che NESSUN file usi check inline su role/account_type
 * al di fuori degli helper centrali autorizzati.
 *
 * Pattern vietati:
 * - .role === 'admin' / 'superadmin' (campo deprecated)
 * - account_type === 'admin' / 'superadmin' / 'byoc' (fuori da auth-helpers)
 *
 * Pattern permessi:
 * - workspace.role (ruolo membership, non user role)
 * - reseller_role (ruolo reseller specifico)
 * - Nei file auth-helpers.ts, safe-auth.ts (helper centrali)
 * - Nei file autorizzati (data transformation, config, login UI)
 * - Nei test e script
 *
 * Baseline: 0 violazioni.
 * Se questo test fallisce, significa che qualcuno ha introdotto un check inline.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// File autorizzati a contenere check inline (helper centrali + config + data transformation)
const AUTHORIZED_FILES = [
  // Helper centrali (source of truth)
  'lib/auth-helpers.ts',
  'lib/safe-auth.ts',
  'lib/rbac.ts', // deprecated ma ancora presente
  // Config e routing
  'lib/config/navigationConfig.ts',
  'lib/auth-config.ts', // JWT callback deve accedere account_type raw
  'middleware.ts',
  // Workspace membership (non user role)
  'hooks/useWorkspace.ts',
  'types/workspace.ts',
  // Business logic non-auth (routing CRM, validazione input)
  'lib/crm/crm-write-service.ts', // role parametro routing (lead vs prospect)
  'actions/super-admin.ts', // role parametro input validazione + business rule
  // Data transformation (mapping account_type -> campi legacy, non auth gate)
  'lib/database.ts', // role mapping, admin_level assignment
  'lib/database-auth.impl.ts', // estrazione non-breaking da database.ts
  'lib/database-users.impl.ts', // estrazione non-breaking da database.ts
  'lib/database-shipments.impl.ts', // estrazione helper shipment da database.ts
  // Login UI (mostra diversi form per tipo account — rendering, non auth)
  'app/login/page.tsx',
  // Platform fee (difensivo multi-path: account_type + role + is_reseller)
  'lib/services/pricing/platform-fee.ts',
  // Debug endpoint (restituisce info account, non auth gate)
  'app/api/debug/check-my-account-type/route.ts',
  // Auth callback (data transformation durante registrazione)
  'app/api/auth/supabase-callback/route.ts',
  // Reseller clients API (multi-path reseller check: is_reseller + account_type + reseller_role)
  'app/api/reseller/clients/route.ts',
  // Superadmin clients API (filtra per account_type reseller — business logic, non auth)
  'app/api/superadmin/clients/route.ts',
  // Configurations admin page (mostra badge BYOC/Reseller — UI display, non auth)
  'app/dashboard/admin/configurations/page.tsx',
  // Reseller listini page (check byoc per routing UI)
  'app/dashboard/reseller/listini/page.tsx',
  // BYOC listini page (check byoc per routing UI)
  'app/dashboard/byoc/listini-fornitore/page.tsx',
  // Reseller nuovo cliente (routing UI basato su tipo)
  'app/dashboard/reseller/clienti/nuovo/page.tsx',
  // Platform costs (filtra per account_type in aggregazione stats)
  'actions/platform-costs.ts',
  // Spedisci-online config multi (usa accountType per display, gia' consolidato admin check)
  'components/integrazioni/spedisci-online-config-multi.tsx',
  // Admin page (rendering condizionale per account_type — display, non auth)
  'app/dashboard/admin/page.tsx',
  // Price lists (filtra utenti per tipo — business logic, non auth)
  'actions/price-lists.ts',
  // Cleanup test users (filtra admin da non cancellare — business rule)
  'app/api/admin/cleanup-test-users/route.ts',
  // Admin users delete (protegge superadmin da cancellazione — business rule)
  'app/api/admin/users/[id]/route.ts',
  // Spedizioni route (sanitize payload multi-path: accountType + role legacy)
  'app/api/spedizioni/route.ts',
];

// Directory escluse dalla scansione
const EXCLUDED_DIRS = [
  'node_modules',
  '.next',
  '.git',
  'tests',
  'e2e',
  'scripts',
  'supabase/migrations',
  'docs',
];

// Pattern vietati: check inline su user role (non workspace role)
const FORBIDDEN_ROLE_PATTERNS = [
  // .role === 'admin' (ma non workspace.role o reseller_role)
  /(?<!workspace\.)(?<!reseller_)(?<!\.reseller_)role\s*===\s*['"]admin['"]/,
  // .role !== 'admin'
  /(?<!workspace\.)(?<!reseller_)(?<!\.reseller_)role\s*!==\s*['"]admin['"]/,
  // .role === 'superadmin'
  /(?<!workspace\.)(?<!reseller_)role\s*===\s*['"]superadmin['"]/,
];

// Pattern vietati: check inline su account_type (fuori da helper)
const FORBIDDEN_ACCOUNT_TYPE_PATTERNS = [
  // account_type === 'admin'
  /account_type\s*===\s*['"]admin['"]/,
  // account_type === 'superadmin'
  /account_type\s*===\s*['"]superadmin['"]/,
  // account_type !== 'admin'
  /account_type\s*!==\s*['"]admin['"]/,
  // account_type !== 'superadmin'
  /account_type\s*!==\s*['"]superadmin['"]/,
  // account_type === 'byoc'
  /account_type\s*===\s*['"]byoc['"]/,
  // account_type !== 'byoc'
  /account_type\s*!==\s*['"]byoc['"]/,
  // accountType === 'admin' (camelCase variant)
  /accountType\s*===\s*['"]admin['"]/,
  // accountType === 'superadmin'
  /accountType\s*===\s*['"]superadmin['"]/,
  // accountType === 'byoc'
  /accountType\s*===\s*['"]byoc['"]/,
];

function getAllTsFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

    // Salta directory escluse
    if (entry.isDirectory()) {
      const shouldExclude = EXCLUDED_DIRS.some(
        (excl) => relativePath.startsWith(excl) || relativePath.includes(`/${excl}/`)
      );
      if (!shouldExclude) {
        getAllTsFiles(fullPath, files);
      }
      continue;
    }

    // Solo file .ts e .tsx (non .d.ts)
    if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('.d.ts')
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('RBAC Inline Guardian — DoD 2', () => {
  it('nessun file contiene check inline su role (fuori dagli helper autorizzati)', () => {
    const projectRoot = process.cwd();
    const allFiles = getAllTsFiles(projectRoot);
    const violations: { file: string; line: number; content: string; pattern: string }[] = [];

    for (const filePath of allFiles) {
      const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

      // Salta file autorizzati
      if (AUTHORIZED_FILES.some((auth) => relativePath.endsWith(auth))) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Salta commenti
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          continue;
        }

        for (const pattern of FORBIDDEN_ROLE_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              file: relativePath,
              line: i + 1,
              content: line.trim().substring(0, 100),
              pattern: pattern.source.substring(0, 50),
            });
          }
        }
      }
    }

    // Report violazioni
    if (violations.length > 0) {
      const report = violations.map((v) => `  ${v.file}:${v.line} — ${v.content}`).join('\n');

      expect.fail(
        `\n\n🚨 RBAC INLINE GUARDIAN (role): ${violations.length} violazioni trovate!\n` +
          `Usare isAdminOrAbove() / isSuperAdminCheck() da @/lib/auth-helpers\n\n` +
          report +
          '\n'
      );
    }

    // Baseline: ZERO violazioni
    expect(violations.length).toBe(0);
  });

  it('nessun file contiene check inline su account_type (fuori dagli helper autorizzati)', () => {
    const projectRoot = process.cwd();
    const allFiles = getAllTsFiles(projectRoot);
    const violations: { file: string; line: number; content: string; pattern: string }[] = [];

    for (const filePath of allFiles) {
      const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

      // Salta file autorizzati
      if (AUTHORIZED_FILES.some((auth) => relativePath.endsWith(auth))) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Salta commenti
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          continue;
        }

        for (const pattern of FORBIDDEN_ACCOUNT_TYPE_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              file: relativePath,
              line: i + 1,
              content: line.trim().substring(0, 100),
              pattern: pattern.source.substring(0, 50),
            });
          }
        }
      }
    }

    // Report violazioni
    if (violations.length > 0) {
      const report = violations.map((v) => `  ${v.file}:${v.line} — ${v.content}`).join('\n');

      expect.fail(
        `\n\n🚨 RBAC INLINE GUARDIAN (account_type): ${violations.length} violazioni trovate!\n` +
          `Usare isAdminOrAbove() / isSuperAdminCheck() / isBYOC() da @/lib/auth-helpers\n\n` +
          report +
          '\n'
      );
    }

    // Baseline: ZERO violazioni
    expect(violations.length).toBe(0);
  });

  it('auth-helpers.ts esporta le funzioni necessarie', async () => {
    const helpers = await import('@/lib/auth-helpers');

    // Helper base
    expect(typeof helpers.isAdminOrAbove).toBe('function');
    expect(typeof helpers.isSuperAdminCheck).toBe('function');
    expect(typeof helpers.isResellerCheck).toBe('function');
    expect(typeof helpers.isBYOC).toBe('function');
    // Helper composti
    expect(typeof helpers.canManagePriceLists).toBe('function');
    expect(typeof helpers.isResellerOrSuperadmin).toBe('function');
    expect(typeof helpers.isResellerOrBYOC).toBe('function');
    expect(typeof helpers.isResellerOrAdmin).toBe('function');
  });

  it('isAdminOrAbove controlla account_type, non role', async () => {
    const { isAdminOrAbove } = await import('@/lib/auth-helpers');

    // Solo account_type conta
    expect(isAdminOrAbove({ account_type: 'admin' })).toBe(true);
    expect(isAdminOrAbove({ account_type: 'superadmin' })).toBe(true);
    expect(isAdminOrAbove({ account_type: 'user' })).toBe(false);

    // role legacy viene ignorato
    expect(isAdminOrAbove({})).toBe(false);
    expect(isAdminOrAbove({ account_type: 'user' })).toBe(false);
  });

  it('canManagePriceLists include admin + reseller + byoc', async () => {
    const { canManagePriceLists } = await import('@/lib/auth-helpers');

    expect(canManagePriceLists({ account_type: 'admin' })).toBe(true);
    expect(canManagePriceLists({ account_type: 'superadmin' })).toBe(true);
    expect(canManagePriceLists({ is_reseller: true })).toBe(true);
    expect(canManagePriceLists({ account_type: 'byoc' })).toBe(true);
    expect(canManagePriceLists({ account_type: 'user' })).toBe(false);
    expect(canManagePriceLists({})).toBe(false);
  });
});
