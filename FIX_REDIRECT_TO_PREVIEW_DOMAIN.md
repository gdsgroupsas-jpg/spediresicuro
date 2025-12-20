# 🔧 FIX P0 - Redirect a Preview Domain invece di Callback

## 🔴 PROBLEMA IDENTIFICATO

**URL email ricevuta**:
```
https://pxwmposcsvsusjxdjues.supabase.co/auth/v1/verify?token=...&type=signup&redirect_to=https://spediresicuro-gdsgroupsas-6132s-projects.vercel.app/
```

**Problema**:
- ❌ Usa **preview domain** (`...projects.vercel.app`)
- ❌ Punta a **root** (`/`) invece di `/auth/callback`
- ❌ Ignora `emailRedirectTo` passato in `signUp()`

**Template email**: ✅ **CORRETTO** - Usa `{{ .ConfirmationURL }}`

---

## 🔍 ROOT CAUSE

Il problema NON è nel template email (che è corretto).

Il problema è che:
1. `NEXT_PUBLIC_APP_URL` potrebbe non essere configurato in Vercel
2. In preview, Vercel usa `VERCEL_URL` (preview domain) invece del dominio canonico
3. Se `NEXT_PUBLIC_APP_URL` non è configurato, il codice usa fallback che potrebbe essere preview domain

---

## ✅ FIX IMPLEMENTATO

### File: `app/api/auth/register/route.ts` (linee 72-77)

**Prima**:
```typescript
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const callbackUrl = `${baseUrl}/auth/callback`;
```

**Dopo**:
```typescript
// ⚠️ P0 FIX: Forza dominio canonico (produzione) anche in preview per garantire redirect corretto
// NON usare VERCEL_URL (preview domain) per emailRedirectTo - causa redirect a root invece che callback
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                (process.env.NODE_ENV === 'production' ? 'https://spediresicuro.vercel.app' : 'http://localhost:3000');
const callbackUrl = `${baseUrl}/auth/callback`;

console.log('🔗 [REGISTER] emailRedirectTo configurato:', {
  baseUrl,
  callbackUrl,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NODE_ENV: process.env.NODE_ENV,
});
```

**Motivazione**:
- Forza uso dominio canonico anche in preview
- Evita che `emailRedirectTo` usi preview domain
- Garantisce redirect a `/auth/callback` invece di `/`

---

## 🔧 VERIFICA VARIABILE AMBIENTE VERCEL

### Azione Richiesta

1. Vai a Vercel Dashboard → Settings → Environment Variables
2. Verifica `NEXT_PUBLIC_APP_URL`:
   ```
   NEXT_PUBLIC_APP_URL=https://spediresicuro.vercel.app
   ```
3. Se non presente, aggiungi:
   - **Key**: `NEXT_PUBLIC_APP_URL`
   - **Value**: `https://spediresicuro.vercel.app`
   - **Environment**: Production, Preview, Development (tutti)
4. **Redeploy** dopo modifica

---

## 🧪 TEST POST-FIX

### Test 1: Verifica URL Email

1. Signup nuovo utente: `testspediresicuro+missionec78@gmail.com`
2. Apri email ricevuta
3. **Tasto destro** → **copia link** (PRIMA di cliccare)
4. Verifica che `redirect_to` contenga:
   - ✅ `spediresicuro.vercel.app` (dominio canonico)
   - ✅ `/auth/callback` (path callback)
   - ❌ NON `projects.vercel.app` (preview domain)
   - ❌ NON `/` (root)

**URL atteso**:
```
https://pxwmposcsvsusjxdjues.supabase.co/auth/v1/verify?token=...&type=signup&redirect_to=https://spediresicuro.vercel.app/auth/callback
```

### Test 2: Verifica Redirect Dopo Click

1. Click link email
2. Verifica URL intermedio: `/auth/callback#access_token=...`
3. Verifica redirect finale: `/dashboard/dati-cliente` (utente nuovo)

---

## 📤 OUTPUT ATTESO

**Esito**: [PASS / FAIL]

**URL copiato dopo fix**:
```
[Incolla qui]
```

**Criterio PASS**:
- ✅ `redirect_to` contiene `spediresicuro.vercel.app/auth/callback`
- ❌ NON contiene `projects.vercel.app` o `/`

---

## ✅ RISULTATO ATTESO

Dopo fix:
- ✅ `emailRedirectTo` usa sempre dominio canonico
- ✅ Redirect a `/auth/callback` invece di `/`
- ✅ Template email corretto (già verificato)
- ✅ Missione C - Step redirect post-confirm: **PASS**

