# 🔧 RISOLUZIONE ERRORI GIT PUSH/PULL

**Data:** 6 Dicembre 2025  
**Problema:** Git non riesce a fare push/pull (errori di autenticazione)  
**Soluzione:** Configurazione credenziali GitHub

---

## ❓ IL PROBLEMA

Quando provi a fare `git push` o `git pull` ricevi errori tipo:

```
❌ remote: Support for password authentication was removed
❌ fatal: Authentication failed
❌ error: failed to push some refs
❌ Permission denied (publickey)
```

**Causa:** Le credenziali git non sono configurate correttamente.

---

## ✅ SOLUZIONE RAPIDA

### Opzione 1: Personal Access Token (Consigliato per HTTPS)

#### Passo 1: Crea il Token su GitHub

1. Vai su: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. **Note:** `SpedireSicuro - Cursor Git`
4. **Expiration:** `No expiration` (o 90 days)
5. **Scopes** - Seleziona:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
6. Click **"Generate token"**
7. **COPIA IL TOKEN!** (lo vedi solo una volta)

Esempio token: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### Passo 2: Configura Git per Usare il Token

**Windows - Credential Manager:**

```bash
# Quando fai git push la prima volta, ti chiederà:
# Username: gdsgroupsas-jpg
# Password: [INCOLLA IL TOKEN QUI, NON LA PASSWORD]

git push origin master

# Windows salverà automaticamente nel Credential Manager
```

**Oppure configura direttamente:**

```bash
# Opzione A: URL con token (meno sicuro ma funziona)
git remote set-url origin https://ghp_TUO_TOKEN@github.com/gdsgroupsas-jpg/spediresicuro.git

# Opzione B: Git Credential Manager (più sicuro)
git config --global credential.helper manager
git push origin master
# Ti chiederà username (gdsgroupsas-jpg) e password (il token)
```

**macOS/Linux:**

```bash
# Opzione A: Credential helper
git config --global credential.helper store
git push origin master
# Ti chiederà: username = gdsgroupsas-jpg, password = il token

# Opzione B: SSH (vedi sotto)
```

---

### Opzione 2: SSH Key (Consigliato per sicurezza)

#### Passo 1: Genera SSH Key

```bash
# Genera la chiave
ssh-keygen -t ed25519 -C "gdsgroupsas-jpg@github.com"

# Quando chiede dove salvarla, premi INVIO (default: ~/.ssh/id_ed25519)
# Quando chiede passphrase, puoi lasciarla vuota o metterne una

# Avvia ssh-agent
eval "$(ssh-agent -s)"

# Aggiungi la chiave
ssh-add ~/.ssh/id_ed25519

# Copia la chiave pubblica
cat ~/.ssh/id_ed25519.pub
# Oppure su Windows:
type %USERPROFILE%\.ssh\id_ed25519.pub
```

#### Passo 2: Aggiungi SSH Key su GitHub

1. Copia tutto l'output del comando `cat ~/.ssh/id_ed25519.pub`
2. Vai su: https://github.com/settings/keys
3. Click **"New SSH key"**
4. **Title:** `SpedireSicuro - Cursor`
5. **Key:** Incolla la chiave copiata
6. Click **"Add SSH key"**

#### Passo 3: Cambia Remote a SSH

```bash
# Cambia da HTTPS a SSH
git remote set-url origin git@github.com:gdsgroupsas-jpg/spediresicuro.git

# Verifica
git remote -v
# Deve mostrare: git@github.com:gdsgroupsas-jpg/spediresicuro.git

# Testa
git push origin master
```

---

### Opzione 3: GitHub CLI (Più Facile)

```bash
# Installa GitHub CLI
# Windows: https://cli.github.com/
# macOS: brew install gh
# Linux: sudo apt install gh

# Autentica
gh auth login

# Segui il wizard:
# 1. GitHub.com
# 2. HTTPS
# 3. Login with web browser
# 4. Copia il codice e autorizza

# Configura git
gh auth setup-git

# Ora push/pull funzionano!
git push origin master
```

---

## 🔍 DIAGNOSI PROBLEMA

### Test 1: Verifica Configurazione Git

```bash
# Controlla user
git config user.name
# Deve essere: gdsgroupsas-jpg

git config user.email
# Deve essere: un'email valida

# Se sbagliati, correggi:
git config --global user.name "gdsgroupsas-jpg"
git config --global user.email "tua-email@esempio.com"
```

### Test 2: Verifica Remote

```bash
git remote -v
# Deve mostrare:
# origin	https://github.com/gdsgroupsas-jpg/spediresicuro (fetch)
# origin	https://github.com/gdsgroupsas-jpg/spediresicuro (push)
```

### Test 3: Verifica Connessione

```bash
# Se usi HTTPS:
git ls-remote origin

# Se usi SSH:
ssh -T git@github.com
# Deve dire: "Hi gdsgroupsas-jpg! You've successfully authenticated"
```

### Test 4: Prova Push

```bash
# Crea un file di test
echo "test" > test.txt
git add test.txt
git commit -m "test: verifica push"
git push origin master

# Se funziona, rimuovi il test:
git rm test.txt
git commit -m "test: rimuovi file test"
git push origin master
```

---

## 🚨 ERRORI COMUNI E SOLUZIONI

### Errore: "Support for password authentication was removed"

**Causa:** GitHub non accetta più password normali.

**Soluzione:** Usa Personal Access Token (vedi Opzione 1 sopra)

---

### Errore: "Permission denied (publickey)"

**Causa:** SSH key non configurata o non riconosciuta.

**Soluzione:**

```bash
# Verifica che la chiave esista
ls -la ~/.ssh
# Deve esserci: id_ed25519 e id_ed25519.pub

# Se non c'è, creala (vedi Opzione 2 sopra)

# Verifica che sia aggiunta
ssh-add -l

# Se non è listata:
ssh-add ~/.ssh/id_ed25519

# Testa connessione
ssh -T git@github.com
```

---

### Errore: "fatal: Authentication failed"

**Causa:** Credenziali sbagliate o scadute.

**Soluzione:**

**Windows:**
```bash
# Rimuovi credenziali vecchie
# Cerca "Credential Manager" nel menu Start
# Vai su "Windows Credentials"
# Trova "git:https://github.com"
# Click "Remove"

# Poi riprova push (ti chiederà nuove credenziali)
git push origin master
```

**macOS:**
```bash
# Rimuovi credenziali vecchie
git credential-osxkeychain erase
host=github.com
protocol=https
[premi INVIO due volte]

# Riprova push
git push origin master
```

**Linux:**
```bash
# Rimuovi credenziali
rm ~/.git-credentials

# Riprova
git push origin master
```

---

### Errore: "error: failed to push some refs"

**Causa:** Il remote è avanti rispetto al tuo locale.

**Soluzione:**

```bash
# Scarica le modifiche
git pull origin master

# Se ci sono conflitti, risolvili

# Poi riprova push
git push origin master
```

---

## 🎯 CONFIGURAZIONE CONSIGLIATA

### Per Cursor su Windows (HTTPS con Token)

```bash
# 1. Crea Personal Access Token su GitHub
# (vedi Passo 1 sopra)

# 2. Configura git
git config --global user.name "gdsgroupsas-jpg"
git config --global user.email "tua-email@esempio.com"
git config --global credential.helper manager

# 3. Primo push (ti chiederà credenziali)
git push origin master
# Username: gdsgroupsas-jpg
# Password: [INCOLLA IL TOKEN]

# 4. Da ora in poi push/pull funzionano automaticamente!
```

### Per Cursor su macOS/Linux (SSH)

```bash
# 1. Genera SSH key
ssh-keygen -t ed25519 -C "gdsgroupsas-jpg@github.com"
ssh-add ~/.ssh/id_ed25519

# 2. Aggiungi chiave pubblica su GitHub
cat ~/.ssh/id_ed25519.pub
# Copia e incolla su https://github.com/settings/keys

# 3. Cambia remote a SSH
git remote set-url origin git@github.com:gdsgroupsas-jpg/spediresicuro.git

# 4. Configura git
git config --global user.name "gdsgroupsas-jpg"
git config --global user.email "tua-email@esempio.com"

# 5. Test
git push origin master
```

---

## 🛠️ SCRIPT AUTOMATICI DOPO CONFIGURAZIONE

**Dopo aver configurato le credenziali**, gli script funzioneranno automaticamente:

```bash
# Windows
SYNC-AUTO.bat                    # Funzionerà!
PUSH-AUTO.bat                    # Funzionerà!
PULL-AUTO.bat                    # Funzionerà!

# PowerShell
.\sync-automatico-completo.ps1   # Funzionerà!
.\commit-and-push.ps1            # Funzionerà!
```

---

## 📋 CHECKLIST CONFIGURAZIONE

### Verifica di Aver Configurato Tutto

```
□ Ho creato Personal Access Token su GitHub (se uso HTTPS)
□ Ho generato SSH key (se uso SSH)
□ Ho aggiunto la chiave pubblica su GitHub (se uso SSH)
□ Ho configurato git user.name = "gdsgroupsas-jpg"
□ Ho configurato git user.email
□ Ho configurato credential.helper (se uso HTTPS)
□ Ho testato git push con successo
□ Ho testato git pull con successo
□ Gli script .bat/.ps1 funzionano
```

Se hai ✅ a tutto → **Configurazione completa!**

---

## 💡 PERCHÉ CURSOR NON PUÒ FARE QUESTO PER TE

Cursor **non può** configurare le credenziali git perché:

1. 🔐 **Richiede accesso al tuo account GitHub** (token, SSH keys)
2. 🔑 **Modificherebbe configurazioni di sistema** (credential manager)
3. 👤 **Richiede la tua identità** (user.name, user.email)
4. ⚠️ **Rischi di sicurezza** se un AI avesse questi permessi

**Tu devi** configurare le credenziali **una sola volta**.  
**Poi** tutto funzionerà automaticamente (script compresi).

---

## 🎯 WORKFLOW DOPO CONFIGURAZIONE

### Una Volta Configurato

```bash
# Non serve più autenticare ogni volta!

# Sviluppo normale:
git pull origin master           # Funziona senza chiedere credenziali
# ... modifiche con Cursor ...
git add .
git commit -m "feat: modifiche"
git push origin master           # Funziona senza chiedere credenziali

# Oppure usa script:
SYNC-AUTO.bat                    # Funziona automaticamente!
```

---

## 🆘 SUPPORTO

### Se Ancora Non Funziona

1. **Controlla errore esatto:**
   ```bash
   git push origin master 2>&1 | tee git-error.log
   cat git-error.log
   ```

2. **Verifica credenziali:**
   ```bash
   # HTTPS
   git config credential.helper
   
   # SSH
   ssh -T git@github.com
   ```

3. **Riconfigura da zero:**
   ```bash
   # Rimuovi configurazione attuale
   git config --global --unset credential.helper
   
   # Riconfigura (scegli HTTPS o SSH sopra)
   ```

4. **Chiedi aiuto con il log dell'errore specifico**

---

## 📚 LINK UTILI

- **Personal Access Token:** https://github.com/settings/tokens
- **SSH Keys:** https://github.com/settings/keys
- **GitHub CLI:** https://cli.github.com/
- **Guida GitHub SSH:** https://docs.github.com/en/authentication/connecting-to-github-with-ssh
- **Guida GitHub Token:** https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token

---

## ✅ RIASSUNTO

### Problema
Git push/pull non funzionano → Errori di autenticazione

### Causa
Credenziali GitHub non configurate (password normali non funzionano più)

### Soluzione
1. **Crea Personal Access Token** su GitHub (HTTPS)
2. **Oppure configura SSH key** (SSH)
3. **Oppure usa GitHub CLI** (più facile)
4. Configura git user.name e user.email
5. Primo push ti chiederà credenziali (usa il token, non la password)
6. Da quel momento tutto funziona automaticamente

### Dopo Configurazione
- ✅ `git push` funziona
- ✅ `git pull` funziona
- ✅ Script `.bat`/`.ps1` funzionano
- ✅ Cursor può usare git (se gli dai il comando)

---

**Versione:** 1.0  
**Data:** 6 Dicembre 2025  
**Progetto:** SpedireSicuro.it

---

## 🎁 BONUS: Test Rapido Configurazione

```bash
# Copia e incolla questo per testare tutto:

echo "=== TEST CONFIGURAZIONE GIT ==="

echo "1. User name:"
git config user.name

echo "2. User email:"
git config user.email

echo "3. Remote URL:"
git remote -v

echo "4. Credential helper:"
git config credential.helper

echo "5. Test connessione:"
git ls-remote origin >/dev/null 2>&1 && echo "✅ Connessione OK" || echo "❌ Connessione FAILED"

echo "6. Branch corrente:"
git branch --show-current

echo "=== FINE TEST ==="
```

Se tutto mostra ✅ → **Sei pronto!**

Se vedi ❌ → Segui la guida sopra per configurare.
