/**
 * @deprecated Usare runFlowChain in lib/agent/chains. run-flow non passa più dall'Intermediary.
 * Esegue un flusso specifico (una singola azione). Ogni azione ha il proprio flowId.
 * Usato dall'Intermediary dopo la risoluzione macro -> specifico.
 */

import type { SpecificFlowId } from '@/lib/agent/specific-flows';
import type { FlowContext, FlowResult } from './types';
import { supportWorker } from '@/lib/agent/workers/support-worker';
import { crmWorker } from '@/lib/agent/workers/crm-worker';
import { outreachWorker } from '@/lib/agent/workers/outreach-worker';
import { priceListManagerWorker } from '@/lib/agent/workers/price-list-manager';
import { mentorWorker } from '@/lib/agent/workers/mentor';
import { debugWorker } from '@/lib/agent/workers/debug';
import { explainWorker } from '@/lib/agent/workers/explain';
import { HumanMessage } from '@langchain/core/messages';
import type { AgentState } from '@/lib/agent/orchestrator/state';
import { isAdminOrAbove } from '@/lib/auth-helpers';
import type { ActingContext } from '@/lib/safe-auth';
import { defaultLogger } from '@/lib/agent/logger';

export interface RunSpecificFlowInput extends FlowContext {
  traceId?: string;
  actingContext?: ActingContext;
  existingSessionState?: Record<string, unknown>;
}

function userRoleFromInput(input: RunSpecificFlowInput): 'admin' | 'user' {
  return (
    input.userRole ??
    (input.actingContext && isAdminOrAbove(input.actingContext.target) ? 'admin' : 'user')
  );
}

async function runSupportFlow(input: RunSpecificFlowInput): Promise<FlowResult> {
  const r = await supportWorker(
    { message: input.message, userId: input.userId, userRole: userRoleFromInput(input) },
    defaultLogger
  );
  return { message: r.response, agentState: { support_response: r } as Record<string, unknown> };
}

async function runCrmFlow(input: RunSpecificFlowInput): Promise<FlowResult> {
  const r = await crmWorker(
    { message: input.message, userId: input.userId, userRole: userRoleFromInput(input) },
    defaultLogger
  );
  return { message: r.response, agentState: { crm_response: r } as Record<string, unknown> };
}

async function runOutreachFlow(input: RunSpecificFlowInput): Promise<FlowResult> {
  const r = await outreachWorker(
    { message: input.message, userId: input.userId, userRole: userRoleFromInput(input) },
    defaultLogger
  );
  return { message: r.response, agentState: { outreach_response: r } as Record<string, unknown> };
}

async function runListiniFlow(input: RunSpecificFlowInput): Promise<FlowResult> {
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

async function runMentorFlow(input: RunSpecificFlowInput): Promise<FlowResult> {
  const state: Partial<AgentState> = {
    messages: [new HumanMessage(input.message)],
    userId: input.userId,
    userEmail: input.userEmail ?? '',
    shipmentData: {},
    processingStatus: 'idle',
    validationErrors: [],
    confidenceScore: 0,
    needsHumanReview: false,
  };
  const out = await mentorWorker(state as AgentState, defaultLogger);
  const msg = out.mentor_response?.answer ?? out.clarification_request ?? 'Risposta mentor.';
  return { message: msg };
}

async function runDebugFlow(input: RunSpecificFlowInput): Promise<FlowResult> {
  const state: Partial<AgentState> = {
    messages: [new HumanMessage(input.message)],
    userId: input.userId,
    userEmail: input.userEmail ?? '',
    shipmentData: {},
    processingStatus: 'idle',
    validationErrors: [],
    confidenceScore: 0,
    needsHumanReview: false,
  };
  const out = await debugWorker(state as AgentState, defaultLogger);
  const msg = out.debug_response?.analysis ?? out.clarification_request ?? 'Analisi debug.';
  return { message: msg };
}

async function runExplainFlow(input: RunSpecificFlowInput): Promise<FlowResult> {
  const state: Partial<AgentState> = {
    messages: [new HumanMessage(input.message)],
    userId: input.userId,
    userEmail: input.userEmail ?? '',
    shipmentData: {},
    processingStatus: 'idle',
    validationErrors: [],
    confidenceScore: 0,
    needsHumanReview: false,
  };
  const out = await explainWorker(state as AgentState, defaultLogger);
  const msg = out.explain_response?.explanation ?? out.clarification_request ?? 'Spiegazione.';
  return { message: msg };
}

/**
 * Esegue il flusso specifico corrispondente a specificFlowId.
 * Ogni azione ha un flusso dedicato; i worker sottostanti sono condivisi per macro.
 */
export async function runSpecificFlow(
  specificFlowId: SpecificFlowId,
  input: RunSpecificFlowInput
): Promise<FlowResult> {
  const macro = specificFlowId.split('_')[0] as
    | 'support'
    | 'crm'
    | 'outreach'
    | 'listini'
    | 'mentor'
    | 'debug'
    | 'explain';

  switch (macro) {
    case 'support':
      return runSupportFlow(input);
    case 'crm':
      return runCrmFlow(input);
    case 'outreach':
      return runOutreachFlow(input);
    case 'listini':
      return runListiniFlow(input);
    case 'mentor':
      return runMentorFlow(input);
    case 'debug':
      return runDebugFlow(input);
    case 'explain':
      return runExplainFlow(input);
    default:
      return { message: 'Flusso specifico non riconosciuto. Riprova.' };
  }
}
