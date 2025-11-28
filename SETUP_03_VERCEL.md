# ☁️ SETUP VERCEL - SpediSicuro Platform

**Obiettivo**: Deploy della piattaforma su Vercel con configurazione automatica CI/CD.

---

## ⚠️ ATTENZIONE - IMPORTANTE

**Questo è il NUOVO progetto SpediSicuro!**

Esiste un vecchio progetto con nome simile. Prima di procedere:
- ✅ **VERIFICA** che stai lavorando sull'account Vercel corretto
- ✅ **CHIEDI** conferma all'utente prima di accedere a Vercel
- ✅ **NON** sovrascrivere deployment esistenti
- ✅ Usa nome progetto: `spediresicuro-new` o `spediresicuro-v2` se esiste già

---

## 📋 ISTRUZIONI PER COMET AGENT

Sei un agente di configurazione esperto. Il tuo compito è guidare l'utente nel deploy della **SpediSicuro Platform** su Vercel (hosting gratuito) e configurare tutte le environment variables.

**PRIMA DI INIZIARE**: Chiedi all'utente conferma su quale account Vercel usare e verifica il repository GitHub da deployare!

---

## STEP 1: Preparazione Repository Git

### 1.1 Verifica Repository
Prima del deploy, assicurati che il repository Git sia aggiornato:

```bash
# Controlla status
git status

# Se ci sono modifiche non committate
git add -A
git commit -m "feat: prepare for Vercel deployment"

# Push su GitHub
git push origin main
# oppure
git push origin claude/spediresicuro-platform-01W7rytazpj9qgepVJ9DwwiP
```

### 1.2 Verifica Branch
- **Branch principale**: Dovrebbe essere `main` o il branch attuale
- **Visibilità**: Repository può essere privato o pubblico
- **Piattaforma**: GitHub, GitLab, o Bitbucket (preferito GitHub)

---

## STEP 2: Accesso Vercel

### 2.1 Signup/Login Vercel
1. Vai su https://vercel.com
2. Clicca "Sign Up" (se non hai account) o "Login"
3. **Autenticazione consigliata**: "Continue with GitHub"
4. Autorizza Vercel ad accedere ai tuoi repository GitHub
5. Seleziona:
   - **All repositories** (se vuoi accesso completo)
   - **Only select repositories** → Seleziona `spediresicuro` o nome tuo repo

---

## STEP 3: Import Progetto

### 3.1 New Project
1. Nel dashboard Vercel, clicca "Add New..." → "Project"
2. Dovresti vedere la lista dei tuoi repository GitHub
3. Cerca `spediresicuro` (o nome tuo repository)
4. Clicca "Import" accanto al repository

### 3.2 Configure Project
**Framework Preset**: Next.js (dovrebbe essere auto-rilevato ✅)

**Root Directory**: `./` (lascia vuoto, il progetto è nella root)

**Build and Output Settings** (lascia default):
- Build Command: `npm run build` ✅
- Output Directory: `.next` ✅
- Install Command: `npm install` ✅

**NON cliccare ancora "Deploy"!** Prima configuriamo le environment variables.

---

## STEP 4: Configurazione Environment Variables

### 4.1 Espandi "Environment Variables"
Clicca sulla sezione "Environment Variables" per espanderla.

### 4.2 Aggiungi Variables (da SETUP_01 e SETUP_02)

Per OGNI variabile, clicca "Add" e inserisci:

#### 🗄️ Supabase (da SETUP_01_SUPABASE.md)
```
Key: NEXT_PUBLIC_SUPABASE_URL
Value: https://xxxxxxxxxxxxx.supabase.co
Environment: Production, Preview, Development (seleziona tutti)
```

```
Key: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Environment: Production, Preview, Development (seleziona tutti)
```

```
Key: SUPABASE_SERVICE_ROLE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Environment: Production, Preview, Development (seleziona tutti)
```

#### 🔐 Google OAuth (da SETUP_02_GOOGLE_OAUTH.md)
```
Key: GOOGLE_CLIENT_ID
Value: xxxxx-xxxxx.apps.googleusercontent.com
Environment: Production, Preview, Development
```

```
Key: GOOGLE_CLIENT_SECRET
Value: GOCSPX-xxxxxxxxxxxxx
Environment: Production, Preview, Development
```

#### 🔐 GitHub OAuth (opzionale, da SETUP_02)
```
Key: GITHUB_CLIENT_ID
Value: xxxxxxxxxxxxx
Environment: Production, Preview, Development
```

```
Key: GITHUB_CLIENT_SECRET
Value: xxxxxxxxxxxxx
Environment: Production, Preview, Development
```

#### 🔑 NextAuth
```
Key: NEXTAUTH_SECRET
Value: [output di: openssl rand -base64 32]
Environment: Production, Preview, Development
```

```
Key: NEXTAUTH_URL
Value: https://spediresicuro-platform.vercel.app
Environment: Production
```

```
Key: NEXTAUTH_URL
Value: http://localhost:3000
Environment: Development
```

⚠️ **IMPORTANTE**: Per `NEXTAUTH_URL`:
- **Production**: Usa l'URL Vercel (es. `https://tuo-progetto.vercel.app`)
- **Development**: Usa `http://localhost:3000`
- Aggiungi SEPARATAMENTE per Production e Development

### 4.3 Verifica Variables
Dovresti avere:
- ✅ 3 variabili Supabase
- ✅ 2 variabili Google OAuth
- ✅ 2 variabili GitHub OAuth (opzionale)
- ✅ 2 variabili NextAuth (NEXTAUTH_SECRET + NEXTAUTH_URL)

**Totale**: 7-9 variabili

---

## STEP 5: Deploy Iniziale

### 5.1 Avvia Deploy
1. Clicca "Deploy" (in basso)
2. **Attendi** il deployment (2-5 minuti)
3. Verrai portato alla pagina di build

### 5.2 Monitora Build
Dovresti vedere:
- ✅ Installing dependencies... (30-60 sec)
- ✅ Building... (60-90 sec)
- ✅ Uploading... (10-20 sec)
- ✅ Deploying... (10-20 sec)
- 🎉 **Deployment Complete!**

### 5.3 Verifica URL
Una volta completato, vedrai:
- **Production URL**: `https://spediresicuro-platform.vercel.app` (o simile)
- **Preview URL**: URL temporanei per PR
- **Status**: ✅ Ready

Clicca "Visit" per aprire l'app in produzione! 🚀

---

## STEP 6: Configurazione Dominio Custom (Opzionale)

### 6.1 Aggiungi Dominio
1. Nel progetto Vercel, vai su "Settings" → "Domains"
2. Clicca "Add"
3. Inserisci il tuo dominio (es. `spediresicuro.com`)
4. Clicca "Add"

### 6.2 Configura DNS
Vercel ti darà istruzioni DNS specifiche:
- **Type**: CNAME
- **Name**: `www` (o `@` per root domain)
- **Value**: `cname.vercel-dns.com`

Vai dal tuo provider DNS (Cloudflare, GoDaddy, etc.) e aggiungi il record.

### 6.3 Attendi Propagazione
- ⏳ Tempo: 5 minuti - 24 ore
- Vercel verificherà automaticamente
- Quando pronto, vedrai ✅ Valid Configuration

---

## STEP 7: Aggiorna OAuth Redirect URIs

### 7.1 Copia Production URL
Es. `https://spediresicuro-platform.vercel.app`

### 7.2 Aggiorna Google Console
1. Vai su https://console.cloud.google.com
2. "APIs & Services" → "Credentials"
3. Clicca sul tuo OAuth Client ID
4. **Authorized JavaScript origins**: Aggiungi
   ```
   https://spediresicuro-platform.vercel.app
   ```
5. **Authorized redirect URIs**: Aggiungi
   ```
   https://spediresicuro-platform.vercel.app/api/auth/callback/google
   ```
6. Clicca "SAVE"

### 7.3 Aggiorna Supabase (se necessario)
1. Vai su https://app.supabase.com
2. Seleziona il tuo progetto
3. "Authentication" → "URL Configuration"
4. **Site URL**: Cambia a `https://spediresicuro-platform.vercel.app`
5. **Redirect URLs**: Aggiungi il tuo dominio Vercel
6. Clicca "Save"

---

## STEP 8: Test Produzione

### 8.1 Test Homepage
1. Vai al tuo URL Vercel
2. Dovresti vedere la homepage della piattaforma
3. Verifica che il design sia corretto (CSS caricato)

### 8.2 Test Login Google
1. Vai su `/login`
2. Clicca "Sign in with Google"
3. Dovresti essere reindirizzato a Google
4. Dopo l'autorizzazione, torna all'app loggato
5. Verifica che il nome utente appaia in dashboard

### 8.3 Test Database
1. Prova a creare una spedizione
2. Verifica che i dati vengano salvati in Supabase
3. Vai su Supabase → Table Editor → `shipments`
4. Dovresti vedere la spedizione creata

---

## STEP 9: Configurazione CI/CD

### 9.1 Auto-Deploy
Vercel ha già configurato auto-deploy! ✅

**Come funziona**:
- **Push su branch principale** → Deploy automatico in Production
- **Pull Request** → Deploy automatico in Preview (URL temporaneo)
- **Merge PR** → Deploy automatico in Production

### 9.2 Protezione Branch (Raccomandato)
1. Vai su GitHub → Repository → Settings → Branches
2. Clicca "Add rule"
3. **Branch name pattern**: `main`
4. ✅ Require pull request reviews before merging
5. ✅ Require status checks to pass (Vercel)
6. Clicca "Create"

---

## STEP 10: Performance & Analytics

### 10.1 Abilita Vercel Analytics (Gratis!)
1. Nel progetto Vercel, vai su "Analytics"
2. Clicca "Enable Analytics"
3. **Metrics disponibili**:
   - Page views
   - Unique visitors
   - Top pages
   - Referrers
   - Countries

### 10.2 Abilita Vercel Speed Insights
1. Vai su "Speed Insights"
2. Clicca "Enable Speed Insights"
3. **Metrics disponibili**:
   - Core Web Vitals (LCP, FID, CLS)
   - Performance score
   - Real User Monitoring

---

## ✅ CHECKLIST FINALE

Prima di completare, verifica:

- [ ] Repository Git aggiornato e pushato
- [ ] Progetto importato su Vercel
- [ ] Environment variables configurate (7-9 variabili)
- [ ] Deploy completato con successo
- [ ] Production URL accessibile
- [ ] OAuth redirect URIs aggiornati (Google + Supabase)
- [ ] Test login funzionante
- [ ] Test database funzionante
- [ ] (Opzionale) Dominio custom configurato
- [ ] (Opzionale) Analytics abilitato
- [ ] CI/CD auto-deploy attivo

---

## 📤 OUTPUT RICHIESTO

**Comet Agent, restituisci ESATTAMENTE questo formato:**

```env
# ============================================
# ☁️ VERCEL DEPLOYMENT
# ============================================

# Production URL
VERCEL_PRODUCTION_URL=https://spediresicuro-platform.vercel.app

# Project URL (alternativo)
VERCEL_PROJECT_URL=https://spediresicuro-platform.vercel.app

# Domain Custom (se configurato)
CUSTOM_DOMAIN=https://spediresicuro.com

# ============================================
# 🔧 NEXTAUTH URL (aggiorna se necessario)
# ============================================

# Production
NEXTAUTH_URL=https://spediresicuro-platform.vercel.app

# ============================================
# ✅ SETUP VERCEL COMPLETATO
# ============================================
```

**Inoltre, conferma:**
- ✅ Deploy status: Success/Failed
- ✅ Build time: __ minuti
- ✅ Deployment URL: __
- ✅ Environment variables: __ (numero)
- ✅ OAuth redirect URIs aggiornati: SI/NO
- ✅ Test login eseguito: SI/NO
- ✅ Analytics abilitato: SI/NO

---

## 🚨 TROUBLESHOOTING

### Errore: "Build failed - Module not found"
**Soluzione**: Verifica che `package.json` includa tutte le dipendenze
```bash
npm install
git add package-lock.json
git commit -m "fix: update dependencies"
git push
```

### Errore: "Environment variable not found"
**Soluzione**:
1. Vercel → Settings → Environment Variables
2. Aggiungi la variabile mancante
3. Redeploy: Deployments → ... → Redeploy

### Errore: "Page not found"
**Soluzione**: Il build è riuscito ma il routing non funziona
- Verifica che `app` directory esista
- Verifica Next.js config in `next.config.mjs`

### Deploy lento (>10 minuti)
**Soluzione**:
- Controlla Vercel status: https://www.vercel-status.com
- Annulla deploy e riprova
- Rimuovi dipendenze pesanti non utilizzate

---

## 🎯 OTTIMIZZAZIONI POST-DEPLOY

### 1. Configura Caching
In `next.config.mjs`:
```js
module.exports = {
  headers: async () => [
    {
      source: '/images/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
      ]
    }
  ]
}
```

### 2. Abilita Compression
Vercel abilita automaticamente:
- ✅ Gzip compression
- ✅ Brotli compression
- ✅ Image optimization

### 3. Monitor Errors
Integra Sentry (opzionale):
```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

---

## ➡️ PROSSIMO STEP

Una volta completato questo setup, procedi con:
- **SETUP_04_ENV_FINAL.md** - Raccolta finale di tutte le env variables

---

**Inizia ora! Segui gli step uno per uno e restituisci l'output richiesto.** 🚀
