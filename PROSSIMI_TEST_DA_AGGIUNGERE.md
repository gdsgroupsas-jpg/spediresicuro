# 🧪 Prossimi Test E2E da Aggiungere

## ✅ Test Attuale

**`e2e/happy-path.spec.ts`** - Flusso "Nuova Spedizione"
- ✅ Copre il flusso completo di creazione spedizione
- ✅ Tempo: 28.1s
- ✅ Stabilità: 100%

## 🎯 Test da Aggiungere (Priorità)

### 1. Test Validazione Form (ALTA PRIORITÀ)
**File:** `e2e/form-validation.spec.ts`

**Scenari:**
- ❌ Submit form incompleto (campi obbligatori mancanti)
- ❌ Email non valida
- ❌ Telefono non valido
- ❌ Peso negativo o zero
- ❌ Città non selezionata
- ✅ Verifica messaggi di errore corretti

### 2. Test Lista Spedizioni (MEDIA PRIORITÀ)
**File:** `e2e/shipments-list.spec.ts`

**Scenari:**
- ✅ Visualizzazione lista spedizioni
- ✅ Filtri per status (pending, in_transit, delivered)
- ✅ Ricerca per tracking number
- ✅ Paginazione
- ✅ Export CSV/PDF

### 3. Test Dettaglio Spedizione (MEDIA PRIORITÀ)
**File:** `e2e/shipment-detail.spec.ts`

**Scenari:**
- ✅ Visualizzazione dettagli spedizione
- ✅ Tracking in tempo reale
- ✅ Storia eventi
- ✅ Download etichetta
- ✅ Azioni disponibili (annulla, modifica)

### 4. Test Wallet (BASSA PRIORITÀ)
**File:** `e2e/wallet.spec.ts`

**Scenari:**
- ✅ Visualizzazione saldo
- ✅ Storico transazioni
- ✅ Ricarica wallet (mock)
- ✅ Verifica movimenti

### 5. Test Listini (BASSA PRIORITÀ)
**File:** `e2e/price-lists.spec.ts`

**Scenari:**
- ✅ Visualizzazione listini
- ✅ Creazione nuovo listino
- ✅ Modifica listino esistente
- ✅ Applicazione margini

## 📋 Template per Nuovi Test

```typescript
import { test, expect } from '@playwright/test';

test.describe('Nome Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Bypass autenticazione
    await page.setExtraHTTPHeaders({
      'x-test-mode': 'playwright',
    });
    
    // Mock API necessarie
    // ...
  });

  test('Scenario da testare', async ({ page }) => {
    // Test steps
  });
});
```

## 🚀 Come Aggiungere Nuovi Test

1. Crea nuovo file in `e2e/` (es. `form-validation.spec.ts`)
2. Usa il template sopra
3. Esegui localmente: `npm run test:e2e`
4. Verifica che passi
5. Commit e push → CI/CD eseguirà automaticamente

## 📊 Priorità Implementazione

1. **Form Validation** - Importante per UX
2. **Lista Spedizioni** - Funzionalità core
3. **Dettaglio Spedizione** - Funzionalità core
4. **Wallet** - Funzionalità secondaria
5. **Listini** - Funzionalità avanzata

## 🎯 Obiettivo

Avere una **test suite completa** che copra:
- ✅ Happy paths (già fatto)
- ⏳ Error handling
- ⏳ Validazioni
- ⏳ Edge cases
- ⏳ Integrazioni

---

**Prossimo test consigliato: Form Validation** 🎯
