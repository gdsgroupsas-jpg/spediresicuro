/**
 * Test: Visibilita listini assegnati nel Preventivatore
 *
 * Bug fix: il reseller non vedeva i corrieri nel Preventivatore perche
 * la query filtrava solo per workspace_id, ignorando i listini assegnati
 * dal superadmin tramite workspaces.assigned_price_list_id.
 *
 * Verifica:
 * - Logica filtro OR (workspace_id OR assigned_price_list_id)
 * - Fallback a solo workspace_id se nessun assigned
 * - Deduplicazione risultati
 * - Sicurezza: non espone listini di altri workspace
 */

import { describe, expect, it } from 'vitest';

// Simula la logica di filtro come nelle server action fixate
interface MockPriceList {
  id: string;
  name: string;
  workspace_id: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
}

/**
 * Replica la logica di filtro usata in getAvailableCarriersForQuotesAction
 * e createCommercialQuoteAction dopo il fix.
 */
function filterAccessiblePriceLists(
  allPriceLists: MockPriceList[],
  workspaceId: string,
  assignedPriceListId: string | null
): MockPriceList[] {
  return allPriceLists.filter((pl) => {
    if (pl.status !== 'active') return false;

    if (assignedPriceListId) {
      // OR: listino del workspace OPPURE listino assegnato
      return pl.workspace_id === workspaceId || pl.id === assignedPriceListId;
    } else {
      // Solo listini del workspace
      return pl.workspace_id === workspaceId;
    }
  });
}

/**
 * Simula la ricerca per contract_code come in createCommercialQuoteAction
 */
function findPriceListByContractCode(
  priceLists: MockPriceList[],
  contractCode: string
): MockPriceList | undefined {
  return priceLists.find(
    (p) => (p.metadata as Record<string, unknown>)?.contract_code === contractCode
  );
}

// Dati di test
const WORKSPACE_RESELLER = 'ws-reseller-001';
const WORKSPACE_PLATFORM = 'ws-platform-000';
const WORKSPACE_OTHER = 'ws-other-999';
const ASSIGNED_PL_ID = 'pl-assigned-gls';

const mockPriceLists: MockPriceList[] = [
  // Listino assegnato dal superadmin (workspace_id del platform, NON del reseller)
  {
    id: ASSIGNED_PL_ID,
    name: 'GLS Standard',
    workspace_id: WORKSPACE_PLATFORM,
    status: 'active',
    metadata: { contract_code: 'gls-standard', carrier_code: 'gls' },
  },
  // Listino custom creato dal reseller nel suo workspace
  {
    id: 'pl-custom-brt',
    name: 'BRT Custom Reseller',
    workspace_id: WORKSPACE_RESELLER,
    status: 'active',
    metadata: { contract_code: 'brt-custom', carrier_code: 'brt' },
  },
  // Listino di un altro workspace (NON deve essere visibile)
  {
    id: 'pl-other-sda',
    name: 'SDA Other',
    workspace_id: WORKSPACE_OTHER,
    status: 'active',
    metadata: { contract_code: 'sda-other', carrier_code: 'sda' },
  },
  // Listino inattivo del reseller (NON deve apparire)
  {
    id: 'pl-inactive',
    name: 'Poste Inactive',
    workspace_id: WORKSPACE_RESELLER,
    status: 'inactive',
    metadata: { contract_code: 'poste-old', carrier_code: 'poste' },
  },
  // Listino globale senza workspace (NON deve apparire per reseller)
  {
    id: 'pl-global-supplier',
    name: 'Supplier Globale',
    workspace_id: null,
    status: 'active',
    metadata: { contract_code: 'supplier-global', carrier_code: 'gls' },
  },
];

describe('Preventivatore - Visibilita listini assegnati', () => {
  describe('Reseller CON assigned_price_list_id', () => {
    it('dovrebbe vedere il listino assegnato dal superadmin', () => {
      const result = filterAccessiblePriceLists(mockPriceLists, WORKSPACE_RESELLER, ASSIGNED_PL_ID);

      const ids = result.map((pl) => pl.id);
      expect(ids).toContain(ASSIGNED_PL_ID);
    });

    it('dovrebbe vedere anche i listini custom del proprio workspace', () => {
      const result = filterAccessiblePriceLists(mockPriceLists, WORKSPACE_RESELLER, ASSIGNED_PL_ID);

      const ids = result.map((pl) => pl.id);
      expect(ids).toContain('pl-custom-brt');
    });

    it('dovrebbe restituire esattamente 2 listini (assegnato + custom workspace)', () => {
      const result = filterAccessiblePriceLists(mockPriceLists, WORKSPACE_RESELLER, ASSIGNED_PL_ID);

      expect(result).toHaveLength(2);
    });

    it('NON dovrebbe vedere listini di altri workspace', () => {
      const result = filterAccessiblePriceLists(mockPriceLists, WORKSPACE_RESELLER, ASSIGNED_PL_ID);

      const ids = result.map((pl) => pl.id);
      expect(ids).not.toContain('pl-other-sda');
    });

    it('NON dovrebbe vedere listini inattivi', () => {
      const result = filterAccessiblePriceLists(mockPriceLists, WORKSPACE_RESELLER, ASSIGNED_PL_ID);

      const ids = result.map((pl) => pl.id);
      expect(ids).not.toContain('pl-inactive');
    });

    it('NON dovrebbe vedere listini globali senza workspace', () => {
      const result = filterAccessiblePriceLists(mockPriceLists, WORKSPACE_RESELLER, ASSIGNED_PL_ID);

      const ids = result.map((pl) => pl.id);
      expect(ids).not.toContain('pl-global-supplier');
    });

    it('dovrebbe trovare listino assegnato tramite contract_code', () => {
      const accessible = filterAccessiblePriceLists(
        mockPriceLists,
        WORKSPACE_RESELLER,
        ASSIGNED_PL_ID
      );

      const found = findPriceListByContractCode(accessible, 'gls-standard');
      expect(found).toBeDefined();
      expect(found!.id).toBe(ASSIGNED_PL_ID);
    });

    it('dovrebbe trovare listino custom tramite contract_code', () => {
      const accessible = filterAccessiblePriceLists(
        mockPriceLists,
        WORKSPACE_RESELLER,
        ASSIGNED_PL_ID
      );

      const found = findPriceListByContractCode(accessible, 'brt-custom');
      expect(found).toBeDefined();
      expect(found!.id).toBe('pl-custom-brt');
    });
  });

  describe('Reseller SENZA assigned_price_list_id', () => {
    it('dovrebbe vedere solo listini del proprio workspace', () => {
      const result = filterAccessiblePriceLists(mockPriceLists, WORKSPACE_RESELLER, null);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pl-custom-brt');
    });

    it('NON dovrebbe vedere listini assegnati ad altri', () => {
      const result = filterAccessiblePriceLists(mockPriceLists, WORKSPACE_RESELLER, null);

      const ids = result.map((pl) => pl.id);
      expect(ids).not.toContain(ASSIGNED_PL_ID);
    });

    it('NON dovrebbe vedere listini globali', () => {
      const result = filterAccessiblePriceLists(mockPriceLists, WORKSPACE_RESELLER, null);

      const ids = result.map((pl) => pl.id);
      expect(ids).not.toContain('pl-global-supplier');
    });
  });

  describe('Deduplicazione', () => {
    it('NON dovrebbe duplicare se listino assegnato ha stesso workspace_id', () => {
      // Scenario: superadmin assegna un listino che e' gia' nel workspace del reseller
      const localPriceLists: MockPriceList[] = [
        {
          id: 'pl-same',
          name: 'Listino Locale',
          workspace_id: WORKSPACE_RESELLER,
          status: 'active',
          metadata: { contract_code: 'local-gls', carrier_code: 'gls' },
        },
      ];

      // Assegnato = stesso listino che e' gia' nel workspace
      const result = filterAccessiblePriceLists(localPriceLists, WORKSPACE_RESELLER, 'pl-same');

      // Deve apparire una sola volta (match sia per workspace_id che per id)
      expect(result).toHaveLength(1);
    });
  });

  describe('Sicurezza - isolamento multi-tenant', () => {
    it('workspace A NON dovrebbe vedere listini assegnati a workspace B', () => {
      const assignedToB = 'pl-assigned-to-b';
      const priceLists: MockPriceList[] = [
        {
          id: assignedToB,
          name: 'Assegnato a B',
          workspace_id: 'ws-b',
          status: 'active',
          metadata: { contract_code: 'b-gls', carrier_code: 'gls' },
        },
      ];

      // Workspace A chiede i suoi listini, con assigned che punta al listino di B
      // Ma il sistema non deve restituirlo perche' non e' assegnato ad A
      const result = filterAccessiblePriceLists(priceLists, 'ws-a', null);
      expect(result).toHaveLength(0);
    });

    it('un assigned_price_list_id valido deve matchare solo quel preciso ID', () => {
      const priceLists: MockPriceList[] = [
        {
          id: 'pl-target',
          name: 'Target',
          workspace_id: 'ws-other',
          status: 'active',
          metadata: { contract_code: 'target', carrier_code: 'gls' },
        },
        {
          id: 'pl-not-target',
          name: 'Not Target',
          workspace_id: 'ws-other',
          status: 'active',
          metadata: { contract_code: 'not-target', carrier_code: 'brt' },
        },
      ];

      const result = filterAccessiblePriceLists(priceLists, 'ws-mine', 'pl-target');

      // Solo il listino assegnato, non altri dello stesso workspace esterno
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pl-target');
    });
  });
});
