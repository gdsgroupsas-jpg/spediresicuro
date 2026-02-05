/**
 * Test Validators
 *
 * Verifica funzioni di validazione input per sicurezza
 */

import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateUUID,
  validatePhone,
  sanitizeString,
  assertValidUserId,
  assertValidWorkspaceId,
  buildWorkspaceFilter,
} from '@/lib/validators';

describe('Validators', () => {
  describe('validateEmail', () => {
    it('accetta email valide', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('rifiuta email invalide', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('accetta password valide', () => {
      expect(validatePassword('password123')).toBe(true);
      expect(validatePassword('12345678')).toBe(true);
    });

    it('rifiuta password troppo corte', () => {
      expect(validatePassword('short')).toBe(false);
      expect(validatePassword('')).toBe(false);
    });
  });

  describe('validateUUID', () => {
    it('accetta UUID validi', () => {
      expect(validateUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(validateUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('rifiuta UUID invalidi', () => {
      expect(validateUUID('')).toBe(false);
      expect(validateUUID('invalid-uuid')).toBe(false);
      expect(validateUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(validateUUID('550e8400e29b41d4a716446655440000')).toBe(false);
    });

    it('rifiuta tentativi di SQL injection', () => {
      expect(validateUUID("'; DROP TABLE users; --")).toBe(false);
      expect(validateUUID("1' OR '1'='1")).toBe(false);
      expect(validateUUID('550e8400-e29b-41d4-a716-446655440000;DELETE')).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('accetta numeri validi', () => {
      expect(validatePhone('+393331234567')).toBe(true);
      expect(validatePhone('3331234567')).toBe(true);
    });

    it('rifiuta numeri invalidi', () => {
      expect(validatePhone('')).toBe(false);
      expect(validatePhone('123')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('rimuove tag HTML', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert("xss")');
      expect(sanitizeString('<b>bold</b>')).toBe('bold');
    });

    it('gestisce input vuoto', () => {
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString(null as any)).toBe('');
    });
  });

  describe('assertValidUserId', () => {
    it('accetta userId UUID valido', () => {
      expect(() => assertValidUserId('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
    });

    it('lancia errore per userId null/undefined', () => {
      expect(() => assertValidUserId(null as any)).toThrow('USER_ID_REQUIRED');
      expect(() => assertValidUserId(undefined as any)).toThrow('USER_ID_REQUIRED');
    });

    it('lancia errore per userId stringa vuota', () => {
      expect(() => assertValidUserId('')).toThrow('USER_ID_REQUIRED');
      expect(() => assertValidUserId('   ')).toThrow('USER_ID_REQUIRED');
    });

    it('lancia errore per userId non UUID', () => {
      expect(() => assertValidUserId('invalid')).toThrow('INVALID_USER_ID');
    });
  });

  describe('assertValidWorkspaceId', () => {
    it('accetta workspaceId UUID valido', () => {
      expect(() => assertValidWorkspaceId('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
    });

    it('lancia errore per workspaceId null/undefined', () => {
      expect(() => assertValidWorkspaceId(null as any)).toThrow('WORKSPACE_ID_REQUIRED');
      expect(() => assertValidWorkspaceId(undefined as any)).toThrow('WORKSPACE_ID_REQUIRED');
    });

    it('lancia errore per workspaceId stringa vuota', () => {
      expect(() => assertValidWorkspaceId('')).toThrow('WORKSPACE_ID_REQUIRED');
    });

    it('lancia errore per workspaceId non UUID', () => {
      expect(() => assertValidWorkspaceId('invalid')).toThrow('INVALID_WORKSPACE_ID');
    });

    it('lancia errore per tentativi SQL injection', () => {
      expect(() => assertValidWorkspaceId("'; DROP TABLE--")).toThrow('INVALID_WORKSPACE_ID');
    });
  });

  describe('buildWorkspaceFilter', () => {
    it('costruisce filtro corretto per UUID valido', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const filter = buildWorkspaceFilter(uuid);

      expect(filter).toBe(`workspace_id.eq.${uuid},workspace_id.is.null`);
    });

    it('lancia errore per UUID invalido', () => {
      expect(() => buildWorkspaceFilter('invalid')).toThrow('INVALID_WORKSPACE_ID');
    });

    it('previene SQL injection nel filtro', () => {
      // Questi tentativi di injection devono essere bloccati
      expect(() => buildWorkspaceFilter("550e8400'; DROP TABLE--")).toThrow();
      expect(() => buildWorkspaceFilter("1' OR '1'='1")).toThrow();
      expect(() => buildWorkspaceFilter('workspace_id.eq.malicious')).toThrow();
    });

    it('rifiuta stringa vuota', () => {
      expect(() => buildWorkspaceFilter('')).toThrow('WORKSPACE_ID_REQUIRED');
    });

    it('rifiuta null/undefined', () => {
      expect(() => buildWorkspaceFilter(null as any)).toThrow('WORKSPACE_ID_REQUIRED');
      expect(() => buildWorkspaceFilter(undefined as any)).toThrow('WORKSPACE_ID_REQUIRED');
    });
  });
});

describe('SQL Injection Prevention - Critical Security Tests', () => {
  const maliciousInputs = [
    "'; DROP TABLE price_lists; --",
    "1' OR '1'='1",
    'workspace_id.eq.malicious,workspace_id.eq.other',
    '550e8400-e29b-41d4-a716-446655440000; DELETE FROM users',
    "550e8400-e29b-41d4-a716-446655440000' OR 1=1--",
    '<script>alert(1)</script>',
    '${process.env.SECRET}',
    '../../../etc/passwd',
  ];

  it.each(maliciousInputs)('buildWorkspaceFilter rifiuta input malevolo: %s', (input) => {
    expect(() => buildWorkspaceFilter(input)).toThrow();
  });

  it.each(maliciousInputs)('assertValidWorkspaceId rifiuta input malevolo: %s', (input) => {
    expect(() => assertValidWorkspaceId(input)).toThrow();
  });
});
