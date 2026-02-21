# 🤖 Setup Automatico Railway - Script

**Tempo:** 5 minuti (invece di 10 manuali)

---

## 🚀 METODO 1: Script Automatico (CONSIGLIATO)

### Windows (PowerShell)

1. **Installa Railway CLI:**

   ```powershell
   npm install -g @railway/cli
   ```

2. **Login Railway:**

   ```powershell
   railway login
   ```

3. **Esegui script:**
   ```powershell
   cd automation-service
   .\setup-railway.ps1
   ```

Lo script fa tutto automaticamente:

- ✅ Verifica Railway CLI
- ✅ Legge variabili da `.env.local`
- ✅ Crea/seleziona progetto
- ✅ Crea servizio automation
- ✅ Configura variabili d'ambiente
- ✅ Genera domain (se possibile)
- ✅ Fa deploy (opzionale)

### Mac/Linux (Bash)

1. **Installa Railway CLI:**

   ```bash
   npm install -g @railway/cli
   ```

2. **Login Railway:**

   ```bash
   railway login
   ```

3. **Rendi eseguibile e esegui:**
   ```bash
   cd automation-service
   chmod +x setup-railway.sh
   ./setup-railway.sh
   ```

---

## 📋 COSA FA LO SCRIPT

1. **Verifica Prerequisiti**
   - Railway CLI installato
   - Loggato in Railway

2. **Legge Configurazione**
   - Legge variabili da `.env.local` (se esiste)
   - Oppure chiede input manuale

3. **Configura Railway**
   - Crea/seleziona progetto
   - Crea servizio `automation-service`
   - Imposta variabili d'ambiente:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `ENCRYPTION_KEY`
     - `NODE_ENV=production`

4. **Deploy (Opzionale)**
   - Chiede se vuoi fare deploy subito
   - Oppure puoi farlo dopo manualmente

---

## ⚠️ COSE DA FARE MANUALMENTE (2 minuti)

Dopo lo script, devi solo:

1. **Root Directory** (obbligatorio)
   - Railway Dashboard → Settings → Root Directory
   - Imposta: `automation-service`

2. **Generate Domain** (se non generato automaticamente)
   - Railway Dashboard → Settings → Networking
   - Clicca "Generate Domain"
   - Copia URL

3. **Aggiungi URL a Vercel**
   - Vercel Dashboard → Environment Variables
   - Aggiungi: `AUTOMATION_SERVICE_URL=https://tuo-url-railway.app`

---

## 🎯 METODO 2: Config as Code (Avanzato)

Railway supporta anche "Config as Code" tramite file `railway.toml`.

Il file `railway.toml` è già presente in `automation-service/`.

**Come usarlo:**

1. **Link progetto:**

   ```bash
   railway link
   ```

2. **Deploy:**
   ```bash
   railway up
   ```

Railway leggerà automaticamente `railway.toml` e configurerà tutto.

**Nota:** Root directory potrebbe comunque richiedere configurazione manuale su Dashboard.

---

## 📊 CONFRONTO

| Metodo                | Tempo  | Difficoltà       | Automazione |
| --------------------- | ------ | ---------------- | ----------- |
| **Script Automatico** | 5 min  | ⭐ Facile        | 90%         |
| **Config as Code**    | 3 min  | ⭐⭐ Medio       | 80%         |
| **Manuale**           | 10 min | ⭐⭐⭐ Difficile | 0%          |

---

## ✅ CHECKLIST POST-SCRIPT

Dopo aver eseguito lo script:

- [ ] Root directory configurato su Dashboard
- [ ] Domain generato e copiato
- [ ] `AUTOMATION_SERVICE_URL` aggiunto a Vercel
- [ ] Health check funziona: `https://tuo-url/health`
- [ ] Test sync dalla dashboard admin

---

## 🐛 TROUBLESHOOTING

### Errore: "Railway CLI non trovato"

**Soluzione:**

```bash
npm install -g @railway/cli
```

### Errore: "Non loggato in Railway"

**Soluzione:**

```bash
railway login
```

### Errore: "Variabili d'ambiente mancanti"

**Soluzione:**

- Verifica che `.env.local` esista nella root del progetto
- Oppure inserisci manualmente quando richiesto

### Root Directory non funziona

**Soluzione:**

- Configura manualmente su Railway Dashboard
- Settings → Root Directory → `automation-service`

---

## 🎉 RISULTATO

Dopo lo script + 2 minuti manuali:

- ✅ Servizio Railway configurato
- ✅ Variabili d'ambiente impostate
- ✅ Deploy completato
- ✅ Pronto per usare!

**Tempo totale: 7 minuti** (vs 10 minuti manuali)

---

**Usa lo script automatico per risparmiare tempo!** 🚀
