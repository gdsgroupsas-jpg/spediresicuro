# Load Test Baselines

**Last Updated:** 2026-01-20
**Status:** ⚠️ NOT YET EXECUTED - Targets Only

---

## 🎯 Performance Targets (v1.0.0)

These are the **documented targets** from LOAD_TESTING.md. Actual baselines must be established by running real load tests.

### API Endpoints

| Endpoint                  | p50 Target | p95 Target | p99 Target | Error Rate Target |
| ------------------------- | ---------- | ---------- | ---------- | ----------------- |
| `GET /api/health`         | <50ms      | <100ms     | <200ms     | <0.1%             |
| `POST /api/pricing/quote` | <200ms     | <500ms     | <1000ms    | <1%               |
| `POST /api/shipments`     | <300ms     | <800ms     | <1500ms    | <1%               |
| `GET /api/shipments`      | <100ms     | <300ms     | <600ms     | <0.5%             |
| `GET /api/wallet/balance` | <50ms      | <150ms     | <300ms     | <0.5%             |

### Infrastructure Limits

| Resource                 | Limit            | Estimated Usage | Headroom |
| ------------------------ | ---------------- | --------------- | -------- |
| **Vercel Functions**     | 10s timeout      | ~1.5s p99       | 85%      |
| **Supabase Connections** | 60 (free tier)   | ~20 avg         | 67%      |
| **Upstash Redis**        | 10k commands/day | ~2k/day         | 80%      |
| **Anthropic API**        | 500 req/min      | ~50/min         | 90%      |

---

## ⚠️ Action Required

**TO ESTABLISH REAL BASELINES:**

### Option 1: Install k6 and Run Full Load Test

```bash
# Install k6
choco install k6  # Windows
brew install k6   # macOS

# Run smoke test (30s, 10 VUs)
k6 run --vus 10 --duration 30s tests/load/pricing-api.k6.js

# Run load test (5min, 50 VUs)
k6 run --vus 50 --duration 5m tests/load/pricing-api.k6.js
```

### Option 2: Quick API Smoke Test (No k6 Required)

```bash
# Start dev server
npm run dev

# In another terminal, run smoke test
node scripts/smoke-test-api.js http://localhost:3000
```

### Option 3: Test Against Staging/Production

**⚠️ CAUTION:** Only run against production with explicit approval to avoid impacting real users.

```bash
# Against staging
node scripts/smoke-test-api.js https://staging.spediresicuro.vercel.app

# Against production (USE WITH CAUTION)
node scripts/smoke-test-api.js https://spediresicuro.vercel.app
```

---

## 📊 Baseline Results (To Be Filled)

### Smoke Test Results

**Date:** _Not yet executed_
**Environment:** _N/A_
**k6 Version:** _N/A_

```
TO BE FILLED AFTER FIRST EXECUTION
```

### Load Test Results

**Date:** _Not yet executed_
**Environment:** _N/A_
**VUs:** _N/A_
**Duration:** _N/A_

```
TO BE FILLED AFTER FIRST EXECUTION
```

---

## 🚨 Current Status

- ❌ **P0 BLOCKER:** Load tests exist but have never been executed
- ❌ No real performance baselines established
- ❌ Cannot validate if targets are realistic
- ❌ Unknown if system can handle documented load

**RECOMMENDATION:** Execute at least smoke test before claiming production readiness.

---

## 📝 Test Execution Log

| Date      | Test Type | VUs | Duration | p95   | p99   | Error % | Pass/Fail | Notes |
| --------- | --------- | --- | -------- | ----- | ----- | ------- | --------- | ----- |
| _Pending_ | Smoke     | 10  | 30s      | _N/A_ | _N/A_ | _N/A_   | _N/A_     | -     |
| _Pending_ | Load      | 50  | 5min     | _N/A_ | _N/A_ | _N/A_   | _N/A_     | -     |

---

## 🎯 Next Steps

1. **IMMEDIATE (P0):** Run smoke test to verify endpoints work
2. **BEFORE PRODUCTION (P0):** Run load test to establish real baselines
3. **WEEKLY:** Re-run load tests to detect performance regressions
4. **MONTHLY:** Run stress test to find breaking point

---

**NOTE:** This document will be updated with real data after first load test execution.
