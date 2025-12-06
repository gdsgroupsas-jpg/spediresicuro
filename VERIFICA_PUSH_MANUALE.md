# 🔍 VERIFICA PUSH MANUALE - Come Controllare

Se non vedi i file su GitHub, segui questi passi:

---

## 📋 STEP 1: Verifica File Locali

Apri PowerShell nella cartella progetto e verifica che i file esistano:

```powershell
cd d:\spediresicuro-master
ls sync-automatico.ps1, avvia-lavoro.ps1, salva-lavoro.ps1, GUIDA_SCRIPT_AUTOMATICI.md
```

**Se i file esistono:** ✅ Vai al STEP 2  
**Se i file NON esistono:** ❌ I file non sono stati creati

---

## 📋 STEP 2: Verifica Stato Git

```powershell
git status
```

**Cosa controllare:**
- Se vedi file in rosso → Non sono stati aggiunti (fai `git add .`)
- Se vedi file in verde → Sono nello staging (fai `git commit`)
- Se non vedi nulla → Tutto è committato (vai al STEP 3)

---

## 📋 STEP 3: Verifica Commit

```powershell
git log --oneline -5
```

**Cosa controllare:**
- Cerca commit con messaggio "script automatici" o "sync"
- Se lo vedi → Il commit è stato fatto (vai al STEP 4)
- Se NON lo vedi → Fai commit manuale (vedi sotto)

---

## 📋 STEP 4: Verifica Push

```powershell
git log origin/master..HEAD --oneline
```

**Cosa significa:**
- Se vedi commit → Ci sono commit da pushare
- Se NON vedi nulla → Tutto è già pushato (vai al STEP 5)

**Se ci sono commit da pushare:**
```powershell
git push origin master
```

**Possibili problemi:**
- ❌ **Errore autenticazione** → Vedi sezione "Risoluzione Problemi" sotto
- ❌ **Errore connessione** → Verifica internet
- ✅ **Push completato** → Vai al STEP 5

---

## 📋 STEP 5: Verifica su GitHub

1. **Apri browser**
2. **Vai su:** https://github.com/gdsgroupsas-jpg/spediresicuro
3. **Cerca i file:**
   - `sync-automatico.ps1`
   - `avvia-lavoro.ps1`
   - `salva-lavoro.ps1`
   - `GUIDA_SCRIPT_AUTOMATICI.md`

**Se i file ci sono:** ✅ **TUTTO OK!**  
**Se i file NON ci sono:** ❌ Vedi sezione "Risoluzione Problemi"

---

## 🔧 RISOLUZIONE PROBLEMI

### **Problema 1: Errore Autenticazione**

**Sintomo:** Git chiede username/password o dice "authentication failed"

**Soluzione:**
1. **Crea Personal Access Token su GitHub:**
   - Vai su: https://github.com/settings/tokens
   - Clicca "Generate new token (classic)"
   - Seleziona permessi: `repo` (tutti)
   - Copia il token

2. **Usa il token come password:**
   - Quando Git chiede password, incolla il token (NON la password GitHub)

3. **Windows salverà le credenziali automaticamente**

---

### **Problema 2: Commit Non Fatto**

**Sintomo:** I file esistono ma non sono committati

**Soluzione:**
```powershell
# Aggiungi tutti i file
git add sync-automatico.ps1 avvia-lavoro.ps1 salva-lavoro.ps1 GUIDA_SCRIPT_AUTOMATICI.md package.json RIEPILOGO_LAVORO_ATTUALE.md

# Fai commit
git commit -m "feat: script automatici sincronizzazione casa/lavoro"

# Fai push
git push origin master
```

---

### **Problema 3: Push Bloccato**

**Sintomo:** Il push si blocca o non risponde

**Soluzione:**
1. **Interrompi il comando** (Ctrl+C)
2. **Verifica connessione internet**
3. **Riprova:**
   ```powershell
   git push origin master
   ```

---

### **Problema 4: Conflitti**

**Sintomo:** Git dice "conflicts" o "merge required"

**Soluzione:**
```powershell
# Fai pull prima
git pull origin master

# Risolvi conflitti se necessario
# Poi fai push
git push origin master
```

---

## ✅ COMANDI RAPIDI COMPLETI

Se vuoi fare tutto da zero:

```powershell
cd d:\spediresicuro-master

# 1. Aggiungi file
git add sync-automatico.ps1 avvia-lavoro.ps1 salva-lavoro.ps1 GUIDA_SCRIPT_AUTOMATICI.md package.json RIEPILOGO_LAVORO_ATTUALE.md

# 2. Verifica
git status

# 3. Commit
git commit -m "feat: script automatici sincronizzazione casa/lavoro"

# 4. Push
git push origin master
```

---

## 🔗 LINK UTILI

- **GitHub Repository:** https://github.com/gdsgroupsas-jpg/spediresicuro
- **GitHub Tokens:** https://github.com/settings/tokens
- **Vercel Dashboard:** https://vercel.com

---

## 📞 SE NULLA FUNZIONA

1. **Verifica account Git:**
   ```powershell
   git config user.name
   # Deve essere: gdsgroupsas-jpg
   ```

2. **Verifica remote:**
   ```powershell
   git remote -v
   # Deve mostrare: https://github.com/gdsgroupsas-jpg/spediresicuro.git
   ```

3. **Verifica connessione:**
   ```powershell
   git ls-remote origin
   # Se funziona, vedrai i branch remoti
   ```

---

**Ultimo aggiornamento:** Dicembre 2025



