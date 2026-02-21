/**
 * Test: Isolamento multi-tenant Contrassegni (COD)
 *
 * Verifica che le API COD:
 * 1. /api/cod/items — filtra per workspace_id diretto
 * 2. /api/cod/distinte GET — filtra per workspace_id diretto
 * 3. /api/cod/distinte POST — filtra items per workspace_id + inserisce workspace_id
 * 4. /api/cod/distinte PATCH — filtra per workspace_id
 * 5. /api/cod/distinte DELETE — filtra per workspace_id
 * 6. actions/contrassegni.ts — già filtra per workspace_id (verifica non regredito)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('COD Items API — isolamento multi-tenant', () => {
  const ROUTE_PATH = path.join(process.cwd(), 'app/api/cod/items/route.ts');
  let code: string;

  it('il file route.ts esiste', () => {
    expect(fs.existsSync(ROUTE_PATH)).toBe(true);
    code = fs.readFileSync(ROUTE_PATH, 'utf-8');
  });

  it('usa getWorkspaceAuth per autenticazione', () => {
    expect(code).toContain('getWorkspaceAuth');
  });

  it('richiede workspace_id obbligatorio', () => {
    expect(code).toContain('auth.workspace');
    expect(code).toContain('Workspace non trovato');
  });

  it('filtra cod_items per workspace_id diretto (no bridge)', () => {
    // Deve usare .eq('workspace_id', workspaceId) direttamente sulla query cod_items
    expect(code).toContain("eq('workspace_id', workspaceId)");
    // NON deve più usare workspace_members bridge
    expect(code).not.toContain('workspace_members');
    expect(code).not.toContain('memberIds');
  });
});

describe('COD Distinte API — isolamento multi-tenant', () => {
  const ROUTE_PATH = path.join(process.cwd(), 'app/api/cod/distinte/route.ts');
  let code: string;

  it('il file route.ts esiste', () => {
    expect(fs.existsSync(ROUTE_PATH)).toBe(true);
    code = fs.readFileSync(ROUTE_PATH, 'utf-8');
  });

  it('NON usa workspace_members bridge (pattern diretto)', () => {
    expect(code).not.toContain('workspace_members');
    expect(code).not.toContain('memberIds');
  });

  describe('GET', () => {
    it('filtra distinte per workspace_id diretto', () => {
      const getBlock = code.substring(
        code.indexOf('export async function GET'),
        code.indexOf('export async function PATCH')
      );
      expect(getBlock).toContain("eq('workspace_id', workspaceId)");
    });

    it('ritorna 403 senza workspace', () => {
      const getBlock = code.substring(
        code.indexOf('export async function GET'),
        code.indexOf('export async function PATCH')
      );
      expect(getBlock).toContain('Workspace non trovato');
      expect(getBlock).toContain('403');
    });
  });

  describe('POST', () => {
    it('filtra items per workspace_id diretto', () => {
      const postBlock = code.substring(
        code.indexOf('export async function POST'),
        code.indexOf('export async function GET')
      );
      expect(postBlock).toContain("eq('workspace_id', workspaceId)");
    });

    it('inserisce workspace_id nella nuova distinta', () => {
      const postBlock = code.substring(
        code.indexOf('export async function POST'),
        code.indexOf('export async function GET')
      );
      expect(postBlock).toContain('workspace_id: workspaceId');
    });

    it('ritorna 403 senza workspace', () => {
      const postBlock = code.substring(
        code.indexOf('export async function POST'),
        code.indexOf('export async function GET')
      );
      expect(postBlock).toContain('Workspace non trovato');
    });
  });

  describe('PATCH', () => {
    it('filtra distinta per workspace_id prima di aggiornare', () => {
      const patchBlock = code.substring(
        code.indexOf('export async function PATCH'),
        code.indexOf('export async function DELETE')
      );
      expect(patchBlock).toContain("eq('workspace_id', workspaceId)");
    });

    it('ritorna 403 senza workspace', () => {
      const patchBlock = code.substring(
        code.indexOf('export async function PATCH'),
        code.indexOf('export async function DELETE')
      );
      expect(patchBlock).toContain('Workspace non trovato');
    });
  });

  describe('DELETE', () => {
    it('filtra distinta per workspace_id prima di eliminare', () => {
      const deleteBlock = code.substring(code.indexOf('export async function DELETE'));
      expect(deleteBlock).toContain("eq('workspace_id', workspaceId)");
    });

    it('filtra anche cod_items per workspace_id nello scollega', () => {
      const deleteBlock = code.substring(code.indexOf('export async function DELETE'));
      // Deve avere workspace_id sia su cod_items.update che su cod_distinte.delete
      const wsMatches = deleteBlock.match(/eq\('workspace_id', workspaceId\)/g);
      expect(wsMatches).not.toBeNull();
      expect(wsMatches!.length).toBeGreaterThanOrEqual(2);
    });

    it('ritorna 403 senza workspace', () => {
      const deleteBlock = code.substring(code.indexOf('export async function DELETE'));
      expect(deleteBlock).toContain('Workspace non trovato');
    });
  });
});

describe('Contrassegni Server Actions — isolamento pre-esistente', () => {
  const ACTIONS_PATH = path.join(process.cwd(), 'actions/contrassegni.ts');
  let code: string;

  it('il file actions/contrassegni.ts esiste', () => {
    expect(fs.existsSync(ACTIONS_PATH)).toBe(true);
    code = fs.readFileSync(ACTIONS_PATH, 'utf-8');
  });

  it('markContrassegnoInCarica filtra per workspace_id', () => {
    const fnBlock = code.substring(
      code.indexOf('export async function markContrassegnoInCarica'),
      code.indexOf('export async function markContrassegnoEvaso')
    );
    expect(fnBlock).toContain('workspace_id');
  });

  it('markContrassegnoEvaso filtra per workspace_id', () => {
    const fnBlock = code.substring(code.indexOf('export async function markContrassegnoEvaso'));
    expect(fnBlock).toContain('workspace_id');
  });
});
