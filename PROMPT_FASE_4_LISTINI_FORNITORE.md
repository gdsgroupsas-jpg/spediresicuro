# 📋 Fase 4: Integrazione Wallet con Listini Fornitore

**Stato**: 🟡 **PIANIFICATA**  
**Priorità**: Media  
**Dipendenze**: Fase 3 completata ✅

---

## 🎯 Obiettivo

Integrare il margine del listino fornitore nel calcolo del costo finale scalato dal wallet quando un Reseller o BYOC crea una spedizione usando il proprio listino.

---

## ❓ Domanda Business (Da Risolvere Prima)

**Quando un Reseller/BYOC crea una spedizione usando il suo listino fornitore:**

1. **Opzione A (Attuale)**: Reseller paga solo costo corriere + platform fee
   - Il margine serve solo per calcolare prezzo vendita a sub-users
   - ✅ Comportamento attuale

2. **Opzione B (Da Implementare)**: Reseller paga costo corriere + margine + platform fee
   - Il margine viene scalato dal wallet del Reseller
   - Il margine va al sistema/platform
   - ⚠️ Richiede implementazione

**Decisione richiesta**: Quale opzione implementare?

---

## 📊 Analisi Tecnica

### Comportamento Attuale

```typescript
// lib/shipments/create-shipment-core.ts
const courierFinalCost = courierResponse.cost  // Costo reale API corriere
const finalCost = courierFinalCost + platformFee
// ❌ Margine listino NON incluso
```

### Comportamento Proposto (Opzione B)

```typescript
// 1. Recupera listino fornitore del Reseller/BYOC
const priceList = await getSupplierPriceListForCourierAction(courierId)

// 2. Calcola prezzo con margine
const priceResult = await calculatePriceWithRules(userId, params, priceList.id)
// priceResult.finalPrice = basePrice + surcharges + margin

// 3. Usa prezzo con margine per wallet debit
const finalCost = priceResult.finalPrice + platformFee
```

---

## 📋 Task Implementazione

### 1. Analisi e Decisione Business ⏳

- [ ] Review `ANALISI_WALLET_RESELLER_LISTINO.md`
- [ ] Decisione business: Opzione A o B?
- [ ] Documentare decisione in questo file
- [ ] Validare con stakeholder

### 2. Modifiche Backend ⏳

**File da modificare:**

- [ ] `lib/shipments/create-shipment-core.ts`
  - Recuperare listino fornitore se Reseller/BYOC
  - Calcolare prezzo con margine usando `calculatePriceWithRules()`
  - Usare `finalPrice` (con margine) invece di `courierResponse.cost`
  - Gestire fallback se listino non trovato

- [ ] `app/api/shipments/create/route.ts`
  - Stessa logica: integrare margine nel calcolo
  - Mantenere compatibilità con utenti normali (senza listino)

### 3. Logica Recupero Listino ⏳

- [ ] Verificare `getSupplierPriceListForCourierAction()` funziona correttamente
- [ ] Gestire caso: Reseller/BYOC senza listino configurato
- [ ] Fallback: usare costo corriere diretto se listino non disponibile

### 4. Test ⏳

- [ ] Test Reseller con listino fornitore (margine 10%, 20%, 50%)
- [ ] Test BYOC con listino fornitore
- [ ] Test Reseller senza listino (fallback)
- [ ] Test utente normale (non Reseller/BYOC)
- [ ] Verificare wallet debit corretto
- [ ] Verificare wallet transactions corrette
- [ ] Test edge cases:
  - Listino con margine 0%
  - Listino con margine negativo (sconto)
  - Listino non attivo
  - Listino scaduto

### 5. Documentazione ⏳

- [ ] Aggiornare `docs/MONEY_FLOWS.md` con nuovo comportamento
- [ ] Documentare esempi pratici con calcoli
- [ ] Aggiornare `IMPLEMENTAZIONE_LISTINI_FORNITORE.md`
- [ ] Creare `REPORT_FASE_4_LISTINI_FORNITORE.md` al completamento

---

## 🔍 Dettagli Implementazione

### Flusso Proposto

```typescript
// 1. Verifica se utente è Reseller/BYOC
const isReseller = user.is_reseller === true
const isBYOC = user.account_type === 'byoc'

if (isReseller || isBYOC) {
  // 2. Recupera listino fornitore per corriere
  const priceListResult = await getSupplierPriceListForCourierAction(courierId)
  
  if (priceListResult.success && priceListResult.priceList) {
    // 3. Calcola prezzo con margine
    const priceResult = await calculatePriceWithRules(
      userId,
      {
        weight: validated.weight,
        destination: {
          zip: validated.recipient.zip,
          province: validated.recipient.province,
          // ...
        },
        courierId: courierId,
        serviceType: validated.service_type,
        options: {
          declaredValue: validated.declared_value,
          cashOnDelivery: validated.cash_on_delivery,
          insurance: validated.insurance,
        }
      },
      priceListResult.priceList.id
    )
    
    if (priceResult) {
      // 4. Usa prezzo con margine
      const courierFinalCost = priceResult.finalPrice
      const finalCost = courierFinalCost + platformFee
    } else {
      // Fallback: usa costo corriere diretto
      const courierFinalCost = courierResponse.cost
      const finalCost = courierFinalCost + platformFee
    }
  } else {
    // Fallback: usa costo corriere diretto
    const courierFinalCost = courierResponse.cost
    const finalCost = courierFinalCost + platformFee
  }
} else {
  // Utente normale: usa costo corriere diretto
  const courierFinalCost = courierResponse.cost
  const finalCost = courierFinalCost + platformFee
}
```

---

## ⚠️ Considerazioni

### Compatibilità

- ✅ Utenti normali: nessun cambiamento (usano costo corriere diretto)
- ✅ Reseller/BYOC senza listino: fallback a costo corriere diretto
- ⚠️ Reseller/BYOC con listino: nuovo comportamento (margine incluso)

### Performance

- ⚠️ Aggiunge query per recuperare listino
- ⚠️ Aggiunge calcolo prezzo con regole
- ✅ Ottimizzabile con cache se necessario

### Testing

- ⚠️ Richiede test approfonditi per evitare regressioni
- ⚠️ Test wallet debit critici (no credit, no label)
- ⚠️ Test edge cases multipli

---

## 📄 File Riferimento

- `ANALISI_WALLET_RESELLER_LISTINO.md` - Analisi tecnica completa
- `lib/shipments/create-shipment-core.ts` - File da modificare
- `app/api/shipments/create/route.ts` - File da modificare
- `actions/price-lists.ts` - `getSupplierPriceListForCourierAction()`
- `lib/db/price-lists-advanced.ts` - `calculatePriceWithRules()`
- `docs/MONEY_FLOWS.md` - Documentazione flussi finanziari

---

**Ultimo Aggiornamento**: 2026-01-02  
**Stato**: 🟡 **PIANIFICATA - IN ATTESA DECISIONE BUSINESS**  
**Prossimo Step**: Decisione business (Opzione A o B)

