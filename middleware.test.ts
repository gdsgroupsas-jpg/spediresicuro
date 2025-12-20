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

import { NextRequest, NextResponse } from 'next/server';

// Import middleware function (Next.js middleware export)
// Usa require per evitare problemi con ES modules
const middlewareModule = require('./middleware');
const middleware = middlewareModule.middleware;

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

/**
 * Test 1: /api/cron/x senza Authorization → 401
 */
export async function testCronWithoutAuth(): Promise<boolean> {
  console.log('🧪 [TEST] /api/cron/x senza Authorization → 401');
  
  try {
    setupTestEnv();
    const request = createMockRequest('/api/cron/automation-sync');
    const response = await middleware(request);
    
    if (response.status === 401) {
      console.log('  ✅ PASS: 401 Unauthorized');
      return true;
    } else {
      console.log(`  ❌ FAIL: Expected 401, got ${response.status}`);
      return false;
    }
  } catch (error: any) {
    console.log(`  ❌ FAIL: Error: ${error.message}`);
    return false;
  } finally {
    cleanupTestEnv();
  }
}

/**
 * Test 2: /api/Cron/x senza Authorization → 401 (case variant)
 */
export async function testCronCaseVariant1(): Promise<boolean> {
  console.log('🧪 [TEST] /api/Cron/x senza Authorization → 401');
  
  try {
    setupTestEnv();
    const request = createMockRequest('/api/Cron/automation-sync');
    const response = await middleware(request);
    
    if (response.status === 401) {
      console.log('  ✅ PASS: 401 Unauthorized');
      return true;
    } else {
      console.log(`  ❌ FAIL: Expected 401, got ${response.status}`);
      return false;
    }
  } catch (error: any) {
    console.log(`  ❌ FAIL: Error: ${error.message}`);
    return false;
  } finally {
    cleanupTestEnv();
  }
}

/**
 * Test 3: /API/CRON/x senza Authorization → 401 (case variant)
 */
export async function testCronCaseVariant2(): Promise<boolean> {
  console.log('🧪 [TEST] /API/CRON/x senza Authorization → 401');
  
  try {
    setupTestEnv();
    const request = createMockRequest('/API/CRON/automation-sync');
    const response = await middleware(request);
    
    if (response.status === 401) {
      console.log('  ✅ PASS: 401 Unauthorized');
      return true;
    } else {
      console.log(`  ❌ FAIL: Expected 401, got ${response.status}`);
      return false;
    }
  } catch (error: any) {
    console.log(`  ❌ FAIL: Error: ${error.message}`);
    return false;
  } finally {
    cleanupTestEnv();
  }
}

/**
 * Test 4: /api/cron/x con Authorization corretta → 200 (pass-through)
 */
export async function testCronWithValidAuth(): Promise<boolean> {
  console.log('🧪 [TEST] /api/cron/x con Authorization corretta → 200');
  
  try {
    setupTestEnv('test-secret-valid');
    const request = createMockRequest(
      '/api/cron/automation-sync',
      'Bearer test-secret-valid'
    );
    const response = await middleware(request);
    
    // NextResponse.next() dovrebbe avere status undefined o 200
    // Verifichiamo che non sia 401
    if (response.status !== 401) {
      console.log('  ✅ PASS: Request passa (non 401)');
      return true;
    } else {
      console.log(`  ❌ FAIL: Expected pass-through, got 401`);
      return false;
    }
  } catch (error: any) {
    console.log(`  ❌ FAIL: Error: ${error.message}`);
    return false;
  } finally {
    cleanupTestEnv();
  }
}

/**
 * Test 5: Path traversal /api/../dashboard → 400
 */
export async function testPathTraversal(): Promise<boolean> {
  console.log('🧪 [TEST] Path traversal /api/../dashboard → 400');
  
  try {
    setupTestEnv();
    const request = createMockRequest('/api/../dashboard');
    const response = await middleware(request);
    
    if (response.status === 400) {
      console.log('  ✅ PASS: 400 Bad Request');
      return true;
    } else {
      console.log(`  ❌ FAIL: Expected 400, got ${response.status}`);
      return false;
    }
  } catch (error: any) {
    console.log(`  ❌ FAIL: Error: ${error.message}`);
    return false;
  } finally {
    cleanupTestEnv();
  }
}

/**
 * Test 6: Altre route /api/spedizioni non protette da cron → pass-through
 */
export async function testOtherApiRoutes(): Promise<boolean> {
  console.log('🧪 [TEST] Altre route /api/spedizioni → pass-through');
  
  try {
    setupTestEnv();
    const request = createMockRequest('/api/spedizioni');
    const response = await middleware(request);
    
    // Non dovrebbe essere 401 (cron check) o 400 (path traversal)
    if (response.status !== 401 && response.status !== 400) {
      console.log('  ✅ PASS: Route non protetta da cron (pass-through)');
      return true;
    } else {
      console.log(`  ❌ FAIL: Expected pass-through, got ${response.status}`);
      return false;
    }
  } catch (error: any) {
    console.log(`  ❌ FAIL: Error: ${error.message}`);
    return false;
  } finally {
    cleanupTestEnv();
  }
}

/**
 * Esegui tutti i test
 */
export async function runAllTests(): Promise<void> {
  console.log('🔒 Middleware Security Tests\n');
  console.log('='.repeat(50));
  console.log('');

  const tests = [
    { name: 'Cron senza auth', fn: testCronWithoutAuth },
    { name: 'Cron case variant 1', fn: testCronCaseVariant1 },
    { name: 'Cron case variant 2', fn: testCronCaseVariant2 },
    { name: 'Cron con auth valida', fn: testCronWithValidAuth },
    { name: 'Path traversal', fn: testPathTraversal },
    { name: 'Altre route API', fn: testOtherApiRoutes },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await test.fn();
    if (result) {
      passed++;
    } else {
      failed++;
    }
    console.log('');
  }

  console.log('='.repeat(50));
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
  console.log('');

  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}



