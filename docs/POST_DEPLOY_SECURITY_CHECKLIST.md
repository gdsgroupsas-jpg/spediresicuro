# ✅ Checklist Post-Deploy: Security Hardening

## 🎯 Obiettivo

Verificare che le modifiche di sicurezza (AuthContext, assertValidUserId) funzionino correttamente in produzione.

---

## 1️⃣ Endpoint Authentication (401 senza session)

### Test: `/api/spedizioni` (GET)

```bash
# Senza autenticazione
curl -X GET https://[YOUR_DOMAIN]/api/spedizioni

# Atteso: 401 Unauthorized
# Response: { "error": "Non autenticato" }
```

**Verifica codice:**

- ✅ `app/api/spedizioni/route.ts:22-24` - Verifica `session?.user?.email`
- ✅ Ritorna `401` se non autenticato

**Log da cercare:**

```
❌ [SECURITY] Tentativo accesso getSpedizioni senza autenticazione
```

---

### Test: `/api/spedizioni` (POST)

```bash
# Senza autenticazione
curl -X POST https://[YOUR_DOMAIN]/api/spedizioni \
  -H "Content-Type: application/json" \
  -d '{"destinatarioNome": "Test"}'

# Atteso: 401 Unauthorized
```

**Verifica codice:**

- ✅ `app/api/spedizioni/route.ts:196-198` - Verifica `session?.user?.email`
- ✅ Ritorna `401` se non autenticato

---

### Test: `/api/corrieri/reliability` (GET)

```bash
# Senza autenticazione
curl -X GET "https://[YOUR_DOMAIN]/api/corrieri/reliability?citta=Roma&provincia=RM"

# Atteso: 401 Unauthorized
```

**Verifica codice:**

- ✅ `app/api/corrieri/reliability/route.ts:18-23` - Verifica `session?.user?.email`
- ✅ Ritorna `401` se non autenticato

---

## 2️⃣ Tenant Isolation (Query filtrata per user_id)

### Test: Con session utente A, non vedere shipments utente B

**Setup:**

1. Login come User A
2. Crea spedizione come User A
3. Login come User B
4. Chiama GET `/api/spedizioni`

**Atteso:**

- User B vede SOLO le proprie spedizioni
- Spedizione User A NON visibile a User B

**Verifica codice:**

- ✅ `lib/database.ts:932-941` - Filtra con `query.eq('user_id', authContext.userId)`
- ✅ `lib/database.ts:934-937` - Throw se `userId` mancante

**Log da cercare:**

```
✅ [SUPABASE] Filtro per user_id: [UUID]... (user: [email])
```

**Query Supabase da verificare:**

```sql
-- Come User B, questa query NON deve restituire shipments User A
SELECT id, user_id, tracking_number
FROM shipments
WHERE user_id = '[USER_B_UUID]'
ORDER BY created_at DESC;
```

---

### Test: Service Role vede tutto (solo per admin verificato)

**Setup:**

1. Usa service_role context (solo in operazioni admin verificate)
2. Chiama `getSpedizioni(serviceRoleContext)`

**Atteso:**

- Service role vede tutte le spedizioni
- Audit log registrato

**Verifica codice:**

- ✅ `lib/database.ts:942-950` - Service role bypass RLS
- ✅ `lib/auth-context.ts:88-103` - `createServiceRoleContext()` verifica service key

**Log da cercare:**

```
🔐 [AUDIT] Service Role Operation: getSpedizioni
🔐 [SUPABASE] Service role: recupero tutte le spedizioni (bypass RLS)
```

---

## 3️⃣ Runtime Validation (assertValidUserId)

### Test: Insert shipment senza userId valido

**Test 1: userId = undefined**

```typescript
// In test o script
try {
  await createShipment(shipmentData, undefined as any);
  // FAIL: dovrebbe throw
} catch (error) {
  // Atteso: Error con "USER_ID_REQUIRED"
}
```

**Test 2: userId = ""**

```typescript
try {
  await createShipment(shipmentData, '');
  // FAIL: dovrebbe throw
} catch (error) {
  // Atteso: Error con "USER_ID_REQUIRED"
}
```

**Test 3: userId = "not-a-uuid"**

```typescript
try {
  await createShipment(shipmentData, 'not-a-uuid');
  // FAIL: dovrebbe throw
} catch (error) {
  // Atteso: Error con "INVALID_USER_ID"
}
```

**Verifica codice:**

- ✅ `lib/db/shipments.ts:26` - `assertValidUserId(userId)` prima di insert
- ✅ `lib/ai/tools/shipments-batch.ts:319` - `assertValidUserId(userId)` prima di insert
- ✅ `lib/validators.ts:75-95` - Validazione completa

**Log da cercare:**

```
USER_ID_REQUIRED: userId è obbligatorio...
INVALID_USER_ID: userId deve essere un UUID valido...
```

---

## 4️⃣ Verifica Database (Query dirette)

### Test: Nessuna shipment con user_id=null per utenti normali

**Query Supabase:**

```sql
-- Questa query NON deve restituire risultati per utenti normali
-- (solo service_role può vedere shipments con user_id=null)
SELECT id, user_id, tracking_number, created_by_user_email
FROM shipments
WHERE user_id IS NULL
AND created_by_admin_id IS NULL;  -- Non create da admin

-- Atteso: 0 risultati (o solo con created_by_admin_id)
```

**Verifica RLS:**

```sql
-- Verifica policy RLS
SELECT schemaname, tablename, policyname, qual
FROM pg_policies
WHERE tablename = 'shipments'
AND policyname LIKE '%select%';

-- Atteso: Policy NON deve includere "OR user_id IS NULL"
```

---

## 📊 Risultati Attesi

### ✅ OK se:

- [ ] Tutti gli endpoint ritornano 401 senza session
- [ ] User A non vede shipments User B
- [ ] Query filtrata per `user_id` nei log
- [ ] `assertValidUserId` blocca userId invalidi
- [ ] Nessuna shipment con `user_id=null` (tranne service_role con audit)
- [ ] Log audit per operazioni service_role

### ❌ KO se:

- [ ] Endpoint ritorna 200 senza session
- [ ] User A vede shipments User B
- [ ] Query senza filtro `user_id` nei log
- [ ] Insert con `userId=""` o `undefined` riesce
- [ ] Shipments con `user_id=null` senza `created_by_admin_id`

---

## 🔍 Comandi Rapidi Verifica

### 1. Test 401 (senza auth)

```bash
# GET /api/spedizioni
curl -v https://[DOMAIN]/api/spedizioni 2>&1 | grep -E "HTTP|error"

# GET /api/corrieri/reliability
curl -v "https://[DOMAIN]/api/corrieri/reliability?citta=Roma&provincia=RM" 2>&1 | grep -E "HTTP|error"
```

### 2. Test Tenant Isolation

```bash
# Con session User A
curl -H "Cookie: [SESSION_A]" https://[DOMAIN]/api/spedizioni | jq '.data[].user_id'

# Con session User B
curl -H "Cookie: [SESSION_B]" https://[DOMAIN]/api/spedizioni | jq '.data[].user_id'

# Verifica: tutti gli user_id devono essere [USER_B_UUID]
```

### 3. Verifica Log Vercel

```bash
# Cerca log di sicurezza
vercel logs --follow | grep -E "SECURITY|AUDIT|USER_ID_REQUIRED|INVALID_USER_ID"
```

---

## 📝 Note

- **Service Role**: Usare SOLO per operazioni admin verificate con audit log
- **RLS**: Le policy Supabase devono essere verificate separatamente
- **Test Manuali**: Eseguire in ambiente staging prima di produzione

---

**Data verifica:** **\*\***\_\_\_**\*\***  
**Verificato da:** **\*\***\_\_\_**\*\***  
**Stato:** ✅ OK / ❌ KO
