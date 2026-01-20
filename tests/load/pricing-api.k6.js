/**
 * Load test for Pricing API
 *
 * Run: k6 run tests/load/pricing-api.k6.js
 *
 * Scenarios:
 * - Smoke test: 10 VUs for 30s
 * - Load test: 50 VUs for 5min
 * - Stress test: Ramp up to 100 VUs
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const pricingDuration = new Trend('pricing_duration');

// Test configuration
export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      tags: { test_type: 'smoke' },
    },
    load: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      startTime: '30s',
      tags: { test_type: 'load' },
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '3m', target: 100 },
        { duration: '2m', target: 150 },
        { duration: '3m', target: 0 },
      ],
      startTime: '5m30s',
      tags: { test_type: 'stress' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'], // Error rate < 1%
    errors: ['rate<0.05'], // Business errors < 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://spediresicuro.vercel.app';
const API_KEY = __ENV.API_KEY || 'test_key';

export default function () {
  const payload = JSON.stringify({
    weight: Math.random() * 20 + 1, // 1-21 kg
    dimensions: {
      length: 30,
      width: 20,
      height: 10,
    },
    origin: {
      country: 'IT',
      zip: '20100',
    },
    destination: {
      country: 'IT',
      zip: getRandomZip(),
    },
    serviceType: Math.random() > 0.5 ? 'standard' : 'express',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    tags: { endpoint: 'pricing_quote' },
  };

  const response = http.post(`${BASE_URL}/api/pricing/quote`, payload, params);

  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has quoteId': (r) => {
      try {
        return JSON.parse(r.body).quoteId !== undefined;
      } catch {
        return false;
      }
    },
    'has prices array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.prices) && body.prices.length > 0;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  pricingDuration.add(response.timings.duration);

  sleep(1); // Think time between requests
}

function getRandomZip() {
  const zips = [
    '00100', // Roma
    '20100', // Milano
    '10100', // Torino
    '50100', // Firenze
    '40100', // Bologna
    '80100', // Napoli
    '90100', // Palermo
  ];
  return zips[Math.floor(Math.random() * zips.length)];
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, opts = {}) {
  const { indent = '', enableColors = false } = opts;

  let output = `\n${indent}Load Test Summary\n${indent}=================\n\n`;

  // Scenarios
  output += `${indent}Scenarios:\n`;
  for (const [name, scenario] of Object.entries(data.metrics.scenarios || {})) {
    output += `${indent}  ${name}: ${scenario.values.iterations} iterations\n`;
  }

  // HTTP metrics
  output += `\n${indent}HTTP Metrics:\n`;
  const reqDuration = data.metrics.http_req_duration;
  if (reqDuration) {
    output += `${indent}  Duration (avg): ${reqDuration.values.avg.toFixed(2)}ms\n`;
    output += `${indent}  Duration (p95): ${reqDuration.values['p(95)'].toFixed(2)}ms\n`;
    output += `${indent}  Duration (p99): ${reqDuration.values['p(99)'].toFixed(2)}ms\n`;
  }

  const reqFailed = data.metrics.http_req_failed;
  if (reqFailed) {
    output += `${indent}  Failed rate: ${(reqFailed.values.rate * 100).toFixed(2)}%\n`;
  }

  // Custom metrics
  if (data.metrics.errors) {
    output += `\n${indent}Custom Metrics:\n`;
    output += `${indent}  Error rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%\n`;
  }

  return output;
}
