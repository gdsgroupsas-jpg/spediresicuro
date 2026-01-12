# Vercel Deployment

## Overview
Guida completa per il deployment su Vercel della applicazione Next.js SpedireSicuro.

## Target Audience
- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents

## Prerequisites
- Account Vercel collegato a GitHub
- Repository: `gdsgroupsas-jpg/spediresicuro`
- Branch `master` configurato

---

## Auto-Deploy Configuration

### Production Deployment

**Trigger:** Push su branch `master`

**Process:**
1. Vercel rileva push su `master`
2. Esegue build automatico
3. Deploy su production (https://spediresicuro.it)
4. Tempo medio: 2-5 minuti

**Configurazione:**
- **Framework Preset:** Next.js
- **Build Command:** `npm run build` (automatico)
- **Output Directory:** `.next` (automatico)
- **Install Command:** `npm ci` (automatico)

---

### Preview Deployments

**Trigger:** Pull Request su GitHub

**Process:**
1. PR creata → Vercel crea preview deployment
2. URL univoco per ogni PR (es. `pr-33-spediresicuro.vercel.app`)
3. Commento automatico su PR con link preview
4. Deploy aggiornato ad ogni push sul branch PR

**Utilizzo:**
- Testare modifiche prima del merge
- Condividere preview con team
- Verificare UI/UX changes

---

## Vercel Configuration

### `vercel.json`

```json
{
  "functions": {
    "app/api/automation/**/*.ts": {
      "maxDuration": 300
    },
    "app/api/cron/**/*.ts": {
      "maxDuration": 300
    }
  },
  "crons": [
    {
      "path": "/api/cron/financial-alerts",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/auto-reconciliation",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Configurazioni:**
- **Function Timeout:** 300s per automation e cron jobs
- **Cron Jobs:** Scheduled tasks per financial alerts e reconciliation

---

## Environment Variables

### Production Environment

**Critical (P0):**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]

# Auth
NEXTAUTH_URL=https://spediresicuro.it
NEXTAUTH_SECRET=[random-32-char-string]

# Encryption
ENCRYPTION_KEY=[random-32-char-string]
```

**Important (P1):**
```bash
# AI
GOOGLE_API_KEY=[gemini-api-key]

# Payments
XPAY_BO_API_KEY=[xpay-key]
XPAY_TERMINAL_ID=[terminal-id]

# OAuth
GOOGLE_CLIENT_ID=[google-oauth-id]
GOOGLE_CLIENT_SECRET=[google-oauth-secret]
GITHUB_CLIENT_ID=[github-oauth-id]
GITHUB_CLIENT_SECRET=[github-oauth-secret]
```

**Optional (P2):**
```bash
# Monitoring
DIAGNOSTICS_TOKEN=[diagnostics-token]

# Automation
AUTOMATION_SERVICE_TOKEN=[automation-token]
AUTOMATION_SERVICE_URL=https://automation.spediresicuro.it

# Impersonation
IMPERSONATION_COOKIE_NAME=impersonate-context
IMPERSONATION_TTL=3600
```

### How to Update Environment Variables

1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add/Edit variable
3. Choose environment: Production, Preview, Development
4. Save (deploy automatico se necessario)

**⚠️ IMPORTANTE:** Dopo aggiornamento env vars, Vercel fa redeploy automatico.

---

## Build Configuration

### Build Command
```bash
npm run build
```

**Process:**
1. Install dependencies: `npm ci`
2. Run build: `npm run build`
3. Type check: `npm run type-check` (in CI)
4. Output: `.next/` directory

### Build Optimization

**Next.js 14 App Router:**
- Automatic code splitting
- Static optimization
- Image optimization
- Edge runtime per API routes

**Function Configuration:**
- Long-running functions (automation, cron): 300s timeout
- Standard API routes: 10s timeout (default)

---

## Deployment Process

### Automatic Deployment

**Trigger:** Push su `master`

**Steps:**
1. GitHub webhook → Vercel
2. Vercel clones repository
3. Install dependencies (`npm ci`)
4. Run build (`npm run build`)
5. Deploy to production
6. Health check (`/api/health`)

**Monitoring:**
- Build logs disponibili in Vercel Dashboard
- Email notifications per deploy failures
- Slack integration (opzionale)

---

### Manual Deployment

**Via Vercel CLI:**
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

**Via Vercel Dashboard:**
1. Go to Deployments
2. Click "Redeploy" su deployment esistente
3. Choose environment (Production/Preview)

---

## Preview Deployments

### PR Preview

**Automatic:**
- Ogni PR → preview deployment
- URL: `pr-[number]-spediresicuro.vercel.app`
- Commento automatico su PR con link

**Manual Promote:**
1. Go to Vercel Dashboard → Deployments
2. Find preview deployment
3. Click "Promote to Production"

---

## Cron Jobs

### Scheduled Tasks

**Financial Alerts:**
- Path: `/api/cron/financial-alerts`
- Schedule: `0 8 * * *` (ogni giorno alle 8:00)
- Purpose: Genera alert margini negativi

**Auto-Reconciliation:**
- Path: `/api/cron/auto-reconciliation`
- Schedule: `0 2 * * *` (ogni giorno alle 2:00)
- Purpose: Riconciliazione automatica costi

**Configuration:**
Definiti in `vercel.json` → `crons` array

**Security:**
- Richiedono header `X-Cron-Secret` (configurato in env vars)
- Solo chiamate da Vercel Cron sono autorizzate

---

## Monitoring & Logs

### Vercel Dashboard

**Deployments:**
- Status (Ready, Building, Error)
- Build logs
- Deployment URL
- Commit SHA

**Logs:**
- Real-time logs
- Function logs
- Error logs
- Filter by time range

**Analytics:**
- Page views
- Performance metrics
- Web Vitals

---

## Troubleshooting

### Build Failures

**Common Issues:**

1. **Type Errors:**
   ```bash
   # Fix: Run type-check locally
   npm run type-check
   ```

2. **Missing Environment Variables:**
   ```bash
   # Fix: Add missing vars in Vercel Dashboard
   ```

3. **Dependency Issues:**
   ```bash
   # Fix: Check package.json, run npm ci locally
   ```

### Deployment Failures

**Check:**
1. Build logs in Vercel Dashboard
2. Environment variables configured
3. Database migrations applied
4. External API availability

---

## Rollback

### Quick Rollback

1. Go to Vercel Dashboard → Deployments
2. Find previous working deployment
3. Click "..." → "Promote to Production"

**Note:** Rollback non applica rollback di database migrations.

---

## Related Documentation

- [Overview](OVERVIEW.md) - Deployment overview
- [CI_CD.md](CI_CD.md) - CI/CD pipelines
- [Operations](../7-OPERATIONS/MONITORING.md) - Post-deploy monitoring
- [Security](../8-SECURITY/OVERVIEW.md) - Security considerations

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0.0 | Initial version | Dev Team |

---

*Last Updated: 2026-01-12*  
*Status: 🟢 Active*  
*Maintainer: Dev Team*
