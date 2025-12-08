# 🔐 Guida: Inserire Credenziali Git per GitHub

## ❌ Problema
Il push su GitHub non funziona perché richiede autenticazione. GitHub non accetta più password, serve un **Personal Access Token (PAT)**.

## ✅ Soluzione: Creare un Personal Access Token

### Passo 1: Crea il Token su GitHub

1. **Vai su GitHub Settings**:
   - Apri: https://github.com/settings/tokens
   - Oppure: GitHub → Il tuo profilo → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **Genera nuovo token**:
   - Clicca **"Generate new token"** → **"Generate new token (classic)"**

3. **Configura il token**:
   - **Note**: `SpedireSicuro-Push` (o un nome a tua scelta)
   - **Expiration**: `90 days` (o `No expiration` se preferisci)
   - **Scorri e seleziona**: `repo` (tutti i permessi)
     - ✅ `repo` → dà accesso completo ai repository

4. **Genera**:
   - Clicca **"Generate token"**
   - ⚠️ **COPIA IL TOKEN SUBITO** (inizia con `ghp_...`)
   - Lo vedrai solo una volta!

### Passo 2: Configura Git con il Token

#### Opzione A: Script Automatico (CONSIGLIATO)

Esegui lo script:
```powershell
powershell -ExecutionPolicy Bypass -File INSERISCI-CREDENZIALI-GIT.ps1
```

Oppure il file batch:
```cmd
INSERISCI-TOKEN-GITHUB.bat
```

#### Opzione B: Manuale

1. **Configura il remote con il token**:
   ```bash
   git remote set-url origin https://TUO_TOKEN_QUI@github.com/gdsgroupsas-jpg/spediresicuro.git
   ```
   
   Sostituisci `TUO_TOKEN_QUI` con il token che hai copiato.

2. **Prova il push**:
   ```bash
   git push origin master
   ```

### Passo 3: Verifica

Se tutto è corretto, vedrai:
```
Enumerating objects: X, done.
Counting objects: 100% (X/X), done.
Writing objects: 100% (X/X), done.
To https://github.com/gdsgroupsas-jpg/spediresicuro.git
   abc1234..def5678  master -> master
```

## 🔒 Sicurezza

⚠️ **IMPORTANTE**:
- Il token è salvato nella configurazione Git locale
- Non condividere mai il token
- Se il token viene compromesso, revocalo subito su GitHub
- Considera di usare SSH invece di HTTPS (più sicuro)

## 🔄 Alternativa: Usa SSH (Più Sicuro)

Se preferisci SSH invece di HTTPS:

1. **Genera chiave SSH** (se non ce l'hai):
   ```bash
   ssh-keygen -t ed25519 -C "gdsgroupsas-jpg@users.noreply.github.com"
   ```

2. **Aggiungi la chiave a GitHub**:
   - Copia il contenuto di `~/.ssh/id_ed25519.pub`
   - Vai su: https://github.com/settings/keys
   - Clicca "New SSH key" e incolla

3. **Cambia remote a SSH**:
   ```bash
   git remote set-url origin git@github.com:gdsgroupsas-jpg/spediresicuro.git
   ```

4. **Prova push**:
   ```bash
   git push origin master
   ```

## 🆘 Problemi Comuni

### "Authentication failed"
- Token non valido o scaduto
- Token senza permessi `repo`
- **Soluzione**: Crea un nuovo token con permessi `repo`

### "Permission denied"
- Token non ha permessi sufficienti
- **Soluzione**: Assicurati di aver selezionato `repo` quando crei il token

### "Repository not found"
- Token non ha accesso al repository
- **Soluzione**: Verifica che il token abbia permessi `repo` e che tu abbia accesso al repository

## 📝 Note

- Il token è salvato in `.git/config` (locale)
- Per rimuovere il token: `git remote set-url origin https://github.com/gdsgroupsas-jpg/spediresicuro.git`
- Per vedere il remote: `git remote get-url origin`


