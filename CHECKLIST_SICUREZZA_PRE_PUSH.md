# 🔒 CHECKLIST SICUREZZA PRE-PUSH

> **IMPORTANTE:** Verifica TUTTO prima di fare push su GitHub!

---

## ✅ VERIFICA FILE SENSIBILI

### 1. File Environment (CRITICO)

Verifica che questi file NON siano tracciati da Git:

```bash
# Controlla se .env.local è tracciato
git ls-files | grep -E "\.env|\.local"

# Dovrebbe essere VUOTO (nessun output)
```

**File da IGNORARE (devono essere in .gitignore):**
- ✅ `.env.local` - **CRITICO!**
- ✅ `.env` - **CRITICO!**
- ✅ `.env.production`
- ✅ `.env.development`
- ✅ Qualsiasi file che inizia con `.env`

**Verifica:**
```bash
# Controlla .gitignore
cat .gitignore | grep -E "\.env|\.local"
# Dovrebbe mostrare:
# .env*.local
# .env
```

---

### 2. Database Locale

**File:** `data/database.json`

**Contiene:**
- ✅ Password utenti (hash)
- ✅ Email utenti
- ✅ Dati personali
- ✅ Credenziali integrazioni (se salvate)

**Decisione:**
- ⚠️ **Opzione A:** Ignorare (consigliato per repo pubblica)
  ```bash
  # Aggiungi a .gitignore
  echo "data/database.json" >> .gitignore
  ```
- ⚠️ **Opzione B:** Committare solo struttura vuota
  - Svuota il file prima del commit
  - Mantieni solo struttura JSON base

**Raccomandazione:** **IGNORARE** se contiene dati reali.

---

### 3. File con Secrets Hardcoded

Cerca nel codice per secrets hardcoded:

```bash
# Cerca pattern comuni di secrets
grep -r "sk-ant-" --exclude-dir=node_modules .
grep -r "GOCSPX-" --exclude-dir=node_modules .
grep -r "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" --exclude-dir=node_modules .
```

**Dovrebbe essere VUOTO** (nessun output).

**Se trovi qualcosa:**
- ❌ **RIMUOVI IMMEDIATAMENTE**
- ✅ Usa `process.env.VARIABLE_NAME` invece
- ✅ Aggiungi a `.env.local`

---

### 4. File di Configurazione con Placeholder

**File sicuri da committare (contengono solo placeholder):**
- ✅ `env.example.txt` - Solo esempi
- ✅ File `.md` con documentazione - Solo esempi
- ✅ `package.json` - Nessun secret

**Verifica che non contengano secrets reali:**
```bash
# Cerca in file .md e .txt
grep -r "sk-ant-api03-" *.md *.txt 2>/dev/null
# Dovrebbe mostrare solo placeholder tipo "sk-ant-api03-INSERISCI-LA-TUA-KEY-QUI"
```

---

## 🔍 SCAN COMPLETO PRE-PUSH

### Esegui questo script:

```bash
# 1. Verifica file tracciati
echo "=== File .env tracciati ==="
git ls-files | grep -E "\.env|\.local"

# 2. Verifica secrets hardcoded
echo "=== Secrets hardcoded ==="
grep -r "sk-ant-api03-[A-Za-z0-9]" --exclude-dir=node_modules --exclude="*.md" --exclude="*.txt" . 2>/dev/null
grep -r "GOCSPX-[A-Za-z0-9]" --exclude-dir=node_modules --exclude="*.md" --exclude="*.txt" . 2>/dev/null
grep -r "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9]" --exclude-dir=node_modules --exclude="*.md" --exclude="*.txt" . 2>/dev/null

# 3. Verifica database.json
echo "=== Database.json contiene dati? ==="
if [ -f "data/database.json" ]; then
  cat data/database.json | grep -E "password|email|credentials" | head -3
fi

# 4. Verifica .gitignore
echo "=== .gitignore protegge file sensibili? ==="
grep -E "\.env|database\.json" .gitignore
```

---

## ✅ CHECKLIST FINALE

Prima di fare `git push`, verifica:

- [ ] **Nessun file `.env*` tracciato da Git**
- [ ] **Nessun secret hardcoded nel codice**
- [ ] **`data/database.json` ignorato o vuoto**
- [ ] **`.gitignore` contiene tutte le protezioni**
- [ ] **File `.md` contengono solo esempi/placeholder**
- [ ] **Nessuna password/API key visibile nel codice**

---

## 🛡️ AGGIUNGI PROTEZIONI A .gitignore

Se mancano, aggiungi:

```gitignore
# Environment variables
.env*.local
.env
.env.production
.env.development

# Database locale (se contiene dati sensibili)
data/database.json

# Credenziali
*.key
*.pem
*.p12
*.pfx

# Logs (potrebbero contenere dati sensibili)
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
```

---

## 🚨 SE HAI GIÀ COMMITTATO SECRETS

### Opzione 1: Rimuovi dall'History (Se repo privata o nuova)

```bash
# ⚠️ ATTENZIONE: Questo riscrive la history!
# Usa SOLO se la repo è privata o non hai ancora fatto push

# Rimuovi file sensibili dalla history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env.local data/database.json" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (SOLO se sei sicuro!)
git push origin --force --all
```

### Opzione 2: Rovina Secrets e Ricrea (Consigliato)

1. **Rovina i secrets esposti:**
   - Vai su console provider (Google, GitHub, Supabase)
   - Revoca/rigenera tutte le chiavi esposte
   - Crea nuove chiavi

2. **Rimuovi file dalla repo:**
   ```bash
   git rm --cached .env.local
   git rm --cached data/database.json
   git commit -m "Remove sensitive files"
   ```

3. **Aggiungi a .gitignore:**
   ```bash
   echo ".env.local" >> .gitignore
   echo "data/database.json" >> .gitignore
   git add .gitignore
   git commit -m "Add sensitive files to .gitignore"
   ```

---

## 🔐 RACCOMANDAZIONI FINALI

### Per Repo Pubblica

1. ✅ **Rendi repo PRIVATA** se contiene dati sensibili
   - GitHub: Settings → Change repository visibility → Make private

2. ✅ **Usa GitHub Secrets** per CI/CD
   - Settings → Secrets and variables → Actions
   - Aggiungi tutte le variabili ambiente

3. ✅ **Usa Vercel Environment Variables** per deploy
   - Dashboard Vercel → Project → Settings → Environment Variables

### Per Repo Privata

- ✅ Ancora meglio proteggere, ma meno critico
- ✅ Considera di usare `git-crypt` per file sensibili necessari

---

## 📋 COMANDI FINALI PRE-PUSH

```bash
# 1. Verifica stato
git status

# 2. Verifica cosa verrà committato
git diff --cached

# 3. Verifica che .env.local NON sia incluso
git diff --cached --name-only | grep -E "\.env|database\.json"
# Dovrebbe essere VUOTO

# 4. Se tutto OK, commit e push
git add .
git commit -m "feat: integrazioni e-commerce completate"
git push origin master
```

---

## ✅ VERIFICA POST-PUSH

Dopo il push, verifica su GitHub:

1. **Vai su:** `https://github.com/gdsgroupsas-jpg/spediresicuro`
2. **Cerca:** `.env.local` o `database.json`
3. **Dovrebbe:** Non trovare nulla (404 o file non presente)

---

**🔒 SICUREZZA PRIMA DI TUTTO!**

