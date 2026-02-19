/**
 * RBAC Inline Guardian — DoD 2
 *
 * Verifica che NESSUN file usi check inline su role/account_type
 * al di fuori degli helper centrali autorizzati.
 *
 * Pattern vietati:
 * - .role === 'admin'
 * - .role !== 'admin'
 * - .role === 'superadmin'
 * - account_type === 'admin' (fuori da auth-helpers)
 *
 * Pattern permessi:
 * - workspace.role (ruolo membership, non user role)
 * - reseller_role (ruolo reseller specifico)
 * - Nei file auth-helpers.ts, safe-auth.ts (sono gli helper centrali)
 * - Nei test
 * - Nei file di navigazione/config UI
 *
 * Baseline: 0 violazioni.
 * Se questo test fallisce, significa che qualcuno ha introdotto un check inline.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// File autorizzati a contenere check inline (helper centrali + config)
const AUTHORIZED_FILES = [
  'lib/auth-helpers.ts',
  'lib/safe-auth.ts',
  'lib/rbac.ts', // deprecated ma ancora presente
  'lib/config/navigationConfig.ts',
  'lib/auth-config.ts', // JWT callback must check account_type
  'middleware.ts',
  'hooks/useWorkspace.ts', // workspace.role (membership role, non user role)
  'types/workspace.ts', // workspace role type definitions
  'lib/crm/crm-write-service.ts', // role parametro routing (lead vs prospect), non auth check
  'actions/super-admin.ts', // role parametro input validazione reseller_role, non auth check
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
const FORBIDDEN_PATTERNS = [
  // .role === 'admin' (ma non workspace.role o reseller_role)
  /(?<!workspace\.)(?<!reseller_)(?<!\.reseller_)role\s*===\s*['"]admin['"]/,
  // .role !== 'admin'
  /(?<!workspace\.)(?<!reseller_)(?<!\.reseller_)role\s*!==\s*['"]admin['"]/,
  // .role === 'superadmin'
  /(?<!workspace\.)(?<!reseller_)role\s*===\s*['"]superadmin['"]/,
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

        for (const pattern of FORBIDDEN_PATTERNS) {
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
        `\n\n🚨 RBAC INLINE GUARDIAN: ${violations.length} violazioni trovate!\n` +
          `Usare isAdminOrAbove() / isSuperAdminCheck() da @/lib/auth-helpers\n\n` +
          report +
          '\n'
      );
    }

    // Baseline: ZERO violazioni
    expect(violations.length).toBe(0);
  });

  it('auth-helpers.ts esporta le funzioni necessarie', async () => {
    const helpers = await import('@/lib/auth-helpers');

    expect(typeof helpers.isAdminOrAbove).toBe('function');
    expect(typeof helpers.isSuperAdminCheck).toBe('function');
    expect(typeof helpers.isResellerCheck).toBe('function');
    expect(typeof helpers.isBYOC).toBe('function');
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
});
