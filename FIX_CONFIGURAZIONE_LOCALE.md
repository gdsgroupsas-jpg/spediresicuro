# 🔧 Fix Configurazione Locale - SpedireSicuro.it

**Problema:** Autocomplete città e OAuth Google non funzionano in locale

---

## 🚨 Problemi Identificati

1. **Autocomplete Città:** "Errore di connessione. Riprova."
   - ❌ Variabili Supabase non configurate o non valide

2. **OAuth Google:** Non funziona
   - ❌ Variabili Google OAuth non configurate
   - ❌ NextAuth non configurato correttamente

---

## ✅ Soluzione Rapida

### Step 1: Verifica Configurazione Attuale

Esegui lo script di verifica:

```bash
npm run verify:config
```

Questo ti dirà esattamente quali variabili mancano o sono errate.

---

### Step 2: Configura .env.local

#### 2.1 Crea/Copia File .env.local

Se non esiste, copia il template:

```bash
cp env.example.txt .env.local
```

#### 2.2 Configura Variabili Obbligatorie

Apri `.env.local` e configura queste variabili **OBBLIGATORIE**:

```env
# ============================================
# SUPABASE (OBBLIGATORIO per autocomplete città)
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# ============================================
# NEXTAUTH (OBBLIGATORIO per autenticazione)
# ============================================
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=genera-con-openssl-rand-base64-32

# ============================================
# GOOGLE OAUTH (OBBLIGATORIO per login Google)
# ============================================
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

# ============================================
# APP URL
# ============================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

### Step 3: Ottieni Credenziali

#### 3.1 Credenziali Supabase

1. Vai su https://app.supabase.com
2. Seleziona il tuo progetto (o creane uno nuovo)
3. Vai su **Settings** → **API**
4. Copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

#### 3.2 Credenziali Google OAuth

1. Vai su https://console.cloud.google.com/apis/credentials
2. Seleziona il progetto (o creane uno nuovo)
3. Crea **OAuth 2.0 Client ID**:
   - **Application type:** Web application
   - **Name:** SpedireSicuro Local
   - **Authorized redirect URIs:**
     - `http://localhost:3000/api/auth/callback/google`
4. Copia:
   - **Client ID** → `GOOGLE_CLIENT_ID`
   - **Client Secret** → `GOOGLE_CLIENT_SECRET`

#### 3.3 Genera NEXTAUTH_SECRET

```bash
# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Linux/Mac
openssl rand -base64 32
```

Oppure usa un generatore online: https://generate-secret.vercel.app/32

---

### Step 4: Verifica Tabella Supabase

Assicurati che la tabella `geo_locations` esista e sia popolata:

```bash
# Verifica struttura tabella
npm run check:table

# Popola database (se vuoto)
npm run seed:geo
```

---

### Step 5: Riavvia Server

```bash
# Ferma il server (Ctrl+C)
# Poi riavvia
npm run dev
```

---

## ✅ Verifica Finale

### 1. Verifica Configurazione

```bash
npm run verify:config
```

Dovresti vedere tutti ✅ verdi.

### 2. Test Autocomplete Città

1. Vai su http://localhost:3000/dashboard/spedizioni/nuova
2. Digita una città (es. "Roma")
3. Dovrebbe mostrare risultati, NON "Errore di connessione"

### 3. Test OAuth Google

1. Vai su http://localhost:3000/login
2. Clicca "Accedi con Google"
3. Dovrebbe reindirizzare a Google per login

---

## 🐛 Troubleshooting

### Errore: "Errore di connessione. Riprova."

**Possibili cause:**
1. ❌ Variabili Supabase non configurate
2. ❌ Tabella `geo_locations` non esiste
3. ❌ Database Supabase non accessibile

**Soluzione:**
```bash
# 1. Verifica variabili
npm run verify:config

# 2. Verifica tabella
npm run check:table

# 3. Se tabella non esiste, creala:
# Vai su Supabase SQL Editor e esegui supabase/schema.sql
```

### Errore: "OAuth Google non funziona"

**Possibili cause:**
1. ❌ `GOOGLE_CLIENT_ID` o `GOOGLE_CLIENT_SECRET` mancanti
2. ❌ `NEXTAUTH_URL` non è `http://localhost:3000`
3. ❌ `NEXTAUTH_SECRET` non configurato
4. ❌ Callback URL non configurato in Google Console

**Soluzione:**
1. Verifica `.env.local` ha tutte le variabili
2. Verifica Google Console ha callback: `http://localhost:3000/api/auth/callback/google`
3. Riavvia server: `npm run dev`

### Errore: "NEXTAUTH_URL must be set"

**Soluzione:**
Aggiungi in `.env.local`:
```env
NEXTAUTH_URL=http://localhost:3000
```

---

## 📝 Checklist Completa

- [ ] File `.env.local` creato
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurato
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurato
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurato
- [ ] `NEXTAUTH_URL=http://localhost:3000` configurato
- [ ] `NEXTAUTH_SECRET` generato e configurato
- [ ] `GOOGLE_CLIENT_ID` configurato
- [ ] `GOOGLE_CLIENT_SECRET` configurato
- [ ] Callback URL configurato in Google Console
- [ ] Tabella `geo_locations` esiste in Supabase
- [ ] Database popolato (almeno alcune città)
- [ ] Server riavviato dopo modifiche `.env.local`
- [ ] `npm run verify:config` mostra tutti ✅

---

## 🎯 Risultato Atteso

Dopo aver completato tutti gli step:

✅ Autocomplete città funziona  
✅ Login Google funziona  
✅ Nessun errore in console  
✅ Applicazione completamente funzionante in locale

---

**Se hai ancora problemi, esegui `npm run verify:config` e condividi l'output!**

