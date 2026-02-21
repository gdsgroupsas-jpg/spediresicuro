/**
 * Multi-provider LLM router che implementa AnneRoleLlm.
 * Smista le chiamate tra provider (DeepSeek, Gemini, Anthropic, Ollama) in base a:
 *   ANNE_PROVIDER_{DOMAIN}_{ROLE} > ANNE_PROVIDER_{ROLE} > ANNE_PROVIDER > "ollama"
 *
 * Strategia consigliata per stage:
 *   supervisor              → gemini (flash, quasi gratis, ~200ms)
 *   extraction/tool_*       → deepseek (V3, ottimo JSON, ~$0.001)
 *   finalizer               → anthropic (Claude Haiku 4.5, qualita)
 *   fallback                → ollama (locale, gratuito)
 */

import type { AnneRoleLlm, LlmMessage, LlmOptions, LlmChatResponse } from '@ss/domain-ai';
import type { ModelRole } from '@ss/domain-ai';
import type { AnneDomain } from '@ss/domain-ai';
import { chatWithOllama } from '@/lib/ai/ollama';
import { createAIClient, type AIProvider } from '@/lib/ai/provider-adapter';

// Provider supportati dal router
export type AnneProvider = 'ollama' | 'deepseek' | 'gemini' | 'anthropic';

const VALID_PROVIDERS = new Set<string>(['ollama', 'deepseek', 'gemini', 'anthropic']);

// Modelli di default per ogni provider
const DEFAULT_MODELS: Record<AnneProvider, string> = {
  ollama: process.env.OLLAMA_MODEL || 'llama3.1',
  deepseek: 'deepseek-chat',
  gemini: 'gemini-2.0-flash',
  anthropic: 'claude-haiku-4-5-20251001',
};

// API key env var per ogni provider
const API_KEY_ENV: Record<Exclude<AnneProvider, 'ollama'>, string> = {
  deepseek: 'DEEPSEEK_API_KEY',
  gemini: 'GEMINI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

function roleToEnvSuffix(role: ModelRole): string {
  return role.toUpperCase();
}

function domainToEnvSuffix(domain: AnneDomain): string {
  return domain.toUpperCase();
}

/**
 * Risolve il provider per un ruolo/dominio dato.
 * Gerarchia: ANNE_PROVIDER_{DOMAIN}_{ROLE} > ANNE_PROVIDER_{ROLE} > ANNE_PROVIDER > "ollama"
 */
export function resolveProvider(role: ModelRole, domain?: AnneDomain): AnneProvider {
  const roleSuffix = roleToEnvSuffix(role);

  // Livello 1: domain + role
  if (domain) {
    const domainSuffix = domainToEnvSuffix(domain);
    const envKey = `ANNE_PROVIDER_${domainSuffix}_${roleSuffix}`;
    const value = process.env[envKey]?.toLowerCase();
    if (value && VALID_PROVIDERS.has(value)) return value as AnneProvider;
  }

  // Livello 2: role
  const roleEnv = `ANNE_PROVIDER_${roleSuffix}`;
  const roleValue = process.env[roleEnv]?.toLowerCase();
  if (roleValue && VALID_PROVIDERS.has(roleValue)) return roleValue as AnneProvider;

  // Livello 3: globale
  const globalValue = process.env.ANNE_PROVIDER?.toLowerCase();
  if (globalValue && VALID_PROVIDERS.has(globalValue)) return globalValue as AnneProvider;

  // Fallback: ollama
  return 'ollama';
}

/**
 * Risolve il modello per un provider/ruolo/dominio dato.
 * Gerarchia: ANNE_MODEL_{DOMAIN}_{ROLE} > ANNE_MODEL_{ROLE} > DEFAULT_MODELS[provider]
 */
export function resolveModel(provider: AnneProvider, role: ModelRole, domain?: AnneDomain): string {
  const roleSuffix = roleToEnvSuffix(role);

  if (domain) {
    const domainSuffix = domainToEnvSuffix(domain);
    const envKey = `ANNE_MODEL_${domainSuffix}_${roleSuffix}`;
    if (process.env[envKey]) return process.env[envKey]!;
  }

  const roleEnv = `ANNE_MODEL_${roleSuffix}`;
  if (process.env[roleEnv]) return process.env[roleEnv]!;

  return DEFAULT_MODELS[provider];
}

function getApiKey(provider: Exclude<AnneProvider, 'ollama'>): string | undefined {
  return process.env[API_KEY_ENV[provider]];
}

// Timeout per chiamate a provider esterni (30 secondi)
const EXTERNAL_PROVIDER_TIMEOUT_MS = 30_000;

/**
 * Chiama un provider esterno (non Ollama) tramite provider-adapter.
 * Timeout di 30s per evitare blocchi indefiniti.
 */
async function callExternalProvider(
  provider: Exclude<AnneProvider, 'ollama'>,
  model: string,
  messages: LlmMessage[],
  options?: LlmOptions
): Promise<LlmChatResponse> {
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    throw new Error(
      `API key mancante per provider ${provider}. Impostare ${API_KEY_ENV[provider]} nelle env.`
    );
  }

  const aiProvider: AIProvider = provider as AIProvider;
  const client = await createAIClient(aiProvider, apiKey, model);

  // Separa system message da user/assistant messages
  const systemMessages = messages.filter((m) => m.role === 'system');
  const chatMessages = messages.filter((m) => m.role !== 'system');

  const chatPromise = client.chat({
    model,
    messages: chatMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    system: systemMessages.map((m) => m.content).join('\n') || undefined,
    maxTokens: options?.maxTokens,
  });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Timeout ${EXTERNAL_PROVIDER_TIMEOUT_MS}ms per provider ${provider}`)),
      EXTERNAL_PROVIDER_TIMEOUT_MS
    );
  });

  try {
    const response = await Promise.race([chatPromise, timeoutPromise]);
    return {
      content: response.content,
      model: response.model || model,
      usage: undefined,
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Chiama Ollama locale.
 */
async function callOllama(
  model: string,
  messages: LlmMessage[],
  options?: LlmOptions
): Promise<LlmChatResponse> {
  const systemMessages = messages.filter((m) => m.role === 'system');
  const chatMessages = messages.filter((m) => m.role !== 'system');

  const response = await chatWithOllama({
    messages: chatMessages.map((m) => ({ role: m.role, content: m.content })),
    system: systemMessages.map((m) => m.content).join('\n') || undefined,
    model,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
  });

  return {
    content: response.content,
    model: response.model,
    usage: response.usage,
  };
}

/**
 * Costruisce un AnneRoleLlm multi-provider.
 * Risolve provider e modello per ogni chiamata in base a env vars.
 */
export function buildMultiProviderLlm(): AnneRoleLlm {
  return {
    async chat(
      role: ModelRole,
      messages: LlmMessage[],
      options?: LlmOptions
    ): Promise<LlmChatResponse> {
      const domain = options?.domain;
      const provider = resolveProvider(role, domain);
      const model = options?.model || resolveModel(provider, role, domain);

      const startMs = Date.now();

      try {
        let response: LlmChatResponse;

        if (provider === 'ollama') {
          response = await callOllama(model, messages, options);
        } else {
          response = await callExternalProvider(provider, model, messages, options);
        }

        const elapsed = Date.now() - startMs;
        console.log(
          JSON.stringify({
            event: 'anne_llm_call',
            provider,
            model,
            role,
            domain: domain || 'default',
            elapsed_ms: elapsed,
            tokens: response.usage?.totalTokens,
          })
        );

        return response;
      } catch (err) {
        const elapsed = Date.now() - startMs;
        console.error(
          JSON.stringify({
            event: 'anne_llm_error',
            provider,
            model,
            role,
            domain: domain || 'default',
            elapsed_ms: elapsed,
            error: err instanceof Error ? err.message : 'unknown',
          })
        );
        throw err;
      }
    },
  };
}
