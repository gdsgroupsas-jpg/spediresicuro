# 🌐 SETUP LAVORO REMOTO - Continua da Web

## 🎯 Opzioni Disponibili

Hai 3 opzioni principali per lavorare da remoto:

---

## 🥇 OPZIONE 1: GitHub Codespaces (CONSIGLIATO)

**Vantaggi:**
- ✅ Gratuito per account personali (60h/mese)
- ✅ Setup automatico (VS Code nel browser)
- ✅ Accesso diretto a repository GitHub
- ✅ Terminal integrato
- ✅ Port forwarding automatico

### Setup (5 minuti)

1. **Vai su GitHub:**
   - Repository: `https://github.com/gdsgroupsas-jpg/spediresicuro`
   - Clicca su **"Code"** → **"Codespaces"** → **"Create codespace on main"**

2. **Attendi creazione** (2-3 minuti)

3. **Una volta aperto:**
   ```bash
   # Installa dipendenze (se necessario)
   npm install
   
   # Avvia server
   npm run dev
   ```

4. **Accedi all'app:**
   - Codespaces ti mostra un URL tipo: `https://xxxxx-3000.app.github.dev`
   - Clicca per aprire l'app nel browser

### Configurazione Environment

1. **Crea file `.env.local`** in Codespaces:
   ```bash
   # Copia variabili da .env.example.txt
   cp env.example.txt .env.local
   ```

2. **Aggiungi variabili sensibili:**
   - Vai su **Settings** → **Secrets and variables** → **Codespaces**
   - Aggiungi secrets per:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `GOOGLE_CLIENT_ID`
     - `GOOGLE_CLIENT_SECRET`
     - etc.

3. **Riavvia Codespace** per caricare secrets

### Port Forwarding

- Codespaces apre automaticamente porta 3000
- Se serve altra porta, vai su **Ports** tab e aggiungi manualmente

---

## 🥈 OPZIONE 2: Gitpod

**Vantaggi:**
- ✅ Gratuito (50h/mese)
- ✅ VS Code nel browser
- ✅ Prebuild automatico

### Setup

1. **Installa Gitpod extension** (opzionale)
2. **Vai su:** `https://gitpod.io/#https://github.com/gdsgroupsas-jpg/spediresicuro`
3. **Attendi setup** (2-3 minuti)
4. **Avvia server:**
   ```bash
   npm run dev
   ```

### Configurazione

Crea file `.gitpod.yml` nella root:

```yaml
tasks:
  - init: npm install
    command: npm run dev
ports:
  - port: 3000
    onOpen: open-browser
```

---

## 🥉 OPZIONE 3: Vercel Dev (Sviluppo Cloud)

**Vantaggi:**
- ✅ Deploy istantaneo
- ✅ Preview URL per ogni branch
- ✅ Integrazione GitHub automatica

### Setup

1. **Installa Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login:**
   ```bash
   vercel login
   ```

3. **Link progetto:**
   ```bash
   vercel link
   ```

4. **Deploy dev:**
   ```bash
   vercel dev
   ```

5. **Ottieni URL preview** (es. `https://spediresicuro-xxxxx.vercel.app`)

### Nota
- Ogni modifica viene deployata automaticamente
- Utile per testare in ambiente simile a produzione

---

## 🔧 CONFIGURAZIONE COMUNE (Tutte le Opzioni)

### 1. Environment Variables

Crea `.env.local` con:

```env
# Supabase (opzionale)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx

# NextAuth
NEXTAUTH_URL=https://tuo-url.app
NEXTAUTH_SECRET=genera-con-openssl-rand-base64-32

# OAuth (opzionale)
GOOGLE_CLIENT_ID=xxxxx
GOOGLE_CLIENT_SECRET=xxxxx
GITHUB_CLIENT_ID=xxxxx
GITHUB_CLIENT_SECRET=xxxxx

# AI/OCR (opzionale)
ANTHROPIC_API_KEY=sk-ant-xxxxx
GOOGLE_CLOUD_VISION_API_KEY=xxxxx
```

### 2. Database Locale

Il database JSON locale (`data/database.json`) funziona anche in remoto.

**Nota:** I dati non persistono tra riavvii di Codespaces/Gitpod (usa Supabase per persistenza).

### 3. Git Workflow

```bash
# Prima di lasciare locale
git add .
git commit -m "WIP: lavoro in corso"
git push origin master

# Quando riprendi da remoto
git pull origin master
npm install  # Se ci sono nuove dipendenze
npm run dev
```

---

## 📋 CHECKLIST PRE-TRANSIZIONE

Prima di lasciare il locale, assicurati:

- [ ] **Commit tutto il lavoro:**
  ```bash
  git status
  git add .
  git commit -m "Descrizione modifiche"
  git push origin master
  ```

- [ ] **Verifica che funzioni:**
  - [ ] Server si avvia senza errori
  - [ ] Login funziona
  - [ ] Pagina integrazioni funziona
  - [ ] Salvataggio integrazione funziona

- [ ] **Documenta stato:**
  - [ ] Cosa hai testato
  - [ ] Cosa funziona
  - [ ] Cosa non funziona ancora
  - [ ] Prossimi passi

- [ ] **Salva variabili ambiente:**
  - [ ] Copia `.env.local` in un posto sicuro (password manager)
  - [ ] O aggiungi secrets in GitHub/Gitpod

---

## 🚀 QUICK START (Quando Riprendi da Remoto)

### GitHub Codespaces

1. Vai su: `https://github.com/gdsgroupsas-jpg/spediresicuro`
2. Clicca **"Code"** → **"Codespaces"** → **"Create codespace"**
3. Attendi 2-3 minuti
4. Nel terminal:
   ```bash
   npm install
   npm run dev
   ```
5. Clicca URL che appare (tipo `https://xxxxx-3000.app.github.dev`)

### Gitpod

1. Vai su: `https://gitpod.io/#https://github.com/gdsgroupsas-jpg/spediresicuro`
2. Attendi setup
3. Nel terminal:
   ```bash
   npm run dev
   ```

---

## 💡 TIPS

### Persistenza Dati

- **Database locale:** Non persiste tra riavvii (usa Supabase)
- **File modificati:** Persistono se committati su Git
- **Environment vars:** Usa secrets di GitHub/Gitpod

### Performance

- Codespaces/Gitpod possono essere più lenti del locale
- Usa `npm run build` per testare build production
- Considera Vercel per deploy veloce

### Debugging

- Console browser: F12 anche in remoto
- Server logs: visibili nel terminal Codespaces/Gitpod
- Supabase logs: Dashboard → Logs

---

## 🆘 PROBLEMI COMUNI

### "Port already in use"
```bash
# Trova processo
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Kill processo
kill -9 <PID>  # Mac/Linux
taskkill /PID <PID> /F  # Windows
```

### "Module not found"
```bash
rm -rf node_modules package-lock.json
npm install
```

### "Environment variables not loaded"
- Verifica che `.env.local` esista
- Riavvia server dopo modifiche a `.env.local`
- In Codespaces, usa Secrets invece di file locale

---

## 📝 NOTE FINALI

- **GitHub Codespaces** è la soluzione più semplice e integrata
- **Gitpod** è alternativa valida se Codespaces non disponibile
- **Vercel Dev** è utile per testare deploy, meno per sviluppo attivo
- **Tutti i dati** devono essere committati su Git per persistenza
- **Environment vars** sensibili vanno in secrets, non in Git

---

**Buon lavoro remoto! 🚀**

