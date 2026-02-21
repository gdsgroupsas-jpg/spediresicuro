import type { AnneDomain, AnnePipelineStage } from './orchestrator';
import type { RiskLevel, ToolCall } from './tools';

export interface StageInput<TPayload> {
  pipelineId: string;
  stage: AnnePipelineStage;
  attempt: number;
  payload: TPayload;
}

export interface StageOutput<TPayload> {
  raw: string;
  output: TPayload;
}

export interface DomainTask {
  id: string;
  domain: AnneDomain;
  intentId: string;
  goal: string;
  dependsOn: string[];
  acceptance?: string;
}

export type PlannedTask = DomainTask;

export interface ToolPlanStep {
  id: string;
  taskId: string;
  goal: string;
  toolCandidates: string[];
  expectedOutcome?: string;
}

export interface ToolPlan {
  taskId: string;
  steps: ToolPlanStep[];
}

export interface ToolDecision extends ToolCall {
  taskId: string;
  stepId: string;
  reason: string;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
}

export interface PromptContract<TPayload> {
  system: string;
  buildUserPrompt(payload: TPayload): string;
}
