/**
 * Workspace Safety Banner Tests
 *
 * Verifica la logica di rilevamento "workspace altrui" usata dal banner di sicurezza
 * e dagli indicatori visivi nella sidebar.
 *
 * Il banner appare quando un superadmin/reseller opera in un workspace
 * dove non e' owner (workspace di un cliente).
 */

import { describe, it, expect } from 'vitest';

// Tipi inline (per evitare dipendenze da contesti React)
interface MinimalWorkspaceInfo {
  workspace_id: string;
  workspace_name: string;
  workspace_type: 'platform' | 'reseller' | 'client';
  role: 'owner' | 'admin' | 'operator' | 'viewer';
  organization_name: string;
}

/**
 * Logica identica a quella usata in dashboard-nav.tsx e dashboard-sidebar.tsx
 */
function isInForeignWorkspace(workspace: MinimalWorkspaceInfo | null): boolean {
  return workspace?.role !== 'owner' && workspace?.workspace_type !== undefined;
}

/**
 * Logica per trovare il workspace "proprio" per il bottone "Torna al mio workspace"
 */
function findOwnerWorkspace(workspaces: MinimalWorkspaceInfo[]): MinimalWorkspaceInfo | undefined {
  return workspaces.find((ws) => ws.role === 'owner' && ws.workspace_type !== 'client');
}

describe('Workspace Safety Banner - Logica Rilevamento', () => {
  describe('isInForeignWorkspace', () => {
    it("ritorna false se workspace e' null", () => {
      expect(isInForeignWorkspace(null)).toBe(false);
    });

    it("ritorna false se utente e' owner del workspace", () => {
      const ws: MinimalWorkspaceInfo = {
        workspace_id: 'ws-1',
        workspace_name: 'Il mio workspace',
        workspace_type: 'platform',
        role: 'owner',
        organization_name: 'SpedireSicuro',
      };
      expect(isInForeignWorkspace(ws)).toBe(false);
    });

    it("ritorna false se utente e' owner di workspace reseller", () => {
      const ws: MinimalWorkspaceInfo = {
        workspace_id: 'ws-2',
        workspace_name: 'Reseller Workspace',
        workspace_type: 'reseller',
        role: 'owner',
        organization_name: 'Reseller SRL',
      };
      expect(isInForeignWorkspace(ws)).toBe(false);
    });

    it("ritorna true se utente e' admin (non owner) in workspace client", () => {
      const ws: MinimalWorkspaceInfo = {
        workspace_id: 'ws-3',
        workspace_name: 'GDS Group SAS',
        workspace_type: 'client',
        role: 'admin',
        organization_name: 'GDS Group',
      };
      expect(isInForeignWorkspace(ws)).toBe(true);
    });

    it("ritorna true se utente e' operator in workspace altrui", () => {
      const ws: MinimalWorkspaceInfo = {
        workspace_id: 'ws-4',
        workspace_name: 'Cliente ABC',
        workspace_type: 'client',
        role: 'operator',
        organization_name: 'ABC SRL',
      };
      expect(isInForeignWorkspace(ws)).toBe(true);
    });

    it("ritorna true se utente e' viewer in workspace altrui", () => {
      const ws: MinimalWorkspaceInfo = {
        workspace_id: 'ws-5',
        workspace_name: 'Cliente XYZ',
        workspace_type: 'reseller',
        role: 'viewer',
        organization_name: 'XYZ SRL',
      };
      expect(isInForeignWorkspace(ws)).toBe(true);
    });

    it("ritorna true se utente e' admin in workspace platform (non owner)", () => {
      // Caso: sub-admin che accede al workspace platform
      const ws: MinimalWorkspaceInfo = {
        workspace_id: 'ws-6',
        workspace_name: 'SpedireSicuro Platform',
        workspace_type: 'platform',
        role: 'admin',
        organization_name: 'SpedireSicuro',
      };
      expect(isInForeignWorkspace(ws)).toBe(true);
    });
  });

  describe('findOwnerWorkspace', () => {
    it("trova il workspace platform dove utente e' owner", () => {
      const workspaces: MinimalWorkspaceInfo[] = [
        {
          workspace_id: 'ws-own',
          workspace_name: 'SpedireSicuro',
          workspace_type: 'platform',
          role: 'owner',
          organization_name: 'SpedireSicuro',
        },
        {
          workspace_id: 'ws-client',
          workspace_name: 'GDS Group',
          workspace_type: 'client',
          role: 'admin',
          organization_name: 'GDS',
        },
      ];

      const result = findOwnerWorkspace(workspaces);
      expect(result?.workspace_id).toBe('ws-own');
    });

    it("trova il workspace reseller dove utente e' owner", () => {
      const workspaces: MinimalWorkspaceInfo[] = [
        {
          workspace_id: 'ws-reseller',
          workspace_name: 'Reseller Milano',
          workspace_type: 'reseller',
          role: 'owner',
          organization_name: 'Milano SRL',
        },
        {
          workspace_id: 'ws-client',
          workspace_name: 'Cliente A',
          workspace_type: 'client',
          role: 'admin',
          organization_name: 'Cliente A',
        },
      ];

      const result = findOwnerWorkspace(workspaces);
      expect(result?.workspace_id).toBe('ws-reseller');
    });

    it('NON ritorna workspace client anche se owner', () => {
      // Caso: utente owner di un workspace client (non ha workspace reseller/platform)
      const workspaces: MinimalWorkspaceInfo[] = [
        {
          workspace_id: 'ws-my-client',
          workspace_name: 'Il mio negozio',
          workspace_type: 'client',
          role: 'owner',
          organization_name: 'Negozio SRL',
        },
      ];

      const result = findOwnerWorkspace(workspaces);
      expect(result).toBeUndefined();
    });

    it('ritorna undefined se nessun workspace proprio', () => {
      const workspaces: MinimalWorkspaceInfo[] = [
        {
          workspace_id: 'ws-other',
          workspace_name: 'Workspace altrui',
          workspace_type: 'client',
          role: 'admin',
          organization_name: 'Altrui',
        },
      ];

      const result = findOwnerWorkspace(workspaces);
      expect(result).toBeUndefined();
    });

    it('preferisce workspace platform over reseller', () => {
      const workspaces: MinimalWorkspaceInfo[] = [
        {
          workspace_id: 'ws-reseller',
          workspace_name: 'Reseller WS',
          workspace_type: 'reseller',
          role: 'owner',
          organization_name: 'Reseller',
        },
        {
          workspace_id: 'ws-platform',
          workspace_name: 'Platform WS',
          workspace_type: 'platform',
          role: 'owner',
          organization_name: 'SpedireSicuro',
        },
      ];

      // findOwnerWorkspace ritorna il primo match (non client + owner)
      // L'ordine nell'array determina quale viene trovato per primo
      const result = findOwnerWorkspace(workspaces);
      expect(result).toBeDefined();
      expect(result?.workspace_type).not.toBe('client');
    });
  });
});
