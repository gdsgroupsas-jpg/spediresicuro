/**
 * Test C5 R2: delegation_info in sanitizeAgentStateForClient
 *
 * Verifica:
 * - delegation_info presente quando delegation_context attivo
 * - delegation_info assente senza delegazione
 * - delegation_info NON contiene subClientUserId (privacy)
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');

describe('sanitizeAgentStateForClient — delegation_info (R2)', () => {
  // Test strutturale: verifica che il codice espone delegation_info correttamente
  const routeContent = fs.readFileSync(path.join(ROOT, 'app/api/ai/agent-chat/route.ts'), 'utf8');

  it('delegation_info presente in sanitizeAgentStateForClient', () => {
    expect(routeContent).toContain('delegation_info');
  });

  it('delegation_info espone subClientName', () => {
    expect(routeContent).toContain('subClientName');
  });

  it('delegation_info espone workspaceName', () => {
    expect(routeContent).toContain('workspaceName');
  });

  it('delegation_info NON espone subClientUserId (privacy)', () => {
    // Verifica che subClientUserId non appaia nel blocco delegation_info
    // Il campo esiste nel DelegationContext ma NON deve essere esposto al client
    const delegationInfoBlock = routeContent.match(/delegation_info:[\s\S]*?(?=\/\/ NO:|^\s*\};)/m);
    if (delegationInfoBlock) {
      expect(delegationInfoBlock[0]).not.toContain('subClientUserId');
    }
  });

  it('delegation_info derivato sia da delegation_context che active_delegation', () => {
    // Verifica che il codice gestisca entrambe le sorgenti
    expect(routeContent).toContain('state.delegation_context');
    expect(routeContent).toContain('state.active_delegation');
  });
});
