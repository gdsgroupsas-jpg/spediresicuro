import type { AnneOrchestratorInput, RequestClassification, StageTraceEntry } from '../../types/orchestrator';
import type { OrchestratorDependencies } from '../../types/dependencies';
import type { OrchestratorStepResult } from '../../types/orchestrator';
import { parseAggregatorContract, type AggregatorContract } from '../contracts';
import { getSystemPrompt } from '../../prompts';
import { runModelStage } from './shared';

export interface AggregatorStageInput {
  toolPlanId: string;
  steps: OrchestratorStepResult[];
  approvalRequired: boolean;
  clarificationRequest?: string;
  pricingOptions?: unknown[];
  sessionState?: Record<string, unknown>;
  agentState?: Record<string, unknown>;
}

export async function runAggregatorStage(
  input: AnneOrchestratorInput,
  classification: RequestClassification,
  payload: AggregatorStageInput,
  deps: OrchestratorDependencies,
  pipelineId: string,
  maxAttempts: number
): Promise<{ aggregated: AggregatorContract; traces: StageTraceEntry[] }> {
  const result = await runModelStage<AggregatorContract>({
    stage: 'aggregator',
    role: 'aggregator',
    domain: classification.domain,
    deps,
    pipelineId,
    traceId: input.traceId,
    maxAttempts,
    buildMessages: (attempt, lastError) => [
      {
        role: 'system',
        content: getSystemPrompt('aggregator', classification.domain),
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            attempt,
            ...(lastError ? { previousError: lastError } : {}),
            message: input.message,
            classification,
            payload,
          },
          null,
          2
        ),
      },
    ],
    parse: parseAggregatorContract,
  });

  return {
    aggregated: result.output,
    traces: result.traces,
  };
}
