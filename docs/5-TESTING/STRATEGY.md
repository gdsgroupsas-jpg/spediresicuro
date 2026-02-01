# Testing Strategy

## Overview

Strategia completa di testing per SpedireSicuro, incluse unit tests, integration tests, E2E tests e best practices.

## Target Audience

- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents

## Prerequisites

- Node.js 18+
- Conoscenza Vitest, Playwright
- Familiarità con testing concepts

---

## Testing Pyramid

```
        /\
       /  \
      / E2E \        ← Few, Slow, Expensive
     /--------\
    /          \
   / Integration \  ← Some, Medium, Moderate
  /----------------\
 /                  \
/     Unit Tests     \  ← Many, Fast, Cheap
/----------------------\
```

### Unit Tests (Base)

- **Quantity:** Many
- **Speed:** Fast (< 30s)
- **Cost:** Low
- **Purpose:** Test logica isolata

### Integration Tests (Middle)

- **Quantity:** Some
- **Speed:** Medium (< 2min)
- **Cost:** Moderate
- **Purpose:** Test integrazione componenti

### E2E Tests (Top)

- **Quantity:** Few
- **Speed:** Slow (< 10min)
- **Cost:** High
- **Purpose:** Test flussi utente completi

---

## Test Types

### 1. Unit Tests

**Framework:** Vitest  
**Location:** `tests/unit/`  
**Command:** `npm run test:unit`

**Purpose:**

- Test logica business isolata
- Test utility functions
- Test validators
- Test helpers

**Example:**

```typescript
// tests/unit/wallet.test.ts
import { calculateWalletBalance } from '@/lib/wallet/calculations';

describe('Wallet Calculations', () => {
  it('should calculate balance correctly', () => {
    const transactions = [
      { type: 'credit', amount: 100 },
      { type: 'debit', amount: 50 },
    ];
    const balance = calculateWalletBalance(transactions);
    expect(balance).toBe(50);
  });
});
```

**Coverage Focus:**

- Business logic
- Security validations
- Data transformations

---

### 2. Integration Tests

**Framework:** Vitest  
**Location:** `tests/integration/`  
**Command:** `npm run test:integration`

**Purpose:**

- Test integrazione componenti
- Test API routes
- Test Server Actions
- Test database operations

**Example:**

```typescript
// tests/integration/shipments.test.ts
import { createShipment } from '@/actions/shipments';
import { supabaseAdmin } from '@/lib/db/client';

describe('Shipment Creation', () => {
  it('should create shipment and debit wallet', async () => {
    const result = await createShipment({
      recipient: {
        /* ... */
      },
      packages: [
        /* ... */
      ],
    });

    expect(result.success).toBe(true);

    // Verify database
    const { data } = await supabaseAdmin
      .from('shipments')
      .select('*')
      .eq('id', result.shipmentId)
      .single();

    expect(data).toBeDefined();
  });
});
```

**Coverage Focus:**

- API endpoints
- Database operations
- External API integrations

---

### 3. E2E Tests

**Framework:** Playwright  
**Location:** `tests/e2e/`  
**Command:** `npm run test:e2e`

**Purpose:**

- Test flussi utente completi
- Test UI interactions
- Test cross-browser compatibility

**Example:**

```typescript
// tests/e2e/shipment-creation.spec.ts
import { test, expect } from '@playwright/test';

test('user can create shipment', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Create shipment
  await page.goto('/dashboard/shipments/new');
  await page.fill('[name="recipient_name"]', 'Mario Rossi');
  // ... fill form
  await page.click('button:has-text("Crea Spedizione")');

  // Verify success
  await expect(page.locator('.success-message')).toBeVisible();
});
```

**Coverage Focus:**

- Critical user flows
- Payment flows
- Authentication flows

---

## Critical Test Areas

### Security Tests

**Priority: P0 - Critical**

**Tests:**

- Multi-tenant isolation
- RLS policies
- Encryption/decryption
- Authentication/Authorization
- Acting Context (impersonation)

**Example:**

```typescript
// tests/unit/security/multi-tenant.test.ts
it('should block access to other user data', async () => {
  const userA = await createTestUser('userA@test.com');
  const userB = await createTestUser('userB@test.com');

  const result = await getShipments(userA.id, userB.id);

  expect(result.success).toBe(false);
  expect(result.error).toContain('FORBIDDEN');
});
```

**Vedi:** [Security](../8-SECURITY/OVERVIEW.md)

---

### Business Logic Tests

**Priority: P0 - Critical**

**Tests:**

- Wallet debit/credit
- Shipment creation
- Price calculation
- Compensation queue

**Example:**

```typescript
// tests/integration/wallet.test.ts
it('should prevent negative balance', async () => {
  const user = await createTestUser();
  await rechargeWallet(user.id, 100);

  const result = await debitWallet(user.id, 150);

  expect(result.success).toBe(false);
  expect(result.error).toContain('WALLET_INSUFFICIENT');
});
```

---

### Integration Tests

**Priority: P1 - Important**

**Tests:**

- Courier API integrations
- Payment processing (Stripe)
- AI features (Gemini)
- Database operations

---

## Test Commands

### Run All Tests

```bash
npm test
```

### Unit Tests Only

```bash
npm run test:unit
```

### Integration Tests Only

```bash
npm run test:integration
```

### E2E Tests Only

```bash
npm run test:e2e
```

### E2E Tests (UI Mode)

```bash
npm run test:e2e:ui
```

### E2E Tests (Debug)

```bash
npm run test:e2e:debug
```

---

## CI/CD Integration

### GitHub Actions

**Workflow:** `.github/workflows/ci.yml`

**Steps:**

1. Run unit tests
2. Run integration tests
3. Type check
4. Build

**Workflow:** `.github/workflows/e2e-tests.yml`

**Steps:**

1. Build Next.js
2. Start server
3. Run E2E tests
4. Upload results

**Vedi:** [CI/CD](../6-DEPLOYMENT/CI_CD.md)

---

## Test Data Management

### Test Users

**Creation:**

```typescript
// tests/helpers/test-users.ts
export async function createTestUser(email: string) {
  // Create user in test database
  // Return user object
}
```

**Cleanup:**

```typescript
afterEach(async () => {
  await cleanupTestUsers();
});
```

---

### Mock External APIs

**Stripe:**

```typescript
// Mock Stripe webhook
vi.mock('@/lib/payments/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}));
```

**Courier APIs:**

```typescript
// Mock courier adapter
vi.mock('@/lib/adapters/couriers/spedisci-online', () => ({
  SpedisciOnlineAdapter: vi.fn(),
}));
```

---

## Best Practices

### 1. Test Isolation

**Each test should:**

- Be independent
- Not rely on other tests
- Clean up after itself

```typescript
beforeEach(async () => {
  // Setup
});

afterEach(async () => {
  // Cleanup
});
```

---

### 2. Deterministic Tests

**Avoid:**

- Random data
- Time-dependent logic
- External API calls (mock them)

**Use:**

- Fixed test data
- Mocked time
- Mocked external APIs

---

### 3. Fast Tests

**Optimize:**

- Use in-memory database for unit tests
- Mock external APIs
- Parallel test execution
- Skip unnecessary setup

---

### 4. Clear Test Names

**Good:**

```typescript
it('should prevent negative wallet balance', () => {
  // ...
});
```

**Bad:**

```typescript
it('test wallet', () => {
  // ...
});
```

---

## Coverage Goals

### Minimum Coverage

- **Unit Tests:** 80% business logic
- **Integration Tests:** 70% API endpoints
- **E2E Tests:** 100% critical flows

### Critical Paths (100% Coverage Required)

- Wallet operations
- Shipment creation
- Authentication/Authorization
- Security validations

---

## Anne Support System Tests

**Priority: P1 - Important**

Il sistema di supporto AI-native di Anne ha una suite dedicata di unit test che coprono le funzioni pure (non richiedono DB):

| Test File                           | Modulo testato                                       | # Test |
| ----------------------------------- | ---------------------------------------------------- | ------ |
| `tests/unit/case-learning.test.ts`  | `extractKeywords`, sanitizzazione PII, allowlist     | 15     |
| `tests/unit/support-rules.test.ts`  | Decision engine, `findMatchingRule`, `shouldConfirm` | 30     |
| `tests/unit/support-worker.test.ts` | `detectSupportIntent`, `detectConfirmation`          | 30     |

**Esecuzione:**

```bash
# Solo test supporto
npx vitest run tests/unit/case-learning.test.ts tests/unit/support-rules.test.ts tests/unit/support-worker.test.ts

# Tutti i unit test (include supporto)
npm run test:unit
```

**Cosa coprono:**

- **case-learning**: Verifica che `extractKeywords` rimuova PII (email, telefoni, CF, P.IVA, tracking numbers, CAP) e estragga solo parole di dominio logistico dall'allowlist
- **support-rules**: Verifica che il decision engine matchi correttamente le regole per giacenza (8 regole), cancellazione (3), rimborso (3), tracking (2), con corretta priorità e interpolazione messaggi
- **support-worker**: Verifica il rilevamento intent di supporto (tracking, giacenza, cancellazione, rimborso, problemi) e il rilevamento conferma/cancellazione utente

**Architettura:** Vedi [ANNE_SUPPORT_SYSTEM.md](../ANNE_SUPPORT_SYSTEM.md)

---

## Related Documentation

- [CI/CD](../6-DEPLOYMENT/CI_CD.md) - CI/CD integration
- [Security](../8-SECURITY/OVERVIEW.md) - Security testing
- [API](../3-API/OVERVIEW.md) - API testing

---

## Changelog

| Date       | Version | Changes                         | Author   |
| ---------- | ------- | ------------------------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version                 | Dev Team |
| 2026-02-02 | 1.1.0   | Added Anne Support System tests | Dev Team |

---

_Last Updated: 2026-01-12_  
_Status: 🟢 Active_  
_Maintainer: Dev Team_
