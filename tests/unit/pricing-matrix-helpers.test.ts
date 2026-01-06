/**
 * Test Unit: Pricing Matrix Helpers
 *
 * Test per le nuove funzioni helper di pricing-matrix.ts:
 * 1. getZonesForMode() - Restituisce zone per modalità sync
 * 2. getWeightsForMode() - Restituisce pesi per modalità sync
 * 3. estimateSyncCalls() - Stima chiamate API e tempo
 * 4. getZoneByCode() - Lookup zone con supporto legacy
 * 5. Zone allineate a Spedisci.Online
 */

import { describe, expect, it } from "vitest";
import {
  PRICING_MATRIX,
  getZoneByCode,
  getZonesForMode,
  getWeightsForMode,
  estimateSyncCalls,
} from "@/lib/constants/pricing-matrix";

describe("Pricing Matrix - Zone Definitions", () => {
  it("dovrebbe avere tutte le zone Italia", () => {
    const italyZoneCodes = PRICING_MATRIX.ZONES_ITALY_ONLY;

    expect(italyZoneCodes).toContain("IT-ITALIA");
    expect(italyZoneCodes).toContain("IT-SARDEGNA");
    expect(italyZoneCodes).toContain("IT-CALABRIA");
    expect(italyZoneCodes).toContain("IT-SICILIA");
    expect(italyZoneCodes).toContain("IT-LIVIGNO");
    expect(italyZoneCodes).toContain("IT-ISOLE-MINORI");
    expect(italyZoneCodes).toContain("IT-DISAGIATE");

    expect(italyZoneCodes.length).toBe(7);
  });

  it("dovrebbe avere zone Europa", () => {
    const euZones = PRICING_MATRIX.ZONES.filter((z) =>
      z.code.startsWith("EU-")
    );

    expect(euZones.length).toBe(2);
    expect(euZones.map((z) => z.code)).toContain("EU-ZONA1");
    expect(euZones.map((z) => z.code)).toContain("EU-ZONA2");
  });

  it("dovrebbe avere 9 zone totali", () => {
    // 7 Italia + 2 Europa = 9 zone
    expect(PRICING_MATRIX.ZONES.length).toBe(9);
  });

  it("ogni zona dovrebbe avere indirizzo di esempio completo", () => {
    PRICING_MATRIX.ZONES.forEach((zone) => {
      expect(zone.code).toBeDefined();
      expect(zone.name).toBeDefined();
      expect(zone.sampleAddress).toBeDefined();
      expect(zone.sampleAddress.city).toBeDefined();
      expect(zone.sampleAddress.postalCode).toBeDefined();
      expect(zone.sampleAddress.country).toBeDefined();

      // Verifica formato CAP italiano (5 cifre) o europeo
      if (zone.sampleAddress.country === "IT") {
        expect(zone.sampleAddress.postalCode).toMatch(/^\d{5}$/);
        expect(zone.sampleAddress.state).toMatch(/^[A-Z]{2}$/);
      }
    });
  });

  it("ogni zona Italia dovrebbe avere priorità definita", () => {
    const italyZones = PRICING_MATRIX.ZONES.filter((z) =>
      z.code.startsWith("IT-")
    );

    italyZones.forEach((zone) => {
      expect(zone.priority).toBeDefined();
      expect(zone.priority).toBeGreaterThan(0);
    });
  });
});

describe("Pricing Matrix - Legacy Zone Mapping", () => {
  it("dovrebbe mappare codici legacy a nuovi codici", () => {
    const legacyMap = PRICING_MATRIX.ZONE_LEGACY_MAP;

    expect(legacyMap["IT-STD"]).toBe("IT-ITALIA");
    expect(legacyMap["IT-CAL"]).toBe("IT-CALABRIA");
    expect(legacyMap["IT-SIC"]).toBe("IT-SICILIA");
    expect(legacyMap["IT-SAR"]).toBe("IT-SARDEGNA");
    expect(legacyMap["IT-VEN"]).toBe("IT-DISAGIATE");
    expect(legacyMap["IT-LIV"]).toBe("IT-LIVIGNO");
    expect(legacyMap["IT-ISO"]).toBe("IT-ISOLE-MINORI");
    expect(legacyMap["EU-Z1"]).toBe("EU-ZONA1");
  });
});

describe("getZoneByCode()", () => {
  it("dovrebbe trovare zona per codice diretto", () => {
    const zone = getZoneByCode("IT-ITALIA");
    expect(zone).toBeDefined();
    expect(zone?.name).toBe("Italia (Standard)");
    expect(zone?.sampleAddress.city).toBe("Milano");
  });

  it("dovrebbe trovare zona per codice legacy", () => {
    // IT-STD era il vecchio codice per Italia Standard
    const zone = getZoneByCode("IT-STD");
    expect(zone).toBeDefined();
    expect(zone?.code).toBe("IT-ITALIA"); // Mappato al nuovo codice
    expect(zone?.sampleAddress.city).toBe("Milano");
  });

  it("dovrebbe trovare Calabria con codice legacy", () => {
    const zone = getZoneByCode("IT-CAL");
    expect(zone).toBeDefined();
    expect(zone?.code).toBe("IT-CALABRIA");
    expect(zone?.sampleAddress.city).toBe("Reggio Calabria");
  });

  it("dovrebbe restituire undefined per codice inesistente", () => {
    const zone = getZoneByCode("INVALID-CODE");
    expect(zone).toBeUndefined();
  });

  it("dovrebbe supportare tutti i codici legacy", () => {
    const legacyCodes = Object.keys(PRICING_MATRIX.ZONE_LEGACY_MAP);

    legacyCodes.forEach((legacyCode) => {
      const zone = getZoneByCode(legacyCode);
      expect(zone).toBeDefined();
      expect(zone?.code).toBeDefined();
    });
  });
});

describe("getZonesForMode()", () => {
  describe("modalità fast", () => {
    it("dovrebbe restituire 2 zone rappresentative", () => {
      const zones = getZonesForMode("fast");
      expect(zones.length).toBe(2);
    });

    it("dovrebbe includere Italia Standard e Calabria", () => {
      const zones = getZonesForMode("fast");
      const codes = zones.map((z) => z.code);

      expect(codes).toContain("IT-ITALIA");
      expect(codes).toContain("IT-CALABRIA");
    });

    it("NON dovrebbe includere zone Europa", () => {
      const zones = getZonesForMode("fast");
      const euZones = zones.filter((z) => z.code.startsWith("EU-"));
      expect(euZones.length).toBe(0);
    });
  });

  describe("modalità balanced", () => {
    it("dovrebbe restituire 7 zone Italia", () => {
      const zones = getZonesForMode("balanced");
      expect(zones.length).toBe(7);
    });

    it("dovrebbe includere tutte le zone Italia", () => {
      const zones = getZonesForMode("balanced");
      const codes = zones.map((z) => z.code);

      expect(codes).toContain("IT-ITALIA");
      expect(codes).toContain("IT-SARDEGNA");
      expect(codes).toContain("IT-CALABRIA");
      expect(codes).toContain("IT-SICILIA");
      expect(codes).toContain("IT-LIVIGNO");
      expect(codes).toContain("IT-ISOLE-MINORI");
      expect(codes).toContain("IT-DISAGIATE");
    });

    it("NON dovrebbe includere zone Europa", () => {
      const zones = getZonesForMode("balanced");
      const euZones = zones.filter((z) => z.code.startsWith("EU-"));
      expect(euZones.length).toBe(0);
    });
  });

  describe("modalità italy-only", () => {
    it("dovrebbe essere equivalente a balanced", () => {
      const italyOnly = getZonesForMode("italy-only");
      const balanced = getZonesForMode("balanced");

      expect(italyOnly.length).toBe(balanced.length);
      expect(italyOnly.map((z) => z.code).sort()).toEqual(
        balanced.map((z) => z.code).sort()
      );
    });
  });

  describe("modalità matrix", () => {
    it("dovrebbe restituire tutte le 9 zone", () => {
      const zones = getZonesForMode("matrix");
      expect(zones.length).toBe(9);
    });

    it("dovrebbe includere zone Italia ed Europa", () => {
      const zones = getZonesForMode("matrix");
      const itZones = zones.filter((z) => z.code.startsWith("IT-"));
      const euZones = zones.filter((z) => z.code.startsWith("EU-"));

      expect(itZones.length).toBe(7);
      expect(euZones.length).toBe(2);
    });
  });
});

describe("getWeightsForMode()", () => {
  describe("modalità fast", () => {
    it("dovrebbe restituire 3 pesi chiave", () => {
      const weights = getWeightsForMode("fast");
      expect(weights.length).toBe(3);
    });

    it("dovrebbe includere pesi rappresentativi", () => {
      const weights = getWeightsForMode("fast");
      expect(weights).toContain(2); // Leggero
      expect(weights).toContain(10); // Medio
      expect(weights).toContain(30); // Pesante
    });
  });

  describe("modalità balanced", () => {
    it("dovrebbe restituire 9 scaglioni standard", () => {
      const weights = getWeightsForMode("balanced");
      expect(weights.length).toBe(9);
    });

    it("dovrebbe includere scaglioni corrieri italiani standard", () => {
      const weights = getWeightsForMode("balanced");
      // Scaglioni standard: 2, 5, 10, 20, 30, 50, 70, 100, 105
      expect(weights).toContain(2);
      expect(weights).toContain(5);
      expect(weights).toContain(10);
      expect(weights).toContain(20);
      expect(weights).toContain(30);
      expect(weights).toContain(50);
      expect(weights).toContain(70);
      expect(weights).toContain(100);
      expect(weights).toContain(105); // Oltre 100kg probe
    });

    it("dovrebbe essere ordinato crescente", () => {
      const weights = getWeightsForMode("balanced");
      const sorted = [...weights].sort((a, b) => a - b);
      expect(weights).toEqual(sorted);
    });
  });

  describe("modalità matrix", () => {
    it("dovrebbe restituire 101 pesi granulari", () => {
      const weights = getWeightsForMode("matrix");
      expect(weights.length).toBe(101); // 1-100 + 105
    });

    it("dovrebbe coprire 1-100kg + probe oltre", () => {
      const weights = getWeightsForMode("matrix");

      // Primo peso: 1kg
      expect(weights[0]).toBe(1);

      // Ultimo peso: 105kg (probe oltre 100)
      expect(weights[weights.length - 1]).toBe(105);

      // Peso 100 deve essere presente
      expect(weights).toContain(100);
    });

    it("dovrebbe avere pesi consecutivi da 1 a 100", () => {
      const weights = getWeightsForMode("matrix");

      // Verifica pesi 1-100 consecutivi
      for (let i = 1; i <= 100; i++) {
        expect(weights).toContain(i);
      }
    });
  });
});

describe("estimateSyncCalls()", () => {
  describe("modalità fast", () => {
    it("dovrebbe stimare correttamente", () => {
      const estimate = estimateSyncCalls("fast");

      expect(estimate.zones).toBe(2);
      expect(estimate.weights).toBe(3);
      expect(estimate.totalCalls).toBe(6); // 2 * 3
      expect(estimate.estimatedMinutes).toBeGreaterThanOrEqual(1);
    });
  });

  describe("modalità balanced", () => {
    it("dovrebbe stimare correttamente", () => {
      const estimate = estimateSyncCalls("balanced");

      expect(estimate.zones).toBe(7);
      expect(estimate.weights).toBe(9);
      expect(estimate.totalCalls).toBe(63); // 7 * 9
      expect(estimate.estimatedMinutes).toBeGreaterThanOrEqual(1);
    });
  });

  describe("modalità matrix", () => {
    it("dovrebbe stimare correttamente", () => {
      const estimate = estimateSyncCalls("matrix");

      expect(estimate.zones).toBe(9);
      expect(estimate.weights).toBe(101);
      expect(estimate.totalCalls).toBe(909); // 9 * 101
      expect(estimate.estimatedMinutes).toBeGreaterThanOrEqual(3); // Almeno 3 minuti
    });

    it("dovrebbe avere tempo stimato ragionevole", () => {
      const estimate = estimateSyncCalls("matrix");

      // Con ~200ms per chiamata + overhead, 909 chiamate ≈ 3-4 minuti
      expect(estimate.estimatedMinutes).toBeLessThanOrEqual(10);
    });
  });

  it("dovrebbe avere totalCalls = zones * weights", () => {
    const modes = ["fast", "balanced", "matrix"] as const;

    modes.forEach((mode) => {
      const estimate = estimateSyncCalls(mode);
      expect(estimate.totalCalls).toBe(estimate.zones * estimate.weights);
    });
  });
});

describe("PRICING_MATRIX.WEIGHTS", () => {
  it("dovrebbe usare scaglioni standard di default", () => {
    const weights = PRICING_MATRIX.WEIGHTS;

    // Default: scaglioni standard (9 pesi)
    expect(weights.length).toBe(9);
    expect(weights).toEqual([2, 5, 10, 20, 30, 50, 70, 100, 105]);
  });

  it("dovrebbe avere scaglioni granulari disponibili", () => {
    const granular = PRICING_MATRIX.WEIGHT_BRACKETS_GRANULAR;

    expect(granular.length).toBe(101);
    expect(granular[0]).toBe(1);
    expect(granular[99]).toBe(100);
    expect(granular[100]).toBe(105);
  });
});

describe("Zone Sample Addresses - Validazione Completa", () => {
  it("Milano dovrebbe essere in IT-ITALIA", () => {
    const zone = getZoneByCode("IT-ITALIA");
    expect(zone?.sampleAddress.city).toBe("Milano");
    expect(zone?.sampleAddress.postalCode).toBe("20100");
    expect(zone?.sampleAddress.state).toBe("MI");
  });

  it("Cagliari dovrebbe essere in IT-SARDEGNA", () => {
    const zone = getZoneByCode("IT-SARDEGNA");
    expect(zone?.sampleAddress.city).toBe("Cagliari");
    expect(zone?.sampleAddress.postalCode).toBe("09100");
    expect(zone?.sampleAddress.state).toBe("CA");
  });

  it("Reggio Calabria dovrebbe essere in IT-CALABRIA", () => {
    const zone = getZoneByCode("IT-CALABRIA");
    expect(zone?.sampleAddress.city).toBe("Reggio Calabria");
    expect(zone?.sampleAddress.state).toBe("RC");
  });

  it("Palermo dovrebbe essere in IT-SICILIA", () => {
    const zone = getZoneByCode("IT-SICILIA");
    expect(zone?.sampleAddress.city).toBe("Palermo");
    expect(zone?.sampleAddress.state).toBe("PA");
  });

  it("Livigno dovrebbe essere in IT-LIVIGNO", () => {
    const zone = getZoneByCode("IT-LIVIGNO");
    expect(zone?.sampleAddress.city).toBe("Livigno");
    expect(zone?.sampleAddress.postalCode).toBe("23041");
    expect(zone?.sampleAddress.state).toBe("SO");
  });

  it("Capri dovrebbe essere in IT-ISOLE-MINORI", () => {
    const zone = getZoneByCode("IT-ISOLE-MINORI");
    expect(zone?.sampleAddress.city).toBe("Capri");
    expect(zone?.sampleAddress.state).toBe("NA");
  });

  it("Venezia dovrebbe essere in IT-DISAGIATE", () => {
    const zone = getZoneByCode("IT-DISAGIATE");
    expect(zone?.sampleAddress.city).toBe("Venezia");
    expect(zone?.sampleAddress.postalCode).toBe("30124"); // Laguna
    expect(zone?.sampleAddress.state).toBe("VE");
  });

  it("Munich dovrebbe essere in EU-ZONA1", () => {
    const zone = getZoneByCode("EU-ZONA1");
    expect(zone?.sampleAddress.city).toBe("Munich");
    expect(zone?.sampleAddress.country).toBe("DE");
  });

  it("Madrid dovrebbe essere in EU-ZONA2", () => {
    const zone = getZoneByCode("EU-ZONA2");
    expect(zone?.sampleAddress.city).toBe("Madrid");
    expect(zone?.sampleAddress.country).toBe("ES");
  });
});



