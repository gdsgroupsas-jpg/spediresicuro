/**
 * Guardian Test: No Hardcoded Email Bypass in Production Code
 *
 * Questo test verifica che:
 * 1. Nessun file di produzione contenga bypass hardcoded per email specifiche
 * 2. Nessun file di produzione usi isTestUser con confronto email
 * 3. Il middleware non abbia bypass per utenti specifici
 *
 * CONTESTO: Un audit investor (feb 2026) ha rilevato bypass hardcoded
 * per test@spediresicuro.it nel middleware e in 5 file di produzione.
 * Questo guardian impedisce la reintroduzione di tali bypass.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Directory di produzione da scansionare
const PRODUCTION_DIRS = ['app', 'lib', 'actions'];

// Pattern di bypass vietati in codice di produzione
// NOTA: gli UUID fittizi (00000000...) e 'test-user-id' nelle server actions sono
// protetti a monte da isE2ETestMode() (disabilitato in produzione) e non sono bypass.
// Qui cerchiamo SOLO bypass per email hardcoded — il vero rischio di sicurezza.
const FORBIDDEN_PATTERNS = [
  // Bypass per email specifiche
  /['"`]test@spediresicuro\.it['"`]/,
  // Confronto diretto con email hardcoded per bypass
  /userEmail\s*===?\s*['"`][^'"]+@spediresicuro\.it['"`]/,
];

// File esclusi (legittimamente contengono riferimenti a test)
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.next',
  'tests/',
  'scripts/',
  '__tests__',
  '__fixtures__',
  // File di utilità per cleanup dati test (admin-only, non è un bypass)
  'lib/utils/test-data-detection.ts',
  // Route di test rimosse (commit CTO-cleanup-2026-02)
  // Admin cleanup (rilevamento, non bypass)
  'app/api/admin/cleanup-test-users/',
  'app/dashboard/admin/page.tsx',
  // Documenti/archivio
  'docs/',
];

function scanForBypasses(dir: string): { file: string; violations: string[] }[] {
  const results: { file: string; violations: string[] }[] = [];
  const fullDir = path.join(process.cwd(), dir);

  if (!fs.existsSync(fullDir)) return results;

  const entries = fs.readdirSync(fullDir, { withFileTypes: true, recursive: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;

    const relativePath = path
      .join(dir, entry.parentPath?.replace(fullDir, '') || '', entry.name)
      .replace(/\\/g, '/');

    // Skip file esclusi
    if (EXCLUDE_PATTERNS.some((p) => relativePath.includes(p))) continue;

    const filePath = path.join(fullDir, entry.parentPath?.replace(fullDir, '') || '', entry.name);
    let code: string;
    try {
      code = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const violations: string[] = [];
    for (const pattern of FORBIDDEN_PATTERNS) {
      const matches = code.match(new RegExp(pattern.source, 'g'));
      if (matches) {
        violations.push(`${pattern.source} x${matches.length}`);
      }
    }

    if (violations.length > 0) {
      results.push({ file: relativePath, violations });
    }
  }

  return results;
}

describe('Guardian: No Hardcoded Email Bypass', () => {
  it('nessun file di produzione contiene bypass per test@spediresicuro.it', () => {
    const allViolations: { file: string; violations: string[] }[] = [];

    for (const dir of PRODUCTION_DIRS) {
      allViolations.push(...scanForBypasses(dir));
    }

    const totalViolations = allViolations.reduce((sum, v) => sum + v.violations.length, 0);

    if (allViolations.length > 0) {
      console.log(
        `\n🚨 BYPASS GUARDIAN: ${totalViolations} bypass hardcoded trovati in ${allViolations.length} file\n`
      );
      for (const v of allViolations) {
        console.log(`   📄 ${v.file}: ${v.violations.join(', ')}`);
      }
    }

    // BASELINE: ZERO. Nessun bypass hardcoded è ammesso.
    // Se questo test fallisce, hai introdotto un bypass — rimuovilo.
    expect(totalViolations).toBe(0);
  });

  it('middleware.ts non contiene bypass per email specifiche', () => {
    const middlewarePath = path.join(process.cwd(), 'middleware.ts');
    expect(fs.existsSync(middlewarePath)).toBe(true);

    const code = fs.readFileSync(middlewarePath, 'utf-8');

    // Non deve contenere confronti con email hardcoded
    expect(code).not.toMatch(/test@spediresicuro\.it/);
    // Non deve avere variabile isTestUser
    expect(code).not.toMatch(/isTestUser/);
    // Non deve avere bypass con email hardcoded
    expect(code).not.toMatch(/userEmail\s*===?\s*['"`]/);
  });

  it('dati-cliente route non contiene bypass test user', () => {
    const routePath = path.join(process.cwd(), 'app/api/user/dati-cliente/route.ts');
    expect(fs.existsSync(routePath)).toBe(true);

    const code = fs.readFileSync(routePath, 'utf-8');

    // Non deve contenere isTestUser
    expect(code).not.toMatch(/isTestUser/);
    // Non deve avere bypass per UUID fittizi
    expect(code).not.toMatch(/00000000-0000-0000-0000-000000000000/);
    expect(code).not.toMatch(/test-user-id/);
    // Non deve avere fallback 'Test' per campi
    expect(code).not.toMatch(/isTestUser\s*\?\s*'Test'/);
  });

  it('login page non contiene bypass test user', () => {
    const loginPath = path.join(process.cwd(), 'app/login/page.tsx');
    expect(fs.existsSync(loginPath)).toBe(true);

    const code = fs.readFileSync(loginPath, 'utf-8');

    // Non deve avere bypass isTestUser con email hardcoded
    expect(code).not.toMatch(/isTestUser\s*=\s*userEmail\s*===\s*['"`]test@/);
  });

  it('use-profile-completion hook non contiene bypass', () => {
    const hookPath = path.join(process.cwd(), 'lib/hooks/use-profile-completion.ts');
    expect(fs.existsSync(hookPath)).toBe(true);

    const code = fs.readFileSync(hookPath, 'utf-8');

    // Non deve bypassare per email specifiche
    expect(code).not.toMatch(/test@spediresicuro\.it/);
    expect(code).not.toMatch(/isTestUser/);
  });

  it('dashboard page non contiene bypass test user', () => {
    const dashboardPath = path.join(process.cwd(), 'app/dashboard/page.tsx');
    expect(fs.existsSync(dashboardPath)).toBe(true);

    const code = fs.readFileSync(dashboardPath, 'utf-8');

    // Non deve avere bypass per email specifica
    expect(code).not.toMatch(/test@spediresicuro\.it/);
  });
});
