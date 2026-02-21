import type { AnneDomain } from '../types/orchestrator';

export const MODEL_ROLES = [
  'request_manager',
  'domain_decomposer',
  'task_planner',
  'planner',
  'tool_analysis',
  'tool_argument',
  'tool_caller',
  'command_builder',
  'aggregator',
  'debugger',
  'finalizer',
] as const;

export type ModelRole = (typeof MODEL_ROLES)[number];

const ROLE_ENV_SUFFIX: Record<ModelRole, string> = {
  request_manager: 'REQUEST_MANAGER',
  domain_decomposer: 'DOMAIN_DECOMPOSER',
  task_planner: 'TASK_PLANNER',
  planner: 'PLANNER',
  tool_analysis: 'TOOL_ANALYSIS',
  tool_argument: 'TOOL_ARGUMENT',
  tool_caller: 'TOOL_CALLER',
  command_builder: 'COMMAND_BUILDER',
  aggregator: 'AGGREGATOR',
  debugger: 'DEBUGGER',
  finalizer: 'FINALIZER',
};

const DOMAIN_ENV_SUFFIX: Record<AnneDomain, string> = {
  quote: 'QUOTE',
  shipment: 'SHIPMENT',
  support: 'SUPPORT',
  crm: 'CRM',
  outreach: 'OUTREACH',
  listini: 'LISTINI',
  mentor: 'MENTOR',
  debug: 'DEBUG',
  explain: 'EXPLAIN',
};

export function resolveRoleModel(role: ModelRole): string | undefined {
  const roleKey = `OLLAMA_MODEL_${ROLE_ENV_SUFFIX[role]}`;
  return process.env[roleKey] || process.env.OLLAMA_MODEL || undefined;
}

export function resolveDomainRoleModel(
  domain: AnneDomain | undefined,
  role: ModelRole
): string | undefined {
  if (domain) {
    const domainKey = DOMAIN_ENV_SUFFIX[domain];
    const roleKey = ROLE_ENV_SUFFIX[role];
    const scoped = process.env[`OLLAMA_MODEL_${domainKey}_${roleKey}`];
    if (scoped && scoped.trim().length > 0) return scoped;
  }

  return resolveRoleModel(role);
}

export function roleToEnvSuffix(role: ModelRole): string {
  return ROLE_ENV_SUFFIX[role];
}

export function domainToEnvSuffix(domain: AnneDomain): string {
  return DOMAIN_ENV_SUFFIX[domain];
}
