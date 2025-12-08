# 🔍 Confronto Variabili Vercel vs Necessarie

## ✅ Variabili Presenti su Vercel (Corrette)

Queste variabili sono già configurate correttamente:

1. ✅ **NEXT_PUBLIC_SUPABASE_URL** - All Environments
2. ✅ **NEXT_PUBLIC_SUPABASE_ANON_KEY** - All Environments
3. ✅ **SUPABASE_SERVICE_ROLE_KEY** - All Environments
4. ✅ **NEXTAUTH_URL** - Production (⚠️ verifica che sia l'URL Vercel, non localhost)
5. ✅ **NEXTAUTH_SECRET** - Production and Preview
6. ✅ **ENCRYPTION_KEY** - All Environments
7. ✅ **DIAGNOSTICS_TOKEN** - All Environments
8. ✅ **GOOGLE_CLIENT_ID** - All Environments
9. ✅ **GOOGLE_CLIENT_SECRET** - All Environments
10. ✅ **GITHUB_CLIENT_ID** - All Environments
11. ✅ **GITHUB_CLIENT_SECRET** - All Environments
12. ✅ **ANTHROPIC_API_KEY** - All Environments (per Anne AI)
13. ✅ **NEXT_PUBLIC_DEFAULT_MARGIN** - All Environments
14. ✅ **NEXT_PUBLIC_APP_URL** - All Environments
15. ✅ **NODE_ENV** - All Environments

## ⚠️ Variabili da Verificare/Correggere

### 1. AUTOMATION_SERVICE_URL ✅ + AUTOMATION_SERVICE_TOKEN ❌

**Su Vercel hai:** `AUTOMATION_SERVICE_URL` ✅
**Su Vercel manca:** `AUTOMATION_SERVICE_TOKEN` ❌

**Spiegazione:**
- `AUTOMATION_SERVICE_URL` = URL del servizio automation separato (Railway)
  - Esempio: `https://automation-service.railway.app`
  - Serve per chiamare il servizio da Next.js
  - ✅ **È presente e corretto!**

- `AUTOMATION_SERVICE_TOKEN` = Token per autenticare le chiamate
  - Serve per proteggere gli endpoint `/api/sync`, `/api/sync-shipments`
  - ❌ **MANCA su Vercel!**

**Cosa fare:**
- ✅ Mantieni `AUTOMATION_SERVICE_URL` (già presente)
- ⚠️ **Aggiungi `AUTOMATION_SERVICE_TOKEN`** (manca!)

### 2. NEXTAUTH_URL - Verifica Scope

**Su Vercel:** Solo Production
**Consigliato:** Production, Preview, Development

**Cosa fare:**
- Aggiungi anche per Preview e Development
- Per Preview usa: `https://spediresicuro-git-<branch>-gdsgroupsas-6132s.vercel.app`
- Per Development: `http://localhost:3000` (se usi Vercel CLI)

## ❌ Variabili Mancanti su Vercel

Queste variabili sono necessarie ma NON sono presenti:

### 1. AUTOMATION_SERVICE_TOKEN ⚠️ IMPORTANTE

**Nome:** `AUTOMATION_SERVICE_TOKEN`
**Scope:** All Environments
**Valore:** Il token che hai generato (stesso del locale)
**Perché serve:** Protegge gli endpoint `/api/sync`, `/api/sync-shipments`, `/api/cron/sync`

**Aggiungi subito!**

### 2. CRON_SECRET_TOKEN (Opzionale - solo se usi cron job)

**Nome:** `CRON_SECRET_TOKEN`
**Scope:** All Environments
**Valore:** Token diverso da AUTOMATION_SERVICE_TOKEN
**Perché serve:** Protegge l'endpoint `/api/cron/sync`

### 3. GOOGLE_CLOUD_CREDENTIALS (Opzionale)

**Nome:** `GOOGLE_CLOUD_CREDENTIALS`
**Scope:** All Environments
**Valore:** Credenziali JSON per Google Cloud (se usi servizi Google avanzati)
**Nota:** Se non usi Google Cloud avanzato, puoi rimuoverla

## 📋 Checklist Azioni da Fare

### ⚠️ URGENTE

- [ ] **Aggiungi `AUTOMATION_SERVICE_TOKEN`** su Vercel
  - Name: `AUTOMATION_SERVICE_TOKEN`
  - Value: Lo stesso token che hai in `.env.local`
  - Scope: All Environments

### 🔍 DA VERIFICARE

- [ ] **Verifica `NEXTAUTH_URL`** su Vercel
  - Deve essere: `https://spediresicuro.vercel.app` (NON localhost!)
  - Aggiungi anche per Preview se necessario

- [ ] **Verifica `AUTOMATION_SERVICE_URL`**
  - Se hai un servizio automation separato (Railway), va bene
  - Se NON hai un servizio separato, puoi rimuoverla

### ✅ OPZIONALE

- [ ] **Aggiungi `CRON_SECRET_TOKEN`** (solo se usi cron job)
- [ ] **Rimuovi `GOOGLE_CLOUD_CREDENTIALS`** (se non la usi)

## 🎯 Riepilogo

**Variabili corrette:** 16/17 ✅
**Variabili mancanti:** 1 (AUTOMATION_SERVICE_TOKEN) ⚠️ **URGENTE**
**Variabili da verificare:** 1 (NEXTAUTH_URL scope - aggiungere Preview/Development)

**Stato:** Quasi completo! Manca solo `AUTOMATION_SERVICE_TOKEN`

## 📝 Template per Aggiungere su Vercel

Vai su Vercel Dashboard > Settings > Environment Variables > Add New

```
Name: AUTOMATION_SERVICE_TOKEN
Value: [il token che hai in .env.local]
Environment: ✅ Production, ✅ Preview, ✅ Development
```

---

**Nota:** Dopo aver aggiunto `AUTOMATION_SERVICE_TOKEN`, fai un nuovo deploy per applicare le modifiche!
