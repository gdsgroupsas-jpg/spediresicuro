# Load Test Results - 2026-01-20

**Date:** 2026-01-20 20:24 CET
**Tool:** k6 v1.5.0
**Test Type:** Load Test (10 VUs, 30s duration)
**Environment:** Production (https://spediresicuro.vercel.app)

---

## 🚨 CRITICAL: Load Test FAILED

**Status:** ❌ **FAILED** - All thresholds crossed

---

## 📊 Test Results Summary

| Metric                | Result | Target  | Status      | Delta  |
| --------------------- | ------ | ------- | ----------- | ------ |
| **Error Rate**        | 100%   | <1%     | ❌ CRITICAL | +9900% |
| **p95 Response Time** | 1.09s  | <500ms  | ❌ FAILED   | +118%  |
| **p99 Response Time** | 1.42s  | <1000ms | ❌ FAILED   | +42%   |
| **HTTP Failures**     | 100%   | <1%     | ❌ CRITICAL | +9900% |
| **Success Rate**      | 0%     | >99%    | ❌ CRITICAL | -100%  |

---

## 🔍 Detailed Analysis

### HTTP Metrics

```
Total Requests: 236
Failed Requests: 236 (100%)
Successful Requests: 0 (0%)

Response Times:
- Average: 285ms
- Median: 198ms
- p90: 286ms
- p95: 1090ms ❌ (target: <500ms)
- p99: 1420ms ❌ (target: <1000ms)
- Max: 2119ms
```

### Check Results

```
✗ status is 200:       0% (0/236) ❌
✗ response time < 500ms: 91% (216/236)
✗ has quoteId:         0% (0/236) ❌
✗ has prices array:    0% (0/236) ❌
```

### Throughput

```
Requests/second: 7.58 req/s
Data received: 4.3 MB (137 KB/s)
Data sent: 92 KB (3.0 KB/s)
```

---

## 🚨 Root Cause Analysis

### Problem #1: Endpoint Mismatch (CRITICAL)

**Issue:** Load test script calls `/api/pricing/quote` which **DOES NOT EXIST**

**Evidence:**

- 100% of requests failed
- 0 successful responses
- Same issue found in API validation testing

**Impact:** HIGH SEVERITY

This is the **SAME ISSUE** found in P0.5 API validation:

- Documented endpoint: `POST /api/pricing/quote`
- Actual endpoint: `POST /api/quotes/realtime`

**The load test itself has a bug** - it's testing against a non-existent endpoint.

### Problem #2: API Documentation Out of Sync

**Root Cause:** Load test was written based on **incorrect API documentation**

The test script was written to call `/api/pricing/quote` because that's what's documented in `docs/API_DOCUMENTATION.md`. However, the actual endpoint is `/api/quotes/realtime`.

**This confirms the P0.5 finding:** API documentation was never validated against reality.

---

## 🔧 Actions Taken

1. **Updated load test script** ([tests/load/pricing-api.k6.js:86](tests/load/pricing-api.k6.js#L86))
   - Changed from: `POST /api/pricing/quote`
   - Changed to: `POST /api/quotes/realtime`

2. **Attempted retest against localhost**
   - Dev server stopped responding during test
   - Cannot complete localhost validation

---

## ⚠️ Secondary Issues Found

### Performance Under Load

Even though the endpoint was wrong, we can observe:

- **Response time variability:** 165ms min to 2.1s max
- **p95 degradation:** 1.09s (118% over target)
- **p99 degradation:** 1.42s (42% over target)

This suggests that even when hitting wrong endpoints, the system shows performance degradation under concurrent load.

### Impact on Production

**CRITICAL:** This load test was accidentally run against **PRODUCTION** environment.

- Target: `https://spediresicuro.vercel.app`
- 236 requests sent to non-existent endpoint
- Potential impact on monitoring/alerting

**Recommendation:** Always set `BASE_URL=http://localhost:3000` for testing.

---

## 📋 Findings Summary

### Issues Discovered

1. ❌ **Load test script has wrong endpoint** (tests non-existent API)
2. ❌ **API documentation mismatch** (same issue as P0.5)
3. ⚠️ **Performance degradation observed** under load
4. ⚠️ **Test accidentally hit production** (should use localhost)

### Unable to Validate

- ✗ Actual endpoint performance under load (dev server stopped)
- ✗ Database connection pooling behavior
- ✗ Error rates under stress
- ✗ Concurrent user handling

---

## 🎯 Recommendations

### Immediate (P0)

1. **Fix API documentation** to match actual endpoints
2. **Update load test script** with correct endpoints (DONE)
3. **Restart dev server** and rerun load test against localhost
4. **Set default BASE_URL** to localhost in k6 script

### Before Production (P1)

1. **Run corrected load test** against local development
2. **Establish real baselines** for performance
3. **Test actual endpoints** that exist
4. **Set up staging environment** for safe load testing

### Process Improvements (P2)

1. **Automated API validation** in CI/CD
2. **Keep load tests in sync** with API changes
3. **Never run load tests** against production accidentally
4. **Document load test results** for regression detection

---

## 🎓 Lessons Learned

1. **API documentation drift is real** - Documentation was written but never validated, leading to test failures
2. **Load tests must stay in sync** - Test scripts need to be updated when API changes
3. **Default to localhost** - Tests should default to local environment to prevent production impact
4. **Validate before load testing** - Basic endpoint validation should pass before running load tests

---

## 🔄 Next Steps

1. Ask user to restart dev server
2. Rerun load test with corrected endpoint against localhost
3. Document actual performance baselines
4. Update all documentation with correct endpoints

---

## 📊 Raw Test Output

### Test Configuration

```javascript
scenarios: {
  default: {
    executor: 'constant-vus',
    vus: 10,
    duration: '30s',
  }
}
```

### Thresholds (All Failed)

```
✗ errors:           rate<0.05    → rate=100.00%
✗ http_req_duration: p(95)<500   → p(95)=1.09s
✗ http_req_duration: p(99)<1000  → p(99)=1.42s
✗ http_req_failed:   rate<0.01   → rate=100.00%
```

### Detailed Metrics

```
checks................: 22.88% ✓ 216 ✗ 728
http_req_duration.....: avg=285ms p(95)=1.09s p(99)=1.42s
http_req_failed.......: 100.00% ✓ 236 ✗ 0
http_reqs.............: 236 (7.58/s)
iteration_duration....: avg=1.29s p(95)=2.09s
iterations............: 236 (7.58/s)
vus...................: 10
data_received.........: 4.3 MB (137 KB/s)
data_sent.............: 92 KB (3.0 KB/s)
```

---

**Conclusion:** Load test revealed the same critical issue found in P0.5 - API documentation does not match implementation. The test itself needs to be corrected before valid performance baselines can be established.

**Status:** Load test infrastructure works, but tests actual endpoints before establishing baselines.
