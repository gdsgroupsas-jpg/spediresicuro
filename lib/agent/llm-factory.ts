/**
 * LLM Factory Centralizzata
 *
 * Unico punto di creazione per istanze LLM nel pricing graph.
 * Supporta DeepSeek (default, economico) e Gemini (fallback/vision).
 *
 * DeepSeek usa ChatOpenAI con baseURL override (API OpenAI-compatible).
 * Gemini resta necessario per Vision OCR (multimodale).
 */
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { llmConfig } from '@/lib/config';
import { defaultLogger, type ILogger } from './logger';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export type LLMProvider = 'deepseek' | 'gemini';

interface LLMOptions {
  /** Max output tokens (default: SUPERVISOR_MAX_OUTPUT_TOKENS) */
  maxOutputTokens?: number;
  /** Temperature (default: SUPERVISOR_TEMPERATURE) */
  temperature?: number;
  /** Forza un provider specifico, ignorando llmConfig.PROVIDER */
  forceProvider?: LLMProvider;
  /** Timeout in ms (default: llmConfig.LLM_TIMEOUT_MS = 10s) */
  timeoutMs?: number;
  /** Logger per warning/errori */
  logger?: ILogger;
}

/**
 * Crea istanza LLM per il pricing graph.
 * Ritorna null se API key mancante.
 *
 * Default: usa DeepSeek (configurabile via LLM_PROVIDER env var).
 * Usa forceProvider per eccezioni (es. Vision).
 */
export function createGraphLLM(options: LLMOptions = {}): BaseChatModel | null {
  const logger = options.logger || defaultLogger;
  // Legge provider da env var AL RUNTIME (non dalla config statica)
  // per permettere override nei test e in produzione senza restart
  const rawProvider = process.env.LLM_PROVIDER || 'deepseek';
  const envProvider: LLMProvider =
    rawProvider === 'deepseek' || rawProvider === 'gemini' ? rawProvider : 'deepseek';
  if (rawProvider !== envProvider) {
    logger.warn(`LLM_PROVIDER="${rawProvider}" non valido, uso default "deepseek"`);
  }
  const provider = options.forceProvider || envProvider;
  const maxTokens = options.maxOutputTokens || llmConfig.SUPERVISOR_MAX_OUTPUT_TOKENS;
  const temperature = options.temperature ?? llmConfig.SUPERVISOR_TEMPERATURE;
  const timeoutMs = options.timeoutMs || llmConfig.LLM_TIMEOUT_MS;

  if (provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      logger.warn('DEEPSEEK_API_KEY mancante - LLM disabilitato');
      return null;
    }
    return new ChatOpenAI({
      modelName: llmConfig.DEEPSEEK_MODEL,
      openAIApiKey: apiKey,
      configuration: {
        baseURL: 'https://api.deepseek.com',
      },
      maxTokens,
      temperature,
      timeout: timeoutMs,
    });
  }

  // Gemini (fallback o forceProvider)
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    logger.warn('GOOGLE_API_KEY mancante - LLM Gemini disabilitato');
    return null;
  }
  // Nota: ChatGoogleGenerativeAI non supporta timeout nel costruttore.
  // Il timeout per Gemini è gestito a livello di rete (fetch timeout).
  return new ChatGoogleGenerativeAI({
    model: llmConfig.GEMINI_MODEL,
    maxOutputTokens: maxTokens,
    temperature,
    apiKey,
  });
}

/**
 * Crea istanza LLM per Vision OCR (sempre Gemini).
 * DeepSeek non supporta input multimodali visivi in modo affidabile.
 */
export function createVisionLLM(logger: ILogger = defaultLogger): ChatGoogleGenerativeAI | null {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    logger.warn('GOOGLE_API_KEY mancante - Vision LLM disabilitato');
    return null;
  }
  return new ChatGoogleGenerativeAI({
    model: llmConfig.VISION_MODEL,
    maxOutputTokens: llmConfig.EXTRACT_DATA_MAX_OUTPUT_TOKENS,
    temperature: llmConfig.SUPERVISOR_TEMPERATURE,
    apiKey,
  });
}
