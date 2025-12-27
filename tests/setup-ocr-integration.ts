/**
 * Setup per Integration Test OCR Vision
 * 
 * Mocka:
 * - Supabase (non serve per test Vision)
 * - Database (non serve per test Vision)
 * 
 * NON mocka:
 * - LangChain / Gemini (test reali)
 * - extractData (test reali)
 * 
 * ⚠️ Richiede GOOGLE_API_KEY reale per eseguire i test
 */

// Carica .env.local PRIMA di tutto
import * as dotenv from 'dotenv';
import path from 'path';

// Carica variabili da .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { vi, beforeAll, afterAll } from 'vitest';

// ==================== CHECK API KEY ====================
// Questo check viene eseguito all'import time

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
  console.warn('\n⚠️ ========================================');
  console.warn('   GOOGLE_API_KEY non trovata');
  console.warn('   Integration test OCR Vision saranno SKIPPED');
  console.warn('   Per eseguire: imposta GOOGLE_API_KEY in .env.local');
  console.warn('==========================================\n');
}

// ==================== MOCK ENV VARIABLES (solo Supabase) ====================
// Previene errori da moduli che leggono Supabase env
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key';

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
  getSupabaseUserIdFromEmail: vi.fn().mockResolvedValue('mock-user-id'),
  getSpedizioni: vi.fn().mockResolvedValue([]),
  updateSpedizione: vi.fn().mockResolvedValue(true),
  deleteSpedizione: vi.fn().mockResolvedValue(true),
}));

// ==================== MOCK CORRIERI PERFORMANCE ====================
vi.mock('@/lib/corrieri-performance', () => ({
  analyzeCorrieriPerformance: vi.fn().mockResolvedValue([]),
  getCorrieriPerformance: vi.fn().mockResolvedValue([]),
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

// ==================== EXPORT HELPER ====================
export const hasGoogleApiKey = !!GOOGLE_API_KEY;

// ==================== TEST LIFECYCLE ====================
beforeAll(() => {
  if (!hasGoogleApiKey) {
    console.log('⏭️ Skipping integration tests: GOOGLE_API_KEY missing');
  }
});

afterAll(() => {
  vi.restoreAllMocks();
});

