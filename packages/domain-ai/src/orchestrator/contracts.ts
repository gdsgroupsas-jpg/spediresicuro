import type { AnneChannel, AnneDomain } from '../types/orchestrator';
import type { DomainTask, ToolPlanStep } from '../types/planning';
import type { RiskLevel } from '../types/tools';

export class ContractValidationError extends Error {
  readonly code = 'stage_contract_invalid';

  constructor(message: string) {
    super(message);
    this.name = 'ContractValidationError';
  }
}

const ALLOWED_DOMAINS: AnneDomain[] = [
  'quote',
  'shipment',
  'support',
  'crm',
  'outreach',
  'listini',
  'mentor',
  'debug',
  'explain',
];

const ALLOWED_CHANNELS: AnneChannel[] = [
  'quote',
  'create_shipment',
  'support',
  'crm',
  'outreach',
  'listini',
  'mentor',
  'debug',
  'explain',
];

const ALLOWED_RISK: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

function stripJsonFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function parseObject(raw: string): Record<string, unknown> {
  const cleaned = stripJsonFence(raw);
  if (!cleaned) {
    throw new ContractValidationError('Empty JSON payload');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ContractValidationError('Invalid JSON payload');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ContractValidationError('JSON payload must be an object');
  }

  return parsed as Record<string, unknown>;
}

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ContractValidationError(`Field "${field}" must be a non-empty string`);
  }
  return value.trim();
}

function asString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new ContractValidationError(`Field "${field}" must be a string`);
  }
  return value.trim();
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ContractValidationError(`Field "${field}" must be a number`);
  }
  return value;
}

function asStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new ContractValidationError(`Field "${field}" must be an array`);
  }

  const items = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);

  if (items.length !== value.length) {
    throw new ContractValidationError(`Field "${field}" must contain only strings`);
  }

  return items;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContractValidationError(`Field "${field}" must be an object`);
  }

  return value as Record<string, unknown>;
}

function asDomain(value: unknown): AnneDomain {
  const domain = asNonEmptyString(value, 'domain').toLowerCase();
  if (!ALLOWED_DOMAINS.includes(domain as AnneDomain)) {
    throw new ContractValidationError(`Unsupported domain: ${domain}`);
  }
  return domain as AnneDomain;
}

function asChannel(value: unknown): AnneChannel {
  const channel = asNonEmptyString(value, 'channel').toLowerCase();
  if (!ALLOWED_CHANNELS.includes(channel as AnneChannel)) {
    throw new ContractValidationError(`Unsupported channel: ${channel}`);
  }
  return channel as AnneChannel;
}

function asRiskLevel(value: unknown, field: string): RiskLevel {
  const risk = asNonEmptyString(value, field).toLowerCase();
  if (!ALLOWED_RISK.includes(risk as RiskLevel)) {
    throw new ContractValidationError(`Unsupported risk level: ${risk}`);
  }
  return risk as RiskLevel;
}

export interface RequestManagerContract {
  domain: AnneDomain;
  channel: AnneChannel;
  intentId: string;
  reason: string;
  confidence: number;
}

export function parseRequestManagerContract(raw: string): RequestManagerContract {
  const obj = parseObject(raw);
  const confidence = asNumber(obj.confidence, 'confidence');

  return {
    domain: asDomain(obj.domain),
    channel: asChannel(obj.channel),
    intentId: asNonEmptyString(obj.intentId, 'intentId'),
    reason: asNonEmptyString(obj.reason, 'reason'),
    confidence: Math.max(0, Math.min(100, Math.round(confidence))),
  };
}

export interface DomainDecomposerContract {
  subtasks: DomainTask[];
}

export function parseDomainDecomposerContract(
  raw: string,
  fallbackDomain: AnneDomain,
  fallbackIntentId: string
): DomainDecomposerContract {
  const obj = parseObject(raw);

  if (!Array.isArray(obj.subtasks) || obj.subtasks.length === 0) {
    throw new ContractValidationError('Field "subtasks" must be a non-empty array');
  }

  const subtasks = obj.subtasks.map((entry, index) => {
    const subtask = asRecord(entry, `subtasks[${index}]`);
    const id = asString(subtask.id, `subtasks[${index}].id`) || `task_${index + 1}`;
    const domain =
      subtask.domain === undefined ? fallbackDomain : asDomain(subtask.domain ?? fallbackDomain);
    const intentId =
      asString(subtask.intentId, `subtasks[${index}].intentId`) || fallbackIntentId;
    const goal = asNonEmptyString(subtask.goal, `subtasks[${index}].goal`);
    const dependsOn =
      subtask.dependsOn === undefined
        ? []
        : asStringArray(subtask.dependsOn, `subtasks[${index}].dependsOn`);
    const acceptance = asString(subtask.acceptance, `subtasks[${index}].acceptance`);

    return {
      id,
      domain,
      intentId,
      goal,
      dependsOn,
      ...(acceptance ? { acceptance } : {}),
    } satisfies DomainTask;
  });

  return { subtasks };
}

export interface TaskPlannerContract {
  tasks: DomainTask[];
}

export function parseTaskPlannerContract(raw: string): TaskPlannerContract {
  const obj = parseObject(raw);

  if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) {
    throw new ContractValidationError('Field "tasks" must be a non-empty array');
  }

  const tasks = obj.tasks.map((entry, index) => {
    const task = asRecord(entry, `tasks[${index}]`);
    const id = asString(task.id, `tasks[${index}].id`) || `task_${index + 1}`;
    const goal = asNonEmptyString(task.goal, `tasks[${index}].goal`);
    const domain = asDomain(task.domain);
    const intentId = asNonEmptyString(task.intentId, `tasks[${index}].intentId`);
    const dependsOn =
      task.dependsOn === undefined ? [] : asStringArray(task.dependsOn, `tasks[${index}].dependsOn`);
    const acceptance = asString(task.acceptance, `tasks[${index}].acceptance`);

    return {
      id,
      goal,
      domain,
      intentId,
      dependsOn,
      ...(acceptance ? { acceptance } : {}),
    } satisfies DomainTask;
  });

  return { tasks };
}

export interface PlannerContract {
  steps: ToolPlanStep[];
}

export function parsePlannerContract(raw: string, taskId: string): PlannerContract {
  const obj = parseObject(raw);

  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    throw new ContractValidationError('Field "steps" must be a non-empty array');
  }

  const steps = obj.steps.map((entry, index) => {
    const step = asRecord(entry, `steps[${index}]`);
    const id = asString(step.id, `steps[${index}].id`) || `${taskId}_step_${index + 1}`;
    const goal = asNonEmptyString(step.goal, `steps[${index}].goal`);
    const toolCandidates = asStringArray(step.toolCandidates, `steps[${index}].toolCandidates`);
    if (toolCandidates.length === 0) {
      throw new ContractValidationError(`steps[${index}].toolCandidates cannot be empty`);
    }

    const expectedOutcome = asString(step.expectedOutcome, `steps[${index}].expectedOutcome`);

    return {
      id,
      taskId,
      goal,
      toolCandidates,
      ...(expectedOutcome ? { expectedOutcome } : {}),
    } satisfies ToolPlanStep;
  });

  return { steps };
}

export interface ToolAnalysisContract {
  recommendedTool: string;
  riskLevel: RiskLevel;
  missingData: string[];
  requiresClarification: boolean;
  clarificationQuestion?: string;
  rationale?: string;
}

export function parseToolAnalysisContract(raw: string): ToolAnalysisContract {
  const obj = parseObject(raw);

  const recommendedTool = asNonEmptyString(obj.recommendedTool, 'recommendedTool');
  const riskLevel =
    obj.riskLevel === undefined ? 'low' : asRiskLevel(obj.riskLevel, 'riskLevel');
  const missingData = obj.missingData === undefined ? [] : asStringArray(obj.missingData, 'missingData');
  const requiresClarification = Boolean(obj.requiresClarification);
  const clarificationQuestion = asString(obj.clarificationQuestion, 'clarificationQuestion');
  const rationale = asString(obj.rationale, 'rationale');

  return {
    recommendedTool,
    riskLevel,
    missingData,
    requiresClarification,
    ...(clarificationQuestion ? { clarificationQuestion } : {}),
    ...(rationale ? { rationale } : {}),
  };
}

export interface ToolArgumentContract {
  tool: string;
  args: Record<string, unknown>;
  rationale?: string;
}

export function parseToolArgumentContract(raw: string): ToolArgumentContract {
  const obj = parseObject(raw);

  return {
    tool: asNonEmptyString(obj.tool, 'tool'),
    args: asRecord(obj.args, 'args'),
    ...(asString(obj.rationale, 'rationale') ? { rationale: asString(obj.rationale, 'rationale') } : {}),
  };
}

export interface ToolCallerContract {
  tool: string;
  args: Record<string, unknown>;
  reason: string;
}

export function parseToolCallerContract(raw: string): ToolCallerContract {
  const obj = parseObject(raw);

  return {
    tool: asNonEmptyString(obj.tool, 'tool'),
    args: asRecord(obj.args, 'args'),
    reason: asNonEmptyString(obj.reason, 'reason'),
  };
}

export interface CommandBuilderContract {
  tool: string;
  args: Record<string, unknown>;
}

export function parseCommandBuilderContract(raw: string): CommandBuilderContract {
  const obj = parseObject(raw);

  return {
    tool: asNonEmptyString(obj.tool, 'tool'),
    args: asRecord(obj.args, 'args'),
  };
}

export interface AggregatorContract {
  summary: string;
  message?: string;
  clarificationRequired: boolean;
  clarificationQuestion?: string;
  agentState?: Record<string, unknown>;
  sessionState?: Record<string, unknown>;
}

export function parseAggregatorContract(raw: string): AggregatorContract {
  const obj = parseObject(raw);

  const summary = asNonEmptyString(obj.summary, 'summary');
  const message = asString(obj.message, 'message');
  const clarificationRequired = Boolean(obj.clarificationRequired);
  const clarificationQuestion = asString(obj.clarificationQuestion, 'clarificationQuestion');
  const agentState =
    obj.agentState === undefined ? undefined : asRecord(obj.agentState, 'agentState');
  const sessionState =
    obj.sessionState === undefined ? undefined : asRecord(obj.sessionState, 'sessionState');

  return {
    summary,
    ...(message ? { message } : {}),
    clarificationRequired,
    ...(clarificationQuestion ? { clarificationQuestion } : {}),
    ...(agentState ? { agentState } : {}),
    ...(sessionState ? { sessionState } : {}),
  };
}

export interface FinalizerContract {
  message: string;
  clarificationRequest?: string;
  nextAction?: string;
}

export function parseFinalizerContract(raw: string): FinalizerContract {
  const obj = parseObject(raw);

  return {
    message: asNonEmptyString(obj.message, 'message'),
    ...(asString(obj.clarificationRequest, 'clarificationRequest')
      ? { clarificationRequest: asString(obj.clarificationRequest, 'clarificationRequest') }
      : {}),
    ...(asString(obj.nextAction, 'nextAction')
      ? { nextAction: asString(obj.nextAction, 'nextAction') }
      : {}),
  };
}
