import type {
  AnneOrchestratorInput,
  RequestClassification,
  StageTraceEntry,
} from '../../types/orchestrator';
import type { OrchestratorDependencies } from '../../types/dependencies';
import type { ToolSpec } from '../../types/tools';
import {
  parseCommandBuilderContract,
  type CommandBuilderContract,
  type ToolCallerContract,
} from '../contracts';
import { getSystemPrompt } from '../../prompts';
import { runModelStage } from './shared';

export async function runCommandBuilderStage(
  input: AnneOrchestratorInput,
  classification: RequestClassification,
  caller: ToolCallerContract,
  toolSpec: ToolSpec,
  deps: OrchestratorDependencies,
  pipelineId: string,
  maxAttempts: number
): Promise<{ command: CommandBuilderContract; traces: StageTraceEntry[] }> {
  const result = await runModelStage<CommandBuilderContract>({
    stage: 'command_builder',
    role: 'command_builder',
    domain: classification.domain,
    deps,
    pipelineId,
    traceId: input.traceId,
    maxAttempts,
    buildMessages: (attempt, lastError) => [
      {
        role: 'system',
        content: getSystemPrompt('command_builder', classification.domain),
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
              properties: toolSpec.properties,
            },
            caller,
          },
          null,
          2
        ),
      },
    ],
    parse: parseCommandBuilderContract,
  });

  return {
    command: result.output,
    traces: result.traces,
  };
}
