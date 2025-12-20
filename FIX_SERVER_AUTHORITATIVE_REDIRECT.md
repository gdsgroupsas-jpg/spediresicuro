# 🔧 FIX: Server-Authoritative Redirect Post-Auth

## 📋 Root Cause Identificata

**Problema**: Il redirect post-auth è gestito client-side (`window.location.href` in `/auth/callback`), permettendo bypass e race condition. Inoltre, il middleware NON controlla onboarding, permettendo accesso a route pubbliche (home) anche se onboarding non completato.

**Causa precisa**:
1. **Redirect client-side**: `window.location.href` in `/auth/callback` bypassa controlli server
2. **Middleware NON controlla onboarding**: Controlla solo autenticazione, passa se sessione presente
3. **Route `/` è pubblica**: Middleware passa senza controllare onboarding per utenti autenticati
4. **Race condition**: Client redirect può arrivare prima del controllo server nel layout

---

## ✅ Soluzione Implementata

### Architettura Server-Authoritative

```
Email Confirmation → /auth/callback → signIn() → Middleware (GATE ONBOARDING) → Redirect Server-Side
                                                              ↓
                                              Se onboarding_completed = false
                                                              ↓
                                              Redirect a /dashboard/dati-cliente
```

### File 1: `middleware.ts` - Gate Onboarding Server-Authoritative

**Aggiunto controllo onboarding dopo autenticazione** (linee 139-186):

```typescript
// ⚠️ P0: SERVER-AUTHORITATIVE ONBOARDING GATE
// Controlla onboarding per utenti autenticati PRIMA di permettere accesso
if (session?.user?.email) {
  try {
    // Import dinamico per evitare problemi Edge Runtime
    const { findUserByEmail } = await import('@/lib/database');
    const user = await findUserByEmail(session.user.email);
    
    const userEmail = session.user.email?.toLowerCase() || '';
    const isTestUser = userEmail === 'test@spediresicuro.it';
    
    // Per utente test, bypass controllo onboarding
    if (!isTestUser) {
      const hasDatiCliente = !!user?.datiCliente;
      const datiCompletati = user?.datiCliente?.datiCompletati === true;
      const onboardingCompleted = hasDatiCliente && datiCompletati;
      
      // Se onboarding NON completato
      if (!onboardingCompleted) {
        // Blocca accesso a route pubbliche (home) se autenticato ma onboarding non completato
        if (pathname === '/' || (isPublicRoute(pathname) && pathname !== '/login' && pathname !== '/api/auth')) {
          const onboardingUrl = new URL('/dashboard/dati-cliente', request.url);
          const response = NextResponse.redirect(onboardingUrl);
          response.headers.set('X-Request-ID', requestId);
          return response;
        }
        
        // Blocca accesso a /dashboard se non su onboarding
        if (pathname.startsWith('/dashboard') && pathname !== '/dashboard/dati-cliente') {
          const onboardingUrl = new URL('/dashboard/dati-cliente', request.url);
          const response = NextResponse.redirect(onboardingUrl);
          response.headers.set('X-Request-ID', requestId);
          return response;
        }
      }
    }
  } catch (error: any) {
    // Fail-closed: se errore query → assume onboarding non completato → redirect a onboarding
    if (pathname !== '/dashboard/dati-cliente' && pathname !== '/login' && !pathname.startsWith('/api/auth')) {
      const onboardingUrl = new URL('/dashboard/dati-cliente', request.url);
      const response = NextResponse.redirect(onboardingUrl);
      response.headers.set('X-Request-ID', requestId);
      return response;
    }
  }
}
```

**Funzionalità**:
- ✅ Controlla onboarding per utenti autenticati
- ✅ Blocca accesso a `/` (home) se onboarding non completato
- ✅ Blocca accesso a `/dashboard` se onboarding non completato
- ✅ Redirect server-side (non bypassabile)
- ✅ Fail-closed (se errore query → assume onboarding non completato)

### File 2: `app/auth/callback/page.tsx` - Rimuove Redirect Client-Side

**Rimosso `window.location.href`** (linee 134-138):

```typescript
// PRIMA:
window.location.href = finalRedirect;

// DOPO:
// ⚠️ P0 FIX: Rimuove redirect client-side - middleware gestisce redirect server-authoritative
// Dopo signIn(), il middleware controllerà onboarding e farà redirect appropriato
console.log('🔄 [AUTH CALLBACK] Refresh per triggerare middleware (redirect server-authoritative)');
router.refresh();

// Redirect minimo a /dashboard - middleware intercetterà e farà redirect a onboarding se necessario
// Usa router.push invece di window.location.href per permettere a middleware di intercettare
router.push('/dashboard');
```

**Funzionalità**:
- ✅ Rimuove redirect client-side
- ✅ Usa `router.push('/dashboard')` per permettere a middleware di intercettare
- ✅ Middleware gestisce redirect server-side

---

## 🎯 Flusso Corretto Post-Refactor

### Step 1: Email Confirmation
- Supabase reindirizza a `/auth/callback#access_token=...`

### Step 2: `/auth/callback` (Client)
- Estrae token, imposta sessione Supabase
- Chiama `/api/auth/supabase-callback`
- Fa `signIn('credentials', { redirect: false })`
- **NON fa redirect client-side** - solo `router.push('/dashboard')`

### Step 3: Middleware (Server-Authoritative) ⭐ **GATE PRINCIPALE**
- Verifica autenticazione → sessione presente
- **Controlla onboarding** → query database con `findUserByEmail()`
- Se onboarding non completato:
  - **Blocca accesso a `/`** → redirect server-side a `/dashboard/dati-cliente`
  - **Blocca accesso a `/dashboard`** → redirect server-side a `/dashboard/dati-cliente`
- Se onboarding completato → passa

### Step 4: Layout Dashboard (Backup)
- Controlla onboarding come backup (già implementato)
- Se middleware fallisce, layout intercetta

---

## ✅ Vantaggi

1. **Server-authoritative**: Middleware controlla onboarding PRIMA del render
2. **Nessun bypass client**: Redirect server-side non può essere bypassato
3. **Deterministico**: Sempre eseguito, nessuna race condition
4. **Fail-closed**: Se errore query → assume onboarding non completato
5. **Blocca home**: Utente autenticato ma onboarding non completato → redirect a onboarding
6. **Doppia protezione**: Middleware + Layout dashboard

---

## 📝 Note Implementazione

1. **Import dinamico**: `findUserByEmail` importato dinamicamente per evitare problemi Edge Runtime
2. **Fail-closed**: Se errore query → assume onboarding non completato
3. **Evita loop**: Controlla `pathname !== '/dashboard/dati-cliente'` prima di redirect
4. **Test user**: Bypass per `test@spediresicuro.it`
5. **Performance**: Query database in middleware aggiunge latenza, ma garantisce sicurezza

---

## ✅ Status

**Fix implementato**: ✅
**Build passato**: ✅
**Pronto per test**: ✅

**File modificati**:
1. `middleware.ts` - Gate onboarding server-authoritative
2. `app/auth/callback/page.tsx` - Rimuove redirect client-side

