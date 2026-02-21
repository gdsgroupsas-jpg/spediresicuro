import { resolveDomainRoleModel, type ModelRole } from '../../models/resolver';
import type { OrchestratorDependencies, LlmMessage } from '../../types/dependencies';
import type { AnneDomain, AnnePipelineStage, StageTraceEntry } from '../../types/orchestrator';
import { ContractValidationError } from '../contracts';

export const MODEL_TOKEN_ALERT_THRESHOLD = 16_000;

export type StageErrorCode =
  | 'invalid_json_contract'
  | 'model_unavailable'
  | 'stage_failed'
  | 'clarification_required';

export class StageExecutionError extends Error {
  readonly stage: AnnePipelineStage;
  readonly code: StageErrorCode;
  readonly attempts: number;

  constructor(stage: AnnePipelineStage, code: StageErrorCode, message: string, attempts: number) {
    super(message);
    this.name = 'StageExecutionError';
    this.stage = stage;
    this.code = code;
    this.attempts = attempts;
  }
}

interface RunModelStageInput<TOutput> {
  stage: AnnePipelineStage;
  role: ModelRole;
  domain?: AnneDomain;
  deps: OrchestratorDependencies;
  pipelineId: string;
  traceId?: string;
  maxAttempts: number;
  buildMessages: (attempt: number, lastError?: string) => LlmMessage[];
  parse: (raw: string) => TOutput;
}

interface RunModelStageOutput<TOutput> {
  output: TOutput;
  raw: string;
  traces: StageTraceEntry[];
}

function renderMessages(messages: LlmMessage[]): string {
  return messages
    .map((message, index) => `#${index + 1} ${message.role}\n${message.content}`)
    .join('\n\n');
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  // Approximation fallback when provider usage is unavailable.
  return Math.max(1, Math.ceil(text.length / 4));
}

function sanitizeTokenCount(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.round(value);
}

function classifyFailure(error: unknown): StageErrorCode {
  if (error instanceof ContractValidationError) return 'invalid_json_contract';

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (
    message.includes('ollama') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('econn') ||
    message.includes('network')
  ) {
    return 'model_unavailable';
  }

  return 'stage_failed';
}

export async function runModelStage<TOutput>(
  input: RunModelStageInput<TOutput>
): Promise<RunModelStageOutput<TOutput>> {
  const traces: StageTraceEntry[] = [];
  let lastErrorMessage = '';

  for (let attempt = 1; attempt <= input.maxAttempts; attempt++) {
    const started = Date.now();
    const model = resolveDomainRoleModel(input.domain, input.role);
    const messages = input.buildMessages(attempt, lastErrorMessage);
    const inputText = renderMessages(messages);
    const estimatedInputTokens = estimateTokens(inputText);
    let outputText = '';
    let inputTokens = estimatedInputTokens;
    let outputTokens = 0;
    let totalTokens = estimatedInputTokens;
    let tokenAlert = totalTokens > MODEL_TOKEN_ALERT_THRESHOLD;

    try {
      const response = await input.deps.llm.chat(
        input.role,
        messages,
        {
          model,
          domain: input.domain,
          pipelineId: input.pipelineId,
          traceId: input.traceId,
          temperature: 0,
          maxTokens: 900,
        }
      );

      outputText = response.content || '';
      const estimatedOutputTokens = estimateTokens(outputText);
      inputTokens = sanitizeTokenCount(response.usage?.inputTokens, estimatedInputTokens);
      outputTokens = sanitizeTokenCount(response.usage?.outputTokens, estimatedOutputTokens);
      totalTokens = sanitizeTokenCount(response.usage?.totalTokens, inputTokens + outputTokens);
      tokenAlert = totalTokens > MODEL_TOKEN_ALERT_THRESHOLD;

      if (tokenAlert) {
        input.deps.logger?.warn('anne_v3_token_alert', {
          pipelineId: input.pipelineId,
          traceId: input.traceId,
          stage: input.stage,
          role: input.role,
          attempt,
          model: response.model || model,
          inputTokens,
          outputTokens,
          totalTokens,
          threshold: MODEL_TOKEN_ALERT_THRESHOLD,
        });
      }

      const output = input.parse(outputText);
      traces.push({
        stage: input.stage,
        attempt,
        durationMs: Date.now() - started,
        success: true,
        model: response.model || model,
        inputTokens,
        outputTokens,
        totalTokens,
        tokenAlert,
        inputText,
        outputText,
      });

      return {
        output,
        raw: outputText,
        traces,
      };
    } catch (error) {
      const code = classifyFailure(error);
      lastErrorMessage = error instanceof Error ? error.message : 'unknown error';

      if (tokenAlert) {
        input.deps.logger?.warn('anne_v3_token_alert', {
          pipelineId: input.pipelineId,
          traceId: input.traceId,
          stage: input.stage,
          role: input.role,
          attempt,
          model,
          inputTokens,
          outputTokens,
          totalTokens,
          threshold: MODEL_TOKEN_ALERT_THRESHOLD,
          failed: true,
        });
      }

      traces.push({
        stage: input.stage,
        attempt,
        durationMs: Date.now() - started,
        success: false,
        errorCode: code,
        model,
        inputTokens,
        outputTokens,
        totalTokens,
        tokenAlert,
        inputText,
        outputText: outputText || lastErrorMessage,
      });

      if (attempt >= input.maxAttempts) {
        throw new StageExecutionError(input.stage, code, lastErrorMessage, attempt);
      }
    }
  }

  throw new StageExecutionError(input.stage, 'stage_failed', 'Unknown stage failure', input.maxAttempts);
}

export function pushPolicyTrace(
  traces: StageTraceEntry[],
  stage: AnnePipelineStage,
  success: boolean,
  startedAt: number,
  code?: StageErrorCode
): void {
  traces.push({
    stage,
    attempt: 1,
    durationMs: Date.now() - startedAt,
    success,
    ...(code ? { errorCode: code } : {}),
  });
}

export function normalizeIntentForFlowId(intentId: string): string {
  return intentId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
