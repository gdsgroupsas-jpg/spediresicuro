# 🚂 DEPLOY SU RAILWAY - GUIDA COMPLETA

## 🎯 COSA È RAILWAY

Railway è la piattaforma di deploy per il **servizio di automazione** (`automation-service`).

**Struttura deploy:**

- **Vercel** → Progetto Next.js principale (`spediresicuro/`)
- **Railway** → Servizio automazione (`automation-service/`)

## ✅ COME FUNZIONA IL DEPLOY

Railway è **sincronizzato automaticamente** con GitHub:

- Ogni **push su `master`** → Railway scarica automaticamente
- Railway usa il **Dockerfile** in `automation-service/Dockerfile`
- Build automatico quando rileva cambiamenti

## 🔧 CORREZIONE ERRORI BUILD

### Errore risolto oggi:

```
error TS2339: Property 'find' does not exist on type 'NodeListOf<HTMLTableCellElement>'
```

### Soluzione applicata:

- Convertito `NodeListOf` in array con `Array.from()`
- Aggiunto tipi espliciti per parametri `find()`
- File corretto: `automation-service/src/agent.ts`

## 📋 VERIFICA DEPLOY

### 1. GitHub

Vai su: **https://github.com/gdsgroupsas-jpg/spediresicuro**

- Controlla commit recenti
- Dovresti vedere: "fix: Risolti errori TypeScript in agent.ts..."

### 2. Railway Dashboard

Vai su: **https://railway.app/dashboard**

- Seleziona progetto `spediresicuro-automation-service`
- Controlla deploy recenti
- Dovresti vedere un nuovo deploy in corso/completato

### 3. Log Railway

- Clicca sul deploy → **Logs**
- Verifica che il build sia completato senza errori
- Dovresti vedere: "Build successful" o "Deployment successful"

## 🚨 SE IL DEPLOY FALLISCE

1. **Controlla i log Railway** per vedere l'errore esatto
2. **Verifica che il commit sia su GitHub** (Railway legge da lì)
3. **Controlla il Dockerfile** - deve essere in `automation-service/Dockerfile`
4. **Verifica che `npm run build` funzioni localmente**

## 📝 FILE IMPORTANTI

- `automation-service/Dockerfile` - Configurazione Docker per Railway
- `automation-service/railway.json` - Config Railway
- `automation-service/src/agent.ts` - Codice principale (corretto oggi)
- `automation-service/package.json` - Dipendenze

## ✅ CHECKLIST POST-DEPLOY

- [ ] Commit pushato su GitHub
- [ ] Railway ha rilevato il nuovo commit
- [ ] Build completato senza errori
- [ ] Servizio online e funzionante
- [ ] Log Railway senza errori

---

**Railway si aggiorna automaticamente quando fai push su GitHub!** 🚂
