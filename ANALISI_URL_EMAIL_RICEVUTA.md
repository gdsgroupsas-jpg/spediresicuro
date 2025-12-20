# 🔍 ANALISI URL EMAIL RICEVUTA

## 📋 URL COPIATO DALLA EMAIL

```
https://pxwmposcsvsusjxdjues.supabase.co/auth/v1/verify?token=84d90fd1f8cb9c080bdcfd60bfa0f688e8477863625f06539ae115b2&type=signup&redirect_to=https://spediresicuro-gdsgroupsas-6132s-projects.vercel.app/
```

## 🔍 ANALISI

### Template Email (✅ CORRETTO)

```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your user:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your mail</a></p>
```

**Status**: ✅ **TEMPLATE CORRETTO** - Usa `{{ .ConfirmationURL }}`

### Problema Identificato

**URL generato**:
- `redirect_to=https://spediresicuro-gdsgroupsas-6132s-projects.vercel.app/`
- ❌ Usa **preview domain** (`...projects.vercel.app`)
- ❌ Punta a **root** (`/`) invece di `/auth/callback`

**URL atteso**:
- `redirect_to=https://spediresicuro.vercel.app/auth/callback`
- ✅ Usa **dominio canonico** (`spediresicuro.vercel.app`)
- ✅ Punta a **callback** (`/auth/callback`)

---

## 🔴 ROOT CAUSE

Il problema NON è nel template email (che è corretto).

Il problema è che `emailRedirectTo` passato in `signUp()` non viene rispettato, oppure:

1. **Variabile ambiente `NEXT_PUBLIC_APP_URL` non configurata** in Vercel
2. **Vercel usa preview domain** invece del dominio canonico
3. **Supabase usa Site URL** come fallback se `redirect_to` non è valido

---

## ✅ FIX NECESSARIO

### Fix 1: Verifica Variabile Ambiente Vercel

**Azione richiesta**:
1. Vai a Vercel Dashboard → Settings → Environment Variables
2. Verifica `NEXT_PUBLIC_APP_URL`:
   ```
   NEXT_PUBLIC_APP_URL=https://spediresicuro.vercel.app
   ```
3. Se non presente o errato, aggiungi/corregi
4. **Redeploy** dopo modifica

### Fix 2: Forza Dominio Canonico nel Codice

**File**: `app/api/auth/register/route.ts`

**Modifica necessaria**:
- Forzare uso dominio canonico anche in preview
- Non usare `VERCEL_URL` per `emailRedirectTo`

---

## 🧪 TEST POST-FIX

Dopo fix:
1. Signup nuovo utente
2. Copia link email
3. Verifica che `redirect_to` contenga:
   - ✅ `spediresicuro.vercel.app` (dominio canonico)
   - ✅ `/auth/callback` (path callback)
   - ❌ NON `projects.vercel.app` (preview domain)
   - ❌ NON `/` (root)

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

