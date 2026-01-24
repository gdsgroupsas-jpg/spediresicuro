# E2E Tests con Playwright

Questo documento spiega come eseguire e debuggare i test E2E per SpedireSicuro.

## 🚀 Setup Iniziale

I test sono già configurati. Per eseguirli:

```bash
# Installa le dipendenze (già fatto)
npm install

# Installa i browser Playwright (già fatto)
npx playwright install chromium
```

## 📝 Eseguire i Test

### Modalità Base (Headless)

```bash
npm run test:e2e
```

### Modalità UI (Interattiva - Consigliata per Debug)

```bash
npm run test:e2e:ui
```

### Modalità Headed (Vedi il Browser)

```bash
npm run test:e2e:headed
```

### Modalità Debug (Step-by-step)

```bash
npm run test:e2e:debug
```

## 🧪 Test Disponibili

### `happy-path.spec.ts`

Test del flusso completo "Nuova Spedizione":

- Login (se necessario)
- Navigazione a `/dashboard/spedizioni/nuova`
- Compilazione form mittente
- Compilazione form destinatario
- Compilazione dettagli pacco
- Selezione corriere
- Invio form
- Verifica successo

## 🔧 Configurazione

### Variabili d'Ambiente

Il test usa `PLAYWRIGHT_TEST_BASE_URL` per l'URL base dell'app:

- Default: `http://localhost:3000`
- In CI: configurare la variabile d'ambiente

### Utente di Test

Il test richiede un utente di test nel database per il login. Configura le credenziali:

**Opzione 1: Variabili d'ambiente (consigliato)**
Crea un file `.env.test` o aggiungi al tuo `.env.local`:

```bash
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
```

**Opzione 2: Valori di default**
Se non configuri le variabili, il test userà:

- Email: `test@example.com`
- Password: `testpassword123`

**⚠️ IMPORTANTE**: Assicurati che questo utente esista nel database prima di eseguire i test!

### Mock API

Tutte le chiamate API esterne sono **automaticamente mockate**:

- ✅ `/api/geo/search` - Ricerca città (mockato)
- ✅ `/api/spedizioni` - Creazione spedizione (mockato)
- ✅ `/api/fulfillment/decide` - Decisione fulfillment (mockato)
- ✅ `/api/corrieri/**` - API corrieri (mockato)

**Nessuna chiamata reale viene fatta** - zero costi, zero errori di rete.

## 🐛 Debug

### Se un Test Fallisce

1. **Esegui in modalità UI** per vedere cosa succede:

   ```bash
   npm run test:e2e:ui
   ```

2. **Controlla screenshot e video**:
   - Dopo un fallimento, Playwright salva automaticamente:
     - Screenshot in `test-results/`
     - Video in `test-results/`
     - Trace in `test-results/`

3. **Apri il report HTML**:
   ```bash
   npx playwright show-report
   ```

### Problemi Comuni

#### Test fallisce su "Elemento non trovato"

- **Causa**: Il selettore non trova l'elemento
- **Soluzione**:
  1. Esegui in modalità UI per vedere lo stato della pagina
  2. Verifica che il componente sia renderizzato
  3. Aggiungi `data-testid` al componente se necessario

#### Test fallisce su "Timeout"

- **Causa**: L'elemento impiega troppo tempo ad apparire
- **Soluzione**:
  1. Aumenta il timeout nel test (già configurato a 10-15 secondi)
  2. Verifica che non ci siano errori JavaScript nella console
  3. Controlla che l'API mockata risponda correttamente

#### Test fallisce su "Autenticazione"

- **Causa**: La pagina richiede login
- **Soluzione**:
  1. Implementa login via UI nel test
  2. O mocka la sessione NextAuth (vedi `test.beforeEach`)

## 📊 CI/CD

I test sono configurati per eseguire in CI:

- Headless mode automatico
- Retry automatico (2 tentativi)
- Screenshot/video su failure
- Report HTML generato

## 🔄 Workflow di Debug

Quando un test fallisce:

1. **Esegui in UI mode**:

   ```bash
   npm run test:e2e:ui
   ```

2. **Identifica il problema**:
   - Guarda lo screenshot
   - Controlla la console del browser
   - Verifica i network requests

3. **Modifica il test**:
   - Aggiungi selettori più robusti
   - Aumenta timeout se necessario
   - Aggiungi `data-testid` ai componenti se serve

4. **Riesegui** fino a quando passa (GREEN STATE)

## 📝 Aggiungere Nuovi Test

1. Crea un nuovo file in `e2e/`:

   ```typescript
   import { test, expect } from '@playwright/test';

   test('Mio nuovo test', async ({ page }) => {
     // Mock API se necessario
     await page.route('**/api/endpoint', async (route) => {
       await route.fulfill({
         /* mock response */
       });
     });

     // Test logic
   });
   ```

2. Esegui il test:
   ```bash
   npm run test:e2e
   ```

## ⚠️ Note Importanti

- **Sempre mockare API esterne** - Non fare chiamate reali
- **Usare selettori robusti** - Preferire label, placeholder, role invece di classi CSS
- **Timeout generosi** - Next.js può essere lento in sviluppo
- **Retry in CI** - I test hanno 2 retry automatici in CI
