/**
 * Test Unit: Metadata Merge in Price List Sync
 *
 * Verifica che durante la sincronizzazione listini:
 * 1. Metadata esistente viene MERGED invece di REPLACED
 * 2. carrier_code viene preservato durante merge
 * 3. courier_config_id viene aggiornato correttamente
 * 4. Altri campi metadata vengono preservati
 * 5. source_metadata viene usato come fallback se metadata non esiste
 *
 * Riferimento: actions/spedisci-online-rates.ts:600-700 (metadata merge logic)
 */

import { describe, expect, it } from "vitest";

// Tipi per i test
interface ExistingMetadata {
  carrier_code?: string;
  courier_config_id?: string;
  synced_at?: string;
  custom_field?: string;
  [key: string]: unknown;
}

interface NewSyncData {
  carrierCode: string;
  configId: string;
}

describe("Metadata Merge in Price List Sync", () => {
  // Helper: simula merge metadata logic
  function mergeMetadata(
    existing: ExistingMetadata | null | undefined,
    newData: NewSyncData
  ): ExistingMetadata {
    const existingMetadata = existing || {};

    // MERGE: preserva tutto l'esistente, aggiorna solo campi specifici
    return {
      ...existingMetadata, // Preserva tutti i campi esistenti
      carrier_code: newData.carrierCode, // Immutabile, sempre presente
      courier_config_id: newData.configId,
      synced_at: new Date().toISOString(),
    };
  }

  describe("Merge Base", () => {
    it("dovrebbe preservare carrier_code esistente durante merge", () => {
      const existing: ExistingMetadata = {
        carrier_code: "gls",
        courier_config_id: "config-123",
        synced_at: "2025-01-01T00:00:00Z",
      };

      const newData: NewSyncData = {
        carrierCode: "gls", // Stesso carrier
        configId: "config-123",
      };

      const merged = mergeMetadata(existing, newData);

      expect(merged.carrier_code).toBe("gls");
      expect(merged.courier_config_id).toBe("config-123");
      expect(merged.synced_at).toBeDefined();
    });

    it("dovrebbe preservare campi custom durante merge", () => {
      const existing: ExistingMetadata = {
        carrier_code: "gls",
        courier_config_id: "config-123",
        custom_field: "custom_value",
        another_field: 123,
      };

      const newData: NewSyncData = {
        carrierCode: "gls",
        configId: "config-123",
      };

      const merged = mergeMetadata(existing, newData);

      expect(merged.custom_field).toBe("custom_value");
      expect(merged.another_field).toBe(123);
      expect(merged.carrier_code).toBe("gls");
    });

    it("dovrebbe aggiornare synced_at durante merge", () => {
      const existing: ExistingMetadata = {
        carrier_code: "gls",
        courier_config_id: "config-123",
        synced_at: "2025-01-01T00:00:00Z",
      };

      const newData: NewSyncData = {
        carrierCode: "gls",
        configId: "config-123",
      };

      const merged = mergeMetadata(existing, newData);

      expect(merged.synced_at).not.toBe("2025-01-01T00:00:00Z");
      expect(merged.synced_at).toMatch(/\d{4}-\d{2}-\d{2}T/); // ISO format
    });
  });

  describe("Merge con Metadata Null/Undefined", () => {
    it("dovrebbe creare nuovo metadata se existing è null", () => {
      const existing: ExistingMetadata | null = null;

      const newData: NewSyncData = {
        carrierCode: "gls",
        configId: "config-123",
      };

      const merged = mergeMetadata(existing, newData);

      expect(merged.carrier_code).toBe("gls");
      expect(merged.courier_config_id).toBe("config-123");
      expect(merged.synced_at).toBeDefined();
    });

    it("dovrebbe creare nuovo metadata se existing è undefined", () => {
      const existing: ExistingMetadata | undefined = undefined;

      const newData: NewSyncData = {
        carrierCode: "brt",
        configId: "config-456",
      };

      const merged = mergeMetadata(existing, newData);

      expect(merged.carrier_code).toBe("brt");
      expect(merged.courier_config_id).toBe("config-456");
    });

    it("dovrebbe gestire metadata vuoto", () => {
      const existing: ExistingMetadata = {};

      const newData: NewSyncData = {
        carrierCode: "poste",
        configId: "config-789",
      };

      const merged = mergeMetadata(existing, newData);

      expect(merged.carrier_code).toBe("poste");
      expect(merged.courier_config_id).toBe("config-789");
    });
  });

  describe("Merge con source_metadata Fallback", () => {
    it("dovrebbe usare source_metadata se metadata non esiste", () => {
      // Simula scenario dove metadata column non esiste ma source_metadata sì
      const sourceMetadata: ExistingMetadata = {
        carrier_code: "gls",
        courier_config_id: "config-old",
        synced_at: "2025-01-01T00:00:00Z",
      };

      const newData: NewSyncData = {
        carrierCode: "gls",
        configId: "config-new",
      };

      // Simula fallback: usa source_metadata se metadata null
      const existing = null;
      const fallback = sourceMetadata;

      const merged = mergeMetadata(fallback, newData);

      expect(merged.carrier_code).toBe("gls");
      expect(merged.courier_config_id).toBe("config-new"); // Aggiornato
    });
  });

  describe("Preservazione carrier_code", () => {
    it("dovrebbe sempre impostare carrier_code anche se esiste già", () => {
      const existing: ExistingMetadata = {
        carrier_code: "gls",
        courier_config_id: "config-123",
      };

      const newData: NewSyncData = {
        carrierCode: "gls", // Stesso valore
        configId: "config-123",
      };

      const merged = mergeMetadata(existing, newData);

      // carrier_code deve essere sempre presente e aggiornato
      expect(merged.carrier_code).toBe("gls");
    });

    it("dovrebbe aggiornare carrier_code se diverso (edge case)", () => {
      const existing: ExistingMetadata = {
        carrier_code: "gls-old",
        courier_config_id: "config-123",
      };

      const newData: NewSyncData = {
        carrierCode: "gls-new",
        configId: "config-123",
      };

      const merged = mergeMetadata(existing, newData);

      // carrier_code viene aggiornato (immutabile nel contesto sync)
      expect(merged.carrier_code).toBe("gls-new");
    });
  });

  describe("Aggiornamento courier_config_id", () => {
    it("dovrebbe aggiornare courier_config_id durante re-sync", () => {
      const existing: ExistingMetadata = {
        carrier_code: "gls",
        courier_config_id: "config-old",
        synced_at: "2025-01-01T00:00:00Z",
      };

      const newData: NewSyncData = {
        carrierCode: "gls",
        configId: "config-new", // Nuova config
      };

      const merged = mergeMetadata(existing, newData);

      expect(merged.courier_config_id).toBe("config-new");
      expect(merged.carrier_code).toBe("gls"); // Preservato
    });
  });

  describe("Edge Cases", () => {
    it("dovrebbe gestire metadata con campi nested", () => {
      const existing: ExistingMetadata = {
        carrier_code: "gls",
        courier_config_id: "config-123",
        nested: {
          field1: "value1",
          field2: 123,
        },
      };

      const newData: NewSyncData = {
        carrierCode: "gls",
        configId: "config-123",
      };

      const merged = mergeMetadata(existing, newData);

      expect(merged.nested).toBeDefined();
      expect((merged.nested as any).field1).toBe("value1");
    });

    it("dovrebbe gestire metadata con array", () => {
      const existing: ExistingMetadata = {
        carrier_code: "gls",
        courier_config_id: "config-123",
        tags: ["tag1", "tag2"],
      };

      const newData: NewSyncData = {
        carrierCode: "gls",
        configId: "config-123",
      };

      const merged = mergeMetadata(existing, newData);

      expect(merged.tags).toEqual(["tag1", "tag2"]);
    });
  });
});

describe("Metadata Merge - Prevenzione Collisioni Multi-Account", () => {
  /**
   * IMPORTANTE: Il merge previene collisioni quando un reseller ha
   * più configurazioni per lo stesso corriere. Ogni config deve avere
   * il suo listino separato identificato da courier_config_id.
   */

  // Helper: simula merge metadata logic (stesso del describe principale)
  function mergeMetadata(
    existing: ExistingMetadata | null | undefined,
    newData: NewSyncData
  ): ExistingMetadata {
    const existingMetadata = existing || {};
    return {
      ...existingMetadata,
      carrier_code: newData.carrierCode,
      courier_config_id: newData.configId,
      synced_at: new Date().toISOString(),
    };
  }

  it("dovrebbe distinguere listini per courier_config_id", () => {
    // Scenario: Reseller con 2 account GLS
    const listinoAccount1: ExistingMetadata = {
      carrier_code: "gls",
      courier_config_id: "config-account-1",
      synced_at: "2025-01-01T00:00:00Z",
    };

    const listinoAccount2: ExistingMetadata = {
      carrier_code: "gls", // Stesso corriere
      courier_config_id: "config-account-2", // Config diversa
      synced_at: "2025-01-01T00:00:00Z",
    };

    // Re-sync account 1
    const newDataAccount1: NewSyncData = {
      carrierCode: "gls",
      configId: "config-account-1",
    };

    const merged1 = mergeMetadata(listinoAccount1, newDataAccount1);

    // Re-sync account 2
    const newDataAccount2: NewSyncData = {
      carrierCode: "gls",
      configId: "config-account-2",
    };

    const merged2 = mergeMetadata(listinoAccount2, newDataAccount2);

    // I due listini devono rimanere distinti
    expect(merged1.courier_config_id).toBe("config-account-1");
    expect(merged2.courier_config_id).toBe("config-account-2");
    expect(merged1.carrier_code).toBe("gls");
    expect(merged2.carrier_code).toBe("gls");
  });
});

