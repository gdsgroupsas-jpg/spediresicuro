/**
 * Test: Zone Mapping allineato a Spedisci.Online
 *
 * Verifica che la configurazione delle zone corrisponda alla matrice ufficiale
 * e che gli helper restituiscano le zone/pesi corretti per ogni modalità.
 */

import {
  PRICING_MATRIX,
  estimateSyncCalls,
  getWeightsForMode,
  getZoneByCode,
  getZonesForMode,
} from "@/lib/constants/pricing-matrix";
import { describe, expect, it } from "vitest";

describe("PRICING_MATRIX - Zone Configuration", () => {
  it("should have exactly 9 zones matching Spedisci.Online matrix", () => {
    expect(PRICING_MATRIX.ZONES).toHaveLength(9);

    const zoneCodes = PRICING_MATRIX.ZONES.map((z) => z.code);
    expect(zoneCodes).toContain("IT-ITALIA");
    expect(zoneCodes).toContain("IT-SARDEGNA");
    expect(zoneCodes).toContain("IT-CALABRIA");
    expect(zoneCodes).toContain("IT-SICILIA");
    expect(zoneCodes).toContain("IT-LIVIGNO");
    expect(zoneCodes).toContain("IT-ISOLE-MINORI");
    expect(zoneCodes).toContain("IT-DISAGIATE");
    expect(zoneCodes).toContain("EU-ZONA1");
    expect(zoneCodes).toContain("EU-ZONA2");
  });

  it("should have valid sample addresses for each zone", () => {
    for (const zone of PRICING_MATRIX.ZONES) {
      expect(zone.sampleAddress).toBeDefined();
      expect(zone.sampleAddress.city).toBeTruthy();
      expect(zone.sampleAddress.postalCode).toBeTruthy();
      expect(zone.sampleAddress.country).toBeTruthy();
    }
  });

  it("should have zones ordered by priority", () => {
    const priorities = PRICING_MATRIX.ZONES.map((z) => z.priority);
    const sortedPriorities = [...priorities].sort((a, b) => a - b);
    expect(priorities).toEqual(sortedPriorities);
  });

  it("should have Italy zones before Europe zones", () => {
    const italyZones = PRICING_MATRIX.ZONES.filter((z) =>
      z.code.startsWith("IT-")
    );
    const europeZones = PRICING_MATRIX.ZONES.filter((z) =>
      z.code.startsWith("EU-")
    );

    expect(italyZones).toHaveLength(7);
    expect(europeZones).toHaveLength(2);

    // All Italy priorities should be lower than Europe priorities
    const maxItalyPriority = Math.max(...italyZones.map((z) => z.priority));
    const minEuropePriority = Math.min(...europeZones.map((z) => z.priority));
    expect(maxItalyPriority).toBeLessThan(minEuropePriority);
  });
});

describe("PRICING_MATRIX - Weight Brackets", () => {
  it("should have standard weight brackets (9 values)", () => {
    expect(PRICING_MATRIX.WEIGHT_BRACKETS_STANDARD).toEqual([
      2, 5, 10, 20, 30, 50, 70, 100, 105,
    ]);
  });

  it("should have granular weight brackets (101 values: 1-100 + 105)", () => {
    expect(PRICING_MATRIX.WEIGHT_BRACKETS_GRANULAR).toHaveLength(101);
    expect(PRICING_MATRIX.WEIGHT_BRACKETS_GRANULAR[0]).toBe(1);
    expect(PRICING_MATRIX.WEIGHT_BRACKETS_GRANULAR[99]).toBe(100);
    expect(PRICING_MATRIX.WEIGHT_BRACKETS_GRANULAR[100]).toBe(105);
  });
});

describe("getZoneByCode()", () => {
  it("should return zone for valid code", () => {
    const zone = getZoneByCode("IT-ITALIA");
    expect(zone).toBeDefined();
    expect(zone?.code).toBe("IT-ITALIA");
    expect(zone?.name).toBe("Italia (Standard)");
  });

  it("should support legacy zone codes", () => {
    // Legacy codes should map to new codes
    const stdZone = getZoneByCode("IT-STD");
    expect(stdZone?.code).toBe("IT-ITALIA");

    const calZone = getZoneByCode("IT-CAL");
    expect(calZone?.code).toBe("IT-CALABRIA");

    const sarZone = getZoneByCode("IT-SAR");
    expect(sarZone?.code).toBe("IT-SARDEGNA");
  });

  it("should return undefined for unknown code", () => {
    const zone = getZoneByCode("UNKNOWN-ZONE");
    expect(zone).toBeUndefined();
  });
});

describe("getZonesForMode()", () => {
  it("fast mode: should return 2 representative zones", () => {
    const zones = getZonesForMode("fast");
    expect(zones).toHaveLength(2);
    expect(zones.map((z) => z.code)).toContain("IT-ITALIA");
    expect(zones.map((z) => z.code)).toContain("IT-CALABRIA");
  });

  it("balanced mode: should return 7 Italy zones (no Europe)", () => {
    const zones = getZonesForMode("balanced");
    expect(zones).toHaveLength(7);

    // All should be Italy
    for (const zone of zones) {
      expect(zone.code.startsWith("IT-")).toBe(true);
    }

    // Should not include Europe
    expect(zones.map((z) => z.code)).not.toContain("EU-ZONA1");
    expect(zones.map((z) => z.code)).not.toContain("EU-ZONA2");
  });

  it("italy-only mode: should be alias for balanced", () => {
    const balancedZones = getZonesForMode("balanced");
    const italyOnlyZones = getZonesForMode("italy-only");

    expect(italyOnlyZones).toHaveLength(balancedZones.length);
    expect(italyOnlyZones.map((z) => z.code)).toEqual(
      balancedZones.map((z) => z.code)
    );
  });

  it("matrix mode: should return all 9 zones (Italy + Europe)", () => {
    const zones = getZonesForMode("matrix");
    expect(zones).toHaveLength(9);

    // Should include Europe
    expect(zones.map((z) => z.code)).toContain("EU-ZONA1");
    expect(zones.map((z) => z.code)).toContain("EU-ZONA2");
  });
});

describe("getWeightsForMode()", () => {
  it("fast mode: should return 3 key weights", () => {
    const weights = getWeightsForMode("fast");
    expect(weights).toEqual([2, 10, 30]);
  });

  it("balanced mode: should return 9 standard weights", () => {
    const weights = getWeightsForMode("balanced");
    expect(weights).toHaveLength(9);
    expect(weights).toEqual([2, 5, 10, 20, 30, 50, 70, 100, 105]);
  });

  it("matrix mode: should return 101 granular weights", () => {
    const weights = getWeightsForMode("matrix");
    expect(weights).toHaveLength(101);
  });
});

describe("estimateSyncCalls()", () => {
  it("fast mode: should estimate 6 calls (2 zones × 3 weights)", () => {
    const estimate = estimateSyncCalls("fast");
    expect(estimate.zones).toBe(2);
    expect(estimate.weights).toBe(3);
    expect(estimate.totalCalls).toBe(6);
  });

  it("balanced mode: should estimate 63 calls (7 zones × 9 weights)", () => {
    const estimate = estimateSyncCalls("balanced");
    expect(estimate.zones).toBe(7);
    expect(estimate.weights).toBe(9);
    expect(estimate.totalCalls).toBe(63);
  });

  it("matrix mode: should estimate 909 calls (9 zones × 101 weights)", () => {
    const estimate = estimateSyncCalls("matrix");
    expect(estimate.zones).toBe(9);
    expect(estimate.weights).toBe(101);
    expect(estimate.totalCalls).toBe(909);
  });

  it("should provide estimated minutes for each mode", () => {
    expect(estimateSyncCalls("fast").estimatedMinutes).toBeGreaterThanOrEqual(
      0
    );
    expect(estimateSyncCalls("balanced").estimatedMinutes).toBeGreaterThan(0);
    expect(estimateSyncCalls("matrix").estimatedMinutes).toBeGreaterThan(0);
  });
});

describe("PRICING_MATRIX - Backward Compatibility", () => {
  it("ZONES_ITALY_ONLY should list 7 Italian zone codes", () => {
    expect(PRICING_MATRIX.ZONES_ITALY_ONLY).toHaveLength(7);

    for (const code of PRICING_MATRIX.ZONES_ITALY_ONLY) {
      expect(code.startsWith("IT-")).toBe(true);
    }
  });

  it("ZONE_LEGACY_MAP should map all legacy codes to valid zones", () => {
    const legacyMap = PRICING_MATRIX.ZONE_LEGACY_MAP;

    for (const [legacyCode, newCode] of Object.entries(legacyMap)) {
      const zone = PRICING_MATRIX.ZONES.find((z) => z.code === newCode);
      expect(zone).toBeDefined();
      expect(zone?.code).toBe(newCode);
    }
  });
});
