---
title: Task Doc Test Map
scope: testing
audience: engineering
owner: engineering
status: active
source_of_truth: true
updated: 2026-01-19
---

# Task, Doc, Test Map

Use this table to jump from a task to its canonical doc and tests.

| Area        | Canonical Doc                          | Tests                                                                                                                                                                                                                                        | Notes                             |
| ----------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Wallet      | docs/11-FEATURES/WALLET.md             | tests/unit/_wallet_.test.*, tests/integration/*wallet*.test.*                                                                                                                                                                                | Payment flows and balance rules   |
| Shipments   | docs/11-FEATURES/SHIPMENTS.md          | tests/integration/shipment-_.test.ts, tests/e2e/shipments-_.spec.ts                                                                                                                                                                          | End-to-end flows                  |
| Price Lists | docs/11-FEATURES/PRICE_LISTS.md        | tests/unit/price-_.test._, tests/integration/spedisci-online-price-lists-sync.test.ts                                                                                                                                                        | Sync and pricing                  |
| AI Anne     | docs/10-AI-AGENT/OVERVIEW.md           | tests/unit/_ocr_.test._, tests/integration/ocr-_.test.ts                                                                                                                                                                                     | OCR and AI flows                  |
| Auth/RLS    | docs/8-SECURITY/OVERVIEW.md            | tests/security/\*.test.ts, tests/integration/rls-policies.test.ts                                                                                                                                                                            | Access control                    |
| Payments    | docs/3-API/WEBHOOKS.md                 | tests/integration/stripe-webhook.test.ts, tests/e2e/stripe-payment.spec.ts                                                                                                                                                                   | Stripe flows                      |
| Reseller    | docs/11-FEATURES/RESELLER_HIERARCHY.md | tests/e2e/reseller-price-lists.spec.ts                                                                                                                                                                                                       | Reseller flows                    |
| Address     | docs/11-FEATURES/ADDRESS_VALIDATION.md | tests/unit/italian-postal-data.test.ts, tests/unit/classify-address.test.ts, tests/unit/normalize-it-address-postal.test.ts, tests/unit/places-cache.test.ts, tests/unit/google-places-adapter.test.ts, tests/integration/address-\*.test.ts | Address validation & autocomplete |
| COD         | docs/11-FEATURES/COD_MANAGEMENT.md     | tests/unit/cod-parser-generic.test.ts                                                                                                                                                                                                        | Cash on Delivery management       |
