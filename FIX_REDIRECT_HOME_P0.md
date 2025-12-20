# 🔧 FIX P0 - Redirect a Home "/" Dopo Email Confirmation

## 🔴 ROOT CAUSE IDENTIFICATA

**Problema**: Dopo conferma email, utente atterra su "/" invece che su "/auth/callback".

**Root Cause**:
1. **Template Email Supabase**: Potrebbe usare `{{ .SiteURL }}` invece di `{{ .ConfirmationURL }}`
2. **Configurazione Supabase**: Site URL potrebbe essere configurato come "/" o non includere `/auth/callback` nelle Redirect URLs
3. **Fallback nel codice**: Nessun fallback esplicito a "/" trovato, ma Supabase potrebbe reindirizzare a Site URL se Redirect URL non matcha

**Priorità**: P0 - Blocca onboarding obbligatorio

---

## ✅ FIX IMPLEMENTATI

### Fix 1: Fail-Safe in `/auth/callback` (Client-Side)

**File**: `app/auth/callback/page.tsx`

**Modifiche**:
1. **Linea 34-38**: Se hash non contiene token → redirect a `/login?error=no_token` (NON "/")
2. **Linea 144-152**: Se errore → rimuove hash e redirect a `/login?error=callback_failed` (NON "/")

**Codice**:
```typescript
// Se hash non contiene token
if (!hasAccessToken && !hasRefreshToken && !isSignup) {
  console.error('❌ [AUTH CALLBACK] Nessun token rilevato nel hash, redirect a /login');
  // ⚠️ P0: Fail-safe - redirect a /login (NON "/") se hash non contiene token
  router.replace('/login?error=no_token');
  return;
}

// In caso di errore
catch (error: any) {
  // ⚠️ P0: Fail-safe - redirect a /login (NON "/") in caso di errore
  // Rimuove hash prima di redirect per evitare loop
  window.history.replaceState({}, document.title, window.location.pathname);
  setTimeout(() => {
    router.replace('/login?error=callback_failed');
  }, 2000);
}
```

**Motivazione**:
- Garantisce che anche in caso di errore, l'utente non atterri su "/"
- Redirect a `/login` è più sicuro e permette all'utente di riprovare

---

## 🔍 VERIFICHE NECESSARIE (MANUALI)

### 1. Template Email Supabase

**Azione richiesta**:
1. Vai a Supabase Dashboard → Authentication → Email Templates
2. Apri template "Confirm signup"
3. Verifica che il link usi:
   ```
   {{ .ConfirmationURL }}
   ```
4. **NON** deve usare:
   ```
   {{ .SiteURL }}/auth/callback
   ```

**Se usa `{{ .SiteURL }}`**:
- Modifica template per usare `{{ .ConfirmationURL }}`
- Salva modifiche

### 2. Configurazione Supabase URL

**Azione richiesta**:
1. Vai a Supabase Dashboard → Authentication → URL Configuration
2. Verifica **Site URL**:
   ```
   https://spediresicuro.vercel.app
   ```
   (NON `/auth/callback`)
3. Verifica **Redirect URLs** includono:
   ```
   https://spediresicuro.vercel.app/auth/callback
   https://spediresicuro.vercel.app/auth/callback/**
   ```

### 3. Variabile Ambiente Vercel

**Azione richiesta**:
1. Vai a Vercel Dashboard → Settings → Environment Variables
2. Verifica `NEXT_PUBLIC_APP_URL`:
   ```
   NEXT_PUBLIC_APP_URL=https://spediresicuro.vercel.app
   ```

---

## 🧪 QA CHECKLIST

### Test 1: Signup e Email Confirmation

1. ✅ Apri browser in **Incognito**
2. ✅ Vai a `/login`
3. ✅ Fai signup con email nuova
4. ✅ Verifica email ricevuta
5. ✅ **VERIFICA LINK EMAIL**: Deve contenere `/auth/callback` (non "/")
6. ✅ Click link email
7. ✅ **VERIFICA URL**: Deve atterrare su `/auth/callback#access_token=...` (NON "/")
8. ✅ Verifica hash viene rimosso dopo processing
9. ✅ Verifica redirect a `/dashboard/dati-cliente` se onboarding incompleto
10. ✅ Verifica redirect a `/dashboard` se onboarding completato
11. ❌ **NON** deve atterrare mai su "/"

### Test 2: Errore Hash Mancante

1. ✅ Vai manualmente a `/auth/callback` (senza hash)
2. ✅ Verifica redirect a `/login?error=no_token` (NON "/")

### Test 3: Errore Processing

1. ✅ Simula errore in `/auth/callback` (es. token invalido)
2. ✅ Verifica redirect a `/login?error=callback_failed` (NON "/")

---

## 📋 FILE MODIFICATI

1. **`app/auth/callback/page.tsx`**
   - Linea 34-38: Fail-safe se hash non contiene token
   - Linea 144-152: Fail-safe in caso di errore

---

## ✅ RISULTATO ATTESO

Dopo i fix:
- ✅ Link email punta sempre a `/auth/callback`
- ✅ Utente atterra sempre su `/auth/callback` (non "/")
- ✅ In caso di errore, redirect a `/login` (non "/")
- ✅ Redirect deterministico a `/dashboard/dati-cliente` o `/dashboard`

---

## ⚠️ NOTE IMPORTANTI

1. **Template Email**: La verifica del template email Supabase è **MANUALE** e richiede accesso a Supabase Dashboard
2. **Configurazione Supabase**: Le modifiche a Site URL e Redirect URLs richiedono accesso a Supabase Dashboard
3. **Variabile Ambiente**: La verifica di `NEXT_PUBLIC_APP_URL` richiede accesso a Vercel Dashboard

**Se il problema persiste dopo i fix del codice**:
- Verificare template email Supabase
- Verificare configurazione Supabase URL
- Verificare variabile ambiente Vercel

