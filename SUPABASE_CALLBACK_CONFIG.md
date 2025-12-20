# ⚙️ Configurazione Supabase Auth Callback - Auto-login Post Conferma

## 📋 Modifiche Implementate

Implementato callback `/auth/callback` per gestire auto-login dopo conferma email:
- Imposta sessione Supabase dai token nel hash
- Sincronizza con NextAuth usando token temporaneo
- Pulisce URL da token (nessun token visibile)
- Redirect automatico a `/dashboard` (o `/dashboard/dati-cliente` se onboarding necessario)
- Feedback chiaro: "Email confermata ✅ Accesso effettuato"

## 🔧 File Modificati

### 1. `app/auth/callback/page.tsx`
**Motivazione**: Gestisce auto-login dopo conferma email, sincronizza Supabase con NextAuth, pulisce URL.

**Funzionalità**:
- Legge `window.location.hash` per token Supabase (`access_token`, `refresh_token`)
- Imposta sessione Supabase usando `supabase.auth.setSession()`
- Richiede token temporaneo da `/api/auth/supabase-callback`
- Usa token temporaneo come password per `signIn('credentials')` NextAuth
- Pulisce URL (rimuove hash) prima del login
- Redirect automatico a `/dashboard` (o `/dashboard/dati-cliente` se onboarding necessario)
- Mostra feedback: "Email confermata ✅ Accesso effettuato"

### 2. `app/api/auth/supabase-callback/route.ts` (NUOVO)
**Motivazione**: Genera token temporaneo per auto-login NextAuth dopo verifica token Supabase.

**Funzionalità**:
- Verifica token Supabase (`accessToken`, `refreshToken`)
- Verifica che email sia confermata
- Sincronizza record in tabella `users` (idempotente)
- Genera token temporaneo valido 60 secondi (formato: `SUPABASE_TOKEN:{accessToken}:{timestamp}`)
- Determina redirect (`/dashboard` o `/dashboard/dati-cliente`)
- Restituisce token temporaneo e redirect

### 3. `lib/database.ts`
**Motivazione**: Riconosce token temporaneo Supabase per bypassare verifica password in auto-login.

**Cambiamenti**:
- `verifyUserCredentials()` verifica se password inizia con `SUPABASE_TOKEN:`
- Se token temporaneo: verifica token Supabase, verifica email confermata, restituisce utente
- Token valido solo 60 secondi (timestamp check)
- Bypassa verifica password normale per questo caso specifico

### 3. `app/api/auth/register/route.ts`
**Motivazione**: Configura `emailRedirectTo` per puntare a `/auth/callback`.

**Cambiamenti**:
- `emailRedirectTo` = `${baseUrl}/auth/callback`
- Supabase reindirizza a `/auth/callback` dopo conferma email

## ⚙️ Configurazione Supabase Richiesta

### Dashboard Supabase → Authentication → URL Configuration

1. **Site URL**:
   ```
   https://spediresicuro.vercel.app/auth/callback
   ```
   Oppure per sviluppo:
   ```
   http://localhost:3000/auth/callback
   ```

2. **Redirect URLs** (aggiungi entrambe):
   ```
   https://spediresicuro.vercel.app/auth/callback
   https://spediresicuro.vercel.app/auth/callback/**
   ```
   Per sviluppo:
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/auth/callback/**
   ```

### Come Configurare

1. Vai su: https://supabase.com/dashboard/project/[PROJECT_ID]/auth/url-configuration
2. **Site URL**: Imposta a `https://spediresicuro.vercel.app/auth/callback`
3. **Redirect URLs**: Aggiungi:
   - `https://spediresicuro.vercel.app/auth/callback`
   - `https://spediresicuro.vercel.app/auth/callback/**`
4. Salva

## 🔐 Flusso Completo

### Dopo Click Link Email (Auto-login)

1. **Utente clicca link conferma email** → Supabase reindirizza a `/auth/callback#access_token=...&refresh_token=...&type=signup`
2. **`/auth/callback` legge hash** → Estrae `access_token` e `refresh_token`
3. **Imposta sessione Supabase** → `supabase.auth.setSession({ access_token, refresh_token })`
4. **Richiede token temporaneo** → `POST /api/auth/supabase-callback` con token Supabase
5. **API verifica token** → Verifica token Supabase, verifica email confermata, sincronizza `users`
6. **API genera token temporaneo** → `SUPABASE_TOKEN:{accessToken}:{timestamp}` (valido 60s)
7. **Pulisce URL** → `window.history.replaceState()` rimuove hash (URL pulito)
8. **Auto-login NextAuth** → `signIn('credentials', { email, password: tempToken })`
9. **NextAuth verifica token** → `verifyUserCredentials()` riconosce token temporaneo e bypassa password
10. **Redirect dashboard** → `/dashboard` (o `/dashboard/dati-cliente` se onboarding necessario)
11. **Feedback utente** → "Email confermata ✅ Accesso effettuato"

### Vantaggi

- ✅ **URL pulito**: Nessun token visibile nell'URL
- ✅ **Auto-login**: Utente loggato automaticamente dopo conferma
- ✅ **Sicurezza**: Token temporaneo valido solo 60 secondi, verifica token Supabase
- ✅ **Sincronizzazione**: Supabase Auth e NextAuth sincronizzati
- ✅ **UX fluida**: Nessun passaggio manuale, redirect diretto a dashboard
1. Utente clicca link in email di conferma
2. Supabase conferma email → `email_confirmed_at` valorizzato
3. Supabase reindirizza a: `https://spediresicuro.vercel.app/auth/callback#access_token=...&refresh_token=...&type=signup`
4. `/auth/callback` legge hash, pulisce URL
5. Redirect a: `/login?confirmed=1`
6. `/login` mostra: "Email confermata con successo! Ora puoi accedere."
7. URL finale: `/login` (pulito, senza token)

## ✅ Checklist QA (Incognito - Produzione)

### Test Auto-login Post Conferma Email
1. **Registrazione**:
   - [ ] Apri browser in modalità incognito
   - [ ] Vai su `https://spediresicuro.vercel.app/login`
   - [ ] Registra nuovo utente (email+password)
   - [ ] **VERIFICA**: Messaggio mostra "Ti abbiamo inviato una email di conferma..."
   - [ ] **VERIFICA**: Nessun accesso immediato (non si vede dashboard)

2. **Conferma Email**:
   - [ ] Apri email di conferma (controlla anche spam)
   - [ ] Clicca link "Confirm your signup"
   - [ ] **VERIFICA**: Redirect a `/auth/callback` (breve, non visibile)
   - [ ] **VERIFICA**: Messaggio mostra "Email confermata ✅ Accesso effettuato"
   - [ ] **VERIFICA**: URL finale è `/dashboard` (o `/dashboard/dati-cliente` se onboarding necessario)
   - [ ] **VERIFICA**: Nessun token visibile nell'URL (nessun `#access_token`, nessun `#refresh_token`)
   - [ ] **VERIFICA**: Utente è loggato automaticamente (vede dashboard)

3. **URL Pulito**:
   - [ ] Dopo conferma, verifica URL browser
   - [ ] **VERIFICA**: URL è pulito: `/dashboard` o `/dashboard/dati-cliente`
   - [ ] **VERIFICA**: Nessun hash (`#`) nell'URL
   - [ ] **VERIFICA**: Nessun parametro query token nell'URL

4. **Sessione Attiva**:
   - [ ] **VERIFICA**: Dashboard carica correttamente
   - [ ] **VERIFICA**: Utente può navigare tra pagine
   - [ ] **VERIFICA**: Refresh pagina mantiene sessione
   - [ ] **VERIFICA**: Logout funziona correttamente

## 🐛 Troubleshooting

### Redirect non funziona
- Verifica Site URL in Supabase = `/auth/callback`
- Verifica Redirect URLs includono `/auth/callback` e `/auth/callback/**`
- Verifica `NEXT_PUBLIC_APP_URL` in variabili ambiente

### Token ancora visibile nell'URL
- Verifica che `/auth/callback` esegua `window.history.replaceState()`
- Controlla console browser per errori JavaScript

### Messaggio "Email confermata" non appare
- Verifica che parametro `confirmed=1` sia presente in URL
- Controlla che `/login` legga parametro correttamente

