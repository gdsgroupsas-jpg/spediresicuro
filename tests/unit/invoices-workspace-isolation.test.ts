/**
 * Test: Isolamento multi-tenant Fatture
 *
 * Verifica che getInvoices():
 * 1. Usa getWorkspaceAuth per autenticazione
 * 2. Filtra per workspace_id diretto (colonna su invoices)
 * 3. NON ritorna tutte le fatture senza filtro
 * 4. getUserInvoices filtra per user_id (già ok)
 * 5. generateInvoiceForShipment include workspace_id nell'INSERT
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

    it('filtra per workspace_id diretto (no bridge)', () => {
      const fnStart = code.indexOf('export async function getInvoices');
      const fnEnd = code.indexOf('export async function', fnStart + 1);
      const fnBlock = code.substring(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);

      // Deve usare filtro diretto workspace_id
      expect(fnBlock).toContain("eq('workspace_id'");
      // NON deve più usare workspace_members bridge
      expect(fnBlock).not.toContain('workspace_members');
      expect(fnBlock).not.toContain('memberIds');
    });

    it('NON fa select * senza filtro su invoices', () => {
      const fnStart = code.indexOf('export async function getInvoices');
      const fnEnd = code.indexOf('export async function', fnStart + 1);
      const fnBlock = code.substring(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);

      // La query DEVE avere un filtro workspace_id
      expect(fnBlock).toContain(".eq('workspace_id");
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

  describe('generateInvoiceForShipment', () => {
    it('include workspace_id nell INSERT fattura', () => {
      const fnStart = code.indexOf('export async function generateInvoiceForShipment');
      expect(fnStart).toBeGreaterThan(-1);

      const fnEnd = code.indexOf('export async function', fnStart + 1);
      const fnBlock = code.substring(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);

      // Deve passare workspace_id nella insert della fattura
      expect(fnBlock).toContain('workspace_id');
    });
  });
});
