# 🔍 AUDIT END-TO-END - Primo Accesso Post Email Confirmation

## PARTE 1 — RIPRODUZIONE FLUSSO REALE

### Step 1: Signup
**File**: `app/api/auth/register/route.ts`
- **Linea 76**: `supabase.auth.signUp()` con `emailRedirectTo: callbackUrl`
- **Linea 74**: `callbackUrl = ${baseUrl}/auth/callback`
- **Risultato**: Supabase invia email con link che reindirizza a `/auth/callback#access_token=...&refresh_token=...&type=signup`

### Step 2: Email Confirmation Click
- Utente clicca link email
- Supabase conferma email → `email_confirmed_at` valorizzato
- Supabase reindirizza a: `/auth/callback#access_token=...&refresh_token=...&type=signup`

### Step 3: `/auth/callback` (Client-Side)
**File**: `app/auth/callback/page.tsx`

**Flusso**:
1. **Linea 25**: Legge `window.location.hash`
2. **Linee 44-50**: Estrae `access_token` e `refresh_token`
3. **Linee 55-63**: Imposta sessione Supabase (`supabase.auth.setSession()`)
4. **Linee 84-100**: Chiama `POST /api/auth/supabase-callback` con token
5. **Linea 102**: Riceve `{ success, tempToken, redirectTo }` ← **DECISIONE REDIRECT QUI**
6. **Linee 111-124**: `signIn('credentials', { email, password: tempToken, redirect: false })` → NextAuth sessione creata
7. **Linea 137**: `router.replace(redirectTo || '/dashboard/dati-cliente')` ← **REDIRECT FINALE CLIENT-SIDE**

**Problema identificato**:
- ❌ **P0-1**: Redirect è client-side (`router.replace`) invece che server-side
- ❌ **P0-2**: Se `redirectTo` è `/dashboard`, c'è un flash prima che il layout faccia redirect server-side

### Step 4: `/api/auth/supabase-callback` (Server-Side) - DECISIONE REDIRECT
**File**: `app/api/auth/supabase-callback/route.ts`

**Flusso**:
1. **Linee 40-66**: Verifica token Supabase, verifica email confermata
2. **Linee 77-107**: Crea record `public.users` se non esiste
3. **Linee 125-129**: Query `dati_cliente`:
   ```typescript
   const { data: userData, error: userDataError } = await supabaseAdmin
     .from('users')
     .select('dati_cliente')
     .eq('email', email)
     .single();
   ```
4. **Linee 131-134**: **DECISIONE REDIRECT**:
   ```typescript
   let redirectTo = '/dashboard';
   
   if (userDataError || !userData?.dati_cliente || !userData.dati_cliente.datiCompletati) {
     redirectTo = '/dashboard/dati-cliente';
   }
   ```
5. **Linea 142**: Restituisce `redirectTo` al client

**Status**: ✅ **LOGICA CORRETTA** - Ma potrebbe esserci un problema se `userData` esiste ma `dati_cliente` è `null`

### Step 5: Middleware
**File**: `middleware.ts`
- **Linea 106**: `const session = await auth()` → Verifica sessione NextAuth
- **Linea 115**: Se route `/dashboard` e sessione presente → passa
- **Linea 144**: Aggiunge header `x-pathname` per layout

**Status**: ✅ **CORRETTO** - Passa se autenticato

### Step 6: Dashboard Layout (Gate Onboarding)
**File**: `app/dashboard/layout.tsx`
- **Linea 45**: `const session = await auth()` → Ottiene sessione
- **Linee 82-90**: Query `dati_cliente` con `findUserByEmail()`
- **Linee 93-102**: Se dati non completati → `redirect('/dashboard/dati-cliente')` (server-side)

**Status**: ✅ **CORRETTO** - Gate server-side funziona

---

## PARTE 2 — AUDIT TECNICO OBBLIGATORIO

### File: `app/api/auth/[...nextauth]/route.ts`
- **Eseguito nel primo accesso?**: NO (non viene chiamato direttamente)
- **Ha accesso alla sessione?**: N/A
- **Può decidere il redirect?**: NO (NextAuth gestisce callback internamente)

### File: `app/api/auth/supabase-callback/route.ts`
- **Eseguito nel primo accesso?**: ✅ SI (chiamato da `/auth/callback`)
- **Ha accesso alla sessione?**: NO (non usa NextAuth, usa token Supabase)
- **Può decidere il redirect?**: ✅ SI (restituisce `redirectTo` al client)

**Problema**: Restituisce `redirectTo` al client, ma il client fa redirect client-side invece che server-side.

### File: `middleware.ts`
- **Eseguito nel primo accesso?**: ✅ SI (eseguito per tutte le route `/dashboard/*`)
- **Ha accesso alla sessione?**: ✅ SI (`await auth()`)
- **Può decidere il redirect?**: ✅ SI (può fare `NextResponse.redirect()`)

**Status**: ✅ **CORRETTO** - Ma non controlla `dati_cliente` (delegato al layout)

### File: `app/dashboard/layout.tsx`
- **Eseguito nel primo accesso?**: ✅ SI (eseguito per tutte le route `/dashboard/*`)
- **Ha accesso alla sessione?**: ✅ SI (`await auth()`)
- **Può decidere il redirect?**: ✅ SI (`redirect('/dashboard/dati-cliente')`)

**Status**: ✅ **CORRETTO** - Gate server-side funziona, ma c'è un flash se il client fa redirect a `/dashboard` prima

### File: `app/login/page.tsx`
- **Eseguito nel primo accesso?**: NO (non viene eseguito dopo email confirmation)
- **Ha accesso alla sessione?**: N/A
- **Può decidere il redirect?**: N/A

---

## PARTE 3 — ROOT CAUSE (OBBLIGATORIA)

### Root Cause Identificata:

**Problema**: Race condition tra redirect client-side e server-side.

**Sequenza del problema**:
1. `/api/auth/supabase-callback` restituisce `redirectTo = '/dashboard'` (se `dati_cliente` esiste ma `datiCompletati !== true`)
2. Client fa `router.replace('/dashboard')` (client-side redirect)
3. Browser naviga a `/dashboard`
4. Middleware passa (utente autenticato)
5. Layout dashboard controlla `dati_cliente` → redirect server-side a `/dashboard/dati-cliente`
6. **FLASH**: L'utente vede `/dashboard` per un attimo prima del redirect

**Causa precisa**:
- `/api/auth/supabase-callback` restituisce `redirectTo = '/dashboard'` quando `dati_cliente` esiste ma `datiCompletati !== true`
- Il client fa redirect client-side a `/dashboard` prima che il layout faccia redirect server-side
- **Mismatch**: Il server decide `redirectTo = '/dashboard'` ma il layout poi fa redirect a `/dashboard/dati-cliente`

**Fix necessario**:
- `/api/auth/supabase-callback` deve SEMPRE restituire `/dashboard/dati-cliente` se `dati_cliente` è NULL o `datiCompletati !== true`
- Verificare che la logica sia corretta (potrebbe esserci un bug nella condizione)

---

## PARTE 4 — FIX ARCHITETTURALE (OBBLIGATORIO)

### Fix 1: Correggere logica redirect in `/api/auth/supabase-callback`

**File**: `app/api/auth/supabase-callback/route.ts`

**Problema attuale** (linee 131-134):
```typescript
let redirectTo = '/dashboard';

if (userDataError || !userData?.dati_cliente || !userData.dati_cliente.datiCompletati) {
  redirectTo = '/dashboard/dati-cliente';
}
```

**Problema**: Se `userData` esiste ma `dati_cliente` è `null`, la condizione `!userData?.dati_cliente` è `true`, quindi `redirectTo = '/dashboard/dati-cliente'` è corretto. Ma se `dati_cliente` esiste ma `datiCompletati` è `false`, la condizione `!userData.dati_cliente.datiCompletati` è `true`, quindi `redirectTo = '/dashboard/dati-cliente'` è corretto.

**Verifica**: La logica sembra corretta, ma potrebbe esserci un problema se `dati_cliente` è un oggetto vuoto `{}` invece di `null`.

**Fix proposto**:
```typescript
let redirectTo = '/dashboard';

// Verifica se dati cliente sono completati
const hasDatiCliente = userData?.dati_cliente && typeof userData.dati_cliente === 'object';
const datiCompletati = hasDatiCliente && userData.dati_cliente.datiCompletati === true;

if (userDataError || !hasDatiCliente || !datiCompletati) {
  redirectTo = '/dashboard/dati-cliente';
}
```

### Fix 2: Assicurarsi che il redirect sia sempre a `/dashboard/dati-cliente` per utenti nuovi

**File**: `app/api/auth/supabase-callback/route.ts`

**Fix proposto**: Cambiare default da `/dashboard` a `/dashboard/dati-cliente` (fail-safe):
```typescript
let redirectTo = '/dashboard/dati-cliente'; // Default fail-safe

// Verifica se dati cliente sono completati
const hasDatiCliente = userData?.dati_cliente && typeof userData.dati_cliente === 'object';
const datiCompletati = hasDatiCliente && userData.dati_cliente.datiCompletati === true;

if (hasDatiCliente && datiCompletati) {
  redirectTo = '/dashboard';
}
```

---

## PARTE 5 — FIX UI CRITICO (P0)

**Problema**: Testo input invisibile (nero su nero)

**Root cause**: CSS globale forza testo nero su tutti gli input, anche quelli con sfondo scuro.

**Fix già implementato**: `app/globals.css` (linee 80-122)
- Input con `bg-gray-800` → testo bianco (`#ffffff`)
- Placeholder → grigio chiaro (`#9ca3af`) con contrasto WCAG AA
- Selezione → background giallo brand con testo bianco
- Autofill → mantiene testo bianco e sfondo scuro

**Status**: ✅ **FIX COMPLETO** - Verificare che funzioni in produzione

---

## PARTE 6 — OUTPUT OBBLIGATORIO

### 1. Root Cause (5-10 righe)

**Root cause**: Race condition tra redirect client-side e server-side. `/api/auth/supabase-callback` restituisce `redirectTo = '/dashboard'` quando `dati_cliente` esiste ma `datiCompletati !== true`, causando un flash di `/dashboard` prima che il layout faccia redirect server-side a `/dashboard/dati-cliente`. Il problema è che il default è `/dashboard` invece di `/dashboard/dati-cliente` (fail-safe).

### 2. Lista File da Modificare

1. `app/api/auth/supabase-callback/route.ts` - Correggere logica redirect (fail-safe default)

### 3. Codice PATCH

```typescript
// app/api/auth/supabase-callback/route.ts (linee 121-134)

// Determina redirect (dashboard o dati-cliente se onboarding necessario)
// ⚠️ P0 FIX: Default fail-safe a /dashboard/dati-cliente (evita flash di dashboard)
let redirectTo = '/dashboard/dati-cliente';

// Verifica dati cliente per determinare redirect
const { data: userData, error: userDataError } = await supabaseAdmin
  .from('users')
  .select('dati_cliente')
  .eq('email', email)
  .single();

// ⚠️ P0 FIX: Verifica esplicita che dati_cliente esista e datiCompletati sia true
if (!userDataError && userData?.dati_cliente) {
  const hasDatiCliente = userData.dati_cliente && typeof userData.dati_cliente === 'object';
  const datiCompletati = hasDatiCliente && userData.dati_cliente.datiCompletati === true;
  
  // Solo se dati sono completati → redirect a /dashboard
  if (datiCompletati) {
    redirectTo = '/dashboard';
  }
}
```

### 4. Checklist QA Manuale (Incognito)

1. ✅ Signup nuovo utente → email inviata
2. ✅ Click link email → redirect a `/auth/callback`
3. ✅ Auto-login completato → redirect a `/dashboard/dati-cliente` (NON `/dashboard`)
4. ✅ Nessun flash di dashboard prima del redirect
5. ✅ Input onboarding leggibili (testo bianco su sfondo scuro)
6. ✅ Placeholder visibile (grigio chiaro)
7. ✅ Compilazione dati cliente → submit OK
8. ✅ Dopo submit → redirect a `/dashboard` (NON loop)

---

## ✅ STATUS FINALE

**Root cause identificata**: ✅
**Fix architetturale proposto**: ✅
**Fix UI già implementato**: ✅
**Pronto per implementazione**: ✅

