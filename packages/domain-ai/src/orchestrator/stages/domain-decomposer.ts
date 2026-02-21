import type { AnneOrchestratorInput, RequestClassification, StageTraceEntry } from '../../types/orchestrator';
import type { DomainTask } from '../../types/planning';
import type { OrchestratorDependencies } from '../../types/dependencies';
import { parseDomainDecomposerContract } from '../contracts';
import { getSystemPrompt } from '../../prompts';
import { runModelStage } from './shared';

export async function runDomainDecomposerStage(
  input: AnneOrchestratorInput,
  classification: RequestClassification,
  deps: OrchestratorDependencies,
  pipelineId: string,
  maxAttempts: number
): Promise<{ tasks: DomainTask[]; traces: StageTraceEntry[] }> {
  const result = await runModelStage<{ subtasks: DomainTask[] }>({
    stage: 'domain_decomposer',
    role: 'domain_decomposer',
    domain: classification.domain,
    deps,
    pipelineId,
    traceId: input.traceId,
    maxAttempts,
    buildMessages: (attempt, lastError) => [
      {
        role: 'system',
        content: getSystemPrompt('domain_decomposer', classification.domain),
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            attempt,
            ...(lastError ? { previousError: lastError } : {}),
            input: {
              message: input.message,
              intentId: classification.intentId,
              domain: classification.domain,
            },
          },
          null,
          2
        ),
      },
    ],
    parse: (raw) => parseDomainDecomposerContract(raw, classification.domain, classification.intentId),
  });

  return {
    tasks: result.output.subtasks,
    traces: result.traces,
  };
}
