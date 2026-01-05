# 🔄 Sostituire Playwright con Vitest: Guida Completa

## ❓ Domanda: "Posso sostituire Playwright?"

**Risposta breve:** **Sì, per la logica backend. No, per la UI.**

---

## ✅ Cosa POSSO Sostituire (Test Integration Vitest)

### 1. **Test API Routes** ✅
**E2E Playwright:**
```typescript
// e2e/happy-path.spec.ts
await page.goto('/dashboard/spedizioni/nuova');
await page.fill('input[name="recipient.name"]', 'Mario');
await page.click('button[type="submit"]');
```

**Equivalente Vitest:**
```typescript
// tests/integration/api-routes.test.ts
const response = await POST('/api/shipments/create', {
  recipient: { name: 'Mario', ... },
  packages: [...]
});
expect(response.success).toBe(true);
```

**Vantaggi:**
- ⚡ **10x più veloce** (secondi vs minuti)
- ✅ **Più deterministico** (no timeout browser)
- 🎯 **Testa logica backend** (non UI)

---

### 2. **Test Validazione Input** ✅
**E2E Playwright:**
```typescript
// Testa che form non accetti input invalido
await page.fill('input[name="postalCode"]', '123'); // CAP invalido
await page.click('button[type="submit"]');
await expect(page.locator('.error')).toBeVisible();
```

**Equivalente Vitest:**
```typescript
// Testa che API rifiuti input invalido
const response = await POST('/api/shipments/create', {
  recipient: { postalCode: '123' } // CAP invalido
});
expect(response.status).toBe(400);
expect(response.error).toContain('CAP');
```

**Vantaggi:**
- ⚡ **Immediato** (no attesa rendering)
- 🎯 **Preciso** (errore esatto)

---

### 3. **Test Autenticazione** ✅
**E2E Playwright:**
```typescript
// Testa redirect a login se non autenticato
await page.goto('/dashboard');
await expect(page.url()).toContain('/login');
```

**Equivalente Vitest:**
```typescript
// Testa che API restituisca 401
const response = await GET('/api/shipments');
expect(response.status).toBe(401);
```

---

### 4. **Test Business Logic** ✅
**E2E Playwright:**
```typescript
// Testa che spedizione venga creata
await page.fill('form', {...});
await page.click('submit');
await expect(page.locator('.success')).toBeVisible();
```

**Equivalente Vitest:**
```typescript
// Testa che API crei spedizione
const result = await createShipmentCore({...});
expect(result.shipmentId).toBeDefined();
expect(result.success).toBe(true);
```

---

## ❌ Cosa NON POSSO Sostituire (Serve Playwright)

### 1. **Test UI/Rendering** ❌
```typescript
// E2E Playwright - Testa rendering reale
await expect(page.locator('.button')).toBeVisible();
await expect(page.locator('.error')).toHaveCSS('color', 'red');
```

**Perché non posso sostituire:**
- Vitest non ha browser
- Non può testare CSS
- Non può testare layout responsive

---

### 2. **Test Interazioni Browser** ❌
```typescript
// E2E Playwright - Testa click, hover, drag
await page.click('button');
await page.hover('.tooltip');
await page.dragAndDrop('.item', '.target');
```

**Perché non posso sostituire:**
- Vitest non ha DOM reale
- Non può simulare eventi mouse/keyboard

---

### 3. **Test JavaScript Client-Side** ❌
```typescript
// E2E Playwright - Testa React state, hooks
await page.evaluate(() => {
  // JavaScript eseguito nel browser
  window.localStorage.setItem('key', 'value');
});
```

**Perché non posso sostituire:**
- Vitest esegue in Node.js, non browser
- Non ha accesso a `window`, `document`, `localStorage`

---

## 📊 Confronto: Cosa Testa Cosa

| Cosa Testare | E2E Playwright | Vitest Integration | Posso Sostituire? |
|--------------|----------------|-------------------|-------------------|
| **API Routes** | ✅ (indirettamente) | ✅ (direttamente) | ✅ **SÌ** |
| **Validazione Input** | ✅ (via form) | ✅ (via API) | ✅ **SÌ** |
| **Business Logic** | ✅ (via UI) | ✅ (direttamente) | ✅ **SÌ** |
| **Autenticazione** | ✅ (redirect) | ✅ (401/403) | ✅ **SÌ** |
| **Rendering UI** | ✅ | ❌ | ❌ **NO** |
| **CSS/Layout** | ✅ | ❌ | ❌ **NO** |
| **Interazioni Browser** | ✅ | ❌ | ❌ **NO** |
| **JavaScript Client** | ✅ | ❌ | ❌ **NO** |

---

## 🎯 Strategia: Quando Usare Quale

### ✅ Usa **Vitest Integration** per:
- Test API routes direttamente
- Test validazione input
- Test business logic
- Test autenticazione/autorizzazione
- **Risultato:** 90% dei test E2E possono essere sostituiti!

### ✅ Mantieni **Playwright E2E** per:
- Test rendering UI critici
- Test flussi utente completi (opzionale)
- Test responsive design (opzionale)
- **Risultato:** Solo 10% dei test E2E necessari!

---

## 💡 Esempio: Sostituzione Completa

### Test E2E Originale (Playwright)
```typescript
// e2e/happy-path.spec.ts
test('Crea nuova spedizione', async ({ page }) => {
  await page.goto('/dashboard/spedizioni/nuova');
  await page.fill('input[name="recipient.name"]', 'Mario');
  await page.fill('input[name="recipient.city"]', 'Milano');
  await page.fill('input[name="recipient.postalCode"]', '20100');
  await page.click('button[type="submit"]');
  await expect(page.locator('.success')).toBeVisible();
});
```

### Test Integration Equivalente (Vitest)
```typescript
// tests/integration/api-routes.test.ts
it('dovrebbe creare spedizione via API', async () => {
  const response = await POST('/api/shipments/create', {
    recipient: {
      name: 'Mario',
      city: 'Milano',
      postalCode: '20100',
      province: 'MI',
      country: 'IT',
    },
    packages: [{ weightKg: 2.5 }],
    carrier: 'GLS',
  });
  
  expect(response.success).toBe(true);
  expect(response.shipmentId).toBeDefined();
});
```

**Vantaggi:**
- ⚡ **10x più veloce** (2 secondi vs 30 secondi)
- ✅ **Più affidabile** (no timeout browser)
- 🎯 **Testa logica backend** (non UI)

---

## 🚀 Raccomandazione

### Per il tuo progetto:

1. **Sostituisci 90% E2E con Integration Tests**
   - Test API routes direttamente
   - Test validazione input
   - Test business logic
   - **Risultato:** Test più veloci e affidabili

2. **Mantieni 10% E2E per UI critica**
   - Solo flussi utente essenziali
   - Solo rendering critico
   - **Risultato:** Copertura UI minima ma sufficiente

3. **Focus su Test Unit + Integration**
   - 70% Unit (logica, security)
   - 20% Integration (API, flussi)
   - 10% E2E (UI critica)
   - **Risultato:** Piramide test ottimale

---

## 📝 Esempio Pratico: Sostituzione

Ho creato `tests/integration/api-routes.test.ts` che:
- ✅ Testa API routes direttamente
- ✅ Testa validazione input
- ✅ Testa autenticazione
- ✅ **Sostituisce** la maggior parte dei test E2E

**Vuoi che converta tutti i test E2E in test integration?** 🚀

