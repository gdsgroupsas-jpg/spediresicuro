# 📋 Template .env.local - Configurazione Pulita e Completa

> **Guida completa per configurare correttamente il file `.env.local`**

---

## 🎯 COSA FARE

1. **Crea il file** `.env.local` nella root del progetto (se non esiste)
2. **Copia il template qui sotto**
3. **Sostituisci i placeholder** con i tuoi valori reali
4. **Salva il file**
5. **NON committare mai** questo file su Git!

---

## 📝 TEMPLATE COMPLETO

```env
# ============================================
# CONFIGURAZIONE AMBIENTE - SpedireSicuro.it
# ============================================
# 
# ISTRUZIONI:
# 1. Sostituisci tutti i placeholder con valori reali
# 2. NON committare mai questo file nel repository Git!
# 3. Riavvia il server dopo modifiche: npm run dev
#
# ============================================

# ============================================
# 🔧 AMBIENTE
# ============================================
# Sviluppo locale: development
# Produzione: production (non usare in locale)
NODE_ENV=development

# ============================================
# 🌐 URL APPLICAZIONE
# ============================================
# URL base dell'applicazione
# Sviluppo: http://localhost:3000
# Produzione: https://www.spediresicuro.it
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================
# 🗄️ SUPABASE (Database PostgreSQL)
# ============================================
# ⚠️ OBBLIGATORIO per autocomplete città e database
# 
# Ottieni questi valori da:
# https://app.supabase.com → Il tuo progetto → Settings → API
#
# Project URL → NEXT_PUBLIC_SUPABASE_URL
# anon public key → NEXT_PUBLIC_SUPABASE_ANON_KEY
# service_role key → SUPABASE_SERVICE_ROLE_KEY

# URL del progetto Supabase
# Formato: https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# Chiave pubblica anonima (sicura per il client)
# Formato: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eHh4eHgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eHh4eHgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Service Role Key (SOLO per script server-side, NON esporre nel client!)
# Formato: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eHh4eHgiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjE2MjM5MDIyLCJleHAiOjE5MzE4MTUwMjJ9.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eHh4eHgiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjE2MjM5MDIyLCJleHAiOjE5MzE4MTUwMjJ9.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ============================================
# 🔐 SICUREZZA - NEXTAUTH (Autenticazione)
# ============================================
# ⚠️ OBBLIGATORIO per login e autenticazione

# URL base per NextAuth
# Sviluppo: http://localhost:3000
# Produzione: https://www.spediresicuro.it
NEXTAUTH_URL=http://localhost:3000

# Chiave segreta per sessioni e crittografia
# ⚠️ IMPORTANTE: Deve essere una stringa casuale lunga (minimo 32 caratteri)
# 
# Genera una nuova chiave con:
# Windows PowerShell: [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
# Linux/Mac: openssl rand -base64 32
#
# Formato esempio: YTc2M2MyYWEtYWI4MS00YTJjLTg5YWQtNTYxZGI3YzRlMDA5NzEzYmM1ZGYtYTEzNS00NmQzLTkwZTUtOTYyNDNmMzJmZGQ0
NEXTAUTH_SECRET=your-secret-key-min-32-chars-generate-new-one

# ============================================
# 🔑 OAUTH PROVIDERS (Autenticazione Social)
# ============================================
# Configurazione per accesso tramite Google, GitHub, Facebook
# I provider sono opzionali - se non configurati, saranno nascosti

# ============================================
# 📧 GOOGLE OAUTH
# ============================================
# ⚠️ OBBLIGATORIO se vuoi login con Google
#
# Ottieni le credenziali da:
# https://console.cloud.google.com/apis/credentials
#
# 1. Crea un nuovo OAuth 2.0 Client ID
# 2. Tipo applicazione: "Web application"
# 3. Authorized redirect URIs:
#    - Sviluppo: http://localhost:3000/api/auth/callback/google
#    - Produzione: https://www.spediresicuro.it/api/auth/callback/google
#
# Client ID (formato: xxxxx-xxxxx.apps.googleusercontent.com)
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com

# Client Secret (formato: GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ============================================
# 🐙 GITHUB OAUTH (Opzionale)
# ============================================
# Ottieni le credenziali da:
# https://github.com/settings/developers
#
# 1. Crea nuova OAuth App
# 2. Authorization callback URL:
#    - Sviluppo: http://localhost:3000/api/auth/callback/github
#    - Produzione: https://www.spediresicuro.it/api/auth/callback/github
#
# GITHUB_CLIENT_ID=your-github-client-id
# GITHUB_CLIENT_SECRET=your-github-client-secret

# ============================================
# 📘 FACEBOOK OAUTH (Opzionale)
# ============================================
# Ottieni le credenziali da:
# https://developers.facebook.com/apps/
#
# 1. Crea nuova app
# 2. Valid OAuth Redirect URIs:
#    - Sviluppo: http://localhost:3000/api/auth/callback/facebook
#    - Produzione: https://www.spediresicuro.it/api/auth/callback/facebook
#
# FACEBOOK_CLIENT_ID=your-facebook-app-id
# FACEBOOK_CLIENT_SECRET=your-facebook-app-secret

# ============================================
# 💰 CONFIGURAZIONE MARGINI
# ============================================
# Margine di ricarico predefinito (in percentuale)
# Esempio: 15 = 15% di ricarico sul costo base spedizione
NEXT_PUBLIC_DEFAULT_MARGIN=15

# ============================================
# 📊 ANALYTICS (Opzionale)
# ============================================
# Google Analytics (opzionale - servizio gratuito)
# Ottieni da: https://analytics.google.com
# NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# ============================================
# 📧 EMAIL (Opzionale - per notifiche future)
# ============================================
# Se in futuro vorrai inviare email, configura qui
# Esempio con Gmail SMTP:
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password
#
# Per Gmail, usa "App Password" non la password normale:
# https://myaccount.google.com/apppasswords

# ============================================
# 🚚 API CORRIERI (Opzionale - per futuro)
# ============================================
# Se in futuro userai API esterne per calcolo spedizioni
# API_KEY_BARTOLINI=your_api_key_here
# API_KEY_GLS=your_api_key_here
# API_KEY_DHL=your_api_key_here
```

---

## ✅ CHECKLIST VERIFICA

Dopo aver configurato il file, verifica che:

### Variabili OBBLIGATORIE (devono avere valori reali):

- [ ] `NEXT_PUBLIC_SUPABASE_URL` → Inizia con `https://` e contiene `supabase.co`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Stringa lunga che inizia con `eyJ`
- [ ] `NEXTAUTH_URL` → È `http://localhost:3000` (per sviluppo)
- [ ] `NEXTAUTH_SECRET` → Stringa lunga (minimo 32 caratteri)
- [ ] `GOOGLE_CLIENT_ID` → Termina con `.apps.googleusercontent.com`
- [ ] `GOOGLE_CLIENT_SECRET` → Inizia con `GOCSPX-`

### Variabili OPZIONALI (possono essere commentate):

- [ ] `SUPABASE_SERVICE_ROLE_KEY` → Utile per seeding database
- [ ] `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` → Solo se vuoi login GitHub
- [ ] `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` → Solo se vuoi login Facebook
- [ ] `NEXT_PUBLIC_GA_ID` → Solo se vuoi Google Analytics
- [ ] Variabili SMTP → Solo se vuoi inviare email

---

## 🚨 ERRORI COMUNI DA EVITARE

### ❌ NON FARE:

```env
# SBAGLIATO - Placeholder non sostituiti
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
GOOGLE_CLIENT_ID=your-google-client-id
NEXTAUTH_SECRET=your-secret-key-here-change-in-production
```

### ✅ FARE:

```env
# CORRETTO - Valori reali
NEXT_PUBLIC_SUPABASE_URL=https://pxwmposcsvsusjxdjues.supabase.co
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
NEXTAUTH_SECRET=YTc2M2MyYWEtYWI4MS00YTJjLTg5YWQtNTYxZGI3YzRlMDA5
```

---

## 🔍 COME VERIFICARE I VALORI

### Supabase:
1. Vai su https://app.supabase.com
2. Seleziona il tuo progetto
3. Settings → API
4. Copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### Google OAuth:
1. Vai su https://console.cloud.google.com/apis/credentials
2. Seleziona il tuo progetto
3. Clicca sul tuo OAuth 2.0 Client ID
4. Copia:
   - **Client ID** → `GOOGLE_CLIENT_ID`
   - **Client Secret** → `GOOGLE_CLIENT_SECRET`

### NEXTAUTH_SECRET:
Genera una nuova chiave:
```powershell
# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

```bash
# Linux/Mac
openssl rand -base64 32
```

---

## 📝 DOPO LA CONFIGURAZIONE

1. **Salva il file** `.env.local`
2. **Riavvia il server:**
   ```bash
   npm run dev
   ```
3. **Testa:**
   - Autocomplete città → dovrebbe funzionare
   - Login Google → dovrebbe funzionare

---

## 🆘 SE NON FUNZIONA

1. Verifica che i valori siano corretti (URL Supabase, chiavi OAuth)
2. Controlla console browser per errori
3. Controlla console server per errori
4. Vedi `VERIFICA_MANUALE_ENV.md` per troubleshooting dettagliato

---

**⚠️ IMPORTANTE: Questo file NON va mai committato su Git!**


