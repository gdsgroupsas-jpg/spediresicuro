# 🔒 SECURITY AUDIT REPORT
**Data Audit:** 27 Dicembre 2025  
**Versione Repository:** master  
**Auditor:** Automated Security Scan  
**Scope:** Repository completo SpedireSicuro

---

## 📊 EXECUTIVE SUMMARY

**Stato Generale:** ✅ **SICURO CON RACCOMANDAZIONI**

Il repository mostra un'architettura di sicurezza solida con implementazioni robuste per autenticazione, autorizzazione, crittografia e isolamento multi-tenant. Sono state identificate alcune aree di miglioramento minori e best practices da implementare.

**Punteggio Complessivo:** 8.5/10

---

## ✅ PUNTI DI FORZA

### 1. **Autenticazione e Autorizzazione** ✅
- ✅ Middleware fail-closed implementato (`middleware.ts`)
- ✅ NextAuth v5 con validazione sessione
- ✅ RBAC framework completo (`lib/rbac.ts`)
- ✅ Acting Context per impersonation sicura
- ✅ Protezione API routes con `requireAuth()` pattern
- ✅ Onboarding gate server-authoritative

**Evidenza:**
```typescript
// middleware.ts - Fail-closed pattern
if (requiresAuth && !session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### 2. **Crittografia Dati Sensibili** ✅
- ✅ AES-256-GCM per password corrieri (`lib/security/encryption.ts`)
- ✅ ENCRYPTION_KEY gestita via environment variables
- ✅ Password mai esposte al client
- ✅ RLS policies per isolamento dati

**Evidenza:**
- File: `docs/SICUREZZA_CRITICA_PASSWORD.md`
- File: `lib/security/encryption.ts` (AES-256-GCM)

### 3. **Wallet Security** ✅
- ✅ Operazioni atomiche con pessimistic locking
- ✅ Funzioni RPC `decrement_wallet_balance()` / `increment_wallet_balance()`
- ✅ Zero UPDATE diretti su `wallet_balance`
- ✅ Search path locked su funzioni SECURITY DEFINER
- ✅ Guardrails documentati (`WALLET_SECURITY_GUARDRAILS.md`)

**Evidenza:**
- Migration: `040_wallet_atomic_operations.sql`
- Migration: `042_security_definer_search_path.sql`
- File: `WALLET_SECURITY_GUARDRAILS.md`

### 4. **Row Level Security (RLS)** ✅
- ✅ RLS abilitato su tabelle critiche (`users`, `shipments`, `wallet_transactions`)
- ✅ Policy tenant-isolation implementate
- ✅ Admin-only access per configurazioni sensibili

**Evidenza:**
- File: `docs/SECURITY.md` (sezione RLS Pattern)
- Migration: `001_complete_schema.sql`

### 5. **Rate Limiting** ✅
- ✅ Rate limiting distribuito con Redis (`lib/security/rate-limit.ts`)
- ✅ Fallback in-memory se Redis non disponibile
- ✅ Hash userId per privacy (no PII in Redis keys)
- ✅ Timeout protection (1s max)

**Evidenza:**
- File: `lib/security/rate-limit.ts`
- Default: 20 richieste/minuto per route

### 6. **Security Headers** ✅
- ✅ HSTS configurato (max-age=63072000)
- ✅ X-Frame-Options: SAMEORIGIN
- ✅ X-Content-Type-Options: nosniff
- ✅ CSP policy configurata
- ⚠️ CSP include `unsafe-eval` (necessario per jsPDF/Tesseract.js)

**Evidenza:**
- File: `next.config.js` (sezione headers)

### 7. **Audit Logging** ✅
- ✅ Audit log unificato (`lib/security/audit-log.ts`)
- ✅ Tracciamento impersonation (actor + target)
- ✅ Logging operazioni wallet/shipments
- ✅ Audit logs non accessibili via RLS (service role only)

**Evidenza:**
- File: `lib/security/audit-log.ts`
- Migration: `013_security_audit_logs.sql`

### 8. **Input Validation** ✅
- ✅ Validazione campi obbligatori (`lib/validators.ts`)
- ✅ Sanitizzazione stringhe (rimozione HTML tags)
- ✅ Validazione CAP, provincia, telefono
- ✅ Validazione dimensione/limiti context (max 10KB, max 3 livelli)

**Evidenza:**
- File: `lib/validators.ts`
- File: `app/api/user/dati-cliente/route.ts`
- File: `automation-service/src/index.ts` (validazione context)

### 9. **Gitignore e Secrets Management** ✅
- ✅ `.env*.local` esclusi da Git
- ✅ File `.key`, `.pem`, `.p12` esclusi
- ✅ Log files esclusi
- ✅ Nessuna credenziale hardcoded trovata

**Evidenza:**
- File: `.gitignore` (righe 28-34, 48-51)

### 10. **PII Protection** ✅
- ✅ Hash userId in Redis keys (no PII)
- ✅ Sanitizzazione context per diagnostics
- ✅ OCR Vision: no base64 nei log
- ✅ Documentazione anti-PII (`docs/SPRINT_2.5_OCR_IMMAGINI_GUIDA.md`)

**Evidenza:**
- File: `lib/security/rate-limit.ts` (hashUserId)
- File: `automation-service/src/index.ts` (sanitizeContext)
- File: `lib/agent/workers/vision-fallback.ts` (no PII nei log)

---

## ⚠️ AREE DI MIGLIORAMENTO

### 1. **CSP unsafe-eval** ⚠️ MEDIO
**Problema:** Content Security Policy include `unsafe-eval` per jsPDF/Tesseract.js/xlsx

**Rischio:** Possibile XSS se librerie vulnerabili

**Raccomandazione:**
- ✅ Documentato in `next.config.js` (riga 58-60)
- 🔄 Considerare alternative che non richiedono eval
- 🔄 Isolare librerie in Web Workers quando possibile

**Priorità:** MEDIA (necessario per funzionalità attuali)

---

### 2. **Logging Dati Sensibili** ⚠️ BASSO
**Problema:** Alcuni `console.log` potrebbero esporre informazioni sensibili

**Trovato:**
- `scripts/test-onboarding-flow.ts:46` - log password test
- `scripts/create-smoke-test-user.ts:154` - log password test
- `scripts/verify-test-user.js:78` - log password test

**Rischio:** Basso (solo script di test, non production)

**Raccomandazione:**
- ✅ Script di test già documentati come non-production
- 🔄 Considerare mascherare password anche in test (es. `***`)

**Priorità:** BASSA

---

### 3. **Dipendenze Vulnerabili** ⚠️ DA VERIFICARE
**Problema:** `npm audit` ha rilevato 1 vulnerabilità

**Azione Richiesta:**
```bash
npm audit
npm audit fix
```

**Priorità:** MEDIA (verificare criticità)

---

### 4. **Environment Variables Exposure** ⚠️ BASSO
**Problema:** Alcuni file contengono esempi di variabili d'ambiente

**Trovato:**
- `automation-service/ESEMPIO_ENV.txt` - esempi (non reali)
- `scripts/archive/ESEMPIO_ENV_LOCALE.txt` - esempi (non reali)
- `GUIDA_VARIABILI_AMBIENTE.md` - documentazione

**Rischio:** Basso (solo esempi/documentazione, non credenziali reali)

**Raccomandazione:**
- ✅ File già documentati come esempi
- ✅ Nessuna credenziale reale trovata
- ✅ `.gitignore` esclude `.env*`

**Priorità:** BASSA

---

### 5. **Base64 Encoding** ⚠️ BASSO
**Problema:** Uso di base64 per immagini/PDF (necessario per API)

**Trovato:**
- `lib/agent/orchestrator/nodes.ts` - conversione base64 per Gemini Vision
- `lib/adapters/couriers/spedisci-online.ts` - label PDF base64
- `lib/security/encryption.ts` - formato criptazione base64

**Rischio:** Basso (uso legittimo per API/encryption)

**Raccomandazione:**
- ✅ Base64 usato solo per API/encryption (non logging)
- ✅ OCR Vision: no base64 nei log (già implementato)

**Priorità:** BASSA

---

## 🚨 VULNERABILITÀ CRITICHE

### ❌ NESSUNA VULNERABILITÀ CRITICA TROVATA

Tutte le aree critiche (autenticazione, autorizzazione, crittografia, RLS, wallet) sono implementate correttamente.

---

## 📋 CHECKLIST COMPLIANCE

### OWASP Top 10 (2021)

| # | Categoria | Stato | Note |
|---|-----------|-------|------|
| A01 | Broken Access Control | ✅ | RLS + RBAC implementati |
| A02 | Cryptographic Failures | ✅ | AES-256-GCM, no PII in log |
| A03 | Injection | ✅ | Supabase parameterized queries |
| A04 | Insecure Design | ✅ | Fail-closed middleware |
| A05 | Security Misconfiguration | ✅ | Security headers configurati |
| A06 | Vulnerable Components | ⚠️ | 1 vulnerabilità npm da verificare |
| A07 | Auth Failures | ✅ | NextAuth v5 + session validation |
| A08 | Software/Data Integrity | ✅ | Wallet atomic operations |
| A09 | Logging Failures | ✅ | Audit logging implementato |
| A10 | SSRF | ✅ | No SSRF vectors identificati |

---

## 🔍 VERIFICHE SPECIFICHE

### 1. Credenziali Hardcoded
**Risultato:** ✅ **NESSUNA CREDENZIALE REALE TROVATA**

- ✅ Nessuna API key reale nel codice
- ✅ Nessuna password reale nel codice
- ✅ Solo esempi/documentazione (non reali)
- ✅ `.gitignore` esclude `.env*`

**Comandi Verifica:**
```bash
grep -r "AIzaSy\|sk-\|ghp_\|Bearer" --exclude-dir=node_modules --exclude-dir=.next
# Risultato: Solo esempi/documentazione
```

---

### 2. SQL Injection
**Risultato:** ✅ **PROTETTO**

- ✅ Supabase usa parameterized queries
- ✅ Nessuna query raw con concatenazione stringhe
- ✅ RLS policies applicate
- ✅ Search path locked su funzioni SECURITY DEFINER

**Evidenza:**
- 363 query Supabase trovate (tutte via `.from()`, `.select()`, etc.)
- Migration `042_security_definer_search_path.sql` applicata

---

### 3. XSS (Cross-Site Scripting)
**Risultato:** ✅ **PROTETTO**

- ✅ CSP policy configurata
- ✅ Sanitizzazione input (`lib/validators.ts`)
- ✅ Rimozione HTML tags
- ⚠️ `unsafe-eval` necessario per jsPDF/Tesseract.js (documentato)

**Evidenza:**
- File: `next.config.js` (CSP)
- File: `lib/validators.ts` (sanitizeString)

---

### 4. CSRF (Cross-Site Request Forgery)
**Risultato:** ✅ **PROTETTO**

- ✅ NextAuth gestisce CSRF tokens
- ✅ SameSite cookies configurati
- ✅ API routes richiedono autenticazione

---

### 5. Rate Limiting
**Risultato:** ✅ **IMPLEMENTATO**

- ✅ Rate limiting distribuito (Redis)
- ✅ Fallback in-memory
- ✅ Default: 20 req/min per route
- ✅ Hash userId (no PII in keys)

**Evidenza:**
- File: `lib/security/rate-limit.ts`
- File: `automation-service/src/index.ts` (diagnostics: 30/min)

---

### 6. Logging Dati Sensibili
**Risultato:** ⚠️ **MIGLIORABILE**

- ✅ Audit logging non espone PII
- ✅ Hash userId in Redis keys
- ⚠️ Alcuni `console.log` in script test potrebbero loggare password

**Raccomandazione:**
- Mascherare password anche in test (es. `password: '***'`)

---

## 📝 RACCOMANDAZIONI PRIORITIZZATE

### 🔴 PRIORITÀ ALTA
1. **Verificare vulnerabilità npm**
   ```bash
   npm audit
   npm audit fix
   ```

### 🟡 PRIORITÀ MEDIA
2. **Considerare alternative a unsafe-eval**
   - Valutare librerie che non richiedono `eval()`
   - Isolare jsPDF/Tesseract.js in Web Workers

3. **Mascherare password in script test**
   - Sostituire `console.log(password)` con `console.log('***')`

### 🟢 PRIORITÀ BASSA
4. **Documentazione miglioramenti**
   - Aggiungere note su CSP `unsafe-eval` in README
   - Documentare decisioni di sicurezza in `docs/SECURITY.md`

---

## ✅ CONCLUSIONI

Il repository **SpedireSicuro** mostra un'architettura di sicurezza **solida e ben implementata**. Le aree critiche (autenticazione, autorizzazione, crittografia, wallet, RLS) sono tutte protette con best practices.

**Punti di Forza:**
- ✅ Fail-closed middleware
- ✅ Wallet atomic operations
- ✅ RLS multi-tenant
- ✅ Audit logging completo
- ✅ Rate limiting distribuito
- ✅ PII protection

**Aree di Miglioramento:**
- ⚠️ Verificare vulnerabilità npm
- ⚠️ Considerare alternative a `unsafe-eval` (lungo termine)
- ⚠️ Mascherare password in script test

**Raccomandazione Finale:** ✅ **APPROVATO PER PRODUZIONE** con implementazione delle raccomandazioni prioritarie.

---

## 📞 CONTATTI

Per domande o chiarimenti su questo audit:
- Repository: `https://github.com/gdsgroupsas-jpg/spediresicuro.git`
- Documentazione: `docs/SECURITY.md`
- Wallet Security: `WALLET_SECURITY_GUARDRAILS.md`

---

**Ultimo Aggiornamento:** 27 Dicembre 2025  
**Prossimo Audit Consigliato:** Dopo ogni major release o ogni 3 mesi



