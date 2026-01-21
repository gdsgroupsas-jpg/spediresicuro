# 📚 Tipi di Test: Differenze e Quando Usarli

## 🎯 Panoramica

Nel progetto SpedireSicuro abbiamo **3 tipi di test**:

1. **Test Unit** (`tests/unit/`) - Test isolati di singole funzioni
2. **Test Integration** (`tests/integration/`) - Test di integrazione tra componenti
3. **Test E2E** (`e2e/`) - Test end-to-end con browser reale

---

## 1️⃣ TEST UNIT (Unit Tests)

### Cos'è

Test di **singole funzioni/classi** in isolamento, senza dipendenze esterne.

### Caratteristiche

- ✅ **Velocissimi** (millisecondi)
- ✅ **Isolati** (mock di tutte le dipendenze)
- ✅ **Deterministici** (stesso input = stesso output)
- ✅ **Facili da debuggare** (errore preciso su funzione specifica)

### Quando Usarli

- Testare logica di business pura
- Testare funzioni helper/utilities
- Testare validazione input
- Testare calcoli matematici

### Esempio dal Progetto

```typescript
// tests/unit/pricing-matrix-helpers.test.ts
describe('getZonesForMode()', () => {
  it('dovrebbe restituire 2 zone per fast mode', () => {
    const zones = getZonesForMode('fast');
    expect(zones.length).toBe(2);
  });
});
```

**Cosa testa:** Solo la funzione `getZonesForMode()` - nessun database, nessuna API, nessun browser.

### Framework

- **Vitest** (veloce, compatibile con Vite)
- Eseguiti con: `npm run test`

---

## 2️⃣ TEST INTEGRATION (Integration Tests)

### Cos'è

Test di **integrazione tra componenti** (es: funzione + database, API + worker).

### Caratteristiche

- ⚡ **Veloci** (secondi)
- 🔗 **Testano interazioni** tra componenti
- 🗄️ **Possono usare database reale** (con cleanup)
- 🔌 **Possono chiamare API reali** (con mock opzionali)

### Quando Usarli

- Testare flussi completi (es: OCR → Address → Pricing)
- Testare integrazione con database
- Testare server actions
- Testare workers (booking, OCR, etc.)

### Esempio dal Progetto

```typescript
// tests/integration/booking-worker.test.ts
describe('bookingWorker', () => {
  it('dovrebbe creare spedizione dopo conferma', async () => {
    const result = await bookingWorker({
      shipmentDraft: mockDraft,
      pricingOptions: mockPricing,
      // ... altri parametri
    });

    expect(result.success).toBe(true);
    expect(result.shipmentId).toBeDefined();
  });
});
```

**Cosa testa:** Il worker completo che:

1. Fa preflight check
2. Chiama adapter corriere
3. Salva nel database
4. Ritorna risultato

### Framework

- **Vitest** (stesso di unit test)
- Eseguiti con: `npm run test`

---

## 3️⃣ TEST E2E (End-to-End Tests)

### Cos'è

Test che simulano un **utente reale** che usa l'applicazione nel browser.

### Caratteristiche

- 🐌 **Lenti** (secondi/minuti per test)
- 🌐 **Usano browser reale** (Chrome, Firefox, Safari)
- 🖥️ **Testano UI completa** (HTML, CSS, JavaScript)
- 🔄 **Testano flussi utente completi** (click, form, navigazione)

### Quando Usarli

- Testare flussi utente completi
- Testare interazione UI
- Testare responsive design
- Testare autenticazione/login
- Testare form complessi

### Esempio dal Progetto

```typescript
// e2e/happy-path.spec.ts
test('Nuova Spedizione - Happy Path', async ({ page }) => {
  // 1. Naviga alla pagina
  await page.goto('/dashboard/spedizioni/nuova');

  // 2. Compila form
  await page.fill('input[name="recipient.name"]', 'Mario Rossi');
  await page.fill('input[name="recipient.city"]', 'Milano');

  // 3. Clicca submit
  await page.click('button[type="submit"]');

  // 4. Verifica risultato
  await expect(page.locator('.success-message')).toBeVisible();
});
```

**Cosa testa:** L'intero flusso come lo vede l'utente:

1. Apre pagina nel browser
2. Compila form reale
3. Clicca pulsanti reali
4. Verifica risultato visibile

### Framework

- **Playwright** (moderno, veloce, multi-browser)
- Eseguiti con: `npx playwright test`

---

## 📊 Confronto Dettagliato

| Caratteristica  | Unit Test           | Integration Test       | E2E Test      |
| --------------- | ------------------- | ---------------------- | ------------- |
| **Velocità**    | ⚡⚡⚡ Millisecondi | ⚡⚡ Secondi           | 🐌 Minuti     |
| **Isolamento**  | ✅ Completo         | ⚠️ Parziale            | ❌ Nessuno    |
| **Browser**     | ❌ No               | ❌ No                  | ✅ Sì (reale) |
| **Database**    | ❌ Mock             | ✅ Reale (con cleanup) | ✅ Reale      |
| **API Esterne** | ❌ Mock             | ⚠️ Mock/Reale          | ✅ Reale      |
| **UI Testing**  | ❌ No               | ❌ No                  | ✅ Sì         |
| **Debug**       | ✅ Facile           | ⚠️ Medio               | ❌ Difficile  |
| **Costo**       | 💰 Basso            | 💰 Medio               | 💰 Alto       |
| **Coverage**    | 🎯 Specifico        | 🎯 Componente          | 🎯 Flusso     |

---

## 🎯 Quando Usare Quale

### ✅ Usa **Unit Test** per:

- Funzioni pure (calcoli, validazioni)
- Helper/utilities
- Logica di business isolata
- **Esempio:** `getZonesForMode()`, `validateConfigId()`, `mergeMetadata()`

### ✅ Usa **Integration Test** per:

- Server actions
- Workers (booking, OCR, address)
- Flussi multi-step (OCR → Address → Pricing)
- Integrazione con database
- **Esempio:** `bookingWorker()`, `syncPriceListsFromSpedisciOnline()`

### ✅ Usa **E2E Test** per:

- Flussi utente completi
- Form complessi
- Navigazione tra pagine
- Autenticazione/login
- **Esempio:** "Crea nuova spedizione", "Login utente", "Dashboard completa"

---

## 🏗️ Architettura Test nel Progetto

```
spediresicuro/
├── tests/
│   ├── unit/              ← Test unit (Vitest)
│   │   ├── pricing-matrix-helpers.test.ts
│   │   ├── multi-account-security.test.ts
│   │   └── ...
│   │
│   └── integration/       ← Test integrazione (Vitest)
│       ├── booking-worker.test.ts
│       ├── ocr-worker.test.ts
│       └── ...
│
├── e2e/                   ← Test E2E (Playwright)
│   ├── happy-path.spec.ts
│   ├── form-validation.spec.ts
│   └── ...
│
├── vitest.config.mts      ← Config Vitest (unit + integration)
└── playwright.config.ts   ← Config Playwright (E2E)
```

---

## 🚀 Come Eseguire i Test

### Test Unit + Integration (Vitest)

```bash
# Tutti i test
npm run test

# Solo unit
npm run test -- tests/unit

# Solo integration
npm run test -- tests/integration

# File specifico
npm run test -- tests/unit/pricing-matrix-helpers.test.ts
```

### Test E2E (Playwright)

```bash
# Tutti i test E2E
npx playwright test

# Test specifico
npx playwright test e2e/happy-path.spec.ts

# Con UI (vedi browser)
npx playwright test --ui

# In modalità debug
npx playwright test --debug
```

---

## ⚠️ Perché E2E Falliscono con Vitest?

I file E2E (`e2e/*.spec.ts`) usano **Playwright**, non Vitest:

```typescript
// ❌ SBAGLIATO: Questo è Playwright, non Vitest
import { test, expect } from '@playwright/test';

test.describe('...', () => {
  // ...
});
```

**Errore che vedi:**

```
Error: Playwright Test did not expect test.describe() to be called here.
```

**Soluzione:** Esegui E2E con Playwright, non con Vitest:

```bash
# ✅ CORRETTO
npx playwright test

# ❌ SBAGLIATO (causa errore)
npm run test -- e2e/
```

---

## 📈 Coverage Target

### Obiettivo: 9/10 o 10/10

**Distribuzione ideale:**

- **70% Unit Tests** - Logica business, utilities
- **20% Integration Tests** - Flussi, workers, server actions
- **10% E2E Tests** - Flussi utente critici

**Nel nostro progetto:**

- ✅ **543 test unit** (logica, security, validazioni)
- ✅ **164 test integration** (workers, sync, API)
- ✅ **10 test E2E** (happy path, form, login)

---

## 🎓 Best Practices

### 1. Piramide dei Test

```
        /\
       /E2E\        ← Pochi, ma critici
      /------\
     /Integration\  ← Alcuni, flussi importanti
    /------------\
   /    Unit      \  ← Molti, copertura completa
  /----------------\
```

### 2. Test Unit: Veloce e Isolato

```typescript
// ✅ BENE: Test isolato con mock
it('dovrebbe validare UUID', () => {
  const result = validateUUID('550e8400-...');
  expect(result).toBe(true);
});
```

### 3. Test Integration: Testa Interazioni

```typescript
// ✅ BENE: Testa integrazione reale
it('dovrebbe salvare listino nel database', async () => {
  const result = await createPriceList(data);
  expect(result.id).toBeDefined();

  // Cleanup
  await deletePriceList(result.id);
});
```

### 4. Test E2E: Testa Flussi Utente

```typescript
// ✅ BENE: Testa come utente reale
test('utente può creare spedizione', async ({ page }) => {
  await page.goto('/dashboard/spedizioni/nuova');
  await page.fill('input[name="recipient.name"]', 'Mario');
  await page.click('button[type="submit"]');
  await expect(page.locator('.success')).toBeVisible();
});
```

---

## 🔍 Debugging

### Unit/Integration Test (Vitest)

```bash
# Debug con breakpoint
npm run test -- --inspect-brk

# Watch mode (ri-esegue su cambio file)
npm run test -- --watch

# Coverage report
npm run test -- --coverage
```

### E2E Test (Playwright)

```bash
# Debug interattivo
npx playwright test --debug

# UI mode (vedi test in browser)
npx playwright test --ui

# Trace viewer (vedi cosa è successo)
npx playwright show-trace trace.zip
```

---

## 📝 Riepilogo

| Tipo            | Framework  | Velocità | Scope               | Quando Usare    |
| --------------- | ---------- | -------- | ------------------- | --------------- |
| **Unit**        | Vitest     | ⚡⚡⚡   | Funzione singola    | Logica business |
| **Integration** | Vitest     | ⚡⚡     | Componenti multipli | Flussi, workers |
| **E2E**         | Playwright | 🐌       | App completa        | Flussi utente   |

**Regola d'oro:** Più test unit, alcuni integration, pochi E2E! 🎯
