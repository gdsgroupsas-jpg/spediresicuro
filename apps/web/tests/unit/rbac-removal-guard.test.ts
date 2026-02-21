/**
 * Guardian test: verifica che lib/rbac.ts sia stato rimosso
 * e che nessun file lo importi piu'.
 *
 * Baseline: 0 import da @/lib/rbac
 * Se questo test fallisce, qualcuno ha ri-aggiunto un import legacy.
 * Usare @/lib/safe-auth o @/lib/auth-helpers.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Guardian: rbac.ts rimosso', () => {
  it('lib/rbac.ts NON deve esistere', () => {
    const filePath = path.resolve('lib/rbac.ts');
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('nessun file importa da @/lib/rbac (baseline: 0)', () => {
    // Scan ricorsivo dei file .ts e .tsx
    const rootDir = path.resolve('.');
    const violations: string[] = [];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip directories non rilevanti
        if (entry.isDirectory()) {
          if (['node_modules', '.next', 'dist', '.git', '.claude'].includes(entry.name)) {
            continue;
          }
          scanDir(fullPath);
          continue;
        }

        // Controlla solo file .ts e .tsx
        if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) {
          continue;
        }

        // Escludi questo file guardian (contiene la stringa come test)
        if (entry.name === 'rbac-removal-guard.test.ts') continue;

        const content = fs.readFileSync(fullPath, 'utf-8');
        if (content.includes("from '@/lib/rbac'") || content.includes('from "@/lib/rbac"')) {
          violations.push(path.relative(rootDir, fullPath));
        }
      }
    }

    scanDir(rootDir);

    // Baseline: ZERO violazioni
    expect(violations).toEqual([]);
  });
});
