import type {
  AnneOrchestratorInput,
  RequestClassification,
  StageTraceEntry,
} from '../../types/orchestrator';
import type { OrchestratorDependencies } from '../../types/dependencies';
import {
  parseFinalizerContract,
  type AggregatorContract,
  type FinalizerContract,
} from '../contracts';
import { getSystemPrompt } from '../../prompts';
import { runModelStage } from './shared';

export async function runFinalizerStage(
  input: AnneOrchestratorInput,
  classification: RequestClassification,
  aggregated: AggregatorContract,
  deps: OrchestratorDependencies,
  pipelineId: string,
  maxAttempts: number
): Promise<{ final: FinalizerContract; traces: StageTraceEntry[] }> {
  const result = await runModelStage<FinalizerContract>({
    stage: 'finalizer',
    role: 'finalizer',
    domain: classification.domain,
    deps,
    pipelineId,
    traceId: input.traceId,
    maxAttempts,
    buildMessages: (attempt, lastError) => [
      {
        role: 'system',
        content: getSystemPrompt('finalizer', classification.domain),
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            attempt,
            ...(lastError ? { previousError: lastError } : {}),
            message: input.message,
            classification,
            aggregated,
          },
          null,
          2
        ),
      },
    ],
    parse: parseFinalizerContract,
  });

  return {
    final: result.output,
    traces: result.traces,
  };
}
