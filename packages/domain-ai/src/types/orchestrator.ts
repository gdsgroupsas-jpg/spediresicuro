import type { ApprovalPayload, RiskLevel } from './tools';

export type AnneDomain =
  | 'quote'
  | 'shipment'
  | 'support'
  | 'crm'
  | 'outreach'
  | 'listini'
  | 'mentor'
  | 'debug'
  | 'explain';

export type AnneChannel =
  | 'quote'
  | 'create_shipment'
  | 'support'
  | 'crm'
  | 'outreach'
  | 'listini'
  | 'mentor'
  | 'debug'
  | 'explain';

export type AnnePipelineStage =
  | 'request_manager'
  | 'domain_decomposer'
  | 'task_planner'
  | 'planner'
  | 'tool_analysis'
  | 'tool_argument'
  | 'tool_caller'
  | 'command_builder'
  | 'tool_executor'
  | 'aggregator'
  | 'finalizer'
  | 'policy_tool_safety'
  | 'policy_approval';

export interface AnneOrchestratorInput {
  message: string;
  userId: string;
  userEmail?: string;
  userRole: 'admin' | 'user';
  workspaceId?: string;
  traceId?: string;
  actingContext?: unknown;
  sessionState?: Record<string, unknown>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface RequestClassification {
  domain: AnneDomain;
  channel: AnneChannel;
  intentId: string;
  reason: string;
  confidence: number;
}

export interface StageTraceEntry {
  stage: AnnePipelineStage;
  attempt: number;
  durationMs: number;
  success: boolean;
  model?: string;
  errorCode?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  tokenAlert?: boolean;
  inputText?: string;
  outputText?: string;
}

export interface StageTraceSummary {
  lastStage: AnnePipelineStage;
  totalDurationMs: number;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    tokenAlertCount: number;
    tokenAlertThreshold: number;
  };
  entries: StageTraceEntry[];
}

export interface OrchestratorStepResult {
  success: boolean;
  tool: string;
  taskId?: string;
  stepId?: string;
  message?: string;
  result?: unknown;
  error?: string;
  riskLevel?: RiskLevel;
}

export interface AnneOrchestratorMetadata {
  flowId: string;
  intentId: string;
  channel: AnneChannel;
  domain: AnneDomain;
  pipelineId: string;
  stageTrace: StageTraceSummary;
  riskLevel: RiskLevel;
  approvalRequired: boolean;
  toolPlanId?: string;
  approvalPayload?: ApprovalPayload;
  mode?: 'shadow' | 'canary' | 'v2';
}

export interface AnneOrchestratorOutput {
  message: string;
  metadata: AnneOrchestratorMetadata;
  clarificationRequest?: string;
  pricingOptions?: unknown[];
  sessionState?: Record<string, unknown>;
  agentState?: Record<string, unknown>;
  steps?: OrchestratorStepResult[];
}


