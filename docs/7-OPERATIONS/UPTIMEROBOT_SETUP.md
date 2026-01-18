# UptimeRobot Setup Guide

**Milestone**: M3 - Uptime & Health Monitoring
**Cost**: €0/month (FREE TIER - 50 monitors)
**Target Uptime**: 99.9%

---

## 📋 Overview

UptimeRobot provides 24/7 uptime monitoring with instant alerts when your application goes down.

### Free Tier Includes:
- 50 monitors
- 5-minute check intervals
- **Email alerts** (gratuito)
- Status pages
- 2 months log history

> **Note**: Slack e Webhook alerts richiedono piano a pagamento. Usare Email alerts nel free tier.

---

## 🔧 Configuration

### Step 1: Create Account

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Sign up with your email
3. Verify your account

### Step 2: Create Monitors

Create the following monitors for SpediReSicuro:

#### Monitor 1: Application Health (Primary) ✅
```
Type: HTTP(s)
Friendly Name: spediresicuro.it/api/health
URL: https://spediresicuro.it/api/health
Monitoring Interval: 5 minutes
HTTP Method: GET
Expected Status: 200
```

#### Monitor 2: Readiness Probe (Database) ✅
```
Type: HTTP(s)
Friendly Name: spediresicuro.it/api/health/ready
URL: https://spediresicuro.it/api/health/ready
Monitoring Interval: 5 minutes
HTTP Method: GET
Expected Status: 200
```

#### Monitor 3: Liveness Probe ✅
```
Type: HTTP(s)
Friendly Name: spediresicuro.it/api/health/live
URL: https://spediresicuro.it/api/health/live
Monitoring Interval: 5 minutes
HTTP Method: GET
Expected Status: 200
```

#### Monitor 4: External Dependencies ⚠️ (Richiede merge PR #52)
```
Type: HTTP(s)
Friendly Name: spediresicuro.it/api/health/dependencies
URL: https://spediresicuro.it/api/health/dependencies
Monitoring Interval: 5 minutes
HTTP Method: GET
Expected Status: 200
```
> **IMPORTANTE**: Questo endpoint sarà disponibile dopo il merge della PR #52.
> Fino ad allora il monitor mostrerà 404.

### Step 3: Configure Email Alerts

Gli alert via email sono **automaticamente attivi** per l'indirizzo email con cui ti sei registrato.

Quando un monitor va down, riceverai:
- Email immediata al momento del down
- Email di recovery quando torna up

Per aggiungere altri destinatari:
1. Go to My Settings → Alert Contacts
2. Add new contact → Email
3. Insert email address

### Step 4: Create Status Page (Optional)

1. Go to Status Pages
2. Create new status page
3. Add all monitors
4. Custom domain: `status.spediresicuro.it` (optional)

---

## 📊 Current Status

**Monitors configurati**: 4/50

| Monitor | Status | Uptime |
|---------|--------|--------|
| `/api/health` | ✅ Up | 100% |
| `/api/health/ready` | ✅ Up | 100% |
| `/api/health/live` | ✅ Up | 100% |
| `/api/health/dependencies` | ⚠️ 404 | Richiede merge PR #52 |

---

## 🔄 Health Check Endpoints

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `/api/health` | General health | ✅ Attivo |
| `/api/health/ready` | Database connectivity | ✅ Attivo |
| `/api/health/live` | Process alive | ✅ Attivo |
| `/api/health/dependencies` | External APIs status | ⚠️ PR #52 |

---

## 🚨 Alert Flow (Free Tier)

```
Monitor Down → UptimeRobot → Email Alert
                    ↓
              (dopo 2-3 check falliti)
                    ↓
              Email di notifica
```

### Upgrade Path (Opzionale - Piano a pagamento)
Con piano Solo/Team/Enterprise:
- Slack integration
- Webhook to `/api/webhooks/uptimerobot`
- Telegram alerts

---

## 📊 Monitoring Targets

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Uptime | 99.9% | < 99.5% |
| Response Time | < 500ms | > 2000ms |
| Downtime/month | < 43 min | > 60 min |

---

## 📞 Troubleshooting

### Monitor Shows Down But Site Works
1. Check if URL is correct
2. Verify no geo-blocking
3. Check for rate limiting
4. Verify SSL certificate is valid

### 404 on /api/health/dependencies
**Causa**: La PR #52 non è stata ancora mergiata.
**Soluzione**: Merge PR #52 e attendere il deploy su Vercel.

### Slow Response Times
1. Check Vercel Edge function cold starts
2. Review database query performance
3. Check external API latency

---

## 📚 References

- [UptimeRobot Documentation](https://uptimerobot.com/api/)
- [PR #52 - M3 Implementation](https://github.com/gdsgroupsas-jpg/spediresicuro/pull/52)
