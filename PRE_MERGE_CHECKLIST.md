# ✅ Pre-Merge Checklist - Middleware Security

**Branch:** `master` (o branch feature)  
**Status:** 🟢 **PRONTO PER MERGE**  
**Security Gate:** ✅ GO (riserva tecnica minore accettata)

---

## 🔍 Verifica Finale Codice

### File Modificati
- [x] `middleware.ts` - Security hardening implementato
- [x] Commento doppio matcher documentato
- [x] Funzioni: `timingSafeEqual()`, `hasPathTraversal()`, `validateCronSecret()`

### Verifica Implementazione
```typescript
// middleware.ts:77-97
function validateCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET_TOKEN || process.env.CRON_SECRET;
  if (!cronSecret) return false;  // ✅ Fail-closed
  // ...
}
```

**Conferma:**
- ✅ Fail-closed: deny se secret manca
- ✅ Constant-time comparison implementato
- ✅ Path traversal validation attiva
- ✅ Case-insensitive matching funzionante

---

## 🌐 Verifica Environment Variables (Vercel)

### Preview Environment
- [ ] Aprire Vercel Dashboard → Project → Settings → Environment Variables
- [ ] Verificare presenza di `CRON_SECRET_TOKEN` (o `CRON_SECRET`)
- [ ] Verificare che il valore sia corretto (non placeholder)
- [ ] Verificare che sia diverso da `AUTOMATION_SERVICE_TOKEN`

### Production Environment
- [ ] Aprire Vercel Dashboard → Project → Settings → Environment Variables
- [ ] Verificare presenza di `CRON_SECRET_TOKEN` (o `CRON_SECRET`) in **Production**
- [ ] Verificare che il valore sia corretto (non placeholder)
- [ ] Verificare che sia diverso da `AUTOMATION_SERVICE_TOKEN`

**Comando rapido verifica (se Vercel CLI disponibile):**
```bash
# Lista env vars (non mostra valori per sicurezza)
vercel env ls
```

---

## 🧪 Test Post-Deploy (DOPO MERGE)

### ⚠️ IMPORTANTE: Eseguire DOPO deploy Production

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
curl -i -H "Authorization: Bearer wrong-token-12345" https://spediresicuro.vercel.app/api/cron/automation-sync
```

**Expected:**
```
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"success":false,"error":"Unauthorized"}
```

**Verifica:** Constant-time comparison previene timing attack.

---

### Test 3: CRON con header corretto → 200 (atteso) ✅

```bash
# Sostituire $CRON_SECRET_TOKEN con il valore reale
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

## 📊 Monitoraggio Log 24h (Post-Deploy)

### Log da Monitorare

#### 1. Tentativi Accesso Non Autorizzati (401)
- [ ] Filtrare log per `401` su route `/api/cron/**`
- [ ] Verificare pattern: `[Middleware] Unauthorized cron request`
- [ ] Contare tentativi (se > 10/h, possibile attacco)

**Query Vercel Logs:**
```
status:401 AND path:/api/cron/*
```

#### 2. Path Traversal Attempts (400)
- [ ] Filtrare log per `400` con pattern sospetti
- [ ] Verificare pattern: `[Middleware] Path traversal detected`
- [ ] Contare tentativi (se > 5/h, possibile attacco)

**Query Vercel Logs:**
```
status:400 AND message:"Path traversal"
```

#### 3. Errori Middleware
- [ ] Filtrare log per errori middleware
- [ ] Verificare che non ci siano errori runtime
- [ ] Se errori presenti, investigare immediatamente

**Query Vercel Logs:**
```
level:error AND source:middleware
```

---

## 📝 Checklist Pre-Merge

### Code Review
- [x] Security Gate: GO ✅
- [x] P0/P1: Chiusi ✅
- [x] Commento doppio matcher aggiunto ✅
- [x] Test documentati ✅

### Environment
- [ ] `CRON_SECRET_TOKEN` presente in Vercel Preview
- [ ] `CRON_SECRET_TOKEN` presente in Vercel Production
- [ ] Valore corretto (non placeholder)
- [ ] Diverso da `AUTOMATION_SERVICE_TOKEN`

### Pre-Deploy
- [ ] Branch pulito (no file temporanei)
- [ ] Commit message descrittivo
- [ ] Documentazione aggiornata

### Post-Deploy (DOPO MERGE)
- [ ] Test 1: CRON senza header → 401
- [ ] Test 2: CRON con header sbagliato → 401
- [ ] Test 3: CRON con header corretto → 200
- [ ] Monitoraggio log attivo per 24h

---

## 🎯 Task Backlog (Opzionale)

### Hardening Matcher (Non Bloccante)
- [ ] Valutare regex case-insensitive nel matcher
- [ ] Considerare normalizzazione pathname nel matcher
- [ ] Rimuovere dipendenza implicita tra matcher (se possibile)

**Priorità:** Bassa  
**Effort:** 1-2 ore  
**Bloccante:** ❌ No  
**Nota:** Riserva tecnica minore documentata e accettata

---

## ✅ Sign-Off Pre-Merge

**Code Status:** ✅ Pronto  
**Security Gate:** ✅ GO  
**Environment:** ⚠️ **DA VERIFICARE** (Vercel Dashboard)  
**Tests:** ⚠️ **DA ESEGUIRE** (Post-Deploy)

**Merge Autorizzato:** ✅ SÌ  
**Deploy Bloccato:** ❌ NO

---

## 🚀 Procedura Merge

1. **Verificare Environment Variables in Vercel** (Preview + Production)
2. **Eseguire Merge** su `master`
3. **Monitorare Deploy** in Vercel Dashboard
4. **Eseguire Test 1-3** su Production URL
5. **Monitorare Log** per 24h

---

**💡 RACCOMANDAZIONE FINALE**

👉 **Procedere al merge e deploy seguendo questa checklist.**

👉 **Annotare nel backlog l'hardening matcher (non bloccante).**

**Status:** 🟢 **PRONTO PER MERGE**







