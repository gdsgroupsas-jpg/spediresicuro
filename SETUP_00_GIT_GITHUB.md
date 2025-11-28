# 🔧 SETUP GIT & GITHUB - SpediSicuro Platform

**Obiettivo**: Configurare Git e creare repository GitHub per version control e CI/CD.

---

## ⚠️ ATTENZIONE - IMPORTANTE

**Questo è il NUOVO progetto SpediSicuro!**

Esiste un vecchio progetto con nome simile. Prima di procedere:
- ✅ **VERIFICA** che stai lavorando sul repository corretto
- ✅ **CHIEDI** conferma all'utente prima di accedere a GitHub
- ✅ **NON** sovrascrivere repository esistenti
- ✅ Usa nome repository: `spediresicuro-new` o `spediresicuro-v2` se esiste già `spediresicuro`

---

## 📋 ISTRUZIONI PER COMET AGENT

Sei un agente di configurazione esperto. Il tuo compito è guidare l'utente nella configurazione di Git e GitHub per la **SpediSicuro Platform**, permettendo version control e deploy automatico su Vercel.

**PRIMA DI INIZIARE**: Chiedi all'utente conferma su quale account GitHub usare!

---

## PREREQUISITI

Verifica di avere:
- [ ] Git installato (`git --version`)
- [ ] Account GitHub (https://github.com)
- [ ] Accesso SSH o Personal Access Token

---

## STEP 1: Verifica Git Installato

### 1.1 Controlla Versione Git
```bash
git --version
```

**Output atteso**: `git version 2.x.x`

### 1.2 Se Git Non È Installato

**Linux (Ubuntu/Debian)**:
```bash
sudo apt update
sudo apt install git
```

**macOS**:
```bash
brew install git
# oppure
xcode-select --install
```

**Windows**:
- Scarica da https://git-scm.com/download/win
- Installa con impostazioni default

---

## STEP 2: Configurazione Git Locale

### 2.1 Imposta Nome e Email
```bash
# Nome utente (visibile nei commit)
git config --global user.name "Tuo Nome"

# Email (deve coincidere con GitHub)
git config --global user.email "tua.email@example.com"
```

### 2.2 Verifica Configurazione
```bash
git config --global --list
```

**Output atteso**:
```
user.name=Tuo Nome
user.email=tua.email@example.com
```

### 2.3 (Opzionale) Configura Editor Default
```bash
# VSCode
git config --global core.editor "code --wait"

# Vim
git config --global core.editor "vim"

# Nano
git config --global core.editor "nano"
```

---

## STEP 3: Inizializza Repository Git (se non fatto)

### 3.1 Naviga al Progetto
```bash
cd /home/user/spediresicuro
```

### 3.2 Verifica se Git È Già Inizializzato
```bash
git status
```

**Se vedi**: "Not a git repository"
```bash
# Inizializza Git
git init

# Crea branch main
git branch -M main
```

**Se vedi**: "On branch..." → Git già configurato! ✅ Vai a STEP 4.

### 3.3 Aggiungi .gitignore
Verifica che `.gitignore` esista e contenga:

```bash
cat .gitignore
```

Dovrebbe includere:
```gitignore
# Dependencies
node_modules/
.pnp/

# Next.js
.next/
out/
build/
dist/

# Environment variables (IMPORTANTE!)
.env
.env.local
.env*.local
.env.production

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Testing
coverage/
.nyc_output/

# Misc
*.log
.vercel
```

### 3.4 Primo Commit
```bash
# Aggiungi tutti i file (rispettando .gitignore)
git add .

# Crea commit iniziale
git commit -m "feat: initial commit - SpediSicuro Platform"

# Verifica
git log --oneline
```

**Output atteso**: Commit con hash e messaggio visibile

---

## STEP 4: Crea Repository GitHub

### 4.1 Login GitHub
1. Vai su https://github.com
2. Accedi con il tuo account
3. Clicca sul "+" in alto a destra → "New repository"

### 4.2 Configura Repository
**Repository name**: `spediresicuro` o `spediresicuro`

**Description**: `SpediSicuro Platform - Sistema gestionale spedizioni con OCR, fulfillment orchestrator e integrazioni e-commerce`

**Visibility**:
- **Public** (visibile a tutti, gratis, raccomandato per open source)
- **Private** (solo tu e collaboratori, gratis fino a 3 collaboratori)

**Initialize this repository with**:
- [ ] ❌ NO README (lo hai già in locale)
- [ ] ❌ NO .gitignore (lo hai già in locale)
- [ ] ❌ NO license (puoi aggiungerlo dopo)

Clicca **"Create repository"**

---

## STEP 5: Collega Repository Locale a GitHub

### 5.1 Copia URL Repository
Nella pagina del repository appena creato, copia l'URL:
- **HTTPS**: `https://github.com/username/spediresicuro.git`
- **SSH**: `git@github.com:username/spediresicuro.git`

Raccomandato: **SSH** (più sicuro, no password ogni volta)

### 5.2a Setup SSH (Raccomandato)

#### Genera SSH Key (se non hai)
```bash
# Genera chiave SSH
ssh-keygen -t ed25519 -C "tua.email@example.com"

# Premi Enter per default location (~/.ssh/id_ed25519)
# Premi Enter per no passphrase (o inserisci una)
```

#### Aggiungi SSH Key a GitHub
```bash
# Copia chiave pubblica negli appunti
cat ~/.ssh/id_ed25519.pub
```

1. Vai su GitHub → Settings → SSH and GPG keys
2. Clicca "New SSH key"
3. **Title**: `Laptop Dev` (o nome del tuo computer)
4. **Key**: Incolla il contenuto di `id_ed25519.pub`
5. Clicca "Add SSH key"

#### Test SSH
```bash
ssh -T git@github.com
```

**Output atteso**: `Hi username! You've successfully authenticated...` ✅

#### Aggiungi Remote con SSH
```bash
git remote add origin git@github.com:username/spediresicuro.git
```

### 5.2b Oppure: Setup HTTPS (Più Semplice)

#### Aggiungi Remote con HTTPS
```bash
git remote add origin https://github.com/username/spediresicuro.git
```

⚠️ **Nota**: Ti chiederà username/password ad ogni push. Meglio usare:
- **Personal Access Token** invece di password
- Oppure configura **Git Credential Manager**

#### Genera Personal Access Token
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token (classic)"
3. **Note**: `SpediSicuro Platform`
4. **Expiration**: 90 days (o No expiration)
5. **Scopes**: Seleziona `repo` (full control)
6. "Generate token"
7. **COPIA** il token (non lo vedrai più!)

Quando fai push, usa il token come password:
```
Username: your-username
Password: ghp_xxxxxxxxxxxxxxxxxxxx (il token)
```

---

## STEP 6: Push Codice su GitHub

### 6.1 Verifica Remote
```bash
git remote -v
```

**Output atteso**:
```
origin  git@github.com:username/spediresicuro.git (fetch)
origin  git@github.com:username/spediresicuro.git (push)
```

### 6.2 Push su Main Branch
```bash
# Prima push (crea branch main su GitHub)
git push -u origin main
```

**Output atteso**:
```
Enumerating objects: 150, done.
...
To github.com:username/spediresicuro.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

### 6.3 Verifica su GitHub
1. Vai su https://github.com/username/spediresicuro
2. Dovresti vedere tutti i file del progetto
3. Il README dovrebbe essere renderizzato nella homepage

---

## STEP 7: Configura Branch Protection (Raccomandato)

### 7.1 Vai su Settings
1. Repository → Settings → Branches
2. Clicca "Add rule"

### 7.2 Configura Protezione Main Branch
**Branch name pattern**: `main`

**Protect matching branches**:
- ✅ Require a pull request before merging
  - ✅ Require approvals: 1 (se lavori in team)
  - ✅ Dismiss stale pull request approvals
- ✅ Require status checks to pass before merging
  - Cerca "Vercel" e selezionalo (quando configuri Vercel)
- ✅ Require conversation resolution before merging
- ⬜ Require signed commits (opzionale, più sicuro)
- ✅ Include administrators (protezione anche per admin)

Clicca "Create"

---

## STEP 8: Configura GitHub Actions (CI/CD) - Opzionale

### 8.1 Crea Workflow Directory
```bash
mkdir -p .github/workflows
```

### 8.2 Crea Workflow CI
```bash
cat > .github/workflows/ci.yml << 'EOF'
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - uses: actions/checkout@v3

    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linter
      run: npm run lint

    - name: Build project
      run: npm run build
      env:
        NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

    - name: Run tests (if exists)
      run: npm test --if-present
EOF
```

### 8.3 Commit e Push
```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow"
git push
```

### 8.4 Verifica su GitHub
1. Vai su repository → Actions
2. Dovresti vedere il workflow "CI" in esecuzione
3. Attendi completamento (2-3 minuti)

---

## STEP 9: Aggiungi Collaboratori (Opzionale)

### 9.1 Se Repository Privato
1. Repository → Settings → Collaborators
2. Clicca "Add people"
3. Cerca username GitHub del collaboratore
4. Seleziona permesso:
   - **Read** (solo lettura)
   - **Write** (può pushare)
   - **Admin** (controllo completo)
5. Clicca "Add to repository"

Il collaboratore riceverà email di invito.

---

## STEP 10: Crea Branch Development

### 10.1 Strategia Branching (Git Flow)
```
main         → Production (solo deploy stabili)
develop      → Development (feature in test)
feature/*    → Singole feature (create da develop)
hotfix/*     → Fix urgenti (create da main)
```

### 10.2 Crea Branch Develop
```bash
# Crea branch develop da main
git checkout -b develop

# Push su GitHub
git push -u origin develop
```

### 10.3 Imposta Develop come Default (opzionale)
1. GitHub → Settings → Branches
2. **Default branch**: Cambia da `main` a `develop`
3. Clicca "Update"

Così le PR si apriranno su develop invece di main.

---

## ✅ CHECKLIST FINALE

Prima di procedere, verifica:

- [ ] Git installato e configurato (user.name + user.email)
- [ ] Repository Git inizializzato in locale
- [ ] `.gitignore` corretto (include .env.local!)
- [ ] Primo commit creato
- [ ] Repository GitHub creato
- [ ] SSH key configurata (o Personal Access Token)
- [ ] Remote origin aggiunto
- [ ] Codice pushato su GitHub
- [ ] Repository visibile su GitHub
- [ ] (Opzionale) Branch protection configurato
- [ ] (Opzionale) GitHub Actions configurato
- [ ] (Opzionale) Branch develop creato

---

## 📤 OUTPUT RICHIESTO

**Comet Agent, restituisci ESATTAMENTE questo formato:**

```env
# ============================================
# 🔧 GIT & GITHUB CONFIGURATION
# ============================================

# Repository URL (HTTPS)
GITHUB_REPO_URL=https://github.com/username/spediresicuro

# Repository URL (SSH)
GITHUB_REPO_SSH=git@github.com:username/spediresicuro.git

# Default Branch
GITHUB_DEFAULT_BRANCH=main

# Visibility
GITHUB_VISIBILITY=public|private

# Git User
GIT_USER_NAME=Tuo Nome
GIT_USER_EMAIL=tua.email@example.com

# SSH Key Configured
SSH_KEY_CONFIGURED=yes|no

# Personal Access Token (if using HTTPS)
# NON salvare il token qui! Usalo solo per git push
# GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxx

# ============================================
# ✅ SETUP GIT COMPLETATO
# ============================================
```

**Inoltre, conferma:**
- ✅ Repository creato: SI/NO
- ✅ Codice pushato: SI/NO
- ✅ SSH configurato: SI/NO
- ✅ Branch protection: SI/NO
- ✅ GitHub Actions: SI/NO
- ✅ Collaboratori aggiunti: __ (numero)

---

## 🚨 TROUBLESHOOTING

### Errore: "Permission denied (publickey)"
**Causa**: SSH key non configurata o non aggiunta a GitHub
**Soluzione**:
```bash
# Verifica SSH key esiste
ls ~/.ssh/id_ed25519.pub

# Se non esiste, genera
ssh-keygen -t ed25519 -C "tua.email@example.com"

# Aggiungi a GitHub (copia contenuto)
cat ~/.ssh/id_ed25519.pub

# Testa connessione
ssh -T git@github.com
```

### Errore: "remote: Repository not found"
**Causa**: URL remote errato o no permessi
**Soluzione**:
```bash
# Verifica remote
git remote -v

# Rimuovi remote sbagliato
git remote remove origin

# Aggiungi remote corretto
git remote add origin git@github.com:username/repo-corretto.git
```

### Errore: "failed to push some refs"
**Causa**: Branch locale dietro rispetto a remote
**Soluzione**:
```bash
# Pull changes da remote
git pull origin main --rebase

# Risolvi conflitti se presenti
# Poi push
git push origin main
```

### Errore: ".env.local appears in git status"
**CRITICO!** File sensibile esposto
**Soluzione IMMEDIATA**:
```bash
# Rimuovi da staging
git reset HEAD .env.local

# Assicurati sia in .gitignore
echo ".env.local" >> .gitignore

# Se già committato
git rm --cached .env.local
git commit -m "fix: remove .env.local from version control"

# Se già pushato su GitHub (MOLTO SERIO!)
# 1. Cambia TUTTE le credenziali immediatamente!
# 2. Usa BFG Repo-Cleaner per rimuovere dalla history
# https://rtyley.github.io/bfg-repo-cleaner/
```

---

## 🔐 SICUREZZA GIT

### File da NON Committare Mai
```
✅ Codice sorgente
✅ README, docs
✅ package.json, package-lock.json
✅ Configurazioni (non sensibili)

❌ .env, .env.local (credenziali!)
❌ node_modules/ (troppo grande)
❌ .next/, build/, dist/ (generati)
❌ File privati, chiavi, certificati
❌ Database dumps con dati reali
```

### Controlla Prima di Ogni Commit
```bash
# Vedi cosa stai per committare
git status
git diff --staged

# Controlla che .env.local NON appaia!
```

---

## 📚 Git Workflow Consigliato

### Feature Development
```bash
# 1. Crea branch da develop
git checkout develop
git pull origin develop
git checkout -b feature/nuova-funzionalita

# 2. Lavora sulla feature
# ... modifica file ...
git add .
git commit -m "feat: aggiungi nuova funzionalità"

# 3. Push feature branch
git push -u origin feature/nuova-funzionalita

# 4. Apri PR su GitHub (develop ← feature/nuova-funzionalita)

# 5. Dopo merge, elimina branch
git checkout develop
git pull origin develop
git branch -d feature/nuova-funzionalita
```

### Hotfix (Fix Urgente)
```bash
# 1. Crea branch da main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# 2. Fix il bug
git add .
git commit -m "fix: risolto bug critico in produzione"

# 3. Push e PR su main
git push -u origin hotfix/critical-bug

# 4. Apri PR su GitHub (main ← hotfix/critical-bug)

# 5. Dopo merge in main, merge anche in develop!
```

---

## 🎓 Comandi Git Essenziali

```bash
# Status e Info
git status                  # Vedi modifiche
git log --oneline          # Storia commit
git diff                   # Vedi modifiche non staged
git diff --staged          # Vedi modifiche staged

# Staging
git add file.txt           # Aggiungi file
git add .                  # Aggiungi tutto
git reset HEAD file.txt    # Rimuovi da staging

# Commit
git commit -m "message"    # Commit con messaggio
git commit --amend         # Modifica ultimo commit

# Branch
git branch                 # Lista branch
git branch nome            # Crea branch
git checkout nome          # Cambia branch
git checkout -b nome       # Crea e cambia
git branch -d nome         # Elimina branch

# Remote
git pull origin main       # Scarica da remote
git push origin main       # Carica su remote
git fetch origin           # Scarica senza merge

# Undo (attenzione!)
git reset --soft HEAD~1    # Annulla commit (mantieni modifiche)
git reset --hard HEAD~1    # Annulla commit (elimina modifiche)
git revert HEAD            # Crea commit di revert
```

---

## ➡️ PROSSIMO STEP

Una volta completato questo setup, procedi con:
- **SETUP_01_SUPABASE.md** - Configurazione database

---

**Inizia ora! Configura Git e GitHub per iniziare a versioning il progetto.** 🚀
