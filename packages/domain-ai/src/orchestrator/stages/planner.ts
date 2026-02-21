import type {
  AnneOrchestratorInput,
  RequestClassification,
  StageTraceEntry,
} from '../../types/orchestrator';
import type { DomainTask, ToolPlanStep } from '../../types/planning';
import type { OrchestratorDependencies } from '../../types/dependencies';
import type { ToolSpec } from '../../types/tools';
import { parsePlannerContract } from '../contracts';
import { getSystemPrompt } from '../../prompts';
import { runModelStage } from './shared';

export async function runPlannerStage(
  input: AnneOrchestratorInput,
  classification: RequestClassification,
  task: DomainTask,
  catalog: ToolSpec[],
  deps: OrchestratorDependencies,
  pipelineId: string,
  maxAttempts: number
): Promise<{ steps: ToolPlanStep[]; traces: StageTraceEntry[] }> {
  const result = await runModelStage<{ steps: ToolPlanStep[] }>({
    stage: 'planner',
    role: 'planner',
    domain: classification.domain,
    deps,
    pipelineId,
    traceId: input.traceId,
    maxAttempts,
    buildMessages: (attempt, lastError) => [
      {
        role: 'system',
        content: getSystemPrompt('planner', classification.domain),
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            attempt,
            ...(lastError ? { previousError: lastError } : {}),
            task,
            tools: catalog.map((tool) => ({
              name: tool.name,
              description: tool.description,
              required: tool.required,
              riskLevel: tool.riskLevel,
              category: tool.policy?.category,
            })),
          },
          null,
          2
        ),
      },
    ],
    parse: (raw) => parsePlannerContract(raw, task.id),
  });

  return {
    steps: result.output.steps,
    traces: result.traces,
  };
}
