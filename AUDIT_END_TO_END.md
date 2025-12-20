# 🔍 AUDIT END-TO-END - Flusso Post Email Confirmation

## 📋 Entrypoint Dopo Email Confirmation

**Entrypoint**: `/auth/callback` (client-side page)

**Configurazione Supabase**:
- Site URL: `https://spediresicuro.vercel.app/auth/callback`
- Redirect URLs: `/auth/callback` e `/auth/callback/**`
- Supabase reindirizza a: `/auth/callback#access_token=...&refresh_token=...&type=signup`

---

## 🔄 FLUSSO REALE STEP-BY-STEP

### Step 1: Email Confirmation Click
- Utente clicca link email
- Supabase conferma email → `email_confirmed_at` valorizzato
- Supabase reindirizza a: `/auth/callback#access_token=...&refresh_token=...&type=signup`

### Step 2: `/auth/callback` (Client)
**File**: `app/auth/callback/page.tsx`

- **Linee 24-50**: Estrae token dal hash (`access_token`, `refresh_token`)
- **Linee 55-63**: Imposta sessione Supabase (`supabase.auth.setSession()`)
- **Linee 84-106**: Chiama `POST /api/auth/supabase-callback` con token
- **Linea 102**: Riceve `{ success, tempToken, redirectTo }` ← **DECISIONE REDIRECT QUI**
- **Linee 111-124**: `signIn('credentials', { email, password: tempToken })` → NextAuth sessione creata
- **Linea 139**: `router.replace(redirectTo || '/dashboard')` ← **REDIRECT FINALE**

### Step 3: `/api/auth/supabase-callback` (Server) - DECISIONE REDIRECT
**File**: `app/api/auth/supabase-callback/route.ts`

- **Linee 40-66**: Verifica token Supabase, verifica email confermata
- **Linee 77-107**: Crea record `public.users` se non esiste
- **Linee 125-129**: Query `dati_cliente`:
  ```typescript
  const { data: userData, error: userDataError } = await supabaseAdmin
    .from('users')
    .select('dati_cliente')
    .eq('email', email)
    .single();
  ```
- **Linee 131-134**: **DECISIONE REDIRECT**:
  ```typescript
  let redirectTo = '/dashboard'; // DEFAULT
  if (userDataError || !userData?.dati_cliente || !userData.dati_cliente.datiCompletati) {
    redirectTo = '/dashboard/dati-cliente';
  }
  ```
- **Linea 142**: Restituisce `redirectTo` al client

### Step 4: Middleware
**File**: `middleware.ts`

- **Linee 105-137**: Controlla solo autenticazione (NextAuth session)
- **NON controlla** `dati_cliente` o `datiCompletati`
- Se autenticato → passa (anche se dati non completati)
- Se non autenticato → redirect a `/login`

**PROBLEMA**: ❌ Middleware NON blocca accesso a `/dashboard` se dati non completati

### Step 5: Dashboard Layout
**File**: `app/dashboard/layout.tsx`

- **Linee 25-70**: Controlla solo autenticazione (NextAuth session)
- **NON controlla** `dati_cliente` o `datiCompletati`
- Se autenticato → renderizza layout (anche se dati non completati)
- Se non autenticato → redirect a `/login`

**PROBLEMA**: ❌ Layout NON blocca accesso a `/dashboard` se dati non completati

### Step 6: `/dashboard/page.tsx` (Se redirectTo = '/dashboard')
**File**: `app/dashboard/page.tsx`

- **Linee 179-270**: Controllo client-side (useEffect)
- Controlla database per `dati_cliente.datiCompletati`
- Se dati non completati → `router.push('/dashboard/dati-cliente')`
- **PROBLEMA**: ❌ Client-side, può essere bypassato (race condition, delay, errori)

### Step 7: `/dashboard/dati-cliente/page.tsx`
**File**: `app/dashboard/dati-cliente/page.tsx`

- **Linee 113-155**: Controllo client-side (useEffect)
- Controlla database per `dati_cliente.datiCompletati`
- Se dati completati → `router.push('/dashboard')`
- **OK**: Form onboarding mostrato se dati non completati

---

## ❌ DIVERGENZE DAL REQUISITO

### Requisito
> "Se dati cliente obbligatori NON completati -> viene portato SEMPRE a /dashboard/dati-cliente prima di qualsiasi dashboard."

### Realtà

1. **Redirect decisione corretta** ✅
   - `/api/auth/supabase-callback` decide correttamente `redirectTo = '/dashboard/dati-cliente'` se dati non completati

2. **Middleware NON blocca** ❌
   - Middleware controlla solo autenticazione
   - Utente autenticato può accedere a `/dashboard` anche se dati non completati
   - Se utente naviga direttamente a `/dashboard` → middleware passa → layout passa → `/dashboard/page.tsx` fa redirect client-side (race condition)

3. **Layout NON blocca** ❌
   - Layout controlla solo autenticazione
   - Utente autenticato può vedere dashboard anche se dati non completati

4. **Controllo client-side** ❌
   - `/dashboard/page.tsx` fa controllo client-side con `useEffect`
   - Può essere bypassato (race condition, delay, errori)
   - Utente può vedere dashboard per un momento prima del redirect

---

## 🔍 ROOT CAUSE

**Problema principale**: Gate non è server-authoritative

**Causa**:
- Middleware e Layout controllano solo autenticazione
- Controllo `dati_cliente` è client-side in `/dashboard/page.tsx`
- Nessun gate server-side che blocca accesso a `/dashboard` se dati non completati

**Condizione che causa divergenza**:
- Utente autenticato naviga direttamente a `/dashboard`
- Middleware passa (solo controlla autenticazione)
- Layout passa (solo controlla autenticazione)
- `/dashboard/page.tsx` fa redirect client-side (può essere bypassato)

---

## ✅ SOLUZIONE RICHIESTA

**Gate server-authoritative**:
- Middleware o Layout deve controllare `dati_cliente.datiCompletati` server-side
- Se dati non completati → redirect a `/dashboard/dati-cliente` PRIMA di renderizzare
- Nessun controllo client-side per gating (solo per UX)

**Pattern consigliato**:
- **Middleware**: Controlla `dati_cliente` per route `/dashboard` (escluso `/dashboard/dati-cliente`)
- **Layout**: Alternativa se middleware non può fare query DB (ma middleware può chiamare API interna)

