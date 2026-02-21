import type {
  AnneOrchestratorInput,
  RequestClassification,
  StageTraceEntry,
} from '../../types/orchestrator';
import type { OrchestratorDependencies } from '../../types/dependencies';
import type { ToolSpec } from '../../types/tools';
import {
  parseToolCallerContract,
  type ToolArgumentContract,
  type ToolCallerContract,
} from '../contracts';
import { getSystemPrompt } from '../../prompts';
import { runModelStage } from './shared';

export async function runToolCallerStage(
  input: AnneOrchestratorInput,
  classification: RequestClassification,
  argument: ToolArgumentContract,
  toolSpec: ToolSpec,
  deps: OrchestratorDependencies,
  pipelineId: string,
  maxAttempts: number
): Promise<{ caller: ToolCallerContract; traces: StageTraceEntry[] }> {
  const result = await runModelStage<ToolCallerContract>({
    stage: 'tool_caller',
    role: 'tool_caller',
    domain: classification.domain,
    deps,
    pipelineId,
    traceId: input.traceId,
    maxAttempts,
    buildMessages: (attempt, lastError) => [
      {
        role: 'system',
        content: getSystemPrompt('tool_caller', classification.domain),
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            attempt,
            ...(lastError ? { previousError: lastError } : {}),
            message: input.message,
            tool: {
              name: toolSpec.name,
              required: toolSpec.required,
            },
            argument,
          },
          null,
          2
        ),
      },
    ],
    parse: parseToolCallerContract,
  });

  return {
    caller: result.output,
    traces: result.traces,
  };
}
