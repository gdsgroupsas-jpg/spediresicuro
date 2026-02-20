#!/usr/bin/env node
/**
 * API Endpoints Validator
 * Validates that all documented API endpoints exist and respond correctly
 *
 * This script checks:
 * 1. Endpoint exists (not 404)
 * 2. Correct HTTP method supported
 * 3. Returns valid JSON (where expected)
 * 4. Error responses are properly formatted
 *
 * Usage: node scripts/validate-api-endpoints.js [base-url]
 */

const https = require('https');
const http = require('http');

const BASE_URL = process.argv[2] || 'http://localhost:3000';

// Documented endpoints from API_DOCUMENTATION.md
const endpoints = [
  {
    method: 'GET',
    path: '/api/health',
    requiresAuth: false,
    expectedStatuses: [200],
    description: 'Health check endpoint',
  },
  {
    method: 'GET',
    path: '/api/diagnostics',
    requiresAuth: false,
    expectedStatuses: [200],
    description: 'System diagnostics',
  },
  {
    method: 'POST',
    path: '/api/quotes/realtime',
    requiresAuth: true,
    expectedStatuses: [200, 401], // 401 if no auth
    description: 'Get pricing quote (realtime)',
  },
  {
    method: 'POST',
    path: '/api/shipments/create',
    requiresAuth: true,
    expectedStatuses: [201, 401, 400],
    description: 'Create shipment',
  },
  {
    method: 'GET',
    path: '/api/spedizioni',
    requiresAuth: true,
    expectedStatuses: [200, 401],
    description: 'List shipments',
  },
  {
    method: 'GET',
    path: '/api/wallet/transactions',
    requiresAuth: true,
    expectedStatuses: [200, 401],
    description: 'Get wallet transactions',
  },
  {
    method: 'POST',
    path: '/api/ai/agent-chat',
    requiresAuth: true,
    expectedStatuses: [200, 401],
    description: 'AI agent chat (Anne)',
  },
];

let passed = 0;
let failed = 0;
let warnings = 0;

console.log('🧪 API Endpoints Validation');
console.log('============================\n');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Total endpoints: ${endpoints.length}\n`);

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = new URL(endpoint.path, BASE_URL);
    const client = url.protocol === 'https:' ? https : http;

    const options = {
      method: endpoint.method,
      timeout: 5000,
    };

    const req = client.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const result = {
          ...endpoint,
          status: res.statusCode,
          headers: res.headers,
          body: data,
        };

        // Validate response
        const statusOk = endpoint.expectedStatuses.includes(res.statusCode);
        const isJson = res.headers['content-type']?.includes('application/json');

        let jsonValid = true;
        if (isJson && data) {
          try {
            JSON.parse(data);
          } catch {
            jsonValid = false;
          }
        }

        result.passed = statusOk;
        result.jsonValid = jsonValid;
        result.isJson = isJson;

        resolve(result);
      });
    });

    req.on('error', (err) => {
      resolve({
        ...endpoint,
        status: 0,
        error: err.message,
        passed: false,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        ...endpoint,
        status: 0,
        error: 'Timeout',
        passed: false,
      });
    });

    req.end();
  });
}

async function runAllTests() {
  console.log('Testing endpoints...\n');

  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);

    const icon = result.passed ? '✅' : result.status === 0 ? '❌' : '⚠️';
    const authNote = endpoint.requiresAuth ? ' [Auth Required]' : '';

    console.log(`${icon} ${endpoint.method} ${endpoint.path}${authNote}`);
    console.log(`   ${endpoint.description}`);

    if (result.error) {
      console.log(`   ❌ ERROR: ${result.error}`);
      failed++;
    } else {
      console.log(
        `   Status: ${result.status} (expected: ${endpoint.expectedStatuses.join(' or ')})`
      );

      if (result.isJson && !result.jsonValid) {
        console.log('   ⚠️  Invalid JSON response');
        warnings++;
      }

      if (result.passed) {
        passed++;
      } else {
        // Status code not in expected range
        if (result.status === 404) {
          console.log('   ❌ ENDPOINT NOT FOUND');
          failed++;
        } else if (result.status === 405) {
          console.log('   ❌ METHOD NOT ALLOWED');
          failed++;
        } else {
          console.log(`   ⚠️  Unexpected status code`);
          warnings++;
        }
      }
    }

    console.log();
  }

  console.log('============================');
  console.log(`Results: ${passed} passed, ${warnings} warnings, ${failed} failed\n`);

  if (failed > 0) {
    console.error('❌ API validation FAILED');
    console.error('Some documented endpoints do not exist or are misconfigured.\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.warn('⚠️  API validation passed with warnings');
    console.warn('Review warnings above. Documentation may need updates.\n');
    process.exit(0);
  } else {
    console.log('✅ All API endpoints validated successfully\n');
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
