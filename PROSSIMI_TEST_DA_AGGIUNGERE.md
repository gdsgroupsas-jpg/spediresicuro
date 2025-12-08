# 🧪 Prossimi Test E2E da Aggiungere

## ✅ Test Attuali

### 1. `e2e/happy-path.spec.ts` ✅
**Flusso "Nuova Spedizione"**
- ✅ Copre il flusso completo di creazione spedizione
- ✅ Tempo: 28.1s
- ✅ Stabilità: 100%

### 2. `e2e/form-validation.spec.ts` ✅ **NUOVO**
**Validazione Form**
- ✅ 7 scenari di validazione
- ✅ Test errori form
- ✅ Verifica pulsante submit

### 3. `e2e/shipments-list.spec.ts` ✅ **NUOVO**
**Lista Spedizioni**
- ✅ 4 scenari di visualizzazione e filtri
- ✅ Test ricerca e filtri

### 4. `e2e/shipment-detail.spec.ts` ✅ **NUOVO**
**Dettaglio Spedizione**
- ✅ 4 scenari di dettaglio e tracking
- ✅ Test download etichetta

## 🎯 Test da Aggiungere (Priorità)

### ✅ 1. Test Validazione Form (COMPLETATO)
**File:** `e2e/form-validation.spec.ts` ✅

**Scenari implementati:**
- ✅ Submit form incompleto (pulsante disabilitato)
- ✅ Email non valida
- ✅ Telefono non valido
- ✅ Peso zero o negativo
- ✅ Nome/indirizzo troppo corti
- ✅ Form completo abilita submit

### ✅ 2. Test Lista Spedizioni (COMPLETATO)
**File:** `e2e/shipments-list.spec.ts` ✅

**Scenari implementati:**
- ✅ Visualizzazione lista spedizioni
- ✅ Filtri per status (in_preparazione)
- ✅ Ricerca per tracking number
- ✅ Visualizzazione dettagli nella lista

**Da aggiungere:**
- ⏳ Paginazione
- ⏳ Export CSV/PDF

### ✅ 3. Test Dettaglio Spedizione (COMPLETATO)
**File:** `e2e/shipment-detail.spec.ts` ✅

**Scenari implementati:**
- ✅ Visualizzazione dettagli completi
- ✅ Storia eventi tracking
- ✅ Download etichetta
- ✅ Visualizzazione status

**Da aggiungere:**
- ⏳ Azioni disponibili (annulla, modifica)

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
