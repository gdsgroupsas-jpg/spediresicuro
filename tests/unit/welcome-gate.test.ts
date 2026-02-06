/**
 * WelcomeGate Helpers Tests
 *
 * Verifica la logica pura del WelcomeGate:
 * - Traduzione ruoli in italiano
 * - Messaggi di benvenuto personalizzati
 * - Generazione particelle
 * - Timing animazioni
 * - Costante localStorage
 *
 * @module tests/unit/welcome-gate
 */

import { describe, it, expect } from 'vitest';
import {
  getRoleLabel,
  getWelcomeLines,
  generateParticles,
  getAutoCloseDelay,
  WELCOME_SEEN_KEY,
} from '@/lib/welcome-gate-helpers';

describe('WelcomeGate Helpers', () => {
  describe('getRoleLabel', () => {
    it('admin → Amministratore', () => {
      expect(getRoleLabel('admin')).toBe('Amministratore');
    });

    it('operator → Operatore', () => {
      expect(getRoleLabel('operator')).toBe('Operatore');
    });

    it('viewer → Visualizzatore', () => {
      expect(getRoleLabel('viewer')).toBe('Visualizzatore');
    });

    it('owner → Proprietario', () => {
      expect(getRoleLabel('owner')).toBe('Proprietario');
    });

    it('ruolo sconosciuto → ritorna originale', () => {
      expect(getRoleLabel('custom_role')).toBe('custom_role');
      expect(getRoleLabel('')).toBe('');
    });
  });

  describe('getWelcomeLines', () => {
    it('con userName genera saluto personalizzato', () => {
      const lines = getWelcomeLines('Marco');
      expect(lines[0]).toBe('Ciao Marco! 👋');
    });

    it('senza userName genera saluto generico', () => {
      const lines = getWelcomeLines('');
      expect(lines[0]).toBe('Ciao! 👋');
    });

    it('con workspaceName include nome workspace', () => {
      const lines = getWelcomeLines('Marco', 'Acme Logistics');
      expect(lines[1]).toBe('Benvenuto nel team di Acme Logistics');
    });

    it('con orgName preferisce orgName su workspaceName', () => {
      const lines = getWelcomeLines('Marco', 'WS-123', 'Acme Corp');
      expect(lines[1]).toBe('Benvenuto nel team di Acme Corp');
    });

    it('senza workspace genera benvenuto generico', () => {
      const lines = getWelcomeLines('Marco');
      expect(lines[1]).toBe('Benvenuto su SpedireSicuro');
    });

    it('ritorna sempre esattamente 2 righe', () => {
      expect(getWelcomeLines('Marco')).toHaveLength(2);
      expect(getWelcomeLines('')).toHaveLength(2);
      expect(getWelcomeLines('Marco', 'WS')).toHaveLength(2);
      expect(getWelcomeLines('Marco', 'WS', 'Org')).toHaveLength(2);
    });
  });

  describe('generateParticles', () => {
    it('genera il numero corretto di particelle', () => {
      expect(generateParticles(10)).toHaveLength(10);
      expect(generateParticles(25)).toHaveLength(25);
      expect(generateParticles(0)).toHaveLength(0);
    });

    it('colori alternati: ogni 3a particella è amber, le altre cyan', () => {
      const particles = generateParticles(6);
      // Indice 0 → 0%3=0 → amber
      expect(particles[0].color).toBe('amber');
      // Indice 1 → 1%3=1 → cyan
      expect(particles[1].color).toBe('cyan');
      // Indice 2 → 2%3=2 → cyan
      expect(particles[2].color).toBe('cyan');
      // Indice 3 → 3%3=0 → amber
      expect(particles[3].color).toBe('amber');
      // Indice 4 → 4%3=1 → cyan
      expect(particles[4].color).toBe('cyan');
      // Indice 5 → 5%3=2 → cyan
      expect(particles[5].color).toBe('cyan');
    });

    it('dimensioni tra 1 e 4', () => {
      const particles = generateParticles(50);
      for (const p of particles) {
        expect(p.size).toBeGreaterThanOrEqual(1);
        expect(p.size).toBeLessThanOrEqual(4);
      }
    });

    it('posizioni x e y tra 0 e 100', () => {
      const particles = generateParticles(50);
      for (const p of particles) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(100);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(100);
      }
    });

    it('ogni particella ha id univoco sequenziale', () => {
      const particles = generateParticles(5);
      expect(particles.map((p) => p.id)).toEqual([0, 1, 2, 3, 4]);
    });

    it('duration tra 10 e 25', () => {
      const particles = generateParticles(50);
      for (const p of particles) {
        expect(p.duration).toBeGreaterThanOrEqual(10);
        expect(p.duration).toBeLessThanOrEqual(25);
      }
    });

    it('delay tra 0 e 3', () => {
      const particles = generateParticles(50);
      for (const p of particles) {
        expect(p.delay).toBeGreaterThanOrEqual(0);
        expect(p.delay).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('getAutoCloseDelay', () => {
    it('reduced motion → 2000ms', () => {
      expect(getAutoCloseDelay(true)).toBe(2000);
    });

    it('normal → 5300ms', () => {
      expect(getAutoCloseDelay(false)).toBe(5300);
    });
  });

  describe('WELCOME_SEEN_KEY', () => {
    it('key localStorage è una stringa non vuota', () => {
      expect(typeof WELCOME_SEEN_KEY).toBe('string');
      expect(WELCOME_SEEN_KEY.length).toBeGreaterThan(0);
    });

    it('key corretta per SpedireSicuro', () => {
      expect(WELCOME_SEEN_KEY).toBe('spediresicuro-welcome-seen');
    });
  });
});
