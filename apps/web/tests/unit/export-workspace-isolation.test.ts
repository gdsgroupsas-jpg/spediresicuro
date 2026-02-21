/**
 * Test: Isolamento multi-tenant Export Spedisci.Online
 *
 * Verifica che l'endpoint /api/export/spediscionline:
 * 1. Richieda workspace_id obbligatorio (403 se mancante)
 * 2. Filtri le spedizioni per workspace_id
 * 3. NON usi auth.admin.listUsers() (information disclosure)
 * 4. NON esporti tutto se userId è null
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROUTE_PATH = path.join(process.cwd(), 'app/api/export/spediscionline/route.ts');

describe('Export Spedisci.Online — isolamento multi-tenant', () => {
  let code: string;

  it('il file route.ts esiste', () => {
    expect(fs.existsSync(ROUTE_PATH)).toBe(true);
    code = fs.readFileSync(ROUTE_PATH, 'utf-8');
  });

  it('usa getWorkspaceAuth per autenticazione', () => {
    expect(code).toContain('getWorkspaceAuth');
  });

  it('richiede workspace_id obbligatorio con 403 se mancante', () => {
    expect(code).toContain('context.workspace');
    expect(code).toContain('403');
  });

  it('filtra spedizioni per workspace_id', () => {
    // La query Supabase deve includere .eq('workspace_id', workspaceId)
    expect(code).toContain("eq('workspace_id', workspaceId)");
  });

  it('NON usa auth.admin.listUsers (information disclosure)', () => {
    expect(code).not.toContain('auth.admin.listUsers');
    expect(code).not.toContain('listUsers');
  });

  it('NON ha funzione getSupabaseUserIdFromEmail (rimossa)', () => {
    expect(code).not.toContain('getSupabaseUserIdFromEmail');
  });

  it('NON ha fallback che esporta tutto senza filtro', () => {
    // Non deve mai esportare senza filtro workspace
    expect(code).not.toContain('esporto tutte le spedizioni pending');
  });

  it('NON usa user_profiles per lookup utente', () => {
    // Il vecchio codice cercava in user_profiles — non più necessario
    expect(code).not.toContain("from('user_profiles')");
  });
});
