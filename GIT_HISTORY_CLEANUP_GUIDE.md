# 🧹 Guida: Pulizia Git History - Rimozione `.env.railway`

## ⚠️ AVVERTENZE CRITICHE

**Questa operazione è DISTRUTTIVA:**
- Riscrive completamente la Git history
- Richiede `--force` push (sovrascrive il repository remoto)
- Se lavori in team, **TUTTI** devono coordinarsi e re-clonare/resettare dopo la riscrittura
- Vercel autodeploy su master può triggerare al force-push; pianifica una finestra di manutenzione
- **PRIMA** di procedere, i secrets devono essere **ROTATI** in Supabase/Railway/etc (già fatto)

---

## 📋 PRE-EXECUTION CHECKLIST

Prima di eseguire la pulizia della history, verifica:

- [x] **PROMPT A eseguito**: working directory pulito, `.gitignore` aggiornato, push completato
- [x] **Secrets rotati**: 
  - `SUPABASE_SERVICE_ROLE_KEY` → rotata in Supabase Dashboard
  - `ENCRYPTION_KEY` → generata nuova (64 hex)
  - `AUTOMATION_SERVICE_TOKEN` → generato nuovo
- [ ] **Accesso admin**: conferma di avere accesso admin al repository GitHub e permessi per force-push
- [ ] **Notifica team**: se lavori in team, notifica che devono re-clonare o hard reset dopo la riscrittura
- [ ] **Vercel**: pausa/monitora i deploy (opzionale ma consigliato)
- [x] **Verifica history**: `.env.railway` presente nella history (2 commit trovati)

---

## 🔍 Verifica Pre-Esecuzione

Esegui questo comando per verificare che `.env.railway` sia nella history:

```bash
git log --all --full-history -- .env.railway
```

**Risultato atteso**: Dovresti vedere almeno 2 commit che contengono `.env.railway`

Se questo comando non restituisce nulla, **NON procedere** con la riscrittura della history.

---

## 🛠️ Installazione Strumenti

### Opzione 1: BFG Repo-Cleaner (Consigliato)

**Windows:**
```powershell
# Scarica BFG da: https://rtyley.github.io/bfg-repo-cleaner/
# Salva come bfg.jar nella root del progetto
```

**Linux/Mac:**
```bash
# Con Homebrew (Mac)
brew install bfg

# Con apt (Ubuntu/Debian)
sudo apt-get install bfg

# Oppure scarica JAR manualmente
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar -O bfg.jar
```

### Opzione 2: git-filter-repo

**Windows:**
```powershell
# Con pip (richiede Python)
pip install git-filter-repo
```

**Linux/Mac:**
```bash
# Con pip
pip install git-filter-repo

# Con apt (Ubuntu/Debian)
sudo apt-get install git-filter-repo
```

---

## 🚀 Esecuzione

### Metodo 1: Script Bash (Linux/Mac/WSL)

```bash
chmod +x scripts/cleanup-git-history.sh
./scripts/cleanup-git-history.sh
```

### Metodo 2: Script PowerShell (Windows)

```powershell
.\scripts\cleanup-git-history.ps1
```

### Metodo 3: Esecuzione Manuale

Se preferisci eseguire manualmente, segui questi passaggi:

#### 1. Backup Obbligatorio

```bash
# Crea backup bundle
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
git bundle create "../repo-backup-${TIMESTAMP}.bundle" --all
```

#### 2. Scegli Strumento

**Con BFG:**
```bash
bfg --delete-files .env.railway
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

**Con git-filter-repo:**
```bash
git filter-repo --path .env.railway --invert-paths
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

#### 3. Verifica Post-Pulizia

```bash
# Deve restituire NESSUN risultato
git log --all --full-history -- .env.railway
```

#### 4. Force Push (DISTRUTTIVO)

```bash
git push --force --all origin
git push --force --tags origin
```

---

## ✅ POST-VERIFICATION CHECKLIST

Dopo l'esecuzione, verifica:

- [ ] `git log --all --full-history -- .env.railway` restituisce **NESSUN risultato**
- [ ] GitHub web UI: file non visibile in nessun commit
- [ ] Vercel deploy OK (monitora i log)
- [ ] Secrets rotati e vecchi invalidati
- [ ] Team re-sync:
  ```bash
  # Opzione 1: Fresh clone (consigliato)
  git clone <repo-url> new-repo
  
  # Opzione 2: Reset esistente
  git fetch --all
  git reset --hard origin/master
  git clean -fd
  ```

---

## 🔄 ROLLBACK PLAN

Se qualcosa va storto:

### 1. Fermati Immediatamente
**NON continuare** con force-push se qualcosa non va.

### 2. Ripristina dal Backup Bundle

```bash
# Crea nuovo repository dal backup
git clone <repo-url> restored-repo
cd restored-repo
git fetch "../repo-backup-<timestamp>.bundle" "refs/*:refs/*"

# Oppure, se necessario, re-push la history originale
git push --force --all origin
git push --force --tags origin
```

### 3. Verifica Vercel
Controlla che Vercel funzioni correttamente dopo il rollback.

### 4. Re-rotazione Secrets
Se necessario, ruota di nuovo i secrets.

---

## 📝 NOTE IMPORTANTI

### Best Practice: Mirror Clone

Per ridurre sorprese, è consigliato eseguire la riscrittura della history su un **fresh mirror clone**:

```bash
# Crea mirror clone
git clone --mirror <repo-url> repo-mirror.git
cd repo-mirror.git

# Esegui pulizia qui
bfg --delete-files .env.railway
# oppure
git filter-repo --path .env.railway --invert-paths

# Force push
git push --force --all
git push --force --tags

# Poi nel repository principale, fai fetch e reset
cd ../spediresicuro
git fetch origin
git reset --hard origin/master
```

---

## 🔍 Verifica Stato Attuale

**File nella history**: ✅ Trovato (2 commit)
- `9eca981` - security: remove .env.railway with exposed secrets
- `550e305` - Fix UI Combobox: validation, keyboard nav, duplicates, and environment config scripts

**Branch corrente**: `master`

**Strumenti disponibili**: ⚠️ Nessuno installato - richiede installazione

---

## ⚡ Quick Start

1. **Installa uno strumento** (BFG o git-filter-repo)
2. **Esegui script** appropriato per il tuo sistema
3. **Verifica** che la history sia pulita
4. **Notifica team** se necessario
5. **Monitora Vercel** dopo il force-push

---

**Ultimo aggiornamento**: 2025-01-17  
**Status**: ⚠️ Pronto per esecuzione (richiede installazione strumento)

