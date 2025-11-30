# 🔧 CHECKLIST VARIABILI AMBIENTE VERCEL

## 📋 Variabili da Configurare su Vercel

Dopo il push, configura queste variabili in Vercel Dashboard:

### 🔴 OBBLIGATORIE (Senza queste il sito NON funziona)

1. **NEXTAUTH_URL**
   - **Valore:** `https://www.spediresicuro.it` (o il tuo dominio)
   - **Dove:** Vercel Dashboard → Project → Settings → Environment Variables
   - **Ambiente:** Production, Preview, Development

2. **NEXTAUTH_SECRET**
   - **Valore:** Stringa casuale (genera con `openssl rand -base64 32`)
   - **Dove:** Vercel Dashboard → Project → Settings → Environment Variables
   - **Ambiente:** Production, Preview, Development
   - **⚠️ IMPORTANTE:** Usa un secret diverso per produzione!

### 🟡 OPZIONALI (Senza queste il sito funziona, ma con limitazioni)

3. **NEXT_PUBLIC_SUPABASE_URL**
   - **Valore:** `https://xxxxx.supabase.co`
   - **Dove:** Supabase Dashboard → Settings → API
   - **Ambiente:** Production, Preview (opzionale)
   - **Nota:** Se non presente, usa database locale (non persistente)

4. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - **Valore:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **Dove:** Supabase Dashboard → Settings → API
   - **Ambiente:** Production, Preview (opzionale)
   - **Nota:** Se non presente, usa database locale

5. **GOOGLE_CLIENT_ID** (solo se vuoi OAuth Google)
   - **Valore:** `xxxxx.apps.googleusercontent.com`
   - **Ambiente:** Production, Preview

6. **GOOGLE_CLIENT_SECRET** (solo se vuoi OAuth Google)
   - **Valore:** `GOCSPX-xxxxx`
   - **Ambiente:** Production, Preview

7. **GITHUB_CLIENT_ID** (solo se vuoi OAuth GitHub)
   - **Valore:** `Ov23lixxxxx`
   - **Ambiente:** Production, Preview

8. **GITHUB_CLIENT_SECRET** (solo se vuoi OAuth GitHub)
   - **Valore:** `xxxxx`
   - **Ambiente:** Production, Preview

---

## 🚀 COME CONFIGURARE SU VERCEL

### Passo 1: Vai su Vercel Dashboard

1. Accedi a [Vercel Dashboard](https://vercel.com/dashboard)
2. Seleziona il progetto **spediresicuro**

### Passo 2: Aggiungi Environment Variables

1. Vai su **Settings** → **Environment Variables**
2. Clicca **Add New**
3. Aggiungi ogni variabile:
   - **Name:** `NEXTAUTH_URL`
   - **Value:** `https://www.spediresicuro.it`
   - **Environment:** Seleziona Production, Preview, Development
4. Clicca **Save**
5. Ripeti per tutte le variabili

### Passo 3: Rigenera Deploy

Dopo aver aggiunto le variabili:

1. Vai su **Deployments**
2. Trova l'ultimo deploy
3. Clicca **...** → **Redeploy**
4. Oppure fai un nuovo push (trigger automatico)

---

## ✅ VERIFICA POST-CONFIGURAZIONE

Dopo aver configurato le variabili:

1. **Rigenera deploy** (vedi sopra)
2. **Verifica che funzioni:**
   - Homepage: `https://www.spediresicuro.it`
   - Login: `https://www.spediresicuro.it/login`
   - Dashboard: `https://www.spediresicuro.it/dashboard`
   - Integrazioni: `https://www.spediresicuro.it/dashboard/integrazioni`

3. **Verifica log Vercel:**
   - Vai su Deployments → Ultimo deploy → Logs
   - Non dovrebbero esserci errori relativi a variabili ambiente

---

## 🔒 SICUREZZA

- ✅ **NON committare** variabili ambiente nel codice
- ✅ **Usa Vercel Environment Variables** per secrets
- ✅ **Genera NEXTAUTH_SECRET diverso** per produzione
- ✅ **Rigenera secrets** se esposti accidentalmente

---

**Dopo aver configurato, il sito funzionerà perfettamente!** ✅

