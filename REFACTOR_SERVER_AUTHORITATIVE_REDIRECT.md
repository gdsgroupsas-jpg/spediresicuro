# 🔧 REFACTOR: Server-Authoritative Redirect Post-Auth

## 📋 Analisi Problema Attuale

### Flusso Attuale (PROBLEMATICO):

1. **Email confirmation** → `/auth/callback` (client-side)
2. **Client fa `signIn()`** → NextAuth crea sessione
3. **Client fa `window.location.href = redirectTo`** → Redirect client-side
4. **Middleware** → Controlla solo autenticazione, passa se sessione presente
5. **Layout dashboard** → Controlla onboarding, ma viene eseguito DOPO redirect client
6. **Problema**: Se client fa redirect a `/` (home), middleware passa perché `/` è route pubblica

### Root Cause:

- **Redirect è client-side**: `window.location.href` in `/auth/callback`
- **Middleware NON controlla onboarding**: Controlla solo autenticazione
- **Route `/` è pubblica**: Middleware passa senza controllare onboarding
- **Race condition**: Client redirect può arrivare prima del controllo server

---

## ✅ Soluzione: Middleware Server-Authoritative

### Strategia:

1. **Middleware controlla onboarding** per utenti autenticati
2. **Redirect server-side** invece di client-side
3. **Blocca accesso a `/`** se utente autenticato ma onboarding non completato
4. **Rimuove `window.location.href`** da `/auth/callback`

### Architettura:

```
Email Confirmation → /auth/callback → signIn() → Middleware → Redirect Server-Side
                                                              ↓
                                              Se onboarding_completed = false
                                                              ↓
                                              Redirect a /dashboard/dati-cliente
```

---

## 🔧 Implementazione

### File 1: `middleware.ts` - Gate Onboarding Server-Authoritative

**Aggiungere controllo onboarding dopo autenticazione**:

```typescript
// Dopo verifica autenticazione (linea 106)
const session = await auth();

if (session?.user?.email) {
  // ⚠️ P0: Controllo onboarding server-authoritative
  try {
    const { findUserByEmail } = await import('@/lib/database');
    const user = await findUserByEmail(session.user.email);
    
    const hasDatiCliente = !!user?.datiCliente;
    const datiCompletati = user?.datiCliente?.datiCompletati === true;
    const onboardingCompleted = hasDatiCliente && datiCompletati;
    
    // Se onboarding NON completato
    if (!onboardingCompleted) {
      // Blocca accesso a route pubbliche (home) se autenticato
      if (pathname === '/' || isPublicRoute(pathname)) {
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
  } catch (error) {
    // Fail-closed: se errore query → redirect a onboarding
    console.error('❌ [MIDDLEWARE] Errore verifica onboarding, fail-closed:', error);
    if (pathname !== '/dashboard/dati-cliente') {
      const onboardingUrl = new URL('/dashboard/dati-cliente', request.url);
      const response = NextResponse.redirect(onboardingUrl);
      response.headers.set('X-Request-ID', requestId);
      return response;
    }
  }
}
```

### File 2: `app/auth/callback/page.tsx` - Rimuovere Redirect Client-Side

**Rimuovere `window.location.href` e lasciare che middleware gestisca redirect**:

```typescript
// PRIMA:
window.location.href = finalRedirect;

// DOPO:
// ⚠️ P0 FIX: Rimuove redirect client-side - middleware gestisce redirect server-authoritative
// Dopo signIn(), il middleware controllerà onboarding e farà redirect appropriato
// Forza refresh per triggerare middleware
router.refresh();
// Redirect minimo a /dashboard - middleware gestirà onboarding
router.push('/dashboard');
```

**OPPURE** (meglio):
```typescript
// ⚠️ P0 FIX: Rimuove redirect client-side - middleware gestisce redirect server-authoritative
// Dopo signIn(), il middleware controllerà onboarding e farà redirect appropriato
// Non fare redirect qui - lasciare che NextAuth callback redirect gestisca
// Il middleware intercetterà e farà redirect server-side se necessario
```

### File 3: `lib/auth-config.ts` - NextAuth Callback Redirect

**Migliorare callback redirect per gestire onboarding**:

```typescript
async redirect({ url, baseUrl }: any) {
  // ... codice esistente ...
  
  // ⚠️ P0 FIX: Se URL è /dashboard e utente ha onboarding non completato,
  // il middleware gestirà il redirect - qui restituiamo /dashboard
  // Il middleware farà redirect server-side a /dashboard/dati-cliente se necessario
  
  // Se l'URL è /dashboard, mantienilo (middleware gestirà onboarding)
  if (url === '/dashboard' || url.startsWith('/dashboard')) {
    return `${finalBaseUrl}${url}`;
  }
  
  // Default: redirect a /dashboard (middleware gestirà onboarding)
  return `${finalBaseUrl}/dashboard`;
}
```

---

## 🎯 Flusso Corretto Post-Refactor

### Step 1: Email Confirmation
- Supabase reindirizza a `/auth/callback#access_token=...`

### Step 2: `/auth/callback` (Client)
- Estrae token, imposta sessione Supabase
- Chiama `/api/auth/supabase-callback`
- Fa `signIn('credentials', { redirect: false })`
- **NON fa redirect client-side** - solo `router.refresh()`

### Step 3: Middleware (Server-Authoritative)
- Verifica autenticazione → sessione presente
- **Controlla onboarding** → query database
- Se onboarding non completato → **redirect server-side a `/dashboard/dati-cliente`**
- Se onboarding completato → passa

### Step 4: NextAuth Callback Redirect (Fallback)
- Se chiamato, restituisce `/dashboard`
- Middleware intercetta e fa redirect se necessario

---

## ✅ Vantaggi

1. **Server-authoritative**: Middleware controlla onboarding PRIMA del render
2. **Nessun bypass client**: Redirect server-side non può essere bypassato
3. **Deterministico**: Sempre eseguito, nessuna race condition
4. **Fail-closed**: Se errore query → redirect a onboarding
5. **Blocca home**: Utente autenticato ma onboarding non completato → redirect a onboarding

---

## ⚠️ Considerazioni Performance

- **Query database in middleware**: Aggiunge latenza
- **Cache**: Possibile cache risultato query (ma attenzione a stale data)
- **Ottimizzazione**: Query solo per route `/dashboard` e `/`

---

## 📝 Note Implementazione

1. **Import dinamico**: `findUserByEmail` importato dinamicamente per evitare problemi Edge Runtime
2. **Fail-closed**: Se errore query → assume onboarding non completato
3. **Evita loop**: Controlla `pathname !== '/dashboard/dati-cliente'` prima di redirect
4. **Test user**: Bypass per `test@spediresicuro.it` (se necessario)

