/**
 * Test Anti-Regressione: Middleware Security
 * 
 * Verifica che:
 * 1. /api/cron/** (qualsiasi case) richiede CRON_SECRET → 401 senza Authorization
 * 2. Path traversal viene bloccato → 400
 * 3. Altre route non sono influenzate
 * 
 * ⚠️ IMPORTANTE: Questi test verificano il fix case-insensitive per /api/cron/**
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import type { NextRequest } from 'next/server';

// Import middleware function (Next.js middleware export)
// Usa dynamic import per compatibilità ES modules
let middleware: any;
beforeAll(async () => {
  const middlewareModule = await import('./middleware');
  // Next.js middleware è export default
  middleware = middlewareModule.default;
});

// Mock environment
const originalEnv = process.env;

/**
 * Setup test environment
 */
function setupTestEnv(cronSecret?: string) {
  process.env = {
    ...originalEnv,
    CRON_SECRET_TOKEN: cronSecret || 'test-secret-token-12345',
  };
}

/**
 * Cleanup test environment
 */
function cleanupTestEnv() {
  process.env = originalEnv;
}

/**
 * Crea mock NextRequest
 */
function createMockRequest(pathname: string, authHeader?: string): NextRequest {
  const url = new URL(`https://spediresicuro.vercel.app${pathname}`);
  const headers = new Headers();
  if (authHeader) {
    headers.set('authorization', authHeader);
  }
  
  // Mock NextRequest con struttura completa
  return {
    nextUrl: {
      pathname,
      href: url.href,
      search: '',
      searchParams: new URLSearchParams(),
    },
    headers,
    method: 'GET',
    url: url.href,
  } as unknown as NextRequest;
}

describe('Middleware Security', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(() => {
    cleanupTestEnv();
  });

  it('should return 401 for /api/cron/x without Authorization', async () => {
    const request = createMockRequest('/api/cron/automation-sync');
    const response = await middleware(request);
    
    expect(response.status).toBe(401);
  });

  it('should return 401 for /api/Cron/x without Authorization (case variant 1)', async () => {
    const request = createMockRequest('/api/Cron/automation-sync');
    const response = await middleware(request);
    
    expect(response.status).toBe(401);
  });

  it('should return 401 for /API/CRON/x without Authorization (case variant 2)', async () => {
    const request = createMockRequest('/API/CRON/automation-sync');
    const response = await middleware(request);
    
    expect(response.status).toBe(401);
  });

  it('should pass through /api/cron/x with valid Authorization', async () => {
    setupTestEnv('test-secret-valid');
    const request = createMockRequest(
      '/api/cron/automation-sync',
      'Bearer test-secret-valid'
    );
    const response = await middleware(request);
    
    // NextResponse.next() dovrebbe avere status undefined o 200
    // Verifichiamo che non sia 401
    expect(response.status).not.toBe(401);
  });

  it('should return 400 for path traversal /api/../dashboard', async () => {
    const request = createMockRequest('/api/../dashboard');
    const response = await middleware(request);
    
    expect(response.status).toBe(400);
  });

  it('should pass through other routes like /api/spedizioni', async () => {
    const request = createMockRequest('/api/spedizioni');
    const response = await middleware(request);
    
    // Non dovrebbe essere 401 (cron check) o 400 (path traversal)
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(400);
  });
});

