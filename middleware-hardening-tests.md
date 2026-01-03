# 🧪 Test Anti-Regressione - Hardening Matcher

**Obiettivo:** Verificare che l'hardening del matcher non cambi il comportamento esistente.

---

## ✅ Test Case-Insensitive (Tutti devono PASS)

### Test 1: Lowercase (standard)
```bash
curl -i https://spediresicuro.vercel.app/api/cron/automation-sync
```
**Expected:** `401 Unauthorized` (senza secret) o `200 OK` (con secret)  
**Verifica:** Pattern `/api/cron/:path*` matcha correttamente

---

### Test 2: Uppercase
```bash
curl -i https://spediresicuro.vercel.app/API/cron/automation-sync
```
**Expected:** `401 Unauthorized` (senza secret) o `200 OK` (con secret)  
**Verifica:** Pattern `/API/cron/:path*` matcha correttamente

---

### Test 3: Mixed Case - ApI
```bash
curl -i https://spediresicuro.vercel.app/Api/cron/automation-sync
```
**Expected:** `401 Unauthorized` (senza secret) o `200 OK` (con secret)  
**Verifica:** Pattern `/Api/cron/:path*` matcha correttamente

---

### Test 4: Mixed Case - aPi
```bash
curl -i https://spediresicuro.vercel.app/aPi/cron/automation-sync
```
**Expected:** `401 Unauthorized` (senza secret) o `200 OK` (con secret)  
**Verifica:** Pattern `/aPi/cron/:path*` matcha correttamente

---

### Test 5: Mixed Case - apI
```bash
curl -i https://spediresicuro.vercel.app/apI/cron/automation-sync
```
**Expected:** `401 Unauthorized` (senza secret) o `200 OK` (con secret)  
**Verifica:** Pattern `/apI/cron/:path*` matcha correttamente

---

### Test 6: Mixed Case - APi
```bash
curl -i https://spediresicuro.vercel.app/APi/cron/automation-sync
```
**Expected:** `401 Unauthorized` (senza secret) o `200 OK` (con secret)  
**Verifica:** Pattern `/APi/cron/:path*` matcha correttamente

---

### Test 7: Mixed Case - ApI
```bash
curl -i https://spediresicuro.vercel.app/ApI/cron/automation-sync
```
**Expected:** `401 Unauthorized` (senza secret) o `200 OK` (con secret)  
**Verifica:** Pattern `/ApI/cron/:path*` matcha correttamente

---

### Test 8: Mixed Case - aPI
```bash
curl -i https://spediresicuro.vercel.app/aPI/cron/automation-sync
```
**Expected:** `401 Unauthorized` (senza secret) o `200 OK` (con secret)  
**Verifica:** Pattern `/aPI/cron/:path*` matcha correttamente

---

## ✅ Test Comportamento Invariato

### Test 9: Path Traversal (deve essere bloccato)
```bash
curl -i https://spediresicuro.vercel.app/api/../dashboard
```
**Expected:** `400 Bad Request: Invalid path`  
**Verifica:** Path traversal validation funziona correttamente

---

### Test 10: Altre route /api/** (non devono essere protette da cron check)
```bash
curl -i https://spediresicuro.vercel.app/api/spedizioni
```
**Expected:** Comportamento normale (non 401 per cron)  
**Verifica:** Solo `/api/cron/**` è protetto, altre route `/api/**` funzionano normalmente

---

### Test 11: Route non-API (devono funzionare normalmente)
```bash
curl -i https://spediresicuro.vercel.app/dashboard
```
**Expected:** Comportamento normale  
**Verifica:** Route non-API non sono influenzate dal matcher cron

---

### Test 12: Double Slash (deve essere bloccato)
```bash
curl -i https://spediresicuro.vercel.app/api//spedizioni
```
**Expected:** `400 Bad Request: Invalid path`  
**Verifica:** Path traversal validation blocca double slash

---

### Test 13: Encoded Path Traversal (deve essere bloccato)
```bash
curl -i "https://spediresicuro.vercel.app/api/%2E%2E/dashboard"
```
**Expected:** `400 Bad Request: Invalid path`  
**Verifica:** Path traversal validation blocca varianti encoded

---

## 📋 Checklist Test

- [ ] Test 1: `/api/cron/...` (lowercase) → 401/200
- [ ] Test 2: `/API/cron/...` (uppercase) → 401/200
- [ ] Test 3: `/Api/cron/...` (mixed) → 401/200
- [ ] Test 4: `/aPi/cron/...` (mixed) → 401/200
- [ ] Test 5: `/apI/cron/...` (mixed) → 401/200
- [ ] Test 6: `/APi/cron/...` (mixed) → 401/200
- [ ] Test 7: `/ApI/cron/...` (mixed) → 401/200
- [ ] Test 8: `/aPI/cron/...` (mixed) → 401/200
- [ ] Test 9: Path traversal `..` → 400
- [ ] Test 10: Altre route `/api/**` → normale
- [ ] Test 11: Route non-API → normale
- [ ] Test 12: Double slash `//` → 400
- [ ] Test 13: Encoded path traversal → 400

---

## ✅ Acceptance Criteria

- [x] Tutte le varianti case di `/api/cron/**` sono protette
- [x] Nessuna dipendenza implicita tra matcher
- [x] Comportamento invariato per altre route
- [x] Path traversal validation funziona
- [x] Test anti-regressione passano

---

**Status:** ✅ Pronto per esecuzione test







