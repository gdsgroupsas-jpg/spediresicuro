/**
 * Test: Isolamento multi-tenant Fatture
 *
 * Verifica che getInvoices():
 * 1. Usa getWorkspaceAuth per autenticazione
 * 2. Filtra per workspace tramite membership (workspace_members)
 * 3. NON ritorna tutte le fatture senza filtro
 * 4. getUserInvoices filtra per user_id (già ok)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ACTIONS_PATH = path.join(process.cwd(), 'app/actions/invoices.ts');

describe('Fatture — isolamento multi-tenant', () => {
  let code: string;

  it('il file actions/invoices.ts esiste', () => {
    expect(fs.existsSync(ACTIONS_PATH)).toBe(true);
    code = fs.readFileSync(ACTIONS_PATH, 'utf-8');
  });

  describe('getInvoices (admin)', () => {
    it('importa getWorkspaceAuth', () => {
      expect(code).toContain('import { getWorkspaceAuth }');
    });

    it('usa getWorkspaceAuth nella funzione', () => {
      const fnStart = code.indexOf('export async function getInvoices');
      expect(fnStart).toBeGreaterThan(-1);

      const fnEnd = code.indexOf('export async function', fnStart + 1);
      const fnBlock = code.substring(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);

      expect(fnBlock).toContain('getWorkspaceAuth');
    });

    it('filtra per workspace via workspace_members', () => {
      const fnStart = code.indexOf('export async function getInvoices');
      const fnEnd = code.indexOf('export async function', fnStart + 1);
      const fnBlock = code.substring(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);

      // Deve fare query su workspace_members per ottenere i member ids
      expect(fnBlock).toContain('workspace_members');
      expect(fnBlock).toContain('workspace_id');
    });

    it('usa .in(user_id, memberIds) per filtrare fatture', () => {
      const fnStart = code.indexOf('export async function getInvoices');
      const fnEnd = code.indexOf('export async function', fnStart + 1);
      const fnBlock = code.substring(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);

      expect(fnBlock).toContain("in('user_id'");
    });

    it('NON fa select * senza filtro su invoices', () => {
      const fnStart = code.indexOf('export async function getInvoices');
      const fnEnd = code.indexOf('export async function', fnStart + 1);
      const fnBlock = code.substring(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);

      // La query NON deve essere solo .select().order().limit() senza filtro
      // Deve avere ALMENO un .in() o .eq() per filtrare
      const hasFilter = fnBlock.includes('.in(') || fnBlock.includes(".eq('workspace_id");
      expect(hasFilter).toBe(true);
    });

    it('ritorna errore se workspace non trovato', () => {
      const fnStart = code.indexOf('export async function getInvoices');
      const fnEnd = code.indexOf('export async function', fnStart + 1);
      const fnBlock = code.substring(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);

      expect(fnBlock).toContain('Non autenticato');
    });
  });

  describe('getUserInvoices (utente)', () => {
    it('filtra per user_id (già corretto)', () => {
      const fnStart = code.indexOf('export async function getUserInvoices');
      expect(fnStart).toBeGreaterThan(-1);

      const fnEnd = code.indexOf('export async function', fnStart + 1);
      const fnBlock = code.substring(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);

      expect(fnBlock).toContain("eq('user_id'");
    });
  });
});
