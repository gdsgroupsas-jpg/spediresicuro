import type {
  AnneOrchestratorInput,
  RequestClassification,
  StageTraceEntry,
} from '../../types/orchestrator';
import type { DomainTask } from '../../types/planning';
import type { OrchestratorDependencies } from '../../types/dependencies';
import { parseTaskPlannerContract, ContractValidationError } from '../contracts';
import { getSystemPrompt } from '../../prompts';
import { runModelStage } from './shared';

export async function runTaskPlannerStage(
  input: AnneOrchestratorInput,
  classification: RequestClassification,
  tasks: DomainTask[],
  deps: OrchestratorDependencies,
  pipelineId: string,
  maxAttempts: number
): Promise<{ tasks: DomainTask[]; traces: StageTraceEntry[] }> {
  const result = await runModelStage<{ tasks: DomainTask[] }>({
    stage: 'task_planner',
    role: 'task_planner',
    domain: classification.domain,
    deps,
    pipelineId,
    traceId: input.traceId,
    maxAttempts,
    buildMessages: (attempt, lastError) => [
      {
        role: 'system',
        content: getSystemPrompt('task_planner', classification.domain),
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            attempt,
            ...(lastError ? { previousError: lastError } : {}),
            message: input.message,
            classification,
            decomposedTasks: tasks,
          },
          null,
          2
        ),
      },
    ],
    parse: (raw) => {
      const parsed = parseTaskPlannerContract(raw);
      for (const task of parsed.tasks) {
        if (task.domain !== classification.domain) {
          throw new ContractValidationError('Task domain must match classification domain');
        }
      }
      return parsed;
    },
  });

  return {
    tasks: result.output.tasks,
    traces: result.traces,
  };
}
