# M4: Business Dashboards & Metrics Implementation

## Overview

**Milestone**: M4 - Business Dashboards & Audit Trail
**Cost**: €0/month (FREE TIER only)
**Branch**: `feature/m4-business-dashboards`

### Dependencies on Previous Milestones

- **M1**: Sentry Error Tracking, Health Checks ✅
- **M2**: APM, Structured Logging (`lib/logger.ts`), Instrumentation ✅
- **M3**: Uptime Monitoring, Audit Schema (`audit_logs` table) ✅

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    GRAFANA CLOUD (FREE)                         │
│                    10K metrics series                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Business Dashboard                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │   │
│  │  │Shipments │  │ Revenue  │  │  Users   │  │ Wallet  │ │   │
│  │  │  Stats   │  │  Trends  │  │ Activity │  │  Flow   │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Scrape every 60s
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS APPLICATION                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │          /api/metrics/prometheus                         │   │
│  │          (Prometheus exposition format)                  │   │
│  │                                                          │   │
│  │  # HELP spedire_shipments_total Total shipments          │   │
│  │  # TYPE spedire_shipments_total gauge                    │   │
│  │  spedire_shipments_total{status="delivered"} 1234        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │          /api/metrics/business                           │   │
│  │          (JSON for internal dashboards)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Audit Trail Service                         │   │
│  │          lib/services/audit-service.ts                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SUPABASE                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  shipments   │  │    users     │  │ wallet_transactions  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ audit_logs   │  │ top_up_req   │  │   (aggregations)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components to Implement

### 1. Audit Trail Service (`lib/services/audit-service.ts`)

Central service for logging all business events with consistent format.

**Event Categories:**

| Category      | Events                                           | Fields                                             |
| ------------- | ------------------------------------------------ | -------------------------------------------------- |
| **Shipment**  | created, status_changed, cancelled, deleted      | shipment_id, old_status, new_status, courier, cost |
| **User**      | registered, login, profile_updated, role_changed | user_id, changes, ip_address                       |
| **Financial** | wallet_topup, wallet_charge, refund, fee_applied | user_id, amount, balance_before, balance_after     |

**Interface:**

```typescript
interface AuditEvent {
  action: string;
  resource_type: 'shipment' | 'user' | 'wallet' | 'topup';
  resource_id: string;
  actor_id: string;
  target_id?: string; // For impersonation
  metadata: Record<string, unknown>;
  ip_address?: string;
}
```

### 2. Metrics Endpoints

#### `/api/metrics/prometheus` (GET)

Prometheus exposition format for Grafana scraping.

**Metrics to expose:**

```prometheus
# Shipment Metrics
spedire_shipments_total{status="delivered"} 1234
spedire_shipments_total{status="pending"} 56
spedire_shipments_total{status="failed"} 12
spedire_shipments_created_today 45
spedire_shipments_success_rate 0.95

# Revenue Metrics
spedire_revenue_total_eur 12345.67
spedire_revenue_today_eur 567.89
spedire_average_shipment_cost_eur 8.50

# User Metrics
spedire_users_total 1234
spedire_users_active_30d 456
spedire_users_registered_today 5

# Wallet Metrics
spedire_wallet_transactions_total{type="deposit"} 789
spedire_wallet_transactions_total{type="charge"} 1234
spedire_wallet_balance_total_eur 45678.90
spedire_topups_pending 12
spedire_topups_approved_today 8
```

**Security:**

- Bearer token authentication (`METRICS_API_TOKEN`)
- Rate limiting (60 req/min)
- No PII in metrics

#### `/api/metrics/business` (GET)

JSON format for internal admin dashboard.

**Response:**

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "period": "today|week|month|all",
  "shipments": {
    "total": 12345,
    "today": 45,
    "thisWeek": 234,
    "thisMonth": 890,
    "byStatus": {
      "pending": 56,
      "in_transit": 123,
      "delivered": 11000,
      "failed": 89,
      "cancelled": 77
    },
    "successRate": 0.95,
    "averageCost": 8.5
  },
  "revenue": {
    "total": 123456.78,
    "today": 567.89,
    "thisWeek": 3456.78,
    "thisMonth": 12345.67,
    "averageMargin": 0.15
  },
  "users": {
    "total": 1234,
    "active30d": 456,
    "newToday": 5,
    "newThisWeek": 23,
    "newThisMonth": 89
  },
  "wallet": {
    "totalBalance": 45678.9,
    "transactionsToday": 123,
    "topupsPending": 12,
    "topupsApprovedToday": 8,
    "averageTopupAmount": 150.0
  }
}
```

### 3. Database Enhancements

#### Audit Events Extension

Extend existing `audit_logs` table usage with standardized actions:

```typescript
const AUDIT_ACTIONS = {
  // Shipment events
  SHIPMENT_CREATED: 'shipment.created',
  SHIPMENT_STATUS_CHANGED: 'shipment.status_changed',
  SHIPMENT_CANCELLED: 'shipment.cancelled',
  SHIPMENT_DELETED: 'shipment.deleted',

  // User events
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_PROFILE_UPDATED: 'user.profile_updated',
  USER_ROLE_CHANGED: 'user.role_changed',
  USER_PASSWORD_CHANGED: 'user.password_changed',

  // Financial events
  WALLET_TOPUP_REQUESTED: 'wallet.topup_requested',
  WALLET_TOPUP_APPROVED: 'wallet.topup_approved',
  WALLET_TOPUP_REJECTED: 'wallet.topup_rejected',
  WALLET_CHARGED: 'wallet.charged',
  WALLET_REFUNDED: 'wallet.refunded',
  WALLET_ADJUSTED: 'wallet.adjusted',
} as const;
```

#### Retention Policy

SQL function for audit log cleanup (configurable retention):

```sql
-- Retention: 90 days for standard events, 365 days for financial events
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND action NOT LIKE 'wallet.%'
    AND action NOT LIKE 'shipment.%';

  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '365 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

### 4. Grafana Cloud Setup

**Free Tier Limits:**

- 10,000 active series
- 14-day retention
- 50GB logs/month (with Loki)

**Dashboard Panels:**

1. **Shipments Overview**
   - Time series: Shipments created per day
   - Stat: Today's shipments
   - Gauge: Success rate
   - Pie chart: Status distribution

2. **Revenue Dashboard**
   - Time series: Daily revenue
   - Stat: Today's revenue
   - Bar chart: Revenue by courier

3. **User Activity**
   - Time series: New registrations
   - Stat: Active users (30d)
   - Table: Recent logins

4. **Wallet Operations**
   - Time series: Daily transactions
   - Stat: Pending top-ups
   - Table: Recent top-up requests

---

## Implementation Plan

### Phase 1: Audit Trail Service (2h)

- [ ] Create `lib/services/audit-service.ts`
- [ ] Define all audit action constants
- [ ] Implement `logAuditEvent()` function
- [ ] Add audit calls to existing shipment operations
- [ ] Add audit calls to wallet operations
- [ ] Add audit calls to user operations

### Phase 2: Metrics Endpoints (2h)

- [ ] Create `/api/metrics/prometheus/route.ts`
- [ ] Create `/api/metrics/business/route.ts`
- [ ] Implement Prometheus text format helper
- [ ] Add authentication middleware
- [ ] Create metrics aggregation queries

### Phase 3: Grafana Integration (2h)

- [ ] Create Grafana Cloud account (free)
- [ ] Configure Prometheus data source
- [ ] Create dashboard JSON
- [ ] Set up scraping from `/api/metrics/prometheus`
- [ ] Configure alerting rules

### Phase 4: Admin Dashboard UI (2h)

- [ ] Create `/app/(admin)/admin/metrics/page.tsx`
- [ ] Add metrics overview cards
- [ ] Add charts (using recharts)
- [ ] Add audit log viewer
- [ ] Add export functionality

### Phase 5: Testing & Documentation (1h)

- [ ] Create `/api/test/m4-metrics/route.ts`
- [ ] Write Grafana setup documentation
- [ ] Update ops runbook
- [ ] Verify all integrations

---

## Environment Variables

```env
# Grafana Cloud (will be set after account creation)
GRAFANA_CLOUD_URL=https://your-stack.grafana.net
GRAFANA_CLOUD_USER=your-user-id
GRAFANA_CLOUD_API_KEY=your-api-key

# Metrics API Security
METRICS_API_TOKEN=your-secure-token-here

# Retention Settings
AUDIT_RETENTION_DAYS=90
FINANCIAL_AUDIT_RETENTION_DAYS=365
```

---

## Security Considerations

1. **Metrics Endpoint Protection**
   - Bearer token required for `/api/metrics/prometheus`
   - IP allowlist for Grafana Cloud scrapers
   - Rate limiting

2. **PII in Audit Logs**
   - User IDs stored (not emails in metrics)
   - IP addresses hashed for privacy
   - Sensitive data excluded from metrics

3. **Access Control**
   - Only SuperAdmin can view audit logs
   - Business metrics require Admin role

---

## Files to Create/Modify

### New Files

```
lib/services/audit-service.ts          # Audit trail service
lib/metrics/prometheus.ts              # Prometheus format helpers
lib/metrics/business-metrics.ts        # Business metrics queries
app/api/metrics/prometheus/route.ts    # Prometheus scrape endpoint
app/api/metrics/business/route.ts      # JSON metrics endpoint
app/api/test/m4-metrics/route.ts       # Test endpoint
app/(admin)/admin/metrics/page.tsx     # Admin dashboard
components/admin/metrics-dashboard.tsx # Dashboard component
supabase/migrations/XXX_audit_retention.sql  # Retention policy
docs/7-OPERATIONS/GRAFANA_SETUP.md     # Setup guide
```

### Modified Files

```
app/actions/shipments.ts               # Add audit logging
app/actions/wallet.ts                  # Add audit logging
lib/auth/session.ts                    # Add login audit
middleware.ts                          # Add metrics auth check
```

---

## Implementation Status

### Completed ✅

| Component                | File                                                      | Status         |
| ------------------------ | --------------------------------------------------------- | -------------- |
| Audit Trail Service      | `lib/services/audit-service.ts`                           | ✅ Implemented |
| Prometheus Helpers       | `lib/metrics/prometheus.ts`                               | ✅ Implemented |
| Business Metrics Queries | `lib/metrics/business-metrics.ts`                         | ✅ Implemented |
| Prometheus Endpoint      | `app/api/metrics/prometheus/route.ts`                     | ✅ Implemented |
| Business Metrics API     | `app/api/metrics/business/route.ts`                       | ✅ Implemented |
| Test Endpoint            | `app/api/test/m4-metrics/route.ts`                        | ✅ Implemented |
| Admin Dashboard          | `app/dashboard/admin/metrics/page.tsx`                    | ✅ Implemented |
| Retention Policy         | `supabase/migrations/113_audit_logs_retention_policy.sql` | ✅ Implemented |
| Grafana Setup Guide      | `docs/7-OPERATIONS/GRAFANA_SETUP.md`                      | ✅ Implemented |

### Access URLs

- **Admin Dashboard**: `/dashboard/admin/metrics`
- **Prometheus Endpoint**: `/api/metrics/prometheus` (requires METRICS_API_TOKEN)
- **Business API**: `/api/metrics/business` (requires admin session)
- **Test Endpoint**: `/api/test/m4-metrics` (dev only)

---

## Verification Checklist

- [x] `/api/metrics/prometheus` returns valid Prometheus format
- [x] `/api/metrics/business` returns expected JSON structure
- [x] Admin dashboard displays all metrics with charts
- [x] Audit service with all action types defined
- [x] Retention policy SQL function created
- [x] No PII in metrics (user IDs hashed)
- [x] Authentication for all endpoints
- [x] Rate limiting on Prometheus endpoint

### Post-Deployment Steps

1. Set `METRICS_API_TOKEN` environment variable in Vercel
2. Run migration `113_audit_logs_retention_policy.sql` in Supabase
3. (Optional) Create Grafana Cloud account and configure scraping
4. Verify `/api/test/m4-metrics` returns all tests passing
