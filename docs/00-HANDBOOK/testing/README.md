---
title: Testing Catalog
scope: testing
audience: engineering
owner: engineering
status: active
source_of_truth: true
updated: 2026-01-19
---

# Testing Catalog

This document describes every test area and where it lives. All tests now live under the single root folder: tests/.

## Test Structure

- tests/unit: unit tests (Vitest)
- tests/integration: integration tests (Vitest)
- tests/regression: regression tests (Vitest)
- tests/security: security tests (Vitest)
- tests/pricing: pricing-specific tests (Vitest)
- tests/e2e: end-to-end tests (Playwright)
- tests/scripts: manual and scripted tests (ts-node/node/sql)
- tests/automation-service: automation service diagnostics

<a id="testing-quickstart"></a>

## Testing Quickstart

Use these first:

- npm run test:unit (fast, local logic)
- npm run test:integration (API + data flows)
- npm run test:e2e (full UI flows)

If you changed a specific area, add or update a test in the matching folder before running the suite.

## Unit Tests (Vitest)

Location: tests/unit
Purpose: pure logic validation for helpers, pricing, workers, security logic, and domain utilities.
Run:

- npm run test:unit

## Integration Tests (Vitest)

Location: tests/integration
Purpose: multi-component and data flow validation, including OCR, booking, pricing, API routes, and webhook behavior.
Run:

- npm run test:integration

## Regression Tests (Vitest)

Location: tests/regression
Purpose: backward compatibility and known bug regressions.
Run:

- npm run test:vat:regression

## Security Tests (Vitest)

Location: tests/security
Purpose: RLS policies, RPC permissions, audit fixes, and tenant isolation.
Run:

- npm test (or specific file with vitest run)

## Pricing Tests (Vitest)

Location: tests/pricing
Purpose: VAT semantics, margins, and pricing matrix validation.
Run:

- npm run test:vat

## E2E Tests (Playwright)

Location: tests/e2e
Purpose: full user flows through the UI, including payments, listini, shipments, and admin.
Run:

- npm run test:e2e

## Scripted Tests

Location: tests/scripts
Purpose: manual or targeted verification for API, sync, wallet, onboarding, and data correctness.

Grouped by intent:

- Smoke tests: tests/scripts/smoke-test-\*.ts, tests/scripts/smoke-test-ci.js
- Sync tests: tests/scripts/test-sync-\*.ts
- Wallet tests: tests/scripts/test-wallet-\*.ts, tests/scripts/smoke-wallet.ts
- Onboarding flow tests: tests/scripts/test-onboarding-flow.ts, tests/scripts/test-complete-onboarding-flow.ts
- API and provider tests: tests/scripts/test-poste-_.{ts,mjs,js}, tests/scripts/test-api-_.ts
- Multi-account tests: tests/scripts/test-factory-multi-account.ts, tests/scripts/test-multi-contract-\*.ts
- OCR and GDPR checks: tests/scripts/test-p0.3-ocr-gdpr-compliance.sql
- Compensation queue and idempotency SQL checks: tests/scripts/test-p0.\*.sql
- Validation SQL: tests/scripts/test-_-_.sql, tests/scripts/test-\*-columns.sql

Run examples:

- ts-node --project tsconfig.scripts.json tests/scripts/test-poste-api.ts
- ts-node --project tsconfig.scripts.json tests/scripts/smoke-test-supabase.ts
- node tests/scripts/smoke-test-ci.js

## Automation Service Diagnostics

Location: tests/automation-service
Purpose: local diagnostics for automation workflows.
Run:

- tests/automation-service/test-diagnostics.ps1
- tests/automation-service/test-diagnostics.bat

## Related Docs

- docs/5-TESTING/STRATEGY.md
- docs/00-HANDBOOK/README.md
- TEST_INSTRUCTIONS.md
- docs/TEST_TYPES_EXPLAINED.md
- docs/00-HANDBOOK/testing/TASK_DOC_TEST_MAP.md
- docs/00-HANDBOOK/testing/ENV_REQUIREMENTS.md
