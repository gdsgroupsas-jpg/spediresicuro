import { HumanMessage } from '@langchain/core/messages';
import type {
  AnneDomain,
  AnneToolExecutor,
  OrchestratorDependencies,
  RiskLevel,
  ToolExecutionContext,
  ToolExecutionPolicy,
  ToolExecutionResult,
  ToolProperty,
  ToolSpec,
  ToolCall,
  AnneOrchestratorInput,
} from '@ss/domain-ai';
import { buildDefaultToolCatalog } from '@ss/domain-ai';
import { ANNE_TOOLS, executeTool, type ToolDefinition } from '@/lib/ai/tools';
import { runRichiestaPreventivoFlow } from '@/lib/agent/flows/richiesta-preventivo';
import type { AgentState } from '@/lib/agent/orchestrator/state';
import { runShipmentCreationChain } from '@/lib/agent/workers/shipment-creation';
import { priceListManagerWorker } from '@/lib/agent/workers/price-list-manager';
import { mentorWorker } from '@/lib/agent/workers/mentor';
import { debugWorker } from '@/lib/agent/workers/debug';
import { explainWorker } from '@/lib/agent/workers/explain';
import { defaultLogger } from '@/lib/agent/logger';
import {
  cancelEnrollment,
  enrollEntity,
  getEnrollmentsByEntity,
  isAlreadyEnrolled,
  pauseEnrollment,
  resumeEnrollment,
} from '@/lib/outreach/enrollment-service';
import {
  getSequences,
  getTemplates,
  getChannelConfig,
  upsertChannelConfig,
} from '@/lib/outreach/outreach-data-service';
import { getOutreachMetrics } from '@/lib/outreach/outreach-analytics';
import { getEntityDetail } from '@/lib/crm/crm-data-service';
import type { OutreachChannel } from '@/types/outreach';

const WRITE_TOOLS = new Set<string>([
  'create_batch_shipments',
  'manage_hold',
  'cancel_shipment',
  'process_refund',
  'escalate_to_human',
  'update_crm_status',
  'add_crm_note',
  'record_crm_contact',
  'shipment_create_orchestrated',
  'outreach_toggle_channel',
  'outreach_enroll_entity',
  'outreach_cancel_enrollment',
  'outreach_pause_enrollment',
  'outreach_resume_enrollment',
]);

const HIGH_RISK_TOOLS = new Set<string>([
  'create_batch_shipments',
  'manage_hold',
  'cancel_shipment',
  'process_refund',
  'escalate_to_human',
  'update_crm_status',
  'record_crm_contact',
  'shipment_create_orchestrated',
  'outreach_toggle_channel',
  'outreach_enroll_entity',
  'outreach_cancel_enrollment',
  'outreach_pause_enrollment',
  'outreach_resume_enrollment',
]);

const CUSTOM_V3_TOOL_SPECS: ToolSpec[] = [
  {
    name: 'shipment_quote_orchestrated',
    description: 'Preventivo spedizione orchestrato con estrazione stato conversazionale.',
    properties: {},
    required: [],
    domains: ['quote'],
    riskLevel: 'low',
    requiresApproval: false,
    policy: { category: 'action', tenancy: 'workspace_required' },
  },
  {
    name: 'shipment_create_orchestrated',
    description: 'Creazione spedizione orchestrata end-to-end.',
    properties: {},
    required: [],
    domains: ['shipment'],
    riskLevel: 'high',
    requiresApproval: true,
    policy: { category: 'write', tenancy: 'workspace_required', requiresApproval: true },
  },
  {
    name: 'listini_orchestrated',
    description: 'Gestione listini con worker dedicato.',
    properties: {},
    required: [],
    domains: ['listini'],
    riskLevel: 'medium',
    requiresApproval: false,
    policy: { category: 'action', tenancy: 'workspace_required' },
  },
  {
    name: 'mentor_orchestrated',
    description: 'Risposta mentor tecnico-operativa.',
    properties: {},
    required: [],
    domains: ['mentor'],
    riskLevel: 'low',
    requiresApproval: false,
    policy: { category: 'read', tenancy: 'none' },
  },
  {
    name: 'debug_orchestrated',
    description: 'Diagnostica debug operativa.',
    properties: {},
    required: [],
    domains: ['debug'],
    riskLevel: 'low',
    requiresApproval: false,
    policy: { category: 'read', tenancy: 'none' },
  },
  {
    name: 'explain_orchestrated',
    description: 'Spiegazione business/processo.',
    properties: {},
    required: [],
    domains: ['explain'],
    riskLevel: 'low',
    requiresApproval: false,
    policy: { category: 'read', tenancy: 'none' },
  },
  {
    name: 'outreach_get_metrics',
    description: 'Recupera metriche aggregate outreach.',
    properties: {},
    required: [],
    domains: ['outreach'],
    riskLevel: 'low',
    requiresApproval: false,
    policy: { category: 'read', tenancy: 'workspace_required' },
  },
  {
    name: 'outreach_list_sequences',
    description: 'Lista sequenze outreach nel workspace.',
    properties: {},
    required: [],
    domains: ['outreach'],
    riskLevel: 'low',
    requiresApproval: false,
    policy: { category: 'read', tenancy: 'workspace_required' },
  },
  {
    name: 'outreach_list_templates',
    description: 'Lista template outreach (opzionale filtro canale).',
    properties: {
      channel: {
        type: 'string',
        enum: ['email', 'whatsapp', 'telegram'],
      },
    },
    required: [],
    domains: ['outreach'],
    riskLevel: 'low',
    requiresApproval: false,
    policy: { category: 'read', tenancy: 'workspace_required' },
  },
  {
    name: 'outreach_toggle_channel',
    description: 'Abilita/disabilita canale outreach per workspace.',
    properties: {
      channel: {
        type: 'string',
        enum: ['email', 'whatsapp', 'telegram'],
      },
      enabled: {
        type: 'boolean',
      },
    },
    required: ['channel', 'enabled'],
    domains: ['outreach'],
    riskLevel: 'high',
    requiresApproval: true,
    policy: { category: 'write', tenancy: 'workspace_required', requiresApproval: true },
  },
  {
    name: 'outreach_get_entity_status',
    description: 'Stato enrollment outreach di un lead/prospect.',
    properties: {
      entity_id: { type: 'string' },
      entity_name: { type: 'string' },
    },
    required: [],
    domains: ['outreach'],
    riskLevel: 'low',
    requiresApproval: false,
    policy: { category: 'read', tenancy: 'workspace_required' },
  },
  {
    name: 'outreach_enroll_entity',
    description: 'Iscrive un lead/prospect a una sequenza outreach.',
    properties: {
      sequence_id: { type: 'string' },
      entity_id: { type: 'string' },
      entity_name: { type: 'string' },
    },
    required: ['sequence_id'],
    domains: ['outreach'],
    riskLevel: 'high',
    requiresApproval: true,
    policy: { category: 'write', tenancy: 'workspace_required', requiresApproval: true },
  },
  {
    name: 'outreach_cancel_enrollment',
    description: 'Cancella enrollment outreach attivo.',
    properties: {
      enrollment_id: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['enrollment_id', 'reason'],
    domains: ['outreach'],
    riskLevel: 'high',
    requiresApproval: true,
    policy: { category: 'write', tenancy: 'workspace_required', requiresApproval: true },
  },
  {
    name: 'outreach_pause_enrollment',
    description: 'Mette in pausa enrollment outreach.',
    properties: {
      enrollment_id: { type: 'string' },
    },
    required: ['enrollment_id'],
    domains: ['outreach'],
    riskLevel: 'high',
    requiresApproval: true,
    policy: { category: 'write', tenancy: 'workspace_required', requiresApproval: true },
  },
  {
    name: 'outreach_resume_enrollment',
    description: 'Riprende enrollment outreach in pausa.',
    properties: {
      enrollment_id: { type: 'string' },
    },
    required: ['enrollment_id'],
    domains: ['outreach'],
    riskLevel: 'high',
    requiresApproval: true,
    policy: { category: 'write', tenancy: 'workspace_required', requiresApproval: true },
  },
];

function normalizePropertyType(value: unknown): ToolProperty['type'] {
  if (value === 'number' || value === 'boolean' || value === 'object' || value === 'array') {
    return value;
  }
  return 'string';
}

function inferDomainsFromLegacyTool(name: string): AnneDomain[] {
  if (name === 'fill_shipment_form') return ['shipment'];
  if (name === 'calculate_price') return ['quote', 'shipment', 'listini'];
  if (name === 'track_shipment') return ['support'];
  if (name === 'analyze_business_health') return ['debug', 'explain'];
  if (name === 'check_error_logs') return ['debug'];
  if (name === 'create_batch_shipments') return ['shipment'];
  if (
    [
      'get_price_list_details',
      'get_supplier_cost',
      'list_user_price_lists',
      'compare_supplier_vs_selling',
    ].includes(name)
  ) {
    return ['listini', 'quote'];
  }

  if (
    [
      'get_shipment_status',
      'manage_hold',
      'cancel_shipment',
      'process_refund',
      'force_refresh_tracking',
      'check_wallet_status',
      'diagnose_shipment_issue',
      'escalate_to_human',
    ].includes(name)
  ) {
    return ['support'];
  }

  if (
    [
      'get_pipeline_summary',
      'get_entity_details',
      'get_crm_health_alerts',
      'get_today_actions',
      'search_crm_entities',
      'update_crm_status',
      'add_crm_note',
      'record_crm_contact',
    ].includes(name)
  ) {
    return ['crm'];
  }

  return ['support'];
}

function inferPolicy(name: string): ToolExecutionPolicy {
  return {
    category: WRITE_TOOLS.has(name) ? 'write' : 'read',
    tenancy: 'workspace_required',
    ...(HIGH_RISK_TOOLS.has(name) ? { requiresApproval: true } : {}),
  };
}

function riskLevelFromName(name: string): RiskLevel {
  if (HIGH_RISK_TOOLS.has(name)) return 'high';
  return WRITE_TOOLS.has(name) ? 'medium' : 'low';
}

function convertLegacyToolDefinition(tool: ToolDefinition): ToolSpec {
  const properties: Record<string, ToolProperty> = {};
  for (const [key, value] of Object.entries(tool.parameters.properties || {})) {
    const raw = value as Record<string, unknown>;
    properties[key] = {
      type: normalizePropertyType(raw.type),
      description: typeof raw.description === 'string' ? raw.description : undefined,
      enum: Array.isArray(raw.enum)
        ? raw.enum.filter((item): item is string => typeof item === 'string')
        : undefined,
    };
  }

  const policy = inferPolicy(tool.name);
  const riskLevel = riskLevelFromName(tool.name);

  return {
    name: tool.name,
    description: tool.description,
    properties,
    required: Array.isArray(tool.parameters.required) ? tool.parameters.required : [],
    domains: inferDomainsFromLegacyTool(tool.name),
    riskLevel,
    requiresApproval: policy.requiresApproval === true,
    policy,
  };
}

function createBaseAgentState(input: AnneOrchestratorInput): AgentState {
  return {
    messages: [new HumanMessage(input.message)],
    userId: input.userId,
    userEmail: input.userEmail || '',
    shipmentData: {},
    processingStatus: 'idle',
    validationErrors: [],
    confidenceScore: 0,
    needsHumanReview: false,
    ...(input.sessionState || {}),
  } as AgentState;
}

function toExecutionResult(
  partial: Partial<AgentState>,
  fallbackMessage: string,
  extra?: Partial<ToolExecutionResult>
): ToolExecutionResult {
  const messageFromState =
    partial.clarification_request ||
    partial.userMessage ||
    partial.support_response?.message ||
    partial.crm_response?.message ||
    partial.outreach_response?.message ||
    partial.mentor_response?.answer ||
    partial.debug_response?.analysis ||
    partial.explain_response?.explanation;

  return {
    success: true,
    message: (messageFromState as string | undefined) || fallbackMessage,
    clarificationRequest: partial.clarification_request,
    pricingOptions: partial.pricing_options as unknown[] | undefined,
    agentState: partial as Record<string, unknown>,
    ...extra,
  };
}

function requireWorkspaceId(context: ToolExecutionContext): string | null {
  return context.input.workspaceId || null;
}

function isOutreachChannel(value: unknown): value is OutreachChannel {
  return value === 'email' || value === 'whatsapp' || value === 'telegram';
}

async function resolveCrmEntity(
  context: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<
  { entityId: string; entityType: 'lead' | 'prospect'; entityName?: string } | { error: string }
> {
  const workspaceId = requireWorkspaceId(context);
  if (!workspaceId) return { error: 'Workspace non disponibile per operazioni outreach.' };

  const entityType: 'lead' | 'prospect' = context.input.userRole === 'admin' ? 'lead' : 'prospect';

  const rawEntityId = typeof args.entity_id === 'string' ? args.entity_id.trim() : '';
  if (rawEntityId) {
    return { entityId: rawEntityId, entityType };
  }

  const entityName = typeof args.entity_name === 'string' ? args.entity_name.trim() : '';
  if (!entityName) {
    return { error: 'Specificare entity_id o entity_name.' };
  }

  const detail = await getEntityDetail(context.input.userRole, undefined, entityName, workspaceId);
  if (!detail) {
    return { error: `Entita non trovata: ${entityName}` };
  }

  return {
    entityId: detail.id,
    entityType,
    entityName,
  };
}

async function executeCustomCapabilityTool(
  call: ToolCall,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { input } = context;

  switch (call.name) {
    case 'shipment_quote_orchestrated': {
      const result = await runRichiestaPreventivoFlow({
        message: input.message,
        userId: input.userId,
        userEmail: input.userEmail,
        userRole: input.userRole,
        sessionState: input.sessionState,
      });

      return {
        success: true,
        message: result.message,
        clarificationRequest: result.clarificationRequest,
        pricingOptions: result.pricingOptions as unknown[] | undefined,
        sessionState: result.sessionState,
      };
    }

    case 'shipment_create_orchestrated': {
      const existingState = (input.sessionState as AgentState | undefined) || null;
      const result = await runShipmentCreationChain(
        {
          message: input.message,
          existingState,
          userId: input.userId,
          userEmail: input.userEmail || '',
          traceId: input.traceId || '',
        },
        defaultLogger
      );

      const bookingMessage =
        result.booking_result &&
        typeof result.booking_result === 'object' &&
        'user_message' in result.booking_result
          ? (result.booking_result as { user_message?: string }).user_message
          : undefined;

      const agentStateRecord = (result.agentState || undefined) as
        | Record<string, unknown>
        | undefined;

      const pricingOptions = Array.isArray(agentStateRecord?.pricing_options)
        ? (agentStateRecord?.pricing_options as unknown[])
        : [];

      return {
        success: true,
        message: bookingMessage || result.clarification_request || 'Operazione completata.',
        clarificationRequest: result.clarification_request,
        pricingOptions,
        sessionState: result.agentState
          ? {
              shipmentDraft: result.shipmentDraft,
              shipment_creation_phase: result.shipment_creation_phase,
            }
          : undefined,
        agentState: agentStateRecord,
      };
    }

    case 'listini_orchestrated': {
      const baseState = createBaseAgentState(input);
      const out = await priceListManagerWorker(baseState, defaultLogger);
      return toExecutionResult(out, 'Operazione listini completata.');
    }

    case 'mentor_orchestrated': {
      const baseState = createBaseAgentState(input);
      const out = await mentorWorker(baseState, defaultLogger);
      return toExecutionResult(out, 'Risposta mentor pronta.');
    }

    case 'debug_orchestrated': {
      const baseState = createBaseAgentState(input);
      const out = await debugWorker(baseState, defaultLogger);
      return toExecutionResult(out, 'Analisi debug completata.');
    }

    case 'explain_orchestrated': {
      const baseState = createBaseAgentState(input);
      const out = await explainWorker(baseState, defaultLogger);
      return toExecutionResult(out, 'Spiegazione disponibile.');
    }

    case 'outreach_get_metrics': {
      const workspaceId = requireWorkspaceId(context);
      if (!workspaceId) {
        return {
          success: false,
          error: 'Workspace non disponibile per metriche outreach.',
        };
      }
      const metrics = await getOutreachMetrics(workspaceId);
      return {
        success: true,
        message: 'Metriche outreach recuperate.',
        result: metrics,
      };
    }

    case 'outreach_list_sequences': {
      const workspaceId = requireWorkspaceId(context);
      if (!workspaceId) {
        return {
          success: false,
          error: 'Workspace non disponibile per sequenze outreach.',
        };
      }
      const sequences = await getSequences(workspaceId);
      return {
        success: true,
        message: `Sequenze disponibili: ${sequences.length}.`,
        result: sequences,
      };
    }

    case 'outreach_list_templates': {
      const workspaceId = requireWorkspaceId(context);
      if (!workspaceId) {
        return {
          success: false,
          error: 'Workspace non disponibile per template outreach.',
        };
      }

      const channel = call.arguments.channel;
      const templates = await getTemplates(workspaceId, {
        ...(isOutreachChannel(channel) ? { channel } : {}),
      });

      return {
        success: true,
        message: `Template disponibili: ${templates.length}.`,
        result: templates,
      };
    }

    case 'outreach_toggle_channel': {
      const workspaceId = requireWorkspaceId(context);
      if (!workspaceId) {
        return {
          success: false,
          error: 'Workspace non disponibile per configurazione canali outreach.',
        };
      }

      const channel = call.arguments.channel;
      if (!isOutreachChannel(channel)) {
        return {
          success: false,
          error: 'Canale outreach non valido.',
        };
      }

      if (typeof call.arguments.enabled !== 'boolean') {
        return {
          success: false,
          error: 'Campo enabled obbligatorio (boolean).',
        };
      }

      const write = await upsertChannelConfig({
        workspaceId,
        channel,
        enabled: call.arguments.enabled,
      });

      if (!write.success) {
        return {
          success: false,
          error: write.error || 'Errore aggiornamento canale outreach.',
        };
      }

      const current = await getChannelConfig(workspaceId);
      return {
        success: true,
        message: `Canale ${channel} aggiornato con successo.`,
        result: {
          updatedChannel: channel,
          enabled: call.arguments.enabled,
          config: current,
        },
      };
    }

    case 'outreach_get_entity_status': {
      const workspaceId = requireWorkspaceId(context);
      if (!workspaceId) {
        return {
          success: false,
          error: 'Workspace non disponibile per status outreach.',
        };
      }

      const resolved = await resolveCrmEntity(context, call.arguments);
      if ('error' in resolved) {
        return {
          success: false,
          error: resolved.error,
        };
      }

      const enrollments = await getEnrollmentsByEntity(
        resolved.entityType,
        resolved.entityId,
        workspaceId
      );

      return {
        success: true,
        message:
          enrollments.length > 0
            ? `Trovati ${enrollments.length} enrollment outreach.`
            : 'Nessun enrollment outreach attivo trovato.',
        result: {
          entityId: resolved.entityId,
          entityType: resolved.entityType,
          enrollments,
        },
      };
    }

    case 'outreach_enroll_entity': {
      const workspaceId = requireWorkspaceId(context);
      if (!workspaceId) {
        return {
          success: false,
          error: 'Workspace non disponibile per enrollment outreach.',
        };
      }

      const sequenceId =
        typeof call.arguments.sequence_id === 'string' ? call.arguments.sequence_id.trim() : '';
      if (!sequenceId) {
        return {
          success: false,
          error: 'sequence_id obbligatorio.',
        };
      }

      const resolved = await resolveCrmEntity(context, call.arguments);
      if ('error' in resolved) {
        return {
          success: false,
          error: resolved.error,
        };
      }

      const already = await isAlreadyEnrolled(sequenceId, resolved.entityType, resolved.entityId);
      if (already) {
        return {
          success: true,
          message: 'Entita gia iscritta alla sequenza richiesta.',
          result: {
            alreadyEnrolled: true,
            sequenceId,
            entityId: resolved.entityId,
          },
        };
      }

      const enrollment = await enrollEntity({
        sequenceId,
        entityType: resolved.entityType,
        entityId: resolved.entityId,
        workspaceId,
      });

      if (!enrollment.success) {
        return {
          success: false,
          error: enrollment.error || 'Errore enrollment outreach.',
        };
      }

      return {
        success: true,
        message: 'Enrollment outreach creato con successo.',
        result: {
          enrollmentId: enrollment.enrollmentId,
          sequenceId,
          entityId: resolved.entityId,
          entityType: resolved.entityType,
        },
      };
    }

    case 'outreach_cancel_enrollment': {
      const workspaceId = requireWorkspaceId(context);
      if (!workspaceId) {
        return {
          success: false,
          error: 'Workspace non disponibile per cancel outreach.',
        };
      }

      const enrollmentId =
        typeof call.arguments.enrollment_id === 'string' ? call.arguments.enrollment_id.trim() : '';
      const reason = typeof call.arguments.reason === 'string' ? call.arguments.reason.trim() : '';

      if (!enrollmentId || !reason) {
        return {
          success: false,
          error: 'enrollment_id e reason sono obbligatori.',
        };
      }

      const canceled = await cancelEnrollment(enrollmentId, workspaceId, reason);
      if (!canceled.success) {
        return {
          success: false,
          error: canceled.error || 'Errore cancellazione enrollment outreach.',
        };
      }

      return {
        success: true,
        message: 'Enrollment outreach cancellato.',
        result: { enrollmentId, reason },
      };
    }

    case 'outreach_pause_enrollment': {
      const workspaceId = requireWorkspaceId(context);
      if (!workspaceId) {
        return {
          success: false,
          error: 'Workspace non disponibile per pause outreach.',
        };
      }

      const enrollmentId =
        typeof call.arguments.enrollment_id === 'string' ? call.arguments.enrollment_id.trim() : '';

      if (!enrollmentId) {
        return {
          success: false,
          error: 'enrollment_id obbligatorio.',
        };
      }

      const paused = await pauseEnrollment(enrollmentId, workspaceId);
      if (!paused.success) {
        return {
          success: false,
          error: paused.error || 'Errore pausa enrollment outreach.',
        };
      }

      return {
        success: true,
        message: 'Enrollment outreach messo in pausa.',
        result: { enrollmentId },
      };
    }

    case 'outreach_resume_enrollment': {
      const workspaceId = requireWorkspaceId(context);
      if (!workspaceId) {
        return {
          success: false,
          error: 'Workspace non disponibile per resume outreach.',
        };
      }

      const enrollmentId =
        typeof call.arguments.enrollment_id === 'string' ? call.arguments.enrollment_id.trim() : '';

      if (!enrollmentId) {
        return {
          success: false,
          error: 'enrollment_id obbligatorio.',
        };
      }

      const resumed = await resumeEnrollment(enrollmentId, workspaceId);
      if (!resumed.success) {
        return {
          success: false,
          error: resumed.error || 'Errore resume enrollment outreach.',
        };
      }

      return {
        success: true,
        message: 'Enrollment outreach riattivato.',
        result: { enrollmentId },
      };
    }

    default:
      return {
        success: false,
        error: `Tool custom non gestito: ${call.name}`,
      };
  }
}

function toLegacyToolCall(call: ToolCall): { name: string; arguments: Record<string, unknown> } {
  return {
    name: call.name,
    arguments: call.arguments || {},
  };
}

async function executeLegacyBusinessTool(
  call: ToolCall,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const legacy = await executeTool(
    toLegacyToolCall(call),
    context.input.userId,
    context.input.userRole,
    context.input.workspaceId
  );

  if (!legacy.success) {
    return {
      success: false,
      error: legacy.error || 'Tool execution failed',
    };
  }

  let message: string | undefined;
  if (typeof legacy.result === 'string') {
    message = legacy.result;
  } else if (legacy.result && typeof legacy.result === 'object') {
    const resultObj = legacy.result as Record<string, unknown>;
    if (typeof resultObj.message === 'string') {
      message = resultObj.message;
    } else if (typeof resultObj.summary === 'string') {
      message = resultObj.summary;
    }
  }

  return {
    success: true,
    result: legacy.result,
    message: message || 'Operazione completata.',
  };
}

export function buildAnneV2ToolCatalog(): ToolSpec[] {
  const legacySpecs = ANNE_TOOLS.map(convertLegacyToolDefinition);
  return buildDefaultToolCatalog([...legacySpecs, ...CUSTOM_V3_TOOL_SPECS]);
}

export function buildAnneV2ToolExecutor(): AnneToolExecutor {
  const catalog = buildAnneV2ToolCatalog();
  const customToolNames = new Set(CUSTOM_V3_TOOL_SPECS.map((tool) => tool.name));

  return {
    catalog,
    async execute(call, context) {
      if (customToolNames.has(call.name)) {
        return executeCustomCapabilityTool(call, context);
      }
      return executeLegacyBusinessTool(call, context);
    },
  };
}

export function buildAnneV2Dependencies(
  llm: OrchestratorDependencies['llm'],
  logger?: OrchestratorDependencies['logger']
): OrchestratorDependencies {
  return {
    llm,
    tools: buildAnneV2ToolExecutor(),
    logger,
    maxStageAttempts: 2,
  };
}
