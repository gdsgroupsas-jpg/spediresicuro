# 🧪 TEST LINK EMAIL - Verifica Redirect Post-Confirmation

## 📋 OBIETTIVO

Verificare che il link email di conferma contenga `/auth/callback` e che il redirect funzioni correttamente.

---

## 🔍 TEST 1: Verifica Link Email (CRITICO)

### Step 1: Signup Nuovo Utente

1. Apri browser in **Incognito** (Chrome/Firefox)
2. Vai a: `https://spediresicuro.vercel.app/login`
3. Fai signup con:
   - **Email**: Usa alias Gmail (es. `tuonome+test1@gmail.com`)
   - **Password**: Minimo 8 caratteri
   - **Nome**: Test User

### Step 2: Apri Email Ricevuta

1. Controlla inbox (e spam se necessario)
2. Cerca email da: **Supabase** o **SpedireSicuro**
3. Oggetto: "Confirm your signup" o simile
4. Apri email

### Step 3: Verifica Link (METODO 1 - Tasto Destro)

1. **Tasto destro** sul bottone/link "Confirm your signup"
2. Seleziona **"Copia link"** o **"Copy link address"**
3. Incolla link in un editor di testo

**Esempio link CORRETTO**:
```
https://spediresicuro.vercel.app/auth/callback?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...&type=signup
```

**Esempio link ERRATO**:
```
https://spediresicuro.vercel.app?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...&type=signup
```

### Step 4: Verifica Link (METODO 2 - Inspect Element)

1. **Tasto destro** sul bottone/link "Confirm your signup"
2. Seleziona **"Inspect"** o **"Ispeziona elemento"**
3. Nel codice HTML, cerca `<a href="...">`
4. Copia valore di `href`

**Esempio HTML CORRETTO**:
```html
<a href="{{ .ConfirmationURL }}">Confirm your signup</a>
```

**Esempio HTML ERRATO**:
```html
<a href="{{ .SiteURL }}">Confirm your signup</a>
```

### Step 5: Criterio PASS/FAIL

**✅ PASS**:
- URL contiene `/auth/callback`
- Esempio: `https://spediresicuro.vercel.app/auth/callback?token=...&type=signup`

**❌ FAIL**:
- URL NON contiene `/auth/callback`
- Esempio: `https://spediresicuro.vercel.app?token=...&type=signup`
- **Azione**: Correggere template email Supabase (vedi `FIX_TEMPLATE_EMAIL_SUPABASE_P0.md`)

---

## 🔍 TEST 2: Verifica Redirect Dopo Click (Solo se Test 1 è PASS)

### Step 1: Click Link Email

1. **Click** sul bottone/link "Confirm your signup"
2. **Osserva URL browser** durante il redirect

### Step 2: Verifica URL Intermedio

**URL atteso immediatamente dopo click**:
```
https://spediresicuro.vercel.app/auth/callback#access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...&refresh_token=...&type=signup
```

**Caratteristiche**:
- ✅ Path: `/auth/callback`
- ✅ Hash contiene: `#access_token=...&refresh_token=...&type=signup`
- ❌ **NON** deve essere: `/` o `/dashboard`

### Step 3: Verifica Processing

1. **Attendi 2-3 secondi** (processing in corso)
2. **Osserva URL**:
   - Hash viene rimosso (URL pulito)
   - Redirect a destinazione finale

### Step 4: Verifica Destinazione Finale

**Per utente nuovo (onboarding incompleto)**:
- ✅ URL finale: `/dashboard/dati-cliente`
- ✅ Pagina mostra form "Completa i tuoi dati cliente"
- ❌ **NON** deve essere: `/` o `/dashboard`

**Per utente esistente (onboarding completato)**:
- ✅ URL finale: `/dashboard`
- ✅ Pagina mostra dashboard principale
- ❌ **NON** deve essere: `/` o `/dashboard/dati-cliente`

### Step 5: Criterio PASS/FAIL

**✅ PASS**:
- Atterra su `/auth/callback#access_token=...` (URL intermedio)
- Hash viene rimosso dopo processing
- Redirect a `/dashboard/dati-cliente` o `/dashboard` (destinazione finale)
- ❌ **NON** atterra mai su "/"

**❌ FAIL**:
- Atterra direttamente su "/" o "/dashboard" (bypass `/auth/callback`)
- Hash non viene rimosso
- Redirect a destinazione sbagliata
- **Azione**: Verificare codice in `/auth/callback` (vedi `REPORT_FIX_REDIRECT_HOME.md`)

---

## 📊 REPORT TEST

### Test 1: Link Email

- [ ] **PASS**: URL contiene `/auth/callback`
- [ ] **FAIL**: URL NON contiene `/auth/callback`

**URL copiato**:
```
[Incolla qui l'URL copiato dalla email]
```

### Test 2: Redirect Dopo Click

- [ ] **PASS**: Atterra su `/auth/callback#access_token=...`
- [ ] **FAIL**: Atterra su "/" o altro URL

**URL intermedio** (dopo click):
```
[Incolla qui l'URL dopo click su link email]
```

**URL finale** (dopo processing):
```
[Incolla qui l'URL finale dopo redirect]
```

### Risultato Finale

- [ ] **PASS**: Missione C - Step redirect post-confirm
- [ ] **FAIL**: Missione C - Step redirect post-confirm

**Note**:
```
[Eventuali note o osservazioni]
```

---

## 🔧 AZIONI CORRETTIVE

### Se Test 1 è FAIL

1. Vai a Supabase Dashboard → Authentication → Email Templates
2. Apri template "Confirm signup"
3. Verifica che link usi `{{ .ConfirmationURL }}` (NON `{{ .SiteURL }}`)
4. Correggi se necessario
5. Salva modifiche
6. Ripeti Test 1

### Se Test 2 è FAIL

1. Verifica codice in `/auth/callback/page.tsx`
2. Verifica configurazione Supabase URL (Site URL, Redirect URLs)
3. Verifica variabile ambiente `NEXT_PUBLIC_APP_URL` in Vercel
4. Ripeti Test 2

---

## 📚 DOCUMENTAZIONE RIFERIMENTO

- `FIX_TEMPLATE_EMAIL_SUPABASE_P0.md` - Fix template email
- `VERIFICA_TEMPLATE_EMAIL_SUPABASE.md` - Guida template
- `REPORT_FIX_REDIRECT_HOME.md` - Report completo problema

