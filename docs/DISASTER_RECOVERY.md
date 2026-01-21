# Disaster Recovery Plan

**Last Updated:** 2026-01-21
**Owner:** Engineering Team
**Review Cycle:** Quarterly

---

## Executive Summary

This document outlines the disaster recovery procedures for SpedireSicuro, ensuring business continuity in case of system failures, data loss, or security incidents.

---

## Recovery Objectives

| Metric                             | Target    | Description                  |
| ---------------------------------- | --------- | ---------------------------- |
| **RTO** (Recovery Time Objective)  | < 4 hours | Maximum acceptable downtime  |
| **RPO** (Recovery Point Objective) | < 1 hour  | Maximum acceptable data loss |
| **MTTR** (Mean Time To Recovery)   | < 2 hours | Average recovery time        |

---

## Infrastructure Overview

### Production Stack

| Component      | Provider              | Region         | Redundancy    |
| -------------- | --------------------- | -------------- | ------------- |
| Application    | Vercel                | Global Edge    | Multi-region  |
| Database       | Supabase (PostgreSQL) | EU (Frankfurt) | Daily backups |
| Auth           | Supabase Auth         | EU             | Replicated    |
| Redis Cache    | Upstash               | EU             | Multi-zone    |
| File Storage   | Supabase Storage      | EU             | Replicated    |
| Error Tracking | Sentry                | Global         | N/A           |
| Analytics      | Vercel Analytics      | Global         | N/A           |

### Critical Dependencies

1. **Supabase** - Database, Auth, Storage
2. **Vercel** - Hosting, Edge Functions
3. **Upstash** - Redis rate limiting, queue
4. **External APIs** - Courier APIs (GLS, BRT, Poste, etc.)

---

## Backup Strategy

### Database Backups (Supabase)

| Type           | Frequency        | Retention | Location                  |
| -------------- | ---------------- | --------- | ------------------------- |
| Point-in-time  | Continuous       | 7 days    | Supabase (Pro plan)       |
| Daily Snapshot | Daily 03:00 UTC  | 30 days   | Supabase                  |
| Weekly Archive | Sunday 03:00 UTC | 90 days   | External S3 (recommended) |

### Application Code

| Type                  | Location           | Retention |
| --------------------- | ------------------ | --------- |
| Git Repository        | GitHub             | Permanent |
| Deployment Snapshots  | Vercel             | 30 days   |
| Environment Variables | Vercel + 1Password | Permanent |

### Configuration Backups

```bash
# Export critical configs (run monthly)
supabase db dump -f backup_$(date +%Y%m%d).sql
vercel env pull .env.backup
```

---

## Disaster Scenarios & Response

### Scenario 1: Application Unavailable

**Symptoms:** Users cannot access the application, 5xx errors

**Response:**

1. Check Vercel status: https://www.vercel-status.com/
2. Check deployment logs: `vercel logs --follow`
3. If Vercel issue → Wait for resolution, communicate via status page
4. If code issue → Rollback to previous deployment:
   ```bash
   vercel rollback
   ```

**Recovery Time:** 5-30 minutes

---

### Scenario 2: Database Unavailable

**Symptoms:** Application errors, "Database connection failed"

**Response:**

1. Check Supabase status: https://status.supabase.com/
2. Verify connection in Supabase Dashboard
3. If regional issue → Wait for failover (automatic)
4. If data corruption → Restore from point-in-time:
   - Supabase Dashboard → Database → Backups → Restore

**Recovery Time:** 30 minutes - 2 hours

---

### Scenario 3: Data Loss / Corruption

**Symptoms:** Missing or incorrect data reported by users

**Response:**

1. Identify scope of data loss (which tables, timeframe)
2. Stop writes to affected tables (maintenance mode)
3. Restore from point-in-time backup:
   ```sql
   -- Supabase point-in-time recovery
   -- Contact Supabase support for specific timestamp
   ```
4. Validate data integrity
5. Resume normal operations

**Recovery Time:** 1-4 hours

---

### Scenario 4: Security Breach

**Symptoms:** Unauthorized access, data exfiltration, suspicious activity

**Response:**

1. **Immediate (0-15 min):**
   - Rotate all API keys and secrets
   - Revoke suspicious sessions
   - Enable maintenance mode if needed

2. **Investigation (15-60 min):**
   - Review audit logs: `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 1000`
   - Check Sentry for anomalies
   - Review Vercel access logs

3. **Containment (1-4 hours):**
   - Patch vulnerability
   - Reset affected user passwords
   - Notify affected users (if data breach)

4. **Post-incident:**
   - Write incident report
   - Update security procedures
   - Schedule security review

**Recovery Time:** 2-24 hours (depending on severity)

---

### Scenario 5: Third-Party API Failure

**Symptoms:** Courier bookings failing, tracking not updating

**Response:**

1. Check courier API status pages
2. Enable fallback mode (queue failed requests)
3. Retry failed operations when API recovers
4. Communicate delays to affected users

**Recovery Time:** Dependent on third-party

---

## Rollback Procedures

### Application Rollback (Vercel)

```bash
# List recent deployments
vercel list

# Rollback to specific deployment
vercel rollback <deployment-url>

# Or via Dashboard: Vercel → Project → Deployments → ... → Promote to Production
```

### Database Rollback (Supabase)

1. Go to Supabase Dashboard → Database → Backups
2. Select backup point (within last 7 days)
3. Click "Restore" → Confirm
4. Wait for restoration (5-30 min depending on size)

### Configuration Rollback

```bash
# Restore environment variables
vercel env pull .env.production
# Compare with backup
diff .env.production .env.backup
# Restore specific variables via Vercel Dashboard
```

---

## Communication Plan

### Internal Escalation

| Severity      | Response Time     | Notify                 |
| ------------- | ----------------- | ---------------------- |
| Critical (P0) | Immediate         | CTO, Lead Dev, On-call |
| High (P1)     | < 30 min          | Lead Dev, On-call      |
| Medium (P2)   | < 2 hours         | On-call                |
| Low (P3)      | Next business day | Dev Team               |

### External Communication

| Channel       | Use Case                       | Template                    |
| ------------- | ------------------------------ | --------------------------- |
| Status Page   | Outages, maintenance           | See templates below         |
| Email         | Data breaches, major incidents | GDPR-compliant notice       |
| In-app Banner | Degraded service               | "Some features may be slow" |

### Status Templates

**Investigating:**

```
We are investigating reports of [issue description].
Some users may experience [symptoms].
We will provide updates as we learn more.
```

**Identified:**

```
We have identified the cause of [issue].
Our team is working on a fix.
ETA for resolution: [time].
```

**Resolved:**

```
The issue affecting [service] has been resolved.
All systems are now operating normally.
We apologize for any inconvenience.
```

---

## Testing & Drills

### Monthly Tests

- [ ] Verify backup accessibility
- [ ] Test restore procedure (staging environment)
- [ ] Review and update contact list
- [ ] Check monitoring alerts are working

### Quarterly Drills

- [ ] Full disaster recovery simulation (staging)
- [ ] Runbook review and updates
- [ ] Team training on new procedures
- [ ] Update this document

### Annual Review

- [ ] Third-party vendor DR capabilities review
- [ ] RTO/RPO targets reassessment
- [ ] Full DR plan audit
- [ ] Compliance verification (GDPR, etc.)

---

## Monitoring & Alerts

### Health Endpoints

| Endpoint            | Purpose         | Alert Threshold |
| ------------------- | --------------- | --------------- |
| `/api/health/live`  | App is running  | Down > 30s      |
| `/api/health/ready` | Dependencies OK | Unhealthy > 60s |

### Alert Channels

| Severity | Channel       | Response          |
| -------- | ------------- | ----------------- |
| Critical | PagerDuty/SMS | Immediate         |
| High     | Slack #alerts | < 30 min          |
| Medium   | Email         | < 2 hours         |
| Low      | Dashboard     | Next business day |

### Key Metrics to Monitor

- Error rate > 1%
- Response time p95 > 2s
- Database connections > 80%
- Redis memory > 80%
- Failed courier API calls > 10%

---

## Appendix

### A. Emergency Contacts

| Role             | Contact             | Backup           |
| ---------------- | ------------------- | ---------------- |
| CTO              | [internal]          | [internal]       |
| Lead Developer   | [internal]          | [internal]       |
| DevOps           | [internal]          | [internal]       |
| Supabase Support | support@supabase.io | Dashboard ticket |
| Vercel Support   | support@vercel.com  | Dashboard ticket |

### B. Critical Credentials Location

All credentials stored in:

1. **Vercel Environment Variables** (production)
2. **1Password Vault** (backup)
3. **GitHub Secrets** (CI/CD)

### C. Recovery Checklist

```markdown
## Incident Recovery Checklist

- [ ] Incident identified and logged
- [ ] Severity assessed (P0/P1/P2/P3)
- [ ] Team notified per escalation matrix
- [ ] Status page updated (if user-facing)
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Fix verified in staging
- [ ] Fix deployed to production
- [ ] Monitoring confirmed normal
- [ ] Status page updated (resolved)
- [ ] Incident report drafted
- [ ] Post-mortem scheduled (if P0/P1)
```

---

**Document Version:** 1.0
**Next Review:** 2026-04-21
