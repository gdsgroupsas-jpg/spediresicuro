/**
 * Client unico per Ollama (locale).
 * Unica configurazione modello: OLLAMA_BASE_URL + OLLAMA_MODEL.
 * Se OLLAMA_MODEL non e disponibile, prova fallback noti leggendo /api/tags.
 */

export const ollamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'gpt-oss-20b',
  temperature: 0.2,
  maxTokens: 4096,
} as const;

const KNOWN_MODEL_FALLBACKS = ['gpt-oss:20b-cloud', 'gpt-oss:20b', 'gpt-oss-20b'] as const;

const MODEL_CACHE_TTL_MS = 30_000;
let cachedModels: string[] = [];
let cachedModelsAt = 0;

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatParams {
  messages: OllamaMessage[];
  system?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface OllamaChatResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

function getBaseUrl(): string {
  return ollamaConfig.baseUrl.replace(/\/+$/, '');
}

function uniqNonEmpty(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v && v.trim())))]
    .map((v) => v.trim())
    .filter(Boolean);
}

async function fetchAvailableModels(baseUrl: string): Promise<string[]> {
  const now = Date.now();
  if (cachedModels.length > 0 && now - cachedModelsAt < MODEL_CACHE_TTL_MS) {
    return cachedModels;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!res.ok) return [];

    const data = await res.json().catch(() => ({}));
    const models = Array.isArray(data?.models) ? data.models : [];
    const extracted = uniqNonEmpty(
      models.flatMap((entry: Record<string, unknown>) => [
        typeof entry.name === 'string' ? entry.name : undefined,
        typeof entry.model === 'string' ? entry.model : undefined,
      ])
    );

    cachedModels = extracted;
    cachedModelsAt = now;
    return extracted;
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveModel(preferredModel?: string): Promise<string> {
  const baseUrl = getBaseUrl();
  const candidates = uniqNonEmpty([
    preferredModel,
    process.env.OLLAMA_MODEL,
    ollamaConfig.model,
    ...KNOWN_MODEL_FALLBACKS,
  ]);

  const available = await fetchAvailableModels(baseUrl);
  if (available.length > 0) {
    const match = candidates.find((candidate) => available.includes(candidate));
    if (match) return match;
    return available[0];
  }

  return candidates[0] || 'gpt-oss:20b-cloud';
}

/**
 * Chiamata a Ollama (API OpenAI-compatible).
 */
export async function chatWithOllama(params: OllamaChatParams): Promise<OllamaChatResponse> {
  const baseUrl = getBaseUrl();
  const model = await resolveModel(params.model);
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
      // Logga il body completo per debug, ma non propagare al chiamante
      const text = await res.text().catch(() => '');
      console.warn(JSON.stringify({ event: 'ollama_error', status: res.status, body: text }));
      throw new Error(`Errore modello AI (${res.status})`);
    }

    const data = await res.json();
    const content = data?.message?.content ?? '';
    const promptEvalCount =
      typeof data?.prompt_eval_count === 'number' && Number.isFinite(data.prompt_eval_count)
        ? Math.max(0, Math.round(data.prompt_eval_count))
        : undefined;
    const evalCount =
      typeof data?.eval_count === 'number' && Number.isFinite(data.eval_count)
        ? Math.max(0, Math.round(data.eval_count))
        : undefined;

    const usage =
      promptEvalCount !== undefined || evalCount !== undefined
        ? {
            inputTokens: promptEvalCount ?? 0,
            outputTokens: evalCount ?? 0,
            totalTokens: (promptEvalCount ?? 0) + (evalCount ?? 0),
          }
        : undefined;

    return { content, model, usage };
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
    messages: Array<{ content: unknown; getType?: () => string }>
  ) => Promise<{ content: string }>;
} | null {
  return {
    invoke: async (messages: Array<{ content: unknown }>) => {
      const ollamaMessages: OllamaMessage[] = messages.map((m) => ({
        role: 'user',
        content:
          typeof m.content === 'string'
            ? m.content
            : Array.isArray(m.content)
              ? m.content
                  .map((part) =>
                    typeof part === 'string'
                      ? part
                      : part && typeof part === 'object' && 'text' in part
                        ? String((part as { text?: unknown }).text ?? '')
                        : JSON.stringify(part)
                  )
                  .join('\n')
              : String(m.content),
      }));
      const out = await chatWithOllama({
        messages: ollamaMessages,
        temperature: 0.1,
        maxTokens: 2048,
      });
      return { content: out.content };
    },
  };
}
