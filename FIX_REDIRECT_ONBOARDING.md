# 🔧 FIX REDIRECT ONBOARDING - Root Cause e Soluzione

## 📋 Root Cause Identificata

**Problema**: Race condition tra redirect client-side e server-side.

**Sequenza del problema**:
1. `/api/auth/supabase-callback` restituisce `redirectTo = '/dashboard'` (default)
2. Client fa `router.replace('/dashboard')` (client-side redirect)
3. Browser naviga a `/dashboard`
4. Middleware passa (utente autenticato)
5. Layout dashboard controlla `dati_cliente` → redirect server-side a `/dashboard/dati-cliente`
6. **FLASH**: L'utente vede `/dashboard` per un attimo prima del redirect

**Causa precisa**:
- Default `redirectTo = '/dashboard'` invece di `/dashboard/dati-cliente` (fail-safe)
- Il client fa redirect client-side a `/dashboard` prima che il layout faccia redirect server-side
- **Mismatch**: Il server decide `redirectTo = '/dashboard'` ma il layout poi fa redirect a `/dashboard/dati-cliente`

---

## ✅ Soluzione Implementata

### File Modificato: `app/api/auth/supabase-callback/route.ts`

### Cambiamento:

**Prima** (linee 121-134):
```typescript
let redirectTo = '/dashboard'; // Default a dashboard

if (userDataError || !userData?.dati_cliente || !userData.dati_cliente.datiCompletati) {
  redirectTo = '/dashboard/dati-cliente';
}
```

**Dopo** (linee 121-135):
```typescript
let redirectTo = '/dashboard/dati-cliente'; // Default fail-safe a onboarding

if (!userDataError && userData?.dati_cliente) {
  const hasDatiCliente = userData.dati_cliente && typeof userData.dati_cliente === 'object';
  const datiCompletati = hasDatiCliente && userData.dati_cliente.datiCompletati === true;
  
  if (datiCompletati) {
    redirectTo = '/dashboard'; // Solo se dati completati → dashboard
  }
}
```

### Motivazione:

1. **Fail-safe default**: Se c'è un errore o dati non disponibili, redirect a onboarding (sicuro)
2. **Verifica esplicita**: Controlla che `dati_cliente` esista e sia un oggetto valido
3. **Solo se completati**: Redirect a `/dashboard` solo se `datiCompletati === true`
4. **Nessun flash**: Il client fa redirect direttamente a `/dashboard/dati-cliente`, evitando il flash

---

## 🎯 Risultato Atteso

### Flusso Corretto:

1. Email confirmation → Supabase reindirizza a `/auth/callback#access_token=...`
2. `/auth/callback` chiama `/api/auth/supabase-callback`
3. `/api/auth/supabase-callback` restituisce `redirectTo = '/dashboard/dati-cliente'` (default fail-safe)
4. Client fa `router.replace('/dashboard/dati-cliente')` (client-side redirect)
5. Browser naviga a `/dashboard/dati-cliente`
6. Middleware passa (utente autenticato)
7. Layout dashboard controlla `dati_cliente` → **NON fa redirect** (già su onboarding page)
8. **Nessun flash**: L'utente vede direttamente la pagina onboarding

---

## ✅ Verifica

### Test Case 1: Utente Nuovo (dati_cliente NULL)
- **Input**: `userData.dati_cliente = null`
- **Output**: `redirectTo = '/dashboard/dati-cliente'` ✅
- **Risultato**: Redirect diretto a onboarding, nessun flash

### Test Case 2: Utente con dati_cliente incompleti
- **Input**: `userData.dati_cliente = { nome: 'Test', datiCompletati: false }`
- **Output**: `redirectTo = '/dashboard/dati-cliente'` ✅
- **Risultato**: Redirect diretto a onboarding, nessun flash

### Test Case 3: Utente con dati_cliente completati
- **Input**: `userData.dati_cliente = { nome: 'Test', datiCompletati: true }`
- **Output**: `redirectTo = '/dashboard'` ✅
- **Risultato**: Redirect a dashboard, layout non fa redirect (dati completati)

### Test Case 4: Errore query database
- **Input**: `userDataError !== null`
- **Output**: `redirectTo = '/dashboard/dati-cliente'` ✅ (fail-safe)
- **Risultato**: Redirect diretto a onboarding, nessun flash

---

## 📝 Note Tecniche

### Verifica Esplicita:

La nuova logica verifica esplicitamente:
1. `!userDataError` → Nessun errore query
2. `userData?.dati_cliente` → Dati cliente esistono
3. `typeof userData.dati_cliente === 'object'` → Dati cliente sono un oggetto valido
4. `userData.dati_cliente.datiCompletati === true` → Flag completamento è true

Solo se tutte le condizioni sono vere → `redirectTo = '/dashboard'`

### Fail-Safe:

Se qualsiasi condizione fallisce → `redirectTo = '/dashboard/dati-cliente'` (default)

---

## ✅ Status

**Fix implementato**: ✅
**Build passato**: ✅
**Pronto per test**: ✅

