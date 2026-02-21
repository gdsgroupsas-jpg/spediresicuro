/**
 * Test permessi workspace enterprise
 *
 * Verifica l'espansione dei permessi con moduli:
 * warehouse, billing, clients, quotes
 *
 * Copre:
 * - roleHasPermission() per tutti i ruoli con nuovi moduli
 * - memberHasPermission() con override espliciti
 * - Coerenza tra catalogo TS e permessi impliciti
 * - Completezza catalogo (nessun permesso orfano)
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import {
  roleHasPermission,
  memberHasPermission,
  type WorkspacePermission,
  type WorkspaceMemberRole,
} from '@/types/workspace';

// ============================================
// CATALOGO COMPLETO PERMESSI
// ============================================

const ALL_PERMISSIONS: WorkspacePermission[] = [
  // Shipments
  'shipments:create',
  'shipments:view',
  'shipments:edit',
  'shipments:delete',
  'shipments:track',
  'shipments:cancel',
  // Wallet
  'wallet:view',
  'wallet:manage',
  'wallet:recharge',
  // Members
  'members:view',
  'members:invite',
  'members:remove',
  'members:edit_role',
  // Settings
  'settings:view',
  'settings:edit',
  // Pricelists
  'pricelists:view',
  'pricelists:manage',
  // Contacts
  'contacts:view',
  'contacts:create',
  'contacts:edit',
  'contacts:delete',
  // Reports
  'reports:view',
  'reports:export',
  // Warehouse
  'warehouse:view',
  'warehouse:manage',
  'warehouse:inventory',
  'warehouse:pickup',
  'warehouse:delivery',
  // Billing
  'billing:view',
  'billing:manage',
  'billing:invoices',
  'billing:reconcile',
  // Clients
  'clients:view',
  'clients:create',
  'clients:edit',
  'clients:delete',
  'clients:manage',
  // Quotes
  'quotes:view',
  'quotes:create',
  'quotes:edit',
  'quotes:delete',
];

// Permessi :view (tutto cio' che un viewer puo' fare)
const VIEW_PERMISSIONS = ALL_PERMISSIONS.filter((p) => p.endsWith(':view'));

// Permessi impliciti operator
const OPERATOR_PERMISSIONS: WorkspacePermission[] = [
  'shipments:create',
  'shipments:view',
  'shipments:track',
  'wallet:view',
  'contacts:view',
  'contacts:create',
  'warehouse:view',
  'warehouse:pickup',
  'warehouse:delivery',
  'clients:view',
  'quotes:view',
  'quotes:create',
  'billing:view',
];

// ============================================
// OWNER: ha tutti i permessi
// ============================================

describe('Permessi Enterprise - Owner', () => {
  it('owner ha TUTTI i permessi (inclusi nuovi moduli)', () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(roleHasPermission('owner', perm)).toBe(true);
    }
  });
});

// ============================================
// ADMIN: ha tutti i permessi
// ============================================

describe('Permessi Enterprise - Admin', () => {
  it('admin ha TUTTI i permessi (inclusi nuovi moduli)', () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(roleHasPermission('admin', perm)).toBe(true);
    }
  });
});

// ============================================
// OPERATOR: permessi operativi
// ============================================

describe('Permessi Enterprise - Operator', () => {
  it('operator ha i permessi operativi definiti', () => {
    for (const perm of OPERATOR_PERMISSIONS) {
      expect(roleHasPermission('operator', perm)).toBe(true);
    }
  });

  // Warehouse
  it('operator puo vedere magazzino', () => {
    expect(roleHasPermission('operator', 'warehouse:view')).toBe(true);
  });

  it('operator puo fare ritiri', () => {
    expect(roleHasPermission('operator', 'warehouse:pickup')).toBe(true);
  });

  it('operator puo fare consegne', () => {
    expect(roleHasPermission('operator', 'warehouse:delivery')).toBe(true);
  });

  it('operator NON puo gestire magazzino', () => {
    expect(roleHasPermission('operator', 'warehouse:manage')).toBe(false);
  });

  it('operator NON puo gestire inventario', () => {
    expect(roleHasPermission('operator', 'warehouse:inventory')).toBe(false);
  });

  // Billing
  it('operator puo vedere contabilita', () => {
    expect(roleHasPermission('operator', 'billing:view')).toBe(true);
  });

  it('operator NON puo gestire contabilita', () => {
    expect(roleHasPermission('operator', 'billing:manage')).toBe(false);
  });

  it('operator NON puo gestire fatture', () => {
    expect(roleHasPermission('operator', 'billing:invoices')).toBe(false);
  });

  it('operator NON puo riconciliare', () => {
    expect(roleHasPermission('operator', 'billing:reconcile')).toBe(false);
  });

  // Clients
  it('operator puo vedere clienti', () => {
    expect(roleHasPermission('operator', 'clients:view')).toBe(true);
  });

  it('operator NON puo creare clienti', () => {
    expect(roleHasPermission('operator', 'clients:create')).toBe(false);
  });

  it('operator NON puo gestire clienti', () => {
    expect(roleHasPermission('operator', 'clients:manage')).toBe(false);
  });

  // Quotes
  it('operator puo vedere preventivi', () => {
    expect(roleHasPermission('operator', 'quotes:view')).toBe(true);
  });

  it('operator puo creare preventivi', () => {
    expect(roleHasPermission('operator', 'quotes:create')).toBe(true);
  });

  it('operator NON puo modificare preventivi', () => {
    expect(roleHasPermission('operator', 'quotes:edit')).toBe(false);
  });

  it('operator NON puo eliminare preventivi', () => {
    expect(roleHasPermission('operator', 'quotes:delete')).toBe(false);
  });
});

// ============================================
// VIEWER: solo :view
// ============================================

describe('Permessi Enterprise - Viewer', () => {
  it('viewer ha TUTTI i permessi :view', () => {
    for (const perm of VIEW_PERMISSIONS) {
      expect(roleHasPermission('viewer', perm)).toBe(true);
    }
  });

  it('viewer vede warehouse', () => {
    expect(roleHasPermission('viewer', 'warehouse:view')).toBe(true);
  });

  it('viewer vede billing', () => {
    expect(roleHasPermission('viewer', 'billing:view')).toBe(true);
  });

  it('viewer vede clients', () => {
    expect(roleHasPermission('viewer', 'clients:view')).toBe(true);
  });

  it('viewer vede quotes', () => {
    expect(roleHasPermission('viewer', 'quotes:view')).toBe(true);
  });

  it('viewer NON puo creare/modificare/gestire nulla', () => {
    const nonViewPerms = ALL_PERMISSIONS.filter((p) => !p.endsWith(':view'));
    for (const perm of nonViewPerms) {
      expect(roleHasPermission('viewer', perm)).toBe(false);
    }
  });
});

// ============================================
// OVERRIDE ESPLICITI via memberHasPermission
// ============================================

describe('Permessi Enterprise - Override espliciti', () => {
  it('operator con override warehouse:manage puo gestire magazzino', () => {
    const member = {
      role: 'operator' as WorkspaceMemberRole,
      permissions: ['warehouse:manage'] as WorkspacePermission[],
    };
    expect(memberHasPermission(member, 'warehouse:manage')).toBe(true);
  });

  it('operator con override billing:invoices puo gestire fatture', () => {
    const member = {
      role: 'operator' as WorkspaceMemberRole,
      permissions: ['billing:invoices'] as WorkspacePermission[],
    };
    expect(memberHasPermission(member, 'billing:invoices')).toBe(true);
  });

  it('viewer con override warehouse:pickup puo fare ritiri', () => {
    const member = {
      role: 'viewer' as WorkspaceMemberRole,
      permissions: ['warehouse:pickup'] as WorkspacePermission[],
    };
    expect(memberHasPermission(member, 'warehouse:pickup')).toBe(true);
  });

  it('viewer senza override NON puo fare ritiri', () => {
    const member = {
      role: 'viewer' as WorkspaceMemberRole,
      permissions: [] as WorkspacePermission[],
    };
    expect(memberHasPermission(member, 'warehouse:pickup')).toBe(false);
  });

  it('operator con override multipli funziona correttamente', () => {
    const member = {
      role: 'operator' as WorkspaceMemberRole,
      permissions: [
        'warehouse:manage',
        'warehouse:inventory',
        'billing:invoices',
        'clients:manage',
      ] as WorkspacePermission[],
    };
    // Override attivi
    expect(memberHasPermission(member, 'warehouse:manage')).toBe(true);
    expect(memberHasPermission(member, 'warehouse:inventory')).toBe(true);
    expect(memberHasPermission(member, 'billing:invoices')).toBe(true);
    expect(memberHasPermission(member, 'clients:manage')).toBe(true);
    // Impliciti dal ruolo
    expect(memberHasPermission(member, 'shipments:create')).toBe(true);
    expect(memberHasPermission(member, 'warehouse:pickup')).toBe(true);
    // NON concessi
    expect(memberHasPermission(member, 'billing:reconcile')).toBe(false);
    expect(memberHasPermission(member, 'members:invite')).toBe(false);
  });
});

// ============================================
// FIGURE ENTERPRISE: template ruolo
// ============================================

describe('Permessi Enterprise - Figure business (template)', () => {
  it('Corriere interno = operator + warehouse pickup/delivery', () => {
    // Il corriere interno e un operator base - ha gia i permessi necessari
    expect(roleHasPermission('operator', 'shipments:create')).toBe(true);
    expect(roleHasPermission('operator', 'shipments:track')).toBe(true);
    expect(roleHasPermission('operator', 'warehouse:pickup')).toBe(true);
    expect(roleHasPermission('operator', 'warehouse:delivery')).toBe(true);
  });

  it('Capo magazzino = operator + warehouse:manage + warehouse:inventory', () => {
    const capoMagazzino = {
      role: 'operator' as WorkspaceMemberRole,
      permissions: ['warehouse:manage', 'warehouse:inventory'] as WorkspacePermission[],
    };
    // Impliciti operator
    expect(memberHasPermission(capoMagazzino, 'warehouse:view')).toBe(true);
    expect(memberHasPermission(capoMagazzino, 'warehouse:pickup')).toBe(true);
    expect(memberHasPermission(capoMagazzino, 'warehouse:delivery')).toBe(true);
    // Override
    expect(memberHasPermission(capoMagazzino, 'warehouse:manage')).toBe(true);
    expect(memberHasPermission(capoMagazzino, 'warehouse:inventory')).toBe(true);
  });

  it('Responsabile contabilita = admin (ha tutto)', () => {
    // Responsabile contabilita e un admin - ha tutti i permessi
    expect(roleHasPermission('admin', 'billing:view')).toBe(true);
    expect(roleHasPermission('admin', 'billing:manage')).toBe(true);
    expect(roleHasPermission('admin', 'billing:invoices')).toBe(true);
    expect(roleHasPermission('admin', 'billing:reconcile')).toBe(true);
    expect(roleHasPermission('admin', 'wallet:manage')).toBe(true);
    expect(roleHasPermission('admin', 'reports:export')).toBe(true);
  });

  it('Commerciale = operator + clients:manage + quotes:edit', () => {
    const commerciale = {
      role: 'operator' as WorkspaceMemberRole,
      permissions: [
        'clients:create',
        'clients:edit',
        'clients:manage',
        'quotes:edit',
      ] as WorkspacePermission[],
    };
    // Impliciti operator
    expect(memberHasPermission(commerciale, 'clients:view')).toBe(true);
    expect(memberHasPermission(commerciale, 'quotes:view')).toBe(true);
    expect(memberHasPermission(commerciale, 'quotes:create')).toBe(true);
    // Override
    expect(memberHasPermission(commerciale, 'clients:create')).toBe(true);
    expect(memberHasPermission(commerciale, 'clients:edit')).toBe(true);
    expect(memberHasPermission(commerciale, 'clients:manage')).toBe(true);
    expect(memberHasPermission(commerciale, 'quotes:edit')).toBe(true);
    // NON concessi
    expect(memberHasPermission(commerciale, 'billing:manage')).toBe(false);
    expect(memberHasPermission(commerciale, 'members:invite')).toBe(false);
  });

  it('Viewer contabile = viewer + billing:invoices (override)', () => {
    const viewerContabile = {
      role: 'viewer' as WorkspaceMemberRole,
      permissions: ['billing:invoices'] as WorkspacePermission[],
    };
    // Impliciti viewer
    expect(memberHasPermission(viewerContabile, 'billing:view')).toBe(true);
    expect(memberHasPermission(viewerContabile, 'reports:view')).toBe(true);
    // Override
    expect(memberHasPermission(viewerContabile, 'billing:invoices')).toBe(true);
    // NON concessi
    expect(memberHasPermission(viewerContabile, 'billing:manage')).toBe(false);
    expect(memberHasPermission(viewerContabile, 'shipments:create')).toBe(false);
  });
});

// ============================================
// COERENZA CATALOGO
// ============================================

describe('Permessi Enterprise - Coerenza catalogo', () => {
  it('tutti i permessi seguono formato resource:action', () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(perm).toMatch(/^[a-z]+:[a-z_]+$/);
    }
  });

  it('ogni modulo ha almeno un permesso :view', () => {
    const modules = new Set(ALL_PERMISSIONS.map((p) => p.split(':')[0]));
    for (const mod of modules) {
      const hasView = ALL_PERMISSIONS.some((p) => p === `${mod}:view`);
      expect(hasView).toBe(true);
    }
  });

  it('nessun permesso duplicato nel catalogo', () => {
    const unique = new Set(ALL_PERMISSIONS);
    expect(unique.size).toBe(ALL_PERMISSIONS.length);
  });

  it('il catalogo ha esattamente 41 permessi', () => {
    expect(ALL_PERMISSIONS).toHaveLength(41);
  });

  it('ci sono esattamente 11 moduli', () => {
    const modules = new Set(ALL_PERMISSIONS.map((p) => p.split(':')[0]));
    expect(modules.size).toBe(11);
  });

  it('i moduli enterprise sono: warehouse, billing, clients, quotes', () => {
    const modules = new Set(ALL_PERMISSIONS.map((p) => p.split(':')[0]));
    expect(modules.has('warehouse')).toBe(true);
    expect(modules.has('billing')).toBe(true);
    expect(modules.has('clients')).toBe(true);
    expect(modules.has('quotes')).toBe(true);
  });
});
