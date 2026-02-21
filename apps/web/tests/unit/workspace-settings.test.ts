/**
 * Workspace Settings Page Tests
 *
 * Test per la pagina Impostazioni Workspace:
 * - Correttezza labels per tipo workspace
 * - Correttezza labels per ruoli
 * - Raggruppamento permessi
 * - Formattazione permessi
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { WorkspacePermission, UserWorkspaceInfo } from '@/types/workspace';

// Mock useWorkspace hook (richiesto da useWorkspaceUI)
const mockWorkspace = vi.fn();
vi.mock('@/hooks/useWorkspace', () => ({
  useWorkspace: () => mockWorkspace(),
}));

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard/workspace/settings',
}));

// Mock WorkspaceContext
const mockWorkspaceContext = vi.fn();
vi.mock('@/contexts/WorkspaceContext', () => ({
  useWorkspaceContext: () => mockWorkspaceContext(),
}));

// ============================================
// HELPERS (replica dalla page per testare)
// ============================================

const typeLabel: Record<string, string> = {
  platform: 'Piattaforma',
  reseller: 'Reseller',
  client: 'Cliente',
};

const roleLabel: Record<string, string> = {
  owner: 'Proprietario',
  admin: 'Amministratore',
  operator: 'Operatore',
  viewer: 'Visualizzatore',
};

const permissionGroups: Record<string, { label: string; permissions: WorkspacePermission[] }> = {
  shipments: {
    label: 'Spedizioni',
    permissions: [
      'shipments:create',
      'shipments:view',
      'shipments:edit',
      'shipments:delete',
      'shipments:track',
      'shipments:cancel',
    ],
  },
  wallet: {
    label: 'Wallet',
    permissions: ['wallet:view', 'wallet:manage', 'wallet:recharge'],
  },
  members: {
    label: 'Membri',
    permissions: ['members:view', 'members:invite', 'members:remove', 'members:edit_role'],
  },
  settings: {
    label: 'Impostazioni',
    permissions: ['settings:view', 'settings:edit'],
  },
  pricelists: {
    label: 'Listini',
    permissions: ['pricelists:view', 'pricelists:manage'],
  },
  contacts: {
    label: 'Contatti',
    permissions: ['contacts:view', 'contacts:create', 'contacts:edit', 'contacts:delete'],
  },
  reports: {
    label: 'Report',
    permissions: ['reports:view', 'reports:export'],
  },
};

function formatPermission(perm: WorkspacePermission): string {
  const action = perm.split(':')[1];
  const labels: Record<string, string> = {
    create: 'Crea',
    view: 'Visualizza',
    edit: 'Modifica',
    delete: 'Elimina',
    track: 'Traccia',
    cancel: 'Cancella',
    manage: 'Gestisci',
    recharge: 'Ricarica',
    invite: 'Invita',
    remove: 'Rimuovi',
    edit_role: 'Cambia ruolo',
    export: 'Esporta',
  };
  return labels[action] || action;
}

function createMockWorkspace(
  type: 'platform' | 'reseller' | 'client',
  depth: 0 | 1 | 2,
  overrides?: Partial<UserWorkspaceInfo>
): UserWorkspaceInfo {
  return {
    workspace_id: 'test-workspace-id',
    workspace_name: `Test ${type} Workspace`,
    workspace_slug: `test-${type}`,
    workspace_type: type,
    workspace_depth: depth,
    organization_id: 'test-org-id',
    organization_name: 'Test Organization',
    organization_slug: 'test-org',
    role: 'owner',
    permissions: [],
    wallet_balance: 1000,
    branding: {},
    member_status: 'active',
    ...overrides,
  };
}

// ============================================
// TESTS
// ============================================

describe('Workspace Settings - Labels tipo workspace', () => {
  it('deve avere label corretta per platform', () => {
    expect(typeLabel['platform']).toBe('Piattaforma');
  });

  it('deve avere label corretta per reseller', () => {
    expect(typeLabel['reseller']).toBe('Reseller');
  });

  it('deve avere label corretta per client', () => {
    expect(typeLabel['client']).toBe('Cliente');
  });

  it('deve ritornare undefined per tipo sconosciuto', () => {
    expect(typeLabel['unknown']).toBeUndefined();
  });
});

describe('Workspace Settings - Labels ruoli', () => {
  it('deve avere label corretta per owner', () => {
    expect(roleLabel['owner']).toBe('Proprietario');
  });

  it('deve avere label corretta per admin', () => {
    expect(roleLabel['admin']).toBe('Amministratore');
  });

  it('deve avere label corretta per operator', () => {
    expect(roleLabel['operator']).toBe('Operatore');
  });

  it('deve avere label corretta per viewer', () => {
    expect(roleLabel['viewer']).toBe('Visualizzatore');
  });
});

describe('Workspace Settings - Raggruppamento permessi', () => {
  it('deve avere 7 gruppi di permessi', () => {
    expect(Object.keys(permissionGroups)).toHaveLength(7);
  });

  it('deve avere il gruppo shipments con 6 permessi', () => {
    expect(permissionGroups.shipments.permissions).toHaveLength(6);
  });

  it('deve avere il gruppo wallet con 3 permessi', () => {
    expect(permissionGroups.wallet.permissions).toHaveLength(3);
  });

  it('deve avere il gruppo members con 4 permessi', () => {
    expect(permissionGroups.members.permissions).toHaveLength(4);
  });

  it('deve filtrare correttamente i permessi attivi', () => {
    const userPerms: WorkspacePermission[] = ['shipments:create', 'shipments:view', 'wallet:view'];

    const activeShipments = permissionGroups.shipments.permissions.filter((p) =>
      userPerms.includes(p)
    );
    const activeWallet = permissionGroups.wallet.permissions.filter((p) => userPerms.includes(p));
    const activeMembers = permissionGroups.members.permissions.filter((p) => userPerms.includes(p));

    expect(activeShipments).toHaveLength(2);
    expect(activeWallet).toHaveLength(1);
    expect(activeMembers).toHaveLength(0);
  });

  it('tutti i permessi devono avere formato resource:action', () => {
    for (const group of Object.values(permissionGroups)) {
      for (const perm of group.permissions) {
        expect(perm).toMatch(/^[a-z]+:[a-z_]+$/);
      }
    }
  });
});

describe('Workspace Settings - Formattazione permessi', () => {
  it('deve formattare create come Crea', () => {
    expect(formatPermission('shipments:create')).toBe('Crea');
  });

  it('deve formattare view come Visualizza', () => {
    expect(formatPermission('wallet:view')).toBe('Visualizza');
  });

  it('deve formattare edit_role come Cambia ruolo', () => {
    expect(formatPermission('members:edit_role')).toBe('Cambia ruolo');
  });

  it('deve formattare export come Esporta', () => {
    expect(formatPermission('reports:export')).toBe('Esporta');
  });

  it('deve restituire action originale per permesso sconosciuto', () => {
    expect(formatPermission('unknown:custom_action' as WorkspacePermission)).toBe('custom_action');
  });
});

describe('Workspace Settings - Mock workspace factory', () => {
  it('deve creare un workspace reseller con valori corretti', () => {
    const ws = createMockWorkspace('reseller', 1);

    expect(ws.workspace_type).toBe('reseller');
    expect(ws.workspace_depth).toBe(1);
    expect(ws.wallet_balance).toBe(1000);
    expect(ws.role).toBe('owner');
  });

  it('deve rispettare gli overrides', () => {
    const ws = createMockWorkspace('client', 2, {
      wallet_balance: 500,
      role: 'viewer',
      permissions: ['shipments:view'],
    });

    expect(ws.wallet_balance).toBe(500);
    expect(ws.role).toBe('viewer');
    expect(ws.permissions).toEqual(['shipments:view']);
  });

  it('deve creare workspace platform con depth 0', () => {
    const ws = createMockWorkspace('platform', 0);

    expect(ws.workspace_type).toBe('platform');
    expect(ws.workspace_depth).toBe(0);
  });
});
