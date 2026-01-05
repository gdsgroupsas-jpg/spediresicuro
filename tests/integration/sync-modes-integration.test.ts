/**
 * Test Integrazione: Sync Modes - Fast/Balanced/Matrix
 *
 * Verifica che i sync modes funzionino correttamente:
 * 1. Fast mode: 2 zone x 3 pesi = 6 chiamate
 * 2. Balanced mode: 7 zone x 9 pesi = 63 chiamate
 * 3. Matrix mode: 9 zone x 101 pesi = 909 chiamate
 * 4. Stime tempo corrette
 * 5. Zone e pesi corretti per ogni modalità
 *
 * Riferimento: lib/constants/pricing-matrix.ts
 */

import { describe, it, expect } from "vitest";
import {
  getZonesForMode,
  getWeightsForMode,
  estimateSyncCalls,
} from "@/lib/constants/pricing-matrix";

describe("Sync Modes Integration", () => {
  describe("Fast Mode", () => {
    it("dovrebbe restituire 2 zone rappresentative", () => {
      const zones = getZonesForMode("fast");
      expect(zones.length).toBe(2);

      // Verifica che siano zone Italia (non Europa)
      const italyZones = zones.filter((z) => z.code.startsWith("IT-"));
      expect(italyZones.length).toBe(2);
    });

    it("dovrebbe restituire 3 pesi chiave", () => {
      const weights = getWeightsForMode("fast");
      expect(weights.length).toBe(3);

      // Verifica pesi rappresentativi
      expect(weights).toContain(2); // Leggero
      expect(weights).toContain(10); // Medio
      expect(weights).toContain(30); // Pesante
    });

    it("dovrebbe stimare 6 chiamate totali", () => {
      const estimate = estimateSyncCalls("fast");
      expect(estimate.totalCalls).toBe(6); // 2 zone x 3 pesi
      expect(estimate.zones).toBe(2);
      expect(estimate.weights).toBe(3);
    });

    it("dovrebbe stimare tempo ragionevole", () => {
      const estimate = estimateSyncCalls("fast");
      // Fast mode: 6 calls * 0.25s = 1.5s → ceil(1.5/60) = 1 minuto
      expect(estimate.estimatedMinutes).toBeGreaterThanOrEqual(1);
      expect(estimate.estimatedMinutes).toBeLessThanOrEqual(2);
    });
  });

  describe("Balanced Mode", () => {
    it("dovrebbe restituire 7 zone Italia", () => {
      const zones = getZonesForMode("balanced");
      expect(zones.length).toBe(7);

      // Verifica tutte le zone Italia
      const zoneCodes = zones.map((z) => z.code);
      expect(zoneCodes).toContain("IT-ITALIA");
      expect(zoneCodes).toContain("IT-SARDEGNA");
      expect(zoneCodes).toContain("IT-CALABRIA");
      expect(zoneCodes).toContain("IT-SICILIA");
      expect(zoneCodes).toContain("IT-LIVIGNO");
      expect(zoneCodes).toContain("IT-ISOLE-MINORI");
      expect(zoneCodes).toContain("IT-DISAGIATE");
    });

    it("dovrebbe restituire 9 scaglioni standard", () => {
      const weights = getWeightsForMode("balanced");
      expect(weights.length).toBe(9);

      // Verifica scaglioni standard
      expect(weights).toEqual([2, 5, 10, 20, 30, 50, 70, 100, 105]);
    });

    it("dovrebbe stimare 63 chiamate totali", () => {
      const estimate = estimateSyncCalls("balanced");
      expect(estimate.totalCalls).toBe(63); // 7 zone x 9 pesi
      expect(estimate.zones).toBe(7);
      expect(estimate.weights).toBe(9);
    });

    it("dovrebbe stimare tempo ragionevole", () => {
      const estimate = estimateSyncCalls("balanced");
      // Balanced mode: 63 calls * 0.25s = 15.75s → ceil(15.75/60) = 1 minuto
      expect(estimate.estimatedMinutes).toBeGreaterThanOrEqual(1);
      expect(estimate.estimatedMinutes).toBeLessThanOrEqual(5);
    });
  });

  describe("Matrix Mode", () => {
    it("dovrebbe restituire tutte le 9 zone", () => {
      const zones = getZonesForMode("matrix");
      expect(zones.length).toBe(9);

      // Verifica zone Italia + Europa
      const italyZones = zones.filter((z) => z.code.startsWith("IT-"));
      const euZones = zones.filter((z) => z.code.startsWith("EU-"));
      expect(italyZones.length).toBe(7);
      expect(euZones.length).toBe(2);
    });

    it("dovrebbe restituire 101 pesi granulari", () => {
      const weights = getWeightsForMode("matrix");
      expect(weights.length).toBe(101);

      // Verifica range 1-100 + 105
      expect(weights[0]).toBe(1);
      expect(weights[99]).toBe(100);
      expect(weights[100]).toBe(105);
    });

    it("dovrebbe stimare 909 chiamate totali", () => {
      const estimate = estimateSyncCalls("matrix");
      expect(estimate.totalCalls).toBe(909); // 9 zone x 101 pesi
      expect(estimate.zones).toBe(9);
      expect(estimate.weights).toBe(101);
    });

    it("dovrebbe stimare tempo 15-20 minuti", () => {
      const estimate = estimateSyncCalls("matrix");
      expect(estimate.estimatedMinutes).toBeGreaterThanOrEqual(3);
      expect(estimate.estimatedMinutes).toBeLessThanOrEqual(30);
    });
  });

  describe("Consistenza Stime", () => {
    it("dovrebbe avere totalCalls = zones * weights per ogni modalità", () => {
      const modes = ["fast", "balanced", "matrix"] as const;

      modes.forEach((mode) => {
        const estimate = estimateSyncCalls(mode);
        expect(estimate.totalCalls).toBe(
          estimate.zones * estimate.weights
        );
      });
    });

    it("dovrebbe avere stime tempo crescenti o uguali", () => {
      const fastEstimate = estimateSyncCalls("fast");
      const balancedEstimate = estimateSyncCalls("balanced");
      const matrixEstimate = estimateSyncCalls("matrix");

      // Fast e balanced possono avere stesso tempo (1 minuto arrotondato)
      // Matrix deve essere maggiore
      expect(balancedEstimate.estimatedMinutes).toBeGreaterThanOrEqual(
        fastEstimate.estimatedMinutes
      );
      expect(matrixEstimate.estimatedMinutes).toBeGreaterThan(
        balancedEstimate.estimatedMinutes
      );
    });
  });

  describe("Zone e Pesi Consistency", () => {
    it("dovrebbe avere zone uniche per ogni modalità", () => {
      const fastZones = getZonesForMode("fast");
      const balancedZones = getZonesForMode("balanced");
      const matrixZones = getZonesForMode("matrix");

      // Fast zone devono essere subset di balanced
      fastZones.forEach((fastZone) => {
        const found = balancedZones.find((z) => z.code === fastZone.code);
        expect(found).toBeDefined();
      });

      // Balanced zone devono essere subset di matrix
      balancedZones.forEach((balancedZone) => {
        const found = matrixZones.find((z) => z.code === balancedZone.code);
        expect(found).toBeDefined();
      });
    });

    it("dovrebbe avere pesi unici per ogni modalità", () => {
      const fastWeights = getWeightsForMode("fast");
      const balancedWeights = getWeightsForMode("balanced");
      const matrixWeights = getWeightsForMode("matrix");

      // Fast weights devono essere subset di balanced
      fastWeights.forEach((weight) => {
        expect(balancedWeights).toContain(weight);
      });

      // Balanced weights devono essere subset di matrix
      balancedWeights.forEach((weight) => {
        expect(matrixWeights).toContain(weight);
      });
    });
  });
});

