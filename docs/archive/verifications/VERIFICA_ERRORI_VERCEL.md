# 🔍 Guida: Verifica Errori su Vercel

## 📋 Come Trovare gli Errori

### Passo 1: Accedi al Dashboard Vercel

1. Vai su [vercel.com](https://vercel.com)
2. Accedi al tuo account
3. Seleziona il progetto **spediresicuro**

### Passo 2: Controlla i Deploy

1. Clicca su **"Deployments"** nel menu laterale
2. Trova l'ultimo deploy (quello con l'ora più recente)
3. Clicca sul deploy per aprire i dettagli

### Passo 3: Verifica gli Errori

Ci sono 3 posti dove controllare:

#### A) Build Logs (durante il build)

- Nella pagina del deploy, scorri fino a **"Build Logs"**
- Cerca messaggi in rosso o che iniziano con `Error:`, `Failed:`, `❌`

#### B) Runtime Logs (quando l'app gira)

- Nella pagina del deploy, clicca su **"Runtime Logs"** o **"Function Logs"**
- Qui vedi gli errori quando qualcuno visita il sito
- Cerca messaggi in rosso

#### C) Console del Browser

- Apri il sito deployato su Vercel
- Premi `F12` per aprire gli strumenti sviluppatore
- Vai alla tab **"Console"**
- Cerca messaggi in rosso

---

## 🔧 Errori Comuni e Soluzioni

### ❌ Errore: "NEXTAUTH_SECRET is missing"

**Causa:** La variabile `NEXTAUTH_SECRET` non è configurata su Vercel

**Soluzione:**

1. Vai su Vercel → Il tuo progetto → **Settings** → **Environment Variables**
2. Aggiungi:
   - **Name:** `NEXTAUTH_SECRET`
   - **Value:** (usa lo stesso valore del tuo `.env.local`)
   - **Environment:** Seleziona tutte (Production, Preview, Development)
3. Clicca **Save**
4. Fai un nuovo deploy (o aspetta che Vercel lo faccia automaticamente)

---

### ❌ Errore: "Supabase connection failed"

**Causa:** Le variabili Supabase non sono configurate correttamente

**Soluzione:**

1. Vai su Vercel → Il tuo progetto → **Settings** → **Environment Variables**
2. Verifica che ci siano:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (opzionale)
3. Controlla che i valori siano corretti (non placeholder)
4. Salva e fai un nuovo deploy

---

### ❌ Errore: "Module not found" o "Cannot find module"

**Causa:** Una dipendenza mancante o un import errato

**Soluzione:**

1. Controlla il file `package.json` - tutte le dipendenze sono installate?
2. Verifica che il file esista nel percorso indicato
3. Controlla che gli import siano corretti (case-sensitive!)

---

### ❌ Errore: "500 Internal Server Error"

**Causa:** Errore generico del server

**Soluzione:**

1. Controlla i **Runtime Logs** su Vercel per vedere l'errore specifico
2. Verifica che tutte le variabili d'ambiente siano configurate
3. Controlla che le API esterne (Supabase, OAuth) siano configurate correttamente

---

### ❌ Errore: "NEXTAUTH_URL must be set"

**Causa:** La variabile `NEXTAUTH_URL` non è configurata o è sbagliata

**Soluzione:**

1. Vai su Vercel → Il tuo progetto → **Settings** → **Environment Variables**
2. Aggiungi:
   - **Name:** `NEXTAUTH_URL`
   - **Value:** `https://il-tuo-dominio.vercel.app` (sostituisci con il tuo dominio Vercel)
   - **Environment:** Production
3. Per Preview/Development puoi usare: `http://localhost:3000`
4. Salva e fai un nuovo deploy

---

## ✅ Checklist Pre-Deploy

Prima di fare un deploy, verifica:

- [ ] Tutte le variabili d'ambiente sono configurate su Vercel
- [ ] I valori non sono placeholder (non contengono "your-", "xxxxx", "placeholder")
- [ ] `NEXTAUTH_SECRET` è configurato (obbligatorio!)
- [ ] `NEXTAUTH_URL` è configurato con l'URL corretto di Vercel
- [ ] Le variabili Supabase sono configurate (se usi Supabase)
- [ ] Il build locale funziona (`npm run build`)

---

## 🆘 Se Non Trovi l'Errore

1. **Copia TUTTO il log** (Build Logs + Runtime Logs)
2. **Fai uno screenshot** della pagina di errore (se c'è)
3. **Condividi** con me così posso aiutarti meglio

---

## 📝 Note Importanti

- ⚠️ Le variabili d'ambiente su Vercel sono **diverse** da quelle nel file `.env.local` locale
- 🔄 Dopo aver aggiunto/modificato variabili su Vercel, devi fare un **nuovo deploy**
- 🔒 Le variabili con `NEXT_PUBLIC_` sono visibili nel browser (non mettere chiavi segrete!)
- 🚫 Le variabili senza `NEXT_PUBLIC_` sono solo server-side (più sicure)
