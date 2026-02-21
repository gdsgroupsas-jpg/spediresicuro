import type { ApprovalPayload, RiskLevel, ToolCall, ToolSpec } from '../types/tools';

const CONFIRM_REGEX = /\b(conferma|confermo|procedi|vai|ok|si|si|yes|autorizzo)\b/i;

export interface ApprovalDecision {
  required: boolean;
  approved: boolean;
  payload?: ApprovalPayload;
  riskLevel: RiskLevel;
}

function inferRiskLevel(spec: ToolSpec): RiskLevel {
  if (spec.riskLevel) return spec.riskLevel;
  if (spec.policy?.category === 'write') return 'high';
  if (spec.policy?.category === 'action') return 'medium';
  return 'low';
}

function requiresApproval(spec: ToolSpec): boolean {
  if (spec.requiresApproval) return true;
  if (spec.policy?.requiresApproval) return true;

  const risk = inferRiskLevel(spec);
  return risk === 'high' || risk === 'critical';
}

function buildApprovalPayload(spec: ToolSpec, call: ToolCall, now: Date): ApprovalPayload {
  const riskLevel = inferRiskLevel(spec);
  return {
    id: `approval_${spec.name}_${now.getTime()}`,
    tool: spec.name,
    description: `Conferma richiesta per azione ${spec.name}: ${spec.description}`,
    riskLevel,
    args: call.arguments,
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
  };
}

export function evaluateApprovalPolicy(
  spec: ToolSpec,
  call: ToolCall,
  userMessage: string,
  now: Date
): ApprovalDecision {
  const riskLevel = inferRiskLevel(spec);
  const required = requiresApproval(spec);

  if (!required) {
    return {
      required: false,
      approved: true,
      riskLevel,
    };
  }

  if (CONFIRM_REGEX.test(userMessage)) {
    return {
      required: true,
      approved: true,
      riskLevel,
    };
  }

  return {
    required: true,
    approved: false,
    riskLevel,
    payload: buildApprovalPayload(spec, call, now),
  };
}

