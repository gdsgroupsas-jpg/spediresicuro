# 🔍 AUDIT FINALE - Template Email Supabase (P0)

## 📋 STATO ATTUALE (PROBLEMA CONFERMATO)

### 1. Email di conferma Supabase
- ✅ Email arriva correttamente
- ✅ Link "Confirm your signup" presente

### 2. Link Email (PROBLEMA)
- ❌ Link punta a: `https://<project>.supabase.co/auth/v1/verify?...&redirect_to=https://spediresicuro-gdsgroupsas-6132s-projects.vercel.app/`
- ❌ Dopo click: utente atterra SEMPRE sulla HOME `/`
- ❌ IGNORA logica di onboarding
- ❌ IGNORA `/dashboard/dati-cliente`

### 3. Codice Backend
- ✅ `auth.signUp()` usa `emailRedirectTo: ${baseUrl}/auth/callback`
- ✅ Codice applicativo è GIÀ corretto
- ✅ Il problema NON è nel codice applicativo

### 4. Root Cause Sospetta
- ❌ Template email "Confirm signup" usa `{{ .SiteURL }}` oppure link hardcoded
- ✅ Dovrebbe usare `{{ .ConfirmationURL }}`

---

## 🔍 VERIFICA CODICE (CONFERMATA)

### File: `app/api/auth/register/route.ts` (linee 72-84)

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

**Status**: ✅ **CODICE CORRETTO**

**Problema**: Se template email usa `{{ .SiteURL }}`, questo valore viene **IGNORATO**.

---

## 🎯 OBIETTIVO TECNICO (BINARIO)

Dopo click su email:
1. ✅ URL deve essere: `/auth/callback#access_token=...`
2. ✅ Callback deve:
   - processare la sessione
   - verificare onboarding incompleto
   - redirect finale a: `/dashboard/dati-cliente`
3. ❌ MAI atterrare su `/`

---

## ✅ TASK OBBLIGATORI (ORDINE ESATTO)

### 1️⃣ AUDIT TEMPLATE EMAIL (SUPABASE DASHBOARD)

**Azione richiesta**:
1. Vai in: Supabase Dashboard → Authentication → Email Templates
2. Apri: "Confirm signup"
3. Individua il link di conferma

**Cerca nel template**:
- `{{ .SiteURL }}` (❌ ERRATO)
- `{{ .ConfirmationURL }}` (✅ CORRETTO)
- Link hardcoded (❌ ERRATO)

**Output richiesto**:
```
[Incolla qui SOLO le righe del link/bottone di conferma]
```

---

### 2️⃣ FIX TEMPLATE (SE NECESSARIO)

**Sostituisci QUALSIASI uso di**:
- `{{ .SiteURL }}`
- URL hardcoded

**Con**:
- `{{ .ConfirmationURL }}`

**ESEMPIO CORRETTO**:
```html
<a href="{{ .ConfirmationURL }}">Confirm your signup</a>
```

**Salva modifiche**.

---

### 3️⃣ VERIFICA CONFIG URL SUPABASE

**Site URL**:
- ✅ `https://spediresicuro.vercel.app`
- ❌ NON `/auth/callback`

**Redirect URLs DEVONO includere**:
- ✅ `https://spediresicuro.vercel.app/auth/callback`
- ✅ `https://spediresicuro.vercel.app/auth/callback/**`

---

### 4️⃣ TEST REALE (OBBLIGATORIO)

1. Crea nuovo utente email/password
2. Apri email ricevuta
3. **Tasto destro** → **copia link**
4. Verifica che il link contenga `/auth/callback`
5. Clicca link

---

### 5️⃣ VALIDAZIONE FINALE (BINARIA)

**PASS se**:
- ✅ URL intermedio contiene `/auth/callback#access_token=`
- ✅ Redirect finale:
  - `/dashboard/dati-cliente` (utente nuovo)
  - `/dashboard` (utente già onboarded)

**FAIL se**:
- ❌ Atterra su `/`
- ❌ Perde `access_token`
- ❌ `redirect_to` ignorato

---

## 📤 OUTPUT ATTESO

- [ ] Conferma root cause
- [ ] Conferma fix applicato (o già presente)
- [ ] Esito finale: **PASS** / **FAIL**
- [ ] Nessuna teoria
- [ ] Nessuna feature nuova
- [ ] Solo verità tecnica

---

## ⚠️ NOTA CRITICA

**QUESTO È UN BUG P0.**
**NON CHIUDERE FINCHÉ IL TEST REALE NON È PASS.**

