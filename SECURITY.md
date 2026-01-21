# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email us at: **security@spediresicuro.it** (or use GitHub Security Advisories)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

### What to Expect

| Timeline | Action                                         |
| -------- | ---------------------------------------------- |
| 24 hours | Acknowledgment of your report                  |
| 72 hours | Initial assessment and severity classification |
| 7 days   | Status update with remediation plan            |
| 30 days  | Fix deployed (critical/high severity)          |
| 90 days  | Fix deployed (medium/low severity)             |

### Severity Classification

We use CVSS v3.1 for severity scoring:

- **Critical (9.0-10.0)**: Immediate action, fix within 24-48h
- **High (7.0-8.9)**: Priority fix within 7 days
- **Medium (4.0-6.9)**: Scheduled fix within 30 days
- **Low (0.1-3.9)**: Fix in next release cycle

## Security Measures

### Authentication & Authorization

- NextAuth.js session-based authentication
- Row Level Security (RLS) on all tenant tables
- Acting Context pattern for impersonation audit trail
- Safe auth pattern (`requireSafeAuth()`) enforced via ESLint

### Data Protection

- GDPR compliance (data export, anonymization)
- Data encryption at rest (Supabase)
- Secrets in environment variables (never committed)
- Content Security Policy (CSP) configured

### Infrastructure

- Automated dependency updates (Dependabot weekly)
- Pre-commit hooks for code quality
- CI/CD security gates
- Sentry error tracking (no sensitive data leakage)

### Audit Logging

All sensitive operations are logged:

- Shipment creation/modification/deletion
- Wallet transactions
- Impersonation events
- User role changes
- Credential access

## Security Scanning

Our CI/CD pipeline includes:

- **SAST**: Static code analysis via ESLint security rules
- **Dependency Scanning**: `npm audit` on every build
- **Secret Scanning**: GitHub secret scanning enabled
- **License Compliance**: Automated license checks

## Responsible Disclosure

We appreciate security researchers who:

- Give us reasonable time to fix issues before public disclosure
- Avoid accessing or modifying other users' data
- Do not perform denial of service attacks
- Do not social engineer our team members

### Hall of Fame

We recognize security researchers who help us improve:

| Researcher      | Contribution | Date |
| --------------- | ------------ | ---- |
| _Be the first!_ |              |      |

## Contact

- Security issues: security@spediresicuro.it
- General inquiries: info@spediresicuro.it
- GitHub Security Advisories: [Report a vulnerability](https://github.com/gdsgroupsas-jpg/spediresicuro/security/advisories/new)

---

**Last Updated:** 2026-01-21
