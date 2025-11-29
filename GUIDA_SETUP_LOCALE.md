# 🚀 GUIDA SETUP LOCALE - SpediReSicuro

## 📋 Indice
1. [Prerequisiti](#prerequisiti)
2. [Installazione](#installazione)
3. [Configurazione Environment Variables](#configurazione-environment-variables)
4. [Come Ottenere le API Keys](#come-ottenere-le-api-keys)
5. [Avvio Progetto](#avvio-progetto)
6. [Test Funzionalità](#test-funzionalità)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Prerequisiti

- **Node.js** 18+ installato ([download](https://nodejs.org/))
- **npm** 9+ (incluso con Node.js)
- **Git** installato
- **Editor** (VS Code consigliato)

Verifica versioni:
```bash
node --version  # Deve essere >= 18
npm --version   # Deve essere >= 9
```

---

## 📦 Installazione

### 1. Clone Repository (se non fatto)

```bash
git clone https://github.com/gdsgroupsas-jpg/spediresicuro.git
cd spediresicuro
```

### 2. Installa Dipendenze

```bash
npm install
```

Questo comando installa tutti i pacchetti necessari (Next.js, React, Tailwind, Anthropic SDK, etc.)

---

## ⚙️ Configurazione Environment Variables

### STEP 1: Crea File .env.local

Nella **root del progetto** (stessa cartella di `package.json`), crea un file chiamato `.env.local`:

```bash
# Windows PowerShell
New-Item -Path .env.local -ItemType File

# macOS/Linux
touch .env.local
```

### STEP 2: Copia Template

Apri `.env.local` con un editor di testo e incolla questo contenuto:

```env
# ========================================
# SpediReSicuro - Environment Variables
# ========================================

# -----------------
# Supabase Database (OPZIONALE per test locale)
# -----------------
# Puoi lasciare commentato per usare database JSON locale
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# -----------------
# NextAuth.js (OBBLIGATORIO)
# -----------------
NEXTAUTH_URL=http://localhost:3000
# Genera un secret sicuro con: openssl rand -base64 32
NEXTAUTH_SECRET=tua-chiave-segreta-minimo-32-caratteri-generata-random

# -----------------
# OAuth Providers (OPZIONALI)
# -----------------
# Google OAuth - Solo se vuoi login Google
# GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
# GOOGLE_CLIENT_SECRET=GOCSPX-abc123xyz

# GitHub OAuth - Solo se vuoi login GitHub
# GITHUB_CLIENT_ID=Ov23liABCDEFGH12345
# GITHUB_CLIENT_SECRET=abc123xyz789def

# -----------------
# Claude AI OCR Vision (RACCOMANDATO)
# -----------------
# Per OCR reale da immagini LDV
# Senza questa key, userà Mock OCR (dati casuali)
ANTHROPIC_API_KEY=sk-ant-api03-INSERISCI-LA-TUA-KEY-QUI

# -----------------
# App Configuration
# -----------------
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=SpediReSicuro
```

### STEP 3: Personalizza i Valori

**OBBLIGATORI:**
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=GENERA_CHIAVE_CASUALE_32_CARATTERI
```

**RACCOMANDATI (per OCR reale):**
```env
ANTHROPIC_API_KEY=sk-ant-api03-TUA-KEY
```

**OPZIONALI (puoi saltare per ora):**
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 🔑 Come Ottenere le API Keys

### 1. NEXTAUTH_SECRET (OBBLIGATORIO)

**Opzione A - Automatica (consigliata):**
```bash
# macOS/Linux/WSL
openssl rand -base64 32

# Windows PowerShell
-join ((65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

Copia l'output e incollalo in `.env.local`:
```env
NEXTAUTH_SECRET=7yX9kL2mN5pQ8rT1vW4zC6bF0hJ3dG
```

**Opzione B - Manuale:**
Usa un generatore online: https://generate-secret.vercel.app/32

---

### 2. ANTHROPIC_API_KEY (OCR Reale - Raccomandato)

#### Passaggi:

1. **Vai su Anthropic Console**
   - https://console.anthropic.com/

2. **Crea Account / Login**
   - Usa email aziendale
   - Verifica email

3. **Ottieni API Key**
   - Dashboard → "API Keys"
   - Click "Create Key"
   - Nome: `SpediReSicuro Local Dev`
   - Copia la key (inizia con `sk-ant-api03-...`)

4. **Incolla in .env.local**
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-abc123xyz789...
   ```

#### Costi:
- Claude Sonnet 4.5: ~$3 per 1M input tokens
- Stima: 1 immagine LDV ≈ 0.5-1k tokens ≈ $0.003-0.005
- **100 scan OCR ≈ $0.30-0.50**

#### Alternativa Gratuita (Mock):
Se non vuoi spendere ora, **lascia commentata** `ANTHROPIC_API_KEY`.
Il sistema userà Mock OCR (dati casuali per sviluppo).

---

### 3. GOOGLE OAuth (Opzionale)

Se vuoi login con Google:

1. **Google Cloud Console**
   - https://console.cloud.google.com/

2. **Crea Progetto**
   - Nome: `SpediReSicuro`

3. **Abilita API**
   - APIs & Services → OAuth consent screen
   - External → Crea
   - App name: `SpediReSicuro`
   - User support email: tua-email
   - Developer email: tua-email

4. **Crea Credenziali**
   - Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Name: `SpediReSicuro Local`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
   - Copia Client ID e Secret

5. **Aggiungi in .env.local**
   ```env
   GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-abc123xyz
   ```

---

### 4. GITHUB OAuth (Opzionale)

Se vuoi login con GitHub:

1. **GitHub Settings**
   - https://github.com/settings/developers

2. **New OAuth App**
   - Application name: `SpediReSicuro Local`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
   - Register application

3. **Genera Client Secret**
   - Click "Generate a new client secret"
   - Copia Client ID e Secret

4. **Aggiungi in .env.local**
   ```env
   GITHUB_CLIENT_ID=Ov23liABCDEFGH12345
   GITHUB_CLIENT_SECRET=abc123xyz789def
   ```

---

## 🏃 Avvio Progetto

### 1. Verifica File .env.local

Assicurati che `.env.local` esista e contenga almeno:
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=tua-chiave-32-caratteri
ANTHROPIC_API_KEY=sk-ant-api03-xxx  # (opzionale)
```

### 2. Avvia Server Sviluppo

```bash
npm run dev
```

Dovresti vedere:
```
▲ Next.js 14.2.33
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000

✓ Ready in 2.3s
```

### 3. Apri Browser

Vai su: **http://localhost:3000**

---

## 🧪 Test Funzionalità

### 1. Login

1. Vai su `http://localhost:3000/login`
2. Usa credenziali demo:
   - Email: `admin@spediresicuro.it`
   - Password: `admin123`
3. Dovresti vedere la dashboard

### 2. Impostazioni Mittente

1. Vai su `http://localhost:3000/dashboard/impostazioni`
2. Compila form mittente predefinito:
   - Nome: La tua azienda
   - Indirizzo: Via Roma, 123
   - Città: Milano
   - CAP: 20100
   - Provincia: MI
   - Telefono: 3331234567
3. Click "Salva Impostazioni"
4. Verifica messaggio "✅ Salvato con successo"

### 3. OCR Test (se hai ANTHROPIC_API_KEY)

1. Vai su `http://localhost:3000/dashboard/spedizioni/nuova`
2. Upload immagine LDV (pulsante "Carica da Scanner")
3. Attendi estrazione (2-3 secondi)
4. Verifica che i dati estratti siano corretti
5. Se non hai API key, vedrai dati Mock casuali

### 4. Creazione Spedizione

1. Vai su `/dashboard/spedizioni/nuova`
2. Form dovrebbe essere pre-compilato con mittente salvato
3. Compila dati destinatario
4. Salva spedizione
5. Vai su `/dashboard/spedizioni`
6. Verifica che la spedizione appaia nella lista

---

## 🔍 Verifica File Database

Durante sviluppo locale, i dati sono salvati in:
```
spediresicuro/data/database.json
```

Puoi aprire questo file con un editor per vedere:
- Utenti
- Spedizioni
- Preventivi

**NOTA:** Questo file NON è in `.gitignore`, quindi viene tracciato.

---

## 🐛 Troubleshooting

### ❌ Errore: "Module not found: Can't resolve '@anthropic-ai/sdk'"

**Causa:** Dipendenza non installata

**Soluzione:**
```bash
npm install @anthropic-ai/sdk
```

---

### ❌ Errore: "Invalid NEXTAUTH_SECRET"

**Causa:** `NEXTAUTH_SECRET` non configurata

**Soluzione:**
```bash
# Genera nuova secret
openssl rand -base64 32

# Aggiungi in .env.local
NEXTAUTH_SECRET=output-del-comando-sopra
```

---

### ❌ Errore: "Failed to load env from .env.local"

**Causa:** File `.env.local` nella posizione sbagliata o sintassi errata

**Soluzione:**
1. Verifica che `.env.local` sia nella root del progetto (stessa cartella di `package.json`)
2. Verifica sintassi: nessun spazio attorno a `=`
   ```env
   # ✅ Corretto
   NEXTAUTH_SECRET=abc123

   # ❌ Sbagliato
   NEXTAUTH_SECRET = abc123
   ```

---

### ❌ OCR Restituisce Dati Casuali

**Causa:** `ANTHROPIC_API_KEY` non configurata → usa Mock

**Soluzione:**
1. Aggiungi API key in `.env.local`
2. Riavvia server: `Ctrl+C` → `npm run dev`
3. Riprova upload immagine

---

### ❌ Login Non Funziona

**Causa:** Session/cookies non configurati

**Soluzione:**
1. Verifica `.env.local`:
   ```env
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=chiave-32-caratteri
   ```
2. Cancella cache browser: `Ctrl+Shift+Del`
3. Riavvia server
4. Riprova login

---

### ❌ Build Fallisce

**Causa:** Errori TypeScript o dipendenze mancanti

**Soluzione:**
```bash
# Reinstalla dipendenze
rm -rf node_modules
npm install

# Verifica build
npm run build

# Se ancora errori, controlla output
```

---

## 📚 Comandi Utili

```bash
# Sviluppo
npm run dev          # Avvia server dev (hot reload)

# Build
npm run build        # Build produzione
npm run start        # Avvia build produzione

# Utility
npm run lint         # Controlla errori ESLint
```

---

## 🎯 Checklist Setup Completo

Prima di iniziare sviluppo, verifica:

- [ ] Node.js 18+ installato
- [ ] Dipendenze installate (`npm install`)
- [ ] File `.env.local` creato
- [ ] `NEXTAUTH_SECRET` generata e configurata
- [ ] `ANTHROPIC_API_KEY` configurata (opzionale ma raccomandato)
- [ ] Server dev avviato (`npm run dev`)
- [ ] Login funziona
- [ ] Mittente predefinito salvabile
- [ ] Spedizioni creabili

---

## 🆘 Supporto

### Documentazione Online
- Next.js: https://nextjs.org/docs
- Anthropic: https://docs.anthropic.com/
- NextAuth: https://next-auth.js.org/

### Issues GitHub
https://github.com/gdsgroupsas-jpg/spediresicuro/issues

---

**🎉 SETUP COMPLETATO!**

Ora puoi sviluppare in locale con tutte le funzionalità attive.

Per deploy su produzione, consulta `DEPLOY_VERCEL.md` (prossimamente).
