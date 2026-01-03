# 🎯 PROMPT: Setup VS Code per Test Automatici

**Obiettivo:** Configurare VS Code per eseguire test automaticamente senza dover usare il terminale manualmente.

---

## 📋 ISTRUZIONI PER L'AI AGENT

Configura VS Code per eseguire test automaticamente seguendo questi passaggi:

### 1. Verifica Estensioni

Assicurati che queste estensioni siano installate:
- **Vitest** (by Anthony Fu) - ID: `vitest.explorer`
- **Playwright Test for VSCode** (by Microsoft) - ID: `ms-playwright.playwright`

### 2. Crea File di Configurazione

Crea/modifica questi file nella cartella `.vscode/`:

- ✅ `.vscode/settings.json` - Configurazione workspace
- ✅ `.vscode/tasks.json` - Task per eseguire test
- ✅ `.vscode/launch.json` - Configurazione debug

### 3. Configurazione Richiesta

**Settings.json deve includere:**
- Vitest abilitato con auto-run su save
- Playwright configurato
- TypeScript validation su save
- Code Lens abilitato per "Run | Debug" inline

**Tasks.json deve includere:**
- Task "Test: Unit" (default)
- Task "Test: Integration"
- Task "Test: E2E"
- Task "Test: Watch" (background)

**Launch.json deve includere:**
- Debug configurazione per Vitest
- Debug configurazione per Playwright
- Debug configurazione per Next.js

### 4. Verifica Funzionamento

Dopo la configurazione, verifica che:
- Test Explorer mostri tutti i test
- Code Lens "Run | Debug" appaia nei file di test
- I test possano essere eseguiti cliccando "Run"
- I test possano essere debuggati cliccando "Debug"

### 5. Documentazione

Crea file `docs/VS_CODE_TEST_SETUP.md` con:
- Istruzioni complete setup
- Come usare Test Explorer
- Come usare Code Lens
- Troubleshooting comune
- Keyboard shortcuts consigliati

---

## ✅ RISULTATO ATTESO

Dopo questa configurazione, l'utente deve poter:
1. Aprire un file di test e vedere "Run | Debug" sopra ogni test
2. Cliccare "Run" per eseguire il test senza aprire terminale
3. Vedere risultati nel Test Explorer
4. Eseguire tutti i test con un click
5. Debug test con breakpoint funzionanti

**Non deve più usare il terminale per eseguire test manualmente!**

---

## 🔧 COMANDI RAPIDI

Dopo setup, l'utente può:
- `Ctrl+Shift+P` → `Vitest: Run All Tests`
- `Ctrl+Shift+P` → `Playwright: Run Tests`
- `Ctrl+Shift+T` → Esegui task "Test: Unit"
- Click "Run" sopra un test → Esegue quel test
- Click "Debug" sopra un test → Debug quel test

---

**Versione:** 1.0  
**Data:** 1 Gennaio 2026


