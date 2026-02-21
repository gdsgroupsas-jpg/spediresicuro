#!/usr/bin/env node
/**
 * API Smoke Test
 * Quick validation of critical endpoints without k6
 *
 * Usage: node scripts/smoke-test-api.js [base-url]
 * Example: node scripts/smoke-test-api.js https://spediresicuro.vercel.app
 */

const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const TIMEOUT_MS = 15000;

const tests = [
  {
    name: 'Health Live',
    path: '/api/health/live',
    method: 'GET',
    expectedStatus: 200,
    maxDuration: 12000,
  },
  {
    name: 'Health Ready',
    path: '/api/health/ready',
    method: 'GET',
    expectedStatus: 200,
    maxDuration: 7000,
  },
  {
    name: 'Health Dependencies',
    path: '/api/health/dependencies',
    method: 'GET',
    expectedStatus: 200,
    maxDuration: 9000,
  },
];

let passed = 0;
let failed = 0;

console.log('🧪 API Smoke Test');
console.log('==================\n');
console.log(`Base URL: ${BASE_URL}\n`);

async function runTest(test) {
  const start = performance.now();

  return new Promise((resolve) => {
    const url = new URL(test.path, BASE_URL);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(
      url,
      {
        method: test.method,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const duration = performance.now() - start;
          const result = {
            name: test.name,
            status: res.statusCode,
            duration: Math.round(duration),
            expectedStatus: test.expectedStatus,
            maxDuration: test.maxDuration,
            passed: res.statusCode === test.expectedStatus && duration < test.maxDuration,
          };
          resolve(result);
        });
      }
    );

    req.on('error', (err) => {
      const duration = performance.now() - start;
      resolve({
        name: test.name,
        status: 0,
        duration: Math.round(duration),
        expectedStatus: test.expectedStatus,
        maxDuration: test.maxDuration,
        error: err.message,
        passed: false,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        name: test.name,
        status: 0,
        duration: TIMEOUT_MS,
        expectedStatus: test.expectedStatus,
        maxDuration: test.maxDuration,
        error: 'Timeout',
        passed: false,
      });
    });

    req.end();
  });
}

async function runAllTests() {
  for (const test of tests) {
    const result = await runTest(test);

    const statusIcon = result.passed ? '✅' : '❌';
    const statusText = result.error ? `ERROR: ${result.error}` : `${result.status}`;
    const durationText = `${result.duration}ms`;
    const maxText = result.maxDuration ? ` (max: ${result.maxDuration}ms)` : '';

    console.log(`${statusIcon} ${result.name}`);
    console.log(`   Status: ${statusText} (expected: ${result.expectedStatus})`);
    console.log(`   Duration: ${durationText}${maxText}`);
    console.log();

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('==================');
  console.log(`Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.error('❌ Smoke test FAILED');
    process.exit(1);
  } else {
    console.log('✅ All smoke tests PASSED');
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
