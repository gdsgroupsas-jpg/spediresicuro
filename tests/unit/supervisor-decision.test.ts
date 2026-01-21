/**
 * Unit Tests: Supervisor Decision Function
 *
 * Test della funzione pura decideNextStep per il routing del supervisor.
 * Niente mock di LLM/DB, solo logica pura.
 */

import { describe, it, expect } from 'vitest';
import { decideNextStep, DecisionInput } from '@/lib/agent/orchestrator/supervisor';

describe('Supervisor Decision - decideNextStep', () => {
  describe('END conditions', () => {
    it('should return END when hasPricingOptions is true', () => {
      const input: DecisionInput = {
        isPricingIntent: true,
        hasPricingOptions: true,
        hasClarificationRequest: false,
        hasEnoughData: true,
      };

      expect(decideNextStep(input)).toBe('END');
    });

    it('should return END when hasClarificationRequest is true', () => {
      const input: DecisionInput = {
        isPricingIntent: true,
        hasPricingOptions: false,
        hasClarificationRequest: true,
        hasEnoughData: false,
      };

      expect(decideNextStep(input)).toBe('END');
    });
  });

  describe('pricing_worker routing', () => {
    it('should return pricing_worker when isPricingIntent AND hasEnoughData', () => {
      const input: DecisionInput = {
        isPricingIntent: true,
        hasPricingOptions: false,
        hasClarificationRequest: false,
        hasEnoughData: true,
      };

      expect(decideNextStep(input)).toBe('pricing_worker');
    });
  });

  describe('address_worker routing (Sprint 2.3)', () => {
    it('should return address_worker when isPricingIntent but NOT hasEnoughData', () => {
      const input: DecisionInput = {
        isPricingIntent: true,
        hasPricingOptions: false,
        hasClarificationRequest: false,
        hasEnoughData: false,
      };

      expect(decideNextStep(input)).toBe('address_worker');
    });

    it('should return address_worker when isPricingIntent and hasPartialAddressData but NOT hasEnoughData', () => {
      const input: DecisionInput = {
        isPricingIntent: true,
        hasPricingOptions: false,
        hasClarificationRequest: false,
        hasEnoughData: false,
        hasPartialAddressData: true,
      };

      expect(decideNextStep(input)).toBe('address_worker');
    });
  });

  describe('legacy routing', () => {
    it('should return legacy when NOT isPricingIntent', () => {
      const input: DecisionInput = {
        isPricingIntent: false,
        hasPricingOptions: false,
        hasClarificationRequest: false,
        hasEnoughData: false,
      };

      expect(decideNextStep(input)).toBe('legacy');
    });

    it('should return legacy when NOT isPricingIntent even with data', () => {
      const input: DecisionInput = {
        isPricingIntent: false,
        hasPricingOptions: false,
        hasClarificationRequest: false,
        hasEnoughData: true,
      };

      expect(decideNextStep(input)).toBe('legacy');
    });
  });

  describe('Priority order', () => {
    it('hasPricingOptions takes priority over everything', () => {
      // Anche se isPricingIntent = false, se abbiamo già options -> END
      const input: DecisionInput = {
        isPricingIntent: false,
        hasPricingOptions: true,
        hasClarificationRequest: false,
        hasEnoughData: false,
      };

      expect(decideNextStep(input)).toBe('END');
    });

    it('hasClarificationRequest takes priority over isPricingIntent check', () => {
      const input: DecisionInput = {
        isPricingIntent: false,
        hasPricingOptions: false,
        hasClarificationRequest: true,
        hasEnoughData: false,
      };

      expect(decideNextStep(input)).toBe('END');
    });
  });
});
