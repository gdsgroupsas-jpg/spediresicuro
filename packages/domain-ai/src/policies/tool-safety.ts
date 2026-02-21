import type { ToolCall, ToolExecutionPolicy, ToolSpec } from '../types/tools';
import type { ToolExecutionContext } from '../types/dependencies';

const FORBIDDEN_ARG_KEYS = new Set<string>(['userId', 'user_id', 'workspaceId', 'workspace_id']);

export interface ToolSafetyDecision {
  allowed: boolean;
  code?: 'tool_not_allowed' | 'domain_forbidden' | 'missing_workspace' | 'missing_required_args' | 'invalid_args';
  message?: string;
  missingArgs?: string[];
  sanitizedCall?: ToolCall;
}

function validatePrimitiveType(expected: string, value: unknown): boolean {
  if (value === undefined || value === null) return false;

  switch (expected) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    default:
      return false;
  }
}

function normalizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (FORBIDDEN_ARG_KEYS.has(key)) continue;
    normalized[key] = value;
  }
  return normalized;
}

function requiresWorkspace(policy: ToolExecutionPolicy | undefined): boolean {
  return policy?.tenancy === 'workspace_required';
}

export function evaluateToolSafety(
  spec: ToolSpec,
  call: ToolCall,
  context: ToolExecutionContext
): ToolSafetyDecision {
  if (spec.domains && spec.domains.length > 0 && !spec.domains.includes(context.classification.domain)) {
    return {
      allowed: false,
      code: 'domain_forbidden',
      message: `Tool ${spec.name} non consentito per dominio ${context.classification.domain}`,
    };
  }

  if (requiresWorkspace(spec.policy) && !context.input.workspaceId) {
    return {
      allowed: false,
      code: 'missing_workspace',
      message: `Tool ${spec.name} richiede workspaceId`,
    };
  }

  const sanitizedArgs = normalizeArgs(call.arguments || {});
  const missingArgs = spec.required.filter((requiredKey) => {
    const value = sanitizedArgs[requiredKey];
    return value === undefined || value === null || value === '';
  });

  if (missingArgs.length > 0) {
    return {
      allowed: false,
      code: 'missing_required_args',
      missingArgs,
      message: `Argomenti obbligatori mancanti: ${missingArgs.join(', ')}`,
    };
  }

  for (const [field, descriptor] of Object.entries(spec.properties || {})) {
    if (!(field in sanitizedArgs)) continue;
    const value = sanitizedArgs[field];
    if (!validatePrimitiveType(descriptor.type, value)) {
      return {
        allowed: false,
        code: 'invalid_args',
        message: `Argomento ${field} non valido per tool ${spec.name}`,
      };
    }
  }

  return {
    allowed: true,
    sanitizedCall: {
      name: spec.name,
      arguments: sanitizedArgs,
    },
  };
}
