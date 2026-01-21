\*\*# Compensation Queue - Observability & Alerting Setup

**Document Type**: Operations / Monitoring
**Date**: 2026-01-11
**Status**: Implementation Guide
**Criticality**: P0 - Production Monitoring Required

---

## 1. OVERVIEW

Il **Compensation Queue** traccia operazioni finanziarie fallite che richiedono intervento manuale (es. wallet debited ma shipment failed).

**Risk**: Orphan financial records → contabilità incoerente → perdita economica.

**Questo documento** fornisce setup completo per:

- ✅ Real-time monitoring
- ✅ Alerting automatico
- ✅ SLA tracking
- ✅ Dead-letter queue management

---

## 2. ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│ COMPENSATION QUEUE FLOW                                     │
└─────────────────────────────────────────────────────────────┘

Shipment Creation
     │
     ├─ Wallet Debit (SUCCESS)
     ├─ Carrier API (FAIL) ❌
     │
     └─► Insert compensation_queue (status: pending)
            │
            ├─► AUTO RETRY (3 attempts, exponential backoff)
            │      │
            │      ├─ SUCCESS → status: resolved ✅
            │      └─ FAIL → retry_count++
            │
            ├─► Max retries exceeded (3)
            │      └─► status: dead_letter 🚨
            │
            └─► Manual review (Admin Dashboard)
                   └─► Manual refund → status: resolved ✅
```

---

## 3. KEY METRICS

### 3.1 Health Indicators

| Metric                       | Healthy    | Warning      | Critical                |
| ---------------------------- | ---------- | ------------ | ----------------------- |
| **Pending < 24h**            | Any number | >10 records  | >50 records             |
| **Pending 24h-7d**           | <5 records | 5-10 records | >10 records             |
| **Pending >7d**              | 0 records  | 1-2 records  | >2 records (SLA breach) |
| **Dead letter**              | 0 records  | 1-3 records  | >3 records              |
| **Total exposure (pending)** | <€500      | €500-€1000   | >€1000                  |
| **Avg resolution time**      | <4h        | 4-24h        | >24h                    |

### 3.2 SLAs

| Priority            | Target Resolution Time | Alert Threshold |
| ------------------- | ---------------------- | --------------- |
| **P0 (High value)** | 4 hours                | >2h no action   |
| **P1 (Standard)**   | 24 hours               | >12h no action  |
| **P2 (Low value)**  | 7 giorni               | >5d no action   |

**High value**: `original_cost > €100`
**Standard**: `original_cost €20-€100`
**Low value**: `original_cost < €20`

---

## 4. API ENDPOINTS

### 4.1 Stats Endpoint

**GET** `/api/admin/compensation-queue/stats`

**Response**:

```json
{
  "success": true,
  "timestamp": "2026-01-11T10:30:00Z",
  "stats": {
    "counts_by_status": {
      "pending": 3,
      "expired": 0,
      "resolved": 45,
      "total": 48
    },
    "pending_by_age": {
      "critical_over_7_days": 0,
      "warning_24h_to_7d": 2,
      "ok_under_24h": 1,
      "oldest_pending_hours": 36.5,
      "total_pending_amount": 125.50
    },
    "resolution_time": {
      "avg_hours": 8.3,
      "median_hours": 4.2,
      "sample_size": 45,
      "period_days": 30
    },
    "by_action": {
      "REFUND": { "count": 2, "total_amount": 85.00 },
      "MANUAL_REVIEW": { "count": 1, "total_amount": 40.50 }
    }
  },
  "recent_activity": [...],
  "alerts": [
    {
      "severity": "WARNING",
      "message": "2 record(s) pending da 24h-7d",
      "count": 2
    }
  ],
  "health_status": "WARNING"
}
```

**Auth**: Admin/SuperAdmin required

**Rate limit**: 10 req/min (dashboard polling)

---

## 5. GRAFANA DASHBOARD SETUP

### 5.1 Data Source

**Type**: PostgreSQL
**Connection**: Supabase DB (read-only credentials recommended)

**Query connection string**:

```
postgres://readonly_user:password@db.supabase.co:5432/postgres
```

### 5.2 Panel Queries

#### Panel 1: Pending Count (Time Series)

```sql
SELECT
  time_bucket('5 minutes', created_at) AS time,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending
FROM compensation_queue
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY time
ORDER BY time DESC;
```

**Visualization**: Graph (line)
**Alert threshold**: >5 pending for >30 minutes

---

#### Panel 2: SLA Compliance (Gauge)

```sql
SELECT
  (COUNT(*) FILTER (WHERE status = 'pending' AND created_at > NOW() - INTERVAL '7 days')::FLOAT
   / NULLIF(COUNT(*) FILTER (WHERE status = 'pending'), 0)
  ) * 100 AS sla_compliance_percent
FROM compensation_queue;
```

**Visualization**: Gauge
**Thresholds**:

- Green: >95%
- Yellow: 90-95%
- Red: <90%

---

#### Panel 3: Dead Letter Queue (Stat)

```sql
SELECT COUNT(*) AS dead_letter_count
FROM compensation_queue
WHERE status = 'dead_letter';
```

**Visualization**: Stat (big number)
**Alert**: >0 records

---

#### Panel 4: Financial Exposure (Time Series)

```sql
SELECT
  time_bucket('1 hour', created_at) AS time,
  SUM(original_cost) FILTER (WHERE status = 'pending') AS total_exposure
FROM compensation_queue
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY time
ORDER BY time DESC;
```

**Visualization**: Graph (area)
**Alert**: >€1000 exposure

---

#### Panel 5: Resolution Time Distribution (Histogram)

```sql
SELECT
  EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600 AS resolution_hours
FROM compensation_queue
WHERE status = 'resolved'
  AND resolved_at > NOW() - INTERVAL '30 days';
```

**Visualization**: Histogram
**Buckets**: 0-1h, 1-4h, 4-24h, >24h

---

### 5.3 Dashboard JSON Export

```json
{
  "dashboard": {
    "title": "Compensation Queue Monitoring",
    "tags": ["finance", "operations", "sla"],
    "timezone": "Europe/Rome",
    "refresh": "5m",
    "panels": [...]
  }
}
```

**Import**: Grafana > Dashboards > Import > Paste JSON

---

## 6. ALERTING RULES

### 6.1 Grafana Alerts

#### Alert 1: SLA Breach (P0)

**Condition**:

```sql
SELECT COUNT(*) AS count
FROM compensation_queue
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '7 days';
```

**Trigger**: `count > 0`
**Severity**: Critical
**Notification**: Email + Slack + PagerDuty

**Message**:

> 🚨 **CRITICAL: Compensation Queue SLA Breach**
>
> **Count**: {{count}} records
> **Oldest**: {{oldest_record_hours}}h
> **Action**: Immediate manual review required
>
> Dashboard: https://grafana.spediresicuro.com/d/compensation

---

#### Alert 2: High Pending Volume (P1)

**Condition**:

```sql
SELECT COUNT(*) AS count
FROM compensation_queue
WHERE status = 'pending';
```

**Trigger**: `count > 10`
**Severity**: Warning
**Notification**: Slack

**Message**:

> ⚠️ **WARNING: High Compensation Queue Volume**
>
> **Count**: {{count}} pending records
> **Exposure**: €{{total_exposure}}
> **Action**: Review queue within 4h
>
> Dashboard: https://grafana.spediresicuro.com/d/compensation

---

#### Alert 3: Dead Letter Queue (P1)

**Condition**:

```sql
SELECT COUNT(*) AS count
FROM compensation_queue
WHERE status = 'dead_letter';
```

**Trigger**: `count > 0`
**Severity**: Warning
**Notification**: Slack

**Message**:

> ⚠️ **WARNING: Dead Letter Queue Not Empty**
>
> **Count**: {{count}} records
> **Reason**: Max retries exceeded
> **Action**: Manual intervention required
>
> Review: https://app.spediresicuro.com/admin/compensation-queue

---

### 6.2 Slack Webhook Integration

**Setup**:

1. Create Slack App: https://api.slack.com/apps
2. Enable Incoming Webhooks
3. Add webhook URL to env: `SLACK_WEBHOOK_COMPENSATION_ALERTS`

**Code** (lib/alerting/slack.ts):

```typescript
export async function sendSlackAlert(message: string, severity: 'critical' | 'warning') {
  const webhookUrl = process.env.SLACK_WEBHOOK_COMPENSATION_ALERTS;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: message,
      color: severity === 'critical' ? '#FF0000' : '#FFA500',
    }),
  });
}
```

---

### 6.3 PagerDuty Integration (P0 only)

**Setup**:

1. Create PagerDuty service: https://app.pagerduty.com
2. Get Integration Key
3. Add to env: `PAGERDUTY_INTEGRATION_KEY`

**Trigger** (solo per SLA breach):

```typescript
import { EventV2 } from '@pagerduty/pdjs';

export async function triggerPagerDuty(alertData: any) {
  const event = {
    routing_key: process.env.PAGERDUTY_INTEGRATION_KEY!,
    event_action: 'trigger' as const,
    payload: {
      summary: 'Compensation Queue SLA Breach',
      severity: 'critical' as const,
      source: 'spediresicuro-compensation-queue',
      custom_details: alertData,
    },
  };

  await EventV2.sendEvent(event);
}
```

---

## 7. CRON JOBS

### 7.1 Stats Refresh (ogni 5 minuti)

**Endpoint**: `GET /api/cron/compensation-stats-refresh`

**Vercel cron config** (vercel.json):

```json
{
  "crons": [
    {
      "path": "/api/cron/compensation-stats-refresh",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**SQL**:

```sql
SELECT refresh_compensation_stats();
```

---

### 7.2 Auto-Retry (ogni 15 minuti)

**Endpoint**: `GET /api/cron/compensation-auto-retry`

**Logic**:

1. Fetch pending records con `retry_count < 3`
2. Exponential backoff: retry dopo `2^retry_count` ore
3. Call `retry_compensation(id)`
4. Se success → mark as resolved
5. Se fail → increment retry_count
6. Se max retries → move to dead_letter

---

### 7.3 Alerting Check (ogni 15 minuti)

**Endpoint**: `GET /api/cron/compensation-alerting`

**Logic**:

1. Call `get_compensation_alerts()`
2. Per ogni alert:
   - Se CRITICAL → PagerDuty + Slack + Email
   - Se WARNING → Slack

---

## 8. MANUAL OPERATIONS

### 8.1 Admin Dashboard

**URL**: `/admin/compensation-queue`

**Features**:

- 📊 Stats overview (pending, resolved, dead letter)
- 📋 Table con pending records (sortable, filterable)
- 🔄 Manual retry button
- ✅ Mark as resolved (con notes)
- 🚨 Dead letter queue review

---

### 8.2 SQL Queries (Troubleshooting)

#### Get pending records (oldest first)

```sql
SELECT
  id,
  user_id,
  action,
  original_cost,
  created_at,
  NOW() - created_at AS age,
  retry_count,
  error_context->>'courier_error' AS error
FROM compensation_queue
WHERE status = 'pending'
ORDER BY created_at ASC
LIMIT 20;
```

---

#### Get dead letter queue

```sql
SELECT
  id,
  user_id,
  action,
  original_cost,
  retry_count,
  dead_letter_reason,
  error_context
FROM compensation_queue
WHERE status = 'dead_letter'
ORDER BY created_at DESC;
```

---

#### Mark record as resolved (manual)

```sql
SELECT mark_compensation_resolved(
  '550e8400-e29b-41d4-a716-446655440000', -- id
  'Manual refund via Stripe dashboard' -- resolution_notes
);
```

---

## 9. RUNBOOK - INCIDENT RESPONSE

### 9.1 CRITICAL: SLA Breach (Pending >7 giorni)

**Severity**: P0
**Response time**: Immediate (on-call)

**Steps**:

1. **Verify**: Check Grafana dashboard per confirm alert
2. **Assess**: Query pending records, check `original_cost`
3. **Triage**:
   - High value (>€100): Immediate manual refund
   - Standard: Attempt auto-retry
   - Low value (<€20): Batch process
4. **Refund**:
   - Call `increment_wallet_balance(user_id, amount, idempotency_key)`
   - Mark as resolved: `mark_compensation_resolved(id, notes)`
5. **Root cause**: Investigate `error_context` per capire why retry failed
6. **Post-mortem**: Document in incident log

**Escalation**: Se >€500 exposure → notify CFO

---

### 9.2 WARNING: High Pending Volume

**Severity**: P1
**Response time**: 4 hours

**Steps**:

1. **Check**: Dashboard per verify trend (spike or sustained?)
2. **Identify pattern**:
   - Specific carrier failing? (error_context)
   - Specific user? (bulk operation failed?)
3. **Batch retry**: Use auto-retry CRON
4. **Monitor**: Track resolution rate
5. **Alert stakeholders**: Se trend continua >24h

---

### 9.3 Dead Letter Queue

**Severity**: P1
**Response time**: 24 hours

**Steps**:

1. **Review records**: Check `dead_letter_reason`
2. **Manual refund**: Non-automatable (max retries failed)
3. **Update system**: Se common failure pattern → fix + redeploy
4. **Mark resolved**: Con notes per audit trail

---

## 10. TESTING

### 10.1 Smoke Test: Create Compensation Record

```bash
npm run test:compensation-queue
```

**Script** (scripts/test-compensation-queue.ts):

```typescript
// Create test record
const { data, error } = await supabase.from('compensation_queue').insert({
  user_id: testUserId,
  action: 'REFUND',
  original_cost: 10.0,
  status: 'pending',
});

// Verify stats update
const stats = await fetch('/api/admin/compensation-queue/stats');
expect(stats.pending_count).toBeGreaterThan(0);

// Mark resolved
await supabase.rpc('mark_compensation_resolved', {
  p_compensation_id: data.id,
  p_resolution_notes: 'Test refund',
});
```

---

### 10.2 Load Test: High Volume

**Goal**: Verify dashboard performance con >100 pending records

**Tool**: k6 load testing

---

## 11. PRODUCTION CHECKLIST

### Pre-Deploy

- [ ] Migration 100 applicata (resolved_at, retry_count, dead_letter)
- [ ] Grafana dashboard imported
- [ ] Slack webhook configured
- [ ] PagerDuty integration key set
- [ ] CRON jobs configured (Vercel cron or external)
- [ ] Admin dashboard deployed

### Post-Deploy

- [ ] Verify stats endpoint returns data
- [ ] Test alert trigger (manual insert pending >7d record)
- [ ] Verify Slack notification received
- [ ] Verify PagerDuty incident created
- [ ] Document runbook in wiki
- [ ] Train support team

---

## 12. COSTS

**Grafana Cloud**: ~$50/month (Starter plan)
**PagerDuty**: ~$25/user/month (Professional plan)
**Slack**: Free (webhook only)

**Total**: ~$75-150/month (depending on team size)

---

## CONTACTS

**On-call**: compensation-queue-alerts@spediresicuro.com
**Slack channel**: #compensation-queue-alerts
**Runbook**: https://wiki.spediresicuro.com/runbooks/compensation-queue

---

**END OF DOCUMENT**
