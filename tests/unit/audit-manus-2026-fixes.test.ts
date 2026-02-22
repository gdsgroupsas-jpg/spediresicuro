/**
 * Test suite per i fix dell'audit Manus AI (22 feb 2026)
 *
 * Copre:
 * - P2.1: Rate limiting su POST /api/shipments/create
 * - P2.2: XSS sanitizzazione in posta-workspace
 * - P2.3: XSS sanitizzazione in posta (sostituzione regex debole)
 * - Unificazione sanitizeHtmlClient in modulo condiviso
 * - Guardian canary: regex multilinea anti-regressione
 *
 * Verifica anche le claim ERRATE dell'audit:
 * - consent-service.ts NON è una violazione RLS
 * - wallet v1 RPC NON sono usate in produzione
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { sanitizeHtmlClient } from '@/lib/security/sanitize-html-client';

// ============================================================
// P2.1: Rate Limiting su POST /api/shipments/create
// ============================================================
describe('P2.1: Rate Limiting su /api/shipments/create', () => {
  const routePath = path.join(process.cwd(), 'app/api/shipments/create/route.ts');
  const code = fs.readFileSync(routePath, 'utf-8');

  it('importa withRateLimit', () => {
    expect(code).toContain("import { withRateLimit } from '@/lib/security/rate-limit-middleware'");
  });

  it('chiama withRateLimit PRIMA di requireWorkspaceAuth', () => {
    const rlIndex = code.indexOf('withRateLimit(request');
    const authIndex = code.indexOf('requireWorkspaceAuth()');
    expect(rlIndex).toBeGreaterThan(-1);
    expect(authIndex).toBeGreaterThan(-1);
    expect(rlIndex).toBeLessThan(authIndex);
  });

  it('limite ragionevole (5-60 req/min)', () => {
    const limitMatch = code.match(/limit:\s*(\d+)/);
    expect(limitMatch).not.toBeNull();
    const limit = parseInt(limitMatch![1]);
    expect(limit).toBeLessThanOrEqual(60);
    expect(limit).toBeGreaterThanOrEqual(5);
  });

  it('accetta NextRequest (necessario per withRateLimit)', () => {
    expect(code).toContain('NextRequest');
  });
});

// ============================================================
// P2.2 & P2.3: XSS — Sanitizzazione HTML nelle pagine
// ============================================================
describe('P2.2/P2.3: XSS — tutte le pagine usano sanitizeHtmlClient condiviso', () => {
  const pages = [
    { name: 'posta-workspace', path: 'app/dashboard/posta-workspace/page.tsx' },
    { name: 'posta', path: 'app/dashboard/posta/page.tsx' },
    { name: 'bacheca', path: 'app/dashboard/bacheca/page.tsx' },
  ];

  for (const page of pages) {
    describe(page.name, () => {
      const code = fs.readFileSync(path.join(process.cwd(), page.path), 'utf-8');

      it('importa sanitizeHtmlClient dal modulo condiviso', () => {
        expect(code).toContain("from '@/lib/security/sanitize-html-client'");
      });

      it('NON ha funzione sanitizeHtmlClient inline', () => {
        // Non deve avere una definizione locale della funzione
        expect(code).not.toMatch(/function sanitizeHtmlClient/);
      });

      it('ogni dangerouslySetInnerHTML usa sanitizeHtmlClient()', () => {
        const matches = code.match(/dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html:\s*([^}]+)\}/g);
        if (!matches) return;
        for (const match of matches) {
          expect(match).toContain('sanitizeHtmlClient');
        }
      });

      it('nessuna regex inline in dangerouslySetInnerHTML', () => {
        const regex = /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html:\s*[^}]*\.replace\s*\(\s*\//;
        expect(code).not.toMatch(regex);
      });
    });
  }
});

// ============================================================
// sanitizeHtmlClient — test funzionale sulla funzione reale
// ============================================================
describe('sanitizeHtmlClient — vettori XSS', () => {
  // Tag pericolosi
  it('rimuove <script>', () => {
    expect(sanitizeHtmlClient('<script>alert(1)</script>')).not.toContain('<script');
  });

  it('rimuove <iframe>', () => {
    expect(sanitizeHtmlClient('<iframe src="evil.com"></iframe>')).not.toContain('<iframe');
  });

  it('rimuove <svg>', () => {
    expect(sanitizeHtmlClient('<svg onload="alert(1)">')).not.toContain('<svg');
  });

  it('rimuove <style>', () => {
    expect(sanitizeHtmlClient('<style>body{display:none}</style>')).not.toContain('<style');
  });

  it('rimuove <template>', () => {
    expect(sanitizeHtmlClient('<template><img src=x onerror=alert(1)></template>')).not.toContain(
      '<template'
    );
  });

  it('rimuove <object> e <embed>', () => {
    const result = sanitizeHtmlClient('<object data="evil.swf"></object><embed src="evil.swf">');
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
  });

  it('rimuove <form> e <input>', () => {
    const result = sanitizeHtmlClient(
      '<form action="evil.com"><input type="text" name="cc"></form>'
    );
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<input');
  });

  // Event handler
  it('rimuove onclick', () => {
    expect(sanitizeHtmlClient('<div onclick="alert(1)">test</div>')).not.toContain('onclick');
  });

  it('rimuove onerror', () => {
    expect(sanitizeHtmlClient('<img onerror="alert(1)" src="x">')).not.toContain('onerror');
  });

  it('rimuove onmouseover', () => {
    expect(sanitizeHtmlClient('<a onmouseover="alert(1)">link</a>')).not.toContain('onmouseover');
  });

  // Protocolli pericolosi
  it('blocca javascript: in href', () => {
    const result = sanitizeHtmlClient('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain('javascript:');
  });

  it('blocca vbscript: in href', () => {
    const result = sanitizeHtmlClient('<a href="vbscript:MsgBox(1)">click</a>');
    expect(result).not.toContain('vbscript:');
  });

  it('blocca data: in src', () => {
    const result = sanitizeHtmlClient('<img src="data:text/html,<script>alert(1)</script>">');
    expect(result).not.toContain('data:');
  });

  // Anti-recomposition
  it('blocca recomposition <scr<script>ipt>', () => {
    const result = sanitizeHtmlClient('<scr<script>ipt>alert(1)</scr</script>ipt>');
    expect(result).not.toContain('<script');
  });

  // Contenuto safe preservato
  it('preserva tag sicuri', () => {
    expect(sanitizeHtmlClient('<p>Ciao <b>mondo</b></p>')).toContain('<p>Ciao <b>mondo</b></p>');
  });

  it('preserva link sicuri', () => {
    const result = sanitizeHtmlClient('<a href="https://safe.com">link</a>');
    expect(result).toContain('<a href="https://safe.com">link</a>');
  });

  it('preserva tabelle', () => {
    const result = sanitizeHtmlClient('<table><tr><td>dato</td></tr></table>');
    expect(result).toContain('<table>');
    expect(result).toContain('<td>dato</td>');
  });

  it('gestisce input vuoto/null', () => {
    expect(sanitizeHtmlClient('')).toBe('');
  });
});

// ============================================================
// Verifica claim ERRATE dell'audit
// ============================================================
describe('Audit claim errate — verifica fattuale', () => {
  it('outreach_consent NON è in WORKSPACE_SCOPED_TABLES (claim audit ERRATA)', async () => {
    const { WORKSPACE_SCOPED_TABLES } = await import('@/lib/db/workspace-query');
    expect(WORKSPACE_SCOPED_TABLES.has('outreach_consent')).toBe(false);
  });

  it('outreach_consent NON ha colonna workspace_id (tabella GDPR globale)', () => {
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260210100000_outreach_system.sql'
    );
    if (!fs.existsSync(migrationPath)) return;

    const sql = fs.readFileSync(migrationPath, 'utf-8');
    const tableMatch = sql.match(/CREATE TABLE[^;]*outreach_consent[^;]*;/is);
    if (tableMatch) {
      expect(tableMatch[0]).not.toContain('workspace_id');
    }
  });

  it('wallet v1 RPC NON sono chiamate in codice di produzione', () => {
    const prodDirs = ['actions', 'app', 'lib'];
    const v1Functions = ['add_wallet_credit', 'deduct_wallet_credit', 'refund_wallet_balance'];

    for (const dir of prodDirs) {
      const fullDir = path.join(process.cwd(), dir);
      if (!fs.existsSync(fullDir)) continue;

      const entries = fs.readdirSync(fullDir, { withFileTypes: true, recursive: true });

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;

        const filePath = path.join(
          fullDir,
          entry.parentPath?.replace(fullDir, '') || '',
          entry.name
        );
        let code: string;
        try {
          code = fs.readFileSync(filePath, 'utf-8');
        } catch {
          continue;
        }

        for (const fn of v1Functions) {
          // Pattern: .rpc('add_wallet_credit' (senza _v2)
          // Ma NON cattura add_wallet_credit_v2
          const rpcCallPattern = new RegExp(`\\.rpc\\(\\s*['"]${fn}['"](?!_v2)`, 'g');
          const matches = code.match(rpcCallPattern);
          if (matches) {
            const relativePath = filePath.replace(process.cwd(), '').replace(/\\/g, '/');
            // Ogni match deve essere in un commento
            for (const match of matches) {
              const idx = code.indexOf(match);
              const lineStart = code.lastIndexOf('\n', idx);
              const lineBefore = code.slice(lineStart, idx);
              expect(
                lineBefore.includes('//') || lineBefore.includes('*'),
                `Chiamata v1 wallet RPC attiva in ${relativePath}: ${match}`
              ).toBe(true);
            }
          }
        }
      }
    }
  });
});

// ============================================================
// Guardian canary — anti-regressione regex
// ============================================================
describe('Guardian canary — integrità strutturale', () => {
  it('il file canary esiste con contenuto atteso', () => {
    const canaryPath = path.join(process.cwd(), 'tests/__fixtures__/guardian-canary.ts');
    expect(fs.existsSync(canaryPath)).toBe(true);

    const code = fs.readFileSync(canaryPath, 'utf-8');
    expect(code).toContain('NON CANCELLARE');
    expect(code).toContain("supabaseAdmin.from('shipments')");
    expect(code).toContain(".from('price_lists')");
  });

  it('il guardian test referenzia il canary', () => {
    const guardianPath = path.join(process.cwd(), 'tests/unit/workspace-query-guardian.test.ts');
    const code = fs.readFileSync(guardianPath, 'utf-8');

    expect(code).toContain('guardian-canary.ts');
    expect(code).toContain('CANARY');
  });

  it('il sanitize-html-client.ts esiste come modulo condiviso', () => {
    const p = path.join(process.cwd(), 'lib/security/sanitize-html-client.ts');
    expect(fs.existsSync(p)).toBe(true);

    const code = fs.readFileSync(p, 'utf-8');
    expect(code).toContain('export function sanitizeHtmlClient');
  });
});
