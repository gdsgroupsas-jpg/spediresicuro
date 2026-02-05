/**
 * Workspace Ordering Tests - Superadmin
 *
 * Test suite per verificare:
 * - I workspace sono ordinati per depth (platform first)
 * - All'interno dello stesso depth, ordinati per nome
 * - Il superadmin vede prima i workspace platform (depth 0)
 */

import { describe, it, expect } from 'vitest';

// Test puro della logica di ordinamento senza mock del modulo
describe('Workspace ordering logic', () => {
  // Simula la logica di ordinamento usata in /api/workspaces/my
  function sortWorkspaces(data: Array<{ depth: number; name: string }>) {
    return [...data].sort((a, b) => {
      // Prima per depth (platform = 0 prima)
      if (a.depth !== b.depth) {
        return a.depth - b.depth;
      }
      // Poi per nome
      return a.name.localeCompare(b.name);
    });
  }

  it('dovrebbe mettere platform (depth 0) prima di reseller (depth 1)', () => {
    const workspaces = [
      { depth: 1, name: 'Reseller A' },
      { depth: 0, name: 'Platform SpedireSicuro' },
      { depth: 1, name: 'Reseller B' },
    ];

    const sorted = sortWorkspaces(workspaces);

    expect(sorted[0].depth).toBe(0);
    expect(sorted[0].name).toBe('Platform SpedireSicuro');
  });

  it('dovrebbe mettere reseller (depth 1) prima di client (depth 2)', () => {
    const workspaces = [
      { depth: 2, name: 'Client A' },
      { depth: 1, name: 'Reseller A' },
      { depth: 2, name: 'Client B' },
    ];

    const sorted = sortWorkspaces(workspaces);

    expect(sorted[0].depth).toBe(1);
    expect(sorted[1].depth).toBe(2);
    expect(sorted[2].depth).toBe(2);
  });

  it('dovrebbe ordinare per nome all interno dello stesso depth', () => {
    const workspaces = [
      { depth: 1, name: 'Zebra Logistics' },
      { depth: 1, name: 'Alpha Transport' },
      { depth: 1, name: 'Beta Shipping' },
    ];

    const sorted = sortWorkspaces(workspaces);

    expect(sorted[0].name).toBe('Alpha Transport');
    expect(sorted[1].name).toBe('Beta Shipping');
    expect(sorted[2].name).toBe('Zebra Logistics');
  });

  it('ordinamento completo: depth prima, poi nome', () => {
    const workspaces = [
      { depth: 2, name: 'Client Zebra' },
      { depth: 1, name: 'Reseller Beta' },
      { depth: 0, name: 'Platform Main' },
      { depth: 2, name: 'Client Alpha' },
      { depth: 1, name: 'Reseller Alpha' },
      { depth: 0, name: 'Platform Backup' },
    ];

    const sorted = sortWorkspaces(workspaces);

    // Ordine atteso:
    // 1. Platform Backup (depth 0, B < M)
    // 2. Platform Main (depth 0)
    // 3. Reseller Alpha (depth 1, A < B)
    // 4. Reseller Beta (depth 1)
    // 5. Client Alpha (depth 2, A < Z)
    // 6. Client Zebra (depth 2)

    expect(sorted).toEqual([
      { depth: 0, name: 'Platform Backup' },
      { depth: 0, name: 'Platform Main' },
      { depth: 1, name: 'Reseller Alpha' },
      { depth: 1, name: 'Reseller Beta' },
      { depth: 2, name: 'Client Alpha' },
      { depth: 2, name: 'Client Zebra' },
    ]);
  });

  it('superadmin default: il primo workspace dovrebbe essere platform', () => {
    // Simula scenario tipico del superadmin
    const workspaces = [
      { depth: 2, name: 'Client A - Shipping Co' },
      { depth: 1, name: 'Reseller - Logistica Milano' },
      { depth: 0, name: 'SpedireSicuro Platform' },
      { depth: 2, name: 'Client B - Fast Delivery' },
      { depth: 1, name: 'Reseller - Transport Roma' },
    ];

    const sorted = sortWorkspaces(workspaces);

    // Il primo workspace deve essere platform (depth 0)
    expect(sorted[0].depth).toBe(0);
    expect(sorted[0].name).toBe('SpedireSicuro Platform');

    // Il superadmin dovrebbe partire da questo workspace di default
    const defaultWorkspace = sorted[0];
    expect(defaultWorkspace.depth).toBe(0);
  });
});
