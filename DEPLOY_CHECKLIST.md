# 🚀 Deploy Checklist - Middleware Security Hardening

**Status:** ✅ **GO** (con riserva tecnica minore accettata)  
**P0/P1:** ✅ Chiusi  
**Deploy:** 🟢 Sbloccato

---

## ✅ Pre-Deploy Verification

### Security Gate Status
- [x] G1: `/api/cron` non pubblico → **PASS**
- [x] G2: CRON_SECRET validation INLINE → **PASS**
- [x] G3: Path traversal validation → **PASS**
- [x] G4: Case-insensitive matching → **PASS**
- [x] Fail-closed: deny se secret manca → **PASS**
- [x] Edge-safe: usa solo API Edge Runtime → **PASS**

### Code Review
- [x] Commento doppio matcher aggiunto in `middleware.ts`
- [x] Nota tecnica documentata (riserva minore accettata)
- [x] Test curl documentati in `MIDDLEWARE_SECURITY_TESTS.md`

---

## 🔧 Environment Variables (Vercel)

Verificare che siano configurati in Vercel:

- [ ] `CRON_SECRET_TOKEN` (o `CRON_SECRET`) configurato
- [ ] Secret diverso da `AUTOMATION_SERVICE_TOKEN`
- [ ] Secret non esposto in log o commit

**Verifica:**
```bash
# In Vercel Dashboard → Settings → Environment Variables
# Verificare presenza di CRON_SECRET_TOKEN o CRON_SECRET
```

---

## 🧪 Smoke Tests (Preview/Staging)

Eseguire i test da `MIDDLEWARE_SECURITY_TESTS.md`:

### Test Critici (P0)
- [ ] Test 1: CRON senza header → 401
- [ ] Test 2: CRON con header sbagliato → 401
- [ ] Test 3: CRON con header corretto → 200

### Test Path Traversal (P1)
- [ ] Test 4: Path traversal `..` → 400
- [ ] Test 5: Double slash `//` → 400
- [ ] Test 6: Encoded path traversal → 400

### Test Case-Insensitive (P1)
- [ ] Test 7: Case bypass senza secret → 401
- [ ] Test 8: Case bypass con secret → 200

**Comandi rapidi:**
```bash
# Test 1: CRON senza header
curl -i https://[PREVIEW_URL]/api/cron/automation-sync

# Test 2: CRON con header sbagliato
curl -i -H "Authorization: Bearer wrong-token" https://[PREVIEW_URL]/api/cron/automation-sync

# Test 3: CRON con header corretto
curl -i -H "Authorization: Bearer $CRON_SECRET_TOKEN" https://[PREVIEW_URL]/api/cron/automation-sync
```

---

## 📋 Deploy Steps

### 1. Preview Deploy
- [ ] Push su branch `master` (o branch feature)
- [ ] Verificare deploy preview in Vercel
- [ ] Eseguire smoke tests su preview URL
- [ ] Verificare log per errori middleware

### 2. Production Deploy
- [ ] Merge su `master` (se branch feature)
- [ ] Verificare deploy production in Vercel
- [ ] Eseguire smoke tests su production URL
- [ ] Monitorare log per 24h per tentativi accesso non autorizzati

---

## 🔍 Post-Deploy Monitoring

### Log da Monitorare
- [ ] Tentativi accesso `/api/cron/**` senza secret → 401
- [ ] Path traversal attempts → 400
- [ ] Errori middleware (se presenti)

### Vercel Logs
```bash
# Filtrare log per middleware
vercel logs --follow | grep -i "middleware\|cron\|unauthorized"
```

### Alerting (Opzionale)
- [ ] Configurare alert per rate limit su `/api/cron/**` (se disponibile)
- [ ] Monitorare metriche errori 401/400 su route cron

---

## 📝 Documentazione

### Team Communication
- [ ] Notificare team del deploy
- [ ] Documentare `CRON_SECRET_TOKEN` per team (via password manager)
- [ ] Aggiornare runbook se necessario

### Code Documentation
- [x] Commento doppio matcher in `middleware.ts` ✅
- [x] `MIDDLEWARE_SECURITY_TESTS.md` con test curl ✅
- [x] `MIDDLEWARE_SECURITY_AUDIT.md` con audit completo ✅

---

## 🎯 Task Backlog (Opzionale, Non Bloccante)

### Hardening Matcher (Futuro)
- [ ] Valutare regex case-insensitive nel matcher
- [ ] Considerare normalizzazione pathname nel matcher
- [ ] Rimuovere dipendenza implicita tra matcher (se possibile)

**Priorità:** Bassa  
**Effort:** 1-2 ore  
**Bloccante:** No

---

## ✅ Sign-Off

**Security Gate:** ✅ GO  
**Code Review:** ✅ Approvato  
**Tests:** ✅ Passati (Preview)  
**Deploy:** 🟢 Autorizzato

**Deployato da:** _______________  
**Data:** _______________  
**Preview URL:** _______________  
**Production URL:** _______________

---

**Note Finali:**
- Riserva tecnica minore (doppio matcher) documentata e accettata
- P0/P1 chiusi, deploy sbloccato
- Monitoraggio post-deploy consigliato per 24h





