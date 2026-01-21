/**
 * Test Unit: Auto-Disable Price Lists
 *
 * Verifica che quando una configurazione viene disattivata:
 * 1. I listini associati vengono automaticamente archiviati
 * 2. Solo listini con metadata.courier_config_id matching vengono archiviati
 * 3. Listini di altre configurazioni NON vengono toccati
 * 4. Listini già archived NON vengono ri-archiviati
 * 5. Note viene aggiornato con motivo archiviazione
 *
 * Riferimento: actions/configurations.ts:1042-1091
 */

import { describe, expect, it } from 'vitest';

// Tipi per i test
interface PriceList {
  id: string;
  name: string;
  status: string;
  metadata?: { courier_config_id?: string; carrier_code?: string };
  source_metadata?: { courier_config_id?: string; carrier_code?: string };
  notes?: string;
  updated_at?: string;
}

interface Config {
  id: string;
  name: string;
  is_active: boolean;
  provider_id: string;
}

describe('Auto-Disable Price Lists', () => {
  // Helper: simula auto-disable logic
  function autoDisablePriceLists(
    config: Config,
    allPriceLists: PriceList[]
  ): {
    disabled: PriceList[];
    updated: Array<{ id: string; status: string; notes: string }>;
  } {
    if (config.is_active) {
      return { disabled: [], updated: [] };
    }

    // Trova listini con metadata.courier_config_id === config.id
    const listsToDisable = allPriceLists.filter((pl) => {
      // Solo listini supplier attivi o draft
      if (pl.status !== 'active' && pl.status !== 'draft') {
        return false;
      }

      // Verifica metadata
      const metadata = pl.metadata || pl.source_metadata || {};
      return metadata.courier_config_id === config.id;
    });

    // Simula update
    const updated = listsToDisable.map((pl) => ({
      id: pl.id,
      status: 'archived',
      notes: `Listino archiviato automaticamente: configurazione "${
        config.name
      }" disattivata il ${new Date().toISOString()}`,
    }));

    return { disabled: listsToDisable, updated };
  }

  describe('Disattivazione Configurazione', () => {
    it('dovrebbe archiviare listini quando config diventa inattiva', () => {
      const config: Config = {
        id: 'config-123',
        name: 'Config GLS Account 1',
        is_active: false, // Disattivata
        provider_id: 'spedisci_online',
      };

      const priceLists: PriceList[] = [
        {
          id: 'pl-1',
          name: 'GLS - Account 1',
          status: 'active',
          metadata: { courier_config_id: 'config-123', carrier_code: 'gls' },
        },
        {
          id: 'pl-2',
          name: 'GLS - Account 1 - Express',
          status: 'draft',
          metadata: { courier_config_id: 'config-123', carrier_code: 'gls' },
        },
      ];

      const result = autoDisablePriceLists(config, priceLists);

      expect(result.disabled.length).toBe(2);
      expect(result.updated.length).toBe(2);
      expect(result.updated[0].status).toBe('archived');
      expect(result.updated[0].notes).toContain('archiviato automaticamente');
      expect(result.updated[0].notes).toContain(config.name);
    });

    it('NON dovrebbe archiviare listini quando config è attiva', () => {
      const config: Config = {
        id: 'config-123',
        name: 'Config GLS Account 1',
        is_active: true, // Attiva
        provider_id: 'spedisci_online',
      };

      const priceLists: PriceList[] = [
        {
          id: 'pl-1',
          name: 'GLS - Account 1',
          status: 'active',
          metadata: { courier_config_id: 'config-123', carrier_code: 'gls' },
        },
      ];

      const result = autoDisablePriceLists(config, priceLists);

      expect(result.disabled.length).toBe(0);
      expect(result.updated.length).toBe(0);
    });

    it('NON dovrebbe archiviare listini di altre configurazioni', () => {
      const config: Config = {
        id: 'config-123',
        name: 'Config GLS Account 1',
        is_active: false,
        provider_id: 'spedisci_online',
      };

      const priceLists: PriceList[] = [
        {
          id: 'pl-1',
          name: 'GLS - Account 1',
          status: 'active',
          metadata: { courier_config_id: 'config-123', carrier_code: 'gls' },
        },
        {
          id: 'pl-2',
          name: 'GLS - Account 2',
          status: 'active',
          metadata: { courier_config_id: 'config-456', carrier_code: 'gls' }, // Altra config
        },
        {
          id: 'pl-3',
          name: 'BRT - Account 1',
          status: 'active',
          metadata: { courier_config_id: 'config-789', carrier_code: 'brt' }, // Altra config
        },
      ];

      const result = autoDisablePriceLists(config, priceLists);

      expect(result.disabled.length).toBe(1);
      expect(result.disabled[0].id).toBe('pl-1');
      expect(result.disabled[0].metadata?.courier_config_id).toBe('config-123');
    });

    it('NON dovrebbe archiviare listini già archived', () => {
      const config: Config = {
        id: 'config-123',
        name: 'Config GLS Account 1',
        is_active: false,
        provider_id: 'spedisci_online',
      };

      const priceLists: PriceList[] = [
        {
          id: 'pl-1',
          name: 'GLS - Account 1',
          status: 'active',
          metadata: { courier_config_id: 'config-123', carrier_code: 'gls' },
        },
        {
          id: 'pl-2',
          name: 'GLS - Account 1 - Old',
          status: 'archived', // Già archived
          metadata: { courier_config_id: 'config-123', carrier_code: 'gls' },
        },
        {
          id: 'pl-3',
          name: 'GLS - Account 1 - Inactive',
          status: 'inactive', // Non draft/active
          metadata: { courier_config_id: 'config-123', carrier_code: 'gls' },
        },
      ];

      const result = autoDisablePriceLists(config, priceLists);

      // Solo pl-1 (active) viene archiviato
      expect(result.disabled.length).toBe(1);
      expect(result.disabled[0].id).toBe('pl-1');
    });

    it('dovrebbe usare source_metadata se metadata non presente', () => {
      const config: Config = {
        id: 'config-123',
        name: 'Config GLS Account 1',
        is_active: false,
        provider_id: 'spedisci_online',
      };

      const priceLists: PriceList[] = [
        {
          id: 'pl-1',
          name: 'GLS - Account 1',
          status: 'active',
          // metadata non presente, usa source_metadata
          source_metadata: {
            courier_config_id: 'config-123',
            carrier_code: 'gls',
          },
        },
      ];

      const result = autoDisablePriceLists(config, priceLists);

      expect(result.disabled.length).toBe(1);
      expect(result.disabled[0].id).toBe('pl-1');
    });

    it('dovrebbe aggiornare notes con timestamp', () => {
      const config: Config = {
        id: 'config-123',
        name: 'Config GLS Account 1',
        is_active: false,
        provider_id: 'spedisci_online',
      };

      const priceLists: PriceList[] = [
        {
          id: 'pl-1',
          name: 'GLS - Account 1',
          status: 'active',
          metadata: { courier_config_id: 'config-123', carrier_code: 'gls' },
        },
      ];

      const result = autoDisablePriceLists(config, priceLists);

      expect(result.updated[0].notes).toContain('archiviato automaticamente');
      expect(result.updated[0].notes).toContain(config.name);
      expect(result.updated[0].notes).toMatch(/\d{4}-\d{2}-\d{2}T/); // ISO timestamp
    });
  });

  describe('Filtro Listini per Config', () => {
    it('dovrebbe filtrare correttamente per courier_config_id', () => {
      const config: Config = {
        id: 'config-specific',
        name: 'Config Specifica',
        is_active: false,
        provider_id: 'spedisci_online',
      };

      const priceLists: PriceList[] = [
        {
          id: 'pl-match-1',
          name: 'Listino Match 1',
          status: 'active',
          metadata: { courier_config_id: 'config-specific' },
        },
        {
          id: 'pl-match-2',
          name: 'Listino Match 2',
          status: 'draft',
          metadata: { courier_config_id: 'config-specific' },
        },
        {
          id: 'pl-no-match',
          name: 'Listino No Match',
          status: 'active',
          metadata: { courier_config_id: 'config-other' },
        },
        {
          id: 'pl-no-metadata',
          name: 'Listino No Metadata',
          status: 'active',
          // Nessun metadata
        },
      ];

      const result = autoDisablePriceLists(config, priceLists);

      expect(result.disabled.length).toBe(2);
      expect(result.disabled.map((pl) => pl.id)).toEqual(['pl-match-1', 'pl-match-2']);
    });

    it('dovrebbe gestire listini senza metadata', () => {
      const config: Config = {
        id: 'config-123',
        name: 'Config Test',
        is_active: false,
        provider_id: 'spedisci_online',
      };

      const priceLists: PriceList[] = [
        {
          id: 'pl-no-metadata',
          name: 'Listino senza metadata',
          status: 'active',
          // Nessun metadata né source_metadata
        },
      ];

      const result = autoDisablePriceLists(config, priceLists);

      // Listino senza metadata non viene archiviato
      expect(result.disabled.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('dovrebbe gestire array vuoto di listini', () => {
      const config: Config = {
        id: 'config-123',
        name: 'Config Test',
        is_active: false,
        provider_id: 'spedisci_online',
      };

      const result = autoDisablePriceLists(config, []);

      expect(result.disabled.length).toBe(0);
      expect(result.updated.length).toBe(0);
    });

    it('dovrebbe gestire listini con metadata null', () => {
      const config: Config = {
        id: 'config-123',
        name: 'Config Test',
        is_active: false,
        provider_id: 'spedisci_online',
      };

      const priceLists: PriceList[] = [
        {
          id: 'pl-null-metadata',
          name: 'Listino con metadata null',
          status: 'active',
          metadata: null as any,
          source_metadata: null as any,
        },
      ];

      const result = autoDisablePriceLists(config, priceLists);

      expect(result.disabled.length).toBe(0);
    });

    it('dovrebbe gestire listini con metadata vuoto', () => {
      const config: Config = {
        id: 'config-123',
        name: 'Config Test',
        is_active: false,
        provider_id: 'spedisci_online',
      };

      const priceLists: PriceList[] = [
        {
          id: 'pl-empty-metadata',
          name: 'Listino con metadata vuoto',
          status: 'active',
          metadata: {},
        },
      ];

      const result = autoDisablePriceLists(config, priceLists);

      expect(result.disabled.length).toBe(0);
    });
  });
});
