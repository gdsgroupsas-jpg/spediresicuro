# ✅ Security Assertions - Expected Behavior

**Versione:** 1.0  
**Data:** 2025-01-XX  
**Scopo:** Definire comportamento atteso del sistema per validazione security

---

## 🔐 Runtime Assertions

### CRON Endpoints (`/api/cron/**`)

#### Assertion 1: Senza Authorization Header
**Expected:** `401 Unauthorized`

**Test:**
```bash
curl -i https://spediresicuro.vercel.app/api/cron/automation-sync
```

**Expected Response:**
```
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"success":false,"error":"Unauthorized"}
```

**Verifica:** ✅ Middleware blocca prima di raggiungere endpoint

---

#### Assertion 2: Authorization Header Sbagliato
**Expected:** `401 Unauthorized`

**Test:**
```bash
curl -i -H "Authorization: Bearer wrong-token-12345" \
  https://spediresicuro.vercel.app/api/cron/automation-sync
```

**Expected Response:**
```
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"success":false,"error":"Unauthorized"}
```

**Verifica:** ✅ Constant-time comparison previene timing attack

---

#### Assertion 3: Authorization Header Corretto
**Expected:** `200 OK` (se endpoint esiste e funziona)

**Test:**
```bash
curl -i -H "Authorization: Bearer $CRON_SECRET_TOKEN" \
  https://spediresicuro.vercel.app/api/cron/automation-sync
```

**Expected Response:**
```
HTTP/1.1 200 OK
Content-Type: application/json

{"success":true,"message":"Sync automatico completata",...}
```

**Verifica:** ✅ Secret valido, richiesta procede all'endpoint

---

#### Assertion 4: Case-Insensitive Matching
**Expected:** Tutte le varianti case richiedono secret

**Test:**
```bash
# /api/cron/x → 401
# /api/Cron/x → 401
# /API/CRON/x → 401
```

**Verifica:** ✅ Matcher case-insensitive funziona

---

### Path Traversal Protection

#### Assertion 5: Path Traversal Bloccato
**Expected:** `400 Bad Request`

**Test:**
```bash
curl -i https://spediresicuro.vercel.app/api/../dashboard
curl -i https://spediresicuro.vercel.app/api//spedizioni
curl -i "https://spediresicuro.vercel.app/api/%2E%2E/dashboard"
```

**Expected Response:**
```
HTTP/1.1 400 Bad Request

Bad Request: Invalid path
```

**Verifica:** ✅ Middleware blocca pattern sospetti

---

## 🚫 No Test Endpoints in Production

### Endpoint da Verificare

**⚠️ NO-GO se presenti in produzione:**

- `/api/test/**` - Endpoint di test
- `/api/debug/**` - Endpoint di debug
- `/api/admin/**` senza autenticazione - Admin access non protetto
- Qualsiasi endpoint che espone dati sensibili senza auth

**Verifica:**
```bash
# Lista endpoint API
find app/api -name "route.ts" -type f | grep -E "(test|debug)"
```

**Action:** Se trovati, segnalare come NO-GO e rimuovere o proteggere.

---

## 🗄️ Supabase Safety

### Assertion 6: RLS Enabled su Tabelle Tenant
**Expected:** Tutte le tabelle con dati tenant hanno RLS abilitato

**Tabelle Critiche:**
- `shipments` - ✅ RLS required
- `user_profiles` - ✅ RLS required
- `courier_configs` - ✅ RLS required (se multi-tenant)
- `wallet_transactions` - ✅ RLS required

**Verifica SQL:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('shipments', 'user_profiles', 'courier_configs', 'wallet_transactions');
```

**Expected:** `rowsecurity = true` per tutte

---

### Assertion 7: Service Role Solo Server-Side
**Expected:** `supabaseAdmin` non usato in componenti client

**Verifica:**
```bash
# Cerca uso supabaseAdmin in componenti client
grep -r "supabaseAdmin" app --include="*.tsx" --include="*.ts" | grep -v "use server"
```

**Expected:** Nessun risultato (o solo in Server Components/Server Actions)

---

### Assertion 8: No Orphan Shipments
**Expected:** Nessuna shipment con `user_id IS NULL AND created_by_user_email IS NULL`

**Verifica SQL:**
```sql
SELECT COUNT(*) FROM shipments
WHERE user_id IS NULL AND created_by_user_email IS NULL;
```

**Expected:** `0`

---

## 📋 Verification Checklist

### Pre-Deploy
- [ ] Assertion 1-3: CRON endpoints protetti
- [ ] Assertion 4: Case-insensitive matching funziona
- [ ] Assertion 5: Path traversal bloccato
- [ ] No test endpoints in produzione
- [ ] Assertion 6: RLS enabled su tabelle tenant
- [ ] Assertion 7: Service role solo server-side
- [ ] Assertion 8: No orphan shipments

### Post-Deploy
- [ ] Eseguire test curl su produzione
- [ ] Verificare log per tentativi accesso non autorizzati
- [ ] Monitorare 24h per anomalie

---

## 📝 Verification Record

**Data Verifica:** _______________  
**Verificato da:** _______________  
**Commit Analizzato:** _______________  
**Ambiente:** Production / Preview / Local

**Risultati:**
- [ ] Assertion 1: ✅ / ❌
- [ ] Assertion 2: ✅ / ❌
- [ ] Assertion 3: ✅ / ❌
- [ ] Assertion 4: ✅ / ❌
- [ ] Assertion 5: ✅ / ❌
- [ ] No test endpoints: ✅ / ❌
- [ ] Assertion 6: ✅ / ❌
- [ ] Assertion 7: ✅ / ❌
- [ ] Assertion 8: ✅ / ❌

**Note:** _______________

---

**Status:** ✅ Assertions definite
