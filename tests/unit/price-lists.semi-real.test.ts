/**
 * Semi-Real Tests: Price Lists Calculation
 *
 * Test che esercitano la logica pura di calculatePrice senza DB.
 * Usa fixture JSON locale per rappresentare una price list minimale.
 */

import { describe, it, expect } from 'vitest';
import type { PriceList } from '@/types/listini';
import { calculatePriceFromList } from '@/lib/pricing/calculator';
import priceListFixture from '../fixtures/price-list-minimal.json';

describe('Price Lists - Semi-Real Tests', () => {
  const priceList = priceListFixture as unknown as PriceList;

  describe('Economy Service', () => {
    it('should calculate price for economy service with valid weight and CAP', () => {
      const weight = 1.5; // kg
      const destinationZip = '00100';
      const serviceType = 'economy';

      const result = calculatePriceFromList(priceList, weight, destinationZip, serviceType);

      // Verifica: risultato non null
      expect(result).not.toBeNull();
      if (!result) return;

      // Verifica: nessun NaN
      expect(Number.isNaN(result.basePrice)).toBe(false);
      expect(Number.isNaN(result.surcharges)).toBe(false);
      expect(Number.isNaN(result.totalCost)).toBe(false);

      // Verifica: valori non negativi
      expect(result.basePrice).toBeGreaterThanOrEqual(0);
      expect(result.surcharges).toBeGreaterThanOrEqual(0);
      expect(result.totalCost).toBeGreaterThanOrEqual(0);

      // Verifica: totalCost sensato (basePrice + surcharges)
      // Per economy 0.1-2.0kg: basePrice = 8.50, fuel_surcharge = 5% = 0.425
      // totalCost = 8.50 + 0.425 = 8.925
      expect(result.basePrice).toBe(8.5);
      expect(result.surcharges).toBeCloseTo(0.425, 2); // 5% di 8.50
      expect(result.totalCost).toBeCloseTo(8.925, 2);

      // Verifica: estimatedDeliveryDays presente
      expect(result.details.estimatedDeliveryDays.min).toBe(5);
      expect(result.details.estimatedDeliveryDays.max).toBe(7);
      expect(result.details.estimatedDeliveryDays.min).toBeLessThanOrEqual(
        result.details.estimatedDeliveryDays.max
      );

      // Verifica: entry corretta
      expect(result.details.entry.service_type).toBe('economy');
      expect(result.details.entry.weight_from).toBeLessThanOrEqual(weight);
      expect(result.details.entry.weight_to).toBeGreaterThanOrEqual(weight);
    });

    it('should calculate price for economy service with higher weight range', () => {
      const weight = 3.0; // kg (dentro range 2.1-5.0)
      const destinationZip = '20100';
      const serviceType = 'economy';

      const result = calculatePriceFromList(priceList, weight, destinationZip, serviceType);

      expect(result).not.toBeNull();
      if (!result) return;

      // Verifica: nessun NaN
      expect(Number.isNaN(result.totalCost)).toBe(false);

      // Verifica: valori non negativi
      expect(result.totalCost).toBeGreaterThan(0);

      // Verifica: totalCost sensato per fascia peso superiore
      // Per economy 2.1-5.0kg: basePrice = 12.00, fuel_surcharge = 5% = 0.60
      // totalCost = 12.00 + 0.60 = 12.60
      expect(result.basePrice).toBe(12.0);
      expect(result.surcharges).toBeCloseTo(0.6, 2); // 5% di 12.00
      expect(result.totalCost).toBeCloseTo(12.6, 2);
    });
  });

  describe('Express Service', () => {
    it('should calculate price for express service with valid weight and CAP', () => {
      const weight = 1.5; // kg
      const destinationZip = '00100';
      const serviceType = 'express';

      const result = calculatePriceFromList(priceList, weight, destinationZip, serviceType);

      // Verifica: risultato non null
      expect(result).not.toBeNull();
      if (!result) return;

      // Verifica: nessun NaN
      expect(Number.isNaN(result.basePrice)).toBe(false);
      expect(Number.isNaN(result.surcharges)).toBe(false);
      expect(Number.isNaN(result.totalCost)).toBe(false);

      // Verifica: valori non negativi
      expect(result.basePrice).toBeGreaterThanOrEqual(0);
      expect(result.surcharges).toBeGreaterThanOrEqual(0);
      expect(result.totalCost).toBeGreaterThanOrEqual(0);

      // Verifica: totalCost sensato (basePrice + surcharges)
      // Per express 0.1-2.0kg: basePrice = 15.00, fuel_surcharge = 5% = 0.75
      // totalCost = 15.00 + 0.75 = 15.75
      expect(result.basePrice).toBe(15.0);
      expect(result.surcharges).toBeCloseTo(0.75, 2); // 5% di 15.00
      expect(result.totalCost).toBeCloseTo(15.75, 2);

      // Verifica: estimatedDeliveryDays presente (express più veloce)
      expect(result.details.estimatedDeliveryDays.min).toBe(1);
      expect(result.details.estimatedDeliveryDays.max).toBe(2);
      expect(result.details.estimatedDeliveryDays.min).toBeLessThanOrEqual(
        result.details.estimatedDeliveryDays.max
      );

      // Verifica: entry corretta
      expect(result.details.entry.service_type).toBe('express');
      expect(result.details.entry.weight_from).toBeLessThanOrEqual(weight);
      expect(result.details.entry.weight_to).toBeGreaterThanOrEqual(weight);

      // Verifica: express più costoso di economy
      const economyResult = calculatePriceFromList(priceList, weight, destinationZip, 'economy');
      if (economyResult) {
        expect(result.totalCost).toBeGreaterThan(economyResult.totalCost);
      }
    });

    it('should calculate price for express service with higher weight range', () => {
      const weight = 3.0; // kg (dentro range 2.1-5.0)
      const destinationZip = '50100';
      const serviceType = 'express';

      const result = calculatePriceFromList(priceList, weight, destinationZip, serviceType);

      expect(result).not.toBeNull();
      if (!result) return;

      // Verifica: nessun NaN
      expect(Number.isNaN(result.totalCost)).toBe(false);

      // Verifica: valori non negativi
      expect(result.totalCost).toBeGreaterThan(0);

      // Verifica: totalCost sensato per fascia peso superiore
      // Per express 2.1-5.0kg: basePrice = 20.00, fuel_surcharge = 5% = 1.00
      // totalCost = 20.00 + 1.00 = 21.00
      expect(result.basePrice).toBe(20.0);
      expect(result.surcharges).toBeCloseTo(1.0, 2); // 5% di 20.00
      expect(result.totalCost).toBeCloseTo(21.0, 2);
    });
  });
});
