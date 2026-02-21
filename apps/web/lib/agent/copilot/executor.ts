import { chatWithLocalLLM, type LocalLLMMessage } from './llm-client';
import { buildCopilotSystemPrompt } from './prompt';
import { parseCopilotResponse } from './parser';
import { executeTool, ANNE_TOOLS, type ToolCall } from '@/lib/ai/tools';
import { writeAuditLog } from '@/lib/security/audit-log';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '@/lib/security/audit-actions';
import type { ActingContext } from '@/lib/safe-auth';

const DANGEROUS_TOOLS = new Set([
  'create_batch_shipments',
  'analyze_business_health',
  'check_error_logs',
]);

const ALLOWED_TOOLS = new Set(ANNE_TOOLS.map((tool) => tool.name));
const MAX_TOOL_CALLS = 3;
const TOOL_CATEGORY: Record<string, 'admin' | 'batch' | 'memory' | 'standard'> = {
  analyze_business_health: 'admin',
  check_error_logs: 'admin',
  create_batch_shipments: 'batch',
  update_user_memory: 'memory',
};
const DENYLISTED_CATEGORIES = new Set(['admin', 'batch']);

async function logCopilotSecurityEvent(
  context: ActingContext | undefined,
  reason: string,
  metadata: Record<string, any>
): Promise<void> {
  if (!context) return;

  try {
    await writeAuditLog({
      context,
      action: AUDIT_ACTIONS.SECURITY_VIOLATION,
      resourceType: AUDIT_RESOURCE_TYPES.SYSTEM,
      resourceId: 'anne_copilot',
      metadata: {
        reason,
        ...metadata,
      },
    });
  } catch {
    // Fail-open: non bloccare risposta se audit fallisce
  }
}

function containsConfirmation(message: string): boolean {
  const normalized = message.toLowerCase();
  return /\b(conferma|procedi|vai|ok|si|sì|confermo)\b/.test(normalized);
}

function summarizeToolCalls(toolCalls: ToolCall[]): string {
  return toolCalls.map((call) => call.name).join(', ');
}

export interface LocalCopilotInput {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  contextSummary?: string;
  userId: string;
  userRole: 'admin' | 'user';
  isAdmin: boolean;
  actingContext?: ActingContext;
}

export interface LocalCopilotResult {
  status: 'handled' | 'fallback';
  message?: string;
  toolCalls?: ToolCall[];
  metadata?: Record<string, any>;
  fallbackReason?: string;
}

function buildPlannerMessages(
  systemPrompt: string,
  message: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): LocalLLMMessage[] {
  const messages: LocalLLMMessage[] = [{ role: 'system', content: systemPrompt }];

  if (history && history.length > 0) {
    for (const item of history.slice(-6)) {
      messages.push({
        role: item.role,
        content: item.content,
      });
    }
  }

  messages.push({ role: 'user', content: message });
  return messages;
}

function buildToolResultMessage(
  results: Array<{ name: string; content: string }>
): LocalLLMMessage {
  return {
    role: 'user',
    content: `Risultati tools (riassumi e rispondi in modo chiaro):\n${results
      .map((result) => `- ${result.name}: ${result.content}`)
      .join('\n')}`,
  };
}

export async function runLocalCopilot(input: LocalCopilotInput): Promise<LocalCopilotResult> {
  const systemPrompt = buildCopilotSystemPrompt(input.isAdmin, input.contextSummary);
  const plannerMessages = buildPlannerMessages(systemPrompt, input.message, input.history);

  let parsed;
  try {
    const plannerResponse = await chatWithLocalLLM({
      messages: plannerMessages,
      temperature: 0.1,
      maxTokens: 500,
    });

    parsed = parseCopilotResponse(plannerResponse.content);
  } catch (error: any) {
    return {
      status: 'fallback',
      fallbackReason: error?.message || 'local_llm_error',
    };
  }

  if (parsed.status === 'clarify' || parsed.status === 'no_action') {
    return {
      status: 'handled',
      message: parsed.message,
      metadata: {
        copilot: true,
        confidence: parsed.confidence,
        toolCalls: 0,
      },
    };
  }

  const toolCalls = parsed.tool_calls || [];
  if (toolCalls.length > MAX_TOOL_CALLS) {
    await logCopilotSecurityEvent(input.actingContext, 'too_many_tool_calls', {
      toolCalls: toolCalls.map((call) => call.name),
      count: toolCalls.length,
    });
    return {
      status: 'handled',
      message:
        'Ho bisogno di semplificare la richiesta. Puoi indicare una sola operazione alla volta?',
      metadata: {
        copilot: true,
        confidence: parsed.confidence,
        toolCalls: toolCalls.length,
        rejected: 'too_many_tools',
      },
    };
  }

  const unknownTool = toolCalls.find((call) => !ALLOWED_TOOLS.has(call.name));
  if (unknownTool) {
    await logCopilotSecurityEvent(input.actingContext, 'unknown_tool', {
      toolCalls: toolCalls.map((call) => call.name),
      unknownTool: unknownTool.name,
    });
    return {
      status: 'handled',
      message:
        'Posso agire solo all’interno della web app con gli strumenti autorizzati. Vuoi una delle funzioni disponibili?',
      metadata: {
        copilot: true,
        confidence: parsed.confidence,
        toolCalls: toolCalls.length,
        rejected: 'unknown_tool',
        unknownTool: unknownTool.name,
      },
    };
  }

  const deniedTool = toolCalls.find((call) =>
    DENYLISTED_CATEGORIES.has(TOOL_CATEGORY[call.name] || 'standard')
  );
  if (deniedTool) {
    await logCopilotSecurityEvent(input.actingContext, 'denylisted_tool_category', {
      toolCalls: toolCalls.map((call) => call.name),
      deniedTool: deniedTool.name,
      category: TOOL_CATEGORY[deniedTool.name] || 'standard',
    });
    return {
      status: 'handled',
      message:
        'Per sicurezza questa operazione non è disponibile nel copilot locale. Vuoi un’altra azione?',
      metadata: {
        copilot: true,
        confidence: parsed.confidence,
        toolCalls: toolCalls.length,
        rejected: 'denylisted_category',
      },
    };
  }

  if (toolCalls.length === 0) {
    return {
      status: 'handled',
      message: parsed.message,
      metadata: {
        copilot: true,
        confidence: parsed.confidence,
        toolCalls: 0,
      },
    };
  }

  const confirmationRequired =
    parsed.requires_confirmation || toolCalls.some((call) => DANGEROUS_TOOLS.has(call.name));

  if (confirmationRequired && !containsConfirmation(input.message)) {
    return {
      status: 'handled',
      message: `Questa operazione richiede conferma esplicita. Vuoi procedere? (tools: ${summarizeToolCalls(toolCalls)})`,
      metadata: {
        copilot: true,
        confidence: parsed.confidence,
        toolCalls: toolCalls.length,
        requiresConfirmation: true,
      },
    };
  }

  const toolResults: Array<{ name: string; content: string }> = [];

  for (const toolCall of toolCalls) {
    const result = await executeTool(
      {
        name: toolCall.name,
        arguments: toolCall.arguments || {},
      },
      input.userId,
      input.userRole
    );

    toolResults.push({
      name: toolCall.name,
      content: result.success ? JSON.stringify(result.result) : `Errore: ${result.error}`,
    });
  }

  try {
    const followUp = await chatWithLocalLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input.message },
        buildToolResultMessage(toolResults),
      ],
      temperature: 0.2,
      maxTokens: 600,
    });

    return {
      status: 'handled',
      message: followUp.content,
      toolCalls,
      metadata: {
        copilot: true,
        confidence: parsed.confidence,
        toolCalls: toolCalls.length,
      },
    };
  } catch (error: any) {
    return {
      status: 'fallback',
      fallbackReason: error?.message || 'local_llm_followup_error',
    };
  }
}
