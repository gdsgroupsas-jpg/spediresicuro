# CI/CD Pipelines

## Overview
Documentazione completa delle pipeline CI/CD di SpedireSicuro, incluse GitHub Actions workflows e processi di automazione.

## Target Audience
- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents

## Prerequisites
- Conoscenza GitHub Actions
- Accesso a repository GitHub
- Familiarità con CI/CD concepts

---

## GitHub Actions Workflows

### 1. CI Gate (`ci.yml`)

**Trigger:**
- Pull Request su `master`
- Push su `master`

**Jobs:**
```yaml
jobs:
  ci:
    steps:
      - Checkout code
      - Setup Node.js 20
      - Install dependencies (npm ci)
      - Run unit tests (npm run test:unit)
      - Run integration tests (npm run test:integration)
      - Type check (npm run type-check)
      - Build (npm run build)
```

**Purpose:**
- Verifica che il codice compili
- Esegue test automatici
- Blocca merge se test falliscono

**Environment Variables (CI):**
```yaml
ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY || 'test-key' }}
GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY || 'test-key' }}
NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET || 'test-secret' }}
NEXTAUTH_URL: http://localhost:3000
SUPABASE_URL: ${{ secrets.SUPABASE_URL || 'https://test.supabase.co' }}
SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY || 'test-key' }}
```

---

### 2. E2E Tests (`e2e-tests.yml`)

**Trigger:**
- Push su `master`
- Pull Request su `master`

**Jobs:**
```yaml
jobs:
  test:
    steps:
      - Checkout code
      - Setup Node.js 18
      - Install dependencies
      - Install Playwright browsers
      - Build Next.js
      - Start Next.js server
      - Wait for server
      - Run E2E tests (npm run test:e2e)
      - Stop server
      - Upload test results
      - Upload test videos (on failure)
```

**Purpose:**
- Esegue test end-to-end con Playwright
- Verifica funzionalità complete
- Genera report e video su failure

**Artifacts:**
- `playwright-report/` - Test report (30 days retention)
- `test-results/` - Test videos (7 days retention, solo su failure)

---

### 3. Deploy Automation (`deploy.yml`)

**Trigger:**
- Push su `master` (solo `automation-service/**`)
- Manual dispatch

**Jobs:**
```yaml
jobs:
  notify:
    steps:
      - Notify Deployment
```

**Purpose:**
- Notifica deployment automation-service su Railway
- Railway fa auto-deploy da GitHub, questo workflow è solo per notifiche

**Note:** Railway sincronizzato automaticamente con GitHub, deploy automatico su push `master`.

---

### 4. Release Guard (`release-guard.yml`)

**Trigger:**
- Push su `master`
- Tag creation

**Purpose:**
- Verifica che release siano corrette
- Blocca release se criteri non soddisfatti

---

## CI/CD Flow

### Standard Flow

```
1. Developer crea branch feature
   ↓
2. Push su GitHub → PR
   ↓
3. GitHub Actions CI Gate:
   - Unit tests ✅
   - Integration tests ✅
   - Type check ✅
   - Build ✅
   ↓
4. GitHub Actions E2E Tests:
   - Playwright E2E tests ✅
   ↓
5. Vercel Preview Deployment (automatico)
   ↓
6. Review PR → Merge su `master`
   ↓
7. GitHub Actions CI (su master):
   - All tests ✅
   ↓
8. Vercel Production Deploy (automatico)
   ↓
9. Railway Automation Deploy (automatico)
   ↓
10. Post-deploy verification
```

---

## Test Strategy in CI

### Unit Tests
```bash
npm run test:unit
```
- **Framework:** Vitest
- **Location:** `tests/unit/`
- **Purpose:** Test logica business isolata
- **Speed:** Fast (< 30s)

### Integration Tests
```bash
npm run test:integration
```
- **Framework:** Vitest
- **Location:** `tests/integration/`
- **Purpose:** Test integrazione componenti
- **Speed:** Medium (< 2min)

### E2E Tests
```bash
npm run test:e2e
```
- **Framework:** Playwright
- **Location:** `tests/e2e/`
- **Purpose:** Test flussi utente completi
- **Speed:** Slow (< 10min)

**Vedi:** [Testing Strategy](../5-TESTING/STRATEGY.md) - Dettagli testing

---

## Environment Variables in CI

### Secrets (GitHub Secrets)

**Required:**
- `ANTHROPIC_API_KEY` - AI features
- `GOOGLE_API_KEY` - Gemini AI
- `NEXTAUTH_SECRET` - Auth (test)
- `SUPABASE_URL` - Database (test)
- `SUPABASE_SERVICE_ROLE_KEY` - Database (test)

**Optional:**
- `PLAYWRIGHT_TEST_BASE_URL` - E2E test URL
- `PLAYWRIGHT_TEST_MODE` - E2E test mode

### Test Environment

**CI Environment:**
- `CI: true` - Flag CI environment
- `NODE_ENV: test` - Test mode
- Mock external APIs quando possibile

---

## Build Process

### CI Build

**Steps:**
1. Install dependencies: `npm ci`
2. Run tests: `npm run test:unit`, `npm run test:integration`
3. Type check: `npm run type-check`
4. Build: `npm run build`

**Failure Handling:**
- Se qualsiasi step fallisce → CI fails
- PR non può essere merged se CI fails
- Build logs disponibili in GitHub Actions

---

## Deployment Automation

### Vercel Auto-Deploy

**Trigger:** Push su `master`

**Process:**
1. Vercel webhook da GitHub
2. Clone repository
3. Build (`npm run build`)
4. Deploy production

**No manual intervention required.**

---

### Railway Auto-Deploy

**Trigger:** Push su `master` (solo `automation-service/**`)

**Process:**
1. Railway webhook da GitHub
2. Build Docker image (`automation-service/Dockerfile`)
3. Deploy container

**No manual intervention required.**

---

## Failure Handling

### CI Failure

**Actions:**
1. Developer riceve notification
2. Check GitHub Actions logs
3. Fix issues localmente
4. Push fix → CI ri-esegue automaticamente

**Blocking:**
- PR non può essere merged se CI fails
- Master branch protetto (richiede CI pass)

---

### Deployment Failure

**Vercel:**
1. Check Vercel Dashboard → Deployments
2. Review build logs
3. Fix issues
4. Redeploy (automatico su push)

**Railway:**
1. Check Railway Dashboard → Deployments
2. Review build logs
3. Fix issues
4. Redeploy (automatico su push)

---

## Best Practices

### 1. Fast CI

**Optimizations:**
- Cache dependencies (`cache: 'npm'`)
- Parallel test execution
- Skip unnecessary steps

---

### 2. Reliable Tests

**Requirements:**
- Tests devono essere deterministici
- No flaky tests
- Proper cleanup after tests

---

### 3. Security

**Secrets:**
- Never commit secrets
- Use GitHub Secrets
- Rotate secrets regularly

---

## Related Documentation

- [Overview](OVERVIEW.md) - Deployment overview
- [VERCEL.md](VERCEL.md) - Vercel deployment
- [Testing Strategy](../5-TESTING/STRATEGY.md) - Test strategy
- [Operations](../7-OPERATIONS/MONITORING.md) - Post-deploy monitoring

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0.0 | Initial version | Dev Team |

---

*Last Updated: 2026-01-12*  
*Status: 🟢 Active*  
*Maintainer: Dev Team*
