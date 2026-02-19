# SpedireSicuro — Security Audit Pack

> **Versione**: 1.0 — 19 febbraio 2026
> **Score attuale**: 9.2/10 (multi-tenant isolation: 9.7/10)
> **Stato**: Tutti i finding CRITICAL/HIGH chiusi. Residuo: backlog UX (a11y).

---

## 1. Threat Model

### 1.1 Attori

| Attore                 | Descrizione                     | Trust Level                                          |
| ---------------------- | ------------------------------- | ---------------------------------------------------- |
| **Utente anonimo**     | Visitatore non autenticato      | ZERO — solo route pubbliche                          |
| **Utente autenticato** | Cliente con account e workspace | BASSO — vede solo dati del proprio workspace         |
| **Reseller**           | Rivenditore con sub-client      | MEDIO — vede dati propri + sub-client assegnati      |
| **Admin**              | Operatore piattaforma           | ALTO — gestione operativa (no dati privati reseller) |
| **Superadmin**         | Proprietario piattaforma        | MASSIMO — accesso completo                           |

### 1.2 Asset protetti

| Asset                                   | Classificazione | Protezione                                              |
| --------------------------------------- | --------------- | ------------------------------------------------------- |
| Dati spedizione (mittente/destinatario) | PII — ALTO      | RLS workspace + workspaceQuery()                        |
| Credenziali API corrieri                | SEGRETO         | Encryption at rest (AES-256-GCM) + RBAC                 |
| Wallet balance                          | FINANZIARIO     | RPC SECURITY DEFINER + idempotency + compensation queue |
| Listini reseller                        | COMMERCIALE     | RLS workspace + workspaceQuery()                        |
| Sessioni utente                         | AUTH            | NextAuth JWT + HttpOnly cookie + CSRF                   |
| Chiavi ambiente                         | INFRASTRUTTURA  | .env.local (dev) / Vercel Dashboard (prod) — mai in git |

### 1.3 Superficie di attacco

```
Internet → Vercel Edge → Middleware (L1) → API Routes (L2) → Supabase RLS (L3) → PostgreSQL
                              ↓
                     Fail-closed su:
                     - session null → 401/redirect
                     - auth() error → 500/redirect
                     - route boundary mismatch → deny
```

### 1.4 Threat scenarios

| #   | Scenario                                  | Mitigazione                                               | Layer |
| --- | ----------------------------------------- | --------------------------------------------------------- | ----- |
| T1  | Utente accede a dati di altro workspace   | workspaceQuery() obbligatorio + RLS DB                    | L2+L3 |
| T2  | Reseller vede dati di altro reseller      | workspace isolation + membership check                    | L2+L3 |
| T3  | Admin vede listini privati reseller       | workspaceQuery scopa a workspace admin (platform)         | L2    |
| T4  | Bypass middleware su route protetta       | Fail-closed + boundary check esatto                       | L1    |
| T5  | Utente senza workspace accede a dashboard | ensureUserWorkspace() auto-provisioning                   | L2    |
| T6  | Doppio addebito wallet                    | Idempotency key + advisory lock + compensation queue      | L2+DB |
| T7  | Injection su input utente                 | Zod validation server-side + sanitizzazione errori        | L2    |
| T8  | SSRF via URL configurazione               | allowlist domini + SSRF guard                             | L2    |
| T9  | Escalation ruolo (user → admin)           | account_type source of truth + auth-helpers centralizzati | L2    |
| T10 | Rate limiting bypass                      | Rate limiter su API critiche (wallet, auth, webhook)      | L1+L2 |

---

## 2. Active Controls

### 2.1 Architettura di sicurezza a 3 layer

#### Layer 1 — Middleware (`middleware.ts`)

- **Fail-closed**: session null → 401 (API) / redirect login (dashboard)
- **Fail-closed**: catch auth() → 500 (API) / redirect login
- **Boundary check**: `pathname === route || pathname.startsWith(route + '/')` — previene prefix matching attack
- **Commit**: `13fc61c`

#### Layer 2 — Application (API routes + Server Actions)

- **getWorkspaceAuth()**: verifica membership workspace + auto-provisioning via `ensureUserWorkspace()`
- **workspaceQuery(workspaceId)**: wrapper obbligatorio per tutte le tabelle multi-tenant
- **getSafeAuth()**: autenticazione base senza workspace (per bootstrap endpoints)
- **auth-helpers.ts**: helper puri (`isAdminOrAbove()`, `isSuperAdminCheck()`, `isResellerCheck()`, `isBYOC()`)
- **RBAC Guardian**: test automatico che blocca check inline su role (baseline: 0 violazioni)
- **Workspace Query Guardian**: test automatico che blocca accesso diretto a tabelle multi-tenant (baseline: 0 violazioni)

#### Layer 3 — Database RLS (PostgreSQL via Supabase)

- **33 tabelle** con RLS attivo
- **SECURITY DEFINER functions**: `get_user_workspace_ids()`, `get_user_accessible_workspace_ids()`, `is_superadmin()`
- **No subquery inline** nelle policy (previene infinite recursion 42P17)
- **Ruolo 'authenticated'** (mai 'public' che bypasserebbe tutto)
- **8 migration** RLS applicate via Supabase Management API

### 2.2 RBAC Model

```
account_type (SOURCE OF TRUTH — campo users.account_type)
├── superadmin    → accesso completo piattaforma
├── admin         → gestione operativa (no dati privati reseller)
├── reseller      → gestione propria + sub-client
├── byoc          → bring-your-own-carrier
└── user          → cliente standard (solo proprio workspace)

workspace.role (MEMBERSHIP — campo workspace_members.role)
├── owner         → proprietario workspace (non rimuovibile)
├── admin         → co-admin workspace
└── member        → membro base
```

**Regola**: `account_type` per autorizzazione globale, `workspace.role` per permessi intra-workspace.

### 2.3 Multi-Tenant Isolation

| Categoria                | Tabelle                                                                                                                         | Protezione                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Tenant-scoped**        | shipments, price_lists, wallet_transactions, commercial_quotes, emails, leads, reseller_prospects, audit_logs, warehouse tables | `workspaceQuery(workspaceId)` obbligatorio + RLS |
| **Global** (piattaforma) | users, workspaces, workspace_members, couriers, courier_configs, system_settings, automations                                   | `supabaseAdmin` diretto OK                       |

**Design choice**: listini base e configurazioni corriere con `owner_user_id IS NULL` sono dati piattaforma (template globali), non dati tenant. I dati cliente sono SEMPRE workspace-scoped.

### 2.4 Wallet Atomicity

- **RPC v2**: `deduct_wallet_credit_v2`, `add_wallet_credit_v2`, `refund_wallet_balance_v2`
- **Advisory lock**: `pg_advisory_xact_lock` per workspace_id
- **CHECK constraint**: `wallet_balance >= 0` (DB-level, non bypassabile)
- **Idempotency key**: obbligatoria su ogni operazione wallet
- **Compensation queue**: retry con backoff esponenziale, dead letter dopo 5 tentativi
- **Doppio source of truth**: `workspaces.wallet_balance` (primario) + `users.wallet_balance` (legacy sync)

### 2.5 Input Validation

- **Zod schemas** su tutti gli endpoint pubblici
- **Server-side price verification**: prezzo ricalcolato server-side, cliente non puo' manipolare
- **Error sanitization**: `error.message` mai esposto al client (generico "Errore interno")
- **SSRF guard**: allowlist domini per URL esterni
- **Rate limiting**: su wallet, auth, webhook endpoints

---

## 3. Test Evidence

### 3.1 Test Suite Summary

| Categoria             | File       | Test                        | Status                |
| --------------------- | ---------- | --------------------------- | --------------------- |
| **Unit tests**        | 176        | 3411                        | 3411 passed, 0 failed |
| **Integration tests** | 15+        | ~200                        | passing               |
| **E2E Playwright**    | 11 spec    | 37 working, 22 skipped (CI) | passing               |
| **Pricing/VAT**       | dedicati   | ~50                         | passing               |
| **Security**          | 4          | ~50                         | passing               |
| **TOTALE**            | ~200+ file | ~3700+                      | GREEN                 |

### 3.2 Security-Specific Tests

| Test File                                            | Cosa verifica                                        | Baseline         |
| ---------------------------------------------------- | ---------------------------------------------------- | ---------------- |
| `tests/unit/workspace-query-guardian.test.ts`        | Zero accessi diretti a tabelle multi-tenant          | **0 violazioni** |
| `tests/unit/rbac-inline-guardian.test.ts`            | Zero check inline su role fuori da auth-helpers      | **0 violazioni** |
| `tests/unit/workspace-bootstrap.test.ts`             | ensureUserWorkspace: 6 scenari (happy path + errori) | 6/6 passing      |
| `tests/security/rls-multi-tenant.test.ts`            | RLS reale su DB: cross-workspace access denied       | 6/6 passing      |
| `tests/unit/capability-helpers.test.ts`              | Permission check con account_type                    | passing          |
| `tests/unit/reseller-workspace-provisioning.test.ts` | Provisioning workspace reseller + sub-client         | 23/23 passing    |

### 3.3 Guardian Pattern

I "guardian test" sono test automatici che scansionano il codebase per pattern vietati:

```
workspace-query-guardian → impedisce supabaseAdmin.from() su tabelle tenant
rbac-inline-guardian     → impedisce .role === 'admin' fuori da helper centrali
```

Se un developer introduce un pattern vietato, il test fallisce in CI. Baseline: **0 violazioni per entrambi**.

---

## 4. Incident Response Runbook

### 4.1 Sospetto accesso cross-tenant

```
1. CONTIENI: Disabilita utente sospetto via Supabase Dashboard
   → UPDATE users SET account_type = 'disabled' WHERE id = '...'
2. VERIFICA: Controlla audit_logs per workspace_id anomali
   → SELECT * FROM audit_logs WHERE user_id = '...' ORDER BY created_at DESC
3. ANALIZZA: Confronta workspace_id nelle azioni vs membership
   → SELECT * FROM workspace_members WHERE user_id = '...'
4. NOTIFICA: Se confermato, notifica utenti impattati entro 72h (GDPR)
5. REMEDIATE: Applica fix + aggiungi test di regressione
6. POST-MORTEM: Documenta in docs/00-HANDBOOK/security/incidents/
```

### 4.2 Sospetta manipolazione wallet

```
1. CONTIENI: Congela wallet utente
   → UPDATE workspaces SET wallet_balance = 0 WHERE id = '...'
2. VERIFICA: Controlla wallet_transactions per pattern anomali
   → SELECT * FROM wallet_transactions WHERE workspace_id = '...'
     ORDER BY created_at DESC LIMIT 50
3. VERIFICA IDEMPOTENCY: Cerca duplicati
   → SELECT idempotency_key, COUNT(*) FROM wallet_transactions
     WHERE workspace_id = '...' GROUP BY idempotency_key HAVING COUNT(*) > 1
4. COMPENSATION: Se necessario, usa compensation queue per rollback
5. REMEDIATE: Fix + test regressione
```

### 4.3 Sospetto privilege escalation

```
1. CONTIENI: Revoca sessione utente
   → DELETE FROM sessions WHERE user_id = '...'
2. VERIFICA: Controlla account_type vs attivita'
   → SELECT account_type, role FROM users WHERE id = '...'
   → SELECT * FROM audit_logs WHERE user_id = '...' AND action LIKE '%admin%'
3. VERIFICA JWT: account_type nel token deve corrispondere a DB
4. REMEDIATE: Se discrepanza, allinea DB → rigenera token
5. GUARDIAN CHECK: Verifica che rbac-inline-guardian sia ancora a 0 violazioni
```

### 4.4 Webhook compromesso

```
1. CONTIENI: Ruota secret webhook (Vercel Dashboard + provider)
2. VERIFICA: Log webhook recenti per payload anomali
3. REMEDIATE: Il webhook e' fail-closed — senza secret valido, viene rifiutato
4. NOTA: Nessun bypass dev-mode (rimosso, commit a1fc4bc)
```

---

## 5. Security Changelog

| Data       | Commit    | Descrizione                                               | Finding             |
| ---------- | --------- | --------------------------------------------------------- | ------------------- |
| 2026-02-17 | `b094659` | RLS difensivo: 8 migration, 33 tabelle                    | Audit MT            |
| 2026-02-17 | `a202a56` | SECURITY DEFINER functions + fix recursion                | Audit MT            |
| 2026-02-17 | `4204d87` | Fix CRITICAL price-lists.ts + admin/shipments DELETE      | F-MT-1, F-MT-2      |
| 2026-02-17 | `3ce8688` | createShipmentCore workspace_id mancante                  | F-MT-3              |
| 2026-02-18 | `13fc61c` | Middleware fail-closed + boundary check                   | F1, F2 (middleware) |
| 2026-02-18 | `580d914` | logistics.ts fail-closed workspaceId=null                 | F3 (fallback)       |
| 2026-02-18 | `f19ff16` | Rate limit, SSRF guard, error sanitize, timeout           | CTO Assessment      |
| 2026-02-18 | `4c1749b` | Error message sanitization + dead code removal            | CTO residuo         |
| 2026-02-18 | `8c2baa2` | Consolidamento RBAC: isSuperAdmin → account_type only     | F1 (RBAC)           |
| 2026-02-19 | `9dfda4e` | Audit R3: RBAC legacy role checks uniformati              | F1 (residuo)        |
| 2026-02-19 | `d846a66` | Audit R2: 4 gap residui chiusi                            | F2, F3, F4          |
| 2026-02-19 | `a1fc4bc` | Audit R4: 14 file COD/support/admin + webhook fail-closed | F1-F4               |
| 2026-02-19 | `b9d16f3` | DoD 1+2: workspace bootstrap + RBAC guardian              | DoD 1, DoD 2        |

---

## 6. Finding Status Matrix

| ID  | Severita | Descrizione                                   | Status         | Commit                |
| --- | -------- | --------------------------------------------- | -------------- | --------------------- |
| F1  | CRITICAL | price-lists.ts senza workspace scope          | **CHIUSO**     | `4204d87`             |
| F2  | HIGH     | admin/shipments DELETE senza workspace        | **CHIUSO**     | `4204d87`             |
| F3  | HIGH     | createShipmentCore workspace_id mancante      | **CHIUSO**     | `3ce8688`             |
| F4  | HIGH     | Middleware fail-open su session null          | **CHIUSO**     | `13fc61c`             |
| F5  | HIGH     | Middleware prefix matching permissivo         | **CHIUSO**     | `13fc61c`             |
| F6  | MEDIUM   | logistics.ts fallback supabaseAdmin wsId=null | **CHIUSO**     | `580d914`             |
| F7  | MEDIUM   | RBAC mixed role/account_type in endpoints     | **CHIUSO**     | `a1fc4bc` + `b9d16f3` |
| F8  | MEDIUM   | Bootstrap workspace fragile (lockout)         | **CHIUSO**     | `b9d16f3`             |
| F9  | LOW      | Dev-mode fail-open webhook UptimeRobot        | **CHIUSO**     | `a1fc4bc`             |
| F10 | LOW      | A11y workspace switcher                       | **BACKLOG UX** | —                     |

**Score**: 9/10 finding chiusi. Unico residuo: F10 (accessibilita') — backlog UX, non security-critical.

---

## 7. Architettura Difensiva — Riepilogo

```
                    ┌───────────────────────┐
                    │   GUARDIAN TESTS (CI)  │
                    │ workspace-query: 0 viol│
                    │ rbac-inline:     0 viol│
                    └───────────┬───────────┘
                                │ prevengono regressioni
                                ▼
┌──────────┐    ┌──────────┐    ┌──────────┐
│ LAYER 1  │───▶│ LAYER 2  │───▶│ LAYER 3  │
│Middleware │    │App Logic │    │DB (RLS)  │
│fail-closed│    │wsQuery() │    │33 tabelle│
│boundary   │    │auth-help │    │SEC DEF   │
└──────────┘    └──────────┘    └──────────┘
     │               │               │
     └───────────────┴───────────────┘
              Defense in Depth
         Ogni layer blocca indipendentemente
```

---

## Appendice A: File chiave di sicurezza

| File                                          | Ruolo                                            |
| --------------------------------------------- | ------------------------------------------------ |
| `middleware.ts`                               | Layer 1: routing + auth check                    |
| `lib/workspace-auth.ts`                       | getWorkspaceAuth + ensureUserWorkspace           |
| `lib/safe-auth.ts`                            | getSafeAuth + isSuperAdmin                       |
| `lib/auth-helpers.ts`                         | Helper puri RBAC (isAdminOrAbove, etc.)          |
| `lib/db/workspace-query.ts`                   | workspaceQuery wrapper + WORKSPACE_SCOPED_TABLES |
| `lib/security/audit-log.ts`                   | Audit logging                                    |
| `lib/security/encryption.ts`                  | AES-256-GCM per credenziali corrieri             |
| `lib/security/rate-limit.ts`                  | Rate limiting middleware                         |
| `lib/security/ssrf-guard.ts`                  | SSRF prevention                                  |
| `tests/unit/workspace-query-guardian.test.ts` | Guardian: 0 accessi diretti                      |
| `tests/unit/rbac-inline-guardian.test.ts`     | Guardian: 0 check inline                         |
| `tests/security/rls-multi-tenant.test.ts`     | RLS reale cross-workspace                        |

## Appendice B: Comandi di verifica rapida

```bash
# Verifica tutti i guardian + security tests
npm run test:unit -- --grep "guardian\|RBAC\|workspace-bootstrap"

# Verifica RLS reale
npm run test:security

# Full suite
npm run test:unit   # 3411+ test
npm run build       # zero errori compilazione

# Grep per pattern vietati (deve ritornare solo file autorizzati)
grep -rn "\.role === 'admin'" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=tests --exclude-dir=.next
```
