/**
 * Test: Isolamento multi-tenant listini per workspace_id
 *
 * Bug: la tab "Listini Master" non filtrava per workspace_id,
 * mostrando al superadmin i listini di TUTTI i workspace (inclusi reseller).
 * Anche la tab "Listini Prezzi" usava una query OR che poteva matchare
 * listini legacy con workspace_id NULL.
 *
 * Fix:
 * - listMasterPriceListsAction: aggiunto .eq('workspace_id', workspaceId)
 * - listPriceListsAction: rimossa clausola OR legacy, filtro solo per workspace_id
 *
 * Business rule: ogni utente vede SOLO i listini del proprio workspace.
 * Nessun cross-workspace access, neanche per il superadmin.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ACTIONS_PATH = path.join(process.cwd(), 'actions/price-lists.ts');

describe('Isolamento multi-tenant listini', () => {
  let code: string;

  it('il file actions/price-lists.ts esiste', () => {
    expect(fs.existsSync(ACTIONS_PATH)).toBe(true);
    code = fs.readFileSync(ACTIONS_PATH, 'utf-8');
  });

  describe('listMasterPriceListsAction', () => {
    it('filtra per workspace_id del superadmin', () => {
      // La query deve includere .eq('workspace_id', workspaceId)
      // Cerchiamo nel blocco della funzione
      const fnStart = code.indexOf('export async function listMasterPriceListsAction');
      expect(fnStart).toBeGreaterThan(-1);

      const fnBlock = code.substring(fnStart, fnStart + 2000);

      // DEVE avere filtro workspace_id
      expect(fnBlock).toContain("eq('workspace_id', workspaceId)");

      // DEVE avere filtro master_list_id IS NULL
      expect(fnBlock).toContain("is('master_list_id', null)");
    });

    it('NON usa query globale senza filtro workspace', () => {
      const fnStart = code.indexOf('export async function listMasterPriceListsAction');
      const fnEnd = code.indexOf('export async function', fnStart + 1);
      const fnBlock = code.substring(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);

      // Non deve fare select * senza filtro workspace
      // Verifica che non c'è .is('master_list_id', null) SENZA .eq('workspace_id')
      // sulla stessa catena di query
      const masterListQuery = fnBlock.indexOf(".is('master_list_id', null)");
      if (masterListQuery > -1) {
        // Nella stessa catena (entro 200 chars) deve esserci workspace_id
        const queryContext = fnBlock.substring(
          Math.max(0, masterListQuery - 200),
          masterListQuery + 200
        );
        expect(queryContext).toContain('workspace_id');
      }
    });
  });

  describe('listPriceListsAction — admin path', () => {
    it('filtra per workspace_id senza clausola OR legacy', () => {
      const fnStart = code.indexOf('export async function listPriceListsAction');
      expect(fnStart).toBeGreaterThan(-1);

      const fnEnd = code.indexOf('export async function', fnStart + 1);
      const fnBlock = code.substring(fnStart, fnEnd);

      // Il path admin (isAdmin) deve filtrare per workspace_id
      const adminBlock = fnBlock.substring(
        fnBlock.indexOf('if (isAdmin)'),
        fnBlock.indexOf('// Reseller') > 0
          ? fnBlock.indexOf('// Reseller')
          : fnBlock.indexOf('Reseller/altri') > 0
            ? fnBlock.indexOf('Reseller/altri')
            : fnBlock.length
      );

      // DEVE avere filtro workspace_id
      expect(adminBlock).toContain("eq('workspace_id', workspaceId)");

      // NON deve avere la clausola OR legacy con workspace_id.is.null
      expect(adminBlock).not.toContain('workspace_id.is.null');
    });
  });

  describe('Sicurezza: nessun listino con workspace_id NULL dopo backfill', () => {
    it('le query non prevedono workspace_id NULL come caso normale', () => {
      const fnStart = code.indexOf('export async function listMasterPriceListsAction');
      const fnEnd = code.indexOf('export async function', fnStart + 1);
      const fnBlock = code.substring(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);

      // La query master NON deve avere fallback per workspace_id NULL
      expect(fnBlock).not.toContain('workspace_id.is.null');
    });
  });
});
