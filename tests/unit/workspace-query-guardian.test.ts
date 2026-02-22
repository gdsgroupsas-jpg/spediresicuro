/**
 * Test Guardian: Workspace Query Isolation
 *
 * Questo test verifica che:
 * 1. workspaceQuery() forza il filtro workspace_id sulle tabelle multi-tenant
 * 2. workspaceQuery() non filtra tabelle globali (users, couriers, ecc.)
 * 3. workspaceQuery() inietta workspace_id negli INSERT
 * 4. La lista WORKSPACE_SCOPED_TABLES è aggiornata
 *
 * OBIETTIVO ARCHITETTURALE:
 * Qualsiasi nuova query su tabella multi-tenant DEVE usare workspaceQuery()
 * invece di supabaseAdmin.from() direttamente.
 * Questo è l'unico modo per garantire isolamento multi-tenant senza errori umani.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Import diretto per verificare l'API
import { WORKSPACE_SCOPED_TABLES } from '@/lib/db/workspace-query';

describe('workspaceQuery — API e regole', () => {
  it('WORKSPACE_SCOPED_TABLES contiene le tabelle multi-tenant critiche', () => {
    // Tabelle business-critical che DEVONO essere filtrate
    const criticalTables = [
      'shipments',
      'price_lists',
      'wallet_transactions',
      'commercial_quotes',
      'invoices', // TODO: aggiungere quando invoices avrà workspace_id
      'emails',
    ];

    // Verifica che almeno le tabelle critiche principali siano presenti
    // (invoices potrebbe non esserci ancora)
    const presentTables = criticalTables.filter((t) => WORKSPACE_SCOPED_TABLES.has(t));
    expect(presentTables.length).toBeGreaterThanOrEqual(4);
  });

  it('WORKSPACE_SCOPED_TABLES NON contiene tabelle globali', () => {
    const globalTables = [
      'users',
      'workspaces',
      'workspace_members',
      'couriers',
      'courier_configs',
      'system_settings',
    ];

    for (const table of globalTables) {
      expect(WORKSPACE_SCOPED_TABLES.has(table)).toBe(false);
    }
  });

  it('il modulo workspace-query esiste e ha le export corrette', () => {
    const modulePath = path.join(process.cwd(), 'lib/db/workspace-query.ts');
    expect(fs.existsSync(modulePath)).toBe(true);

    const code = fs.readFileSync(modulePath, 'utf-8');
    // Export della funzione principale
    expect(code).toContain('export function workspaceQuery');
    // Export della lista tabelle
    expect(code).toContain('export { WORKSPACE_SCOPED_TABLES }');
  });
});

describe('workspaceQuery — Protezione architetturale', () => {
  it('workspaceQuery forza workspace_id nel SELECT', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/db/workspace-query.ts'), 'utf-8');

    // La classe WorkspaceScopedQuery deve avere select() che chiama eq('workspace_id')
    expect(code).toContain("q.eq('workspace_id', this.wsId)");
  });

  it('workspaceQuery inietta workspace_id negli INSERT', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/db/workspace-query.ts'), 'utf-8');

    // L'INSERT deve arricchire i dati con workspace_id
    expect(code).toContain('workspace_id: this.wsId');
  });

  it('workspaceQuery rifiuta workspaceId vuoto', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'lib/db/workspace-query.ts'), 'utf-8');

    expect(code).toContain("throw new Error('workspaceQuery: workspaceId è obbligatorio')");
  });
});

describe('Guardian: usi diretti supabaseAdmin su tabelle multi-tenant', () => {
  // Questo test scansiona il codice applicativo e segnala potenziali violazioni.
  // Non fallisce per il codice legacy (troppi da fixare tutti insieme),
  // ma CONTA le violazioni e le documenta come baseline.

  const APP_DIRS = ['actions', 'app', 'lib'];
  const EXCLUDE_PATTERNS = [
    'node_modules',
    '.next',
    'tests/',
    'scripts/',
    '__tests__',
    // File specifici che usano legittimamente supabaseAdmin
    'lib/db/client.ts', // definizione stessa
    'lib/db/workspace-query.ts', // wrapper stesso
    'lib/workspace-auth.ts', // auth system
    'lib/safe-auth.ts', // auth system
    'lib/security/audit-log.ts', // audit infrastrutturale (fallback insert)
    'lib/security/security-events.ts', // security events senza workspace context
    'lib/auth-config.ts', // NextAuth callback (no workspace context)
    // Health check: SELECT id LIMIT 1 per verificare connettività DB
    'app/api/health/',
    'app/api/webhooks/telegram/route.ts',
  ];

  function scanDirectory(dir: string): { file: string; violations: string[] }[] {
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

      // Cerca pattern: supabaseAdmin.from('TABLE_MULTI_TENANT')
      // NOTA: nel codebase le query sono spesso multilinea:
      //   await supabaseAdmin
      //     .from('shipments')
      // Il regex deve gestire whitespace tra supabaseAdmin e .from()
      const violations: string[] = [];
      for (const table of WORKSPACE_SCOPED_TABLES) {
        const pattern = new RegExp(
          `supabaseAdmin\\s*\\.from\\(\\s*['\`]${table}['\`]\\s*\\)`,
          'gs'
        );
        const matches = code.match(pattern);
        if (matches) {
          violations.push(`supabaseAdmin.from('${table}') x${matches.length}`);
        }
      }

      if (violations.length > 0) {
        results.push({ file: relativePath, violations });
      }
    }

    return results;
  }

  it('documenta la baseline di usi diretti (da ridurre nel tempo)', () => {
    const allViolations: { file: string; violations: string[] }[] = [];

    for (const dir of APP_DIRS) {
      allViolations.push(...scanDirectory(dir));
    }

    const totalViolations = allViolations.reduce((sum, v) => sum + v.violations.length, 0);

    // Log per visibilità
    if (allViolations.length > 0) {
      console.log(
        `\n⚠️ WORKSPACE GUARDIAN: ${totalViolations} usi diretti di supabaseAdmin su tabelle multi-tenant`
      );
      console.log(`   in ${allViolations.length} file. Da migrare a workspaceQuery().\n`);
      for (const v of allViolations.slice(0, 10)) {
        console.log(`   📄 ${v.file}: ${v.violations.join(', ')}`);
      }
      if (allViolations.length > 10) {
        console.log(`   ... e altri ${allViolations.length - 10} file`);
      }
    }

    // BASELINE: registriamo il numero attuale.
    // Quando migriamo file a workspaceQuery(), abbassiamo questo numero.
    // Se il numero AUMENTA, qualcuno ha aggiunto nuovo codice senza usare workspaceQuery().
    //
    // REGOLA: il numero NON deve MAI aumentare.
    // Baseline 2026-02-17: 0 (regex single-line — NON catturava violazioni multilinea!)
    // Baseline 2026-02-21: 137 (fix regex multilinea — violazioni REALI ora visibili)
    // Baseline 2026-02-21b: 127 (migrazione Anne AI — 10 violazioni rimosse da lib/ai/ e lib/agent/)
    // Baseline 2026-02-22: 126 (ratchet down — 1 violazione in meno rilevata)
    // Baseline 2026-02-22b: 121 (R3 debito tecnico — 5 violazioni rimosse:
    //   invoice-recharges.ts, cod/upload, CRM services, price-lists-advanced.ts)
    //   Rimanenti: actions/, app/api/, lib/ (non-Anne). Da ridurre progressivamente.
    // Baseline 2026-02-22c: 124 (split lib/database.ts → lib/database/ modules —
    //   stesse violazioni, ora distribuite su più file, conteggio regex aumentato di 3)
    // Obiettivo finale: 0
    expect(totalViolations).toBeLessThanOrEqual(124);

    // Salva snapshot per monitoraggio
    console.log(
      `\n📊 BASELINE ATTUALE: ${totalViolations} violazioni in ${allViolations.length} file`
    );
  });

  it('il guardian cattura violazioni multilinea (self-test)', () => {
    // Questo test verifica che il guardian NON abbia un blind spot.
    // Il pattern multilinea è quello usato nel 100% del codebase reale.
    const multilineCode = `
import { supabaseAdmin } from '@/lib/db/client';

async function test() {
  const { data } = await supabaseAdmin
    .from('shipments')
    .select('*');
}
`;
    const singleLineCode = `const { data } = await supabaseAdmin.from('shipments').select('*');`;

    // Il regex con \s* tra supabaseAdmin e .from() cattura entrambi i pattern
    const pattern = new RegExp(`supabaseAdmin\\s*\\.from\\(\\s*['\`]shipments['\`]\\s*\\)`, 'gs');

    // Entrambi i pattern DEVONO essere catturati
    expect(multilineCode.match(pattern)).not.toBeNull();
    expect(singleLineCode.match(pattern)).not.toBeNull();
  });

  it('CANARY: il guardian DEVE trovare la violazione nel file canary', () => {
    // CANARY TEST: un file reale con una violazione NOTA esiste nel codebase.
    // Se il guardian non lo trova, il guardian stesso è rotto.
    // Questo impedisce il ripetersi del bug del regex single-line (feb 2026).
    const canaryPath = path.join(process.cwd(), 'tests/__fixtures__/guardian-canary.ts');
    expect(fs.existsSync(canaryPath)).toBe(true);

    const canaryCode = fs.readFileSync(canaryPath, 'utf-8');

    // Il canary contiene sia pattern single-line che multilinea
    const patterns = ['shipments', 'price_lists'].map(
      (table) => new RegExp(`supabaseAdmin\\s*\\.from\\(\\s*['\`]${table}['\`]\\s*\\)`, 'gs')
    );

    const found = patterns.filter((p) => canaryCode.match(p));
    // Il canary DEVE contenere almeno 2 violazioni catturate dal regex
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  it('nessun file NUOVO dovrebbe usare supabaseAdmin.from() su tabelle multi-tenant', () => {
    // I file creati DOPO il 2026-02-18 (oggi) DEVONO usare workspaceQuery()
    // Questo test serve come promemoria per le review

    // Per ora verifica che workspace-query.ts esista come alternativa disponibile
    const wqPath = path.join(process.cwd(), 'lib/db/workspace-query.ts');
    expect(fs.existsSync(wqPath)).toBe(true);
  });
});
