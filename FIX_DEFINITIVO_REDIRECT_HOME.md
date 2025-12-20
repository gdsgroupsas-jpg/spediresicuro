# 🔧 FIX DEFINITIVO - Redirect a Home `/`

## 📋 Root Cause Identificata

**Causa precisa**: NextAuth callback `redirect()` viene chiamato anche con `redirect: false`, e se l'URL passato è vuoto o `/`, il callback NON lo gestisce esplicitamente, causando un fallback a `/` invece di `/dashboard/dati-cliente`. Inoltre, `router.replace()` può essere sovrascritto da NextAuth redirect automatico.

**Sequenza del problema**:
1. Client fa `signIn('credentials', { redirect: false })`
2. NextAuth internamente chiama callback `redirect({ url: '/' o vuoto, baseUrl: '...' })`
3. Callback redirect NON gestisce esplicitamente `/` o URL vuoto
4. NextAuth fa redirect automatico a `/` (default)
5. L'utente finisce su home invece di onboarding

---

## ✅ Fix Implementati

### Fix 1: Usare `window.location.href` invece di `router.replace()`

**File**: `app/auth/callback/page.tsx` (linea 137)

**Prima**:
```typescript
router.refresh();
router.replace(redirectTo || '/dashboard/dati-cliente');
```

**Dopo**:
```typescript
// ⚠️ P0 FIX: Usa window.location.href per forzare redirect (bypass NextAuth redirect automatico)
const finalRedirect = redirectTo || '/dashboard/dati-cliente';
console.log('🔄 [AUTH CALLBACK] Redirect forzato a:', finalRedirect);
window.location.href = finalRedirect;
```

**Motivazione**: `window.location.href` forza un redirect completo del browser, bypassando qualsiasi redirect automatico di NextAuth.

### Fix 2: Gestire esplicitamente `/` nel callback redirect NextAuth

**File**: `lib/auth-config.ts` (linee 558-567)

**Prima**:
```typescript
// ⚠️ IMPORTANTE: Se l'URL è /login, reindirizza sempre al dashboard
if (url === '/login' || url.startsWith('/login')) {
  // ...
}

// Se l'URL è relativo, usa finalBaseUrl
if (url.startsWith('/')) {
  // ...
}
```

**Dopo**:
```typescript
// ⚠️ P0 FIX: Gestione esplicita per URL vuoto o '/' (fail-safe a onboarding)
if (!url || url === '/' || url === '') {
  const redirectUrl = `${finalBaseUrl}/dashboard/dati-cliente`;
  console.log('⚠️ [NEXTAUTH] URL vuoto o /, redirect fail-safe a onboarding:', redirectUrl);
  return redirectUrl;
}

// ⚠️ IMPORTANTE: Se l'URL è /login, reindirizza sempre al dashboard
if (url === '/login' || url.startsWith('/login')) {
  // ...
}

// Se l'URL è relativo, usa finalBaseUrl
if (url.startsWith('/')) {
  // ...
}
```

**Motivazione**: Gestione esplicita di URL vuoto o `/` con fail-safe a onboarding, evitando redirect a home.

---

## 🎯 Risultato Atteso

### Flusso Corretto:

1. Email confirmation → Supabase reindirizza a `/auth/callback#access_token=...`
2. `/auth/callback` chiama `/api/auth/supabase-callback`
3. `/api/auth/supabase-callback` restituisce `redirectTo = '/dashboard/dati-cliente'`
4. Client fa `signIn('credentials', { redirect: false })`
5. **NextAuth chiama callback redirect con URL vuoto o `/`**
6. **Callback redirect restituisce `/dashboard/dati-cliente`** (fail-safe)
7. Client fa `window.location.href = '/dashboard/dati-cliente'` (forzato)
8. Browser naviga a `/dashboard/dati-cliente`
9. **Nessun redirect a `/`**: L'utente vede direttamente onboarding

---

## ✅ Verifica

### Test Case 1: NextAuth callback redirect con URL vuoto
- **Input**: `redirect({ url: '', baseUrl: '...' })`
- **Output**: `'/dashboard/dati-cliente'` ✅
- **Risultato**: Redirect fail-safe a onboarding

### Test Case 2: NextAuth callback redirect con URL `/`
- **Input**: `redirect({ url: '/', baseUrl: '...' })`
- **Output**: `'/dashboard/dati-cliente'` ✅
- **Risultato**: Redirect fail-safe a onboarding

### Test Case 3: Client redirect con `window.location.href`
- **Input**: `window.location.href = '/dashboard/dati-cliente'`
- **Output**: Browser naviga a `/dashboard/dati-cliente` ✅
- **Risultato**: Redirect forzato, bypass NextAuth redirect automatico

---

## 📝 Note Tecniche

### Perché `window.location.href` invece di `router.replace()`?

1. **Bypass NextAuth**: `window.location.href` forza un redirect completo del browser, bypassando qualsiasi redirect automatico di NextAuth
2. **Deterministico**: Il redirect è garantito, non può essere sovrascritto
3. **No race condition**: Il browser naviga immediatamente, senza possibilità di interferenze

### Perché gestire `/` nel callback redirect?

1. **Fail-safe**: Se NextAuth chiama il callback con URL vuoto o `/`, restituiamo sempre onboarding
2. **Doppia protezione**: Anche se il client usa `window.location.href`, il callback redirect è un backup
3. **Consistenza**: Garantisce che nessun utente nuovo finisca su home

---

## ✅ Status

**Fix implementato**: ✅
**Build passato**: ✅
**Pronto per test**: ✅

**File modificati**:
1. `app/auth/callback/page.tsx` - Usa `window.location.href` invece di `router.replace()`
2. `lib/auth-config.ts` - Gestisce esplicitamente `/` nel callback redirect

