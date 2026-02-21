import type { AnneOrchestratorInput } from '@ss/domain-ai';
import type { ActingContext } from '@/lib/safe-auth';
import { runAnneV2 } from './run-v2';
import { getAnneOrchestratorMode, shouldUseV2, type AnneOrchestratorMode } from './rollout';

export interface RunAnneFlowInput {
  message: string;
  userId: string;
  userEmail: string;
  userRole: 'admin' | 'user' | 'reseller';
  traceId: string;
  actingContext?: ActingContext & { workspace?: { id?: string } };
  existingSessionState?: Record<string, unknown>;
}

export interface RunAnneFlowOutput {
  mode: AnneOrchestratorMode;
  flowId: string;
  message: string;
  clarificationRequest?: string;
  pricingOptions?: unknown[];
  sessionState?: Record<string, unknown>;
  agentState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

async function runV2(
  input: RunAnneFlowInput,
  mode: AnneOrchestratorMode
): Promise<RunAnneFlowOutput> {
  const orchestratorInput: AnneOrchestratorInput = {
    message: input.message,
    userId: input.userId,
    userEmail: input.userEmail,
    userRole: input.userRole,
    workspaceId: input.actingContext?.workspace?.id,
    traceId: input.traceId,
    actingContext: input.actingContext,
    sessionState: input.existingSessionState,
  };
  const output = await runAnneV2(orchestratorInput);
  return {
    mode,
    flowId: output.metadata.flowId,
    message: output.message,
    clarificationRequest: output.clarificationRequest,
    pricingOptions: output.pricingOptions,
    sessionState: output.sessionState,
    agentState: output.agentState,
    metadata: {
      intentId: output.metadata.intentId,
      channel: output.metadata.channel,
      domain: output.metadata.domain,
      riskLevel: output.metadata.riskLevel,
      approvalRequired: output.metadata.approvalRequired,
      toolPlanId: output.metadata.toolPlanId,
      pipelineId: output.metadata.pipelineId,
      stageTrace: output.metadata.stageTrace,
      approvalPayload: output.metadata.approvalPayload,
    },
  };
}

function buildRunnerFailure(mode: AnneOrchestratorMode, error: unknown): RunAnneFlowOutput {
  return {
    mode,
    flowId: 'orch.system.error',
    message: "Si e verificato un errore durante l'orchestrazione. Riprova tra poco.",
    metadata: {
      orchestratorError: true,
      error: error instanceof Error ? error.message : 'unknown',
      fallback: false,
    },
  };
}

export async function runAnneFlowByMode(input: RunAnneFlowInput): Promise<RunAnneFlowOutput> {
  const mode = getAnneOrchestratorMode();
  const workspaceId = input.actingContext?.workspace?.id;
  const canUseV2 = shouldUseV2(mode, { userId: input.userId, workspaceId });

  // Shadow mode: fire-and-forget V2 in background, restituisce errore generico
  // perche non c'e fallback V1. Utile solo per raccogliere telemetria.
  if (mode === 'shadow') {
    void runV2(input, 'shadow')
      .then((shadowResult) => {
        console.log(
          JSON.stringify({
            event: 'anne_shadow_ok',
            traceId: input.traceId,
            flowId: shadowResult.flowId,
          })
        );
      })
      .catch((error) => {
        console.warn(
          JSON.stringify({
            event: 'anne_shadow_error',
            traceId: input.traceId,
            error: error instanceof Error ? error.message : 'unknown',
          })
        );
      });
    return {
      mode: 'shadow',
      flowId: 'shadow.pending',
      message: 'Richiesta ricevuta. Elaborazione in corso.',
      metadata: { shadow: true },
    };
  }

  // Canary mode: solo utenti abilitati usano V2, gli altri ricevono errore generico
  if (mode === 'canary') {
    if (!canUseV2) {
      return {
        mode: 'canary',
        flowId: 'canary.not_eligible',
        message: "Funzionalita' in fase di rilascio graduale. Riprova piu' tardi.",
        metadata: { canary: false, eligible: false },
      };
    }

    try {
      return await runV2(input, 'canary');
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'anne_canary_error',
          traceId: input.traceId,
          error: error instanceof Error ? error.message : 'unknown',
        })
      );
      return buildRunnerFailure('canary', error);
    }
  }

  try {
    return await runV2(input, 'v2');
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'anne_v2_error',
        traceId: input.traceId,
        error: error instanceof Error ? error.message : 'unknown',
      })
    );
    return buildRunnerFailure('v2', error);
  }
}
