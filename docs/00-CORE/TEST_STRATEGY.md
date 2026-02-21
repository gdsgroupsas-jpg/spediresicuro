# Test Strategy

## Goals
- Zero regressioni su API HTTP e behavior business.
- Conservare invarianti wallet/pricing/multi-tenant.

## Baseline Gates
- `npm run type-check` deve passare.
- `npm run test:unit` deve passare.

## Domain Gates
- Wallet: `npm run test:wallet`
- Pricing: `npm run test:pricing`
- Shipments: `npm run test:shipments`

## Architecture Gates
- `npm run check:boundaries`
- `npm run check:file-size`

## Note
I check boundary e file-size sono in warning mode nella fase iniziale di migrazione.
