/**
 * Setup isolato per test OCR Vision
 *
 * Mocka TUTTI i moduli esterni per garantire:
 * - Nessuna chiamata di rete (Supabase, fetch, ecc.)
 * - Nessuna dipendenza da variabili d'ambiente
 * - Test completamente deterministici
 *
 * Ordine critico: i mock devono essere definiti PRIMA degli import
 */

import { vi } from 'vitest';

// ==================== MOCK ENV VARIABLES ====================
// Previene errori da moduli che leggono process.env all'import-time
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-key';
process.env.GOOGLE_API_KEY = 'mock-google-key';

// ==================== MOCK SUPABASE ====================
vi.mock('@/lib/supabase', () => ({
  supabase: null,
  supabaseAdmin: null,
  isSupabaseConfigured: () => false,
  getSupabaseClient: () => null,
}));

// ==================== MOCK DATABASE ====================
vi.mock('@/lib/database', () => ({
  addSpedizione: vi.fn().mockResolvedValue({ id: 'mock-id' }),
  getSupabaseUserIdFromEmail: vi.fn().mockResolvedValue(null),
  getSpedizioni: vi.fn().mockResolvedValue([]),
  updateSpedizione: vi.fn().mockResolvedValue(true),
  deleteSpedizione: vi.fn().mockResolvedValue(true),
}));

// ==================== MOCK ORCHESTRATOR NODES ====================
// Mocka extractData per evitare dipendenze LLM
vi.mock('@/lib/agent/orchestrator/nodes', () => ({
  extractData: vi.fn().mockResolvedValue({
    shipmentData: null,
    processingStatus: 'idle',
    validationErrors: [],
  }),
  analyzeCorrieriPerformance: vi.fn().mockResolvedValue([]),
}));

// ==================== MOCK CORRIERI PERFORMANCE ====================
vi.mock('@/lib/corrieri-performance', () => ({
  analyzeCorrieriPerformance: vi.fn().mockResolvedValue([]),
  getCorrieriPerformance: vi.fn().mockResolvedValue([]),
}));

// ==================== MOCK LANGCHAIN ====================
vi.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({ content: '' }),
    call: vi.fn().mockResolvedValue({ content: '' }),
  })),
}));

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({ content: '' }),
    bindTools: vi.fn().mockReturnThis(),
  })),
}));

// ==================== MOCK NEXT/SERVER ====================
vi.mock('next/server', () => {
  class NextRequest extends Request {}
  const NextResponse = {
    json: (body: unknown, init?: ResponseInit) => {
      const headers = new Headers(init?.headers);
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json; charset=utf-8');
      }
      return new Response(JSON.stringify(body), {
        ...init,
        status: init?.status ?? 200,
        headers,
      });
    },
    next: () => new Response(null, { status: 200 }),
  };
  return { NextRequest, NextResponse };
});

// ==================== MOCK GLOBAL FETCH ====================
// Previene chiamate di rete accidentali
const mockFetch = vi.fn().mockImplementation((url: string) => {
  console.warn(`[TEST MOCK] Fetch blocked: ${url}`);
  return Promise.resolve(new Response(JSON.stringify({ error: 'Mocked' }), { status: 200 }));
});

vi.stubGlobal('fetch', mockFetch);

// ==================== CLEANUP ====================
// Reset mock tra i test
import { beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
