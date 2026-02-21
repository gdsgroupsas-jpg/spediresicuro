import type {
  AnneOrchestratorInput,
  RequestClassification,
  StageTraceEntry,
} from '../../types/orchestrator';
import type { ToolPlanStep } from '../../types/planning';
import type { OrchestratorDependencies } from '../../types/dependencies';
import type { ToolSpec } from '../../types/tools';
import {
  parseToolArgumentContract,
  type ToolAnalysisContract,
  type ToolArgumentContract,
} from '../contracts';
import { getSystemPrompt } from '../../prompts';
import { runModelStage } from './shared';

export async function runToolArgumentStage(
  input: AnneOrchestratorInput,
  classification: RequestClassification,
  step: ToolPlanStep,
  analysis: ToolAnalysisContract,
  toolSpec: ToolSpec,
  deps: OrchestratorDependencies,
  pipelineId: string,
  maxAttempts: number
): Promise<{ argument: ToolArgumentContract; traces: StageTraceEntry[] }> {
  const result = await runModelStage<ToolArgumentContract>({
    stage: 'tool_argument',
    role: 'tool_argument',
    domain: classification.domain,
    deps,
    pipelineId,
    traceId: input.traceId,
    maxAttempts,
    buildMessages: (attempt, lastError) => [
      {
        role: 'system',
        content: getSystemPrompt('tool_argument', classification.domain),
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            attempt,
            ...(lastError ? { previousError: lastError } : {}),
            message: input.message,
            step,
            analysis,
            tool: {
              name: toolSpec.name,
              required: toolSpec.required,
              properties: toolSpec.properties,
            },
          },
          null,
          2
        ),
      },
    ],
    parse: parseToolArgumentContract,
  });

  return {
    argument: result.output,
    traces: result.traces,
  };
}
