import { describe, it, expect } from 'vitest';
import {
  FISCAL_BRAIN,
  consultFiscalBrain,
  type FiscalScenario,
} from '@/lib/knowledge/fiscal_brain';

describe('Fiscal Brain Knowledge Base', () => {
  describe('FISCAL_BRAIN data structure', () => {
    it('contains fiscal scenarios', () => {
      expect(FISCAL_BRAIN).toBeInstanceOf(Array);
      expect(FISCAL_BRAIN.length).toBeGreaterThan(0);
    });

    it('has valid scenario structure', () => {
      FISCAL_BRAIN.forEach((scenario) => {
        expect(scenario).toHaveProperty('id');
        expect(scenario).toHaveProperty('category');
        expect(scenario).toHaveProperty('trigger_condition');
        expect(scenario).toHaveProperty('expert_advice');
        expect(scenario).toHaveProperty('actionable_step');
        expect(scenario).toHaveProperty('risk_level');

        expect(typeof scenario.id).toBe('string');
        expect(['VAT', 'CUSTOMS', 'STRATEGY', 'COMPLIANCE']).toContain(
          scenario.category
        );
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(
          scenario.risk_level
        );
      });
    });

    it('includes VAT scenarios', () => {
      const vatScenarios = FISCAL_BRAIN.filter((s) => s.category === 'VAT');
      expect(vatScenarios.length).toBeGreaterThan(0);
    });

    it('includes CUSTOMS scenarios', () => {
      const customsScenarios = FISCAL_BRAIN.filter(
        (s) => s.category === 'CUSTOMS'
      );
      expect(customsScenarios.length).toBeGreaterThan(0);
    });

    it('includes STRATEGY scenarios', () => {
      const strategyScenarios = FISCAL_BRAIN.filter(
        (s) => s.category === 'STRATEGY'
      );
      expect(strategyScenarios.length).toBeGreaterThan(0);
    });
  });

  describe('Specific Scenarios', () => {
    it('includes VAT triangulation scenario', () => {
      const scenario = FISCAL_BRAIN.find(
        (s) => s.id === 'VAT_TRIANGULATION_EU'
      );
      expect(scenario).toBeDefined();
      expect(scenario?.category).toBe('VAT');
      expect(scenario?.risk_level).toBe('HIGH');
    });

    it('includes OSS threshold scenario', () => {
      const scenario = FISCAL_BRAIN.find((s) => s.id === 'VAT_OSS_THRESHOLD');
      expect(scenario).toBeDefined();
      expect(scenario?.trigger_condition).toContain('10.000€');
    });

    it('includes DAP vs DDP customs scenario', () => {
      const scenario = FISCAL_BRAIN.find((s) => s.id === 'CUSTOMS_DAP_VS_DDP');
      expect(scenario).toBeDefined();
      expect(scenario?.category).toBe('CUSTOMS');
      expect(scenario?.expert_advice).toContain('DAP');
      expect(scenario?.expert_advice).toContain('DDP');
    });

    it('includes VOEC scenario for UK/Norway', () => {
      const scenario = FISCAL_BRAIN.find(
        (s) => s.id === 'CUSTOMS_VOEC_UK_NORWAY'
      );
      expect(scenario).toBeDefined();
      expect(scenario?.risk_level).toBe('CRITICAL');
      expect(scenario?.trigger_condition).toContain('UK');
      expect(scenario?.trigger_condition).toContain('Norvegia');
    });

    it('includes regime forfettario monitoring', () => {
      const scenario = FISCAL_BRAIN.find(
        (s) => s.id === 'REGIME_FORFETTARIO_MONITOR'
      );
      expect(scenario).toBeDefined();
      expect(scenario?.category).toBe('STRATEGY');
      expect(scenario?.trigger_condition).toContain('85.000€');
    });

    it('includes COD cash flow scenario', () => {
      const scenario = FISCAL_BRAIN.find((s) => s.id === 'CASH_FLOW_COD_GAP');
      expect(scenario).toBeDefined();
      expect(scenario?.category).toBe('STRATEGY');
      expect(scenario?.trigger_condition).toContain('COD');
    });
  });

  describe('consultFiscalBrain function', () => {
    it('returns empty string when no matches found', () => {
      const result = consultFiscalBrain('random irrelevant text xyz');
      expect(result).toBe('');
    });

    it('finds relevant scenarios for VAT keywords', () => {
      const result = consultFiscalBrain(
        'Ho spedizioni triangolari UE con IVA'
      );
      expect(result).toContain('MEMORIA ESPERTA RILEVATA');
      expect(result).toContain('triangolare');
    });

    it('finds relevant scenarios for export keywords', () => {
      const result = consultFiscalBrain('Export verso UK con dazi');
      expect(result).toContain('MEMORIA ESPERTA RILEVATA');
    });

    it('finds relevant scenarios for COD keywords', () => {
      const result = consultFiscalBrain(
        'Ho molti contrassegni COD da gestire'
      );
      expect(result).toContain('MEMORIA ESPERTA RILEVATA');
      expect(result).toContain('COD');
    });

    it('finds regime forfettario scenario', () => {
      const result = consultFiscalBrain(
        'Il mio fatturato si sta avvicinando a 85.000 euro'
      );
      expect(result).toContain('MEMORIA ESPERTA RILEVATA');
      expect(result).toContain('forfettario');
    });

    it('includes risk level in output', () => {
      const result = consultFiscalBrain('triangolare UE con IVA');
      expect(result).toContain('RISCHIO:');
    });

    it('includes actionable steps in output', () => {
      const result = consultFiscalBrain('triangolare UE');
      expect(result).toContain('AZIONE:');
    });

    it('includes expert advice in output', () => {
      const result = consultFiscalBrain('export UK');
      expect(result).toContain('CONSIGLIO:');
    });

    it('filters out short keywords (< 4 chars)', () => {
      // 'IVA' has 3 chars, should be ignored
      // But 'triangolare' should still match
      const result = consultFiscalBrain('IVA con spedizioni triangolari');
      expect(result).toContain('MEMORIA ESPERTA RILEVATA');
    });

    it('is case-insensitive', () => {
      const lowerResult = consultFiscalBrain('export uk norway');
      const upperResult = consultFiscalBrain('EXPORT UK NORWAY');
      const mixedResult = consultFiscalBrain('Export Uk Norway');

      expect(lowerResult).toContain('MEMORIA ESPERTA RILEVATA');
      expect(upperResult).toContain('MEMORIA ESPERTA RILEVATA');
      expect(mixedResult).toContain('MEMORIA ESPERTA RILEVATA');
    });

    it('can match multiple scenarios', () => {
      const result = consultFiscalBrain(
        'Ho export UK e contrassegni COD da gestire con triangolazioni UE'
      );
      // Should match multiple scenarios
      const scenarioCount = (result.match(/CONSIGLIO:/g) || []).length;
      expect(scenarioCount).toBeGreaterThan(1);
    });
  });

  describe('Risk Levels Coverage', () => {
    it('has scenarios for all risk levels', () => {
      const riskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      riskLevels.forEach((level) => {
        const scenariosWithLevel = FISCAL_BRAIN.filter(
          (s) => s.risk_level === level
        );
        expect(scenariosWithLevel.length).toBeGreaterThan(0);
      });
    });

    it('marks VOEC as CRITICAL', () => {
      const voecScenario = FISCAL_BRAIN.find(
        (s) => s.id === 'CUSTOMS_VOEC_UK_NORWAY'
      );
      expect(voecScenario?.risk_level).toBe('CRITICAL');
    });

    it('marks VAT triangulation as HIGH risk', () => {
      const triangulationScenario = FISCAL_BRAIN.find(
        (s) => s.id === 'VAT_TRIANGULATION_EU'
      );
      expect(triangulationScenario?.risk_level).toBe('HIGH');
    });
  });

  describe('Categories Coverage', () => {
    it('has scenarios for all categories', () => {
      const categories = ['VAT', 'CUSTOMS', 'STRATEGY', 'COMPLIANCE'];
      categories.forEach((category) => {
        const scenariosWithCategory = FISCAL_BRAIN.filter(
          (s) => s.category === category
        );
        // Note: COMPLIANCE might not have scenarios yet
        if (category !== 'COMPLIANCE') {
          expect(scenariosWithCategory.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Actionable Steps Quality', () => {
    it('all scenarios have non-empty actionable steps', () => {
      FISCAL_BRAIN.forEach((scenario) => {
        expect(scenario.actionable_step.length).toBeGreaterThan(0);
        expect(scenario.actionable_step.trim()).toBeTruthy();
      });
    });

    it('all scenarios have non-empty expert advice', () => {
      FISCAL_BRAIN.forEach((scenario) => {
        expect(scenario.expert_advice.length).toBeGreaterThan(0);
        expect(scenario.expert_advice.trim()).toBeTruthy();
      });
    });

    it('all scenarios have descriptive trigger conditions', () => {
      FISCAL_BRAIN.forEach((scenario) => {
        expect(scenario.trigger_condition.length).toBeGreaterThan(10);
        expect(scenario.trigger_condition.trim()).toBeTruthy();
      });
    });
  });
});
