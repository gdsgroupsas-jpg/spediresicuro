# ⚙️ Configurazione Supabase Auth Callback

## 📋 Modifiche Implementate

Implementato callback `/auth/callback` per gestire redirect Supabase dopo conferma email, pulendo URL da token.

## 🔧 File Modificati

### 1. `app/auth/callback/page.tsx` (NUOVO)
**Motivazione**: Gestisce callback Supabase dopo click link conferma email, pulisce URL da token.

**Funzionalità**:
- Legge `window.location.hash` per token Supabase
- Rimuove hash dall'URL (pulisce token)
- Redirect a `/login?confirmed=1`

### 2. `app/login/page.tsx`
**Motivazione**: Mostra messaggio successo quando email è confermata.

**Cambiamenti**:
- Legge parametro `confirmed=1` dall'URL
- Mostra banner: "Email confermata con successo! Ora puoi accedere."
- Rimuove parametro dall'URL dopo lettura

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

### Dopo Click Link Email
1. Utente clicca link in email di conferma
2. Supabase conferma email → `email_confirmed_at` valorizzato
3. Supabase reindirizza a: `https://spediresicuro.vercel.app/auth/callback#access_token=...&refresh_token=...&type=signup`
4. `/auth/callback` legge hash, pulisce URL
5. Redirect a: `/login?confirmed=1`
6. `/login` mostra: "Email confermata con successo! Ora puoi accedere."
7. URL finale: `/login` (pulito, senza token)

## ✅ Checklist QA (Incognito)

### Test Conferma Email
- [ ] Registra nuovo utente
- [ ] Apri email di conferma
- [ ] Clicca link di conferma
- [ ] **VERIFICA**: Redirect a `/auth/callback` (breve, non visibile)
- [ ] **VERIFICA**: Redirect finale a `/login?confirmed=1`
- [ ] **VERIFICA**: URL finale è `/login` (senza token, senza hash)
- [ ] **VERIFICA**: Banner mostra "Email confermata con successo! Ora puoi accedere."
- [ ] **VERIFICA**: Nessun token visibile nell'URL
- [ ] **VERIFICA**: Login funziona dopo conferma

### Test URL Pulito
- [ ] Dopo conferma, verifica URL browser
- [ ] **VERIFICA**: Nessun `#access_token` nell'URL
- [ ] **VERIFICA**: Nessun `#refresh_token` nell'URL
- [ ] **VERIFICA**: URL è pulito: `/login` o `/login?callbackUrl=...`

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

