# Domain Map

## Core
- `@ss/core-types`: tipi base condivisi.
- `@ss/core-utils`: utility pure comuni.
- `@ss/core-db`: helper/adapter DB condivisi.

## Domain
- `@ss/domain-auth`
- `@ss/domain-workspace`
- `@ss/domain-wallet`
- `@ss/domain-pricing`
- `@ss/domain-shipments`
- `@ss/domain-couriers`
- `@ss/domain-crm`
- `@ss/domain-notifications`
- `@ss/domain-ai`

## Shared
- `@ss/ui-shared`
- `@ss/testing-shared`

## Cross-domain permits
- `domain-shipments -> domain-wallet, domain-pricing, domain-couriers, domain-workspace`
- `domain-pricing -> domain-couriers, domain-workspace`
- `domain-wallet -> domain-workspace`
- `domain-ai -> domain-wallet, domain-pricing, domain-shipments, domain-crm`
