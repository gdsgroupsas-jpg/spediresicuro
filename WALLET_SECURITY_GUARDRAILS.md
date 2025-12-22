# 🔒 WALLET SECURITY GUARDRAILS

**Data:** 22 Dicembre 2025  
**Stato:** ✅ ATTIVO - NON BYPASSABILE  
**Migration:** `040_wallet_atomic_operations.sql`

---

## 🚨 REGOLE CRITICHE - NON NEGOZIABILI

### REGOLA #1: MAI UPDATE DIRETTO

```typescript
// ❌ ASSOLUTAMENTE VIETATO
await supabase
  .from('users')
  .update({ wallet_balance: newBalance })
  .eq('id', userId)

// ❌ VIETATO ANCHE QUESTO
await supabase
  .from('users')
  .update({ wallet_balance: user.wallet_balance - amount })
  .eq('id', userId)
```

**Perché:** Race condition, saldo negativo, perdita soldi.

---

### REGOLA #2: USA SOLO FUNZIONI RPC

```typescript
// ✅ CORRETTO: Decremento wallet
const { error } = await supabaseAdmin.rpc('decrement_wallet_balance', {
  p_user_id: userId,
  p_amount: amount
})

if (error) {
  // FAIL-FAST: Non procedere
  throw new Error(`Wallet debit failed: ${error.message}`)
}

// ✅ CORRETTO: Incremento wallet  
const { error } = await supabaseAdmin.rpc('increment_wallet_balance', {
  p_user_id: userId,
  p_amount: amount
})
```

---

### REGOLA #3: NO FALLBACK MANUALI

```typescript
// ❌ VIETATO
if (error) {
  // "Aggiusto manualmente"
  await supabase.from('users').update({ wallet_balance: ... })
}

// ✅ CORRETTO
if (error) {
  // Fail-fast e logga
  console.error('Wallet operation failed:', error)
  throw new Error('Cannot proceed without wallet update')
}
```

**Perché:** Fallback bypassa sicurezza atomica, rischio doppio accredito.

---

### REGOLA #4: VERIFICA SEMPRE IL RISULTATO

```typescript
// ✅ Pattern corretto
const { error } = await supabaseAdmin.rpc('decrement_wallet_balance', {
  p_user_id: userId,
  p_amount: cost
})

if (error) {
  // Logga dettagli per debug
  console.error('[WALLET ERROR]', {
    userId,
    amount: cost,
    errorMessage: error.message,
    errorCode: error.code
  })
  
  // Blocca operazione
  return { success: false, error: 'Insufficient balance or wallet error' }
}

// Procedi SOLO se successo
await createShipment(...)
```

---

## 🛡️ PROTEZIONI DATABASE

### Constraint Attivi

1. **`users_wallet_balance_non_negative`**
   - Impedisce saldo negativo a livello DB
   - CHECK constraint: `wallet_balance >= 0`

2. **`users_wallet_balance_max_limit`**
   - Limite massimo: €100,000
   - CHECK constraint: `wallet_balance <= 100000.00`

### Funzioni Atomiche

1. **`decrement_wallet_balance(user_id, amount)`**
   - Lock pessimistico: `SELECT ... FOR UPDATE NOWAIT`
   - Check saldo DENTRO transazione
   - EXCEPTION se saldo insufficiente
   - NO side effects esterni

2. **`increment_wallet_balance(user_id, amount)`**
   - Lock pessimistico
   - Check limite massimo DENTRO transazione
   - EXCEPTION se supera €100,000

---

## 🧪 TEST DI SICUREZZA

### Test Concorrenza

```bash
# Esegui script di test
node scripts/test-wallet-concurrency.js

# Output atteso:
# ✅ Request 1: SUCCESS (saldo €10 → €0)
# ❌ Request 2: FAILED (Insufficient balance)
# ✅ Final balance: €0 (corretto)
```

### Test Saldo Insufficiente

```sql
-- Setup
UPDATE users SET wallet_balance = 5.00 WHERE id = 'test-user-id';

-- Test: tenta addebito €10
SELECT decrement_wallet_balance('test-user-id', 10.00);

-- Risultato atteso: EXCEPTION
-- ERROR: Insufficient balance. Available: €5.00, Required: €10.00
```

### Test Race Condition

```javascript
// Simula 2 richieste simultanee
const results = await Promise.allSettled([
  supabaseAdmin.rpc('decrement_wallet_balance', { 
    p_user_id: userId, 
    p_amount: 10.00 
  }),
  supabaseAdmin.rpc('decrement_wallet_balance', { 
    p_user_id: userId, 
    p_amount: 10.00 
  })
])

// Risultato atteso:
// results[0].status === 'fulfilled' (una delle due passa)
// results[1].status === 'rejected' (l'altra fallisce)
// Saldo finale: €0 (non -€10)
```

---

## 📊 MONITORING & AUDIT

### Verifica Integrità Wallet

```sql
-- Verifica consistenza balance vs transactions
SELECT * FROM verify_wallet_integrity('user-id');

-- Output:
-- user_id | current_balance | calculated_balance | discrepancy | is_consistent
-- ------- | --------------- | ------------------ | ----------- | -------------
-- xxx     | 100.00          | 100.00             | 0.00        | true
```

### Log Pattern da Monitorare

```javascript
// ❌ Pattern pericoloso (da alertare)
console.log('Using fallback wallet update')  // RED FLAG
console.log('Manual balance adjustment')     // RED FLAG

// ✅ Pattern sicuro
console.log('✅ [WALLET] Atomic debit successful')
console.log('✅ [WALLET] Atomic credit successful')
```

---

## 🚫 COSA NON FARE MAI

### ❌ Bypass #1: Trigger Disabilitato

```sql
-- MAI fare questo
ALTER TABLE wallet_transactions DISABLE TRIGGER trigger_update_wallet_balance;
```

### ❌ Bypass #2: Service Role su Users

```typescript
// MAI fare UPDATE diretto anche con service_role
await supabaseAdmin  // service_role bypassa RLS ma NON constraint
  .from('users')
  .update({ wallet_balance: ... })  // ← VIETATO
```

### ❌ Bypass #3: SQL Raw Query

```typescript
// MAI fare query raw per UPDATE wallet
await supabaseAdmin.rpc('execute_sql', {
  query: 'UPDATE users SET wallet_balance = ...'  // ← VIETATO
})
```

---

## 📞 IN CASO DI EMERGENZA

### Scenario: RPC Non Funziona in Produzione

**NON bypassare la sicurezza.**

1. **Diagnostica:**
   ```bash
   # Verifica funzione esiste
   psql -c "\df decrement_wallet_balance"
   
   # Verifica permessi
   psql -c "SELECT has_function_privilege('decrement_wallet_balance', 'execute')"
   ```

2. **Fix Temporaneo SICURO:**
   ```typescript
   // Se RPC davvero non disponibile:
   // 1. Blocca TUTTE le operazioni wallet
   // 2. Metti sistema in maintenance mode
   // 3. NON procedere con fallback
   throw new Error('Wallet system temporarily unavailable')
   ```

3. **Rollback Plan:**
   - Deploy hotfix con funzione RPC
   - Verifica con smoke test
   - Riattiva sistema

---

## ✅ CHECKLIST SVILUPPATORE

Prima di merge/deploy:

- [ ] Zero UPDATE diretti su `users.wallet_balance`
- [ ] Tutti gli addebiti usano `decrement_wallet_balance()`
- [ ] Tutti i crediti usano `increment_wallet_balance()` o `add_wallet_credit()`
- [ ] Nessun fallback manuale
- [ ] Test concorrenza eseguito e passato
- [ ] Linter warnings verificati

---

**🔐 SECURITY MANTRA:**

> "If it touches wallet_balance, it must go through the RPC.  
> If the RPC fails, the operation must fail.  
> No exceptions. No fallbacks. No shortcuts."

---

**Ultimo aggiornamento:** 22 Dicembre 2025  
**Responsabile:** Team Backend  
**Review:** Obbligatoria in ogni PR che tocca wallet

