/**
 * Esegue il flusso indicato da flowId. Ogni flowId = una catena lineare (worker → validazione → tool).
 * Niente Intermediary: un solo livello di scelta (Supervisor).
 */

import type { FlowId } from '@/lib/agent/supervisor';
import { runFlowChain } from '@/lib/agent/chains';
import type { FlowContext, FlowResult } from './types';
import type { ActingContext } from '@/lib/safe-auth';

export interface RunFlowInput extends FlowContext {
  traceId?: string;
  actingContext?: ActingContext;
  existingSessionState?: Record<string, unknown>;
}

export async function runFlow(flowId: FlowId, input: RunFlowInput): Promise<FlowResult> {
  return runFlowChain(flowId, input);
}
