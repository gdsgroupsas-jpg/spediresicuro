/**
 * Test: Isolamento multi-tenant Ricerca Destinatari
 *
 * Verifica che /api/recipients/search:
 * 1. Usa requireWorkspaceAuth (non getSafeAuth)
 * 2. Filtra per workspace_id in ENTRAMBE le query (recenti + ILIKE)
 * 3. Filtra anche per user_id (doppio filtro)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROUTE_PATH = path.join(process.cwd(), 'app/api/recipients/search/route.ts');

describe('Recipients Search — isolamento multi-tenant', () => {
  let code: string;

  it('il file route.ts esiste', () => {
    expect(fs.existsSync(ROUTE_PATH)).toBe(true);
    code = fs.readFileSync(ROUTE_PATH, 'utf-8');
  });

  it('usa requireWorkspaceAuth per autenticazione', () => {
    expect(code).toContain('requireWorkspaceAuth');
  });

  it('estrae workspaceId dal contesto workspace', () => {
    expect(code).toContain('context.workspace.id');
  });

  it('la query "recenti" filtra per workspace_id', () => {
    // Prima query (query.length < 2): deve avere workspace_id
    const firstQueryBlock = code.substring(code.indexOf('query.length < 2'), code.indexOf('// 4.'));
    expect(firstQueryBlock).toContain("eq('workspace_id', workspaceId)");
  });

  it('la query ILIKE filtra per workspace_id', () => {
    // Seconda query (ILIKE): deve avere workspace_id
    const secondQueryBlock = code.substring(code.indexOf('// 4.'), code.indexOf('// 5.'));
    expect(secondQueryBlock).toContain("eq('workspace_id', workspaceId)");
  });

  it('mantiene anche il filtro user_id (doppio filtro)', () => {
    // Entrambe le query devono filtrare per user_id E workspace_id
    const queryBlocks = code.match(/\.eq\('user_id', userId\)/g);
    expect(queryBlocks).not.toBeNull();
    expect(queryBlocks!.length).toBeGreaterThanOrEqual(2);

    const wsBlocks = code.match(/\.eq\('workspace_id', workspaceId\)/g);
    expect(wsBlocks).not.toBeNull();
    expect(wsBlocks!.length).toBeGreaterThanOrEqual(2);
  });

  it('NON espone dati senza filtro workspace', () => {
    // Non ci devono essere query su shipments senza workspace_id
    // Cerchiamo .from('shipments') e verifichiamo che dopo c'è sempre workspace_id
    const fromShipments = code.split(".from('shipments')");
    // Ogni blocco dopo .from('shipments') deve contenere workspace_id
    for (let i = 1; i < fromShipments.length; i++) {
      const block = fromShipments[i].substring(0, 500);
      expect(block).toContain('workspace_id');
    }
  });
});
