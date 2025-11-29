# 🚀 Deploy Automatico su Vercel

## ✅ Come Funziona

**Ogni volta che fai `git push` su GitHub, Vercel deploya automaticamente!**

### Flusso Automatico:
1. Modifichi il codice
2. Fai `git add .` → `git commit -m "..."` → `git push`
3. **Vercel rileva automaticamente il push**
4. **Vercel builda e deploya automaticamente**
5. Il sito è online in 1-2 minuti!

## 📋 Setup Iniziale (da fare UNA volta)

### 1. Collega Vercel a GitHub

1. Vai su [vercel.com](https://vercel.com) e accedi
2. Clicca su "Add New..." → "Project"
3. Importa la repository: `gdsgroupsas-jpg/spediresicuro`
4. **IMPORTANTE**: Crea un NUOVO progetto (non usare quello vecchio "spedire sicuro platform")
5. Vercel rileva automaticamente Next.js
6. Clicca "Deploy"

### 2. Configurazione Automatica

Vercel configurerà automaticamente:
- ✅ Build Command: `npm run build`
- ✅ Output Directory: `.next`
- ✅ Install Command: `npm install`
- ✅ Framework: Next.js

### 3. Deploy Automatico Attivo

Dopo il primo deploy, ogni `git push` su `master` triggera automaticamente un nuovo deploy!

## 🔄 Workflow Quotidiano

```bash
# 1. Lavori sul codice
# 2. Salvi i file
# 3. Carichi su GitHub:
git add .
git commit -m "Aggiunta nuova funzionalità"
git push

# 4. Vercel deploya automaticamente in 1-2 minuti!
# 5. Il sito è aggiornato online!
```

## 🌐 URL del Sito

Dopo il primo deploy, Vercel ti darà un URL tipo:
- `spediresicuro.vercel.app` (gratuito)
- Puoi collegare il dominio `spediresicuro.it` dopo

## ⚙️ Variabili Ambiente (se necessario in futuro)

Se aggiungi variabili ambiente (es. API keys):
1. Vai su Vercel Dashboard → Settings → Environment Variables
2. Aggiungi le variabili
3. Vercel le userà automaticamente nei deploy

## 📊 Monitoraggio Deploy

- Vai su Vercel Dashboard per vedere lo stato dei deploy
- Ogni deploy mostra: successo/errore, tempo di build, URL

## ⚠️ IMPORTANTE

- **Account Vercel**: Usa lo stesso account del vecchio progetto, ma crea un NUOVO progetto
- **Branch**: Il deploy automatico funziona solo sul branch `master`
- **Build Errors**: Se il build fallisce, Vercel ti avvisa via email

