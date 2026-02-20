/**
 * Test: LLM Factory Centralizzata
 *
 * Verifica creazione istanze LLM per DeepSeek e Gemini,
 * gestione API key mancante, forceProvider, e Vision.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @langchain/openai
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation((config) => ({
    _type: 'ChatOpenAI',
    modelName: config.modelName,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    invoke: vi.fn().mockResolvedValue({ content: '' }),
    bindTools: vi.fn().mockReturnThis(),
  })),
}));

// Mock @langchain/google-genai
vi.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: vi.fn().mockImplementation((config) => ({
    _type: 'ChatGoogleGenerativeAI',
    model: config.model,
    maxOutputTokens: config.maxOutputTokens,
    temperature: config.temperature,
    invoke: vi.fn().mockResolvedValue({ content: '' }),
  })),
}));

// Mock logger
vi.mock('@/lib/agent/logger', () => ({
  defaultLogger: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { createGraphLLM, createVisionLLM } from '@/lib/agent/llm-factory';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

describe('LLM Factory', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Ripristina env vars
    process.env = { ...originalEnv };
  });

  describe('createGraphLLM', () => {
    it('dovrebbe creare ChatOpenAI (DeepSeek) con LLM_PROVIDER=deepseek', () => {
      process.env.LLM_PROVIDER = 'deepseek';
      process.env.DEEPSEEK_API_KEY = 'sk-test-deepseek';

      const llm = createGraphLLM();

      expect(llm).not.toBeNull();
      expect(ChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: 'deepseek-chat',
          openAIApiKey: 'sk-test-deepseek',
          configuration: { baseURL: 'https://api.deepseek.com' },
        })
      );
    });

    it('dovrebbe creare DeepSeek di default (LLM_PROVIDER non impostato)', () => {
      delete process.env.LLM_PROVIDER;
      process.env.DEEPSEEK_API_KEY = 'sk-test';

      const llm = createGraphLLM();

      expect(llm).not.toBeNull();
      expect(ChatOpenAI).toHaveBeenCalled();
    });

    it('dovrebbe ritornare null se DEEPSEEK_API_KEY mancante', () => {
      process.env.LLM_PROVIDER = 'deepseek';
      delete process.env.DEEPSEEK_API_KEY;

      const llm = createGraphLLM();

      expect(llm).toBeNull();
    });

    it('dovrebbe creare ChatGoogleGenerativeAI con LLM_PROVIDER=gemini', () => {
      process.env.LLM_PROVIDER = 'gemini';
      process.env.GOOGLE_API_KEY = 'AIza-test';
      delete process.env.DEEPSEEK_API_KEY;

      const llm = createGraphLLM();

      expect(llm).not.toBeNull();
      expect(ChatGoogleGenerativeAI).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.0-flash-001',
          apiKey: 'AIza-test',
        })
      );
    });

    it('dovrebbe ritornare null se GOOGLE_API_KEY mancante (provider gemini)', () => {
      process.env.LLM_PROVIDER = 'gemini';
      delete process.env.GOOGLE_API_KEY;
      delete process.env.DEEPSEEK_API_KEY;

      const llm = createGraphLLM();

      expect(llm).toBeNull();
    });

    it('dovrebbe rispettare forceProvider ignorando LLM_PROVIDER', () => {
      process.env.LLM_PROVIDER = 'deepseek';
      process.env.GOOGLE_API_KEY = 'AIza-test';

      const llm = createGraphLLM({ forceProvider: 'gemini' });

      expect(llm).not.toBeNull();
      expect(ChatGoogleGenerativeAI).toHaveBeenCalled();
      expect(ChatOpenAI).not.toHaveBeenCalled();
    });

    it('dovrebbe passare maxOutputTokens e temperature corretti', () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test';
      delete process.env.LLM_PROVIDER;

      createGraphLLM({ maxOutputTokens: 2048, temperature: 0.5 });

      expect(ChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: 2048,
          temperature: 0.5,
        })
      );
    });

    it('dovrebbe usare valori default per maxOutputTokens e temperature', () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test';
      delete process.env.LLM_PROVIDER;

      createGraphLLM();

      expect(ChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: 512, // SUPERVISOR_MAX_OUTPUT_TOKENS
          temperature: 0.1, // SUPERVISOR_TEMPERATURE
        })
      );
    });
  });

  describe('createVisionLLM', () => {
    it('dovrebbe creare SEMPRE ChatGoogleGenerativeAI (Gemini)', () => {
      process.env.GOOGLE_API_KEY = 'AIza-test';

      const llm = createVisionLLM();

      expect(llm).not.toBeNull();
      expect(ChatGoogleGenerativeAI).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.0-flash-001',
          maxOutputTokens: 2048,
          apiKey: 'AIza-test',
        })
      );
    });

    it('dovrebbe ritornare null se GOOGLE_API_KEY mancante', () => {
      delete process.env.GOOGLE_API_KEY;

      const llm = createVisionLLM();

      expect(llm).toBeNull();
    });

    it('NON dovrebbe mai usare DeepSeek per Vision', () => {
      process.env.LLM_PROVIDER = 'deepseek';
      process.env.DEEPSEEK_API_KEY = 'sk-test';
      process.env.GOOGLE_API_KEY = 'AIza-test';

      const llm = createVisionLLM();

      expect(llm).not.toBeNull();
      expect(ChatGoogleGenerativeAI).toHaveBeenCalled();
      expect(ChatOpenAI).not.toHaveBeenCalled();
    });
  });

  describe('Timeout', () => {
    it('dovrebbe passare timeout default (10s) a ChatOpenAI', () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test';
      delete process.env.LLM_PROVIDER;

      createGraphLLM();

      expect(ChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 10_000,
        })
      );
    });

    it('dovrebbe passare timeout custom a ChatOpenAI', () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test';
      delete process.env.LLM_PROVIDER;

      createGraphLLM({ timeoutMs: 5000 });

      expect(ChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5000,
        })
      );
    });

    it('dovrebbe creare Gemini senza timeout (non supportato nel costruttore)', () => {
      process.env.LLM_PROVIDER = 'gemini';
      process.env.GOOGLE_API_KEY = 'AIza-test';

      const llm = createGraphLLM({ timeoutMs: 15000 });

      expect(llm).not.toBeNull();
      expect(ChatGoogleGenerativeAI).toHaveBeenCalledWith(
        expect.not.objectContaining({
          timeout: expect.anything(),
        })
      );
    });
  });

  describe('Validazione provider', () => {
    it('dovrebbe fare fallback a deepseek con LLM_PROVIDER invalido', () => {
      process.env.LLM_PROVIDER = 'invalid_provider';
      process.env.DEEPSEEK_API_KEY = 'sk-test';

      const llm = createGraphLLM();

      // Deve usare DeepSeek come fallback (non crashare)
      expect(llm).not.toBeNull();
      expect(ChatOpenAI).toHaveBeenCalled();
    });
  });
});
