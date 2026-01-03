# 🚀 Quick Start: VS Code Test Setup

**Tempo richiesto:** 2 minuti  
**Difficoltà:** Facile

---

## ✅ PASSI RAPIDI

### 1. Installa Estensioni (1 minuto)

Apri VS Code e installa queste estensioni:

1. **Vitest** - Cerca "Vitest" nell'Extensions (ID: `vitest.explorer`)
2. **Playwright Test** - Cerca "Playwright" nell'Extensions (ID: `ms-playwright.playwright`)

**Oppure:** VS Code ti chiederà automaticamente di installarle quando apri un file di test.

### 2. Riavvia VS Code

Dopo aver installato le estensioni, riavvia VS Code (`Ctrl+Shift+P` → `Developer: Reload Window`).

### 3. Verifica Funzionamento

1. Apri `tests/unit/stripe-payments.test.ts`
2. Dovresti vedere **"Run | Debug"** sopra ogni `test()`
3. Clicca **"Run"** → Il test viene eseguito automaticamente!

---

## 🎯 COME USARE

### Metodo 1: Code Lens (Più Veloce)

1. Apri qualsiasi file di test (`.test.ts` o `.spec.ts`)
2. Vedi i link **"Run | Debug"** sopra ogni test
3. Clicca **"Run"** per eseguire quel test
4. Clicca **"Debug"** per debuggare con breakpoint

### Metodo 2: Test Explorer

1. Apri sidebar (icona beaker 🔬)
2. Vedi tutti i test organizzati per file
3. Clicca ▶️ su un test per eseguirlo
4. Clicca ▶️ su "Run All" per tutti i test

### Metodo 3: Command Palette

- `Ctrl+Shift+P` → `Vitest: Run All Tests`
- `Ctrl+Shift+P` → `Vitest: Run Current File`
- `Ctrl+Shift+P` → `Playwright: Run Tests`

### Metodo 4: Tasks

- `Ctrl+Shift+P` → `Tasks: Run Task` → `Test: Unit`
- `Ctrl+Shift+P` → `Tasks: Run Task` → `Test: E2E`

---

## 🔍 VERIFICA

Dopo setup, verifica che funzioni:

✅ **Code Lens visibile:**
- Apri `tests/unit/stripe-payments.test.ts`
- Dovresti vedere "Run | Debug" sopra ogni test

✅ **Test Explorer funzionante:**
- Apri sidebar Test Explorer (icona beaker)
- Dovresti vedere tutti i test organizzati

✅ **Test eseguibili:**
- Clicca "Run" su un test → viene eseguito
- Risultati appaiono nel Test Explorer

---

## 🐛 PROBLEMI?

### "Run | Debug" non appare

**Soluzione:**
1. Verifica che il file finisca con `.test.ts` o `.spec.ts`
2. Riavvia VS Code
3. Verifica che estensione Vitest sia installata e abilitata

### Test Explorer vuoto

**Soluzione:**
1. `Ctrl+Shift+P` → `Vitest: Restart`
2. Verifica che `vitest.config.ts` esista
3. Esegui `npm install` se necessario

### Test non si eseguono

**Soluzione:**
1. Apri terminale integrato e verifica errori
2. Esegui manualmente: `npm run test:unit`
3. Se funziona manualmente, riavvia VS Code

---

## 📚 DOCUMENTAZIONE COMPLETA

Per dettagli completi, vedi: `docs/VS_CODE_TEST_SETUP.md`

---

**Pronto!** Ora puoi eseguire test direttamente da VS Code senza aprire il terminale! 🎉


