/**
 * Test: Isolamento multi-tenant Contrassegni (COD)
 *
 * Verifica che le API COD:
 * 1. /api/cod/items — filtrano per workspace_members
 * 2. /api/cod/distinte GET — filtrano per workspace_members
 * 3. /api/cod/distinte POST — validano ownership workspace
 * 4. actions/contrassegni.ts — già filtra per workspace_id (verifica non regredito)
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

  it('filtra per workspace_members', () => {
    expect(code).toContain('workspace_members');
    expect(code).toContain("eq('workspace_id', workspaceId)");
  });

  it('usa .in(client_id, memberIds) per filtrare cod_items', () => {
    expect(code).toContain("in('client_id', memberIds)");
  });
});

describe('COD Distinte API — isolamento multi-tenant', () => {
  const ROUTE_PATH = path.join(process.cwd(), 'app/api/cod/distinte/route.ts');
  let code: string;

  it('il file route.ts esiste', () => {
    expect(fs.existsSync(ROUTE_PATH)).toBe(true);
    code = fs.readFileSync(ROUTE_PATH, 'utf-8');
  });

  it('GET: filtra distinte per workspace_members', () => {
    // Il blocco GET deve avere filtro workspace
    const getBlock = code.substring(
      code.indexOf('export async function GET'),
      code.indexOf('export async function PATCH')
    );
    expect(getBlock).toContain('workspace_members');
    expect(getBlock).toContain("in('client_id', memberIds)");
  });

  it('POST: valida ownership items per workspace', () => {
    const postBlock = code.substring(
      code.indexOf('export async function POST'),
      code.indexOf('export async function GET')
    );
    expect(postBlock).toContain('workspace_members');
    expect(postBlock).toContain("in('client_id', memberIds)");
  });

  it('GET: ritorna 403 senza workspace', () => {
    const getBlock = code.substring(
      code.indexOf('export async function GET'),
      code.indexOf('export async function PATCH')
    );
    expect(getBlock).toContain('Workspace non trovato');
    expect(getBlock).toContain('403');
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
