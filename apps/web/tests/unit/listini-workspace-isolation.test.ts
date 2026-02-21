/**
 * Test: Isolamento multi-tenant listini per workspace_id
 *
 * Bug: la tab "Listini Master" non filtrava per workspace_id,
 * mostrando al superadmin i listini di tutti i workspace.
 *
 * Fix:
 * - listMasterPriceListsAction: filtro .eq('workspace_id', workspaceId)
 * - listPriceListsAction: filtro solo per workspace_id (no OR legacy)
 *
 * Nota refactor:
 * alcune action possono delegare la logica a file *Impl.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ACTIONS_PATH = path.join(process.cwd(), 'actions/price-lists.ts');
const LISTING_IMPL_PATH = path.join(process.cwd(), 'actions/price-lists-listing.impl.ts');

describe('Isolamento multi-tenant listini', () => {
  let code: string;
  let listingImplCode: string | null = null;

  const getFunctionBlock = (functionName: string): string => {
    const fnStart = code.indexOf(`export async function ${functionName}`);
    expect(fnStart).toBeGreaterThan(-1);

    const fnEnd = code.indexOf('export async function', fnStart + 1);
    const fnBlock = code.substring(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);

    const implName = `${functionName}Impl`;
    const delegatesToImpl = fnBlock.includes(`return ${implName}(`);

    if (delegatesToImpl && listingImplCode) {
      const implStart = listingImplCode.indexOf(`export async function ${implName}`);
      expect(implStart).toBeGreaterThan(-1);
      const implEnd = listingImplCode.indexOf('export async function', implStart + 1);
      return listingImplCode.substring(implStart, implEnd > 0 ? implEnd : implStart + 6000);
    }

    return fnBlock;
  };

  it('il file actions/price-lists.ts esiste', () => {
    expect(fs.existsSync(ACTIONS_PATH)).toBe(true);
    code = fs.readFileSync(ACTIONS_PATH, 'utf-8');

    if (fs.existsSync(LISTING_IMPL_PATH)) {
      listingImplCode = fs.readFileSync(LISTING_IMPL_PATH, 'utf-8');
    }
  });

  describe('listMasterPriceListsAction', () => {
    it('filtra per workspace_id del superadmin', () => {
      const fnBlock = getFunctionBlock('listMasterPriceListsAction');

      expect(fnBlock).toContain("eq('workspace_id', workspaceId)");
      expect(fnBlock).toContain("is('master_list_id', null)");
    });

    it('NON usa query globale senza filtro workspace', () => {
      const fnBlock = getFunctionBlock('listMasterPriceListsAction');

      const masterListQuery = fnBlock.indexOf(".is('master_list_id', null)");
      if (masterListQuery > -1) {
        const queryContext = fnBlock.substring(
          Math.max(0, masterListQuery - 200),
          masterListQuery + 200
        );
        expect(queryContext).toContain('workspace_id');
      }
    });
  });

  describe('listPriceListsAction - admin path', () => {
    it('filtra per workspace_id senza clausola OR legacy', () => {
      const fnStart = code.indexOf('export async function listPriceListsAction');
      expect(fnStart).toBeGreaterThan(-1);

      const fnEnd = code.indexOf('export async function', fnStart + 1);
      const fnBlock = code.substring(fnStart, fnEnd);

      const adminBlock = fnBlock.substring(
        fnBlock.indexOf('if (isAdmin)'),
        fnBlock.indexOf('// Reseller') > 0
          ? fnBlock.indexOf('// Reseller')
          : fnBlock.indexOf('Reseller/altri') > 0
            ? fnBlock.indexOf('Reseller/altri')
            : fnBlock.length
      );

      expect(adminBlock).toContain("eq('workspace_id', workspaceId)");
      expect(adminBlock).not.toContain('workspace_id.is.null');
    });
  });

  describe('Sicurezza: nessun listino con workspace_id NULL dopo backfill', () => {
    it('le query non prevedono workspace_id NULL come caso normale', () => {
      const fnBlock = getFunctionBlock('listMasterPriceListsAction');
      expect(fnBlock).not.toContain('workspace_id.is.null');
    });
  });
});
