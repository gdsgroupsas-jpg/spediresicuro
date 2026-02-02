/**
 * Test Unit: Reseller Assigned Price Lists
 *
 * Verifica che il flusso a cascata superadmin -> reseller -> client funzioni:
 * 1. Reseller vede listini custom assegnati dal superadmin
 * 2. Reseller puo clonare listini assegnati (non solo quelli creati da lui)
 * 3. Isolamento: reseller A non vede listini assegnati a reseller B
 * 4. Listini revocati non sono visibili
 */

import { describe, expect, it } from 'vitest';

// ---- Pure logic helpers estratti dalla business logic ----

/**
 * Simula la logica di merge e deduplica usata in listPriceListsAction
 * per integrare listini assegnati ai risultati della RPC
 */
function mergeOwnedAndAssigned(
  ownedLists: Array<{ id: string; list_type: string; created_by: string }>,
  assignedIds: string[],
  directAssignedId: string | null,
  allPriceLists: Array<{ id: string; list_type: string; created_by: string }>
): Array<{ id: string; list_type: string; created_by: string }> {
  const ownedIdSet = new Set(ownedLists.map((pl) => pl.id));

  const missingIds = [
    ...assignedIds,
    ...(directAssignedId ? [directAssignedId] : []),
  ].filter((id) => id && !ownedIdSet.has(id));

  const assignedLists = allPriceLists.filter((pl) => missingIds.includes(pl.id));

  // Merge e deduplica
  const seenIds = new Set<string>();
  const result: Array<{ id: string; list_type: string; created_by: string }> = [];
  for (const pl of [...ownedLists, ...assignedLists]) {
    if (!seenIds.has(pl.id)) {
      seenIds.add(pl.id);
      result.push(pl);
    }
  }
  return result;
}

/**
 * Simula la logica di autorizzazione clone dalla funzione SQL
 * reseller_clone_supplier_price_list
 */
function canResellerClone(
  sourceListCreatedBy: string,
  sourceListType: string,
  callerId: string,
  assignedPriceListIds: string[],
  directAssignedId: string | null,
  sourceListId: string
): { allowed: boolean; reason?: string } {
  // Verifica tipo
  if (!['supplier', 'custom'].includes(sourceListType)) {
    return { allowed: false, reason: `Tipo non clonabile: ${sourceListType}` };
  }

  // Proprio listino
  if (sourceListCreatedBy === callerId) {
    return { allowed: true };
  }

  // Assegnato via price_list_assignments
  if (assignedPriceListIds.includes(sourceListId)) {
    return { allowed: true };
  }

  // Assegnato direttamente via users.assigned_price_list_id
  if (directAssignedId === sourceListId) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Non autorizzato' };
}

// ---- Tests ----

describe('Reseller Assigned Price Lists', () => {
  const SUPERADMIN_ID = 'superadmin-001';
  const RESELLER_A_ID = 'reseller-a-001';
  const RESELLER_B_ID = 'reseller-b-001';

  const allPriceLists = [
    { id: 'pl-supplier-1', list_type: 'supplier', created_by: SUPERADMIN_ID },
    { id: 'pl-custom-1', list_type: 'custom', created_by: SUPERADMIN_ID },
    { id: 'pl-custom-2', list_type: 'custom', created_by: SUPERADMIN_ID },
    { id: 'pl-reseller-a-own', list_type: 'supplier', created_by: RESELLER_A_ID },
    { id: 'pl-reseller-b-own', list_type: 'custom', created_by: RESELLER_B_ID },
  ];

  describe('Visibilita listini per reseller', () => {
    it('reseller vede i propri listini + quelli assegnati dal superadmin', () => {
      const ownedByA = allPriceLists.filter((pl) => pl.created_by === RESELLER_A_ID);
      const assignedToA = ['pl-custom-1']; // assegnato via price_list_assignments
      const directAssigned = null;

      const result = mergeOwnedAndAssigned(ownedByA, assignedToA, directAssigned, allPriceLists);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toContain('pl-reseller-a-own');
      expect(result.map((r) => r.id)).toContain('pl-custom-1');
    });

    it('reseller vede listino assegnato via assigned_price_list_id', () => {
      const ownedByA = allPriceLists.filter((pl) => pl.created_by === RESELLER_A_ID);
      const assignedToA: string[] = [];
      const directAssigned = 'pl-custom-2';

      const result = mergeOwnedAndAssigned(ownedByA, assignedToA, directAssigned, allPriceLists);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toContain('pl-reseller-a-own');
      expect(result.map((r) => r.id)).toContain('pl-custom-2');
    });

    it('reseller NON vede listini assegnati ad altri reseller', () => {
      const ownedByA = allPriceLists.filter((pl) => pl.created_by === RESELLER_A_ID);
      const assignedToA = ['pl-custom-1'];
      const directAssigned = null;

      const result = mergeOwnedAndAssigned(ownedByA, assignedToA, directAssigned, allPriceLists);

      // Non deve contenere listini di reseller B o supplier del superadmin non assegnati
      expect(result.map((r) => r.id)).not.toContain('pl-reseller-b-own');
      expect(result.map((r) => r.id)).not.toContain('pl-supplier-1');
      expect(result.map((r) => r.id)).not.toContain('pl-custom-2');
    });

    it('nessuna duplicazione se listino e sia owned che assigned', () => {
      const ownedByA = allPriceLists.filter((pl) => pl.created_by === RESELLER_A_ID);
      // assigned_price_list_id punta a un listino gia owned
      const assignedToA: string[] = [];
      const directAssigned = 'pl-reseller-a-own';

      const result = mergeOwnedAndAssigned(ownedByA, assignedToA, directAssigned, allPriceLists);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pl-reseller-a-own');
    });

    it('listino revocato non appare (filtrato a monte)', () => {
      const ownedByA = allPriceLists.filter((pl) => pl.created_by === RESELLER_A_ID);
      // Simula: pl-custom-1 era assegnato ma revocato (non presente in assignedIds)
      const assignedToA: string[] = [];
      const directAssigned = null;

      const result = mergeOwnedAndAssigned(ownedByA, assignedToA, directAssigned, allPriceLists);

      expect(result).toHaveLength(1);
      expect(result.map((r) => r.id)).not.toContain('pl-custom-1');
    });
  });

  describe('Autorizzazione clone listini', () => {
    it('reseller puo clonare il proprio listino supplier', () => {
      const result = canResellerClone(
        RESELLER_A_ID, 'supplier', RESELLER_A_ID, [], null, 'pl-reseller-a-own'
      );
      expect(result.allowed).toBe(true);
    });

    it('reseller puo clonare listino custom assegnato dal superadmin', () => {
      const result = canResellerClone(
        SUPERADMIN_ID, 'custom', RESELLER_A_ID, ['pl-custom-1'], null, 'pl-custom-1'
      );
      expect(result.allowed).toBe(true);
    });

    it('reseller puo clonare listino assegnato via assigned_price_list_id', () => {
      const result = canResellerClone(
        SUPERADMIN_ID, 'custom', RESELLER_A_ID, [], 'pl-custom-2', 'pl-custom-2'
      );
      expect(result.allowed).toBe(true);
    });

    it('reseller NON puo clonare listino non assegnato di un altro reseller', () => {
      const result = canResellerClone(
        RESELLER_B_ID, 'custom', RESELLER_A_ID, [], null, 'pl-reseller-b-own'
      );
      expect(result.allowed).toBe(false);
    });

    it('reseller NON puo clonare listino supplier del superadmin non assegnato', () => {
      const result = canResellerClone(
        SUPERADMIN_ID, 'supplier', RESELLER_A_ID, [], null, 'pl-supplier-1'
      );
      expect(result.allowed).toBe(false);
    });

    it('reseller NON puo clonare listino di tipo global', () => {
      const result = canResellerClone(
        SUPERADMIN_ID, 'global', RESELLER_A_ID, ['pl-global-1'], null, 'pl-global-1'
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Tipo non clonabile');
    });
  });

  describe('Isolamento multi-tenant', () => {
    it('due reseller con stessi listini assegnati vedono solo i propri', () => {
      // Reseller A
      const ownedByA = allPriceLists.filter((pl) => pl.created_by === RESELLER_A_ID);
      const resultA = mergeOwnedAndAssigned(ownedByA, ['pl-custom-1'], null, allPriceLists);

      // Reseller B
      const ownedByB = allPriceLists.filter((pl) => pl.created_by === RESELLER_B_ID);
      const resultB = mergeOwnedAndAssigned(ownedByB, ['pl-custom-2'], null, allPriceLists);

      // A vede pl-custom-1 ma non pl-custom-2
      expect(resultA.map((r) => r.id)).toContain('pl-custom-1');
      expect(resultA.map((r) => r.id)).not.toContain('pl-custom-2');

      // B vede pl-custom-2 ma non pl-custom-1
      expect(resultB.map((r) => r.id)).toContain('pl-custom-2');
      expect(resultB.map((r) => r.id)).not.toContain('pl-custom-1');

      // Nessuno vede i listini dell'altro reseller
      expect(resultA.map((r) => r.id)).not.toContain('pl-reseller-b-own');
      expect(resultB.map((r) => r.id)).not.toContain('pl-reseller-a-own');
    });
  });
});
