# 🔍 AUDIT COMPLETO - Post First Login Flow

## FASE 1 — RIPRODUZIONE OBBLIGATORIA

### Flusso Reale Step-by-Step:

#### Step 1: Signup
- Utente si registra → `/api/auth/register`
- `supabase.auth.signUp()` → email inviata
- `confirmation_sent_at` valorizzato
- `email_confirmed_at` = NULL

#### Step 2: Email Confirmation Click
- Utente clicca link email Supabase
- Supabase conferma email → `email_confirmed_at` valorizzato
- Supabase reindirizza a: `/auth/callback#access_token=...&refresh_token=...&type=signup`

#### Step 3: `/auth/callback` (Client-Side)
**File**: `app/auth/callback/page.tsx`

**Sequenza eseguita**:
1. **Linea 25**: Legge `window.location.hash`
2. **Linee 44-50**: Estrae `access_token` e `refresh_token`
3. **Linee 55-63**: Imposta sessione Supabase (`supabase.auth.setSession()`)
4. **Linee 84-100**: Chiama `POST /api/auth/supabase-callback`
5. **Linea 102**: Riceve `{ success, tempToken, redirectTo }`
6. **Linee 111-115**: `signIn('credentials', { email, password: tempToken, redirect: false })`
7. **Linea 137**: `router.push('/dashboard')` ← **REDIRECT CLIENT-SIDE**

**Problema identificato**:
- ❌ Redirect è client-side (`router.push('/dashboard')`)
- ❌ Non usa `redirectTo` ricevuto da `/api/auth/supabase-callback`
- ❌ Middleware potrebbe non intercettare se redirect è troppo veloce

#### Step 4: `/api/auth/supabase-callback` (Server-Side)
**File**: `app/api/auth/supabase-callback/route.ts`

**Sequenza eseguita**:
1. **Linee 40-66**: Verifica token Supabase, verifica email confermata
2. **Linee 77-107**: Crea record `public.users` se non esiste
3. **Linee 125-130**: Query `dati_cliente`
4. **Linee 132-141**: **DECISIONE REDIRECT**:
   - Default: `redirectTo = '/dashboard/dati-cliente'` ✅
   - Solo se `datiCompletati === true` → `redirectTo = '/dashboard'`
5. **Linea 149**: Restituisce `redirectTo` al client

**Status**: ✅ **CORRETTO** - Restituisce `/dashboard/dati-cliente` per utenti nuovi

**Problema**: Il client NON usa `redirectTo` ricevuto, fa sempre `router.push('/dashboard')`

#### Step 5: Middleware (Server-Side)
**File**: `middleware.ts`

**Sequenza eseguita**:
1. **Linea 106**: `const session = await auth()` → Verifica sessione NextAuth
2. **Linea 115**: Se route `/dashboard` e sessione presente → passa
3. **Linee 139-195**: ⚠️ **GATE ONBOARDING** (appena aggiunto):
   - Import dinamico `findUserByEmail`
   - Query database per `dati_cliente`
   - Se onboarding non completato:
     - Blocca accesso a `/` → redirect a `/dashboard/dati-cliente`
     - Blocca accesso a `/dashboard` → redirect a `/dashboard/dati-cliente`

**Status**: ✅ **CORRETTO** - Gate onboarding server-authoritative implementato

**Problema potenziale**: Se client fa `router.push('/dashboard')` prima che middleware verifichi onboarding, potrebbe esserci un flash

#### Step 6: Layout Dashboard (Backup Gate)
**File**: `app/dashboard/layout.tsx`

**Sequenza eseguita**:
1. **Linea 45**: `const session = await auth()` → Ottiene sessione
2. **Linee 82-90**: Query `dati_cliente` con `findUserByEmail()`
3. **Linee 93-102**: Se dati non completati → `redirect('/dashboard/dati-cliente')` (server-side)

**Status**: ✅ **CORRETTO** - Backup gate server-side funziona

---

## FASE 2 — ANALISI TECNICA

### 1️⃣ Redirect Post-Auth

**Analisi**:
- **Client-side**: `router.push('/dashboard')` in `/auth/callback` (linea 137)
- **Server-side**: Middleware controlla onboarding e fa redirect se necessario
- **Problema**: Client fa redirect a `/dashboard` invece di usare `redirectTo` ricevuto

**Root cause**: Il client ignora `redirectTo` ricevuto da `/api/auth/supabase-callback` e fa sempre `router.push('/dashboard')`.

### 2️⃣ Middleware

**Analisi**:
- ✅ Controlla `session` (linea 106)
- ✅ Controlla **anche onboarding completato** (linee 139-195) - **APPENA AGGIUNTO**
- ✅ Blocca route pubbliche (`/`) per utenti autenticati senza onboarding (linea 159)

**Status**: ✅ **CORRETTO** - Gate onboarding server-authoritative implementato

### 3️⃣ Onboarding State

**Analisi**:
- **Dove salvato**: DB Supabase (`public.users.dati_cliente`)
- **Flag**: `dati_cliente.datiCompletati` (boolean)
- **Accessibile server-side**: ✅ SÌ - `findUserByEmail()` legge da Supabase

**Status**: ✅ **CORRETTO** - Stato onboarding accessibile server-side

### 4️⃣ UI Bug (P0)

**Analisi**:
- **Problema**: Testo input invisibile (nero su nero)
- **Root cause**: CSS globale forza testo nero su tutti gli input
- **Fix**: `app/globals.css` (linee 80-122) - Input con `bg-gray-800` → testo bianco

**Status**: ✅ **FIX IMPLEMENTATO**

---

## 🔴 PROBLEMA IDENTIFICATO

### Root Cause Precisa:

**Il client in `/auth/callback` ignora `redirectTo` ricevuto da `/api/auth/supabase-callback` e fa sempre `router.push('/dashboard')` invece di usare `redirectTo`.**

**Dove**:
- `app/auth/callback/page.tsx` linea 137: `router.push('/dashboard')` invece di `router.push(redirectTo)`

**Perché**:
- Il codice non usa la variabile `redirectTo` ricevuta dalla risposta API
- Fa sempre redirect a `/dashboard` hardcoded

**Conseguenza**:
- Anche se `/api/auth/supabase-callback` restituisce `redirectTo = '/dashboard/dati-cliente'`, il client ignora e va a `/dashboard`
- Il middleware intercetta e fa redirect a `/dashboard/dati-cliente`, ma c'è un flash di `/dashboard`

---

## ✅ FIX NECESSARIO

### File: `app/auth/callback/page.tsx`

**Problema attuale** (linea 137):
```typescript
router.push('/dashboard'); // Ignora redirectTo ricevuto
```

**Fix necessario**:
```typescript
// Usa redirectTo ricevuto da /api/auth/supabase-callback
const finalRedirect = redirectTo || '/dashboard/dati-cliente';
router.push(finalRedirect);
```

**Motivazione**:
- Usa `redirectTo` ricevuto dal server (decisione server-authoritative)
- Fallback a `/dashboard/dati-cliente` (fail-safe)
- Middleware intercetterà comunque se necessario (doppia protezione)

---

## ✅ STATUS FINALE

**Flusso riprodotto**: ✅ SÌ
**Root cause identificata**: ✅ SÌ - Client ignora `redirectTo` ricevuto
**Fix server-authoritative**: ✅ SÌ - Middleware gate implementato
**Onboarding non bypassabile**: ✅ SÌ - Middleware blocca accesso a `/` e `/dashboard`

**Fix rimanente**: Usare `redirectTo` ricevuto in `/auth/callback` invece di hardcoded `/dashboard`

