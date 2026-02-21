import type {
  AnneOrchestratorInput,
  RequestClassification,
  StageTraceEntry,
  AnneDomain,
} from './orchestrator';
import type { ToolSpec, ToolCall, ToolExecutionResult } from './tools';
import type { ModelRole } from '../models/resolver';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  domain?: AnneDomain;
  pipelineId?: string;
  traceId?: string;
}

export interface LlmChatResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface AnneRoleLlm {
  chat(role: ModelRole, messages: LlmMessage[], options?: LlmOptions): Promise<LlmChatResponse>;
}

export interface ToolExecutionContext {
  input: AnneOrchestratorInput;
  classification: RequestClassification;
  pipelineId: string;
  taskId?: string;
  stepId?: string;
  stageTrace: StageTraceEntry[];
}

export interface AnneToolExecutor {
  catalog: ToolSpec[];
  execute(call: ToolCall, context: ToolExecutionContext): Promise<ToolExecutionResult>;
}

export interface OrchestratorLogger {
  log(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export interface OrchestratorDependencies {
  llm: AnneRoleLlm;
  tools: AnneToolExecutor;
  logger?: OrchestratorLogger;
  now?: () => Date;
  maxStageAttempts?: number;
}
