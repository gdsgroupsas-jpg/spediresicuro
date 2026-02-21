/**
 * Test per packages/domain-ai: contract parsers, tool safety, approval policy, model resolver.
 * Verifica che il package importato via @ss/domain-ai funzioni correttamente.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseRequestManagerContract,
  parseDomainDecomposerContract,
  parseToolAnalysisContract,
  parseFinalizerContract,
  parseAggregatorContract,
  parseToolCallerContract,
  ContractValidationError,
} from '@ss/domain-ai';
import { evaluateToolSafety } from '@ss/domain-ai';
import { evaluateApprovalPolicy } from '@ss/domain-ai';
import {
  resolveRoleModel,
  resolveDomainRoleModel,
  roleToEnvSuffix,
  domainToEnvSuffix,
} from '@ss/domain-ai';
import type { ToolSpec, ToolCall, ToolExecutionContext, RiskLevel } from '@ss/domain-ai';

// ─── Contract Parsers ────────────────────────────────────────────────

describe('domain-ai: contract parsers', () => {
  describe('parseRequestManagerContract', () => {
    it('parsa correttamente un JSON valido', () => {
      const raw = JSON.stringify({
        domain: 'quote',
        channel: 'quote',
        intentId: 'richiesta_preventivo',
        reason: 'utente chiede preventivo',
        confidence: 90,
      });
      const result = parseRequestManagerContract(raw);
      expect(result.domain).toBe('quote');
      expect(result.channel).toBe('quote');
      expect(result.intentId).toBe('richiesta_preventivo');
      expect(result.confidence).toBe(90);
    });

    it('lancia ContractValidationError per JSON malformato', () => {
      expect(() => parseRequestManagerContract('not json')).toThrow(ContractValidationError);
    });

    it('lancia ContractValidationError se manca domain', () => {
      const raw = JSON.stringify({
        channel: 'quote',
        intentId: 'x',
        reason: 'y',
        confidence: 50,
      });
      expect(() => parseRequestManagerContract(raw)).toThrow(ContractValidationError);
    });

    it('rifiuta channel non valido', () => {
      const raw = JSON.stringify({
        domain: 'quote',
        channel: 'invalid_channel',
        intentId: 'x',
        reason: 'y',
        confidence: 50,
      });
      expect(() => parseRequestManagerContract(raw)).toThrow(ContractValidationError);
    });

    it('clamp confidence: 150 diventa 100', () => {
      const raw = JSON.stringify({
        domain: 'quote',
        channel: 'quote',
        intentId: 'test',
        reason: 'test',
        confidence: 150,
      });
      const result = parseRequestManagerContract(raw);
      expect(result.confidence).toBe(100);
    });

    it('clamp confidence: -50 diventa 0', () => {
      const raw = JSON.stringify({
        domain: 'quote',
        channel: 'quote',
        intentId: 'test',
        reason: 'test',
        confidence: -50,
      });
      const result = parseRequestManagerContract(raw);
      expect(result.confidence).toBe(0);
    });

    it('parsa JSON con markdown fence', () => {
      const raw =
        '```json\n' +
        JSON.stringify({
          domain: 'support',
          channel: 'support',
          intentId: 'tracking',
          reason: 'utente chiede tracking',
          confidence: 85,
        }) +
        '\n```';
      const result = parseRequestManagerContract(raw);
      expect(result.domain).toBe('support');
      expect(result.confidence).toBe(85);
    });

    it('lancia errore per stringa vuota', () => {
      expect(() => parseRequestManagerContract('')).toThrow(ContractValidationError);
    });
  });

  describe('parseDomainDecomposerContract', () => {
    it('parsa subtasks validi', () => {
      const raw = JSON.stringify({
        subtasks: [{ id: 't1', domain: 'quote', goal: 'calcola prezzo', intentId: 'intent1' }],
      });
      const result = parseDomainDecomposerContract(raw, 'quote', 'intent1');
      expect(result.subtasks).toHaveLength(1);
      expect(result.subtasks[0].domain).toBe('quote');
    });

    it('lancia errore per JSON senza subtasks', () => {
      const raw = JSON.stringify({});
      expect(() => parseDomainDecomposerContract(raw, 'support', 'tracking')).toThrow(
        ContractValidationError
      );
    });
  });

  describe('parseToolAnalysisContract', () => {
    it('parsa analisi tool valida', () => {
      const raw = JSON.stringify({
        recommendedTool: 'calculate_price',
        riskLevel: 'low',
        missingData: [],
        requiresClarification: false,
      });
      const result = parseToolAnalysisContract(raw);
      expect(result.recommendedTool).toBe('calculate_price');
      expect(result.riskLevel).toBe('low');
      expect(result.requiresClarification).toBe(false);
    });

    it('lancia errore per JSON malformato', () => {
      expect(() => parseToolAnalysisContract('nope')).toThrow(ContractValidationError);
    });
  });

  describe('parseFinalizerContract', () => {
    it('parsa messaggio finalizer', () => {
      const raw = JSON.stringify({
        message: 'Ecco il preventivo per la tua spedizione.',
        clarificationRequest: undefined,
      });
      const result = parseFinalizerContract(raw);
      expect(result.message).toBe('Ecco il preventivo per la tua spedizione.');
    });

    it('lancia errore se manca message', () => {
      const raw = JSON.stringify({ clarificationRequest: 'test' });
      expect(() => parseFinalizerContract(raw)).toThrow(ContractValidationError);
    });
  });

  describe('parseAggregatorContract', () => {
    it('parsa aggregator valido', () => {
      const raw = JSON.stringify({
        summary: 'Risultati aggregati',
        clarificationRequired: false,
      });
      const result = parseAggregatorContract(raw);
      expect(result.summary).toBe('Risultati aggregati');
      expect(result.clarificationRequired).toBe(false);
    });
  });

  describe('parseToolCallerContract', () => {
    it('parsa tool caller valido', () => {
      const raw = JSON.stringify({
        tool: 'track_shipment',
        args: { trackingId: 'ABC123' },
        reason: 'utente chiede tracking',
      });
      const result = parseToolCallerContract(raw);
      expect(result.tool).toBe('track_shipment');
      expect(result.args).toEqual({ trackingId: 'ABC123' });
    });
  });
});

// ─── Tool Safety ─────────────────────────────────────────────────────

describe('domain-ai: tool safety', () => {
  const baseSpec: ToolSpec = {
    name: 'test_tool',
    description: 'Tool di test',
    properties: {},
    required: [],
    domains: ['quote'],
    riskLevel: 'low',
    requiresApproval: false,
    policy: { category: 'read', tenancy: 'workspace_required' },
  };

  const baseContext: ToolExecutionContext = {
    classification: {
      domain: 'quote',
      channel: 'quote',
      intentId: 'test',
      reason: '',
      confidence: 100,
    },
    input: {
      message: 'test',
      userId: 'user1',
      userRole: 'user',
      workspaceId: 'ws1',
    },
  };

  it('rimuove userId/workspaceId dagli argomenti (sanitizzazione)', () => {
    const call: ToolCall = {
      name: 'test_tool',
      arguments: { userId: 'hacker', workspace_id: 'leaked', param: 'ok' },
    };
    const result = evaluateToolSafety(baseSpec, call, baseContext);
    expect(result.allowed).toBe(true);
    expect(result.sanitizedCall?.arguments).not.toHaveProperty('userId');
    expect(result.sanitizedCall?.arguments).not.toHaveProperty('workspace_id');
    expect(result.sanitizedCall?.arguments).toHaveProperty('param', 'ok');
  });

  it('blocca tool con dominio non ammesso (domain_forbidden)', () => {
    const ctx: ToolExecutionContext = {
      ...baseContext,
      classification: { ...baseContext.classification, domain: 'crm' },
    };
    const call: ToolCall = { name: 'test_tool', arguments: {} };
    const result = evaluateToolSafety(baseSpec, call, ctx);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('domain_forbidden');
  });

  it('blocca tool con workspace mancante (missing_workspace)', () => {
    const ctx: ToolExecutionContext = {
      ...baseContext,
      input: { ...baseContext.input, workspaceId: undefined },
    };
    const call: ToolCall = { name: 'test_tool', arguments: {} };
    const result = evaluateToolSafety(baseSpec, call, ctx);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('missing_workspace');
  });

  it('blocca tool con argomenti obbligatori mancanti', () => {
    const spec: ToolSpec = {
      ...baseSpec,
      required: ['trackingId'],
    };
    const call: ToolCall = { name: 'test_tool', arguments: {} };
    const result = evaluateToolSafety(spec, call, baseContext);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('missing_required_args');
    expect(result.missingArgs).toContain('trackingId');
  });

  it('rimuove TUTTE le FORBIDDEN_ARG_KEYS: userId, user_id, workspaceId, workspace_id', () => {
    const call: ToolCall = {
      name: 'test_tool',
      arguments: {
        userId: 'a',
        user_id: 'b',
        workspaceId: 'c',
        workspace_id: 'd',
        legit_param: 'ok',
      },
    };
    const result = evaluateToolSafety(baseSpec, call, baseContext);
    expect(result.allowed).toBe(true);
    const args = result.sanitizedCall?.arguments ?? {};
    expect(args).not.toHaveProperty('userId');
    expect(args).not.toHaveProperty('user_id');
    expect(args).not.toHaveProperty('workspaceId');
    expect(args).not.toHaveProperty('workspace_id');
    expect(args).toHaveProperty('legit_param', 'ok');
  });

  it('ammette tool senza policy workspace_required se workspaceId manca', () => {
    const spec: ToolSpec = {
      ...baseSpec,
      policy: { category: 'read', tenancy: 'none' },
    };
    const ctx: ToolExecutionContext = {
      ...baseContext,
      input: { ...baseContext.input, workspaceId: undefined },
    };
    const call: ToolCall = { name: 'test_tool', arguments: {} };
    const result = evaluateToolSafety(spec, call, ctx);
    expect(result.allowed).toBe(true);
  });
});

// ─── Approval Policy ─────────────────────────────────────────────────

describe('domain-ai: approval policy', () => {
  const now = new Date('2026-02-21T12:00:00Z');

  const highRiskSpec: ToolSpec = {
    name: 'cancel_shipment',
    description: 'Cancella spedizione',
    properties: {},
    required: [],
    domains: ['support'],
    riskLevel: 'high',
    requiresApproval: true,
    policy: { category: 'write', tenancy: 'workspace_required', requiresApproval: true },
  };

  const lowRiskSpec: ToolSpec = {
    name: 'track_shipment',
    description: 'Tracking',
    properties: {},
    required: [],
    domains: ['support'],
    riskLevel: 'low',
    requiresApproval: false,
    policy: { category: 'read', tenancy: 'workspace_required' },
  };

  it('richiede approvazione per tool high risk', () => {
    const call: ToolCall = { name: 'cancel_shipment', arguments: {} };
    const result = evaluateApprovalPolicy(highRiskSpec, call, 'cancella la spedizione', now);
    expect(result.required).toBe(true);
    expect(result.approved).toBe(false);
    expect(result.payload).toBeDefined();
    expect(result.payload?.riskLevel).toBe('high');
  });

  it('approva automaticamente con conferma esplicita', () => {
    const call: ToolCall = { name: 'cancel_shipment', arguments: {} };
    const result = evaluateApprovalPolicy(highRiskSpec, call, 'confermo la cancellazione', now);
    expect(result.required).toBe(true);
    expect(result.approved).toBe(true);
  });

  it('non richiede approvazione per tool low risk', () => {
    const call: ToolCall = { name: 'track_shipment', arguments: {} };
    const result = evaluateApprovalPolicy(lowRiskSpec, call, 'traccia il pacco', now);
    expect(result.required).toBe(false);
    expect(result.approved).toBe(true);
  });

  it('payload scade dopo 5 minuti', () => {
    const call: ToolCall = { name: 'cancel_shipment', arguments: {} };
    const result = evaluateApprovalPolicy(highRiskSpec, call, 'cancella', now);
    expect(result.payload).toBeDefined();
    const expires = new Date(result.payload!.expiresAt);
    expect(expires.getTime() - now.getTime()).toBe(5 * 60 * 1000);
  });

  it.each([
    'conferma',
    'confermo',
    'procedi',
    'vai',
    'ok',
    'si',
    'yes',
    'autorizzo',
    'Confermo la cancellazione',
    'OK procedi pure',
    'SI, vai avanti',
  ])('approva con parola di conferma: "%s"', (msg) => {
    const call: ToolCall = { name: 'cancel_shipment', arguments: {} };
    const result = evaluateApprovalPolicy(highRiskSpec, call, msg, now);
    expect(result.approved).toBe(true);
  });

  it.each([
    'non voglio',
    'annulla',
    'stop',
    'fammi pensare',
    '',
    'non ok con questo prezzo',
    'impossibile procedere',
    'posizione del pacco',
    'questo non va bene si potrebbe fare meglio',
  ])('NON approva con messaggio: "%s"', (msg) => {
    const call: ToolCall = { name: 'cancel_shipment', arguments: {} };
    const result = evaluateApprovalPolicy(highRiskSpec, call, msg, now);
    expect(result.approved).toBe(false);
  });
});

// ─── Model Resolver ──────────────────────────────────────────────────

describe('domain-ai: model resolver', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('roleToEnvSuffix converte correttamente', () => {
    expect(roleToEnvSuffix('request_manager')).toBe('REQUEST_MANAGER');
    expect(roleToEnvSuffix('finalizer')).toBe('FINALIZER');
    expect(roleToEnvSuffix('tool_analysis')).toBe('TOOL_ANALYSIS');
  });

  it('domainToEnvSuffix converte correttamente', () => {
    expect(domainToEnvSuffix('quote')).toBe('QUOTE');
    expect(domainToEnvSuffix('shipment')).toBe('SHIPMENT');
  });

  it('resolveRoleModel usa OLLAMA_MODEL come fallback', () => {
    process.env.OLLAMA_MODEL = 'llama3.1';
    delete process.env.OLLAMA_MODEL_FINALIZER;
    const model = resolveRoleModel('finalizer');
    expect(model).toBe('llama3.1');
  });

  it('resolveRoleModel usa var specifica per ruolo', () => {
    process.env.OLLAMA_MODEL = 'llama3.1';
    process.env.OLLAMA_MODEL_FINALIZER = 'mistral-large';
    const model = resolveRoleModel('finalizer');
    expect(model).toBe('mistral-large');
  });

  it('resolveDomainRoleModel usa var domain+role specifica', () => {
    process.env.OLLAMA_MODEL = 'llama3.1';
    process.env.OLLAMA_MODEL_QUOTE_FINALIZER = 'gemma2';
    const model = resolveDomainRoleModel('quote', 'finalizer');
    expect(model).toBe('gemma2');
  });
});
