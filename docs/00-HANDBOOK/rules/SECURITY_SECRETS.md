---
title: Security - Secrets Management
scope: rules
audience: all
owner: engineering
status: active
source_of_truth: true
updated: 2026-01-26
priority: CRITICAL
---

# REGOLE SEGRETI - MAI COMMITTARE!

## REGOLA ASSOLUTA

**I SEGRETI NON VANNO MAI E POI MAI COMMITTATI NEL REPOSITORY.**

Questa regola non ha eccezioni.

---

## Cosa sono i segreti?

| Tipo                      | Pattern                          | Esempio                                 |
| ------------------------- | -------------------------------- | --------------------------------------- |
| Google OAuth Secret       | `GOCSPX-*`                       | `GOCSPX-abc123...`                      |
| Google Client ID          | `*-*.apps.googleusercontent.com` | `123456-abc.apps.googleusercontent.com` |
| Supabase Access Token     | `sbp_*`                          | `sbp_abc123...`                         |
| Supabase Service Role Key | `eyJhbGciOi...` (JWT)            | Token lungo base64                      |
| GitHub Token              | `ghp_*`, `gho_*`, `ghs_*`        | `ghp_abc123...`                         |
| NextAuth Secret           | Qualsiasi stringa segreta        | `my-secret-key-32chars`                 |
| API Keys                  | `*_API_KEY`, `*_SECRET`          | Qualsiasi chiave API                    |
| Password                  | Qualsiasi password               | `password123`                           |

---

## Dove mettere i segreti?

### Sviluppo locale

```
.env.local  (MAI committare - e' nel .gitignore)
```

### Produzione

```
Vercel Dashboard > Settings > Environment Variables
```

### CI/CD

```
GitHub > Settings > Secrets and variables > Actions
```

---

## Cosa fare SE hai committato un segreto

1. **RUOTA IMMEDIATAMENTE** la credenziale (genera una nuova)
2. **PULISCI** la cronologia git con `git-filter-repo`
3. **FORCE PUSH** al remote
4. **AVVISA** il team di ri-clonare

---

## Prevenzione

### Pre-commit hooks (ATTIVI)

Il repository ha `.pre-commit-config.yaml` con gitleaks che blocca i commit con segreti.

Installazione:

```bash
pip install pre-commit
pre-commit install
```

### CI Security Scan (ATTIVO)

TruffleHog scansiona ogni PR e push per segreti.

---

## File di esempio consentiti

L'unico file con "segreti" consentito e':

```
.env.example  (contiene solo placeholder, MAI valori reali)
```

Esempio corretto:

```env
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
```

---

## Checklist per ogni PR

- [ ] Nessun segreto nei file modificati
- [ ] Nessun segreto nei messaggi di commit
- [ ] Nessun segreto nella documentazione
- [ ] Pre-commit hooks installati e funzionanti

---

## Storico incidenti

| Data       | Tipo                                       | Azione                                 |
| ---------- | ------------------------------------------ | -------------------------------------- |
| 2026-01-26 | Google OAuth, Supabase Token, GitHub Token | Cronologia pulita, credenziali ruotate |

---

_Questa regola e' assoluta e non negoziabile._
