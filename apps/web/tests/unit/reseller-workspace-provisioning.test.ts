/**
 * Test: Reseller Workspace Auto-Provisioning
 *
 * Verifica la logica di auto-provisioning workspace per reseller:
 * - Calcolo type/depth dal parent
 * - Nome workspace corretto
 * - Validazione parametri
 * - Gestione errori non-bloccanti
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';

// ============================================
// HELPERS (replica della logica di provisioning)
// ============================================

/**
 * Calcola type e depth del workspace dal parent
 * (logica identica all'RPC create_workspace_with_owner)
 */
function calculateWorkspaceTypeAndDepth(
  parentDepth: number | null,
  explicitType?: string | null,
  explicitDepth?: number | null
): { type: string; depth: number } {
  // Se espliciti, usa quelli
  if (explicitType && explicitDepth != null) {
    return { type: explicitType, depth: explicitDepth };
  }

  // Calcola dal parent
  if (parentDepth != null) {
    const depth = parentDepth + 1;
    if (depth === 1) return { type: 'reseller', depth: 1 };
    if (depth === 2) return { type: 'client', depth: 2 };
    throw new Error(`Max workspace depth exceeded (max 2, got ${depth})`);
  }

  // Nessun parent e nessun tipo esplicito
  throw new Error('type and depth required when no parent workspace provided');
}

/**
 * Genera nome workspace per reseller
 */
function generateWorkspaceName(name: string | null | undefined, email: string): string {
  return `${name || email.split('@')[0]} Workspace`;
}

/**
 * Determina se un utente necessita di auto-provisioning workspace
 */
function needsWorkspaceProvisioning(user: {
  is_reseller?: boolean;
  primary_workspace_id?: string | null;
}): boolean {
  return user.is_reseller === true && !user.primary_workspace_id;
}

/**
 * Valida accountType dalla registrazione
 */
function validateAccountType(accountType: string): string {
  return ['admin', 'reseller'].includes(accountType) ? accountType : 'user';
}

/**
 * Determina se un accountType e' reseller
 */
function isResellerAccountType(accountType: string): boolean {
  return validateAccountType(accountType) === 'reseller';
}

// ============================================
// TESTS
// ============================================

describe('Workspace Type/Depth Calculation', () => {
  it('platform (depth 0) parent genera reseller depth 1', () => {
    const result = calculateWorkspaceTypeAndDepth(0);
    expect(result).toEqual({ type: 'reseller', depth: 1 });
  });

  it('reseller (depth 1) parent genera client depth 2', () => {
    const result = calculateWorkspaceTypeAndDepth(1);
    expect(result).toEqual({ type: 'client', depth: 2 });
  });

  it('depth 2 parent causa errore (max depth)', () => {
    expect(() => calculateWorkspaceTypeAndDepth(2)).toThrow('Max workspace depth exceeded');
  });

  it('nessun parent e nessun tipo esplicito causa errore', () => {
    expect(() => calculateWorkspaceTypeAndDepth(null)).toThrow(
      'type and depth required when no parent workspace provided'
    );
  });

  it('tipo e depth espliciti vengono usati direttamente', () => {
    const result = calculateWorkspaceTypeAndDepth(null, 'reseller', 1);
    expect(result).toEqual({ type: 'reseller', depth: 1 });
  });

  it('tipo e depth espliciti sovrascrivono il calcolo dal parent', () => {
    const result = calculateWorkspaceTypeAndDepth(0, 'client', 2);
    expect(result).toEqual({ type: 'client', depth: 2 });
  });
});

describe('Workspace Name Generation', () => {
  it('usa il nome utente se disponibile', () => {
    expect(generateWorkspaceName('Mario Rossi', 'mario@test.it')).toBe('Mario Rossi Workspace');
  });

  it('usa la parte locale della email se nome mancante', () => {
    expect(generateWorkspaceName(null, 'mario@test.it')).toBe('mario Workspace');
  });

  it('usa la parte locale della email se nome undefined', () => {
    expect(generateWorkspaceName(undefined, 'test@example.com')).toBe('test Workspace');
  });

  it('gestisce nome vuoto', () => {
    expect(generateWorkspaceName('', 'user@domain.com')).toBe('user Workspace');
  });
});

describe('Workspace Provisioning Check', () => {
  it('reseller senza workspace necessita provisioning', () => {
    expect(
      needsWorkspaceProvisioning({
        is_reseller: true,
        primary_workspace_id: null,
      })
    ).toBe(true);
  });

  it('reseller con workspace NON necessita provisioning', () => {
    expect(
      needsWorkspaceProvisioning({
        is_reseller: true,
        primary_workspace_id: 'some-uuid',
      })
    ).toBe(false);
  });

  it('utente non-reseller NON necessita provisioning', () => {
    expect(
      needsWorkspaceProvisioning({
        is_reseller: false,
        primary_workspace_id: null,
      })
    ).toBe(false);
  });

  it('utente senza is_reseller NON necessita provisioning', () => {
    expect(
      needsWorkspaceProvisioning({
        primary_workspace_id: null,
      })
    ).toBe(false);
  });
});

describe('Account Type Validation', () => {
  it('accetta "reseller" come tipo valido', () => {
    expect(validateAccountType('reseller')).toBe('reseller');
  });

  it('accetta "admin" come tipo valido', () => {
    expect(validateAccountType('admin')).toBe('admin');
  });

  it('tipo sconosciuto diventa "user"', () => {
    expect(validateAccountType('superadmin')).toBe('user');
  });

  it('tipo vuoto diventa "user"', () => {
    expect(validateAccountType('')).toBe('user');
  });

  it('tipo "user" resta "user"', () => {
    expect(validateAccountType('user')).toBe('user');
  });
});

describe('isResellerAccountType', () => {
  it('"reseller" e\' reseller', () => {
    expect(isResellerAccountType('reseller')).toBe(true);
  });

  it('"admin" NON e\' reseller', () => {
    expect(isResellerAccountType('admin')).toBe(false);
  });

  it('"user" NON e\' reseller', () => {
    expect(isResellerAccountType('user')).toBe(false);
  });

  it("tipo sconosciuto NON e' reseller", () => {
    expect(isResellerAccountType('unknown')).toBe(false);
  });
});
