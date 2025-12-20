# 🔧 FIX P0 - Template Email Supabase (CRITICO)

## 🔴 PROBLEMA IDENTIFICATO

**Sintomo**: Dopo click su "Confirm your signup", utente viene reindirizzato a "/" invece che a "/auth/callback".

**Root Cause**: Template email Supabase "Confirm signup" probabilmente usa `{{ .SiteURL }}` invece di `{{ .ConfirmationURL }}`.

**Conseguenza**: 
- `emailRedirectTo` passato in `signUp()` viene **IGNORATO**
- Link email punta a Site URL (es. `https://spediresicuro.vercel.app`)
- Utente atterra su "/" invece che su "/auth/callback"
- Codice in `/auth/callback` **NON viene eseguito**

**Priorità**: P0 - Blocca Missione C

---

## ✅ VERIFICA CODICE (GIÀ CORRETTO)

### File: `app/api/auth/register/route.ts` (linee 72-84)

**Codice attuale**:
```typescript
// ⚠️ CRITICO: emailRedirectTo deve puntare a /auth/callback per pulire URL
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const callbackUrl = `${baseUrl}/auth/callback`;

const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
  email: email.toLowerCase().trim(),
  password: password,
  options: {
    data: {
      name: name.trim(),
      full_name: name.trim(),
    },
    emailRedirectTo: callbackUrl, // ✅ CORRETTO: Punto a /auth/callback
  },
});
```

**Status**: ✅ **CODICE CORRETTO** - `emailRedirectTo` punta a `/auth/callback`

**Problema**: Se template email usa `{{ .SiteURL }}`, questo valore viene **IGNORATO**.

---

## 🔧 FIX OBBLIGATORIO - TEMPLATE EMAIL SUPABASE

### Step 1: Accedi a Supabase Dashboard

1. Vai a: https://supabase.com/dashboard
2. Seleziona progetto SpedireSicuro
3. Vai a: **Authentication** → **Email Templates**
4. Apri template: **"Confirm signup"**

### Step 2: Verifica Link di Conferma

**Cerca nel template** il link/bottone di conferma email.

**❌ ERRATO** (causa il problema):
```html
<a href="{{ .SiteURL }}">Confirm your signup</a>
```
```html
<a href="{{ .SiteURL }}/auth/callback">Confirm your signup</a>
```
```html
<a href="https://spediresicuro.vercel.app/auth/callback">Confirm your signup</a>
```

**✅ CORRETTO** (usa `emailRedirectTo`):
```html
<a href="{{ .ConfirmationURL }}">Confirm your signup</a>
```

### Step 3: Correggi Template (se necessario)

**Se il template usa `{{ .SiteURL }}`**:

1. Trova il link di conferma nel template
2. Sostituisci:
   ```html
   <!-- PRIMA (ERRATO) -->
   <a href="{{ .SiteURL }}">Confirm your signup</a>
   
   <!-- DOPO (CORRETTO) -->
   <a href="{{ .ConfirmationURL }}">Confirm your signup</a>
   ```
3. **Salva modifiche**

### Step 4: Verifica Template Completo

**Esempio template corretto**:
```html
<h2>Confirm your signup</h2>
<p>Click the link below to confirm your email address:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your signup</a></p>
```

**Variabili disponibili**:
- ✅ `{{ .ConfirmationURL }}` - URL completo di conferma (include `emailRedirectTo`)
- ❌ `{{ .SiteURL }}` - Solo dominio base (NON include path personalizzato)
- ⚠️ `{{ .RedirectTo }}` - Deprecato, usa `{{ .ConfirmationURL }}`

---

## 🧪 TEST REALE OBBLIGATORIO

### Test 1: Verifica Link Email

1. **Signup nuovo utente**:
   - Apri browser in **Incognito**
   - Vai a `/login`
   - Fai signup con email nuova (alias Gmail OK)

2. **Apri email ricevuta**:
   - Controlla inbox (e spam se necessario)
   - Apri email "Confirm your signup"

3. **Verifica link**:
   - **Tasto destro** sul bottone/link "Confirm your signup"
   - **Copia link** (o "Inspect element" → copia href)

4. **Analizza URL**:
   ```
   ✅ PASS: https://spediresicuro.vercel.app/auth/callback?token=...&type=signup
   ❌ FAIL: https://spediresicuro.vercel.app?token=...&type=signup
   ```

5. **Criterio PASS/FAIL**:
   - ✅ **PASS**: URL contiene `/auth/callback`
   - ❌ **FAIL**: URL NON contiene `/auth/callback` (punta a "/")

### Test 2: Verifica Redirect Dopo Click

**Solo se Test 1 è PASS**:

1. **Click link email**
2. **Verifica URL browser**:
   - ✅ Deve atterrare su: `/auth/callback#access_token=...&refresh_token=...&type=signup`
   - ❌ NON deve atterrare su: `/` o `/dashboard` direttamente

3. **Verifica processing**:
   - ✅ Hash viene rimosso dopo processing
   - ✅ Redirect a `/dashboard/dati-cliente` se onboarding incompleto
   - ✅ Redirect a `/dashboard` se onboarding completato

---

## 📋 CONFIGURAZIONE SUPABASE (VERIFICA)

### Site URL

**Configurazione corretta**:
```
Site URL: https://spediresicuro.vercel.app
```

**NON**:
```
Site URL: https://spediresicuro.vercel.app/auth/callback
```

### Redirect URLs

**Devono includere**:
```
https://spediresicuro.vercel.app/auth/callback
https://spediresicuro.vercel.app/auth/callback/**
```

**Per preview Vercel** (opzionale ma consigliato):
```
https://spediresicuro-*-gdsgroupsas-6132s-projects.vercel.app/auth/callback
https://spediresicuro-*-gdsgroupsas-6132s-projects.vercel.app/auth/callback/**
```

---

## ✅ CHECKLIST COMPLETA

### Pre-Fix

- [ ] Verificato codice `emailRedirectTo` in `/api/auth/register` (✅ già corretto)
- [ ] Acceduto a Supabase Dashboard → Authentication → Email Templates
- [ ] Aperto template "Confirm signup"
- [ ] Verificato che link usa `{{ .ConfirmationURL }}` (NON `{{ .SiteURL }}`)

### Fix (se necessario)

- [ ] Corretto template per usare `{{ .ConfirmationURL }}`
- [ ] Salvato modifiche template
- [ ] Verificato Site URL: `https://spediresicuro.vercel.app`
- [ ] Verificato Redirect URLs includono `/auth/callback`

### Test Post-Fix

- [ ] Signup nuovo utente con email test
- [ ] Email ricevuta entro 5 minuti
- [ ] Link email contiene `/auth/callback` (tasto destro → copia link)
- [ ] Click link → atterra su `/auth/callback#access_token=...`
- [ ] Hash viene rimosso dopo processing
- [ ] Redirect a `/dashboard/dati-cliente` se onboarding incompleto
- [ ] Redirect a `/dashboard` se onboarding completato
- [ ] ❌ **NON** atterra mai su "/"

---

## 🎯 RISULTATO ATTESO

Dopo correzione template:
- ✅ Link email punta sempre a `/auth/callback`
- ✅ Utente atterra sempre su `/auth/callback` (non "/")
- ✅ Codice in `/auth/callback` viene eseguito correttamente
- ✅ Redirect deterministico a `/dashboard/dati-cliente` o `/dashboard`
- ✅ Missione C - Step redirect post-confirm: **PASS**

---

## ⚠️ NOTA CRITICA

**Se il template usa `{{ .SiteURL }}`**:
- Il link email punterà sempre a Site URL (es. `https://spediresicuro.vercel.app`)
- `emailRedirectTo` passato in `signUp()` viene **IGNORATO**
- Utente atterrerà su "/" invece che su "/auth/callback"
- Codice in `/auth/callback` **NON viene eseguito**

**Soluzione**: Usare sempre `{{ .ConfirmationURL }}` nel template.

---

## 📚 DOCUMENTAZIONE RIFERIMENTO

- `VERIFICA_TEMPLATE_EMAIL_SUPABASE.md` - Guida dettagliata template
- `RACCOMANDAZIONI_CONFIGURAZIONE_SUPABASE.md` - Configurazione URL
- `REPORT_FIX_REDIRECT_HOME.md` - Report completo problema

