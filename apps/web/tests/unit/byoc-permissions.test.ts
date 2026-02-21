/**
 * Test Unit: BYOC (Bring Your Own Contract) Permissions
 *
 * Verifica che utenti BYOC:
 * 1. POSSANO creare solo listini di tipo "supplier"
 * 2. NON possano creare listini "global" o altri tipi
 * 3. NON possano vedere listini globali
 * 4. Vedano solo i propri listini supplier
 *
 * Riferimento: AUDIT_MULTI_ACCOUNT_LISTINI_2026.md - Test Cases
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Tipi per i test
type AccountType = 'user' | 'admin' | 'superadmin' | 'byoc';
type ListType = 'global' | 'supplier' | 'custom';

interface User {
  id: string;
  email: string;
  account_type: AccountType;
  is_reseller: boolean;
}

interface PriceListInput {
  name: string;
  version: string;
  status: string;
  courier_id: string;
  list_type?: ListType;
  is_global?: boolean;
}

interface PriceListResult {
  success: boolean;
  error?: string;
  priceList?: {
    id: string;
    list_type: ListType;
    is_global: boolean;
    created_by: string;
  };
}

describe('BYOC Permissions - Listini', () => {
  // Helper: verifica se utente può creare listino
  function canCreatePriceListType(
    user: User,
    listType: ListType
  ): { allowed: boolean; reason: string } {
    const isByoc = user.account_type === 'byoc';
    const isReseller = user.is_reseller;
    const isAdmin = user.account_type === 'admin' || user.account_type === 'superadmin';

    // Admin può creare qualsiasi tipo
    if (isAdmin) {
      return { allowed: true, reason: 'admin_privilege' };
    }

    // BYOC può creare SOLO supplier
    if (isByoc) {
      if (listType === 'supplier') {
        return { allowed: true, reason: 'byoc_supplier_allowed' };
      }
      return {
        allowed: false,
        reason: 'byoc_only_supplier',
      };
    }

    // Reseller può creare SOLO supplier
    if (isReseller) {
      if (listType === 'supplier') {
        return { allowed: true, reason: 'reseller_supplier_allowed' };
      }
      return {
        allowed: false,
        reason: 'reseller_only_supplier',
      };
    }

    // Utente normale non può creare listini
    return {
      allowed: false,
      reason: 'not_authorized',
    };
  }

  // Helper: simula createSupplierPriceListAction
  function createPriceList(user: User, input: PriceListInput): PriceListResult {
    const listType = input.list_type || 'supplier';
    const permission = canCreatePriceListType(user, listType);

    if (!permission.allowed) {
      return {
        success: false,
        error: getErrorMessage(permission.reason),
      };
    }

    // Per BYOC/Reseller, forza sempre supplier e is_global=false
    const isByocOrReseller = user.account_type === 'byoc' || user.is_reseller;

    return {
      success: true,
      priceList: {
        id: `pl-${Date.now()}`,
        list_type: isByocOrReseller ? 'supplier' : listType,
        is_global: isByocOrReseller ? false : input.is_global || false,
        created_by: user.id,
      },
    };
  }

  function getErrorMessage(reason: string): string {
    const messages: Record<string, string> = {
      byoc_only_supplier: 'BYOC può creare solo listini di tipo supplier',
      reseller_only_supplier: 'Solo Reseller e BYOC possono creare listini fornitore',
      not_authorized: 'Non autorizzato a creare listini',
    };
    return messages[reason] || 'Operazione non permessa';
  }

  describe('BYOC - Creazione Listini', () => {
    const byocUser: User = {
      id: 'byoc-user-123',
      email: 'byoc@test.local',
      account_type: 'byoc',
      is_reseller: false,
    };

    it('BYOC DEVE poter creare listini supplier', () => {
      const result = createPriceList(byocUser, {
        name: 'Listino Fornitore BYOC',
        version: '1.0.0',
        status: 'draft',
        courier_id: 'courier-123',
        list_type: 'supplier',
      });

      expect(result.success).toBe(true);
      expect(result.priceList).toBeDefined();
      expect(result.priceList?.list_type).toBe('supplier');
      expect(result.priceList?.is_global).toBe(false);
    });

    it('BYOC NON può creare listini global', () => {
      const result = createPriceList(byocUser, {
        name: 'Tentativo Listino Globale',
        version: '1.0.0',
        status: 'draft',
        courier_id: 'courier-123',
        list_type: 'global',
        is_global: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('supplier');
    });

    it('BYOC NON può creare listini custom', () => {
      const result = createPriceList(byocUser, {
        name: 'Tentativo Listino Custom',
        version: '1.0.0',
        status: 'draft',
        courier_id: 'courier-123',
        list_type: 'custom',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('supplier');
    });

    it('BYOC - creazione senza list_type deve defaultare a supplier', () => {
      const result = createPriceList(byocUser, {
        name: 'Listino Default Type',
        version: '1.0.0',
        status: 'draft',
        courier_id: 'courier-123',
        // list_type non specificato
      });

      expect(result.success).toBe(true);
      expect(result.priceList?.list_type).toBe('supplier');
    });

    it('BYOC - is_global viene forzato a false', () => {
      const result = createPriceList(byocUser, {
        name: 'Listino con is_global true',
        version: '1.0.0',
        status: 'draft',
        courier_id: 'courier-123',
        list_type: 'supplier',
        is_global: true, // Tentativo di impostare true
      });

      expect(result.success).toBe(true);
      // Deve essere forzato a false per BYOC
      expect(result.priceList?.is_global).toBe(false);
    });
  });

  describe('Reseller - Creazione Listini', () => {
    const resellerUser: User = {
      id: 'reseller-user-456',
      email: 'reseller@test.local',
      account_type: 'user',
      is_reseller: true,
    };

    it('Reseller DEVE poter creare listini supplier', () => {
      const result = createPriceList(resellerUser, {
        name: 'Listino Fornitore Reseller',
        version: '1.0.0',
        status: 'draft',
        courier_id: 'courier-123',
        list_type: 'supplier',
      });

      expect(result.success).toBe(true);
      expect(result.priceList?.list_type).toBe('supplier');
      expect(result.priceList?.is_global).toBe(false);
    });

    it('Reseller NON può creare listini global', () => {
      const result = createPriceList(resellerUser, {
        name: 'Tentativo Listino Globale',
        version: '1.0.0',
        status: 'draft',
        courier_id: 'courier-123',
        list_type: 'global',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Admin - Creazione Listini', () => {
    const adminUser: User = {
      id: 'admin-user-789',
      email: 'admin@test.local',
      account_type: 'admin',
      is_reseller: false,
    };

    it('Admin PUÒ creare listini global', () => {
      const result = createPriceList(adminUser, {
        name: 'Listino Globale Admin',
        version: '1.0.0',
        status: 'draft',
        courier_id: 'courier-123',
        list_type: 'global',
        is_global: true,
      });

      expect(result.success).toBe(true);
      expect(result.priceList?.list_type).toBe('global');
      expect(result.priceList?.is_global).toBe(true);
    });

    it('Admin PUÒ creare listini supplier', () => {
      const result = createPriceList(adminUser, {
        name: 'Listino Supplier Admin',
        version: '1.0.0',
        status: 'draft',
        courier_id: 'courier-123',
        list_type: 'supplier',
      });

      expect(result.success).toBe(true);
      expect(result.priceList?.list_type).toBe('supplier');
    });
  });

  describe('Utente Normale - Creazione Listini', () => {
    const normalUser: User = {
      id: 'normal-user-000',
      email: 'user@test.local',
      account_type: 'user',
      is_reseller: false,
    };

    it('Utente normale NON può creare listini supplier', () => {
      const result = createPriceList(normalUser, {
        name: 'Tentativo Listino',
        version: '1.0.0',
        status: 'draft',
        courier_id: 'courier-123',
        list_type: 'supplier',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('Utente normale NON può creare listini global', () => {
      const result = createPriceList(normalUser, {
        name: 'Tentativo Listino Globale',
        version: '1.0.0',
        status: 'draft',
        courier_id: 'courier-123',
        list_type: 'global',
      });

      expect(result.success).toBe(false);
    });
  });
});

describe('BYOC Permissions - Visualizzazione Listini', () => {
  interface PriceList {
    id: string;
    name: string;
    list_type: ListType;
    is_global: boolean;
    created_by: string;
  }

  // Simula listini nel database
  const allPriceLists: PriceList[] = [
    {
      id: 'pl-global-1',
      name: 'Listino Globale GLS',
      list_type: 'global',
      is_global: true,
      created_by: 'admin-user',
    },
    {
      id: 'pl-global-2',
      name: 'Listino Globale BRT',
      list_type: 'global',
      is_global: true,
      created_by: 'admin-user',
    },
    {
      id: 'pl-byoc-1',
      name: 'Listino Supplier BYOC 1',
      list_type: 'supplier',
      is_global: false,
      created_by: 'byoc-user-123',
    },
    {
      id: 'pl-byoc-2',
      name: 'Listino Supplier BYOC 1 - BRT',
      list_type: 'supplier',
      is_global: false,
      created_by: 'byoc-user-123',
    },
    {
      id: 'pl-reseller-1',
      name: 'Listino Supplier Reseller',
      list_type: 'supplier',
      is_global: false,
      created_by: 'reseller-user-456',
    },
  ];

  // Helper: filtra listini visibili per utente
  function getVisiblePriceLists(user: User, allLists: PriceList[]): PriceList[] {
    const isAdmin = user.account_type === 'admin' || user.account_type === 'superadmin';
    const isByoc = user.account_type === 'byoc';
    const isReseller = user.is_reseller;

    if (isAdmin) {
      // Admin vede tutto
      return allLists;
    }

    if (isByoc || isReseller) {
      // BYOC e Reseller vedono SOLO i propri listini supplier
      return allLists.filter((pl) => pl.list_type === 'supplier' && pl.created_by === user.id);
    }

    // Utente normale vede solo i propri
    return allLists.filter((pl) => pl.created_by === user.id);
  }

  describe('BYOC - Visualizzazione', () => {
    const byocUser: User = {
      id: 'byoc-user-123',
      email: 'byoc@test.local',
      account_type: 'byoc',
      is_reseller: false,
    };

    it('BYOC vede SOLO i propri listini supplier', () => {
      const visible = getVisiblePriceLists(byocUser, allPriceLists);

      expect(visible.length).toBe(2); // Solo i 2 listini di byoc-user-123
      expect(visible.every((pl) => pl.created_by === byocUser.id)).toBe(true);
      expect(visible.every((pl) => pl.list_type === 'supplier')).toBe(true);
    });

    it('BYOC NON vede listini globali', () => {
      const visible = getVisiblePriceLists(byocUser, allPriceLists);

      const globalLists = visible.filter((pl) => pl.is_global);
      expect(globalLists.length).toBe(0);
    });

    it('BYOC NON vede listini di altri utenti', () => {
      const visible = getVisiblePriceLists(byocUser, allPriceLists);

      const othersLists = visible.filter((pl) => pl.created_by !== byocUser.id);
      expect(othersLists.length).toBe(0);
    });
  });

  describe('Reseller - Visualizzazione', () => {
    const resellerUser: User = {
      id: 'reseller-user-456',
      email: 'reseller@test.local',
      account_type: 'user',
      is_reseller: true,
    };

    it('Reseller vede SOLO i propri listini supplier', () => {
      const visible = getVisiblePriceLists(resellerUser, allPriceLists);

      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe('pl-reseller-1');
    });

    it('Reseller NON vede listini globali', () => {
      const visible = getVisiblePriceLists(resellerUser, allPriceLists);

      const globalLists = visible.filter((pl) => pl.is_global);
      expect(globalLists.length).toBe(0);
    });

    it('Reseller NON vede listini BYOC', () => {
      const visible = getVisiblePriceLists(resellerUser, allPriceLists);

      const byocLists = visible.filter((pl) => pl.created_by.includes('byoc'));
      expect(byocLists.length).toBe(0);
    });
  });

  describe('Admin - Visualizzazione', () => {
    const adminUser: User = {
      id: 'admin-user',
      email: 'admin@test.local',
      account_type: 'admin',
      is_reseller: false,
    };

    it('Admin vede TUTTI i listini', () => {
      const visible = getVisiblePriceLists(adminUser, allPriceLists);

      expect(visible.length).toBe(allPriceLists.length);
    });

    it('Admin vede listini globali', () => {
      const visible = getVisiblePriceLists(adminUser, allPriceLists);

      const globalLists = visible.filter((pl) => pl.is_global);
      expect(globalLists.length).toBe(2);
    });

    it('Admin vede listini di tutti gli utenti', () => {
      const visible = getVisiblePriceLists(adminUser, allPriceLists);

      const uniqueCreators = new Set(visible.map((pl) => pl.created_by));
      expect(uniqueCreators.size).toBeGreaterThan(1);
    });
  });
});

describe('Validazione Input Listini', () => {
  describe('list_type Validation', () => {
    const validListTypes: ListType[] = ['global', 'supplier', 'custom'];

    it('dovrebbe accettare solo list_type validi', () => {
      function validateListType(listType: string): { valid: boolean; error?: string } {
        if (!validListTypes.includes(listType as ListType)) {
          return {
            valid: false,
            error: `list_type deve essere uno di: ${validListTypes.join(', ')}`,
          };
        }
        return { valid: true };
      }

      expect(validateListType('supplier').valid).toBe(true);
      expect(validateListType('global').valid).toBe(true);
      expect(validateListType('custom').valid).toBe(true);

      expect(validateListType('invalid').valid).toBe(false);
      expect(validateListType('').valid).toBe(false);
      expect(validateListType('SUPPLIER').valid).toBe(false); // Case sensitive
    });
  });

  describe('courier_id Validation', () => {
    it('dovrebbe validare formato UUID courier_id', () => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      function validateCourierId(courierId: string): { valid: boolean; error?: string } {
        if (!courierId) {
          return { valid: false, error: 'courier_id è obbligatorio' };
        }
        if (!uuidRegex.test(courierId)) {
          return { valid: false, error: 'courier_id deve essere un UUID valido' };
        }
        return { valid: true };
      }

      // UUID valido
      expect(validateCourierId('550e8400-e29b-41d4-a716-446655440000').valid).toBe(true);

      // UUID non valido
      expect(validateCourierId('not-a-uuid').valid).toBe(false);
      expect(validateCourierId('').valid).toBe(false);
    });
  });
});
