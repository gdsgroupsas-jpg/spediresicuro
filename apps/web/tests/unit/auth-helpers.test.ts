/**
 * Test per lib/auth-helpers.ts — funzioni pure per check ruolo
 *
 * Verifica che:
 * - Solo account_type viene usato (role ignorato)
 * - Tutti i valori account_type testati
 * - Edge case: undefined, null, stringa vuota
 */

import { describe, it, expect } from 'vitest';
import { isSuperAdminCheck, isAdminOrAbove, isResellerCheck, isBYOC } from '@/lib/auth-helpers';
import type { AuthCheckable } from '@/lib/auth-helpers';

// ============================================================
// isSuperAdminCheck
// ============================================================
describe('isSuperAdminCheck — solo account_type superadmin', () => {
  it('true per superadmin', () => {
    expect(isSuperAdminCheck({ account_type: 'superadmin' })).toBe(true);
  });

  it('true per Superadmin (case insensitive)', () => {
    expect(isSuperAdminCheck({ account_type: 'Superadmin' })).toBe(true);
  });

  it('false per admin', () => {
    expect(isSuperAdminCheck({ account_type: 'admin' })).toBe(false);
  });

  it('false per user', () => {
    expect(isSuperAdminCheck({ account_type: 'user' })).toBe(false);
  });

  it('false per reseller', () => {
    expect(isSuperAdminCheck({ account_type: 'reseller' })).toBe(false);
  });

  it('false per byoc', () => {
    expect(isSuperAdminCheck({ account_type: 'byoc' })).toBe(false);
  });

  it('false per undefined', () => {
    expect(isSuperAdminCheck({ account_type: undefined })).toBe(false);
  });

  it('false per null', () => {
    expect(isSuperAdminCheck({ account_type: null })).toBe(false);
  });

  it('false per stringa vuota', () => {
    expect(isSuperAdminCheck({ account_type: '' })).toBe(false);
  });

  it('false per oggetto vuoto', () => {
    expect(isSuperAdminCheck({})).toBe(false);
  });
});

// ============================================================
// isAdminOrAbove
// ============================================================
describe('isAdminOrAbove — admin o superadmin', () => {
  it('true per admin', () => {
    expect(isAdminOrAbove({ account_type: 'admin' })).toBe(true);
  });

  it('true per superadmin', () => {
    expect(isAdminOrAbove({ account_type: 'superadmin' })).toBe(true);
  });

  it('true per Admin (case insensitive)', () => {
    expect(isAdminOrAbove({ account_type: 'Admin' })).toBe(true);
  });

  it('false per user', () => {
    expect(isAdminOrAbove({ account_type: 'user' })).toBe(false);
  });

  it('false per reseller', () => {
    expect(isAdminOrAbove({ account_type: 'reseller' })).toBe(false);
  });

  it('false per byoc', () => {
    expect(isAdminOrAbove({ account_type: 'byoc' })).toBe(false);
  });

  it('false per undefined', () => {
    expect(isAdminOrAbove({ account_type: undefined })).toBe(false);
  });

  it('false per null', () => {
    expect(isAdminOrAbove({ account_type: null })).toBe(false);
  });
});

// ============================================================
// isResellerCheck
// ============================================================
describe('isResellerCheck — flag is_reseller', () => {
  it('true per is_reseller=true', () => {
    expect(isResellerCheck({ is_reseller: true })).toBe(true);
  });

  it('false per is_reseller=false', () => {
    expect(isResellerCheck({ is_reseller: false })).toBe(false);
  });

  it('false per is_reseller=undefined', () => {
    expect(isResellerCheck({ is_reseller: undefined })).toBe(false);
  });

  it('false per oggetto vuoto', () => {
    expect(isResellerCheck({})).toBe(false);
  });

  // Verifica che account_type NON influenza il risultato
  it('false per account_type=reseller senza is_reseller flag', () => {
    expect(isResellerCheck({ account_type: 'reseller' })).toBe(false);
  });
});

// ============================================================
// isBYOC
// ============================================================
describe('isBYOC — account_type byoc', () => {
  it('true per byoc', () => {
    expect(isBYOC({ account_type: 'byoc' })).toBe(true);
  });

  it('true per BYOC (case insensitive)', () => {
    expect(isBYOC({ account_type: 'BYOC' })).toBe(true);
  });

  it('false per user', () => {
    expect(isBYOC({ account_type: 'user' })).toBe(false);
  });

  it('false per admin', () => {
    expect(isBYOC({ account_type: 'admin' })).toBe(false);
  });

  it('false per undefined', () => {
    expect(isBYOC({})).toBe(false);
  });
});

// ============================================================
// REGOLA CRITICA: role viene IGNORATO
// ============================================================
describe('REGOLA: campo role e ignored (deprecated)', () => {
  it('isSuperAdminCheck ignora role=superadmin se account_type=user', () => {
    // role non deve mai influenzare il risultato
    const u: AuthCheckable & { role?: string } = {
      account_type: 'user',
    };
    expect(isSuperAdminCheck(u)).toBe(false);
  });

  it('isAdminOrAbove ignora role=admin se account_type=user', () => {
    const u: AuthCheckable & { role?: string } = {
      account_type: 'user',
    };
    expect(isAdminOrAbove(u)).toBe(false);
  });
});
