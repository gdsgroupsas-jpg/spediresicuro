# Status Page Setup Guide

Guida per configurare un **Public Status Page** per comunicare uptime, incidents e maintenance ai clienti.

---

## 🎯 **Opzioni Raccomandate**

### **Opzione 1: UptimeRobot (FREE)** ⭐ Raccomandato

**Pro:**

- ✅ **FREE** fino a 50 monitor
- ✅ Public status page incluso
- ✅ Email/SMS/Webhook alerts
- ✅ 5 minuti di monitoring interval
- ✅ 90 giorni di history

**Contro:**

- ⚠️ Branding UptimeRobot (su free tier)
- ⚠️ Limited customization

**Setup rapido:**

1. Vai su [uptimerobot.com](https://uptimerobot.com)
2. Crea account gratuito
3. Aggiungi monitor:
   - **Website**: https://spediresicuro.vercel.app
   - **API Endpoint**: https://spediresicuro.vercel.app/api/health
   - **Database**: Supabase endpoint (via HTTP check)
4. Crea Public Status Page:
   - Nome: "SpedireSicuro Status"
   - URL: status.spediresicuro.it (custom domain) o uptimerobot.com/xxx
   - Mostra: Uptime percentages, response times, incident history

**URL Status Page:** `https://stats.uptimerobot.com/YOUR_KEY`

---

### **Opzione 2: Statuspage.io (Atlassian)** 💰 Paid

**Pro:**

- ✅ Professional branding
- ✅ Incident management workflow
- ✅ Subscriber notifications
- ✅ Integrations (Jira, Slack, PagerDuty)

**Contro:**

- ❌ **$29-79/mese** (costoso)

**Usare solo se:** Hai >100 clienti enterprise con SLA.

---

### **Opzione 3: Self-Hosted (GitHub Pages)** 🔧 DIY

**Pro:**

- ✅ Completamente gratis
- ✅ Full control

**Contro:**

- ⚠️ Richiede manutenzione manuale
- ⚠️ No automated uptime monitoring

**Implementazione:**

```bash
# Repository: spediresicuro-status
# GitHub Pages: https://gdsgroupsas-jpg.github.io/spediresicuro-status/
```

Usa template: [cstate/cstate](https://github.com/cstate/cstate) (Hugo static site)

---

## 📊 **Cosa Monitorare**

### **Endpoints Critici**

1. **Main Website**
   - URL: `https://spediresicuro.vercel.app`
   - Check interval: 5 minuti
   - Alert threshold: >3 failures

2. **API Health Check**
   - URL: `https://spediresicuro.vercel.app/api/health`
   - Expected response: `{"status": "ok"}`
   - Check interval: 5 minuti

3. **Database (Supabase)**
   - URL: `https://YOUR_PROJECT.supabase.co/rest/v1/` (HEAD request)
   - Check interval: 10 minuti

4. **AI Agent Endpoint**
   - URL: `https://spediresicuro.vercel.app/api/ai/agent-chat`
   - Check: HTTP 401 (authentication required) = OK
   - Check interval: 10 minuti

5. **Authentication**
   - URL: `https://spediresicuro.vercel.app/api/auth/session`
   - Expected: 200 OK
   - Check interval: 15 minuti

---

## 🚨 **Incident Response Workflow**

### **Severity Levels**

| Level             | Description                | Response Time | Example               |
| ----------------- | -------------------------- | ------------- | --------------------- |
| **P0 - Critical** | Sistema completamente down | <15 min       | Database offline      |
| **P1 - High**     | Feature principale broken  | <1 ora        | Payments failing      |
| **P2 - Medium**   | Feature secondaria broken  | <4 ore        | OCR slower than usual |
| **P3 - Low**      | UI glitch, non-critical    | <24 ore       | Button misaligned     |

### **Communication Template**

**Incident Detected:**

```
🔴 [P0] Website Down
Status: Investigating
Time: 2026-01-20 14:30 UTC
Affected: All users
ETA: Investigating...
```

**Update:**

```
🟡 [P0] Website Down - UPDATE
Status: Identified - Database connection timeout
Time: 2026-01-20 14:45 UTC
Next update: 15:00 UTC
```

**Resolved:**

```
🟢 [RESOLVED] Website Down
Status: Resolved
Time: 2026-01-20 15:10 UTC
Duration: 40 minutes
Root cause: Supabase planned maintenance (not in calendar)
Action: Added Supabase status to monitoring
```

---

## 📅 **Maintenance Windows**

### **Planned Maintenance**

Comunicare con **almeno 48 ore di anticipo**:

```markdown
🛠️ Scheduled Maintenance

Date: 2026-01-25
Time: 02:00 - 04:00 UTC (03:00 - 05:00 CET)
Duration: ~2 hours
Impact: Website will be unavailable
Reason: Database migration + performance optimization

Users affected: All
Alternative: N/A (brief downtime required)
```

### **Maintenance Calendar**

Pubblicare maintenance calendar:

- **Preferred window**: Sabato 02:00-04:00 UTC (minimo traffico)
- **Frequency**: Monthly (first Saturday)
- **Exception**: Urgent security patches (any time)

---

## 📈 **SLA (Service Level Agreement)**

### **Uptime Targets**

| Service      | Target       | Measurement            |
| ------------ | ------------ | ---------------------- |
| **Website**  | 99.5% uptime | Monthly                |
| **API**      | 99.5% uptime | Monthly                |
| **Database** | 99.9% uptime | Monthly (Supabase SLA) |

**Allowed downtime:**

- 99.5% = ~3.6 ore/mese
- 99.9% = ~43 minuti/mese

### **Performance Targets**

| Metric                | Target       | Measurement      |
| --------------------- | ------------ | ---------------- |
| **Page Load Time**    | <2s (p95)    | Core Web Vitals  |
| **API Response Time** | <500ms (p95) | Vercel Analytics |
| **Database Query**    | <100ms (p95) | Supabase metrics |

---

## 🔔 **Alert Channels**

### **Setup Notifications**

1. **Email Alerts**
   - Destinatari: team@spediresicuro.it, ops@spediresicuro.it
   - Trigger: Any downtime detected

2. **Slack Integration** (opzionale)
   - Channel: #alerts
   - Webhook: https://hooks.slack.com/services/xxx

3. **SMS Alerts** (P0 only)
   - Per: On-call engineer
   - Trigger: Critical (P0) incidents only

---

## 🎨 **Status Page Customization**

### **Branding**

```yaml
# Status page config
title: 'SpedireSicuro Status'
tagline: 'Real-time system status and uptime monitoring'
logo: '/brand/logo/logo-icon.png'
primary_color: '#4A90E2'
incident_history_days: 90
```

### **Components to Display**

- ✅ Website (spediresicuro.vercel.app)
- ✅ API (Backend services)
- ✅ Database (Supabase)
- ✅ AI Agent (Anne)
- ✅ Payment Processing (Stripe)
- ✅ Courier Integrations (Spedisci, Poste)

---

## 📊 **Metrics Dashboard**

### **Public Metrics** (safe to share)

- Overall uptime percentage (30/60/90 days)
- Average response time
- Incident count (by severity)
- Scheduled maintenance calendar

### **Private Metrics** (internal only)

- Database query performance
- API error rates
- User session metrics
- Cost metrics

---

## ✅ **Quick Start Checklist**

### **Fase 1: Setup (30 min)**

- [ ] Crea account UptimeRobot
- [ ] Aggiungi 5 monitor (website, API, DB, auth, AI)
- [ ] Crea public status page
- [ ] Configura alert emails

### **Fase 2: Branding (15 min)**

- [ ] Customize status page title/logo
- [ ] Set custom domain (optional): status.spediresicuro.it
- [ ] Add welcome message

### **Fase 3: Incident Response (15 min)**

- [ ] Documentare incident response workflow
- [ ] Definire on-call rotation
- [ ] Test alert notifications

### **Fase 4: Communication (15 min)**

- [ ] Aggiungi link status page nel footer
- [ ] Comunicare URL ai clienti
- [ ] Setup maintenance calendar

**Totale: ~1.5 ore** ✅

---

## 🔗 **Integration con Sistema**

### **Add Status Badge to README**

```markdown
![Status](https://img.shields.io/uptimerobot/status/YOUR_MONITOR_ID)
![Uptime](https://img.shields.io/uptimerobot/ratio/30/YOUR_MONITOR_ID)
```

### **Link nel Footer**

```tsx
// components/layout/Footer.tsx
<a href="https://status.spediresicuro.it" target="_blank">
  🟢 All Systems Operational
</a>
```

### **API Endpoint per Status**

```typescript
// app/api/status/route.ts
export async function GET() {
  const checks = await Promise.all([checkDatabase(), checkAPI(), checkExternalServices()]);

  return Response.json({
    status: checks.every((c) => c.ok) ? 'operational' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
}
```

---

## 📖 **Resources**

- [UptimeRobot](https://uptimerobot.com)
- [Statuspage.io](https://www.atlassian.com/software/statuspage)
- [cState (self-hosted)](https://github.com/cstate/cstate)
- [Incident Response Best Practices](https://increment.com/on-call/incident-response-best-practices/)

---

**Last Updated:** 2026-01-20
**Status:** Ready for implementation (1.5 ore)
