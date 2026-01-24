import { getAdminPrompt, getBasePrompt } from '@/lib/ai/prompts';
import { ANNE_TOOLS } from '@/lib/ai/tools';

function formatToolsList(): string {
  return ANNE_TOOLS.map((tool) => {
    const required =
      tool.parameters.required.length > 0
        ? ` (required: ${tool.parameters.required.join(', ')})`
        : '';
    return `- ${tool.name}: ${tool.description}${required}`;
  }).join('\n');
}

export function buildCopilotSystemPrompt(isAdmin: boolean, contextSummary?: string): string {
  const basePrompt = isAdmin ? getAdminPrompt() : getBasePrompt();

  return `${basePrompt}

${contextSummary ? `${contextSummary}\n` : ''}

Sei Anne in modalita' copilot locale (TinyLlama). Devi produrre output deterministico.

TOOLS DISPONIBILI:
${formatToolsList()}

FORMATO OUTPUT (JSON SOLO, nessun testo extra):
{
  "status": "ok" | "clarify" | "no_action",
  "message": "string",
  "tool_calls": [
    { "name": "tool_name", "arguments": { "key": "value" } }
  ],
  "requires_confirmation": boolean,
  "confidence": number
}

REGOLE:
- Se serve un'azione usa tool_calls.
- Se mancano dati usa status="clarify" con una sola domanda.
- Se non serve azione usa status="no_action" e rispondi in modo breve.
- Per azioni potenzialmente pericolose (batch, admin logs) imposta requires_confirmation=true.
- confidence tra 0 e 1.
`;
}
