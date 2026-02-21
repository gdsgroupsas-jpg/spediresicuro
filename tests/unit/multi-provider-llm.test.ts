/**
 * Test per il multi-provider LLM router.
 * Verifica risoluzione provider, modello, e fallback chain.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  resolveProvider,
  resolveModel,
  type AnneProvider,
} from '@/lib/agent/v2/multi-provider-llm';

describe('multi-provider LLM: resolveProvider', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Ripristina env
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('ANNE_PROVIDER')) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it('fallback a ollama se nessuna env configurata', () => {
    delete process.env.ANNE_PROVIDER;
    expect(resolveProvider('finalizer')).toBe('ollama');
  });

  it('usa ANNE_PROVIDER globale', () => {
    process.env.ANNE_PROVIDER = 'deepseek';
    expect(resolveProvider('finalizer')).toBe('deepseek');
  });

  it('ANNE_PROVIDER_{ROLE} sovrascrive globale', () => {
    process.env.ANNE_PROVIDER = 'deepseek';
    process.env.ANNE_PROVIDER_FINALIZER = 'anthropic';
    expect(resolveProvider('finalizer')).toBe('anthropic');
    // altri ruoli usano ancora il globale
    expect(resolveProvider('request_manager')).toBe('deepseek');
  });

  it('ANNE_PROVIDER_{DOMAIN}_{ROLE} sovrascrive tutto', () => {
    process.env.ANNE_PROVIDER = 'deepseek';
    process.env.ANNE_PROVIDER_FINALIZER = 'anthropic';
    process.env.ANNE_PROVIDER_QUOTE_FINALIZER = 'gemini';
    expect(resolveProvider('finalizer', 'quote')).toBe('gemini');
    // senza dominio usa il role-level
    expect(resolveProvider('finalizer')).toBe('anthropic');
  });

  it('ignora valori non validi', () => {
    process.env.ANNE_PROVIDER = 'invalid_provider';
    expect(resolveProvider('finalizer')).toBe('ollama');
  });

  it('case insensitive', () => {
    process.env.ANNE_PROVIDER = 'DeepSeek';
    expect(resolveProvider('finalizer')).toBe('deepseek');
  });
});

describe('multi-provider LLM: resolveModel', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('ANNE_MODEL')) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it('usa modello di default per provider', () => {
    const model = resolveModel('deepseek', 'finalizer');
    expect(model).toBe('deepseek-chat');
  });

  it('ANNE_MODEL_{ROLE} sovrascrive default', () => {
    process.env.ANNE_MODEL_FINALIZER = 'deepseek-coder';
    const model = resolveModel('deepseek', 'finalizer');
    expect(model).toBe('deepseek-coder');
  });

  it('ANNE_MODEL_{DOMAIN}_{ROLE} sovrascrive role', () => {
    process.env.ANNE_MODEL_FINALIZER = 'deepseek-coder';
    process.env.ANNE_MODEL_QUOTE_FINALIZER = 'gemini-2.0-flash';
    const model = resolveModel('gemini', 'finalizer', 'quote');
    expect(model).toBe('gemini-2.0-flash');
  });

  it('anthropic default model', () => {
    const model = resolveModel('anthropic', 'finalizer');
    expect(model).toBe('claude-haiku-4-5-20251001');
  });

  it('gemini default model', () => {
    const model = resolveModel('gemini', 'request_manager');
    expect(model).toBe('gemini-2.0-flash');
  });
});

describe('multi-provider LLM: buildMultiProviderLlm', () => {
  it('esporta buildMultiProviderLlm come funzione', async () => {
    const { buildMultiProviderLlm } = await import('@/lib/agent/v2/multi-provider-llm');
    expect(typeof buildMultiProviderLlm).toBe('function');
  });

  it('il risultato implementa AnneRoleLlm (ha metodo chat)', async () => {
    const { buildMultiProviderLlm } = await import('@/lib/agent/v2/multi-provider-llm');
    const llm = buildMultiProviderLlm();
    expect(typeof llm.chat).toBe('function');
  });
});
