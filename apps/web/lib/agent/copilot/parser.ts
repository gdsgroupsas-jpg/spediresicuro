import { z } from 'zod';

const toolCallSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.any()).optional().default({}),
});

const copilotResponseSchema = z.object({
  status: z.enum(['ok', 'clarify', 'no_action']),
  message: z.string(),
  tool_calls: z.array(toolCallSchema).optional().default([]),
  requires_confirmation: z.boolean().optional().default(false),
  confidence: z.number().min(0).max(1).optional().default(0.5),
});

export type CopilotParsedResponse = z.infer<typeof copilotResponseSchema>;

function extractJson(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

export function parseCopilotResponse(text: string): CopilotParsedResponse {
  const jsonText = extractJson(text);
  if (!jsonText) {
    throw new Error('No JSON object found in copilot response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error('Invalid JSON from copilot response');
  }

  return copilotResponseSchema.parse(parsed);
}
