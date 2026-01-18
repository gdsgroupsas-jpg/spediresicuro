# M2: APM & Log Aggregation - Implementation Documentation

**Implementation Date**: 2026-01-18
**Status**: ✅ COMPLETED
**Cost**: €0/month (Sentry FREE tier + Better Stack FREE tier)
**Implementation Time**: ~4 hours

---

## 📋 Obiettivo

Implementare **Application Performance Monitoring (APM)** e **Log Aggregation** per tracciabilità end-to-end di tutte le richieste HTTP, database queries, e chiamate API esterne.

---

## ✅ Componenti Implementati

### 1. **Sentry Performance Monitoring** (FREE tier: 10K transactions/month)

**Configurazione**:
- `sentry.server.config.ts`: `tracesSampleRate: 0.1` (10% sampling)
- `sentry.client.config.ts`: `tracesSampleRate: 0.1` (10% sampling)
- `sentry.edge.config.ts`: `tracesSampleRate: 0.1` (10% sampling)

**Environment Variables**:
```bash
SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.0  # Keep profiling disabled (€0 cost)
```

### 2. **Enhanced Logger con Trace Context** ([lib/logger.ts](lib/logger.ts))

**Nuove Features**:
- `getTraceContext()`: Estrae `traceId` e `spanId` da Sentry automaticamente
- `createLogger()`: Include trace context nei logs (backward compatible)
- `createLoggerWithTrace()`: Per operazioni async con trace context esplicito

**Esempio**:
```typescript
import { createLogger } from '@/lib/logger';

const logger = createLogger(requestId, userId);
logger.info('Operazione completata', { shipmentId: '123' });
// Log include automaticamente: requestId, userId, traceId, spanId
```

### 3. **Database Instrumentation** ([lib/db/instrumented-client.ts](lib/db/instrumented-client.ts))

**Wrapper automatico per Supabase client**:
- Crea Sentry spans per TUTTE le query (select, insert, update, delete, upsert, rpc)
- Traccia durata query e errori
- Log automatico per query lente (>1s) o errori

**Esempio**:
```typescript
import { instrumentSupabaseClient } from '@/lib/db/instrumented-client';
import { supabaseAdmin } from '@/lib/supabase';

const db = instrumentSupabaseClient(supabaseAdmin, requestId);
const { data } = await db.from('shipments').select('*').limit(10);
// Automaticamente crea span "supabase.shipments.select" in Sentry
```

### 4. **External API Instrumentation** ([lib/services/instrumented-fetch.ts](lib/services/instrumented-fetch.ts))

**Wrapper fetch() con tracing automatico**:
- Crea Sentry spans per chiamate API esterne
- Auto-detection servizi (stripe, ups, dhl, anthropic, etc.)
- Sanitizza URL e headers sensibili
- Log automatico per errori o chiamate lente (>2s)

**Esempio**:
```typescript
import { instrumentedFetch, stripeFetch } from '@/lib/services/instrumented-fetch';

// Metodo 1: Auto-detection
const response = await instrumentedFetch('https://api.stripe.com/v1/customers');

// Metodo 2: Helper pre-configurato
const customer = await stripeFetch('https://api.stripe.com/v1/customers/cus_123', {
  method: 'GET',
  headers: { Authorization: `Bearer ${STRIPE_KEY}` }
});
```

### 5. **Middleware Root Span** ([middleware.ts](middleware.ts))

**Root span per distributed tracing**:
- Ogni richiesta HTTP crea span `http.server`
- Attributi: method, url, route, request_id, user_id, status_code
- Tutti gli span figli (DB, API) collegati automaticamente

**Distributed Tracing Flow**:
```
HTTP Request → Middleware (ROOT SPAN)
  ├─ Database Query (CHILD SPAN) - via instrumentedClient
  ├─ External API Call (CHILD SPAN) - via instrumentedFetch
  └─ Business Logic (CHILD SPAN) - manual spans
```

### 6. **Better Stack (Logtail) Integration**

**Setup**:
- Integrazione Vercel → Better Stack (automatic log shipping)
- FREE tier: 1GB/month, 1-day retention
- Logs strutturati JSON con trace context

**Environment Variable**:
```bash
LOGTAIL_SOURCE_TOKEN=VCtQAkJJbmQfN1N9vgTt4bFT
```

---

## 🧪 Testing

### Test Endpoints

#### 1. **M2 APM Test** ([app/api/test/m2-apm/route.ts](app/api/test/m2-apm/route.ts))

**Test distributed tracing**:
```bash
curl http://localhost:3000/api/test/m2-apm
# or
curl https://spediresicuro.vercel.app/api/test/m2-apm
```

**Expected Result**:
```json
{
  "success": true,
  "tests": {
    "database": { "success": true, "duration": 150, "rowsReturned": 3 },
    "externalApi": { "success": true, "duration": 300, "status": 200 },
    "manualSpan": { "success": true }
  },
  "tracing": {
    "requestId": "...",
    "traceId": "...",
    "spanId": "..."
  }
}
```

**Verify in Sentry**:
1. Go to Sentry → Performance → Transactions
2. Search for `GET /api/test/m2-apm`
3. You should see:
   - Root span: `http.server`
   - Child span: `db.query.users`
   - Child span: `http.client httpbin`
   - Child span: `custom.operation test-manual-span`

#### 2. **M2 Logging Test** ([app/api/test/m2-logging/route.ts](app/api/test/m2-logging/route.ts))

**Test log aggregation**:
```bash
curl http://localhost:3000/api/test/m2-logging
# or
curl https://spediresicuro.vercel.app/api/test/m2-logging
```

**Expected Result**:
```json
{
  "success": true,
  "tests": {
    "infoLog": { "success": true },
    "piiSanitization": { "success": true, "redactedFields": ["password", "apiKey"] },
    "errorLog": { "success": true },
    "traceContext": { "success": true, "traceId": "...", "spanId": "..." }
  },
  "logging": {
    "requestId": "...",
    "traceId": "...",
    "logsShippedTo": "Better Stack (via Vercel integration)"
  }
}
```

**Verify in Better Stack**:
1. Go to Better Stack → Live Tail
2. Search for `requestId` from response
3. You should see 6 log entries:
   - INFO: M2 Logging Test started
   - WARN: Testing PII sanitization (password/apiKey redacted)
   - ERROR: Caught test error (with stack trace)
   - INFO: Log with trace context
   - DEBUG: Debug log test (only in development)
   - INFO: Slow operation completed

**Verify Trace Correlation**:
1. Copy `traceId` from response
2. Search in Sentry Performance → Should link to this request
3. All logs and spans linked via same `traceId`

---

## 📊 Monitoring Dashboards

### Sentry Performance Dashboard

**URL**: https://sentry.io/organizations/spediresicuro/performance/

**Key Metrics**:
- Transaction throughput (requests/minute)
- P50/P95/P99 latency
- Error rate
- Slowest transactions
- Database query performance
- External API call performance

**Useful Views**:
1. **Transactions**: Overview of all HTTP requests
2. **Database**: Supabase query performance
3. **External Services**: Stripe, courier APIs, etc.
4. **Errors**: Linked errors with full context

### Better Stack Dashboard

**URL**: https://logs.betterstack.com

**Key Features**:
- Live Tail: Real-time log streaming
- Search by: requestId, traceId, userId, level
- Filters: error logs, slow requests (>1s)
- Alerts: Configure alerts for specific patterns

**Common Queries**:
```
# Find all logs for a specific request
requestId:"lvwabc123-xyz456"

# Find all errors
level:"error"

# Find slow database queries
message:"DB *" AND duration:>1000

# Find logs for specific user (hashed)
userId:"a1b2c3d4"

# Find logs linked to Sentry trace
traceId:"1234567890abcdef"
```

---

## 🔧 Usage Guide

### How to Use Instrumented Client

**Apply to API routes that use Supabase**:

```typescript
// Before (no tracing)
import { supabaseAdmin } from '@/lib/supabase';

const { data } = await supabaseAdmin.from('shipments').select('*');

// After (with tracing)
import { instrumentSupabaseClient } from '@/lib/db/instrumented-client';
import { supabaseAdmin } from '@/lib/supabase';

const db = instrumentSupabaseClient(supabaseAdmin, requestId);
const { data } = await db.from('shipments').select('*');
// Automatically creates Sentry span + logs slow queries
```

### How to Use Instrumented Fetch

**Apply to API routes that call external services**:

```typescript
// Before (no tracing)
const response = await fetch('https://api.stripe.com/v1/customers');

// After (with tracing)
import { stripeFetch } from '@/lib/services/instrumented-fetch';

const response = await stripeFetch('https://api.stripe.com/v1/customers', {
  method: 'GET',
  headers: { Authorization: `Bearer ${STRIPE_KEY}` }
});
// Automatically creates Sentry span + logs errors
```

### How to Create Manual Spans

**For complex business logic**:

```typescript
import * as Sentry from '@sentry/nextjs';

await Sentry.startSpan(
  {
    op: 'business.logic',
    name: 'calculate-shipping-cost',
    attributes: {
      shipmentId: '123',
      courier: 'UPS',
    }
  },
  async () => {
    // Your business logic here
    const cost = await calculateShippingCost(shipment);
    return cost;
  }
);
```

---

## 🚨 Troubleshooting

### Problem: Traces not appearing in Sentry

**Possible causes**:
1. Sampling rate too low (10% = only 1 in 10 requests traced)
2. Environment variable not set
3. Sentry DSN incorrect

**Solution**:
```bash
# Check environment variables
echo $SENTRY_TRACES_SAMPLE_RATE  # Should be 0.1
echo $SENTRY_DSN                 # Should be set

# Temporarily increase sampling for testing
SENTRY_TRACES_SAMPLE_RATE=1.0  # 100% sampling (dev only!)
```

### Problem: Logs not appearing in Better Stack

**Possible causes**:
1. Vercel integration not configured
2. LOGTAIL_SOURCE_TOKEN not set
3. Logs not in production (dev logs may not be shipped)

**Solution**:
```bash
# Check Vercel integration
vercel integrations list

# Check token
vercel env ls | grep LOGTAIL

# Test logging
curl https://spediresicuro.vercel.app/api/test/m2-logging
```

### Problem: traceId not linking logs to Sentry

**Possible causes**:
1. Logger created outside Sentry span context
2. Async operation lost context

**Solution**:
```typescript
// BAD: Logger created before span
const logger = createLogger(requestId);
await Sentry.startSpan({ ... }, async () => {
  logger.info('Test');  // No traceId!
});

// GOOD: Logger created inside span
await Sentry.startSpan({ ... }, async () => {
  const logger = createLogger(requestId);
  logger.info('Test');  // Has traceId!
});
```

---

## 📈 Cost Analysis

| Service | Free Tier | Expected Usage | Monthly Cost |
|---------|-----------|----------------|--------------|
| Sentry Transactions | 10K/month | ~3K/month (10% sample) | €0 |
| Better Stack Logs | 1GB/month | ~500MB/month | €0 |
| **TOTAL** | | | **€0/month** |

**Scaling Plan**:
- If traffic grows >30K requests/month → Reduce sampling to 5% (0.05)
- If logs exceed 1GB/month → Upgrade Better Stack (€10/month for 5GB)
- Sentry remains FREE up to 10K sampled transactions

---

## 🎯 Next Steps (M2 Future Enhancements)

1. **Console.log Migration** (Optional, ~2-3 hours):
   - Migrate ~462 console.log in `app/api` to structured logging
   - Priority: spedizioni, stripe webhook, cron jobs

2. **Custom Dashboards** (Optional):
   - Create Sentry dashboard for critical paths
   - Better Stack saved searches for common patterns

3. **Alerting** (Optional):
   - Sentry alerts for error spikes
   - Better Stack alerts for critical errors

---

## 📝 Files Modified/Created

### Modified Files
- [sentry.server.config.ts](sentry.server.config.ts) - Enabled tracing
- [sentry.client.config.ts](sentry.client.config.ts) - Enabled tracing
- [sentry.edge.config.ts](sentry.edge.config.ts) - Enabled tracing
- [lib/logger.ts](lib/logger.ts) - Added trace context
- [middleware.ts](middleware.ts) - Added root span
- [.env.local](.env.local) - Added LOGTAIL_SOURCE_TOKEN

### New Files
- [lib/db/instrumented-client.ts](lib/db/instrumented-client.ts) - DB instrumentation
- [lib/services/instrumented-fetch.ts](lib/services/instrumented-fetch.ts) - API instrumentation
- [app/api/test/m2-apm/route.ts](app/api/test/m2-apm/route.ts) - APM test endpoint
- [app/api/test/m2-logging/route.ts](app/api/test/m2-logging/route.ts) - Logging test endpoint
- [types/admin.ts](types/admin.ts) - Shared admin types (bugfix)
- [MONITORING_M2_IMPLEMENTATION.md](MONITORING_M2_IMPLEMENTATION.md) - This file

---

## ✅ Success Criteria (All Met)

- [x] Sentry Performance enabled (10% sampling)
- [x] Better Stack log aggregation configured
- [x] Distributed tracing working (middleware → DB → API)
- [x] Trace context in logs (requestId, traceId, spanId)
- [x] Database instrumentation (automatic spans)
- [x] External API instrumentation (automatic spans)
- [x] Test endpoints created and validated
- [x] Documentation complete
- [x] Cost: €0/month
- [x] Zero breaking changes

---

## 🔗 Related Documentation

- [M1 Implementation](MONITORING_M1_IMPLEMENTATION.md) - Sentry + Slack + Health checks
- [Plan: M2-M4](docs/PLAN_M2_M4_MONITORING.md) - Full monitoring roadmap
- [Sentry Performance Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/performance/)
- [Better Stack Docs](https://betterstack.com/docs/logs/)

---

**Implementation by**: Claude Sonnet 4.5
**Date**: 2026-01-18
**Status**: ✅ Production Ready
