# 🚀 GUIDA RAPIDA: COME FARE GIT CON CURSOR

**Per chi ha fretta e vuole solo sapere cosa fare!**

---

## ⚡ SOLUZIONE VELOCE (1 MINUTO)

### Vuoi Sincronizzare? (Pull + Push)

**Windows:**
```bash
# Doppio click su:
SYNC-AUTO.bat
```

**PowerShell:**
```powershell
.\sync-automatico-completo.ps1
```

**Fatto!** ✅ Il repository è sincronizzato.

---

## 📖 SOLUZIONE COMPLETA (5 MINUTI)

### Workflow Completo con Cursor

#### 1️⃣ Inizio Sessione

```bash
# Scarica ultimi aggiornamenti
git pull origin master
```

#### 2️⃣ Sviluppo

```
→ Chiedi a Cursor: "Aiutami a scrivere [funzionalità]"
→ Cursor ti suggerisce il codice
→ Tu accetti/modifichi
→ Ripeti fino a finire
```

#### 3️⃣ Test

```bash
# Verifica che funzioni
npm run dev

# Testa in browser
http://localhost:3000

# Verifica build
npm run build
```

#### 4️⃣ Salva Modifiche

**Opzione A - Script Automatico (Consigliato):**
```bash
SYNC-AUTO.bat              # Windows
# OPPURE
.\sync-automatico-completo.ps1    # PowerShell
```

**Opzione B - Comandi Manuali:**
```bash
git add .
git commit -m "feat: descrizione modifiche"
git push origin master
```

#### 5️⃣ Verifica Deploy

```
→ Vai su Vercel Dashboard
→ Controlla che il deploy sia OK
→ Testa su produzione
```

---

## 💬 COME PARLARE CON CURSOR

### ✅ GIUSTO

```
Tu: "Mostrami come fare pull da GitHub"
Cursor: "Ecco il comando: git pull origin master"

Tu: "Suggerisci un messaggio di commit per queste modifiche"
Cursor: "Suggerisco: feat: implementato sistema preventivi"

Tu: "Quale script posso usare per sincronizzare?"
Cursor: "Usa SYNC-AUTO.bat per Windows o sync-automatico-completo.ps1 per PowerShell"

Tu: "Aiutami a scrivere una funzione per calcolare il prezzo"
Cursor: "Ecco la funzione: [codice]"
```

### ❌ SBAGLIATO

```
Tu: "Fai pull automatico"
Cursor: ❌ Non posso eseguire git pull

Tu: "Pusha le modifiche su GitHub"
Cursor: ❌ Non posso eseguire git push

Tu: "Fai merge del branch automaticamente"
Cursor: ❌ Non posso eseguire git merge
```

---

## 🎯 REGOLA D'ORO

> **Cursor SCRIVE il codice**
> **Tu GESTISCI il repository**

---

## 📋 CHECKLIST PRE-PUSH

Prima di fare push, verifica:

```
□ Ho testato in locale? (npm run dev)
□ Il build passa? (npm run build)
□ Il lint è OK? (npm run lint)
□ Ho verificato le modifiche? (git status)
□ Il commit message è chiaro?
□ So cosa sto pushando?
```

Se hai risposto ✅ a tutto → Puoi pushare!

---

## 🛠️ SCRIPT DISPONIBILI

### Sincronizzazione Completa

```bash
SYNC-AUTO.bat                      # Windows (consigliato)
sync-automatico-completo.ps1       # PowerShell (consigliato)
```

### Solo Pull (Scarica)

```bash
PULL-AUTO.bat                      # Windows
```

### Solo Push (Carica)

```bash
PUSH-AUTO.bat                      # Windows
```

### Commit + Push

```bash
COMMIT-PUSH-SEMPLICE.bat          # Windows
commit-and-push.ps1               # PowerShell
quick-commit-push.ps1             # PowerShell (rapido)
```

---

## ⚠️ ERRORI COMUNI

### "error: failed to push some refs"

**Causa:** Qualcuno ha pushato prima di te

**Soluzione:**
```bash
git pull origin master
git push origin master
```

### "Your local changes would be overwritten"

**Causa:** Hai modifiche non committate

**Soluzione:**
```bash
git add .
git commit -m "feat: salvo modifiche"
git pull origin master
git push origin master
```

### "Merge conflict"

**Causa:** Tu e qualcun altro avete modificato lo stesso file

**Soluzione:**
1. Apri il file in conflitto
2. Cerca i marker `<<<<<<<` e `>>>>>>>`
3. Decidi quale codice tenere
4. Rimuovi i marker
5. `git add [file]`
6. `git commit -m "fix: risolto conflitto"`
7. `git push origin master`

---

## 🆘 IN CASO DI PANICO

### Ho Fatto Un Casino!

**Prima di fare QUALSIASI COSA:**

```bash
# Salva lo stato attuale
git stash

# Torna all'ultimo commit funzionante
git reset --hard HEAD

# Ricarica modifiche salvate (se vuoi)
git stash pop
```

**Poi chiedi aiuto!**

### Ho Pushato Qualcosa di Sbagliato!

**Se è l'ultimo commit:**
```bash
git revert HEAD
git push origin master
```

**Se è un deploy critico:**
1. Vai su Vercel Dashboard
2. Deployments → Trova ultimo deploy funzionante
3. Clicca "..." → "Promote to Production"
4. Poi sistema il codice con calma

---

## 🎓 COMANDI GIT ESSENZIALI

```bash
# Vedere cosa hai modificato
git status

# Vedere le differenze
git diff

# Scaricare aggiornamenti
git pull origin master

# Aggiungere modifiche
git add .

# Committare
git commit -m "messaggio"

# Caricare
git push origin master

# Vedere cronologia
git log --oneline

# Vedere branch
git branch

# Cambiare branch
git checkout nome-branch

# Creare nuovo branch
git checkout -b nuovo-branch
```

---

## 📚 DOVE TROVARE AIUTO

### Documentazione

- `.cursorrules` → Regole Cursor
- `PERCHE_CURSOR_NON_PUO_FARE_GIT_AUTOMATICO.md` → Spiegazione completa
- `.AI_DIRECTIVE.md` → Direttive AI
- `RIEPILOGO_PROGETTO_CURSOR.md` → Overview progetto

### Chiedi a Cursor

```
"Mostrami come fare [operazione git]"
"Spiega questo errore git: [errore]"
"Quale script uso per [operazione]?"
"Come si risolve [problema git]?"
```

### Comandi Utili

```bash
# Aiuto Git
git help [comando]

# Esempio:
git help commit
git help push
git help pull
```

---

## ✅ RIASSUNTO ULTRA-RAPIDO

**Cosa Cursor PUÒ fare:**
- ✅ Scrivere codice
- ✅ Suggerire soluzioni
- ✅ Spiegare comandi git
- ✅ Aiutare con errori

**Cosa Cursor NON PUÒ fare:**
- ❌ Eseguire git pull
- ❌ Eseguire git push
- ❌ Eseguire git commit
- ❌ Fare merge automatico

**Come sincronizzare:**
- ⭐ Usa `SYNC-AUTO.bat` (Windows)
- ⭐ Oppure `sync-automatico-completo.ps1` (PowerShell)
- ⭐ Oppure comandi git manuali

**Workflow ideale:**
1. Pull → Sviluppo con Cursor → Test → Commit → Push
2. Oppure: Pull → Sviluppo con Cursor → Test → Script automatico

---

## 🎯 MEMORIZZA QUESTO

```
┌─────────────────────────────────────┐
│  CURSOR = Assistente Codice         │
│  GIT = Responsabilità Tua           │
│                                     │
│  Cursor scrive il codice            │
│  Tu gestisci il repository          │
└─────────────────────────────────────┘
```

---

**Fine Guida Rapida** ✅

**Prossimi Passi:**
1. Salva questa guida nei preferiti
2. Prova gli script automatici
3. Fai pratica con git base
4. Lavora serenamente con Cursor!

---

**Versione:** 1.0  
**Data:** 6 Dicembre 2025  
**Per:** Utenti Cursor del Progetto SpedireSicuro.it
