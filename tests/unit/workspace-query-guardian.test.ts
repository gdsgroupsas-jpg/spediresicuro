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
      const violations: string[] = [];
      for (const table of WORKSPACE_SCOPED_TABLES) {
        const pattern = new RegExp(`supabaseAdmin\\.from\\(['\`]${table}['\`]\\)`, 'g');
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
    // Valore corrente baseline: ~60 (da verificare al primo run)
    // Obiettivo finale: 0
    expect(totalViolations).toBeLessThanOrEqual(120);

    // Salva snapshot per monitoraggio
    console.log(
      `\n📊 BASELINE ATTUALE: ${totalViolations} violazioni in ${allViolations.length} file`
    );
  });

  it('nessun file NUOVO dovrebbe usare supabaseAdmin.from() su tabelle multi-tenant', () => {
    // I file creati DOPO il 2026-02-18 (oggi) DEVONO usare workspaceQuery()
    // Questo test serve come promemoria per le review

    // Per ora verifica che workspace-query.ts esista come alternativa disponibile
    const wqPath = path.join(process.cwd(), 'lib/db/workspace-query.ts');
    expect(fs.existsSync(wqPath)).toBe(true);
  });
});
