import type { AnneOrchestratorInput, RequestClassification, StageTraceEntry } from '../../types/orchestrator';
import type { ToolPlanStep } from '../../types/planning';
import type { OrchestratorDependencies } from '../../types/dependencies';
import type { ToolSpec } from '../../types/tools';
import {
  ContractValidationError,
  parseToolAnalysisContract,
  type ToolAnalysisContract,
} from '../contracts';
import { getSystemPrompt } from '../../prompts';
import { runModelStage } from './shared';

export async function runToolAnalysisStage(
  input: AnneOrchestratorInput,
  classification: RequestClassification,
  step: ToolPlanStep,
  catalog: ToolSpec[],
  deps: OrchestratorDependencies,
  pipelineId: string,
  maxAttempts: number
): Promise<{ analysis: ToolAnalysisContract; traces: StageTraceEntry[] }> {
  const buildAttemptInstruction = (attempt: number): string => {
    if (attempt <= 1) {
      return [
        'Seleziona il tool migliore tra step.toolCandidates.',
        'recommendedTool deve essere esattamente uno dei candidati.',
        'Se mancano dati obbligatori per il tool scelto, imposta requiresClarification=true e compila missingData + clarificationQuestion.',
      ].join(' ');
    }

    return [
      'STRICT RETRY MODE.',
      'L output precedente non era valido.',
      'Regole obbligatorie:',
      '1) recommendedTool MUST be one of step.toolCandidates (exact string).',
      '2) Nessun tool fuori lista.',
      '3) Se ci sono dati mancanti, requiresClarification MUST be true.',
      '4) Output solo JSON conforme al contratto.',
    ].join(' ');
  };

  const result = await runModelStage<ToolAnalysisContract>({
    stage: 'tool_analysis',
    role: 'tool_analysis',
    domain: classification.domain,
    deps,
    pipelineId,
    traceId: input.traceId,
    maxAttempts,
    buildMessages: (attempt, lastError) => [
      {
        role: 'system',
        content: getSystemPrompt('tool_analysis', classification.domain),
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            instruction: buildAttemptInstruction(attempt),
            attempt,
            ...(lastError ? { previousError: lastError } : {}),
            step,
            message: input.message,
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
    parse: (raw) => {
      const parsed = parseToolAnalysisContract(raw);

      if (!step.toolCandidates.includes(parsed.recommendedTool)) {
        throw new ContractValidationError(
          `recommendedTool must be one of step.toolCandidates: ${step.toolCandidates.join(', ')}`
        );
      }

      if (parsed.missingData.length > 0 && !parsed.requiresClarification) {
        throw new ContractValidationError(
          'requiresClarification must be true when missingData is not empty'
        );
      }

      if (parsed.requiresClarification && !parsed.clarificationQuestion?.trim()) {
        throw new ContractValidationError(
          'clarificationQuestion is required when requiresClarification=true'
        );
      }

      return parsed;
    },
  });

  return {
    analysis: result.output,
    traces: result.traces,
  };
}
