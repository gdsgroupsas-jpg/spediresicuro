# Security Gate - Acting Context (Impersonation)

**Status:** ✅ ACTIVE (P0 Migration Completed)  
**Last Updated:** 2025-12-21  
**Owner:** Security Team

---

## 📋 OVERVIEW

Questo documento definisce le regole di sicurezza per l'**Acting Context** (Impersonation), una feature critica che permette a SuperAdmin/Reseller di operare per conto di altri utenti senza cambiare account.

**Obiettivo:** Garantire che ogni operazione finanziaria/wallet/spedizione sia correttamente attribuita al **TARGET** (chi paga) e tracciata con **ACTOR** (chi clicca).

---

## 🔐 ARCHITECTURAL RULES (NON-NEGOTIABLE)

### 1. Middleware as Enforcer

**RULE:** Solo `middleware.ts` può validare il cookie impersonation e iniettare header trusted.

- ✅ `middleware.ts` legge cookie `sp_impersonate_id`
- ✅ `middleware.ts` verifica autorizzazione (SuperAdmin, Reseller hierarchy)
- ✅ `middleware.ts` inietta header `x-sec-impersonate-target` se valido
- ❌ Business logic NON può leggere cookie direttamente
- ❌ Business logic NON può iniettare header trusted

### 2. No Direct Header Access

**RULE:** Business logic (Server Actions, API Routes) NON può leggere header direttamente.

- ✅ Usa `requireSafeAuth()` da `@/lib/safe-auth`
- ✅ `requireSafeAuth()` legge header trusted iniettati da middleware
- ❌ NON usare `auth()` direttamente in API routes/actions
- ❌ NON usare `headers().get()` direttamente in business logic

### 3. Fail-Closed

**RULE:** Se autenticazione o impersonation è invalida, l'operazione DEVE fallire.

- ✅ Cookie impersonation invalido → clear cookie + log security event + NO impersonation
- ✅ Target user non trovato → fail-closed + log security event
- ✅ Actor non autorizzato → fail-closed + log security event
- ❌ NON permettere operazioni se context è invalido

### 4. Actor vs Target

**RULE:** Distinguere sempre chi ESEGUE (actor) e per CHI (target).

- ✅ `context.actor.id` = chi clicca (SuperAdmin se impersonating)
- ✅ `context.target.id` = chi paga/riceve (cliente)
- ✅ Wallet debit/credit → usa `context.target.id`
- ✅ Shipment creation → usa `context.target.id` come `user_id`
- ✅ Audit log → traccia SEMPRE actor + target

---

## 🛠️ IMPLEMENTATION CHECKLIST

### ✅ P0 - Critical Files Migrated

- [x] `app/api/shipments/create/route.ts` → usa `requireSafeAuth()`, opera su `context.target.id`
- [x] `actions/wallet.ts` → usa `requireSafeAuth()`, opera su `context.target.id`
- [x] Audit log unificato → `lib/security/audit-log.ts` con `writeAuditLog()`
- [x] Audit taxonomy → `lib/security/audit-actions.ts` con azioni canoniche
- [x] ESLint guardrail → vietato import diretto `auth()` in `app/api/**` e `actions/**`

### 🔄 P1 - Other Files to Migrate (Backlog)

Vedi `GREP_GATE_REPORT.md` per lista completa di file con bypass `auth()`.

**Top Priority (P1):**

- `app/api/couriers/route.ts`
- `app/api/user/route.ts`
- `actions/couriers.ts`
- `actions/user.ts`

**Lower Priority (P2/P3):**

- Altri API routes non-critici
- Componenti UI (client-side OK, ma server components devono migrare)

---

## 🔍 GREP GATE - Bypass Detection

### Comandi per verificare bypass

```bash
# Cerca import diretto auth() in API routes e actions
grep -r "from '@/lib/auth-config'" app/api/ actions/

# Cerca uso diretto session.user (potenziale bypass)
grep -r "session\.user\." app/api/ actions/

# Cerca uso diretto headers().get() per impersonation
grep -r "headers\(\)\.get\('x-sec-impersonate" app/api/ actions/

# Verifica che tutti i file critici usino requireSafeAuth
grep -r "requireSafeAuth" app/api/shipments/ actions/wallet.ts
```

### Pattern da cercare (FORBIDDEN)

❌ `import { auth } from '@/lib/auth-config'` in `app/api/**` o `actions/**`  
❌ `const session = await auth()` in API routes/actions  
❌ `session.user.id` o `session.user.email` come chiave wallet/shipment  
❌ `headers().get('x-sec-impersonate-target')` in business logic

### Pattern corretti (ALLOWED)

✅ `import { requireSafeAuth } from '@/lib/safe-auth'`  
✅ `const context = await requireSafeAuth()`  
✅ `context.target.id` per operazioni wallet/shipment  
✅ `context.actor.id` per audit log  
✅ `writeAuditLog({ context, action, ... })` per logging

---

## 🔐 SECRETS HYGIENE

### Environment Variables

**CRITICAL:** Secrets NON devono MAI essere committati in git.

```bash
# Verifica che .env* sia ignorato
cat .gitignore | grep "\.env"

# Cerca secrets hardcoded (FORBIDDEN)
grep -r "ENCRYPTION_KEY.*=" --include="*.ts" --include="*.tsx" .
grep -r "AUTH_SECRET.*=" --include="*.ts" --include="*.tsx" .
grep -r "IMPERSONATION_COOKIE_SECRET.*=" --include="*.ts" --include="*.tsx" .
```

### Secrets Rotation

**Se un secret è esposto (commit, log, console):**

1. ✅ Genera nuovo secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. ✅ Aggiorna `.env.local` (development)
3. ✅ Aggiorna Vercel/Railway env vars (production)
4. ✅ Riavvia applicazione
5. ✅ Invalida vecchi cookie impersonation (se applicabile)
6. ✅ Log security event: `secret_rotated`

### .gitignore Rules

```gitignore
# CRITICAL: Ignora TUTTI i file .env (eccetto .env.example)
.env
.env.local
.env*.local
.env.production
.env.development
.env.railway
.env.vercel
.env.*
!/.env.example
```

---

## 📊 AUDIT LOG STANDARD

### Azioni Canoniche (da `AUDIT_ACTIONS`)

**Shipments:**

- `create_shipment`
- `update_shipment`
- `cancel_shipment`
- `shipment_adjustment` (conguaglio peso)

**Wallet:**

- `wallet_recharge`
- `wallet_debit`
- `wallet_credit`
- `wallet_adjustment`

**Impersonation:**

- `impersonation_started`
- `impersonation_ended`
- `impersonation_denied`
- `impersonation_invalid_cookie`
- `impersonation_expired`
- `impersonation_target_not_found`

### Metadata Standard

Ogni audit log DEVE includere:

```typescript
{
  actor_id: string,           // Chi ESEGUE (SuperAdmin se impersonating)
  target_id: string,          // Per CHI viene eseguita (cliente)
  impersonation_active: bool, // Flag impersonation
  reason?: string,            // Motivo (opzionale)
  ip?: string,                // IP address
  requestId?: string,         // Request ID per correlazione
  // ... altri campi custom
}
```

### Usage

```typescript
import { writeAuditLog } from '@/lib/security/audit-log';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '@/lib/security/audit-actions';

await writeAuditLog({
  context, // ActingContext da requireSafeAuth()
  action: AUDIT_ACTIONS.CREATE_SHIPMENT,
  resourceType: AUDIT_RESOURCE_TYPES.SHIPMENT,
  resourceId: shipment.id,
  metadata: { carrier, cost },
});
```

---

## 🧪 TESTING CHECKLIST

### Manual Tests (P0)

1. **User normale crea shipment:**
   - ✅ `user_id` = proprio ID
   - ✅ Wallet debit sul proprio wallet
   - ✅ Audit log: `actor_id = target_id`, `impersonation_active = false`

2. **SuperAdmin impersonating crea shipment:**
   - ✅ `user_id` = target ID (cliente)
   - ✅ Wallet debit sul wallet del cliente (NON del SuperAdmin)
   - ✅ Audit log: `actor_id = SuperAdmin`, `target_id = cliente`, `impersonation_active = true`

3. **SuperAdmin impersonating ricarica wallet:**
   - ✅ Credito aggiunto al wallet del cliente (NON del SuperAdmin)
   - ✅ Audit log: `actor_id = SuperAdmin`, `target_id = cliente`

4. **Cookie impersonation invalido:**
   - ✅ Cookie cleared
   - ✅ Security event logged: `impersonation_invalid_cookie`
   - ✅ Operazione continua in modalità normale (NO impersonation)

5. **Target user non trovato:**
   - ✅ Impersonation disattivata (fail-closed)
   - ✅ Security event logged: `impersonation_target_not_found`
   - ✅ Operazione continua come actor normale

6. **ESLint guardrail:**
   - ✅ `pnpm lint` fallisce se `auth()` importato in `app/api/**` o `actions/**`
   - ✅ Error message chiaro: "Use requireSafeAuth() instead"

### Automated Tests (TODO)

- [ ] Unit test `requireSafeAuth()` con/senza impersonation
- [ ] Integration test shipment creation con impersonation
- [ ] Integration test wallet recharge con impersonation
- [ ] E2E test impersonation flow (start → create shipment → exit)

---

## 🚨 SECURITY INCIDENTS

### Se scopri un bypass:

1. ✅ **NON committare** il bypass (se non ancora committato)
2. ✅ **Crea issue** con label `security` + `P0`
3. ✅ **Notifica team** immediatamente
4. ✅ **Migra file** a `requireSafeAuth()` ASAP
5. ✅ **Verifica audit log** per operazioni sospette
6. ✅ **Documenta** in `SECURITY_INCIDENTS.md` (se necessario)

### Se un secret è esposto:

1. ✅ **Rotazione immediata** (vedi "Secrets Rotation" sopra)
2. ✅ **Revoca vecchi token/cookie** (se applicabile)
3. ✅ **Audit log** per operazioni sospette
4. ✅ **Notifica team** + stakeholder (se necessario)
5. ✅ **Post-mortem** per prevenire futuri leak

---

## 📚 REFERENCES

- `lib/safe-auth.ts` - Safe Auth Helper (Acting Context)
- `lib/security/audit-log.ts` - Audit Log Unificato
- `lib/security/audit-actions.ts` - Azioni Canoniche
- `middleware.ts` - Impersonation Enforcement
- `GREP_GATE_REPORT.md` - Lista completa bypass
- `IMPERSONATION_HARDENING_COMPLETE.md` - Implementazione completa

---

## ✅ PR CHECKLIST

Prima di mergeare PR che toccano autenticazione/wallet/shipment:

- [ ] File usa `requireSafeAuth()` (NON `auth()` diretto)
- [ ] Operazioni wallet/shipment usano `context.target.id`
- [ ] Audit log presente con `writeAuditLog()`
- [ ] ESLint passa (`pnpm lint`)
- [ ] Test manuali eseguiti (vedi "Testing Checklist")
- [ ] Nessun secret hardcoded o committato
- [ ] `.env.example` aggiornato se nuovi env vars
- [ ] Documentazione aggiornata (se necessario)

---

**REMEMBER:** Acting Context è una feature P0 per sicurezza finanziaria. Ogni bypass può causare addebiti errati e perdita di fiducia. Fail-closed sempre.
