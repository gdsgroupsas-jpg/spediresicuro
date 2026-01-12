# Monitoring & Operations

## Overview
Guida completa per monitoring, alerting e operazioni di SpedireSicuro in produzione.

## Target Audience
- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents

## Prerequisites
- Accesso a Vercel Dashboard
- Accesso a Supabase Dashboard
- Conoscenza monitoring concepts

---

## Monitoring Stack

### 1. Vercel Analytics

**Metrics:**
- Page views
- Performance (Web Vitals)
- Real User Monitoring (RUM)
- Error tracking

**Access:**
- Vercel Dashboard → Analytics

---

### 2. Supabase Monitoring

**Metrics:**
- Database performance
- Query performance
- Connection pool
- Storage usage

**Access:**
- Supabase Dashboard → Monitoring

---

### 3. Application Logs

**Location:**
- Vercel Dashboard → Logs
- Server-side logs in Vercel Functions
- Client-side errors in browser console

**Log Levels:**
- `error` - Critical errors
- `warn` - Warnings
- `info` - Informational
- `debug` - Debug (development only)

---

## Health Checks

### `/api/health`

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-12T10:00:00Z",
  "version": "1.0.0"
}
```

**Purpose:**
- Verify application is running
- Load balancer health check
- Deployment verification

**Monitoring:**
- Check every 5 minutes
- Alert if status != "ok"

---

## Key Metrics

### Application Metrics

**Response Time:**
- Target: < 2s (p95)
- Alert: > 5s (p95)

**Error Rate:**
- Target: < 0.1%
- Alert: > 1%

**Uptime:**
- Target: 99.9%
- Alert: < 99%

---

### Business Metrics

**Shipments:**
- Created per day
- Success rate
- Average cost

**Wallet:**
- Transactions per day
- Top-ups per day
- Average balance

**Users:**
- Active users
- New registrations
- Conversion rate

---

## Alerting

### Critical Alerts (P0)

**Application Down:**
- `/api/health` returns non-200
- Response time > 10s
- Error rate > 5%

**Database Issues:**
- Connection pool exhausted
- Query timeout
- RLS policy failures

**Security Issues:**
- Unauthorized access attempts
- Failed authentication spikes
- RLS bypass attempts

---

### Important Alerts (P1)

**Performance Degradation:**
- Response time > 5s (p95)
- Error rate > 1%
- Database slow queries

**Business Logic Issues:**
- Wallet balance inconsistencies
- Shipment creation failures
- Payment processing failures

---

### Informational Alerts (P2)

**Usage Spikes:**
- Unusual traffic patterns
- High API usage
- Storage growth

---

## Logging Best Practices

### Structured Logging

**Good:**
```typescript
console.log(JSON.stringify({
  event: 'shipment_created',
  shipment_id: shipmentId,
  user_id_hash: userId.substring(0, 8) + '***',
  cost: 12.50,
  timestamp: new Date().toISOString(),
}));
```

**Bad:**
```typescript
console.log('Shipment created:', shipmentId, userId); // PII exposed!
```

---

### Log Levels

**Error:**
```typescript
console.error('Operation failed:', error, {
  context: 'shipment_creation',
  userId: userIdHash,
});
```

**Warn:**
```typescript
console.warn('Slow query detected:', {
  query: 'SELECT * FROM shipments',
  duration: 5000,
});
```

**Info:**
```typescript
console.log('Shipment created:', {
  shipmentId,
  cost: 12.50,
});
```

---

## Error Tracking

### Error Monitoring

**Vercel:**
- Automatic error tracking
- Error grouping
- Stack traces
- User context

**Custom Error Tracking:**
```typescript
import { trackApiError } from '@/lib/api/error-tracker';

try {
  // ... operation
} catch (error) {
  trackApiError(error, requestId, userId);
  throw error;
}
```

---

### Error Response Format

**Standard:**
```json
{
  "error": "Operation failed",
  "code": "INTERNAL_ERROR"
}
```

**With Details (Development):**
```json
{
  "error": "Operation failed",
  "code": "INTERNAL_ERROR",
  "details": {
    "message": "Database connection failed",
    "stack": "..."
  }
}
```

**⚠️ IMPORTANTE:** Non esporre stack traces in produzione.

---

## Performance Monitoring

### Web Vitals

**Metrics:**
- **LCP (Largest Contentful Paint):** < 2.5s
- **FID (First Input Delay):** < 100ms
- **CLS (Cumulative Layout Shift):** < 0.1

**Monitoring:**
- Vercel Analytics → Web Vitals
- Real User Monitoring (RUM)

---

### API Performance

**Metrics:**
- Response time (p50, p95, p99)
- Throughput (requests/second)
- Error rate

**Monitoring:**
- Vercel Dashboard → Functions
- Custom logging

---

## Database Monitoring

### Supabase Dashboard

**Metrics:**
- Query performance
- Connection pool usage
- Storage usage
- Active connections

**Alerts:**
- Slow queries (> 1s)
- Connection pool exhaustion
- Storage > 80%

---

### Query Optimization

**Slow Query Detection:**
```sql
SELECT 
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## Incident Response

### Incident Procedure

1. **Identify:** Check alerts, logs, metrics
2. **Assess:** Determine severity (P0/P1/P2)
3. **Mitigate:** Apply quick fix if possible
4. **Investigate:** Root cause analysis
5. **Resolve:** Permanent fix
6. **Document:** Post-mortem

---

### Rollback Procedure

**Vercel:**
1. Go to Deployments
2. Find previous working deployment
3. Promote to Production

**Database:**
1. Check if migration has rollback
2. Run rollback migration if available
3. Manual intervention if needed

---

## Maintenance Windows

### Scheduled Maintenance

**Frequency:** Monthly (if needed)

**Process:**
1. Notify users (24h before)
2. Put app in maintenance mode
3. Apply updates
4. Verify functionality
5. Remove maintenance mode

---

## Related Documentation

- [Deployment](../6-DEPLOYMENT/OVERVIEW.md) - Deployment process
- [CI/CD](../6-DEPLOYMENT/CI_CD.md) - CI/CD pipelines
- [Security](../8-SECURITY/OVERVIEW.md) - Security monitoring
- [Troubleshooting](../12-TROUBLESHOOTING/COMMON_ISSUES.md) - Common issues

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0.0 | Initial version | Dev Team |

---

*Last Updated: 2026-01-12*  
*Status: 🟢 Active*  
*Maintainer: Dev Team*
