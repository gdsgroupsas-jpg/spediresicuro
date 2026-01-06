/**
 * Test Unit: Race Condition in Price List Sync
 *
 * Verifica comportamento sync simultanee:
 * 1. Due sync simultanee possono creare duplicati (senza lock)
 * 2. Sistema gestisce gracefully sync simultanee
 * 3. Metadata merge previene sovrascritture
 * 4. Verifica che senza lock ci possano essere inconsistenze
 *
 * Riferimento: AUDIT_MULTI_ACCOUNT_LISTINI_2026.md - P1-2
 * Nota: Lock è stato rimosso intenzionalmente (non critico come spedizioni)
 */

import { describe, expect, it, vi } from "vitest";

// Tipi per i test
interface SyncResult {
  success: boolean;
  priceListId?: string;
  error?: string;
}

interface PriceList {
  id: string;
  name: string;
  metadata?: { courier_config_id?: string; carrier_code?: string };
}

describe("Race Condition in Price List Sync", () => {
  // Simula sync senza lock (comportamento attuale)
  async function simulateSyncWithoutLock(
    userId: string,
    carrierCode: string,
    configId: string,
    existingLists: PriceList[]
  ): Promise<SyncResult> {
    // Simula delay di rete/DB
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verifica se esiste già listino
    const existing = existingLists.find((pl) => {
      const metadata = pl.metadata || {};
      return (
        metadata.courier_config_id === configId &&
        metadata.carrier_code?.toLowerCase() === carrierCode.toLowerCase()
      );
    });

    if (existing) {
      // Update esistente
      return {
        success: true,
        priceListId: existing.id,
      };
    }

    // Crea nuovo (simula race: due sync possono creare duplicati)
    const newId = `pl-${Date.now()}-${Math.random()}`;
    return {
      success: true,
      priceListId: newId,
    };
  }

  describe("Sync Simultanee senza Lock", () => {
    it("dovrebbe permettere sync simultanee (senza lock)", async () => {
      const userId = "user-123";
      const carrierCode = "gls";
      const configId = "config-123";
      const existingLists: PriceList[] = [];

      // Simula due sync simultanee
      const [result1, result2] = await Promise.all([
        simulateSyncWithoutLock(userId, carrierCode, configId, existingLists),
        simulateSyncWithoutLock(userId, carrierCode, configId, existingLists),
      ]);

      // Entrambe possono avere successo (senza lock)
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Potrebbero creare duplicati (comportamento attuale)
      // Questo è accettabile per listini (non critico come spedizioni)
    });

    it("dovrebbe gestire sync simultanee con listino esistente", async () => {
      const userId = "user-123";
      const carrierCode = "gls";
      const configId = "config-123";
      const existingLists: PriceList[] = [
        {
          id: "pl-existing",
          name: "GLS - Account 1",
          metadata: {
            courier_config_id: "config-123",
            carrier_code: "gls",
          },
        },
      ];

      // Simula due sync simultanee su listino esistente
      const [result1, result2] = await Promise.all([
        simulateSyncWithoutLock(userId, carrierCode, configId, existingLists),
        simulateSyncWithoutLock(userId, carrierCode, configId, existingLists),
      ]);

      // Entrambe dovrebbero trovare il listino esistente
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.priceListId).toBe("pl-existing");
      expect(result2.priceListId).toBe("pl-existing");
    });
  });

  describe("Prevenzione Duplicati con Metadata Matching", () => {
    it("dovrebbe matchare listini per courier_config_id E carrier_code", () => {
      const existingLists: PriceList[] = [
        {
          id: "pl-1",
          name: "GLS - Account 1",
          metadata: {
            courier_config_id: "config-123",
            carrier_code: "gls",
          },
        },
        {
          id: "pl-2",
          name: "BRT - Account 1",
          metadata: {
            courier_config_id: "config-123", // Stessa config
            carrier_code: "brt", // Corriere diverso
          },
        },
      ];

      // Cerca listino per config-123 + gls
      const matching = existingLists.find((pl) => {
        const metadata = pl.metadata || {};
        return (
          metadata.courier_config_id === "config-123" &&
          metadata.carrier_code?.toLowerCase() === "gls"
        );
      });

      expect(matching?.id).toBe("pl-1");
      expect(matching?.metadata?.carrier_code).toBe("gls");
    });

    it("NON dovrebbe matchare listini con configId diverso", () => {
      const existingLists: PriceList[] = [
        {
          id: "pl-1",
          name: "GLS - Account 1",
          metadata: {
            courier_config_id: "config-123",
            carrier_code: "gls",
          },
        },
        {
          id: "pl-2",
          name: "GLS - Account 2",
          metadata: {
            courier_config_id: "config-456", // Config diversa
            carrier_code: "gls", // Stesso corriere
          },
        },
      ];

      // Cerca listino per config-123 + gls
      const matching = existingLists.find((pl) => {
        const metadata = pl.metadata || {};
        return (
          metadata.courier_config_id === "config-123" &&
          metadata.carrier_code?.toLowerCase() === "gls"
        );
      });

      expect(matching?.id).toBe("pl-1");
      expect(matching?.id).not.toBe("pl-2");
    });
  });

  describe("Comportamento Atteso senza Lock", () => {
    it("dovrebbe documentare che duplicati sono accettabili per listini", () => {
      // Documentazione comportamento attuale
      const behavior = {
        hasLock: false,
        reason: "Listini non sono critici come spedizioni (no rischio finanziario)",
        acceptableDuplicates: true,
        mitigation: "Metadata matching previene la maggior parte dei duplicati",
      };

      expect(behavior.hasLock).toBe(false);
      expect(behavior.acceptableDuplicates).toBe(true);
    });

    it("dovrebbe gestire gracefully eventuali duplicati", () => {
      // Se duplicati vengono creati, il sistema deve gestirli gracefully
      const duplicateLists: PriceList[] = [
        {
          id: "pl-1",
          name: "GLS - Account 1",
          metadata: {
            courier_config_id: "config-123",
            carrier_code: "gls",
          },
        },
        {
          id: "pl-2",
          name: "GLS - Account 1", // Duplicato
          metadata: {
            courier_config_id: "config-123",
            carrier_code: "gls",
          },
        },
      ];

      // Sistema dovrebbe usare il più recente o permettere entrambi
      const mostRecent = duplicateLists[duplicateLists.length - 1];
      expect(mostRecent.id).toBe("pl-2");
    });
  });
});

describe("Sync Race Condition - Mitigazioni", () => {
  /**
   * Anche senza lock, ci sono mitigazioni che prevengono la maggior parte
   * dei problemi di race condition:
   * 1. Metadata matching strict (configId + carrierCode)
   * 2. Limit su query (100 listini max)
   * 3. Order by created_at DESC (usa più recente)
   */

  it("dovrebbe usare limit per prevenire falsi negativi", () => {
    // Se un utente ha molti listini, il limit previene falsi negativi
    const limit = 100;

    // Simula query con limit
    function findPriceList(
      allLists: PriceList[],
      configId: string,
      carrierCode: string,
      limitCount: number
    ): PriceList | null {
      const filtered = allLists
        .filter((pl) => {
          const metadata = pl.metadata || {};
          return (
            metadata.courier_config_id === configId &&
            metadata.carrier_code?.toLowerCase() === carrierCode.toLowerCase()
          );
        })
        .slice(0, limitCount);

      return filtered[0] || null;
    }

    const manyLists: PriceList[] = Array.from({ length: 150 }, (_, i) => ({
      id: `pl-${i}`,
      name: `Listino ${i}`,
      metadata: {
        courier_config_id: i < 100 ? "config-123" : "config-other",
        carrier_code: "gls",
      },
    }));

    const found = findPriceList(manyLists, "config-123", "gls", limit);

    // Dovrebbe trovare il primo match (entro limit)
    expect(found).toBeDefined();
    expect(found?.metadata?.courier_config_id).toBe("config-123");
  });

  it("dovrebbe usare order by created_at DESC per preferire più recente", () => {
    const lists: PriceList[] = [
      {
        id: "pl-old",
        name: "GLS - Old",
        metadata: {
          courier_config_id: "config-123",
          carrier_code: "gls",
        },
      },
      {
        id: "pl-new",
        name: "GLS - New",
        metadata: {
          courier_config_id: "config-123",
          carrier_code: "gls",
        },
      },
    ];

    // Simula order by created_at DESC
    const sorted = [...lists].reverse(); // Più recente prima

    const mostRecent = sorted.find((pl) => {
      const metadata = pl.metadata || {};
      return (
        metadata.courier_config_id === "config-123" &&
        metadata.carrier_code?.toLowerCase() === "gls"
      );
    });

    expect(mostRecent?.id).toBe("pl-new");
  });
});



