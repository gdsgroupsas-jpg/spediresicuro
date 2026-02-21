/**
 * Unit Tests: Package Metrics
 *
 * Verifica calcoli volume, peso volumetrico e peso tassabile.
 */

import { describe, it, expect } from 'vitest';
import { calcVolume, calcPesoVolumetrico, calcPesoTassabile } from '@/lib/package-metrics';

describe('package-metrics', () => {
  describe('calcVolume', () => {
    it('calcola correttamente il volume in m³', () => {
      // 10 x 10 x 10 cm = 1000 cm³ = 0.001 m³
      expect(calcVolume(10, 10, 10)).toBeCloseTo(0.001, 6);
    });

    it('gestisce dimensioni grandi', () => {
      // 100 x 50 x 40 cm = 200000 cm³ = 0.2 m³
      expect(calcVolume(100, 50, 40)).toBeCloseTo(0.2, 6);
    });

    it('restituisce 0 se una dimensione è 0', () => {
      expect(calcVolume(0, 10, 10)).toBe(0);
      expect(calcVolume(10, 0, 10)).toBe(0);
      expect(calcVolume(10, 10, 0)).toBe(0);
    });
  });

  describe('calcPesoVolumetrico', () => {
    it('calcola correttamente il peso volumetrico (L×W×H/5000)', () => {
      // 10 x 10 x 10 = 1000 / 5000 = 0.2 kg
      expect(calcPesoVolumetrico(10, 10, 10)).toBeCloseTo(0.2, 6);
    });

    it('gestisce pacco grande', () => {
      // 50 x 40 x 30 = 60000 / 5000 = 12 kg
      expect(calcPesoVolumetrico(50, 40, 30)).toBeCloseTo(12, 6);
    });

    it('restituisce 0 se una dimensione è 0', () => {
      expect(calcPesoVolumetrico(0, 10, 10)).toBe(0);
    });
  });

  describe('calcPesoTassabile', () => {
    it('usa peso reale se maggiore del volumetrico', () => {
      // Peso reale 5 kg, dimensioni 10x10x10 => volumetrico 0.2 kg
      const result = calcPesoTassabile(5, 10, 10, 10);
      expect(result.pesoTassabile).toBe(5);
      expect(result.usaVolumetrico).toBe(false);
    });

    it('usa peso volumetrico se maggiore del reale', () => {
      // Peso reale 1 kg, dimensioni 50x40x30 => volumetrico 12 kg
      const result = calcPesoTassabile(1, 50, 40, 30);
      expect(result.pesoTassabile).toBeCloseTo(12, 6);
      expect(result.usaVolumetrico).toBe(true);
    });

    it('in caso di parità usa il peso reale (usaVolumetrico=false)', () => {
      // Peso reale = volumetrico = 12 kg
      const result = calcPesoTassabile(12, 50, 40, 30);
      expect(result.pesoTassabile).toBe(12);
      expect(result.usaVolumetrico).toBe(false);
    });

    it('esempio screenshot: 1kg, 10x10x10 => tassabile 1kg', () => {
      const result = calcPesoTassabile(1, 10, 10, 10);
      expect(result.pesoTassabile).toBe(1);
      expect(result.usaVolumetrico).toBe(false);
    });
  });
});
