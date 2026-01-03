# 💰 Analisi: Wallet Reseller con Listino Fornitore

**Domanda**: Quando un Reseller usa il suo contratto e il suo listino fornitore, cosa viene scalato dal wallet?

---

## 🔍 Analisi Codice Attuale

### Flusso Creazione Spedizione

1. **Stima Costo** (prima della chiamata corriere):
   ```typescript
   const baseEstimatedCost = 8.5
   const courierEstimate = baseEstimatedCost * 1.2 // Buffer 20%
   const platformFee = await getPlatformFeeSafe(targetId)
   const estimatedCost = courierEstimate + platformFee
   ```

2. **Debit Wallet** (con stima):
   ```typescript
   await supabaseAdmin.rpc('decrement_wallet_balance', {
     p_user_id: targetId,
     p_amount: estimatedCost
   })
   ```

3. **Chiamata API Corriere**:
   ```typescript
   const courierResponse = await courierClient.createShipping(...)
   // courierResponse.cost = costo reale del corriere (senza margine)
   ```

4. **Costo Finale**:
   ```typescript
   const courierFinalCost = courierResponse.cost
   const finalCost = courierFinalCost + platformFee
   ```

5. **Aggiustamento Wallet**:
   ```typescript
   const costDifference = finalCost - walletDebitAmount
   // Se differenza > 0.01, aggiusta wallet
   ```

---

## ⚠️ RISPOSTA: Cosa Viene Scalato

**Dal wallet del Reseller viene scalato:**
- ✅ **Costo reale del corriere** (`courierResponse.cost`)
- ✅ **Platform fee** (se configurata)
- ❌ **NON viene scalato il margine del listino**

---

## 📊 Esempio Pratico

### Scenario:
- Reseller ha listino fornitore con **margine 20%**
- Costo reale corriere: **€10.00**
- Platform fee: **€0.50**

### Cosa succede:

1. **Listino calcola prezzo con margine:**
   ```
   basePrice = €10.00
   margin = €10.00 * 20% = €2.00
   finalPrice = €12.00 (prezzo mostrato all'utente)
   ```

2. **Dal wallet Reseller viene scalato:**
   ```
   courierCost = €10.00 (costo reale API corriere)
   platformFee = €0.50
   totalDebit = €10.50 (NON €12.50!)
   ```

3. **Risultato:**
   - Reseller paga: **€10.50**
   - Se Reseller vende a sub-user: sub-user dovrebbe pagare **€12.00**
   - **Margine Reseller: €1.50** (€12.00 - €10.50)

---

## 🔍 Verifica: Listino Usato nel Calcolo?

**Risposta: NO**

Il listino fornitore **NON viene usato** nel calcolo del costo finale che viene scalato dal wallet.

Il listino viene usato solo per:
- ✅ Mostrare prezzo all'utente (frontend)
- ✅ Calcolare prezzo per sub-users (se applicabile)
- ❌ **NON** per calcolare il costo scalato dal wallet

---

## ⚠️ GAP IDENTIFICATO

### Problema Potenziale:

Se un Reseller crea una spedizione per **se stesso** (non per sub-user):
- Il sistema mostra prezzo con margine (€12.00)
- Ma dal wallet viene scalato solo costo corriere (€10.50)
- **Il margine non viene applicato al wallet del Reseller**

### Domanda Business:

**È corretto che il Reseller paghi solo il costo corriere quando usa il suo listino?**

**Possibili interpretazioni:**

1. **Interpretazione A (Attuale)**: 
   - Reseller paga costo corriere
   - Margine è solo per calcolare prezzo vendita a sub-users
   - ✅ **Corretto se Reseller usa listino solo per vendere a sub-users**

2. **Interpretazione B (Alternativa)**:
   - Reseller dovrebbe pagare prezzo con margine anche per se stesso
   - Margine va al sistema/platform
   - ❌ **NON implementato attualmente**

---

## 🎯 Raccomandazione

### Se Interpretazione A (Attuale):
✅ **Nessuna modifica necessaria**
- Il comportamento è corretto
- Il listino serve solo per calcolare prezzo vendita
- Il Reseller paga costo reale corriere

### Se Interpretazione B (Alternativa):
⚠️ **Modifica necessaria**
- Il costo finale dovrebbe essere: `courierCost + margin + platformFee`
- Il margine dovrebbe essere scalato dal wallet
- Serve modificare `create-shipment-core.ts` per usare il listino nel calcolo

---

## 📝 File da Modificare (se Interpretazione B)

1. **`lib/shipments/create-shipment-core.ts`**:
   - Recuperare listino fornitore del Reseller
   - Calcolare prezzo con margine usando `calculatePriceWithRules()`
   - Usare `finalPrice` (con margine) invece di `courierResponse.cost`

2. **`app/api/shipments/create/route.ts`**:
   - Stessa logica: usare prezzo con margine se listino presente

---

## ❓ Domanda per Business

**Quando un Reseller crea una spedizione usando il suo listino fornitore:**

1. **Paga solo il costo corriere** (attuale)?
2. **Paga il prezzo con margine** (da implementare)?

**Risposta attesa per procedere con eventuali modifiche.**

---

**Ultimo Aggiornamento**: 2026-01-XX  
**Stato**: ⚠️ **COMPORTAMENTO ATTUALE DOCUMENTATO - RICHIESTA CONFERMA BUSINESS**


