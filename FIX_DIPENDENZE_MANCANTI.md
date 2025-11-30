# 🔧 FIX: Dipendenze Mancanti

## ❌ Errore

```
Module not found: Can't resolve 'react-hook-form'
```

## ✅ Soluzione

Le dipendenze sono nel `package.json` ma non sono state installate. Devi installarle manualmente.

### Opzione 1: PowerShell (se abilitato)

Apri PowerShell come **Amministratore** e esegui:

```powershell
# Abilita esecuzione script (solo una volta)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Poi installa dipendenze
cd D:\spediresicuro-master
npm install
```

### Opzione 2: CMD (Windows)

Apri **Prompt dei comandi** (CMD) e esegui:

```cmd
cd D:\spediresicuro-master
npm install
```

### Opzione 3: Git Bash

Se hai Git Bash installato:

```bash
cd /d/spediresicuro-master
npm install
```

### Opzione 4: VS Code Terminal

1. Apri VS Code
2. Apri terminale integrato (`` Ctrl+` ``)
3. Seleziona terminale **CMD** o **Git Bash** (non PowerShell)
4. Esegui:
   ```bash
   npm install
   ```

---

## 📦 Dipendenze da Installare

Le seguenti dipendenze sono già nel `package.json` ma devono essere installate:

- ✅ `react-hook-form` (^7.50.0)
- ✅ `zod` (^3.22.0)
- ✅ `@hookform/resolvers` (^3.3.0)
- ✅ `framer-motion` (^11.0.0)

Tutte le altre dipendenze verranno installate automaticamente.

---

## ✅ Verifica Installazione

Dopo `npm install`, verifica:

1. **Controlla che `node_modules` esista:**
   ```bash
   ls node_modules | head -5
   ```

2. **Riavvia il server:**
   ```bash
   # Ctrl+C per fermare
   npm run dev
   ```

3. **Verifica che l'errore sia sparito:**
   - Apri `http://localhost:3000/dashboard/integrazioni`
   - Non dovresti vedere errori in console

---

## 🐛 Se l'Errore Persiste

### 1. Pulisci e Reinstalla

```bash
# Rimuovi node_modules e lock file
rm -rf node_modules package-lock.json

# Reinstalla tutto
npm install
```

### 2. Verifica Versione Node

```bash
node --version  # Dovrebbe essere 18+
npm --version   # Dovrebbe essere 9+
```

### 3. Cache npm

```bash
npm cache clean --force
npm install
```

---

## 📝 Note

- **PowerShell Execution Policy:** Se PowerShell blocca npm, usa CMD o Git Bash
- **Tempo installazione:** ~2-3 minuti (dipende da connessione)
- **Spazio disco:** ~200-300MB per node_modules

---

**Dopo l'installazione, riavvia il server e l'errore dovrebbe sparire!** ✅

