export type LocalLLMRole = 'system' | 'user' | 'assistant';

export interface LocalLLMMessage {
  role: LocalLLMRole;
  content: string;
}

export interface LocalLLMChatParams {
  messages: LocalLLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LocalLLMChatResponse {
  content: string;
  model?: string;
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:8080';
const DEFAULT_MODEL = 'tinyllama';

function getBaseUrl(): string {
  const baseUrl = process.env.LOCAL_LLM_URL || DEFAULT_BASE_URL;
  return baseUrl.replace(/\/+$/, '');
}

export async function chatWithLocalLLM(params: LocalLLMChatParams): Promise<LocalLLMChatResponse> {
  const controller = new AbortController();
  const timeoutOverride = process.env.LOCAL_LLM_TIMEOUT_MS;
  const timeoutMs = timeoutOverride ? Math.max(1000, Number(timeoutOverride)) : 20000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getBaseUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: params.model || process.env.LOCAL_LLM_MODEL || DEFAULT_MODEL,
        messages: params.messages,
        temperature: params.temperature ?? 0.2,
        max_tokens: params.maxTokens ?? 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Local LLM error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const content = choice?.message?.content ?? '';

    if (!content) {
      throw new Error('Local LLM response empty');
    }

    return {
      content,
      model: data?.model,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
