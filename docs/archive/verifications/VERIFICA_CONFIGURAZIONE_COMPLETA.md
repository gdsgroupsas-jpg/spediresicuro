# ✅ Verifica Configurazione NextAuth Completa

## 🎯 Obiettivo

Verificare che NextAuth sia configurato correttamente sia in locale che su Vercel.

## 📋 Checklist Configurazione Locale (env.local)

### ✅ Variabili Obbligatorie

Verifica che nel file `env.local` ci siano queste variabili:

#### 1. NEXTAUTH_URL

```
NEXTAUTH_URL=http://localhost:3000
```

- ✅ **Corretto per sviluppo locale**
- ❌ **Sbagliato se è** `https://spediresicuro.vercel.app` (quello va solo su Vercel)

#### 2. NEXTAUTH_SECRET

```
NEXTAUTH_SECRET=SYTc2M2MyYWEtYWI4MS00YTJjLTg5YWQtNTYxZGI3YzRlMDA5NzEzYmM1ZGYtYTEzNS00NmQzLTkwZTUtOTYyNDNmMzJmZGQ0
```

- ✅ **Deve essere presente**
- ✅ **Deve essere almeno 32 caratteri** (la tua è 112 caratteri - perfetta!)
- ✅ **Non deve essere** `dev-secret-not-for-production-change-in-env-local`

#### 3. GOOGLE_CLIENT_ID

```
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

- ✅ **Deve essere presente**
- ✅ **Deve contenere** `.apps.googleusercontent.com`
- ⚠️ **Sostituisci** `YOUR_CLIENT_ID` con il tuo Client ID reale

#### 4. GOOGLE_CLIENT_SECRET

```
GOOGLE_CLIENT_SECRET=GOCSPX-YOUR_SECRET_HERE
```

- ✅ **Deve essere presente**
- ✅ **Deve iniziare con** `GOCSPX-` (per Google OAuth)
- ⚠️ **Sostituisci** `YOUR_SECRET_HERE` con il tuo Client Secret reale

---

## 📋 Checklist Configurazione Vercel

### ✅ Variabili Obbligatorie su Vercel

Vai su **Vercel Dashboard** → **Settings** → **Environment Variables** e verifica:

#### 1. NEXTAUTH_URL

- **Name:** `NEXTAUTH_URL`
- **Value:** `https://spediresicuro.vercel.app`
- **Environment:** ✅ **Production** (e opzionalmente Preview)
- ❌ **NON deve essere** `http://localhost:3000`

#### 2. NEXTAUTH_SECRET

- **Name:** `NEXTAUTH_SECRET`
- **Value:** Deve essere una chiave segreta (almeno 32 caratteri)
- **Environment:** ✅ **Production** (e opzionalmente Preview)
- ⚠️ **Può essere diversa** da quella locale (consigliato per sicurezza)

#### 3. GOOGLE_CLIENT_ID

- **Name:** `GOOGLE_CLIENT_ID`
- **Value:** `YOUR_CLIENT_ID.apps.googleusercontent.com` (sostituisci con il tuo)
- **Environment:** ✅ **Production** (e opzionalmente Preview)
- ✅ **Deve essere uguale** a quella locale

#### 4. GOOGLE_CLIENT_SECRET

- **Name:** `GOOGLE_CLIENT_SECRET`
- **Value:** `GOCSPX-YOUR_SECRET_HERE` (sostituisci con il tuo)
- **Environment:** ✅ **Production** (e opzionalmente Preview)
- ✅ **Deve essere uguale** a quella locale

---

## 🔍 Verifica Google Console

### ✅ Authorized JavaScript Origins

Vai su [Google Cloud Console](https://console.cloud.google.com/) → **Credentials** → **OAuth Client** e verifica che ci siano:

1. **Locale:**

   ```
   http://localhost:3000
   ```

2. **Produzione:**
   ```
   https://spediresicuro.vercel.app
   ```

### ✅ Authorized Redirect URIs

Verifica che ci siano:

1. **Locale:**

   ```
   http://localhost:3000/api/auth/callback/google
   ```

2. **Produzione:**
   ```
   https://spediresicuro.vercel.app/api/auth/callback/google
   ```

---

## ✅ Test Configurazione

### Test Locale

1. **Avvia il server:**

   ```bash
   npm run dev
   ```

2. **Controlla i log all'avvio:**
   Dovresti vedere:

   ```
   🔍 [AUTH CONFIG] OAuth Config Check: {
     google: '✅ Configurato',
     nextAuthUrl: 'http://localhost:3000',
     hasNextAuthSecret: true,
     ...
   }
   ✅ [AUTH CONFIG] Configurazione OAuth valida
   ```

3. **Testa il login:**
   - Vai su `http://localhost:3000/login`
   - Prova il login con Google
   - Dovrebbe funzionare!

### Test Produzione (Vercel)

1. **Controlla i log di Vercel:**
   - Vai su Vercel Dashboard → **Deployments** → **Logs**
   - Cerca questi messaggi:

   ```
   🔍 [AUTH CONFIG] OAuth Config Check: {
     google: '✅ Configurato',
     nextAuthUrl: 'https://spediresicuro.vercel.app',
     hasNextAuthSecret: true,
     ...
   }
   ✅ [AUTH CONFIG] Configurazione OAuth valida
   ```

2. **Testa il login:**
   - Vai su `https://spediresicuro.vercel.app/login`
   - Prova il login con Google
   - Dovrebbe funzionare!

---

## ❌ Problemi Comuni

### Problema 1: Errore "Configuration" su Vercel

**Causa:** `NEXTAUTH_SECRET` non configurato su Vercel

**Soluzione:**

1. Vai su Vercel → Settings → Environment Variables
2. Aggiungi `NEXTAUTH_SECRET` con una chiave segreta
3. Fai un nuovo deploy

### Problema 2: Redirect a localhost dopo login Google

**Causa:** `NEXTAUTH_URL` non configurato correttamente su Vercel

**Soluzione:**

1. Vai su Vercel → Settings → Environment Variables
2. Verifica che `NEXTAUTH_URL` sia `https://spediresicuro.vercel.app`
3. Fai un nuovo deploy

### Problema 3: "redirect_uri_mismatch" in Google OAuth

**Causa:** URL di callback non configurato in Google Console

**Soluzione:**

1. Vai su Google Cloud Console → Credentials
2. Aggiungi `https://spediresicuro.vercel.app/api/auth/callback/google` nei Redirect URIs
3. Salva

---

## ✅ Riepilogo Configurazione Attuale

### Locale (env.local)

- ✅ `NEXTAUTH_URL=http://localhost:3000` - Corretto
- ✅ `NEXTAUTH_SECRET` - Configurato (112 caratteri)
- ✅ `GOOGLE_CLIENT_ID` - Configurato
- ✅ `GOOGLE_CLIENT_SECRET` - Configurato

### Vercel (da verificare)

- ⚠️ `NEXTAUTH_URL` - Deve essere `https://spediresicuro.vercel.app`
- ⚠️ `NEXTAUTH_SECRET` - Deve essere configurato
- ⚠️ `GOOGLE_CLIENT_ID` - Deve essere configurato
- ⚠️ `GOOGLE_CLIENT_SECRET` - Deve essere configurato

---

## 📞 Prossimi Passi

1. **Verifica su Vercel** che tutte le variabili siano configurate
2. **Verifica Google Console** che gli URL di produzione siano configurati
3. **Fai un nuovo deploy** se hai modificato qualcosa
4. **Testa il login** sia in locale che su Vercel

---

**Ultimo aggiornamento:** Guida per verificare la configurazione completa di NextAuth.
