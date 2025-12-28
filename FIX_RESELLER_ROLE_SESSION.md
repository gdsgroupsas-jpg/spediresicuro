# 🔧 FIX: reseller_role nella Sessione NextAuth

**Data**: 2025-12-28  
**Problema**: Reseller non può gestire/cancellare proprie configurazioni corriere  
**Causa Root**: `reseller_role` non veniva caricato nella sessione NextAuth  
**Tipo di blocco**: RBAC (codice applicativo), NON RLS  

---

## 📋 DIAGNOSI

### Sintomo
Account reseller vede "Accesso Negato" quando tenta di modificare/eliminare configurazioni in `/dashboard/integrazioni`.

### Analisi

1. **RLS su courier_configs**: Abilitato (migrazione 010), ma le actions usano `supabaseAdmin` (service role) che bypassa RLS.

2. **RBAC in `verifyConfigAccess()`**: Controlla correttamente:
   - Super Admin → OK
   - Reseller Admin (`reseller_role === 'admin'` + owner match) → OK
   - Altri → Negato

3. **Problema trovato**: `reseller_role` **non veniva caricato nella sessione NextAuth**!

```typescript
// lib/auth-config.ts (JWT callback) - PRIMA
.select('id, is_reseller, parent_id, wallet_balance, account_type')
// ❌ Manca reseller_role!
```

La UI controllava `(session?.user as any)?.reseller_role` che era sempre `undefined`.

---

## ✅ FIX APPLICATI

### 1. `lib/auth-config.ts` - JWT Callback

**Aggiunto `reseller_role` alla query e al token:**

```typescript
// Riga 435: Aggiunto reseller_role alla query
.select('id, is_reseller, reseller_role, parent_id, wallet_balance, account_type')

// Riga 442: Aggiunto al token
token.reseller_role = userData.reseller_role || null;

// Riga 461: Aggiunto default nel catch
token.reseller_role = null;
```

### 2. `lib/auth-config.ts` - Session Callback

**Aggiunto `reseller_role` alla session:**

```typescript
// Riga 527
(session.user as any).reseller_role = token.reseller_role || null;
```

### 3. `components/integrazioni/spedisci-online-config-multi.tsx`

**Migliorato check admin per includere superadmin:**

```typescript
const accountType = (session?.user as any)?.account_type
const isAdmin = (session?.user as any)?.role === 'admin' || accountType === 'superadmin'
```

### 4. `actions/configurations.ts`

**Aggiunti log di debug in `verifyConfigAccess()`:**

```typescript
console.log('🔍 [verifyConfigAccess] Verifica permessi:', {
  userId,
  email: session.user.email,
  accountType,
  role: user.role,
  isReseller,
  resellerRole,
  configOwnerUserId,
});
```

---

## 📁 FILE MODIFICATI

| File | Modifica |
|------|----------|
| `lib/auth-config.ts` | Aggiunto `reseller_role` a query, token e session |
| `components/integrazioni/spedisci-online-config-multi.tsx` | Migliorato check isAdmin |
| `actions/configurations.ts` | Aggiunti log debug in verifyConfigAccess |

---

## 🧪 TEST PLAN

### Pre-requisiti
1. Migrazione 051 applicata (`reseller_role` esiste in `users`)
2. Migrazione 052 applicata (UNIQUE index per upsert)
3. Almeno un reseller con `reseller_role = 'admin'`

### Test 1: Reseller Admin può eliminare propria config

**Steps:**
1. Login come reseller con `reseller_role = 'admin'`
2. Vai a `/dashboard/integrazioni`
3. Verifica: pulsanti Modifica/Elimina/Toggle **visibili**
4. Clicca Elimina sulla propria configurazione
5. Conferma eliminazione

**Verifiche:**
- ✅ Pulsanti visibili
- ✅ Eliminazione riuscita
- ✅ Log: `✅ [verifyConfigAccess] Accesso OK: Reseller Admin, owner match`

### Test 2: Reseller User NON può eliminare config

**Steps:**
1. Login come reseller con `reseller_role = 'user'` (o NULL)
2. Vai a `/dashboard/integrazioni`
3. Verifica: pulsanti Modifica/Elimina/Toggle **NON visibili**
4. (Opzionale) Prova chiamata API diretta

**Verifiche:**
- ✅ Pulsanti NON visibili
- ✅ API ritorna errore "Accesso negato"
- ✅ Log: `❌ [verifyConfigAccess] Accesso negato: né super_admin né reseller_admin`

### Test 3: Super Admin sempre OK

**Steps:**
1. Login come super admin (`account_type = 'superadmin'`)
2. Vai a `/dashboard/integrazioni`
3. Verifica: vedi TUTTE le configurazioni
4. Elimina qualsiasi configurazione

**Verifiche:**
- ✅ Vede tutte le config
- ✅ Può eliminare qualsiasi config
- ✅ Log: `✅ [verifyConfigAccess] Accesso OK: Super Admin`

---

## 🔍 DEBUG: Come Verificare la Session

Dopo il login, i log server mostreranno:

```
✅ [NEXTAUTH] Session aggiornata: {
  id: "...",
  email: "reseller@example.com",
  role: "user",
  is_reseller: true,
  reseller_role: "admin",  // ← Ora presente!
  wallet_balance: 100,
  account_type: "user"
}
```

---

## ⚠️ NOTE

1. **RLS non è il problema**: Le actions usano `supabaseAdmin` (service role) che bypassa RLS.

2. **Il blocco è RBAC applicativo**: La funzione `verifyConfigAccess()` controlla i permessi.

3. **Logout/Login richiesto**: Gli utenti esistenti devono ri-loggarsi per avere `reseller_role` nella sessione.

---

## 📊 RIEPILOGO PERMESSI

| Ruolo | Vede Config | Modifica | Elimina |
|-------|-------------|----------|---------|
| Super Admin | TUTTE | TUTTE | TUTTE |
| Reseller Admin | Solo proprie | Solo proprie | Solo proprie |
| Reseller User | Solo proprie | ❌ | ❌ |
| User normale | ❌ | ❌ | ❌ |

