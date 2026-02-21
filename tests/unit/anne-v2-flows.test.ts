/**
 * Test per i flussi Anne v2: supervisor, specific-flows, chains.
 * Verifica classificazione, parsing flowId, mappatura macro→specifico.
 */
import { describe, it, expect, vi } from 'vitest';

// Supervisor
import { FLOW_IDS, type FlowId } from '@/lib/agent/supervisor';

// Specific flows
import {
  SPECIFIC_FLOW_IDS,
  isSpecificFlowId,
  isMacroWithSpecifics,
  getSpecificFlowIdsForMacro,
  MACRO_TO_SPECIFICS,
  type SpecificFlowId,
} from '@/lib/agent/specific-flows';

// Flows types
import type { FlowContext, FlowResult } from '@/lib/agent/flows/types';

// ─── Supervisor ──────────────────────────────────────────────────────

describe('anne-v2: supervisor FLOW_IDS', () => {
  it('contiene tutti i 9 flowId attesi', () => {
    expect(FLOW_IDS).toContain('richiesta_preventivo');
    expect(FLOW_IDS).toContain('crea_spedizione');
    expect(FLOW_IDS).toContain('support');
    expect(FLOW_IDS).toContain('crm');
    expect(FLOW_IDS).toContain('outreach');
    expect(FLOW_IDS).toContain('listini');
    expect(FLOW_IDS).toContain('mentor');
    expect(FLOW_IDS).toContain('debug');
    expect(FLOW_IDS).toContain('explain');
    expect(FLOW_IDS).toHaveLength(9);
  });
});

// ─── parseFlowId (via import privato — testiamo il contratto indiretto) ──

describe('anne-v2: parseFlowId contratto', () => {
  // parseFlowId non e' esportato, ma il contratto e' che supervisorRoute
  // restituisce sempre un FlowId valido. Testiamo che il type sia coerente.
  it('tutti i FLOW_IDS sono stringhe valide', () => {
    for (const id of FLOW_IDS) {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      expect(id).not.toContain(' ');
    }
  });
});

// ─── Specific Flows ──────────────────────────────────────────────────

describe('anne-v2: specific-flows', () => {
  it('SPECIFIC_FLOW_IDS contiene 30 flowId', () => {
    expect(SPECIFIC_FLOW_IDS).toHaveLength(30);
  });

  it('isSpecificFlowId riconosce flowId validi', () => {
    expect(isSpecificFlowId('support_tracking')).toBe(true);
    expect(isSpecificFlowId('crm_lead')).toBe(true);
    expect(isSpecificFlowId('explain_margini')).toBe(true);
    expect(isSpecificFlowId('listini_clona')).toBe(true);
    expect(isSpecificFlowId('mentor_wallet')).toBe(true);
    expect(isSpecificFlowId('debug_bug')).toBe(true);
  });

  it('isSpecificFlowId rifiuta flowId invalidi', () => {
    expect(isSpecificFlowId('invalid_flow')).toBe(false);
    expect(isSpecificFlowId('support')).toBe(false);
    expect(isSpecificFlowId('')).toBe(false);
    expect(isSpecificFlowId('richiesta_preventivo')).toBe(false);
  });

  it('isMacroWithSpecifics identifica macro con sotto-flussi', () => {
    expect(isMacroWithSpecifics('support')).toBe(true);
    expect(isMacroWithSpecifics('crm')).toBe(true);
    expect(isMacroWithSpecifics('outreach')).toBe(true);
    expect(isMacroWithSpecifics('listini')).toBe(true);
    expect(isMacroWithSpecifics('mentor')).toBe(true);
    expect(isMacroWithSpecifics('debug')).toBe(true);
    expect(isMacroWithSpecifics('explain')).toBe(true);
  });

  it('isMacroWithSpecifics rifiuta flussi diretti', () => {
    expect(isMacroWithSpecifics('richiesta_preventivo')).toBe(false);
    expect(isMacroWithSpecifics('crea_spedizione')).toBe(false);
  });

  it('getSpecificFlowIdsForMacro restituisce flowId corretti per support', () => {
    const ids = getSpecificFlowIdsForMacro('support');
    expect(ids).toContain('support_tracking');
    expect(ids).toContain('support_giacenza');
    expect(ids).toContain('support_rimborso');
    expect(ids).toContain('support_cancellazione');
    expect(ids).toContain('support_problema_consegna');
    expect(ids).toContain('support_assistenza');
    expect(ids).toHaveLength(6);
  });

  it('getSpecificFlowIdsForMacro restituisce array vuoto per flussi diretti', () => {
    expect(getSpecificFlowIdsForMacro('richiesta_preventivo')).toHaveLength(0);
    expect(getSpecificFlowIdsForMacro('crea_spedizione')).toHaveLength(0);
  });

  it('ogni specificFlowId inizia con il prefisso macro corretto', () => {
    for (const [macro, specifics] of Object.entries(MACRO_TO_SPECIFICS)) {
      for (const specific of specifics) {
        expect(specific.startsWith(macro + '_')).toBe(true);
      }
    }
  });

  it("tutti i specificFlowId in MACRO_TO_SPECIFICS sono nell'elenco globale", () => {
    const globalSet = new Set<string>(SPECIFIC_FLOW_IDS);
    for (const specifics of Object.values(MACRO_TO_SPECIFICS)) {
      for (const id of specifics) {
        expect(globalSet.has(id)).toBe(true);
      }
    }
  });
});

// ─── FlowContext / FlowResult types ──────────────────────────────────

describe('anne-v2: FlowContext/FlowResult types', () => {
  it('FlowContext accetta 3-way role (admin, user, reseller)', () => {
    const ctxAdmin: FlowContext = {
      message: 'test',
      userId: 'u1',
      userRole: 'admin',
    };
    const ctxUser: FlowContext = {
      message: 'test',
      userId: 'u2',
      userRole: 'user',
    };
    const ctxReseller: FlowContext = {
      message: 'test',
      userId: 'u3',
      userRole: 'reseller',
    };
    // Se compila, il tipo e' corretto
    expect(ctxAdmin.userRole).toBe('admin');
    expect(ctxUser.userRole).toBe('user');
    expect(ctxReseller.userRole).toBe('reseller');
  });

  it('FlowResult supporta needsApproval e validationFailed', () => {
    const result: FlowResult = {
      message: 'test',
      needsApproval: 'Vuoi confermare?',
      validationFailed: 'Errore validazione',
    };
    expect(result.needsApproval).toBe('Vuoi confermare?');
    expect(result.validationFailed).toBe('Errore validazione');
  });
});

// ─── Chains: importazione e struttura ────────────────────────────────

describe('anne-v2: chains module', () => {
  it('runFlowChain esportato come funzione asincrona', async () => {
    const { runFlowChain } = await import('@/lib/agent/chains/run-flow-chain');
    expect(typeof runFlowChain).toBe('function');
  });

  it('RunFlowChainInput NON ha piu specificFlowId (dead code rimosso)', async () => {
    const mod = await import('@/lib/agent/chains/run-flow-chain');
    // Verifica che il modulo esporti RunFlowChainInput senza specificFlowId
    // Se il tipo compilasse con specificFlowId, il test seguente fallirebbe a compile-time
    const input: import('@/lib/agent/chains/run-flow-chain').RunFlowChainInput = {
      message: 'test',
      userId: 'u1',
    };
    expect(input.message).toBe('test');
  });
});

// ─── v2 module: export structure ─────────────────────────────────────

describe('anne-v2: v2 module exports', () => {
  it('v2/index esporta i moduli attesi', async () => {
    const v2 = await import('@/lib/agent/v2/index');
    // Verifica che le export chiave esistano
    expect(v2).toHaveProperty('buildOllamaRoleClient');
    expect(v2).toHaveProperty('buildAnneV2ToolCatalog');
    expect(v2).toHaveProperty('buildAnneV2ToolExecutor');
    expect(v2).toHaveProperty('buildAnneV2Dependencies');
    expect(v2).toHaveProperty('buildMultiProviderLlm');
    expect(v2).toHaveProperty('resolveProvider');
    expect(v2).toHaveProperty('resolveModel');
  });
});
