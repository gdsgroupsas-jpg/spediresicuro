# 🤖 PROMPT PER VALIDAZIONE AI INDIPENDENTE - WALLET AUDIT

**Obiettivo:** Validare i fix P0 applicati al sistema Wallet di SpedireSicuro.it

**Data:** 2025-12-23  
**Auditor Originale:** Cursor AI (Senior Engineer OSTILE)

---

## ISTRUZIONI PER L'AI VALIDATRICE

Sei un Senior Security Engineer indipendente. Il tuo compito è:

1. **Verificare** che i fix applicati risolvano effettivamente le vulnerabilità
2. **Cercare** vulnerabilità residue non coperte dai fix
3. **Validare** la correttezza del codice SQL e TypeScript
4. **Identificare** eventuali nuovi rischi introdotti dai fix

**NON fidarti** dell'audit originale. Esegui la tua analisi indipendente.

---

## CONTESTO: VULNERABILITÀ ORIGINALI (P0)

### Vulnerabilità 1: `deduct_wallet_credit()` NON atomica

**Problema:**
- SELECT senza FOR UPDATE lock → race condition
- Si affidava a trigger `trigger_update_wallet_balance` (rimosso in migration 041)
- Dopo rimozione trigger, `wallet_balance` non veniva più aggiornato

**Impatto:** Saldo negativo possibile, inconsistenza dati

### Vulnerabilità 2: Campo `status` inesistente

**Problema:**
- Insert su `wallet_transactions` includeva `status: 'COMPLETED'`
- La colonna `status` non esiste nello schema

**Impatto:** Errore runtime o campo ignorato silenziosamente

### Vulnerabilità 3: TOCTOU in Idempotency Lock

**Problema:**
- TTL di 10 minuti troppo breve
- Se lock scade prima del retry, possibile doppio debit

**Impatto:** Doppio addebito in caso di crash + retry tardivo

---

## FIX APPLICATI

### Fix 1: Rimozione campo `status`

**File:** `app/api/shipments/create/route.ts`

```typescript
// PRIMA (vulnerabile)
await supabaseAdmin
  .from('wallet_transactions')
  .insert({
    user_id: targetId,
    amount: -finalCost,
    type: 'SHIPMENT_CHARGE',
    description: `Spedizione ${courierResponse.trackingNumber}`,
    status: 'COMPLETED'  // ❌ CAMPO INESISTENTE
  })

// DOPO (fix applicato)
// ⚠️ FIX P0: Rimosso campo 'status' inesistente (audit 2025-12-22)
await supabaseAdmin
  .from('wallet_transactions')
  .insert({
    user_id: targetId,
    amount: -finalCost,
    type: 'SHIPMENT_CHARGE',
    description: `Spedizione ${courierResponse.trackingNumber}`
    // ✅ NO status
  })
```

### Fix 2: Migration 045 - `deduct_wallet_credit` atomica

**File:** `supabase/migrations/045_fix_deduct_wallet_credit_atomic.sql`

```sql
CREATE OR REPLACE FUNCTION deduct_wallet_credit(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- VALIDAZIONE
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive. Received: %', p_amount;
  END IF;
  
  IF p_amount > 100000.00 THEN
    RAISE EXCEPTION 'Amount exceeds maximum allowed (€100,000). Received: €%', p_amount;
  END IF;

  -- ✅ USA FUNZIONE ATOMICA (con FOR UPDATE NOWAIT)
  PERFORM decrement_wallet_balance(p_user_id, p_amount);
  
  -- CREA RECORD TRANSAZIONE
  INSERT INTO wallet_transactions (
    user_id, amount, type, description, reference_id, reference_type
  ) VALUES (
    p_user_id, -p_amount, p_type, 
    COALESCE(p_description, 'Deduzione credito'),
    p_reference_id, p_reference_type
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Security: search_path impostato
ALTER FUNCTION deduct_wallet_credit(...) SET search_path = public, pg_temp;
```

### Fix 3: Aumento TTL Idempotency Lock

**File:** `app/api/shipments/create/route.ts`

```typescript
// PRIMA (vulnerabile)
const { data: lockResult } = await supabaseAdmin.rpc('acquire_idempotency_lock', {
  p_idempotency_key: idempotencyKey,
  p_user_id: targetId,
  p_ttl_minutes: 10  // ❌ Troppo breve
})

// DOPO (fix applicato)
// ⚠️ FIX P0: TTL aumentato da 10 a 30 minuti per prevenire TOCTOU
const { data: lockResult } = await supabaseAdmin.rpc('acquire_idempotency_lock', {
  p_idempotency_key: idempotencyKey,
  p_user_id: targetId,
  p_ttl_minutes: 30  // ✅ Più sicuro
})
```

---

## FUNZIONI ATOMICHE DI RIFERIMENTO

### `decrement_wallet_balance()` (Migration 040)

```sql
CREATE OR REPLACE FUNCTION decrement_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL(10,2)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
  v_user_email TEXT;
BEGIN
  -- VALIDAZIONI
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive. Received: %', p_amount;
  END IF;
  
  IF p_amount > 100000.00 THEN
    RAISE EXCEPTION 'Amount exceeds maximum allowed (€100,000). Received: €%', p_amount;
  END IF;

  -- ✅ LOCK PESSIMISTICO: FOR UPDATE NOWAIT
  SELECT wallet_balance, email INTO v_current_balance, v_user_email
  FROM users
  WHERE id = p_user_id
  FOR UPDATE NOWAIT;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
  
  -- ✅ CHECK ATOMICO DENTRO LOCK
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance for user % (%). Available: €%, Required: €%', 
      v_user_email, p_user_id, v_current_balance, p_amount;
  END IF;
  
  -- ✅ UPDATE ATOMICO
  UPDATE users
  SET 
    wallet_balance = wallet_balance - p_amount,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update wallet balance for user %', p_user_id;
  END IF;
  
  RETURN TRUE;
  
EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Wallet locked by concurrent operation. User: %. Retry recommended.', p_user_id;
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## DOMANDE PER LA VALIDAZIONE

### 1. Fix 1 (Campo status)
- [ ] Il fix risolve completamente il problema?
- [ ] Ci sono altri insert su `wallet_transactions` con campo `status`?
- [ ] Serve aggiungere la colonna `status` allo schema invece di rimuoverla?

### 2. Fix 2 (deduct_wallet_credit atomica)
- [ ] La nuova implementazione è corretta?
- [ ] `PERFORM decrement_wallet_balance()` propaga correttamente le eccezioni?
- [ ] C'è rischio di inconsistenza se INSERT wallet_transactions fallisce DOPO il decrement?
- [ ] Il `search_path` è configurato correttamente?

### 3. Fix 3 (TTL Lock)
- [ ] 30 minuti sono sufficienti?
- [ ] C'è ancora TOCTOU tra lock e debit?
- [ ] Cosa succede se il debit fallisce dopo aver acquisito il lock?

### 4. Vulnerabilità Residue
- [ ] Ci sono altri punti del codice con race condition?
- [ ] `add_wallet_credit()` e `increment_wallet_balance()` sono sicure?
- [ ] RLS su `wallet_transactions` è sufficientemente restrittivo?
- [ ] Ci sono bypass possibili?

---

## FILE DA ANALIZZARE

1. `app/api/shipments/create/route.ts` - Flusso principale creazione spedizione
2. `supabase/migrations/045_fix_deduct_wallet_credit_atomic.sql` - Nuovo fix
3. `supabase/migrations/040_wallet_atomic_operations.sql` - Funzioni atomiche
4. `supabase/migrations/041_remove_wallet_balance_trigger.sql` - Rimozione trigger
5. `supabase/migrations/044_idempotency_locks.sql` - Sistema idempotency
6. `actions/super-admin.ts` - `manageWallet()` che usa `deduct_wallet_credit`
7. `actions/wallet.ts` - Server Actions wallet
8. `lib/wallet/retry.ts` - Smart retry per lock contention

---

## OUTPUT RICHIESTO

Genera un report strutturato con:

1. **VALIDAZIONE FIX:** Per ogni fix, conferma se risolve il problema (✅/❌)
2. **VULNERABILITÀ RESIDUE:** Nuove vulnerabilità trovate
3. **RISCHI INTRODOTTI:** Problemi causati dai fix stessi
4. **RACCOMANDAZIONI:** Ulteriori miglioramenti suggeriti
5. **VERDICT FINALE:** ✅ SAFE TO DEPLOY / ❌ DO NOT DEPLOY

---

**IMPORTANTE:** Non dare per scontato che i fix siano corretti. Analizza criticamente ogni modifica.

