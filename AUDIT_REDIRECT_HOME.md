# 🔍 AUDIT - Redirect a Home "/" Dopo Email Confirmation

## 🔴 PROBLEMA IDENTIFICATO

Dopo conferma email, l'utente atterra su "/" (home) invece che su "/auth/callback".

**Root Cause Sospetta**:
1. Template email Supabase non usa `{{ .ConfirmationURL }}` correttamente
2. `emailRedirectTo` in `/api/auth/register` potrebbe non essere rispettato
3. Supabase potrebbe usare Site URL come fallback se Redirect URL non matcha

---

## 📋 ANALISI FLUSSO ATTUALE

### Step 1: Signup
- `/api/auth/register` chiama `supabase.auth.signUp()` con:
  ```typescript
  emailRedirectTo: `${baseUrl}/auth/callback`
  ```

### Step 2: Email Template Supabase
- Supabase genera link email usando template "Confirm signup"
- **PROBLEMA**: Se template usa `{{ .SiteURL }}` invece di `{{ .ConfirmationURL }}`, il link potrebbe puntare a Site URL (che è "/" o dominio base)

### Step 3: Click Link Email
- Utente clicca link email
- **ATTESO**: Redirect a `/auth/callback#access_token=...`
- **REALE**: Redirect a "/" o altro URL

### Step 4: `/auth/callback` (se raggiunto)
- Legge `window.location.hash`
- Estrae token
- Imposta sessione Supabase
- Chiama `/api/auth/supabase-callback`
- Riceve `redirectTo`
- Fa `router.push(redirectTo)`

---

## 🔍 PUNTI DI VERIFICA

### 1. Template Email Supabase

**Verifica necessaria**:
- Template "Confirm signup" deve usare `{{ .ConfirmationURL }}`
- NON deve usare `{{ .SiteURL }}` hardcoded

**Se usa `{{ .SiteURL }}`**:
- Link email punterà a Site URL (es. `https://spediresicuro.vercel.app`)
- Non userà `emailRedirectTo` passato in `signUp()`

### 2. Configurazione Supabase

**Site URL**:
- Dovrebbe essere: `https://spediresicuro.vercel.app`
- NON: `https://spediresicuro.vercel.app/auth/callback`

**Redirect URLs**:
- Deve includere: `https://spediresicuro.vercel.app/auth/callback`
- Deve includere: `https://spediresicuro.vercel.app/auth/callback/**`

### 3. Codice `/auth/callback`

**Verifica**:
- Gestisce correttamente hash?
- Fa redirect deterministico?
- Ha fallback a "/"?

---

## ✅ FIX NECESSARI

### Fix 1: Verificare Template Email Supabase

**Azione**: Verificare in Supabase Dashboard che template "Confirm signup" usi:
```
{{ .ConfirmationURL }}
```

**NON**:
```
{{ .SiteURL }}/auth/callback
```

### Fix 2: Assicurare `emailRedirectTo` Corretto

**File**: `app/api/auth/register/route.ts`

**Verifica**:
- `baseUrl` è corretto?
- `callbackUrl` include `/auth/callback`?

### Fix 3: Fallback Fail-Safe in `/auth/callback`

**File**: `app/auth/callback/page.tsx`

**Verifica**:
- Se hash non presente, redirect a `/login` (non "/")
- Se errore, redirect a `/login` (non "/")
- Nessun fallback a "/"

---

## 🧪 QA CHECKLIST

1. ✅ Signup nuovo utente
2. ✅ Verifica email ricevuta
3. ✅ Verifica link email contiene `/auth/callback`
4. ✅ Click link email → atterra su `/auth/callback#access_token=...`
5. ✅ URL viene pulito (hash rimosso)
6. ✅ Redirect a `/dashboard/dati-cliente` se onboarding incompleto
7. ✅ Redirect a `/dashboard` se onboarding completato
8. ❌ **NON** atterra mai su "/"

