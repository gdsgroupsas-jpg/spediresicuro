# 🔍 Guida Verifica API Keys AI Provider

## 📋 Riepilogo

Questa guida ti aiuta a verificare se le API keys per i provider AI sono configurate correttamente sia in locale che su Vercel.

## ✅ Verifica Locale (.env.local)

### Metodo 1: Script Automatico (Consigliato)

```bash
npx tsx scripts/verify-ai-api-keys.ts
```

Lo script mostra:
- ✅ Status di ogni API key (configurata/non configurata)
- 📏 Lunghezza e prefisso della chiave
- ✅ Verifica formato corretto
- 📊 Riepilogo provider disponibili

### Metodo 2: Verifica Manuale

1. **Apri il file `.env.local`** nella root del progetto
2. **Verifica che contenga:**

```env
# Anthropic Claude API Key (obbligatorio per default)
ANTHROPIC_API_KEY=sk-ant-api03-...

# DeepSeek API Key (opzionale)
DEEPSEEK_API_KEY=sk-...

# Google Gemini API Key (opzionale)
GOOGLE_API_KEY=...
```

3. **Formato chiavi:**
   - `ANTHROPIC_API_KEY`: deve iniziare con `sk-ant-api03-`
   - `DEEPSEEK_API_KEY`: deve iniziare con `sk-`
   - `GOOGLE_API_KEY`: formato Google API key (inizia con `AIzaSy...`)

### Metodo 3: Verifica nel Codice

Il componente UI mostra automaticamente lo stato delle API keys:
1. Vai su `/dashboard/super-admin`
2. Nella sezione "Provider AI per Anne" vedrai:
   - ✅ Provider con API key configurata (cliccabile)
   - ⚠️ Provider con API key non configurata (disabilitato)

---

## ✅ Verifica Vercel (Produzione)

### Metodo 1: Vercel Dashboard (Consigliato)

1. **Vai su Vercel Dashboard**
   - URL: https://vercel.com/dashboard
   - Accedi con il tuo account

2. **Seleziona il Progetto**
   - Clicca sul progetto **spediresicuro**

3. **Vai su Environment Variables**
   - Clicca su **Settings** (⚙️) nella barra superiore
   - Nel menu laterale, clicca su **Environment Variables**

4. **Verifica Variabili**
   - Cerca `ANTHROPIC_API_KEY` (obbligatorio)
   - Cerca `DEEPSEEK_API_KEY` (opzionale)
   - Cerca `GOOGLE_API_KEY` (opzionale, per Gemini)
   - Verifica che siano presenti per:
     - ✅ Production
     - ✅ Preview
     - ✅ Development

### Metodo 2: Vercel CLI

```bash
# Lista tutte le variabili d'ambiente
npx vercel env ls

# Dovresti vedere:
# ANTHROPIC_API_KEY (Production, Preview, Development)
# DEEPSEEK_API_KEY (Production, Preview, Development) [opzionale]
# GOOGLE_API_KEY (Production, Preview, Development) [opzionale]
```

### Metodo 3: Verifica via UI (Produzione)

1. **Vai su produzione**: https://spediresicuro.vercel.app
2. **Accedi come superadmin**
3. **Vai su `/dashboard/super-admin`**
4. **Controlla la sezione "Provider AI per Anne"**
   - Se vedi "API Key non configurata" → la chiave non è su Vercel
   - Se vedi il provider cliccabile → la chiave è configurata

---

## 🔧 Come Aggiungere API Keys

### Locale (.env.local)

1. **Crea/modifica `.env.local`** nella root del progetto:

```env
# Anthropic Claude (obbligatorio per default)
ANTHROPIC_API_KEY=sk-ant-api03-TUA_CHIAVE_QUI

# DeepSeek (opzionale)
DEEPSEEK_API_KEY=sk-TUA_CHIAVE_QUI

# Google Gemini (opzionale)
GOOGLE_API_KEY=TUA_CHIAVE_GEMINI_QUI
```

2. **Riavvia il server di sviluppo:**
```bash
npm run dev
```

### Vercel (Produzione)

#### Opzione A: Vercel Dashboard

1. Vai su **Vercel Dashboard** → **Settings** → **Environment Variables**
2. Clicca **"Add New"**
3. Aggiungi:
   - **Name**: `ANTHROPIC_API_KEY`
   - **Value**: La tua chiave API
   - **Environments**: Seleziona Production, Preview, Development
4. Clicca **"Save"**
5. Ripeti per `DEEPSEEK_API_KEY` (se necessario)

#### Opzione B: Vercel CLI

```bash
# Aggiungi ANTHROPIC_API_KEY
echo "TUA_CHIAVE_ANTHROPIC" | npx vercel env add ANTHROPIC_API_KEY production
echo "TUA_CHIAVE_ANTHROPIC" | npx vercel env add ANTHROPIC_API_KEY preview
echo "TUA_CHIAVE_ANTHROPIC" | npx vercel env add ANTHROPIC_API_KEY development

# Aggiungi DEEPSEEK_API_KEY (opzionale)
echo "TUA_CHIAVE_DEEPSEEK" | npx vercel env add DEEPSEEK_API_KEY production
echo "TUA_CHIAVE_DEEPSEEK" | npx vercel env add DEEPSEEK_API_KEY preview
echo "TUA_CHIAVE_DEEPSEEK" | npx vercel env add DEEPSEEK_API_KEY development

# Aggiungi GOOGLE_API_KEY (opzionale, per Gemini)
echo "TUA_CHIAVE_GEMINI" | npx vercel env add GOOGLE_API_KEY production
echo "TUA_CHIAVE_GEMINI" | npx vercel env add GOOGLE_API_KEY preview
echo "TUA_CHIAVE_GEMINI" | npx vercel env add GOOGLE_API_KEY development
```

**⚠️ IMPORTANTE**: Dopo aver aggiunto le variabili su Vercel, devi fare un nuovo deploy!

---

## 🧪 Test Funzionamento

### Test Locale

1. **Verifica script:**
```bash
npx tsx scripts/verify-ai-api-keys.ts
```

2. **Test UI:**
   - Vai su `http://localhost:3000/dashboard/super-admin`
   - Verifica che i provider mostrino lo stato corretto delle API keys

3. **Test Anne:**
   - Apri Anne e fai una domanda
   - Verifica nei log del server che usi il provider corretto

### Test Produzione

1. **Verifica UI:**
   - Vai su `https://spediresicuro.vercel.app/dashboard/super-admin`
   - Verifica che i provider mostrino lo stato corretto

2. **Test Anne:**
   - Apri Anne in produzione
   - Verifica che funzioni correttamente

---

## 📊 Checklist Verifica

### Locale
- [ ] `.env.local` contiene `ANTHROPIC_API_KEY`
- [ ] `.env.local` contiene `DEEPSEEK_API_KEY` (opzionale)
- [ ] `.env.local` contiene `GOOGLE_API_KEY` (opzionale, per Gemini)
- [ ] Script `verify-ai-api-keys.ts` mostra ✅ per le chiavi configurate
- [ ] UI superadmin mostra provider disponibili

### Produzione (Vercel)
- [ ] `ANTHROPIC_API_KEY` presente su Vercel (Production, Preview, Development)
- [ ] `DEEPSEEK_API_KEY` presente su Vercel (opzionale)
- [ ] `GOOGLE_API_KEY` presente su Vercel (opzionale, per Gemini)
- [ ] Deploy completato dopo aggiunta variabili
- [ ] UI superadmin in produzione mostra provider disponibili

---

## 🐛 Troubleshooting

### "API Key non configurata" in UI

**Causa**: La variabile d'ambiente non è configurata o non è accessibile.

**Soluzione**:
1. Verifica che la variabile sia in `.env.local` (locale) o Vercel (produzione)
2. Riavvia il server (locale) o fai nuovo deploy (produzione)
3. Verifica che il nome della variabile sia esatto (case-sensitive)

### Provider non cambia

**Causa**: La preferenza non viene salvata nel database.

**Soluzione**:
1. Verifica di essere loggato come superadmin
2. Controlla i log del server per errori
3. Verifica che la migration `058_ai_provider_preferences.sql` sia stata applicata

### Anne non funziona dopo cambio provider

**Causa**: L'API key del nuovo provider non è configurata.

**Soluzione**:
1. Verifica che l'API key del provider selezionato sia configurata
2. Controlla i log del server per errori API
3. Verifica che l'API key sia valida e non scaduta

---

## 📝 Note Importanti

1. **Sicurezza**: Le API keys sono sensibili. Non committare mai `.env.local` nel repository.
2. **Formato**: Le chiavi devono essere esatte, senza spazi o virgolette.
3. **Deploy**: Dopo aver aggiunto variabili su Vercel, sempre fare nuovo deploy.
4. **Fallback**: Se un provider non ha API key, il sistema usa mock response o fallback ad Anthropic.

---

**Ultimo aggiornamento**: 2026-01-03
**Script verifica**: `scripts/verify-ai-api-keys.ts`

