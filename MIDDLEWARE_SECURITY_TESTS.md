# 🔒 Middleware Security Tests - Verification Guide

**File:** `middleware.ts`  
**Data:** 2025-01-XX  
**Status:** Implementato - Pronto per test

---

## ✅ Implementazioni Completate

### G1 - `/api/cron` non pubblico
- ✅ Matcher include `/api/cron/:path*`
- ✅ Validazione CRON_SECRET nel middleware (fail-closed)
- ✅ Route `/api/cron/**` protette prima di raggiungere endpoint

### G2 - CRON_SECRET validation INLINE
- ✅ Validazione nel middleware con `timingSafeEqual()` (constant-time)
- ✅ Fail-closed: deny se `CRON_SECRET_TOKEN` o `CRON_SECRET` manca
- ✅ Fail-closed: deny se header `Authorization` manca
- ✅ Confronto constant-time per prevenire timing attack

### G3 - Path traversal validation
- ✅ Validazione pattern `..`, `//`, `%2E%2E`, `%2F%2F` (case-insensitive)
- ✅ Decodifica URL per controllare varianti encoded
- ✅ Return `400 Bad Request` se pattern sospetti

### G4 - Case-insensitive matching
- ✅ `pathname.toLowerCase()` prima di `startsWith('/api/cron/')`
- ✅ Pattern matching case-insensitive

---

## 🧪 Manual Smoke Tests (curl)

### Prerequisiti

```bash
# Imposta CRON_SECRET_TOKEN per i test
export CRON_SECRET_TOKEN="test-secret-token-12345"
# Oppure in PowerShell:
$env:CRON_SECRET_TOKEN="test-secret-token-12345"
```

---

### Test 1: CRON senza header → 401 (atteso) ✅

```bash
curl -i https://spediresicuro.vercel.app/api/cron/automation-sync
```

**Expected:**
```
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"success":false,"error":"Unauthorized"}
```

**Verifica:** Middleware blocca richiesta prima di raggiungere endpoint.

---

### Test 2: CRON con header sbagliato → 401 (atteso) ✅

```bash
curl -i -H "Authorization: Bearer wrong-token" https://spediresicuro.vercel.app/api/cron/automation-sync
```

**Expected:**
```
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"success":false,"error":"Unauthorized"}
```

**Verifica:** Constant-time comparison previene timing attack.

---

### Test 3: CRON con header corretto → 200 (se endpoint esiste) ✅

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET_TOKEN" https://spediresicuro.vercel.app/api/cron/automation-sync
```

**Expected:**
```
HTTP/1.1 200 OK
Content-Type: application/json

{"success":true,"message":"Sync automatico completata",...}
```

**Verifica:** Secret valido, richiesta procede all'endpoint.

---

### Test 4: Path traversal `/api/../dashboard` → 400 (atteso) ✅

```bash
curl -i https://spediresicuro.vercel.app/api/../dashboard
```

**Expected:**
```
HTTP/1.1 400 Bad Request

Bad Request: Invalid path
```

**Verifica:** Path traversal bloccato nel middleware.

---

### Test 5: Double slash `/api//spedizioni` → 400 (atteso) ✅

```bash
curl -i https://spediresicuro.vercel.app/api//spedizioni
```

**Expected:**
```
HTTP/1.1 400 Bad Request

Bad Request: Invalid path
```

**Verifica:** Double slash bloccato.

---

### Test 6: Encoded path traversal `/api/%2E%2E/dashboard` → 400 (atteso) ✅

```bash
curl -i "https://spediresicuro.vercel.app/api/%2E%2E/dashboard"
```

**Expected:**
```
HTTP/1.1 400 Bad Request

Bad Request: Invalid path
```

**Verifica:** Varianti encoded bloccate.

---

### Test 7: Case bypass `/API/cron/automation-sync` → 401 (atteso) ✅

```bash
curl -i https://spediresicuro.vercel.app/API/cron/automation-sync
```

**Expected:**
```
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"success":false,"error":"Unauthorized"}
```

**Verifica:** Case-insensitive matching funziona, ma richiede ancora CRON_SECRET.

---

### Test 8: Case bypass con secret corretto → 200 (atteso) ✅

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET_TOKEN" https://spediresicuro.vercel.app/API/cron/automation-sync
```

**Expected:**
```
HTTP/1.1 200 OK
Content-Type: application/json

{"success":true,"message":"Sync automatico completata",...}
```

**Verifica:** Case-insensitive matching + secret valido = accesso consentito.

---

## 📋 Checklist Verifica

- [ ] Test 1: CRON senza header → 401 ✅
- [ ] Test 2: CRON con header sbagliato → 401 ✅
- [ ] Test 3: CRON con header corretto → 200 ✅
- [ ] Test 4: Path traversal `..` → 400 ✅
- [ ] Test 5: Double slash `//` → 400 ✅
- [ ] Test 6: Encoded path traversal → 400 ✅
- [ ] Test 7: Case bypass senza secret → 401 ✅
- [ ] Test 8: Case bypass con secret → 200 ✅

---

## 🔍 Verifica Implementazione

### File: `middleware.ts`

**Funzioni implementate:**
1. `timingSafeEqual(a: string, b: string): boolean` - Constant-time comparison (Edge-safe)
2. `hasPathTraversal(pathname: string): boolean` - Path traversal detection
3. `validateCronSecret(request: NextRequest): boolean` - CRON_SECRET validation (fail-closed)

**Matcher:**
```typescript
matcher: [
  '/api/cron/:path*',  // Solo /api/cron/** (non tutte le /api/**)
  '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
]
```

**Flow:**
1. Path traversal check (G3) → 400 se pattern sospetti
2. `/api/cron/**` check (G1, G2) → 401 se secret manca/non matcha
3. Altre route → pass-through

---

## ✅ Acceptance Criteria

- [x] G1: `/api/cron` non pubblico (matcher + validazione middleware)
- [x] G2: CRON_SECRET validation INLINE con constant-time
- [x] G3: Path traversal validation (.., //, encoded)
- [x] G4: Case-insensitive matching
- [x] Fail-closed: deny se secret manca
- [x] Edge-safe: usa solo API disponibili in Edge Runtime

---

## 🚀 Deploy Checklist

- [ ] Verificare che `CRON_SECRET_TOKEN` o `CRON_SECRET` sia configurato in Vercel
- [ ] Eseguire tutti i test curl su preview/staging
- [ ] Verificare che endpoint cron funzionino con secret corretto
- [ ] Monitorare log per tentativi di accesso non autorizzati
- [ ] Documentare `CRON_SECRET_TOKEN` per team

---

**Status:** ✅ Pronto per deploy dopo verifica test curl







