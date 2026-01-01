# 🔧 Guida Setup VS Code per Test Automatici

**Obiettivo:** Configurare VS Code per eseguire test automaticamente e sincronizzare perfettamente con il progetto.

**Ultimo Aggiornamento:** 1 Gennaio 2026 | **Versione:** 2.0

---

## 📋 PREREQUISITI

### Estensioni VS Code Richieste

Installa queste estensioni in VS Code:

1. **Vitest** (by Vitest)
   - ID: `vitest.explorer`
   - Per eseguire test unit/integration con Vitest
   - **Code Lens:** Mostra "Run | Debug" sopra ogni test

2. **Playwright Test for VSCode** (by Microsoft)
   - ID: `ms-playwright.playwright`
   - Per eseguire test E2E con Playwright
   - **UI Mode:** Browser integrato per debug visivo

3. **TypeScript and JavaScript Language Features** (built-in)
   - Già incluso in VS Code

4. **ESLint** (consigliato)
   - ID: `dbaeumer.vscode-eslint`
   - Per linting automatico

### Installazione Rapida

```bash
# Da terminale VS Code
code --install-extension vitest.explorer
code --install-extension ms-playwright.playwright
```

Oppure usa Command Palette: `Ctrl+Shift+X` → cerca l'estensione → Installa

---

## ⚙️ CONFIGURAZIONE VS CODE

### 1. Settings.json (Workspace)

Il file `.vscode/settings.json` è già configurato con:

```json
{
  // Code Lens - Mostra "Run | Debug" sopra ogni test
  "editor.codeLens": true,
  
  // Vitest: Esegui test automaticamente
  "vitest.enable": true,
  "vitest.commandLine": "npx vitest",
  "vitest.watch": true,
  
  // Playwright: Browser visibile durante debug
  "playwright.reuseBrowser": true,
  "playwright.showTrace": true,
  "playwright.showBrowser": true,
  
  // Testing: Icone nel gutter
  "testing.gutterEnabled": true,
  "testing.alwaysRevealTestOnStateChange": true
}
```

### 2. Tasks.json (Automazione)

Task disponibili in `.vscode/tasks.json`:

| Task | Shortcut | Descrizione |
|------|----------|-------------|
| Test: Unit | Default | Esegue tutti i test unit |
| Test: Integration | - | Esegue test di integrazione |
| Test: E2E | - | Esegue test Playwright |
| Test: Watch | Background | Auto-run su modifica file |
| Type Check | - | Verifica tipi TypeScript |
| Lint | - | ESLint check |

**Esegui task:** `Ctrl+Shift+P` → `Tasks: Run Task` → Seleziona

### 3. Launch.json (Debug)

Configurazioni debug in `.vscode/launch.json`:

| Configurazione | Uso |
|----------------|-----|
| Debug: Vitest Current File | Debug del file test aperto |
| Debug: Vitest Watch | Debug con watch mode |
| Debug: Vitest All Tests | Debug tutti i test |
| Debug: Playwright Current File | Debug E2E con browser |
| Debug: Playwright All Tests | Debug tutti E2E |
| Debug: Next.js Server | Debug server Next.js |
| Full Debug: Next.js + Playwright | Combo debug completo |

---

## 🎯 COME USARE

### ▶️ Metodo 1: Code Lens (CONSIGLIATO)

Il modo più veloce per eseguire test:

1. Apri un file di test (es. `tests/unit/stripe-payments.test.ts`)
2. Vedrai **"Run | Debug"** sopra ogni `test()` o `describe()`
3. **Clicca "Run"** → Il test viene eseguito
4. **Clicca "Debug"** → Debug con breakpoint

```typescript
// ↓ Run | Debug ← Clicca qui!
test('calcola prezzo correttamente', () => {
  expect(calculatePrice(100)).toBe(120);
});
```

### 🧪 Metodo 2: Test Explorer

1. Clicca l'icona **beaker** 🧪 nella sidebar sinistra
2. Espandi la struttura dei test per file
3. Clicca ▶️ su un test singolo o su una cartella
4. Vedi i risultati (✓ verde = passato, ✗ rosso = fallito)

### ⌨️ Metodo 3: Command Palette

1. Premi `Ctrl+Shift+P`
2. Digita uno di questi comandi:

| Comando | Descrizione |
|---------|-------------|
| `Vitest: Run All Tests` | Esegue tutti i test Vitest |
| `Vitest: Run Current File` | Esegue test del file aperto |
| `Vitest: Run Test at Cursor` | Esegue test dove è il cursore |
| `Playwright: Run Tests` | Esegue test E2E |
| `Playwright: Show Trace` | Apre trace viewer |

### 🔧 Metodo 4: Task Runner

1. Premi `Ctrl+Shift+P` → `Tasks: Run Task`
2. Seleziona:
   - **Test: Unit** - Test unit (default)
   - **Test: E2E** - Test Playwright
   - **Test: Watch** - Auto-run su modifica

---

## 🐞 DEBUG TEST

### Debug con Breakpoint

1. **Metti breakpoint:** Clicca sul numero di riga (pallino rosso)
2. **Avvia debug:** 
   - Clicca "Debug" sopra il test (Code Lens)
   - Oppure `F5` con configurazione selezionata
3. **Controlla variabili:** Pannello Variables mostra valori
4. **Step through:** F10 (step over), F11 (step into)

### Debug Playwright (Browser Visibile)

1. Apri un test E2E (`.spec.ts` in cartella `e2e/`)
2. Clicca "Debug" sopra il test
3. Si apre browser Chromium con Playwright Inspector
4. Passo-passo vedi cosa fa il test

---

## ⚡ KEYBOARD SHORTCUTS

| Shortcut | Azione |
|----------|--------|
| `Ctrl+Shift+P` | Command Palette |
| `Ctrl+Shift+T` | Run test task |
| `F5` | Start debugging |
| `Shift+F5` | Stop debugging |
| `F10` | Step over |
| `F11` | Step into |
| `Ctrl+Shift+Y` | Toggle Debug Console |

### Aggiungi Shortcut Personalizzati

In `keybindings.json`:

```json
[
  {
    "key": "ctrl+shift+t",
    "command": "workbench.action.tasks.runTask",
    "args": "Test: Unit"
  },
  {
    "key": "alt+t",
    "command": "vitest.runCurrentFile"
  }
]
```

---

## 🔍 TROUBLESHOOTING

### Test Explorer non mostra test

1. Verifica estensione Vitest installata: `Ctrl+Shift+X` → cerca "Vitest"
2. Riavvia VS Code: `Ctrl+Shift+P` → `Developer: Reload Window`
3. Verifica vitest installato: `npm list vitest`
4. Forza refresh: `Ctrl+Shift+P` → `Vitest: Refresh Tests`

### Code Lens non appare

1. Verifica impostazione: `editor.codeLens` deve essere `true`
2. Verifica file è `.test.ts` o `.spec.ts`
3. Riavvia estensione: `Ctrl+Shift+P` → `Developer: Reload Window`

### Playwright test falliscono

1. Installa browser: `npx playwright install chromium`
2. Avvia dev server: `npm run dev`
3. Verifica URL base in `playwright.config.ts`

### Breakpoint non si fermano

1. Usa configurazione debug corretta (dropdown in alto a sinistra)
2. Verifica che il file sia quello giusto
3. Prova `--no-file-parallelism` per test in sequenza

---

## ✅ CHECKLIST VERIFICA

Dopo il setup, verifica:

- [ ] Estensione Vitest visibile in Extensions (`vitest.explorer`)
- [ ] Estensione Playwright visibile (`ms-playwright.playwright`)
- [ ] Test Explorer mostra tutti i test (icona 🧪)
- [ ] Code Lens "Run | Debug" sopra i test
- [ ] Click su "Run" esegue il test
- [ ] Breakpoint funzionano in debug mode

### Test Rapido

```bash
# Verifica test funzionanti
npm run test:unit -- --run

# Verifica Playwright installato
npx playwright --version
```

---

## 🎉 RISULTATO

Dopo questa configurazione:

✅ **Code Lens:** "Run | Debug" sopra ogni test  
✅ **Test Explorer:** Vista organizzata di tutti i test  
✅ **Auto-run:** Test eseguiti automaticamente su save  
✅ **Debug:** Breakpoint funzionanti  
✅ **Zero Terminal:** Non serve più usare il terminale manualmente!

**Workflow consigliato:**
1. Scrivi test → 2. Clicca "Run" → 3. Vedi risultato → 4. Fix → 5. Repeat

---

**Versione:** 2.0  
**Data:** 1 Gennaio 2026

