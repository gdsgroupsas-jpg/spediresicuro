# Performance Monitoring Guide

**Last Updated:** 2026-01-21

---

## Overview

SpedireSicuro uses a multi-layered monitoring approach to track application performance, user experience, and system health.

---

## Monitoring Stack

| Tool                      | Purpose                             | Dashboard                                            |
| ------------------------- | ----------------------------------- | ---------------------------------------------------- |
| **Vercel Analytics**      | Real User Metrics (RUM), Web Vitals | [Vercel Dashboard](https://vercel.com/dashboard)     |
| **Vercel Speed Insights** | Core Web Vitals, Performance Score  | [Vercel Dashboard](https://vercel.com/dashboard)     |
| **Sentry Performance**    | Transaction traces, API latency     | [Sentry Dashboard](https://sentry.io)                |
| **Sentry Profiling**      | CPU profiling, slow functions       | [Sentry Dashboard](https://sentry.io)                |
| **Supabase Metrics**      | Database performance, connections   | [Supabase Dashboard](https://supabase.com/dashboard) |

---

## Core Web Vitals Targets

| Metric                              | Target  | Description          |
| ----------------------------------- | ------- | -------------------- |
| **LCP** (Largest Contentful Paint)  | < 2.5s  | Main content visible |
| **FID** (First Input Delay)         | < 100ms | Time to interactive  |
| **CLS** (Cumulative Layout Shift)   | < 0.1   | Visual stability     |
| **TTFB** (Time to First Byte)       | < 800ms | Server response time |
| **INP** (Interaction to Next Paint) | < 200ms | Responsiveness       |

---

## Sentry Configuration

### Client-Side (sentry.client.config.ts)

```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 10% of transactions traced in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.0,

  // 10% of transactions profiled
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.0,

  // 100% of error sessions captured for replay
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true, // Privacy: mask all text
      blockAllMedia: true, // Privacy: block media
    }),
  ],
});
```

### Server-Side (sentry.server.config.ts)

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,

  // Filter out noise
  beforeSendTransaction(event) {
    const url = event.request?.url || '';
    if (url.includes('/api/health') || url.includes('/api/cron')) {
      return null; // Skip health checks
    }
    return event;
  },
});
```

### Environment Variables

| Variable                      | Default | Description                  |
| ----------------------------- | ------- | ---------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN`      | -       | Client-side Sentry DSN       |
| `SENTRY_DSN`                  | -       | Server-side Sentry DSN       |
| `SENTRY_TRACES_SAMPLE_RATE`   | 0.1     | % of transactions to trace   |
| `SENTRY_PROFILES_SAMPLE_RATE` | 0.1     | % of transactions to profile |

---

## Vercel Analytics

### Automatic Tracking

Vercel Analytics automatically tracks:

- Page views
- Core Web Vitals (LCP, FID, CLS)
- Geographic distribution
- Device types
- Browser distribution

### Integration

Already integrated in `app/layout.tsx`:

```tsx
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

// In body:
<Analytics />
<SpeedInsights />
```

---

## Health Endpoints

### Liveness Probe

```
GET /api/health/live
```

Returns `200 OK` if the application is running.

### Readiness Probe

```
GET /api/health/ready
```

Returns `200 OK` if all dependencies are healthy:

- Database connection
- Redis connection
- External API availability

---

## Key Metrics to Monitor

### Application Performance

| Metric            | Alert Threshold | Action                 |
| ----------------- | --------------- | ---------------------- |
| Error rate        | > 1%            | Investigate error logs |
| p95 response time | > 2s            | Profile slow endpoints |
| p99 response time | > 5s            | Scale or optimize      |

### Database Performance

| Metric          | Alert Threshold | Action                |
| --------------- | --------------- | --------------------- |
| Connection pool | > 80%           | Increase pool size    |
| Query time p95  | > 500ms         | Add indexes, optimize |
| Dead tuples     | > 10%           | Run vacuum            |

### API Latency

| Endpoint         | Target p95 | Current |
| ---------------- | ---------- | ------- |
| `/api/quotes`    | < 500ms    | Monitor |
| `/api/shipments` | < 1s       | Monitor |
| `/api/anne/chat` | < 3s       | Monitor |

---

## Alerting Rules

### Sentry Alerts

Configure in Sentry Dashboard > Alerts:

1. **Error Spike Alert**
   - Condition: Error count > 10 in 5 minutes
   - Action: Slack notification

2. **Performance Degradation**
   - Condition: p95 > 3s for 10 minutes
   - Action: Email notification

3. **New Error Type**
   - Condition: First occurrence of error
   - Action: Slack notification

### Vercel Alerts

Configure in Vercel Dashboard > Project > Settings > Notifications:

1. **Deployment Failed**
2. **Build Failed**
3. **Domain Expiring**

---

## Debugging Performance Issues

### Step 1: Identify the Problem

1. Check Sentry Performance dashboard
2. Look for slow transactions
3. Identify the slowest span (database, API, rendering)

### Step 2: Profile

```bash
# Enable profiling temporarily (100%)
SENTRY_PROFILES_SAMPLE_RATE=1.0 npm run dev
```

### Step 3: Analyze

1. Open transaction in Sentry
2. View flame graph
3. Identify hot spots

### Step 4: Optimize

Common optimizations:

- Add database indexes
- Implement caching (Redis)
- Lazy load components
- Optimize images
- Reduce bundle size

---

## Bundle Analysis

### Analyze Bundle Size

```bash
# Generate bundle analysis
ANALYZE=true npm run build
```

### Target Bundle Sizes

| Bundle        | Target  | Action if Exceeded    |
| ------------- | ------- | --------------------- |
| First Load JS | < 100KB | Code split, lazy load |
| Total JS      | < 500KB | Review dependencies   |
| Main chunk    | < 200KB | Split routes          |

---

## Database Monitoring

### Supabase Dashboard

Monitor in Supabase Dashboard > Project > Database:

1. **Active Connections** - Stay under pool limit
2. **Database Size** - Plan for growth
3. **Slow Queries** - Optimize or add indexes

### Query Performance

```sql
-- Find slow queries
SELECT
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

## Runbook: Performance Incident

### Symptoms

- Users reporting slow pages
- Error rate spike
- Timeout errors

### Investigation

1. **Check Vercel Status** - Infrastructure issue?
2. **Check Sentry** - New errors or slow transactions?
3. **Check Supabase** - Database healthy?
4. **Check Upstash** - Redis available?

### Quick Fixes

1. **Clear cache**: Redis keys or CDN
2. **Scale**: Increase Vercel function memory
3. **Rollback**: Revert to previous deployment

---

## Cost Optimization

### Sentry Quota Management

| Feature      | Cost Impact | Recommendation |
| ------------ | ----------- | -------------- |
| Errors       | Low         | Keep 100%      |
| Transactions | Medium      | 10% sample     |
| Profiles     | Medium      | 10% sample     |
| Replays      | High        | Only on errors |

### Vercel Analytics

- **Pro Plan**: Included
- **Enterprise**: Additional cost for higher volume

---

**Document Version:** 1.0
**Next Review:** 2026-04-21
