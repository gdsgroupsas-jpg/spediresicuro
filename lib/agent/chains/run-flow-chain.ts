/**
 * Catena lineare per flowId: Supervisor → un flusso → worker(s) → validazione → orchestratore/tool.
 * Per macro (support, crm, outreach, ...) si risolve il specificFlowId e si esegue la catena dedicata.
 * Dati e contesto account reale (actingContext, workspaceId) passano a tutti i worker.
 */

import type { FlowId } from '@/lib/agent/supervisor';
import type { FlowContext, FlowResult } from '@/lib/agent/flows/types';
import { runRichiestaPreventivoFlow } from '@/lib/agent/flows/richiesta-preventivo';
import { runShipmentCreationChain } from '@/lib/agent/workers/shipment-creation-v2';
import type { AgentState } from '@/lib/agent/orchestrator/state';
import { isAdminOrAbove } from '@/lib/auth-helpers';
import type { ActingContext } from '@/lib/safe-auth';
import { defaultLogger } from '@/lib/agent/logger';
import { supportWorker } from '@/lib/agent/workers/support-worker';
import { crmWorker } from '@/lib/agent/workers/crm-worker';
import { outreachWorker } from '@/lib/agent/workers/outreach-worker';
import { priceListManagerWorker } from '@/lib/agent/workers/price-list-manager';
import { mentorWorker } from '@/lib/agent/workers/mentor';
import { debugWorker } from '@/lib/agent/workers/debug';
import { explainWorker } from '@/lib/agent/workers/explain';
import { HumanMessage } from '@langchain/core/messages';
import { chatWithOllama } from '@/lib/ai/ollama';
import {
  getSpecificFlowIdsForMacro,
  isMacroWithSpecifics,
  isSpecificFlowId,
  type SpecificFlowId,
} from '@/lib/agent/specific-flows';

export interface RunFlowChainInput extends FlowContext {
  traceId?: string;
  actingContext?: ActingContext & { workspace?: { id: string } };
  existingSessionState?: Record<string, unknown>;
}

function userRoleFromInput(input: RunFlowChainInput): 'admin' | 'user' | 'reseller' {
  return (
    input.userRole ??
    (input.actingContext && isAdminOrAbove(input.actingContext.target) ? 'admin' : 'user')
  );
}

function workspaceIdFromInput(input: RunFlowChainInput): string | undefined {
  return input.actingContext?.workspace?.id;
}

async function runSupportChain(input: RunFlowChainInput): Promise<FlowResult> {
  const r = await supportWorker(
    {
      message: input.message,
      userId: input.userId,
      userRole: userRoleFromInput(input),
      workspaceId: workspaceIdFromInput(input),
    },
    defaultLogger
  );
  return { message: r.response, agentState: { support_response: r } as Record<string, unknown> };
}

async function runCrmChain(input: RunFlowChainInput): Promise<FlowResult> {
  const r = await crmWorker(
    {
      message: input.message,
      userId: input.userId,
      userRole: userRoleFromInput(input),
      workspaceId: workspaceIdFromInput(input),
    },
    defaultLogger
  );
  return { message: r.response, agentState: { crm_response: r } as Record<string, unknown> };
}

async function runOutreachChain(input: RunFlowChainInput): Promise<FlowResult> {
  const r = await outreachWorker(
    {
      message: input.message,
      userId: input.userId,
      userRole: userRoleFromInput(input),
      workspaceId: workspaceIdFromInput(input),
    },
    defaultLogger
  );
  return { message: r.response, agentState: { outreach_response: r } as Record<string, unknown> };
}

async function runListiniChain(input: RunFlowChainInput): Promise<FlowResult> {
  const userRole = userRoleFromInput(input);
  const state: Partial<AgentState> = {
    messages: [new HumanMessage(input.message)],
    userId: input.userId,
    userEmail: input.userEmail ?? '',
    shipmentData: {},
    processingStatus: 'idle',
    validationErrors: [],
    confidenceScore: 0,
    needsHumanReview: false,
    agent_context: input.actingContext
      ? {
          session_id: input.traceId ?? '',
          conversation_history: [new HumanMessage(input.message)],
          user_role: userRole,
          is_impersonating: input.actingContext.isImpersonating,
          acting_context: input.actingContext,
        }
      : undefined,
  };
  const out = await priceListManagerWorker(state as AgentState, defaultLogger);
  return { message: out.clarification_request ?? 'Operazione listini completata.' };
}

async function runMentorChain(input: RunFlowChainInput): Promise<FlowResult> {
  const userRole = userRoleFromInput(input);
  const state: Partial<AgentState> = {
    messages: [new HumanMessage(input.message)],
    userId: input.userId,
    userEmail: input.userEmail ?? '',
    shipmentData: {},
    processingStatus: 'idle',
    validationErrors: [],
    confidenceScore: 0,
    needsHumanReview: false,
    agent_context: input.actingContext
      ? {
          session_id: input.traceId ?? '',
          conversation_history: [new HumanMessage(input.message)],
          user_role: userRole,
          is_impersonating: input.actingContext.isImpersonating,
          acting_context: input.actingContext,
        }
      : undefined,
  };
  const out = await mentorWorker(state as AgentState, defaultLogger);
  const msg = out.mentor_response?.answer ?? out.clarification_request ?? 'Risposta mentor.';
  return { message: msg };
}

async function runDebugChain(input: RunFlowChainInput): Promise<FlowResult> {
  const userRole = userRoleFromInput(input);
  const state: Partial<AgentState> = {
    messages: [new HumanMessage(input.message)],
    userId: input.userId,
    userEmail: input.userEmail ?? '',
    shipmentData: {},
    processingStatus: 'idle',
    validationErrors: [],
    confidenceScore: 0,
    needsHumanReview: false,
    agent_context: input.actingContext
      ? {
          session_id: input.traceId ?? '',
          conversation_history: [new HumanMessage(input.message)],
          user_role: userRole,
          is_impersonating: input.actingContext.isImpersonating,
          acting_context: input.actingContext,
        }
      : undefined,
  };
  const out = await debugWorker(state as AgentState, defaultLogger);
  const msg = out.debug_response?.analysis ?? out.clarification_request ?? 'Analisi debug.';
  return { message: msg };
}

async function runExplainChain(input: RunFlowChainInput): Promise<FlowResult> {
  const userRole = userRoleFromInput(input);
  const state: Partial<AgentState> = {
    messages: [new HumanMessage(input.message)],
    userId: input.userId,
    userEmail: input.userEmail ?? '',
    shipmentData: {},
    processingStatus: 'idle',
    validationErrors: [],
    confidenceScore: 0,
    needsHumanReview: false,
    agent_context: input.actingContext
      ? {
          session_id: input.traceId ?? '',
          conversation_history: [new HumanMessage(input.message)],
          user_role: userRole,
          is_impersonating: input.actingContext.isImpersonating,
          acting_context: input.actingContext,
        }
      : undefined,
  };
  const out = await explainWorker(state as AgentState, defaultLogger);
  const msg = out.explain_response?.explanation ?? out.clarification_request ?? 'Spiegazione.';
  return { message: msg };
}

// ─── Risoluzione specificFlowId via Ollama ─────────────────────────

function buildPromptForMacro(macro: FlowId): string {
  const specifics = getSpecificFlowIdsForMacro(macro);
  if (specifics.length === 0) return '';
  return `Sei un classificatore. Assegna il messaggio dell'utente a una sola azione specifica della categoria "${macro}".

Azioni ammesse (rispondi SOLO con la parola chiave, nulla altro):
${specifics.map((s) => `- ${s}`).join('\n')}

Rispondi con una sola parola: l'azione scelta (es. ${specifics[0]}). Nessun altro testo.`;
}

function parseSpecificFromResponse(content: string, macro: FlowId): SpecificFlowId {
  const raw = content.trim().toLowerCase().replace(/[\s.]/g, '');
  const candidates = getSpecificFlowIdsForMacro(macro);
  if (candidates.length === 0) return macro as unknown as SpecificFlowId;
  for (const c of candidates) {
    if (raw === c.replace(/_/g, '')) return c;
    if (raw === c) return c;
    if (raw.includes(c.replace(/_/g, ''))) return c;
  }
  const match = content.match(
    new RegExp(`\\b(${candidates.join('|').replace(/_/g, '_')})\\b`, 'i')
  );
  if (match && isSpecificFlowId(match[1])) return match[1];
  return candidates[0];
}

async function resolveSpecificFlowId(macro: FlowId, message: string): Promise<SpecificFlowId> {
  const prompt = buildPromptForMacro(macro);
  if (!prompt) return macro as unknown as SpecificFlowId;

  try {
    const response = await chatWithOllama({
      messages: [{ role: 'user', content: message }],
      system: prompt,
      temperature: 0,
      maxTokens: 64,
    });
    return parseSpecificFromResponse(response.content || '', macro);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'unknown';
    defaultLogger.log(`[Chain] Errore risoluzione specifica (${macro}): ${errMsg}`);
    const candidates = getSpecificFlowIdsForMacro(macro);
    return candidates[0];
  }
}

/**
 * Esegue la catena per un'azione specifica (es. support_tracking, crm_lead, explain_margini).
 * Ogni azione ha un worker dedicato con contesto reale (workspaceId, actingContext, specificFlowId).
 */
async function runSpecificFlowChain(
  specificFlowId: SpecificFlowId,
  input: RunFlowChainInput
): Promise<FlowResult> {
  const macro = specificFlowId.split('_')[0] as FlowId;

  switch (macro) {
    case 'support':
      return runSupportChain(input);
    case 'crm':
      return runCrmChain(input);
    case 'outreach':
      return runOutreachChain(input);
    case 'listini':
      return runListiniChain(input);
    case 'mentor':
      return runMentorChain(input);
    case 'debug':
      return runDebugChain(input);
    case 'explain':
      return runExplainChain(input);
    default:
      return { message: 'Flusso specifico non riconosciuto. Riprova.' };
  }
}

/**
 * Esegue la catena lineare per il flowId indicato dal Supervisor.
 * Un solo livello di scelta (flowId); nessun Intermediary.
 */
export async function runFlowChain(flowId: FlowId, input: RunFlowChainInput): Promise<FlowResult> {
  try {
    const ctx: FlowContext = {
      message: input.message,
      userId: input.userId,
      userEmail: input.userEmail,
      userRole: input.userRole,
      sessionState: input.existingSessionState ?? input.sessionState,
    };

    switch (flowId) {
      case 'richiesta_preventivo':
        return await runRichiestaPreventivoFlow(ctx);

      case 'crea_spedizione': {
        const existingState: AgentState | null =
          (input.existingSessionState as unknown as AgentState | null) ?? null;
        const result = await runShipmentCreationChain(
          {
            message: input.message,
            existingState,
            userId: input.userId,
            userEmail: input.userEmail ?? '',
            traceId: input.traceId ?? '',
            workspaceId: workspaceIdFromInput(input),
          },
          defaultLogger
        );
        const bookingMsg =
          result.booking_result &&
          typeof result.booking_result === 'object' &&
          'user_message' in result.booking_result
            ? (result.booking_result as { user_message?: string }).user_message
            : undefined;
        const message = bookingMsg ?? result.clarification_request ?? 'Operazione completata.';
        return {
          message,
          clarificationRequest: result.clarification_request,
          sessionState: result.agentState
            ? {
                shipmentDraft: result.shipmentDraft,
                shipment_creation_phase: result.shipment_creation_phase,
              }
            : undefined,
          agentState: result.agentState as Record<string, unknown>,
        };
      }

      case 'support':
      case 'crm':
      case 'outreach':
      case 'listini':
      case 'mentor':
      case 'debug':
      case 'explain': {
        if (!isMacroWithSpecifics(flowId)) return { message: 'Flusso non riconosciuto. Riprova.' };
        const specificFlowId = await resolveSpecificFlowId(flowId, input.message);
        defaultLogger.log(`[Chain] Macro: ${flowId} -> specifico: ${specificFlowId}`);
        return await runSpecificFlowChain(specificFlowId, input);
      }

      default:
        return { message: 'Flusso non riconosciuto. Riprova.' };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Errore sconosciuto';
    defaultLogger.log(`[Chain] Errore in flowId=${flowId}: ${errorMsg}`);
    return {
      message: 'Si è verificato un errore temporaneo. Riprova tra qualche secondo.',
    };
  }
}
