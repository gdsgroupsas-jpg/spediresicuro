import type { AnneChannel, AnneDomain } from './orchestrator';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ToolCategory = 'read' | 'write' | 'action';
export type ToolTenancyMode = 'workspace_required' | 'user_scoped' | 'none';

export interface ToolProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  enum?: string[];
}

export interface ToolExecutionPolicy {
  category: ToolCategory;
  tenancy: ToolTenancyMode;
  requiresApproval?: boolean;
}

export interface ToolSpec {
  name: string;
  description: string;
  properties: Record<string, ToolProperty>;
  required: string[];
  domains?: AnneDomain[];
  channels?: AnneChannel[];
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  policy?: ToolExecutionPolicy;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolExecutionResult {
  success: boolean;
  tool?: string;
  result?: unknown;
  error?: string;
  message?: string;
  clarificationRequest?: string;
  pricingOptions?: unknown[];
  sessionState?: Record<string, unknown>;
  agentState?: Record<string, unknown>;
}

export interface ApprovalPayload {
  id: string;
  tool: string;
  description: string;
  riskLevel: RiskLevel;
  args: Record<string, unknown>;
  expiresAt: string;
}
