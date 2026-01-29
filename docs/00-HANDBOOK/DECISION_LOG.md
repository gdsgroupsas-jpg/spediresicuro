---
title: Decision Log
scope: process
audience: all
owner: engineering
status: active
source_of_truth: true
updated: 2026-01-29
---

# Decision Log

Record structural and process decisions for fast AI retrieval.

## 2026-01-19 - Consolidate tests under tests/

- Decision: move all tests, e2e, and test scripts into tests/.
- Rationale: single root improves discoverability and automation.
- Impact: updated config paths and doc references.

## 2026-01-19 - Create handbook hub and process flow

- Decision: create docs/00-HANDBOOK as the canonical process hub.
- Rationale: single entry point for rules, workflows, testing, and skills.
- Impact: new index files, AI process flow added.

## 2026-01-28 - Shipment Wizard Improvements

- Decision: Multiple improvements to shipment creation wizard
- Changes:
  1. **Step order**: Mittente → Destinatario → Colli → Corriere → Servizi → Ritiro → Conferma
  2. **Carrier normalization**: POSTEDELIVERYBUSINESS → POSTE, etc. (both in wizard and legacy payload converter)
  3. **Auto PDF download**: Automatic label download after successful shipment creation
  4. **Email validation**: Accept empty strings in recipient email (optional field)
  5. **CarrierStep API format**: Fixed request format to match /api/quotes/db expectations
- Rationale: Improve UX flow, fix validation errors, ensure carrier codes match API enum
- Impact: ShipmentWizard.tsx, ShipmentWizardContext.tsx, CarrierStep.tsx, convert-legacy-payload.ts, shipment.ts validation
- Tests: Existing tests cover carrier normalization (convert-legacy-payload.test.ts)

## 2026-01-28 - Wallet Logic Refactor

- Decision: Simplify wallet debit logic
- Before: Block estimated cost (final_price × 1.10) → Create shipment → Adjust with conguaglio
- After: Verify balance >= final_price → Create shipment → Debit final_price (no conguaglio)
- Rationale:
  1. Single transaction instead of block+adjustment
  2. User pays exactly what they see in quote
  3. Margin guaranteed by price list, not by API response
  4. BYOC pays only platform_fee (industry standard)
- Role-based logic:
  - SUPERADMIN: No wallet charge (internal testing)
  - BYOC: Charge only platform_fee (they pay courier directly)
  - RESELLER/USER: Charge final_price from their assigned price list
- Status: PR #80 merged
- Impact: create-shipment-core.ts (removed ~50 lines of adjustment logic)
- Tests: Wallet smoke tests pass (zero-balance, idempotency, courier-fail, db-fail)

## 2026-01-29 - Per-Provider Financial Tracking

- Decision: Add `courier_config_id` to shipments + per-provider analytics dashboard
- Problem: No way to aggregate financial data by provider/API config (e.g. Prime vs SpeedGo)
- Changes:
  1. **Migration**: Added `courier_config_id` (uuid FK, nullable) to `shipments` table with partial index
  2. **Shipment creation**: `getCourierClientReal()` result now passes `configId` through to insert
  3. **Dashboard**: New "Margine per Fornitore" chart in Analytics tab (same pattern as MarginByCourierChart)
  4. **Action**: `getMarginByProviderAction()` aggregates shipments by `courier_config_id` with JOIN to `courier_configs`
- Architecture:
  - `courier_config_id` is optional (nullable) - legacy shipments have NULL
  - No RLS added: system uses `supabaseAdmin` (service_role) throughout; RLS would have no effect
  - Tenant isolation enforced at application layer via `getCourierClientReal()` ownership checks
  - Query limited to 50k rows for performance safety
- Impact: migration, route.ts, create-shipment-core.ts, platform-costs.ts, financial dashboard page
- Tests: TypeScript build clean, smoke tests compile without errors (field is optional)
