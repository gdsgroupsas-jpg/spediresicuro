# Load Testing Guide

Guida completa per load testing di SpedireSicuro con k6.

---

## 🎯 **Overview**

Load testing per validare performance, scalability e resilience sotto carico.

**Obiettivi:**

- ✅ Validare SLA (p95 < 500ms)
- ✅ Identificare bottleneck
- ✅ Capacity planning
- ✅ Regression detection

---

## 🚀 **Quick Start**

### **Install k6**

```bash
# macOS
brew install k6

# Windows
choco install k6

# Linux
sudo apt-get install k6
```

### **Run Test**

```bash
# Smoke test (quick validation)
k6 run tests/load/pricing-api.k6.js

# With custom config
k6 run --vus 50 --duration 5m tests/load/pricing-api.k6.js

# Against staging
BASE_URL=https://staging.spediresicuro.vercel.app k6 run tests/load/pricing-api.k6.js
```

---

## 📊 **Test Types**

### **1. Smoke Test**

**Purpose:** Quick sanity check (does it work at all?)

**Config:**

- VUs: 5-10
- Duration: 30s-1min
- Expected: 0 errors

```bash
k6 run --vus 10 --duration 30s tests/load/pricing-api.k6.js
```

**When to run:** Before every deployment

---

### **2. Load Test**

**Purpose:** Validate performance under typical load

**Config:**

- VUs: 50-100
- Duration: 5-10min
- Expected: p95 < 500ms, errors < 1%

```bash
k6 run --vus 50 --duration 5m tests/load/pricing-api.k6.js
```

**When to run:** Weekly, after major changes

---

### **3. Stress Test**

**Purpose:** Find breaking point

**Config:**

- VUs: Ramp 0 → 200
- Duration: 10min
- Expected: Graceful degradation

```bash
k6 run tests/load/pricing-api.k6.js # Uses stress scenario
```

**When to run:** Monthly, before major releases

---

### **4. Spike Test**

**Purpose:** Validate autoscaling

**Config:**

- VUs: Sudden spike 10 → 200 → 10
- Duration: 5min
- Expected: Quick recovery

```bash
k6 run tests/load/spike-test.k6.js
```

**When to run:** Before Black Friday, major marketing campaigns

---

### **5. Soak Test**

**Purpose:** Find memory leaks, resource exhaustion

**Config:**

- VUs: 50 (constant)
- Duration: 2-4 hours
- Expected: Stable performance over time

```bash
k6 run --vus 50 --duration 2h tests/load/pricing-api.k6.js
```

**When to run:** Before v1.0, quarterly

---

## 📈 **Performance Baselines**

### **Current Targets (v1.0.0)**

| Endpoint                  | p50    | p95    | p99     | Error Rate |
| ------------------------- | ------ | ------ | ------- | ---------- |
| `GET /api/health`         | <50ms  | <100ms | <200ms  | <0.1%      |
| `POST /api/pricing/quote` | <200ms | <500ms | <1000ms | <1%        |
| `POST /api/shipments`     | <300ms | <800ms | <1500ms | <1%        |
| `GET /api/shipments`      | <100ms | <300ms | <600ms  | <0.5%      |
| `GET /api/wallet/balance` | <50ms  | <150ms | <300ms  | <0.5%      |

### **Infrastructure Limits**

| Resource                 | Limit            | Current Usage | Headroom |
| ------------------------ | ---------------- | ------------- | -------- |
| **Vercel Functions**     | 10s timeout      | p99: 1.5s     | 85%      |
| **Supabase Connections** | 60 (free tier)   | ~20 avg       | 67%      |
| **Upstash Redis**        | 10k commands/day | ~2k/day       | 80%      |
| **Anthropic API**        | 500 req/min      | ~50/min       | 90%      |

---

## 🧪 **Test Scenarios**

### **Scenario 1: Typical User Journey**

Simula un utente reale:

```javascript
export default function () {
  // 1. Get quote
  const quote = http.post(`${BASE_URL}/api/pricing/quote`, quotePayload);
  check(quote, { 'quote ok': (r) => r.status === 200 });
  sleep(5); // User reads results

  // 2. Create shipment
  const shipment = http.post(`${BASE_URL}/api/shipments`, shipmentPayload);
  check(shipment, { 'shipment ok': (r) => r.status === 201 });
  sleep(2);

  // 3. Check wallet
  const wallet = http.get(`${BASE_URL}/api/wallet/balance`);
  check(wallet, { 'wallet ok': (r) => r.status === 200 });
}
```

### **Scenario 2: API-Only (Server-to-Server)**

High throughput, no think time:

```javascript
export default function () {
  const response = http.post(`${BASE_URL}/api/pricing/quote`, payload, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  // No sleep - max throughput
}
```

### **Scenario 3: AI Agent Heavy**

Stress AI endpoints:

```javascript
export default function () {
  const chat = http.post(`${BASE_URL}/api/ai/agent-chat`, {
    message: 'Voglio spedire un pacco',
    sessionId: __VU, // Unique session per VU
  });
  sleep(3);
}
```

---

## 🔍 **Monitoring During Tests**

### **Real-time Dashboards**

Monitor questi metriche durante load test:

1. **Vercel Dashboard**
   - Function duration (p95, p99)
   - Error rate
   - Function invocations/min

2. **Supabase Dashboard**
   - Database connections
   - Query duration
   - Connection pool saturation

3. **Upstash Dashboard**
   - Commands/second
   - Latency
   - Hit rate

4. **k6 Output**
   - Live terminal output
   - `k6 run --out dashboard` for web UI

---

## 📊 **Result Analysis**

### **Good Result Example**

```
✓ http_req_duration........: avg=245ms p95=450ms p99=850ms
✓ http_req_failed..........: 0.12% (12 of 10000)
✓ errors...................: 0.08% (8 of 10000)
```

**Interpretation:** All thresholds met, system healthy.

---

### **Warning Signals**

```
✗ http_req_duration........: avg=850ms p95=2100ms p99=4500ms
✗ http_req_failed..........: 2.5% (250 of 10000)
```

**Interpretation:** Degraded performance, investigate:

- Database slow queries
- External API timeout (Poste, Spedisci)
- Function cold starts

---

### **Critical Issues**

```
✗ http_req_duration........: avg=5200ms p95=15000ms p99=timeout
✗ http_req_failed..........: 45% (4500 of 10000)
```

**Interpretation:** System overloaded, DO NOT DEPLOY:

- Connection pool exhausted
- Memory leak
- Infinite loop

---

## 🛠️ **Troubleshooting**

### **High Latency (p95 > 1s)**

**Investigate:**

1. Supabase query performance: Check slow query log
2. External API calls: Add timeout monitoring
3. Function cold starts: Use reserved instances

**Fix:**

- Add database indexes
- Implement caching (Redis)
- Optimize SQL queries

---

### **High Error Rate (>5%)**

**Investigate:**

1. Error logs in Sentry
2. Database connection errors
3. Rate limiting hits

**Fix:**

- Increase connection pool
- Add retry logic with exponential backoff
- Implement circuit breaker

---

### **Timeout Errors**

**Investigate:**

1. Vercel function timeout (10s limit)
2. External API timeout (Poste/Spedisci)

**Fix:**

- Break long operations into smaller chunks
- Use background jobs for heavy tasks
- Increase external API timeout

---

## 📋 **CI/CD Integration**

### **GitHub Actions Workflow**

```yaml
# .github/workflows/load-test.yml
name: Load Test

on:
  schedule:
    - cron: '0 3 * * 1' # Every Monday 3am
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run smoke test
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
          API_KEY: ${{ secrets.TEST_API_KEY }}
        run: k6 run --vus 10 --duration 30s tests/load/pricing-api.k6.js

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: load-test-results
          path: load-test-results.json
```

---

## 🎯 **Performance Goals**

### **v1.0.0 (Current)**

- ✅ p95 < 500ms for pricing API
- ✅ Handle 50 concurrent users
- ✅ Error rate < 1%

### **v1.1.0 (Q2 2026)**

- ⏳ p95 < 300ms for pricing API
- ⏳ Handle 200 concurrent users
- ⏳ Error rate < 0.5%

### **v2.0.0 (Q4 2026)**

- ⏳ p95 < 200ms for pricing API
- ⏳ Handle 1000 concurrent users
- ⏳ Error rate < 0.1%
- ⏳ 99.9% uptime SLA

---

## 📚 **Resources**

- [k6 Documentation](https://k6.io/docs/)
- [k6 Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [Vercel Performance](https://vercel.com/docs/concepts/limits/overview)

---

## ✅ **Checklist**

### **Before Load Test**

- [ ] Notify team (don't alarm production monitoring)
- [ ] Use staging environment
- [ ] Verify baseline metrics
- [ ] Check infrastructure capacity

### **During Load Test**

- [ ] Monitor dashboards real-time
- [ ] Watch for error spikes
- [ ] Check database connections
- [ ] Monitor external API rate limits

### **After Load Test**

- [ ] Analyze results vs baseline
- [ ] Document findings
- [ ] Create tickets for issues
- [ ] Update capacity plan

---

**Last Updated:** 2026-01-20
**Baseline Version:** 1.0.0
