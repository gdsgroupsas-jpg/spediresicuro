# 🔐 Guida Completa Variabili d'Ambiente

## 📋 Indice
1. [Variabili per Next.js (Progetto Principale)](#nextjs)
2. [Variabili per Automation-Service](#automation-service)
3. [Configurazione Vercel](#vercel)
4. [Come Ottenere i Valori da Supabase](#supabase-values)

---

## 🎯 1. Variabili per Next.js (Progetto Principale) {#nextjs}

### File `.env.local` (Locale - Sviluppo)

Crea il file `.env.local` nella root del progetto (`d:\spediresicuro-master\.env.local`):

```env
# ============================================
# SUPABASE - Database
# ============================================
# URL del progetto Supabase (trovalo in Settings > API > Project URL)
NEXT_PUBLIC_SUPABASE_URL=https://pxd2.supabase.co

# Anon Key (Pubblica - sicura per browser)
# Trovala in: Supabase Studio > Settings > API > anon public
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dDI...

# Service Role Key (SECRETA - solo server-side)
# Trovala in: Supabase Studio > Settings > API > service_role secret (clicca "Reveal")
# ⚠️ NON condividere mai questa chiave!
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dDI...

# ============================================
# NEXTAUTH - Autenticazione
# ============================================
# URL dell'applicazione (locale per sviluppo)
NEXTAUTH_URL=http://localhost:3000

# Secret per NextAuth (genera uno casuale)
# Puoi generarlo con: openssl rand -base64 32
NEXTAUTH_SECRET=il_tuo_secret_casuale_molto_lungo_e_sicuro_qui

# ============================================
# OAUTH (Opzionale - se usi Google/GitHub)
# ============================================
# Google OAuth (se configurato)
GOOGLE_CLIENT_ID=tuo_google_client_id
GOOGLE_CLIENT_SECRET=tuo_google_client_secret

# GitHub OAuth (se configurato)
GITHUB_CLIENT_ID=tuo_github_client_id
GITHUB_CLIENT_SECRET=tuo_github_client_secret

# ============================================
# DIAGNOSTICS - Sistema di Monitoring
# ============================================
# Token per endpoint /api/diagnostics
# Genera uno casuale e sicuro
DIAGNOSTICS_TOKEN=d4t1_d14gn0st1c1_s3gr3t1_2025_x9z

# ============================================
# AUTOMATION SERVICE (se usi servizio separato)
# ============================================
# Token per chiamare automation-service
AUTOMATION_SERVICE_TOKEN=il_tuo_token_automation_sicuro_qui

# ============================================
# ENCRYPTION (per credenziali criptate)
# ============================================
# Chiave per criptare password (64 caratteri hex)
# Genera con: openssl rand -hex 32
ENCRYPTION_KEY=la_tua_chiave_esadecimale_64_caratteri_qui
```

---

## 🤖 2. Variabili per Automation-Service {#automation-service}

### File `.env` (nella cartella `automation-service`)

Crea il file `d:\spediresicuro-master\automation-service\.env`:

```env
# ============================================
# SUPABASE - Database
# ============================================
# URL del progetto Supabase
SUPABASE_URL=https://pxd2.supabase.co
# Oppure puoi usare NEXT_PUBLIC_SUPABASE_URL se già configurata

# Service Role Key (SECRETA)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dDI...

# ============================================
# DIAGNOSTICS
# ============================================
# Token per endpoint /api/diagnostics
DIAGNOSTICS_TOKEN=d4t1_d14gn0st1c1_s3gr3t1_2025_x9z

# ============================================
# AUTOMATION SERVICE
# ============================================
# Token per proteggere gli endpoint /api/sync
AUTOMATION_SERVICE_TOKEN=il_tuo_token_automation_sicuro_qui

# Token per cron job /api/cron/sync
CRON_SECRET_TOKEN=il_tuo_token_cron_sicuro_qui

# ============================================
# ENCRYPTION
# ============================================
# Chiave per decriptare password (deve essere la stessa del progetto Next.js)
ENCRYPTION_KEY=la_tua_chiave_esadecimale_64_caratteri_qui

# ============================================
# SERVER
# ============================================
# Porta del server (default: 3000)
PORT=3000

# Ambiente (development/production)
NODE_ENV=development
```

---

## ☁️ 3. Configurazione Vercel {#vercel}

### Variabili per il Progetto Next.js su Vercel

Vai su **Vercel Dashboard** > Il tuo progetto > **Settings** > **Environment Variables**

Aggiungi queste variabili:

#### 🔵 Production, Preview, Development (tutte e tre)

```env
# SUPABASE
NEXT_PUBLIC_SUPABASE_URL=https://pxd2.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dDI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dDI...

# NEXTAUTH
NEXTAUTH_URL=https://spediresicuro.vercel.app
NEXTAUTH_SECRET=il_tuo_secret_casuale_molto_lungo_e_sicuro_qui

# DIAGNOSTICS
DIAGNOSTICS_TOKEN=d4t1_d14gn0st1c1_s3gr3t1_2025_x9z

# AUTOMATION SERVICE
AUTOMATION_SERVICE_TOKEN=il_tuo_token_automation_sicuro_qui

# ENCRYPTION
ENCRYPTION_KEY=la_tua_chiave_esadecimale_64_caratteri_qui

# OAUTH (se configurato)
GOOGLE_CLIENT_ID=tuo_google_client_id
GOOGLE_CLIENT_SECRET=tuo_google_client_secret
GITHUB_CLIENT_ID=tuo_github_client_id
GITHUB_CLIENT_SECRET=tuo_github_client_secret
```

**⚠️ IMPORTANTE per Vercel:**
- `NEXTAUTH_URL` deve essere l'URL del tuo progetto Vercel (es: `https://spediresicuro.vercel.app`)
- Per Preview/Development, Vercel usa automaticamente l'URL del branch, ma puoi lasciare quello di produzione

---

## 🔍 4. Come Ottenere i Valori da Supabase {#supabase-values}

### Step 1: URL del Progetto

1. Vai su **Supabase Studio**: https://supabase.com/dashboard
2. Seleziona il progetto **"spedire-sicuro"**
3. Vai su **Settings** (⚙️) > **API**
4. Trova **"Project URL"** o **"URL del Progetto"**
5. Copia l'URL (es: `https://pxd2.supabase.co`)

### Step 2: Anon Key (Pubblica)

1. Nella stessa pagina **Settings** > **API**
2. Sezione **"API Keys"**
3. Tab **"Legacy anon, service_role API keys"**
4. Copia il valore di **"anon public"**
5. È sicura da usare nel browser (con RLS abilitato)

### Step 3: Service Role Key (Segreta)

1. Nella stessa pagina, sezione **"API Keys"**
2. Tab **"Legacy anon, service_role API keys"**
3. Trova **"service_role secret"**
4. Clicca **"Reveal"** per vedere la chiave completa
5. **⚠️ COPIA SUBITO** - è molto lunga e non la vedrai più!
6. **⚠️ NON CONDIVIDERE MAI** questa chiave

### Step 4: Generare Token Sicuri

#### NEXTAUTH_SECRET
```bash
# Windows PowerShell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Guid]::NewGuid().ToString() + [System.Guid]::NewGuid().ToString()))

# Oppure online: https://generate-secret.vercel.app/32
```

#### DIAGNOSTICS_TOKEN, AUTOMATION_SERVICE_TOKEN, CRON_SECRET_TOKEN
Genera token casuali sicuri (almeno 32 caratteri):
```bash
# PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

#### ENCRYPTION_KEY
```bash
# PowerShell
[Convert]::ToHexString((1..32 | ForEach-Object {Get-Random -Minimum 0 -Maximum 256}))
```

---

## ✅ Checklist Finale

### Per Sviluppo Locale (Next.js)
- [ ] File `.env.local` creato nella root
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurato
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurato
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurato
- [ ] `NEXTAUTH_URL=http://localhost:3000`
- [ ] `NEXTAUTH_SECRET` generato
- [ ] `DIAGNOSTICS_TOKEN` configurato

### Per Automation-Service Locale
- [ ] File `.env` creato in `automation-service/`
- [ ] `SUPABASE_URL` configurato
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurato
- [ ] `DIAGNOSTICS_TOKEN` configurato
- [ ] `AUTOMATION_SERVICE_TOKEN` configurato
- [ ] `CRON_SECRET_TOKEN` configurato
- [ ] `ENCRYPTION_KEY` configurato (stesso del Next.js)

### Per Vercel (Production)
- [ ] Tutte le variabili aggiunte in Vercel Dashboard
- [ ] `NEXTAUTH_URL` impostato all'URL Vercel
- [ ] Variabili marcate come "Encrypted" (Vercel lo fa automaticamente)
- [ ] Deploy fatto dopo aver aggiunto le variabili

---

## 🚨 Note di Sicurezza

1. **Service Role Key**: ⚠️ **MAI** committare nel repository
2. **Token**: Usa token diversi per ogni ambiente (dev/prod)
3. **Vercel**: Le variabili sono automaticamente criptate
4. **Git**: Assicurati che `.env*` sia in `.gitignore`

---

## 📞 Supporto

Se hai problemi:
1. Verifica che tutte le variabili siano configurate
2. Controlla che i valori siano corretti (no spazi, no virgolette extra)
3. Riavvia il server dopo aver modificato `.env`
4. In Vercel, fai un nuovo deploy dopo aver aggiunto variabili
