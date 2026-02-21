/**
 * Test consolidamento RBAC — Finding F1
 *
 * Verifica che isSuperAdmin() usi SOLO account_type (source of truth),
 * NON il campo role (deprecated).
 *
 * Verifica che isAdminOrAbove() funzioni per admin e superadmin.
 * Verifica che impersonation sia riservata a superadmin.
 */

import { describe, it, expect } from 'vitest';
import { isSuperAdmin, isAdminOrAbove, isReseller } from '@/lib/safe-auth';
import type { ActingContext, ActingUser } from '@/lib/safe-auth';

// Helper per creare ActingContext di test
function makeContext(overrides: Partial<ActingUser> = {}): ActingContext {
  const actor: ActingUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    account_type: 'user',
    is_reseller: false,
    ...overrides,
  };
  return { actor, target: actor, isImpersonating: false };
}

// ============================================================
// isSuperAdmin — SOLO account_type === 'superadmin'
// ============================================================
describe('isSuperAdmin — usa SOLO account_type (FIX F1)', () => {
  it('ritorna true per account_type superadmin', () => {
    const ctx = makeContext({ account_type: 'superadmin', role: 'superadmin' });
    expect(isSuperAdmin(ctx)).toBe(true);
  });

  it('ritorna true per account_type superadmin anche con role diverso', () => {
    // Caso legacy: role='admin' ma account_type='superadmin'
    const ctx = makeContext({ account_type: 'superadmin', role: 'admin' });
    expect(isSuperAdmin(ctx)).toBe(true);
  });

  it('ritorna true per account_type Superadmin (case insensitive)', () => {
    const ctx = makeContext({ account_type: 'Superadmin', role: 'user' });
    expect(isSuperAdmin(ctx)).toBe(true);
  });

  it('ritorna FALSE per account_type admin (FIX F1: era true prima!)', () => {
    // QUESTO E' IL FIX CRITICO F1: admin NON e' superadmin
    const ctx = makeContext({ account_type: 'admin', role: 'admin' });
    expect(isSuperAdmin(ctx)).toBe(false);
  });

  it('ritorna FALSE per role=admin senza account_type superadmin', () => {
    const ctx = makeContext({ account_type: 'user', role: 'admin' });
    expect(isSuperAdmin(ctx)).toBe(false);
  });

  it('ritorna FALSE per role=superadmin con account_type=user', () => {
    // role e' deprecated — conta solo account_type
    const ctx = makeContext({ account_type: 'user', role: 'superadmin' });
    expect(isSuperAdmin(ctx)).toBe(false);
  });

  it('ritorna FALSE per account_type reseller', () => {
    const ctx = makeContext({ account_type: 'reseller', role: 'reseller' });
    expect(isSuperAdmin(ctx)).toBe(false);
  });

  it('ritorna FALSE per account_type byoc', () => {
    const ctx = makeContext({ account_type: 'byoc', role: 'user' });
    expect(isSuperAdmin(ctx)).toBe(false);
  });

  it('ritorna FALSE per account_type undefined', () => {
    const ctx = makeContext({ account_type: undefined, role: 'admin' });
    expect(isSuperAdmin(ctx)).toBe(false);
  });
});

// ============================================================
// isAdminOrAbove — account_type admin O superadmin
// ============================================================
describe('isAdminOrAbove — admin o superadmin via account_type', () => {
  it('ritorna true per account_type admin', () => {
    const ctx = makeContext({ account_type: 'admin' });
    expect(isAdminOrAbove(ctx)).toBe(true);
  });

  it('ritorna true per account_type superadmin', () => {
    const ctx = makeContext({ account_type: 'superadmin' });
    expect(isAdminOrAbove(ctx)).toBe(true);
  });

  it('ritorna FALSE per account_type user', () => {
    const ctx = makeContext({ account_type: 'user' });
    expect(isAdminOrAbove(ctx)).toBe(false);
  });

  it('ritorna FALSE per account_type reseller', () => {
    const ctx = makeContext({ account_type: 'reseller' });
    expect(isAdminOrAbove(ctx)).toBe(false);
  });

  it('ritorna FALSE per account_type byoc', () => {
    const ctx = makeContext({ account_type: 'byoc' });
    expect(isAdminOrAbove(ctx)).toBe(false);
  });

  it('ritorna FALSE per account_type undefined con role=admin (role ignorato)', () => {
    const ctx = makeContext({ account_type: undefined, role: 'admin' });
    expect(isAdminOrAbove(ctx)).toBe(false);
  });
});

// ============================================================
// isReseller — invariato (is_reseller === true)
// ============================================================
describe('isReseller — usa is_reseller flag', () => {
  it('ritorna true per is_reseller true', () => {
    const ctx = makeContext({ is_reseller: true });
    expect(isReseller(ctx)).toBe(true);
  });

  it('ritorna FALSE per is_reseller false', () => {
    const ctx = makeContext({ is_reseller: false });
    expect(isReseller(ctx)).toBe(false);
  });

  it('ritorna FALSE per is_reseller undefined', () => {
    const ctx = makeContext({ is_reseller: undefined });
    expect(isReseller(ctx)).toBe(false);
  });
});

// ============================================================
// AUTHORIZED_IMPERSONATORS — solo superadmin
// ============================================================
describe('Impersonation — solo superadmin autorizzato', () => {
  it('codice sorgente: AUTHORIZED_IMPERSONATORS contiene solo superadmin', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve('lib/safe-auth.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Deve contenere solo 'superadmin', NON 'admin' nella lista
    expect(content).toContain("AUTHORIZED_IMPERSONATORS = ['superadmin']");
    expect(content).not.toContain("AUTHORIZED_IMPERSONATORS = ['admin', 'superadmin']");
  });

  it('isSuperAdmin NON controlla il campo role (deprecated)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve('lib/safe-auth.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // La funzione isSuperAdmin non deve avere role === 'admin'
    // Cerca nella funzione specifica (tra export function isSuperAdmin e la prossima funzione)
    const fnMatch = content.match(
      /export function isSuperAdmin\(context: ActingContext\): boolean \{[\s\S]*?return[\s\S]*?\n\}/
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];

    // NON deve contenere check su role
    expect(fnBody).not.toContain("role === 'admin'");
    expect(fnBody).not.toContain("role === 'superadmin'");
    // DEVE contenere check su accountType
    expect(fnBody).toContain("accountType === 'superadmin'");
  });
});

// ============================================================
// JWT alignment — role allineato a account_type
// ============================================================
describe('JWT callback — role allineato a account_type', () => {
  it('auth-config.ts allinea token.role a account_type', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve('lib/auth-config.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Deve avere l'allineamento role = account_type
    expect(content).toContain('token.role = userData.account_type || token.role');
  });

  it('auto-promozione scrive role=superadmin (non admin)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve('lib/auth-config.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Nella sezione auto-promote, role deve essere 'superadmin'
    // Cerchiamo il pattern: account_type: 'superadmin' seguito da role: 'superadmin'
    const autoPromoteSection = content.match(
      /account_type:\s*'superadmin'[\s\S]{0,200}role:\s*'(\w+)'/
    );
    expect(autoPromoteSection).toBeTruthy();
    expect(autoPromoteSection![1]).toBe('superadmin');
  });
});
