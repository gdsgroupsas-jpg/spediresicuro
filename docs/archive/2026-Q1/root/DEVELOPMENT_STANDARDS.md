# Development Standards

**Linee guida obbligatorie per tutto il team di sviluppo.**
Questi standard si applicano a developer interni, contractor, AI agents, e qualsiasi contributor.

---

## 🎯 Principi Fondamentali

### 1. **"No Credit, No Label"**

- NESSUNA spedizione senza saldo wallet prepagato
- Operazioni wallet SOLO tramite SQL functions atomiche
- Zero eccezioni a questa regola

### 2. **Type Safety First**

- TypeScript strict mode SEMPRE attivo
- NO `any` types (usa `unknown` se necessario)
- Tutti i file `.ts` o `.tsx` (no JavaScript)

### 3. **Security by Default**

- Row Level Security (RLS) su TUTTE le tabelle
- Safe auth pattern: `requireSafeAuth()` invece di `auth()`
- NO PII nei log (solo `trace_id` e `user_id_hash`)

---

## 📋 Code Quality Standards

### **TypeScript**

```typescript
// ✅ GOOD
function calculatePrice(weight: number, zone: string): PriceResult {
  return { amount: weight * 10, currency: 'EUR' };
}

// ❌ BAD - any types
function calculatePrice(weight: any, zone: any): any {
  return weight * 10;
}
```

**Requisiti:**

- `tsc --noEmit` deve passare SEMPRE
- Explicit return types su tutte le funzioni pubbliche
- Interfaces per oggetti complessi

### **Code Formatting**

```bash
# Prima di ogni commit
npm run format

# Check formatting
npm run format:check
```

**Standard Prettier:**

- Single quotes per strings
- Semicolons obbligatori
- Tab width: 2 spaces
- Line ending: LF (Unix)

### **Testing**

**Coverage minimo:**

- Lines: 70%
- Functions: 65%
- Branches: 60%
- Statements: 70%

**Tipologie test:**

```bash
# Unit tests (funzioni pure, business logic)
npm run test:unit

# Integration tests (DB, API, services)
npm run test:integration

# E2E tests (user flows)
npm run test:e2e
```

**Regole:**

- Ogni nuova feature DEVE avere test
- Critical paths (pricing, wallet) coverage >80%
- NO merge senza CI verde

---

## 🔒 Security Standards

### **Authentication**

```typescript
// ✅ GOOD - Safe auth con Acting Context support
import { requireSafeAuth } from '@/lib/safe-auth';

export async function GET(request: Request) {
  const session = await requireSafeAuth();
  // ...
}

// ❌ BAD - Direct auth() usage
import { auth } from '@/lib/auth-config';

export async function GET(request: Request) {
  const session = await auth();
  // ...
}
```

### **SQL Queries**

```typescript
// ✅ GOOD - Parametrized query
const { data } = await supabase.from('shipments').select('*').eq('user_id', userId);

// ❌ BAD - String interpolation (SQL injection risk)
const { data } = await supabase.rpc('execute_sql', {
  query: `SELECT * FROM shipments WHERE user_id='${userId}'`,
});
```

### **Secrets Management**

- SEMPRE usare variabili d'ambiente
- NO hardcoded API keys
- `.env.local` in `.gitignore`
- Sentry per error tracking (NO log sensibili)

---

## 🌳 Git Workflow

### **Branch Strategy**

```
master (produzione)
  ↑
feature/* (sviluppo)
  ↑
developer branches
```

### **Commit Messages**

Formato: [Conventional Commits](https://www.conventionalcommits.org/)

```bash
# Feature
feat(pricing): add multi-account price list support

# Bug fix
fix(wallet): prevent race condition in balance update

# Refactor
refactor(agent): extract OCR logic to dedicated worker

# Documentation
docs(readme): add deployment checklist

# Tests
test(pricing): add edge cases for VAT calculation
```

**Prefixes obbligatori:**

- `feat`: nuova feature
- `fix`: bug fix
- `refactor`: refactoring (no behavior change)
- `test`: aggiunta/modifica test
- `docs`: documentazione
- `chore`: task manutenzione (deps, config)
- `ci`: CI/CD changes

### **Pull Request Requirements**

**PRIMA di aprire PR:**

1. ✅ `npm run lint` passa
2. ✅ `npm run type-check` passa
3. ✅ `npm run format` eseguito
4. ✅ Test aggiunti per nuove feature
5. ✅ CI verde su branch locale

**Template PR checklist:**

- [ ] Description chiara del problema/soluzione
- [ ] Security gate checklist completato
- [ ] Test aggiunti/aggiornati
- [ ] Documentazione aggiornata
- [ ] Breaking changes documentati

---

## 📦 Dependency Management

### **Aggiunta Dipendenze**

```bash
# Production dependency
npm install --save <package>

# Dev dependency
npm install --save-dev <package>
```

**Regole:**

- NO dipendenze non necessarie
- Controllare licenze (preferire MIT, Apache 2.0)
- Verificare security vulnerabilities: `npm audit`
- Dependabot gestisce aggiornamenti automatici

### **Version Pinning**

- Production: versioni esatte (`"1.2.3"`)
- Dev: caret ranges ok (`"^1.2.3"`)

---

## 🏗️ Architecture Patterns

### **1. Strangler Pattern**

- Legacy code preserved as fallback
- Gradual migration vs big rewrite
- Esempio: Claude legacy handler per non-pricing requests

### **2. Adapter Pattern**

- Courier integrations (Spedisci Online, Poste, GLS)
- Implementare `BaseCourierAdapter` interface
- Fail gracefully con fallback

### **3. Atomic Operations**

- Wallet operations SOLO via SQL functions
- Idempotency keys per tutte le operazioni critiche
- Transaction ledger immutabile

---

## 🚀 CI/CD Standards

### **Continuous Integration**

Ogni PR triggera:

1. Linting (`npm run lint`)
2. Type checking (`npm run type-check`)
3. Unit tests (`npm run test:unit`)
4. Integration tests (`npm run test:integration`)
5. Build (`npm run build`)

### **Deployment**

- **Staging**: Auto-deploy da `master`
- **Production**: Manual approval required
- Rollback plan documentato

---

## 📊 Code Review Guidelines

### **Cosa Verificare**

- [ ] TypeScript errors assenti
- [ ] Test coverage sufficiente
- [ ] Security best practices seguite
- [ ] Performance non degradata
- [ ] Logging appropriato (NO PII)
- [ ] Error handling robusto
- [ ] Backward compatibility (se necessario)

### **Review SLA**

- P0 (critical): 2 ore
- P1 (high): 1 giorno lavorativo
- P2 (normal): 2 giorni lavorativi

---

## ⚠️ Anti-Patterns

### **DA EVITARE:**

❌ **Wallet operations senza atomic functions**

```typescript
// ❌ BAD
const currentBalance = user.wallet_balance;
const newBalance = currentBalance - amount;
await supabase.from('users').update({ wallet_balance: newBalance });
```

❌ **Silent errors**

```typescript
// ❌ BAD
try {
  await riskyOperation();
} catch (e) {
  // silence
}
```

❌ **PII in logs**

```typescript
// ❌ BAD
console.log('User email:', user.email);

// ✅ GOOD
console.log('Operation completed', { trace_id, user_id_hash });
```

❌ **Type assertions senza validazione**

```typescript
// ❌ BAD
const data = response as UserData;

// ✅ GOOD
const parsed = UserDataSchema.safeParse(response);
if (!parsed.success) throw new Error('Invalid data');
const data = parsed.data;
```

---

## 📚 Required Reading

1. [README.md](./README.md) - Architettura e business model
2. [SECURITY_CONTEXT.md](./SECURITY_CONTEXT.md) - Security gates
3. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - Technical deep dive
4. [docs/OPS_RUNBOOK.md](./docs/OPS_RUNBOOK.md) - Operations guide

---

## ✅ Pre-Commit Checklist

Prima di ogni commit:

- [ ] `npm run format` eseguito
- [ ] `npm run lint` passa
- [ ] `npm run type-check` passa
- [ ] Test relativi eseguiti e passano
- [ ] Commit message segue Conventional Commits
- [ ] NO secrets o PII nel codice

---

**Queste linee guida sono OBBLIGATORIE. Violazioni ripetute richiedono code review più stretta.**

**Domande?** Chiedi al team o consulta la documentazione in `/docs/`.
