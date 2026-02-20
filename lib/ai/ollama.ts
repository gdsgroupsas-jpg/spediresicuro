/**
 * Client unico per Ollama (locale).
 * Unica configurazione modello: OLLAMA_BASE_URL + OLLAMA_MODEL.
 * Default: gpt-oss-20b come tester.
 */

export const ollamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'gpt-oss-20b',
  temperature: 0.2,
  maxTokens: 4096,
} as const;

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatParams {
  messages: OllamaMessage[];
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface OllamaChatResponse {
  content: string;
  model: string;
}

function getBaseUrl(): string {
  return ollamaConfig.baseUrl.replace(/\/+$/, '');
}

/**
 * Chiamata a Ollama (API OpenAI-compatible).
 */
export async function chatWithOllama(params: OllamaChatParams): Promise<OllamaChatResponse> {
  const baseUrl = getBaseUrl();
  const model = ollamaConfig.model;
  const messages = [...params.messages];
  if (params.system) {
    messages.unshift({ role: 'system', content: params.system });
  }
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    options: {
      temperature: params.temperature ?? ollamaConfig.temperature,
      num_predict: params.maxTokens ?? ollamaConfig.maxTokens,
    },
  };

  const controller = new AbortController();
  const timeoutMs = 120000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama error (${res.status}): ${text || res.statusText}`);
    }

    const data = await res.json();
    const content = data?.message?.content ?? '';
    return { content, model };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Adapter compatibile con llm.invoke([HumanMessage(...)]) usato da supervisor/nodes.
 * Restituisce null se Ollama non è configurato (baseUrl non raggiungibile o modello assente).
 */
export function getOllamaLLM(): {
  invoke: (
    messages: Array<{
      content: string;
      role?: 'system' | 'user' | 'assistant';
      getType?: () => string;
    }>
  ) => Promise<{ content: string }>;
} | null {
  return {
    invoke: async (
      messages: Array<{
        content: string;
        role?: 'system' | 'user' | 'assistant';
        getType?: () => string;
      }>
    ) => {
      const ollamaMessages: OllamaMessage[] = messages.map((m) => {
        // Determina role: campo esplicito > getType() > default 'user'
        let role: OllamaMessage['role'] = 'user';
        if (m.role) {
          role = m.role;
        } else if (m.getType) {
          const t = m.getType();
          if (t === 'system') role = 'system';
          else if (t === 'ai' || t === 'assistant') role = 'assistant';
        }
        return {
          role,
          content: typeof m.content === 'string' ? m.content : String(m.content),
        };
      });
      const out = await chatWithOllama({
        messages: ollamaMessages,
        temperature: 0.1,
        maxTokens: 2048,
      });
      return { content: out.content };
    },
  };
}
