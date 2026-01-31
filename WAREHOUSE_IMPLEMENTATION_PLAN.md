# 🎯 WAREHOUSE SYSTEM - Master Implementation Plan

> **Senior Dev Approach**: Nulla al caso. Tutto pianificato, testato, verificato.

---

## 📋 TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Pre-requisiti & Setup](#pre-requisiti--setup)
3. [Implementation Roadmap](#implementation-roadmap)
4. [Dependency Graph](#dependency-graph)
5. [Testing Strategy](#testing-strategy)
6. [Security Audit Checklist](#security-audit-checklist)
7. [Performance Benchmarks](#performance-benchmarks)
8. [Rollback Plan](#rollback-plan)
9. [Code Review Checklist](#code-review-checklist)
10. [Production Deployment](#production-deployment)

---

## 📊 Executive Summary

### Obiettivo

Implementare Warehouse System enterprise-grade (10/10) in **6 settimane** con zero downtime e zero bug critici in produzione.

### Metriche di Successo

- ✅ **0 critical bugs** in produzione
- ✅ **< 100ms** response time API (p95)
- ✅ **> 95%** test coverage
- ✅ **100%** security audit pass
- ✅ **< 1.5s** initial page load
- ✅ **0 regressions** su feature esistenti

### Team Required

- 1x Senior Full-Stack Dev (lead)
- 1x Backend Dev (database/API)
- 1x Frontend Dev (UI/UX)
- 1x QA Engineer (testing)
- 1x DevOps (deployment/monitoring)

---

## 🔧 Pre-requisiti & Setup

### 1.1 Environment Setup

```bash
# ============================================
# CRITICO: Eseguire PRIMA di qualsiasi codice
# ============================================

# 1. Clone repo & checkout feature branch
git checkout -b feature/warehouse-system-mvp
git pull origin master

# 2. Install dependencies (check lockfile!)
npm ci  # NON npm install (usa lockfile esatto)

# 3. Environment variables (critico!)
cp .env.example .env.local

# Aggiungi variabili warehouse:
# WAREHOUSE_FEATURE_ENABLED=false  # Toggle globale
# WAREHOUSE_MAX_SKUS_PER_WAREHOUSE=10000
# WAREHOUSE_AUDIT_RETENTION_DAYS=2555  # 7 anni (compliance)
# WAREHOUSE_ENABLE_OFFLINE_SYNC=true
# WAREHOUSE_SENTRY_DSN=...  # Monitoring separato

# 4. Database: crea branch staging
# IMPORTANTE: NON toccare production DB fino a deploy finale!
supabase db branch create staging-warehouse

# 5. Setup test database (isolato)
createdb spediresicuro_test
export DATABASE_URL_TEST=postgresql://localhost/spediresicuro_test

# 6. Setup Sentry project separato
# Project: spediresicuro-warehouse
# DSN: https://...@sentry.io/warehouse

# 7. Setup Redis (per feature flags/cache)
# Già presente: UPSTASH_REDIS_URL (riutilizza)

# 8. Pre-commit hooks
npm run prepare  # Installa husky
```

### 1.2 Code Standards Setup

```json
// eslint.config.warehouse.mjs (regole specifiche warehouse, ESLint 9 flat config)
// NOTE: The project now uses eslint.config.mjs (ESLint 9 flat config) instead of .eslintrc.json
{
  "extends": ["./eslint.config.mjs"],
  "rules": {
    "no-console": "error", // NO console.log in warehouse code
    "@typescript-eslint/no-explicit-any": "error", // NO any
    "@typescript-eslint/explicit-function-return-type": "warn",
    "complexity": ["error", 10], // Max cyclomatic complexity
    "max-lines-per-function": ["warn", 100],
    "max-depth": ["error", 3] // Max nesting depth
  }
}
```

```typescript
// vitest.config.warehouse.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: './tests/warehouse/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 80, // Min 80% coverage
      functions: 80,
      branches: 75,
      statements: 80,
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.spec.ts'],
    },
    testTimeout: 10000, // 10s max per test
  },
});
```

### 1.3 Documentation Templates

````markdown
// docs/warehouse/TEMPLATE_MIGRATION.md

# Migration: [numero]\_[nome_descrittivo].sql

## Purpose

[Descrizione scopo migration]

## Changes

- [ ] Tables created: [lista]
- [ ] Columns added: [lista]
- [ ] Indexes created: [lista]
- [ ] RLS policies: [lista]
- [ ] Functions/Triggers: [lista]

## Rollback

```sql
-- Script rollback completo
```
````

## Testing Checklist

- [ ] Migration runs without errors
- [ ] Rollback script tested
- [ ] RLS policies work correctly
- [ ] Performance: query < 100ms
- [ ] No breaking changes on existing tables

## Deployment Notes

[Note specifiche per deploy]

```

---

## 🗺️ Implementation Roadmap

### FASE 0: Foundation (Settimana 1)
**Goal**: Setup infrastruttura, nessun codice visibile all'utente

#### Sprint 0.1: Database Foundation
```

GIORNO 1-2: Core Schema
├─ migrations/115_warehouse_core_tables.sql
│ ├─ warehouses
│ ├─ product_categories
│ ├─ products
│ ├─ inventory_items
│ ├─ inventory_movements
│ └─ suppliers
├─ Indici ottimizzati (full-text search, GIN, BRIN)
├─ RLS policies multi-tenant
└─ Test: migrations up/down

GIORNO 3: RBAC Schema
├─ migrations/116_warehouse_rbac.sql
│ ├─ warehouse_roles
│ ├─ warehouse_user_roles
│ ├─ warehouse_permissions (view)
│ └─ RLS policies
└─ Seed: ruoli default (SUPERADMIN, MANAGER, etc.)

GIORNO 4: Audit & Compliance
├─ migrations/117_warehouse_audit_compliance.sql
│ ├─ warehouse_audit_log (partitioned by month)
│ ├─ warehouse_retention_policies
│ ├─ warehouse_approval_requests
│ └─ Functions: cleanup_expired_data()
└─ Test: audit immutability (prevent UPDATE/DELETE)

GIORNO 5: Feature Flags & Config
├─ migrations/118_warehouse_feature_flags.sql
│ ├─ warehouse_feature_flags
│ ├─ warehouse_business_config
│ ├─ inventory_batches (per lotti/scadenze)
│ └─ warehouse_ip_allowlist
└─ Seed: business templates (ecommerce, alimentare, etc.)

DELIVERABLES:
✅ 4 migrations testate (up/down)
✅ 100% RLS policies coperte
✅ Seed data per development
✅ Migration guide documentato
✅ Performance benchmark DB (<100ms queries)

```

**Acceptance Criteria**:
- [ ] Tutte le migrations eseguibili senza errori
- [ ] Rollback script testato per ogni migration
- [ ] RLS policies: test con 3 utenti diversi (SUPERADMIN, MANAGER, USER)
- [ ] Full-text search: < 50ms su 10K prodotti simulati
- [ ] Audit log: impossibile fare UPDATE/DELETE (test con errore atteso)
- [ ] Partitioning: 12 partizioni create (1 per mese)

---

### FASE 1: Backend Core (Settimana 2)
**Goal**: API funzionanti, ZERO UI

#### Sprint 1.1: Core Services
```

GIORNO 1-2: Permission Service
├─ lib/warehouse/rbac/
│ ├─ permission-checker.ts
│ │ ├─ checkPermission()
│ │ ├─ checkFieldPermission()
│ │ ├─ evaluateCondition()
│ │ └─ getUserRoles()
│ ├─ roles.ts (costanti ruoli)
│ └─ types.ts
├─ Test: 20+ test cases
│ ├─ Resource-level permissions
│ ├─ Field-level restrictions
│ ├─ Conditional permissions
│ ├─ Delega temporanea
│ └─ Edge cases (expired roles, null values)
└─ Performance: < 10ms permission check

GIORNO 3: Audit Service
├─ lib/warehouse/audit/
│ ├─ audit-service.ts
│ │ ├─ logAudit()
│ │ ├─ computeDiff()
│ │ ├─ exportAuditLog()
│ │ └─ sendAuditFailureAlert()
│ └─ types.ts
├─ Test: audit logging, export CSV/JSON
└─ Monitoring: alert se audit fails

GIORNO 4-5: Inventory Service
├─ lib/warehouse/inventory/
│ ├─ inventory-service.ts
│ │ ├─ createProduct()
│ │ ├─ updateStock()
│ │ ├─ decrementInventory()
│ │ ├─ transferStock()
│ │ ├─ adjustStock()
│ │ └─ getLowStockItems()
│ ├─ warehouse-service.ts
│ │ ├─ createWarehouse()
│ │ ├─ getWarehouseStats()
│ │ └─ archiveWarehouse()
│ └─ movement-service.ts
│ ├─ recordMovement()
│ ├─ getMovementHistory()
│ └─ exportMovements()
├─ Test: 30+ test cases
│ ├─ Stock operations (CRUD)
│ ├─ Atomic updates (race conditions)
│ ├─ Batch operations
│ ├─ Movement tracking
│ └─ Low stock detection
└─ Performance: bulk ops < 500ms (100 items)

DELIVERABLES:
✅ 3 core services con test >80% coverage
✅ Type-safe (NO any)
✅ Error handling completo
✅ JSDoc comments
✅ Integration tests con test DB

```

**Acceptance Criteria**:
- [ ] Permission check: < 10ms (p95)
- [ ] Audit log: 100% operazioni critiche loggate
- [ ] Inventory ops: atomic (no race conditions)
- [ ] Test coverage: > 80% per ogni service
- [ ] Zero `any` types
- [ ] Zero `console.log` (usa logger)

#### Sprint 1.2: API Routes
```

GIORNO 1-2: Warehouse APIs
├─ app/api/warehouses/
│ ├─ route.ts (GET list, POST create)
│ ├─ [id]/route.ts (GET detail, PATCH update, DELETE)
│ ├─ [id]/stats/route.ts (GET analytics)
│ └─ [id]/settings/route.ts (PATCH config)
├─ Middleware:
│ ├─ RBAC check (every route)
│ ├─ Rate limiting (100 req/min)
│ ├─ Request validation (Zod)
│ └─ Correlation ID injection
├─ Test: API integration tests
│ ├─ Happy path
│ ├─ Unauthorized (403)
│ ├─ Not found (404)
│ ├─ Validation errors (400)
│ └─ Rate limiting (429)
└─ Performance: < 100ms response time

GIORNO 3-4: Inventory APIs
├─ app/api/warehouses/[id]/inventory/
│ ├─ route.ts (GET list paginated, POST create)
│ ├─ [productId]/route.ts (GET, PATCH, DELETE)
│ ├─ bulk/route.ts (POST bulk operations)
│ ├─ import/route.ts (POST CSV import)
│ └─ export/route.ts (GET CSV/JSON export)
├─ Query optimization:
│ ├─ Cursor pagination (NOT offset)
│ ├─ Full-text search (PostgreSQL)
│ ├─ Field projection (select only needed)
│ └─ Caching (Redis, 5 min TTL)
├─ Test: API + performance tests
└─ Performance: < 50ms list (p50), < 200ms (p95)

GIORNO 5: Movement APIs
├─ app/api/warehouses/[id]/movements/
│ ├─ route.ts (GET history, POST create)
│ ├─ [movementId]/route.ts (GET detail)
│ └─ export/route.ts (GET export)
├─ Real-time: WebSocket per live updates
└─ Test: movement tracking accuracy

DELIVERABLES:
✅ 15+ API endpoints
✅ OpenAPI spec generato
✅ Postman collection
✅ Rate limiting attivo
✅ RBAC su ogni endpoint
✅ Request/response validation (Zod)

```

**Acceptance Criteria**:
- [ ] Ogni endpoint ha RBAC check
- [ ] Rate limiting: 100 req/min per IP
- [ ] Validation: Zod schema per ogni request
- [ ] Error responses: consistent format
- [ ] Correlation ID: presente in ogni log
- [ ] Performance: < 100ms (p95) per GET
- [ ] Postman collection: 100% endpoints coperti

---

### FASE 2: Frontend Core (Settimana 3-4)
**Goal**: UI funzionale ma non rifinita

#### Sprint 2.1: Base Components
```

GIORNO 1-2: Design System
├─ components/warehouse/ui/
│ ├─ Button.tsx (variants: primary, secondary, danger)
│ ├─ Input.tsx (text, number, select)
│ ├─ Card.tsx
│ ├─ Badge.tsx (status colors)
│ ├─ Modal.tsx
│ ├─ Table.tsx (virtualizzata)
│ ├─ Pagination.tsx (cursor-based)
│ ├─ EmptyState.tsx (4 variants)
│ └─ ErrorBoundary.tsx
├─ Storybook: componenti isolati
├─ Test: unit tests componenti
└─ Accessibilità: WCAG 2.1 AA

GIORNO 3-5: Core UI Components
├─ components/warehouse/
│ ├─ WarehouseCard.tsx
│ ├─ InventoryTable.tsx (virtual scroll)
│ ├─ ProductFilters.tsx
│ ├─ CategoryTree.tsx
│ ├─ StockAlerts.tsx
│ ├─ BulkActions.tsx
│ └─ MovementTimeline.tsx
├─ Hooks:
│ ├─ useVirtualScroll.ts
│ ├─ useInfiniteQuery.ts (React Query)
│ ├─ usePermissions.ts
│ └─ useWarehouse.ts
├─ Test: component tests + interaction tests
└─ Performance: 60fps scroll su 10K items

DELIVERABLES:
✅ 15+ componenti riutilizzabili
✅ Storybook live
✅ Test coverage >70%
✅ Accessibilità audit passed

```

**Acceptance Criteria**:
- [ ] Virtual scroll: 60fps con 10K items
- [ ] Storybook: tutti i componenti documentati
- [ ] Accessibilità: keyboard navigation completa
- [ ] Test: snapshot tests per UI
- [ ] Performance: < 100ms TTI (Time to Interactive)

#### Sprint 2.2: Pages & Features
```

GIORNO 1-2: Lista Magazzini
├─ app/dashboard/magazzini/
│ ├─ page.tsx
│ ├─ layout.tsx
│ └─ loading.tsx
├─ Features:
│ ├─ Card grid (responsive)
│ ├─ Search/filter
│ ├─ Global alerts
│ ├─ Stats overview
│ └─ Quick actions
├─ Test: E2E con Playwright
└─ Performance: < 1.5s initial load

GIORNO 3-5: Inventario (critical!)
├─ app/dashboard/magazzini/[id]/inventario/
│ ├─ page.tsx (lista prodotti)
│ ├─ nuovo/page.tsx (form prodotto)
│ └─ [productId]/page.tsx (dettaglio)
├─ Features:
│ ├─ Virtual scroll (10K+ items)
│ ├─ Filtri avanzati (multi-dimensione)
│ ├─ Full-text search
│ ├─ Bulk operations
│ ├─ CSV import/export
│ └─ Real-time updates
├─ Optimization:
│ ├─ Debounced search (300ms)
│ ├─ Optimistic UI updates
│ ├─ Skeleton loaders
│ └─ Error retry (3 attempts)
├─ Test: E2E scenarios
│ ├─ Add 100 products (bulk)
│ ├─ Search with filters
│ ├─ Export 1000 items
│ └─ Concurrent updates
└─ Performance: < 100ms search response

GIORNO 6-7: Wizard Setup
├─ app/dashboard/magazzini/nuovo/
│ └─ page.tsx (multi-step wizard)
├─ Steps:
│ 1. Tipo business (6 templates)
│ 2. Dati magazzino
│ 3. Categorie
│ 4. Conferma
├─ Features:
│ ├─ Form validation (Zod)
│ ├─ Auto-save draft (localStorage)
│ ├─ Progress indicator
│ └─ Preview riepilogo
├─ Test: wizard completion flow
└─ UX: < 5 min to complete

DELIVERABLES:
✅ 8+ pages complete
✅ E2E tests (Playwright)
✅ Responsive (mobile/tablet/desktop)
✅ Loading states everywhere
✅ Error boundaries

```

**Acceptance Criteria**:
- [ ] Virtual scroll: test con 10,000 items
- [ ] Search: < 100ms response time
- [ ] Bulk operations: < 500ms per 100 items
- [ ] Mobile: fully functional (no desktop-only features)
- [ ] E2E tests: 90% critical paths covered
- [ ] Error recovery: retry + fallback UI

---

### FASE 3: Enterprise Features (Settimana 5)
**Goal**: Audit, RBAC UI, Compliance

#### Sprint 3.1: RBAC & Permissions UI
```

GIORNO 1-2: Role Management
├─ app/dashboard/magazzini/[id]/impostazioni/ruoli/
│ ├─ page.tsx (lista ruoli)
│ └─ [roleId]/page.tsx (edit permissions)
├─ Features:
│ ├─ Permission matrix (visual)
│ ├─ Field-level restrictions UI
│ ├─ Conditional permissions builder
│ └─ Role assignment
├─ Test: permission inheritance
└─ Security: admin-only access

GIORNO 3-4: Audit Trail UI
├─ app/dashboard/magazzini/[id]/audit/
│ └─ page.tsx (timeline + filters)
├─ Features:
│ ├─ Timeline interattiva
│ ├─ Diff viewer (before/after)
│ ├─ Export audit log
│ ├─ Search/filter avanzato
│ └─ Real-time updates
├─ Test: audit completeness
└─ Performance: < 200ms query (1M records)

GIORNO 5: Approval Workflows UI
├─ app/dashboard/magazzini/[id]/approvazioni/
│ └─ page.tsx (pending/approved/rejected)
├─ Features:
│ ├─ Approval request creation
│ ├─ Review interface
│ ├─ Notifications (Telegram)
│ └─ Auto-expiry handling
└─ Test: approval flow E2E

DELIVERABLES:
✅ RBAC UI completa
✅ Audit trail interattiva
✅ Approval workflows
✅ Telegram notifications

```

**Acceptance Criteria**:
- [ ] Permission matrix: visual + intuitive
- [ ] Audit diff: clear before/after
- [ ] Notifications: < 5s delivery (Telegram)
- [ ] Approval flow: complete in < 2 min

#### Sprint 3.2: Analytics & Monitoring
```

GIORNO 1-2: Analytics Dashboard
├─ app/dashboard/magazzini/[id]/analytics/
│ └─ page.tsx
├─ Features:
│ ├─ KPI cards (5 metriche)
│ ├─ Trend chart (30 giorni)
│ ├─ Top/Bottom prodotti
│ ├─ Categoria breakdown
│ ├─ Alert consigli azioni
│ └─ Export PDF report
├─ Optimization:
│ ├─ Materialized views (pre-calc)
│ ├─ Caching (15 min TTL)
│ └─ Lazy loading charts
└─ Performance: < 2s dashboard load

GIORNO 3: Observability Setup
├─ Sentry: custom dashboards
├─ Metrics: business KPIs
├─ Alerts: threshold-based
└─ Logging: structured logs

GIORNO 4-5: Performance Optimization
├─ Code splitting (route-based)
├─ Image optimization (next/image)
├─ Bundle analysis
├─ Lighthouse audit: >90 score
└─ Performance budget enforcement

DELIVERABLES:
✅ Analytics dashboard live
✅ Sentry monitoring attivo
✅ Performance: Lighthouse >90

```

**Acceptance Criteria**:
- [ ] Dashboard load: < 2s (p95)
- [ ] Lighthouse: Performance >90
- [ ] Bundle size: < 500KB initial
- [ ] Sentry: 0 unhandled errors
- [ ] Alerts: < 5 min notification

---

### FASE 4: Testing & Hardening (Settimana 6)
**Goal**: Zero bugs, production-ready

#### Sprint 4.1: Comprehensive Testing
```

GIORNO 1: Unit Tests
├─ Run: npm run test:unit
├─ Target: >80% coverage
├─ Fix: failing tests
└─ Report: coverage badge

GIORNO 2: Integration Tests
├─ Run: npm run test:integration
├─ Scenarios:
│ ├─ Full warehouse creation flow
│ ├─ Bulk product operations
│ ├─ Movement tracking
│ ├─ Approval workflows
│ └─ Audit trail accuracy
└─ Fix: integration issues

GIORNO 3: E2E Tests (Playwright)
├─ Critical paths:
│ ├─ Create warehouse + 100 products
│ ├─ Search + filter + export
│ ├─ Stock update + movement
│ ├─ Permission denied scenarios
│ └─ Offline sync
├─ Cross-browser: Chrome, Firefox, Safari
└─ Mobile: iOS Safari, Android Chrome

GIORNO 4: Performance Tests
├─ Load testing (k6):
│ ├─ 100 concurrent users
│ ├─ 1000 products created/min
│ ├─ 10K search queries
│ └─ Stress test: find breaking point
├─ Database:
│ ├─ Query performance (explain analyze)
│ ├─ Index usage verification
│ └─ Connection pool sizing
└─ Frontend:
│ ├─ Virtual scroll (60fps)
│ ├─ Lighthouse CI
│ └─ Bundle size check

GIORNO 5: Security Tests
├─ OWASP Top 10:
│ ├─ SQL Injection (parametrized queries)
│ ├─ XSS (DOMPurify)
│ ├─ CSRF (tokens)
│ ├─ Auth bypass (RLS policies)
│ └─ Sensitive data exposure (field masking)
├─ Penetration testing:
│ ├─ RBAC bypass attempts
│ ├─ API rate limit bypass
│ ├─ Session hijacking
│ └─ Mass assignment
└─ Dependency audit: npm audit

DELIVERABLES:
✅ Test coverage: >80%
✅ E2E: 95% critical paths
✅ Performance: all benchmarks met
✅ Security: 0 critical vulnerabilities

```

**Acceptance Criteria**:
- [ ] Unit tests: >80% coverage
- [ ] Integration tests: all passing
- [ ] E2E tests: 95% critical paths
- [ ] Performance: < 100ms API (p95)
- [ ] Security: npm audit clean
- [ ] Load test: 100 concurrent users OK

#### Sprint 4.2: Documentation & Training
```

GIORNO 1: Technical Documentation
├─ API docs (OpenAPI)
├─ Architecture diagrams
├─ Database schema docs
├─ Deployment guide
└─ Troubleshooting guide

GIORNO 2: User Documentation
├─ User guide (IT/EN)
├─ Video tutorials
├─ FAQ
└─ Onboarding checklist

GIORNO 3: Training Materials
├─ Admin training deck
├─ Support team guide
├─ Feature demo
└─ Common issues & solutions

DELIVERABLES:
✅ Technical docs complete
✅ User guide published
✅ Training completed

````

---

## 🔗 Dependency Graph

```mermaid
graph TD
    A[Fase 0: Database Schema] --> B[Fase 1: Backend Services]
    B --> C[Fase 1: API Routes]
    C --> D[Fase 2: UI Components]
    D --> E[Fase 2: Pages]
    E --> F[Fase 3: Enterprise Features]
    F --> G[Fase 4: Testing]
    G --> H[Production Deploy]

    A --> A1[Core Tables]
    A --> A2[RBAC Schema]
    A --> A3[Audit Schema]
    A --> A4[Feature Flags]

    B --> B1[Permission Service]
    B --> B2[Audit Service]
    B --> B3[Inventory Service]

    C --> C1[Warehouse APIs]
    C --> C2[Inventory APIs]
    C --> C3[Movement APIs]

    D --> D1[Design System]
    D --> D2[Core Components]

    E --> E1[Lista Magazzini]
    E --> E2[Inventario]
    E --> E3[Wizard Setup]

    F --> F1[RBAC UI]
    F --> F2[Audit UI]
    F --> F3[Analytics]

    G --> G1[Unit Tests]
    G --> G2[E2E Tests]
    G --> G3[Security Audit]
````

---

## 🧪 Testing Strategy

### Test Pyramid

```
                  ▲
                 / \
                /   \
               /  E2E \ (10%)
              /       \
             /---------\
            /           \
           / Integration \ (30%)
          /               \
         /-----------------\
        /                   \
       /       Unit          \ (60%)
      /                       \
     /_________________________\
```

### Test Levels

#### 1. Unit Tests (60% - 200+ tests)

```typescript
// tests/warehouse/unit/inventory-service.test.ts

describe('InventoryService', () => {
  describe('decrementInventory', () => {
    it('should decrement stock atomically', async () => {
      // Arrange
      const product = await createTestProduct({ quantity: 100 });

      // Act
      await decrementInventory({
        warehouseId: 'test-warehouse',
        productId: product.id,
        quantity: 10,
      });

      // Assert
      const updated = await getProduct(product.id);
      expect(updated.quantity_available).toBe(90);
    });

    it('should throw error if insufficient stock', async () => {
      const product = await createTestProduct({ quantity: 5 });

      await expect(
        decrementInventory({
          warehouseId: 'test-warehouse',
          productId: product.id,
          quantity: 10,
        })
      ).rejects.toThrow('Stock insufficiente');
    });

    it('should handle race conditions correctly', async () => {
      const product = await createTestProduct({ quantity: 100 });

      // Simulate concurrent decrements
      const promises = Array(10)
        .fill(null)
        .map(() =>
          decrementInventory({
            warehouseId: 'test-warehouse',
            productId: product.id,
            quantity: 10,
          })
        );

      await Promise.all(promises);

      const updated = await getProduct(product.id);
      expect(updated.quantity_available).toBe(0);
    });
  });
});
```

#### 2. Integration Tests (30% - 80+ tests)

```typescript
// tests/warehouse/integration/api.test.ts

describe('Warehouse API Integration', () => {
  it('should create warehouse with full flow', async () => {
    // 1. Create warehouse
    const warehouse = await request(app)
      .post('/api/warehouses')
      .send({
        code: 'MI-01',
        name: 'Milano Centro',
        city: 'Milano',
      })
      .expect(201);

    // 2. Add products
    const product = await request(app)
      .post(`/api/warehouses/${warehouse.id}/inventory`)
      .send({
        sku: 'SKU-001',
        name: 'Test Product',
        quantity: 100,
      })
      .expect(201);

    // 3. Create movement
    await request(app)
      .post(`/api/warehouses/${warehouse.id}/movements`)
      .send({
        type: 'outbound',
        productId: product.id,
        quantity: -10,
      })
      .expect(201);

    // 4. Verify stock updated
    const inventory = await request(app)
      .get(`/api/warehouses/${warehouse.id}/inventory/${product.id}`)
      .expect(200);

    expect(inventory.body.quantity_available).toBe(90);

    // 5. Verify audit log
    const audit = await request(app).get(`/api/warehouses/${warehouse.id}/audit`).expect(200);

    expect(audit.body).toHaveLength(3); // create warehouse, product, movement
  });
});
```

#### 3. E2E Tests (10% - 30+ tests)

```typescript
// tests/warehouse/e2e/inventory.spec.ts

test('should manage inventory complete flow', async ({ page }) => {
  await page.goto('/dashboard/magazzini');

  // 1. Create warehouse
  await page.click('text=Nuovo Magazzino');
  await page.fill('[name="code"]', 'MI-TEST');
  await page.fill('[name="name"]', 'Test Warehouse');
  await page.click('text=Avanti');
  await page.click('text=Crea');

  await expect(page.locator('text=MI-TEST')).toBeVisible();

  // 2. Add product
  await page.click('text=Inventario');
  await page.click('text=Nuovo Prodotto');
  await page.fill('[name="sku"]', 'SKU-TEST-001');
  await page.fill('[name="name"]', 'Test Product');
  await page.fill('[name="quantity"]', '100');
  await page.click('text=Salva');

  await expect(page.locator('text=SKU-TEST-001')).toBeVisible();

  // 3. Search product
  await page.fill('[placeholder="Cerca SKU, nome..."]', 'SKU-TEST');
  await page.waitForTimeout(500); // Debounce

  const results = page.locator('[data-testid="product-row"]');
  await expect(results).toHaveCount(1);

  // 4. Update stock
  await page.click('text=SKU-TEST-001');
  await page.click('text=Scarico');
  await page.fill('[name="quantity"]', '10');
  await page.fill('[name="notes"]', 'Test movement');
  await page.click('text=Conferma');

  // Verify stock updated
  await expect(page.locator('text=90 unità')).toBeVisible();
});
```

### Test Coverage Requirements

| Component     | Min Coverage | Target  |
| ------------- | ------------ | ------- |
| Services      | 80%          | 90%     |
| API Routes    | 75%          | 85%     |
| UI Components | 70%          | 80%     |
| Utils         | 90%          | 95%     |
| **Overall**   | **80%**      | **85%** |

---

## 🔒 Security Audit Checklist

### Pre-Deployment Security Audit

```markdown
## Authentication & Authorization

- [ ] Session management: timeout 30 min
- [ ] MFA: optional but encouraged
- [ ] Password policy: min 12 chars, complexity
- [ ] RBAC: tested with 3+ roles
- [ ] Field-level permissions: working
- [ ] Token expiration: JWT < 1h
- [ ] Refresh token rotation: enabled

## Input Validation

- [ ] All API inputs: Zod validation
- [ ] SQL Injection: parametrized queries ONLY
- [ ] XSS: DOMPurify on user content
- [ ] CSRF: tokens on state-changing requests
- [ ] File upload: type + size validation
- [ ] Max request size: 10MB

## Data Protection

- [ ] Credentials encrypted: AES-256-GCM
- [ ] PII masked in logs
- [ ] Audit log: immutable (no UPDATE/DELETE)
- [ ] Database: RLS policies on ALL tables
- [ ] Backups: encrypted at rest
- [ ] Secrets: stored in env vars (NOT code)

## API Security

- [ ] Rate limiting: 100 req/min per IP
- [ ] CORS: whitelist domains only
- [ ] HTTPS: enforced in production
- [ ] Security headers: CSP, HSTS, X-Frame-Options
- [ ] API versioning: /api/v1/...
- [ ] Error messages: no sensitive info leak

## Infrastructure

- [ ] Dependencies: npm audit clean
- [ ] Docker: non-root user
- [ ] Database: strong password (32+ chars)
- [ ] Redis: password protected
- [ ] Sentry: DSN not exposed
- [ ] Environment: production mode

## Compliance

- [ ] GDPR: Right to Access implemented
- [ ] GDPR: Right to Erasure implemented
- [ ] GDPR: Data Portability implemented
- [ ] Audit trail: 7 years retention
- [ ] Privacy policy: updated
- [ ] Terms of service: warehouse clause

## Penetration Testing

- [ ] RBAC bypass: attempted (failed ✓)
- [ ] SQL injection: attempted (failed ✓)
- [ ] XSS: attempted (failed ✓)
- [ ] Mass assignment: attempted (failed ✓)
- [ ] Session hijacking: attempted (failed ✓)
- [ ] API fuzzing: completed (no crashes ✓)
```

---

## ⚡ Performance Benchmarks

### Target Metrics

| Metric                      | Target | Maximum | Measurement          |
| --------------------------- | ------ | ------- | -------------------- |
| **API Response Time (p50)** | 50ms   | 100ms   | GET /api/warehouses  |
| **API Response Time (p95)** | 100ms  | 200ms   | GET /api/warehouses  |
| **API Response Time (p99)** | 200ms  | 500ms   | Complex queries      |
| **Database Query**          | 10ms   | 50ms    | Simple SELECT        |
| **Full-text Search**        | 30ms   | 100ms   | 10K products         |
| **Initial Page Load**       | 1.0s   | 1.5s    | /dashboard/magazzini |
| **Time to Interactive**     | 1.5s   | 2.5s    | First interaction    |
| **Virtual Scroll FPS**      | 60fps  | 50fps   | 10K items            |
| **Lighthouse Performance**  | 95     | 90      | Mobile               |
| **Bundle Size (Initial)**   | 300KB  | 500KB   | Gzipped              |

### Performance Test Script

```typescript
// tests/warehouse/performance/load-test.ts

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '1m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% requests < 200ms
    http_req_failed: ['rate<0.01'], // <1% failure rate
  },
};

export default function () {
  // 1. List warehouses
  const listRes = http.get('https://api.spediresicuro.com/api/warehouses');
  check(listRes, {
    'list status 200': (r) => r.status === 200,
    'list duration < 100ms': (r) => r.timings.duration < 100,
  });

  sleep(1);

  // 2. Search products
  const searchRes = http.get(
    'https://api.spediresicuro.com/api/warehouses/xxx/inventory?search=test'
  );
  check(searchRes, {
    'search status 200': (r) => r.status === 200,
    'search duration < 50ms': (r) => r.timings.duration < 50,
  });

  sleep(1);

  // 3. Create movement
  const movementRes = http.post(
    'https://api.spediresicuro.com/api/warehouses/xxx/movements',
    JSON.stringify({
      type: 'outbound',
      productId: 'xxx',
      quantity: -1,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(movementRes, {
    'movement status 201': (r) => r.status === 201,
    'movement duration < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(2);
}
```

---

## 🔄 Rollback Plan

### Rollback Decision Tree

```
Issue Detected
    │
    ├─ Critical Bug (data loss, security)
    │   → IMMEDIATE ROLLBACK (< 5 min)
    │
    ├─ Performance Degradation (>500ms API)
    │   → Investigate 15 min → Rollback if not fixed
    │
    ├─ Feature Bug (non-blocking)
    │   → Feature flag OFF → Fix forward
    │
    └─ UI Issue (cosmetic)
        → Fix forward (no rollback)
```

### Rollback Procedures

#### 1. Database Rollback

```bash
# CRITICAL: Test rollback BEFORE production deploy!

# 1. Backup current state
pg_dump -Fc spediresicuro > backup_$(date +%Y%m%d_%H%M%S).dump

# 2. Rollback migrations (in reverse order)
supabase migration down 118_warehouse_feature_flags.sql
supabase migration down 117_warehouse_audit_compliance.sql
supabase migration down 116_warehouse_rbac.sql
supabase migration down 115_warehouse_core_tables.sql

# 3. Verify rollback
psql spediresicuro -c "\dt warehouse*"  # Should return 0 tables

# 4. Restore data (if needed)
pg_restore -d spediresicuro backup_YYYYMMDD_HHMMSS.dump
```

#### 2. Application Rollback

```bash
# Vercel deployment rollback

# 1. List recent deployments
vercel ls

# 2. Promote previous deployment
vercel promote <previous-deployment-url>

# 3. Verify
curl https://spediresicuro.com/api/health
```

#### 3. Feature Flag Emergency OFF

```typescript
// Instant rollback via feature flag (NO deployment)

// 1. Connect to production DB
const { data } = await supabase
  .from('warehouse_feature_flags')
  .update({ enabled: false })
  .eq('scope', 'global')
  .eq('feature_key', 'WAREHOUSE_SYSTEM');

// 2. Clear cache
await redis.del('feature_flags:warehouse_system');

// 3. Notify users
await sendTelegramAlert({
  severity: 'critical',
  message: 'Warehouse system temporarily disabled. Investigating issue.',
});
```

### Rollback Checklist

```markdown
- [ ] Incident declared (severity level)
- [ ] Stakeholders notified
- [ ] Rollback decision approved (if critical)
- [ ] Database backup verified
- [ ] Rollback script tested (staging)
- [ ] Rollback executed (production)
- [ ] Verification: smoke tests passed
- [ ] Monitoring: errors stopped
- [ ] Post-mortem: scheduled
- [ ] Fix-forward plan: documented
```

---

## ✅ Code Review Checklist

### Pull Request Template

```markdown
## Description

[Descrizione chiara delle modifiche]

## Type of Change

- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature)
- [ ] Database migration
- [ ] Performance improvement
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed
- [ ] Performance tested

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added (complex logic)
- [ ] Documentation updated
- [ ] No console.log left
- [ ] No TypeScript `any` used
- [ ] Error handling added
- [ ] Security considerations addressed
- [ ] RBAC checks added (if API)
- [ ] Audit logging added (if state change)

## Screenshots (if UI)

[Add screenshots]

## Performance Impact

- [ ] No performance regression
- [ ] Bundle size: [before] → [after]
- [ ] Lighthouse score: [before] → [after]

## Migration Required?

- [ ] Yes → migration script attached
- [ ] No

## Rollback Plan

[How to rollback if issues]
```

### Review Criteria

#### Code Quality (Must Pass All)

- [ ] **No `any` types** (except unavoidable)
- [ ] **No `console.log`** (use logger)
- [ ] **Max function length: 100 lines**
- [ ] **Max cyclomatic complexity: 10**
- [ ] **Max nesting depth: 3**
- [ ] **DRY principle**: no duplicated code
- [ ] **SOLID principles**: followed
- [ ] **Naming**: descriptive, consistent

#### Security (Must Pass All)

- [ ] **Input validation**: Zod schema
- [ ] **SQL queries**: parametrized ONLY
- [ ] **User input**: sanitized (DOMPurify)
- [ ] **Secrets**: env vars, not hardcoded
- [ ] **RBAC**: permission check on sensitive ops
- [ ] **Error messages**: no sensitive info leak
- [ ] **Audit log**: critical actions logged

#### Performance (Should Pass)

- [ ] **Avoid N+1 queries**
- [ ] **Database**: proper indexes used
- [ ] **API**: response < 200ms (p95)
- [ ] **Frontend**: virtual scroll for long lists
- [ ] **Images**: optimized (next/image)
- [ ] **Bundle**: code splitting applied

#### Testing (Must Pass)

- [ ] **Unit tests**: >80% coverage
- [ ] **Edge cases**: tested
- [ ] **Error scenarios**: tested
- [ ] **Race conditions**: considered
- [ ] **E2E**: critical path covered

---

## 🚀 Production Deployment

### Pre-Deployment Checklist

```markdown
## 1 Week Before

- [ ] Feature freeze announced
- [ ] Staging deployment completed
- [ ] Smoke tests on staging: passed
- [ ] Performance tests: passed
- [ ] Security audit: completed
- [ ] Backup strategy: verified
- [ ] Rollback plan: documented
- [ ] Monitoring: dashboards ready
- [ ] Alerts: configured
- [ ] Documentation: finalized
- [ ] Training: completed
- [ ] Support team: briefed

## 1 Day Before

- [ ] Final staging test
- [ ] Database migration: dry run
- [ ] Deployment runbook: reviewed
- [ ] Team availability: confirmed
- [ ] Rollback script: tested
- [ ] Communication plan: ready

## Deployment Day (T-0)

- [ ] Maintenance window: announced (if needed)
- [ ] Database backup: completed
- [ ] Feature flags: verified (OFF initially)
- [ ] Deployment: started
- [ ] Migration: executed
- [ ] Application: deployed
- [ ] Smoke tests: passed
- [ ] Feature flags: enabled (gradual rollout)
- [ ] Monitoring: active watching
- [ ] Performance: within SLA
- [ ] Errors: acceptable rate
- [ ] Communication: deployment success

## Post-Deployment (T+24h)

- [ ] Monitoring: no critical issues
- [ ] Performance: stable
- [ ] Error rate: < 0.1%
- [ ] User feedback: collected
- [ ] Post-mortem: scheduled (if issues)
- [ ] Documentation: updated
```

### Deployment Script

```bash
#!/bin/bash
# deploy-warehouse.sh - Production deployment script

set -euo pipefail  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 1. Pre-deployment checks
log_info "Running pre-deployment checks..."

# Check if on master branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "master" ]; then
  log_error "Not on master branch. Current: $BRANCH"
  exit 1
fi

# Check if clean working directory
if [[ -n $(git status --porcelain) ]]; then
  log_error "Working directory not clean"
  exit 1
fi

# Check tests
log_info "Running tests..."
npm run test:unit || { log_error "Unit tests failed"; exit 1; }
npm run test:integration || { log_error "Integration tests failed"; exit 1; }

# Check linting
log_info "Running linters..."
npm run lint || { log_error "Linting failed"; exit 1; }

# Check TypeScript
log_info "Type checking..."
npm run type-check || { log_error "Type check failed"; exit 1; }

# Security audit
log_info "Security audit..."
npm audit --audit-level=high || { log_error "Security vulnerabilities found"; exit 1; }

# 2. Database backup
log_info "Creating database backup..."
BACKUP_FILE="backup_warehouse_$(date +%Y%m%d_%H%M%S).dump"
pg_dump -Fc $DATABASE_URL > "$BACKUP_FILE"
log_info "Backup saved: $BACKUP_FILE"

# 3. Database migrations
log_info "Running migrations..."
npm run migrate:production || {
  log_error "Migration failed. Rolling back..."
  npm run migrate:rollback
  exit 1
}

# 4. Build application
log_info "Building application..."
npm run build || { log_error "Build failed"; exit 1; }

# 5. Deploy to Vercel
log_info "Deploying to Vercel..."
vercel deploy --prod || { log_error "Deployment failed"; exit 1; }

# 6. Post-deployment verification
log_info "Running smoke tests..."
sleep 10  # Wait for deployment to propagate

# Health check
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://spediresicuro.com/api/health)
if [ "$HEALTH_STATUS" != "200" ]; then
  log_error "Health check failed: $HEALTH_STATUS"
  log_warn "Initiating rollback..."
  vercel rollback
  exit 1
fi

# 7. Enable feature flags (gradual rollout)
log_info "Enabling feature flags (10% rollout)..."
psql $DATABASE_URL <<SQL
UPDATE warehouse_feature_flags
SET enabled = true, rollout_percentage = 10
WHERE scope = 'global' AND feature_key = 'WAREHOUSE_SYSTEM';
SQL

log_info "✅ Deployment completed successfully!"
log_info "Monitoring dashboard: https://sentry.io/warehouse"
log_info "Rollback command: vercel rollback"
```

---

## 📈 Success Metrics (Post-Launch)

### Week 1 Metrics

- [ ] **Uptime**: > 99.9%
- [ ] **Error rate**: < 0.1%
- [ ] **Performance**: < 100ms API (p95)
- [ ] **User adoption**: > 10 warehouses created
- [ ] **Support tickets**: < 5 critical issues

### Month 1 Metrics

- [ ] **Uptime**: > 99.95%
- [ ] **User satisfaction**: > 4.5/5
- [ ] **Performance**: maintained
- [ ] **Feature usage**: > 50% active users
- [ ] **Data quality**: < 1% errors

---

## 🎯 FINAL CHECKLIST - GO/NO-GO Decision

```markdown
## Infrastructure

- [ ] Database: migrations tested
- [ ] Caching: Redis operational
- [ ] Monitoring: Sentry configured
- [ ] Alerts: Telegram/Email working
- [ ] Backups: automated daily

## Code Quality

- [ ] Tests: >80% coverage
- [ ] Linting: 0 errors
- [ ] TypeScript: 0 errors
- [ ] Security: npm audit clean
- [ ] Performance: benchmarks met

## Documentation

- [ ] API docs: published
- [ ] User guide: complete
- [ ] Admin guide: complete
- [ ] Runbook: tested
- [ ] Training: delivered

## Security

- [ ] RBAC: tested
- [ ] Audit trail: working
- [ ] GDPR: compliant
- [ ] Penetration test: passed
- [ ] Encryption: verified

## Deployment

- [ ] Staging: tested end-to-end
- [ ] Rollback: plan ready
- [ ] Feature flags: configured
- [ ] Team: on-call scheduled
- [ ] Communication: stakeholders notified

## GO/NO-GO Decision

- [ ] ✅ **GO** - All checks passed
- [ ] ❌ **NO-GO** - Issues found (document below)

Issues preventing GO:

1. [List blocking issues]
```

---

**ORA hai un PIANO COMPLETO da Senior Dev. Zero improvvisazione. Tutto sotto controllo.** 🎯

Vuoi che inizi dall'**implementazione Fase 0** (Database migrations)?
