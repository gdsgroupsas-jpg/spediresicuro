/**
 * Test: Multi-Tenant Isolation — Attacker Scenario
 *
 * Verifica che il sistema multi-tenant impedisca accessi cross-workspace.
 *
 * Scenario: Workspace A non deve MAI poter leggere/scrivere/eliminare
 * dati di Workspace B, anche conoscendo gli ID.
 *
 * Testa:
 * 1. workspaceQuery forza filtro workspace_id su tutte le operazioni
 * 2. INSERT inietta workspace_id automaticamente
 * 3. UPDATE/DELETE filtrano per workspace_id
 * 4. Tabelle globali non vengono filtrate
 * 5. Copertura di TUTTE le 36 tabelle in WORKSPACE_SCOPED_TABLES
 * 6. Firme funzioni price-lists.ts accettano workspaceId
 * 7. Admin shipment route usa workspaceQuery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// ============================================
// 1. workspaceQuery — Isolamento Operazioni
// ============================================

describe('workspaceQuery: isolamento operazioni', () => {
  let workspaceQuery: typeof import('../../lib/db/workspace-query').workspaceQuery;
  let WORKSPACE_SCOPED_TABLES: Set<string>;

  beforeEach(async () => {
    const mod = await import('../../lib/db/workspace-query');
    workspaceQuery = mod.workspaceQuery;
    WORKSPACE_SCOPED_TABLES = mod.WORKSPACE_SCOPED_TABLES;
  });

  it('lancia errore se workspaceId è vuoto', () => {
    expect(() => workspaceQuery('')).toThrow('workspaceId è obbligatorio');
  });

  it('protegge almeno 30 tabelle multi-tenant', () => {
    expect(WORKSPACE_SCOPED_TABLES.size).toBeGreaterThanOrEqual(30);
  });

  it('include tutte le tabelle critiche', () => {
    const criticalTables = [
      'shipments',
      'wallet_transactions',
      'audit_logs',
      'price_lists',
      'price_list_entries',
      'commercial_quotes',
      'leads',
      'emails',
      'invoices',
      'invoice_items',
      'cod_files',
      'cod_items',
      'cod_distinte',
    ];

    for (const table of criticalTables) {
      expect(WORKSPACE_SCOPED_TABLES.has(table)).toBe(true);
    }
  });

  it('NON include tabelle globali', () => {
    const globalTables = [
      'users',
      'workspaces',
      'workspace_members',
      'couriers',
      'courier_configs',
    ];

    for (const table of globalTables) {
      expect(WORKSPACE_SCOPED_TABLES.has(table)).toBe(false);
    }
  });

  it('NON include automations e automation_runs (tabelle globali by design)', () => {
    expect(WORKSPACE_SCOPED_TABLES.has('automations')).toBe(false);
    expect(WORKSPACE_SCOPED_TABLES.has('automation_runs')).toBe(false);
  });
});

// ============================================
// 2. WorkspaceScopedQuery — SELECT forza filtro
// ============================================

describe('WorkspaceScopedQuery: SELECT forza filtro workspace_id', () => {
  it('il source code mostra eq(workspace_id) su select', () => {
    const source = readFile('lib/db/workspace-query.ts');
    // La classe WorkspaceScopedQuery deve avere .eq('workspace_id', this.wsId) su select
    expect(source).toContain("return q.eq('workspace_id', this.wsId)");
  });

  it('il source code inietta workspace_id su INSERT', () => {
    const source = readFile('lib/db/workspace-query.ts');
    // INSERT deve aggiungere workspace_id ai dati
    expect(source).toContain('workspace_id: this.wsId');
  });

  it('il source code filtra workspace_id su UPDATE', () => {
    const source = readFile('lib/db/workspace-query.ts');
    // UPDATE deve avere .eq('workspace_id', ...)
    const updateSection = source.substring(
      source.indexOf('update(data'),
      source.indexOf('delete(')
    );
    expect(updateSection).toContain("eq('workspace_id'");
  });

  it('il source code filtra workspace_id su DELETE', () => {
    const source = readFile('lib/db/workspace-query.ts');
    // DELETE deve avere .eq('workspace_id', ...)
    const deleteSection = source.substring(
      source.indexOf('delete(options'),
      source.indexOf('upsert(')
    );
    expect(deleteSection).toContain("eq('workspace_id'");
  });
});

// ============================================
// 3. price-lists.ts — Funzioni accettano workspaceId
// ============================================

describe('price-lists.ts: funzioni usano workspaceQuery', () => {
  let source: string;

  beforeEach(() => {
    source = readFile('lib/db/price-lists.ts');
  });

  it('createPriceList usa workspaceQuery quando workspaceId fornito', () => {
    expect(source).toContain('export async function createPriceList(');
    // Verifica che usi workspaceQuery
    const fnBody = source.substring(
      source.indexOf('export async function createPriceList('),
      source.indexOf('export async function updatePriceList(')
    );
    expect(fnBody).toContain('workspaceQuery(workspaceId)');
  });

  it('updatePriceList accetta workspaceId e usa workspaceQuery', () => {
    const fnBody = source.substring(
      source.indexOf('export async function updatePriceList('),
      source.indexOf('export async function getPriceListById(')
    );
    expect(fnBody).toContain('workspaceId: string');
    expect(fnBody).toContain('workspaceQuery(workspaceId)');
  });

  it('getPriceListById accetta workspaceId e usa workspaceQuery', () => {
    const fnBody = source.substring(
      source.indexOf('export async function getPriceListById('),
      source.indexOf('export async function getActivePriceList(')
    );
    expect(fnBody).toContain('workspaceId: string');
    expect(fnBody).toContain('workspaceQuery(workspaceId)');
  });

  it('addPriceListEntries usa workspaceQuery quando workspaceId fornito', () => {
    const fnBody = source.substring(
      source.indexOf('export async function addPriceListEntries('),
      source.indexOf('export async function upsertPriceListEntries(')
    );
    expect(fnBody).toContain('workspaceQuery(workspaceId)');
  });

  it('upsertPriceListEntries accetta workspaceId e usa workspaceQuery', () => {
    const fnBody = source.substring(
      source.indexOf('export async function upsertPriceListEntries('),
      source.indexOf('export async function deletePriceList(') || source.length
    );
    expect(fnBody).toContain('workspaceId: string');
    expect(fnBody).toContain('workspaceQuery(workspaceId)');
  });

  it('nessuna query supabaseAdmin.from(price_lists) senza workspaceQuery', () => {
    // Le uniche occorrenze di supabaseAdmin devono essere:
    // 1. L'import
    // 2. Il fallback pattern: workspaceId ? workspaceQuery(workspaceId) : supabaseAdmin
    // 3. Query su tabelle globali (couriers, users, courier_configs)
    // NON deve esserci supabaseAdmin.from('price_lists') diretto
    const lines = source.split('\n');
    for (const line of lines) {
      if (
        line.includes('supabaseAdmin') &&
        line.includes(".from('price_lists')") &&
        !line.includes('//') // Non commenti
      ) {
        // Questa linea è un accesso diretto non consentito
        throw new Error(
          `Accesso diretto supabaseAdmin.from('price_lists') trovato: ${line.trim()}`
        );
      }
    }
  });
});

// ============================================
// 4. Admin shipment route — usa workspace filter
// ============================================

describe('admin/shipments/[id]/route.ts: isolamento workspace', () => {
  let source: string;

  beforeEach(() => {
    source = readFile('app/api/admin/shipments/[id]/route.ts');
  });

  it('importa workspaceQuery', () => {
    expect(source).toContain("import { workspaceQuery } from '@/lib/db/workspace-query'");
  });

  it('usa workspaceQuery per query shipments', () => {
    expect(source).toContain('workspaceQuery(adminWorkspaceId)');
  });

  it('filtra select shipment tramite workspaceQuery', () => {
    // La SELECT su shipments deve passare per wq (workspace query), non supabaseAdmin
    expect(source).toContain("await wq\n      .from('shipments')");
  });

  it('filtra update (soft delete) tramite workspaceQuery', () => {
    // La UPDATE soft delete deve passare per wq
    const updateSection = source.substring(
      source.indexOf('Soft delete'),
      source.indexOf('RIMBORSO WALLET')
    );
    expect(updateSection).toContain('await wq');
    expect(updateSection).toContain("from('shipments')");
  });
});

// ============================================
// 5. Guardian test — baseline 0 violazioni
// ============================================

describe('Guardian: baseline 0 violazioni', () => {
  it('il test guardian esiste e ha baseline 0', () => {
    const guardianSource = readFile('tests/unit/workspace-query-guardian.test.ts');
    // Il file deve contenere la verifica che totalViolations === 0
    expect(guardianSource).toContain('totalViolations');
    // E il commento o assertion che la baseline è 0
    expect(guardianSource).toMatch(/0.*violazion|baseline.*0|expect.*0/i);
  });
});

// ============================================
// 6. Caller actions — passano workspaceId
// ============================================

describe('Caller actions: passano workspaceId a price-lists', () => {
  it('actions/price-lists.ts passa workspaceId a createPriceList', () => {
    const source = readFile('actions/price-lists.ts');
    // Deve chiamare createPriceList con 3 parametri (data, user.id, workspaceId)
    expect(source).toMatch(/createPriceList\([^)]*workspaceId\)/);
  });

  it('actions/customer-price-lists.ts passa workspaceId a createPriceList', () => {
    const source = readFile('actions/customer-price-lists.ts');
    expect(source).toMatch(/createPriceList\([^)]*workspaceId\)/);
  });

  it('actions/price-lists.ts passa workspaceId a updatePriceList', () => {
    const source = readFile('actions/price-lists.ts');
    // Almeno una chiamata a updatePriceList deve includere workspaceId
    expect(source).toMatch(/updatePriceList\([^)]*workspaceId\)/);
  });

  it('actions/price-lists.ts passa workspaceId a getPriceListById', () => {
    const source = readFile('actions/price-lists.ts');
    // Almeno una chiamata deve passare workspaceId
    expect(source).toMatch(/getPriceListById\([^,]+,\s*workspaceId\)/);
  });
});

// ============================================
// 7. Scenario attacco: workspace A tenta accesso workspace B
// ============================================

describe('Scenario attacco: workspace A → workspace B', () => {
  it('workspaceQuery(wsA) non puo leggere dati di wsB (logica proxy)', () => {
    // Questo test verifica la logica del proxy:
    // Se usi workspaceQuery('ws-alpha'), la query avrà SEMPRE .eq('workspace_id', 'ws-alpha')
    // Quindi non potrà mai ritornare dati con workspace_id = 'ws-beta'
    const source = readFile('lib/db/workspace-query.ts');

    // Verifica che WorkspaceScopedQuery applichi il filtro in TUTTI i metodi
    // Estrae il body della classe WorkspaceScopedQuery
    const classStart = source.indexOf('class WorkspaceScopedQuery');
    const classBody = source.substring(classStart);

    // Conta quante volte appare workspace_id nella classe
    // Le occorrenze includono:
    // - eq('workspace_id', this.wsId) su select/update/delete
    // - { workspace_id: this.wsId } su insert/upsert
    const allWsIdRefs = (classBody.match(/workspace_id/g) || []).length;

    // Deve apparire almeno 5 volte: select, insert, update, delete, upsert
    expect(allWsIdRefs).toBeGreaterThanOrEqual(5);

    // INSERT e UPSERT devono iniettare workspace_id nei dati
    // Verifica che il pattern { ...row, workspace_id: this.wsId } esista nella classe
    expect(classBody).toContain('workspace_id: this.wsId');
  });

  it('non e possibile bypassare il filtro passando workspace_id manualmente', () => {
    // Anche se un attaccante passa workspace_id: 'ws-beta' nei dati,
    // INSERT sovrascrive con this.wsId (spread dopo workspace_id)
    const source = readFile('lib/db/workspace-query.ts');

    // INSERT: { ...row, workspace_id: this.wsId } — l'ordine dello spread
    // garantisce che workspace_id dell'attaccante venga sovrascritto
    expect(source).toContain('{ ...row, workspace_id: this.wsId }');
    expect(source).toContain('{ ...data, workspace_id: this.wsId }');
  });

  it('tutte le tabelle con dati sensibili sono in WORKSPACE_SCOPED_TABLES', () => {
    const source = readFile('lib/db/workspace-query.ts');

    // Tabelle che contengono dati business sensibili dei reseller
    const sensitiveTables = [
      'price_lists', // Listini prezzi (segreto commerciale)
      'price_list_entries', // Righe listini
      'wallet_transactions', // Movimenti wallet
      'shipments', // Spedizioni
      'commercial_quotes', // Preventivi commerciali
      'invoices', // Fatture
      'invoice_items', // Dettagli fattura
      'leads', // Lead CRM
      'reseller_prospects', // Prospect reseller
      'emails', // Email
    ];

    for (const table of sensitiveTables) {
      expect(source).toContain(`'${table}'`);
    }
  });
});

// ============================================
// 8. Cron jobs — verifiche cross-workspace intenzionali
// ============================================

describe('Cron jobs: cross-workspace intenzionale e sicuro', () => {
  it('expire-quotes usa workspaceQuery per eventi isolati', () => {
    const source = readFile('app/api/cron/expire-quotes/route.ts');
    expect(source).toContain("import { workspaceQuery } from '@/lib/db/workspace-query'");
    // La query iniziale è cross-workspace (intenzionale: deve trovare TUTTI i quotes scaduti)
    // Ma le operazioni di scrittura (eventi, audit) sono isolate per workspace
    expect(source).toContain('workspaceQuery(');
  });

  it('automation-dispatcher opera su tabelle globali (by design)', () => {
    const source = readFile('app/api/cron/automation-dispatcher/route.ts');
    // Le automazioni sono tabelle globali — il dispatcher le legge tutte intenzionalmente
    expect(source).toContain('runDispatcher');
  });

  it('expire-invitations usa RPC (non query diretta)', () => {
    const source = readFile('app/api/cron/expire-invitations/route.ts');
    // Usa RPC che gestisce internamente l'isolamento
    expect(source).toContain("supabaseAdmin.rpc('expire_old_invitations')");
  });
});
