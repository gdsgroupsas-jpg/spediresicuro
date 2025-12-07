# 🔌 INSTALLA ESTENSIONE POWERSHELL IN CURSOR

## ✅ COSA HO FATTO

Ho creato il file `.vscode/extensions.json` che raccomanda l'estensione PowerShell.

## 📋 COME INSTALLARE

### **Metodo 1: Automatico (Consigliato)**

1. **Apri Cursor**
2. **Premi** `Ctrl+Shift+X` (o `Cmd+Shift+X` su Mac) per aprire il pannello Estensioni
3. **Cerca** "PowerShell" nella barra di ricerca
4. **Installa** l'estensione ufficiale: **"PowerShell"** di Microsoft (ms-vscode.PowerShell)

### **Metodo 2: Da Command Palette**

1. **Premi** `Ctrl+Shift+P` (o `Cmd+Shift+P` su Mac)
2. **Digita**: `Extensions: Show Recommended Extensions`
3. **Clicca** su "PowerShell" nella lista delle raccomandazioni
4. **Clicca** "Install"

### **Metodo 3: Da Terminale (PowerShell)**

Apri PowerShell e esegui:

```powershell
code --install-extension ms-vscode.PowerShell
```

Oppure se usi Cursor:

```powershell
cursor --install-extension ms-vscode.PowerShell
```

## 🎯 COSA FA L'ESTENSIONE

L'estensione PowerShell fornisce:
- ✅ **Syntax highlighting** per file `.ps1`
- ✅ **IntelliSense** (autocompletamento)
- ✅ **Debugging** di script PowerShell
- ✅ **Code formatting**
- ✅ **Miglior supporto** per l'esecuzione di comandi PowerShell nel terminale integrato

## 💡 PERCHÉ È UTILE

Con l'estensione PowerShell installata:
- ✅ I comandi PowerShell nel terminale integrato di Cursor funzionano meglio
- ✅ Potrebbe aiutare a risolvere il problema dell'output Git
- ✅ Miglior supporto per gli script `.ps1` del progetto

## 🔍 VERIFICA INSTALLAZIONE

Dopo l'installazione:
1. Apri un file `.ps1` (es. `fix-git-output-auto.ps1`)
2. Dovresti vedere syntax highlighting colorato
3. Il terminale PowerShell integrato dovrebbe funzionare meglio

## 📝 NOTA

L'estensione PowerShell potrebbe migliorare la cattura dell'output nei comandi git eseguiti tramite PowerShell, ma **non garantisce** che risolva completamente il problema del tool `run_terminal_cmd` di Cursor.

---

**Dopo l'installazione, riprova i comandi git per vedere se l'output è visibile!** 🚀
