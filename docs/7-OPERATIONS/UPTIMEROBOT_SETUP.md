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
- Email, Slack, webhook alerts
- Status pages
- 2 months log history

---

## 🔧 Configuration

### Step 1: Create Account

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Sign up with your email
3. Verify your account

### Step 2: Create Monitors

Create the following monitors for SpediReSicuro:

#### Monitor 1: Application Health (Primary)
```
Type: HTTP(s)
Friendly Name: SpediReSicuro - Health Check
URL: https://spediresicuro.com/api/health
Monitoring Interval: 5 minutes
HTTP Method: GET
Expected Status: 200
```

#### Monitor 2: Readiness Probe (Database)
```
Type: HTTP(s)
Friendly Name: SpediReSicuro - Database Ready
URL: https://spediresicuro.com/api/health/ready
Monitoring Interval: 5 minutes
HTTP Method: GET
Expected Status: 200
Keyword Type: Keyword Exists
Keyword Value: "working":true
```

#### Monitor 3: Liveness Probe
```
Type: HTTP(s)
Friendly Name: SpediReSicuro - Liveness
URL: https://spediresicuro.com/api/health/live
Monitoring Interval: 5 minutes
HTTP Method: GET
Expected Status: 200
```

#### Monitor 4: External Dependencies
```
Type: HTTP(s)
Friendly Name: SpediReSicuro - Dependencies
URL: https://spediresicuro.com/api/health/dependencies
Monitoring Interval: 5 minutes
HTTP Method: GET
Expected Status: 200
Alert on: "status":"ok" OR "status":"degraded" (both acceptable)
```

#### Monitor 5: Homepage (User Experience)
```
Type: HTTP(s)
Friendly Name: SpediReSicuro - Homepage
URL: https://spediresicuro.com
Monitoring Interval: 5 minutes
HTTP Method: GET
Expected Status: 200
```

### Step 3: Configure Alerts

#### Slack Integration
1. Go to My Settings → Alert Contacts
2. Add new contact → Slack
3. Connect your workspace
4. Select `#tutta-spediresicuro` channel

#### Webhook Integration (Optional)
```
Type: Webhook
URL: https://spediresicuro.com/api/webhooks/uptimerobot
HTTP Method: POST
POST Value (JSON):
{
  "monitorID": "*monitorID*",
  "monitorURL": "*monitorURL*",
  "monitorFriendlyName": "*monitorFriendlyName*",
  "alertType": "*alertType*",
  "alertTypeFriendlyName": "*alertTypeFriendlyName*",
  "alertDetails": "*alertDetails*",
  "alertDuration": "*alertDuration*"
}
```

### Step 4: Create Status Page (Optional)

1. Go to Status Pages
2. Create new status page
3. Add all monitors
4. Custom domain: `status.spediresicuro.com` (optional)

---

## 🔌 Webhook Endpoint

The application includes a webhook endpoint to receive UptimeRobot alerts:

**Endpoint**: `POST /api/webhooks/uptimerobot`

This endpoint:
- Logs downtime events
- Forwards critical alerts to Slack
- Stores incident history for analysis

### Environment Variables

```bash
# Optional: Webhook secret for validation
UPTIMEROBOT_WEBHOOK_SECRET="your-secret-here"
```

---

## 📊 Monitoring Dashboard

### Key Metrics
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Uptime | 99.9% | < 99.5% |
| Response Time | < 500ms | > 2000ms |
| Downtime/month | < 43 min | > 60 min |

### Response Time Thresholds
- 🟢 Green: < 500ms (Excellent)
- 🟡 Yellow: 500ms - 2000ms (Acceptable)
- 🔴 Red: > 2000ms (Slow)

---

## 🔄 Health Check Endpoints

| Endpoint | Purpose | Check Frequency |
|----------|---------|-----------------|
| `/api/health` | General health | 5 min |
| `/api/health/ready` | Database connectivity | 5 min |
| `/api/health/live` | Process alive | 5 min |
| `/api/health/dependencies` | External APIs status | 5 min |

---

## 🚨 Alert Escalation

### Level 1: Warning
- Response time > 2s
- Single check failure
- **Action**: Log only

### Level 2: Alert
- 2+ consecutive failures
- **Action**: Slack notification

### Level 3: Critical
- 5+ consecutive failures (25+ minutes down)
- **Action**: Slack + Email + SMS (if configured)

---

## 📞 Troubleshooting

### Monitor Shows Down But Site Works
1. Check if URL is correct
2. Verify no geo-blocking
3. Check for rate limiting
4. Verify SSL certificate is valid

### False Positives
1. Increase timeout threshold
2. Use keyword monitoring instead of status code
3. Check for intermittent network issues

### Slow Response Times
1. Check Vercel Edge function cold starts
2. Review database query performance
3. Check external API latency

---

## 📚 References

- [UptimeRobot API Documentation](https://uptimerobot.com/api/)
- [UptimeRobot Webhook Guide](https://blog.uptimerobot.com/web-hook-alert-contacts-format/)
- [Status Page Best Practices](https://blog.uptimerobot.com/status-pages-best-practices/)
