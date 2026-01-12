# Deployment Overview

## Overview
Panoramica completa del sistema di deployment di SpedireSicuro, incluse le piattaforme utilizzate (Vercel, Railway) e i processi CI/CD.

## Target Audience
- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents

## Prerequisites
- Account Vercel
- Account Railway (per automation-service)
- Accesso a GitHub repository
- Conoscenza base di CI/CD

## Quick Reference
| Piattaforma | Servizio | Branch | Auto-Deploy |
|-------------|----------|--------|-------------|
| Vercel | Next.js App | `master` | ✅ Sì |
| Railway | Automation Service | `master` | ✅ Sì |
| GitHub Actions | CI/CD | `master`, PR | ✅ Sì |

---

## Architecture Overview

**SpedireSicuro utilizza un'architettura multi-service:**

```
┌─────────────────────────────────────────┐
│         GitHub Repository               │
│    (gdsgroupsas-jpg/spediresicuro)      │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
       ↓                ↓
┌─────────────┐  ┌──────────────┐
│   Vercel    │  │   Railway    │
│  (Next.js)  │  │ (Automation) │
└─────────────┘  └──────────────┘
```

### 1. Vercel (Next.js App)
- **Servizio:** Applicazione Next.js principale
- **Branch:** `master`
- **Auto-Deploy:** ✅ Ogni push su `master` → deploy automatico
- **URL Production:** https://spediresicuro.it
- **Preview:** Ogni PR → preview deployment automatico

### 2. Railway (Automation Service)
- **Servizio:** `automation-service/` (sincronizzazione listini)
- **Branch:** `master`
- **Auto-Deploy:** ✅ Ogni push su `master` → deploy automatico
- **Dockerfile:** `automation-service/Dockerfile`

### 3. GitHub Actions (CI/CD)
- **Workflows:**
  - `ci.yml` - CI gate (tests, type-check, build)
  - `e2e-tests.yml` - E2E tests con Playwright
  - `deploy.yml` - Notifiche deployment
  - `release-guard.yml` - Release guard

---

## Deployment Flow

### Standard Flow (Production)

```
1. Developer crea branch feature
   ↓
2. Push su GitHub → PR
   ↓
3. GitHub Actions CI:
   - Unit tests
   - Integration tests
   - Type check
   - Build
   ↓
4. Vercel crea Preview Deployment
   ↓
5. Review PR → Merge su `master`
   ↓
6. GitHub Actions CI (su master)
   ↓
7. Vercel Production Deploy (automatico)
   ↓
8. Railway Automation Deploy (automatico)
   ↓
9. Post-deploy verification
```

---

## Environment Variables

### Critical (P0)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `ENCRYPTION_KEY`

### Important (P1)
- `GOOGLE_API_KEY` (AI features)
- `XPAY_BO_API_KEY` (Payments)
- OAuth credentials (Google, GitHub)

**Vedi:** [VERCEL.md](VERCEL.md) - Dettagli environment variables

---

## Deployment Checklist

### Pre-Deploy
- [ ] Run all tests: `npm test`
- [ ] Type check: `npm run type-check`
- [ ] Lint: `npm run lint`
- [ ] Verify migrations idempotent
- [ ] Check for hardcoded secrets
- [ ] Review environment variables
- [ ] Database backup recent (< 24h)

### Post-Deploy
- [ ] Check `/api/health` endpoint
- [ ] Login test user
- [ ] Create test shipment (draft)
- [ ] Verify wallet balance
- [ ] Check error monitoring
- [ ] Monitor server logs

**Vedi:** [CI_CD.md](CI_CD.md) - Dettagli CI/CD pipelines

---

## Rollback Procedure

### Vercel Rollback
1. Go to Vercel Dashboard → Deployments
2. Find previous working deployment
3. Click "..." → "Promote to Production"

### Database Migrations
- Check if migration has rollback script
- If yes: Run rollback migration
- If no: Manual intervention required

---

## Related Documentation

- [VERCEL.md](VERCEL.md) - Deploy Vercel dettagliato
- [CI_CD.md](CI_CD.md) - CI/CD pipelines
- [Operations](../7-OPERATIONS/MONITORING.md) - Monitoring post-deploy
- [Security](../8-SECURITY/OVERVIEW.md) - Security in deployment

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0.0 | Initial version | Dev Team |

---

*Last Updated: 2026-01-12*  
*Status: 🟢 Active*  
*Maintainer: Dev Team*
