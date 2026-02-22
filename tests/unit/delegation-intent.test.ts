/**
 * Test C3: Intent detection "per conto di" + DelegationContext
 *
 * Verifica pattern detection italiani, estrazione target,
 * e costruzione contesto delegato (actor preservato, workspace cambiato).
 */
import { describe, it, expect } from 'vitest';
import { detectDelegationIntent, extractDelegationTarget } from '@/lib/agent/intent-detector';
import { buildDelegatedActingContext, type DelegationContext } from '@/lib/ai/delegation-context';
import type { WorkspaceActingContext } from '@/types/workspace';

// ============================================
// detectDelegationIntent
// ============================================
describe('detectDelegationIntent', () => {
  // Positivi
  it.each([
    'per conto di Awa Kanoute crea 5 spedizioni',
    'Per conto di Mario Rossi, spedisci un pacco',
    'per il cliente Awa Kanoute vorrei un preventivo',
    'a nome di Giovanni Bianchi manda un pacco',
    'workspace di Awa Kanoute crea spedizione',
    'PER CONTO DI AWA calcola un preventivo',
    'per il cliente Marco crea spedizione',
  ])('rileva delegazione: "%s"', (msg) => {
    expect(detectDelegationIntent(msg)).toBe(true);
  });

  // Negativi
  it.each([
    'crea una spedizione per Milano',
    'voglio spedire un pacco',
    'quanto costa spedire 5kg?',
    'il mio conto è attivo?',
    'per favore aiutami',
    '',
    'preventivo spedizione Roma-Milano',
    'gestisci i clienti',
  ])('NON rileva delegazione: "%s"', (msg) => {
    expect(detectDelegationIntent(msg)).toBe(false);
  });

  it('ritorna false per input null/undefined', () => {
    expect(detectDelegationIntent(null as any)).toBe(false);
    expect(detectDelegationIntent(undefined as any)).toBe(false);
  });
});

// ============================================
// extractDelegationTarget
// ============================================
describe('extractDelegationTarget', () => {
  it.each([
    ['per conto di Awa Kanoute crea 5 spedizioni', 'Awa Kanoute'],
    ['per conto di Awa Kanoute, spedisci un pacco', 'Awa Kanoute'],
    ['per il cliente Mario Rossi vorrei un preventivo', 'Mario Rossi'],
    ['a nome di Giovanni Bianchi manda un pacco', 'Giovanni Bianchi'],
    ['workspace di Awa Kanoute crea spedizione', 'Awa Kanoute'],
    ['per conto di   Awa Kanoute  ', 'Awa Kanoute'],
  ])('estrae "%s" → "%s"', (msg, expected) => {
    expect(extractDelegationTarget(msg)).toBe(expected);
  });

  it('ritorna null se nessun target trovato', () => {
    expect(extractDelegationTarget('ciao come stai')).toBeNull();
  });

  it('ritorna null per input vuoto', () => {
    expect(extractDelegationTarget('')).toBeNull();
    expect(extractDelegationTarget(null as any)).toBeNull();
  });

  it('rimuove punteggiatura trailing dal target', () => {
    expect(extractDelegationTarget('per conto di Awa Kanoute.')).toBe('Awa Kanoute');
    expect(extractDelegationTarget('per conto di Awa Kanoute!')).toBe('Awa Kanoute');
    expect(extractDelegationTarget('per conto di Awa Kanoute:')).toBe('Awa Kanoute');
  });

  // F-SEC-3: Unicode NFC normalization
  it('normalizza Unicode NFC — accento composto NFD → NFC', () => {
    // "Kanouté" con accento composto (e + combining acute U+0301) → NFC (é U+00E9)
    const nfdInput = 'per conto di Kanoute\u0301 crea spedizione';
    const result = extractDelegationTarget(nfdInput);
    // Il risultato deve essere NFC-normalizzato
    expect(result).toBe('Kanoute\u0301'.normalize('NFC'));
    expect(result).toBe('Kanouté');
  });

  it('ASCII puro non cambia con NFC (no regression)', () => {
    const result = extractDelegationTarget('per conto di Awa Kanoute crea spedizione');
    expect(result).toBe('Awa Kanoute');
  });
});

// ============================================
// buildDelegatedActingContext
// ============================================
describe('buildDelegatedActingContext', () => {
  const originalContext: WorkspaceActingContext = {
    actor: {
      id: 'reseller-user-1',
      email: 'reseller@test.com',
      name: 'GDS Group',
      role: 'admin',
      account_type: 'reseller',
      is_reseller: true,
    },
    target: {
      id: 'reseller-user-1',
      email: 'reseller@test.com',
      name: 'GDS Group',
      role: 'admin',
    },
    workspace: {
      id: 'reseller-ws-1',
      name: 'GDS Group Workspace',
      slug: 'gds-group',
      type: 'reseller',
      depth: 1,
      organization_id: 'org-1',
      organization_name: 'GDS',
      organization_slug: 'gds',
      wallet_balance: 1000,
      role: 'owner',
      permissions: [],
      branding: {} as any,
    },
    isImpersonating: false,
  };

  const delegation: DelegationContext = {
    isDelegating: true,
    delegatedWorkspaceId: 'subclient-ws-1',
    resellerWorkspaceId: 'reseller-ws-1',
    subClientName: 'Awa Kanoute',
    subClientWorkspaceName: 'Awa Kanoute Shipping',
    subClientUserId: 'subclient-user-1',
  };

  it('preserva actor (reseller)', () => {
    const result = buildDelegatedActingContext(originalContext, delegation);
    expect(result.actor.id).toBe('reseller-user-1');
    expect(result.actor.email).toBe('reseller@test.com');
    expect(result.actor.name).toBe('GDS Group');
  });

  it('cambia target al sub-client', () => {
    const result = buildDelegatedActingContext(originalContext, delegation);
    expect(result.target.id).toBe('subclient-user-1');
    expect(result.target.name).toBe('Awa Kanoute');
  });

  it('cambia workspace al sub-client', () => {
    const result = buildDelegatedActingContext(originalContext, delegation);
    expect(result.workspace.id).toBe('subclient-ws-1');
    expect(result.workspace.name).toBe('Awa Kanoute Shipping');
  });

  it('imposta isImpersonating a true', () => {
    const result = buildDelegatedActingContext(originalContext, delegation);
    expect(result.isImpersonating).toBe(true);
  });

  it('imposta metadata.reason per audit trail', () => {
    const result = buildDelegatedActingContext(originalContext, delegation);
    expect(result.metadata?.reason).toBe('delegation:per_conto_di');
  });

  it('subClientUserId presente nel target', () => {
    const result = buildDelegatedActingContext(originalContext, delegation);
    expect(result.target.id).toBe(delegation.subClientUserId);
  });

  it('non modifica il contesto originale (immutabilita)', () => {
    const originalActorId = originalContext.actor.id;
    const originalWsId = originalContext.workspace.id;

    buildDelegatedActingContext(originalContext, delegation);

    expect(originalContext.actor.id).toBe(originalActorId);
    expect(originalContext.workspace.id).toBe(originalWsId);
    expect(originalContext.isImpersonating).toBe(false);
  });
});
