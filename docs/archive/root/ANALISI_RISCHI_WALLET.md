# 🔒 ANALISI RISCHI SISTEMA WALLET - SpedireSicuro.it

**Data Analisi:** 2025-01  
**Scope:** Flusso `top_up_requests` + Punti di accredito credito

---

## 📋 1. ANALISI FLUSSO `top_up_requests`

### 1.1 Flusso Attuale

**File:** `app/actions/wallet.ts` - `uploadBankTransferReceipt()`

1. **Upload File** (linea 62-67)
   - File caricato in storage bucket `receipts`
   - Path: `${user.id}/${Date.now()}_${file.name}`
   - ❌ **Nessun controllo dimensione file**
   - ❌ **Nessun controllo tipo file** (dovrebbe essere PDF/immagine)

2. **Creazione Record** (linea 75-85)
   - Inserisce in `top_up_requests` con:
     - `user_id`: utente corrente
     - `amount`: importo dichiarato dall'utente (senza validazione)
     - `file_url`: URL pubblico file
     - `status`: `'pending'`
     - `ai_confidence`: `0` (mai aggiornato)
     - `extracted_data`: `NULL` (mai popolato)

3. **Analisi AI** (linea 89-90)
   - ❌ **NON IMPLEMENTATA** - Commento TODO
   - Campo `ai_confidence` resta 0
   - Campo `extracted_data` resta NULL

4. **Approvazione**
   - ❌ **NON TROVATA** - Nessuna funzione/server action per approvare `top_up_requests`
   - ❌ **Nessun collegamento** tra approvazione e accredito wallet

### 1.2 Limiti Importo

| Controllo              | Stato           | Dettagli                                                         |
| ---------------------- | --------------- | ---------------------------------------------------------------- |
| **Minimo importo**     | ❌ **ASSENTE**  | Nessun CHECK su `amount > 0` in migration                        |
| **Massimo importo**    | ❌ **ASSENTE**  | Nessun limite massimo (es. €10.000)                              |
| **Validazione client** | ⚠️ **PARZIALE** | `transferAmount <= 0` in UI ma solo warning                      |
| **Validazione server** | ❌ **ASSENTE**  | `uploadBankTransferReceipt()` accetta qualsiasi `declaredAmount` |

**Rischio:** Utente può dichiarare importo arbitrario (es. €999.999) senza controllo.

### 1.3 Controlli Duplicati

| Controllo                          | Stato          | Dettagli                                                    |
| ---------------------------------- | -------------- | ----------------------------------------------------------- |
| **Stesso file_url**                | ❌ **ASSENTE** | Nessun UNIQUE constraint o check                            |
| **Stesso amount + user_id + data** | ❌ **ASSENTE** | Nessun controllo duplicati temporali                        |
| **Stesso CRO/TRN**                 | ❌ **ASSENTE** | Campo `extracted_data` mai popolato, impossibile verificare |
| **Rate limiting**                  | ❌ **ASSENTE** | Utente può creare infinite richieste                        |

**Rischio:** Utente può:

- Caricare stesso file più volte → multiple richieste
- Dichiarare stesso importo più volte → potenziale doppio accredito
- Spam richieste → saturazione sistema

### 1.4 Audit Log

| Evento                  | Stato              | Dettagli                                                   |
| ----------------------- | ------------------ | ---------------------------------------------------------- |
| **Creazione richiesta** | ❌ **ASSENTE**     | Nessun log in `audit_logs` o `diagnostics_events`          |
| **Approvazione**        | ❌ **NON TROVATA** | Funzione approvazione non esiste                           |
| **Rifiuto**             | ❌ **NON TROVATA** | Funzione rifiuto non esiste                                |
| **Accredito wallet**    | ⚠️ **PARZIALE**    | Solo traccia in `wallet_transactions` (campo `created_by`) |

**Rischio:** Impossibile tracciare:

- Chi ha approvato/rifiutato
- Quando è stato approvato
- Motivo approvazione/rifiuto
- Importo originale vs importo accreditato

---

## 🚨 2. PUNTI DI ACCREDITO CREDITO (Senza Controlli)

### 2.1 Funzione SQL `add_wallet_credit()`

**File:** `supabase/migrations/019_reseller_system_and_wallet.sql` (linea 314-348)

**Controlli presenti:**

- ✅ Verifica `p_amount > 0` (linea 325-327)

**Controlli mancanti:**

- ❌ **Nessun limite massimo importo**
- ❌ **Nessun controllo duplicati** (stesso user_id + amount + timestamp)
- ❌ **Nessun rate limiting** (quante ricariche per utente/giorno)
- ❌ **Nessun audit log** esplicito (solo traccia in `wallet_transactions`)

**Chiamate:**

1. `actions/super-admin.ts` - `manageWallet()` (linea 193)
2. `actions/admin-reseller.ts` - `manageSubUserWallet()` (linea 438)
3. `actions/wallet.ts` - `rechargeMyWallet()` (linea 103)

**Rischio:** Superadmin/Reseller può accreditare importi illimitati senza tracciamento audit completo.

---

### 2.2 Server Action `manageWallet()` (Superadmin)

**File:** `actions/super-admin.ts` (linea 134-289)

**Controlli presenti:**

- ✅ Verifica superadmin (linea 147-153)
- ✅ Verifica `amount !== 0` (linea 156-161)
- ✅ Verifica balance se `amount < 0` (linea 178-183)
- ✅ Verifica utente esiste (linea 164-175)

**Controlli mancanti:**

- ❌ **Nessun limite massimo importo** (può accreditare €1.000.000)
- ❌ **Nessun controllo duplicati** (stessa operazione ripetuta)
- ❌ **Nessun audit log esplicito** (solo `wallet_transactions.created_by`)
- ❌ **Nessun rate limiting** (quante operazioni/giorno)

**Fallback pericoloso** (linea 200-224):

- Se `add_wallet_credit()` fallisce, inserisce direttamente in `wallet_transactions`
- Poi aggiorna `wallet_balance` manualmente (linea 141-147) → **BYPASS TRIGGER**
- ⚠️ **RISCHIO:** Doppio accredito se trigger si attiva comunque

**Rischio:** Superadmin può:

- Accreditare importi arbitrari senza limiti
- Bypassare controlli via fallback manuale
- Creare transazioni duplicate

---

### 2.3 Server Action `manageSubUserWallet()` (Reseller)

**File:** `actions/admin-reseller.ts` (linea 374-518)

**Controlli presenti:**

- ✅ Verifica reseller (linea 396-402)
- ✅ Verifica `amount > 0` (linea 405-410) - solo ricariche
- ✅ Verifica sub-user appartiene a reseller (linea 427-432)

**Controlli mancanti:**

- ❌ **Nessun limite massimo importo** per sub-user
- ❌ **Nessun limite totale giornaliero** per reseller
- ❌ **Nessun controllo duplicati**
- ❌ **Nessun audit log esplicito**

**Fallback pericoloso** (linea 445-486):

- Se `add_wallet_credit()` fallisce, aggiorna `wallet_balance` direttamente (linea 472-478)
- ⚠️ **RISCHIO:** Doppio accredito se trigger si attiva

**Rischio:** Reseller può:

- Accreditare importi illimitati ai sub-users
- Bypassare controlli via fallback
- Creare transazioni duplicate

---

### 2.4 Server Action `rechargeMyWallet()` (Admin Self-Recharge)

**File:** `actions/wallet.ts` (linea 60-221)

**Controlli presenti:**

- ✅ Verifica autenticazione (linea 72-79)
- ✅ Verifica `amount > 0` (linea 82-87)
- ✅ Verifica admin (linea 90-98)

**Controlli mancanti:**

- ❌ **Nessun limite massimo importo**
- ❌ **Nessun limite giornaliero** per self-recharge
- ❌ **Nessun controllo duplicati**
- ❌ **Nessun audit log esplicito**

**Fallback pericoloso** (linea 110-168):

- Se `add_wallet_credit()` fallisce, aggiorna `wallet_balance` direttamente (linea 141-147)
- ⚠️ **RISCHIO:** Doppio accredito

**Rischio:** Admin può auto-accreditarsi importi illimitati.

---

### 2.5 Trigger `update_wallet_balance()`

**File:** `supabase/migrations/019_reseller_system_and_wallet.sql` (linea 115-136)

**Funzionamento:**

- Si attiva DOPO INSERT su `wallet_transactions`
- Aggiorna `wallet_balance = GREATEST(0, wallet_balance + NEW.amount)`

**Problema:**

- ⚠️ Se fallback manuale aggiorna `wallet_balance` PRIMA del trigger, il trigger può aggiornare di nuovo → **doppio accredito**

**Rischio:** Race condition tra fallback manuale e trigger.

---

### 2.6 Aggiornamento Diretto `wallet_balance` (BYPASS)

**File coinvolti:**

1. `actions/wallet.ts` (linea 141-147) - Fallback `rechargeMyWallet()`
2. `actions/admin-reseller.ts` (linea 472-478) - Fallback `manageSubUserWallet()`
3. `actions/super-admin.ts` (linea 141-147) - Fallback `manageWallet()` (non letto ma presumibile)

**Pattern pericoloso:**

```typescript
// 1. Inserisce wallet_transactions
INSERT INTO wallet_transactions (user_id, amount, ...)

// 2. Aggiorna wallet_balance MANUALMENTE
UPDATE users SET wallet_balance = wallet_balance + amount WHERE id = user_id

// 3. Trigger si attiva DOPO INSERT → AGGIORNA DI NUOVO
// RISULTATO: Doppio accredito!
```

**Rischio:** Doppio accredito se trigger si attiva dopo fallback manuale.

---

## 📊 3. RIEPILOGO RISCHI

### 3.1 Rischi Critici (HIGH)

| #   | Rischio                                           | File                                                             | Severità     |
| --- | ------------------------------------------------- | ---------------------------------------------------------------- | ------------ |
| 1   | **Doppio accredito** (fallback + trigger)         | `actions/wallet.ts:141-147`, `actions/admin-reseller.ts:472-478` | **CRITICAL** |
| 2   | **Nessun limite importo massimo**                 | Tutte le funzioni `add_wallet_credit`                            | **HIGH**     |
| 3   | **Nessun controllo duplicati**                    | Tutte le funzioni accredito                                      | **HIGH**     |
| 4   | **Approvazione top_up_requests non implementata** | `app/actions/wallet.ts`                                          | **HIGH**     |

### 3.2 Rischi Medi (MED)

| #   | Rischio                                        | File                              | Severità |
| --- | ---------------------------------------------- | --------------------------------- | -------- |
| 5   | **Nessun audit log approvazioni**              | Nessun file (funzione non esiste) | **MED**  |
| 6   | **Nessun limite importo top_up_requests**      | `app/actions/wallet.ts:57`        | **MED**  |
| 7   | **Nessun controllo duplicati top_up_requests** | `app/actions/wallet.ts:75-85`     | **MED**  |
| 8   | **Nessun rate limiting**                       | Tutte le funzioni                 | **MED**  |

### 3.3 Rischi Bassi (LOW)

| #   | Rischio                              | File                       | Severità |
| --- | ------------------------------------ | -------------------------- | -------- |
| 9   | **Nessun controllo tipo file**       | `app/actions/wallet.ts:56` | **LOW**  |
| 10  | **Nessun controllo dimensione file** | `app/actions/wallet.ts:56` | **LOW**  |

---

## 🛠️ 4. SUGGERIMENTI MINIMI (No Refactor)

### 4.1 Fix Critici (Priorità 1)

#### Fix 1: Eliminare Fallback Manuale `wallet_balance`

**File:** `actions/wallet.ts`, `actions/admin-reseller.ts`, `actions/super-admin.ts`

**Azione:**

- Rimuovere UPDATE manuale `wallet_balance` nei fallback
- Lasciare solo INSERT in `wallet_transactions`
- Il trigger aggiornerà automaticamente

**Esempio:**

```typescript
// PRIMA (PERICOLOSO):
if (txError) {
  // Insert wallet_transactions
  // UPDATE wallet_balance MANUALMENTE ← RIMUOVERE
}

// DOPO (SICURO):
if (txError) {
  // Insert wallet_transactions
  // Trigger aggiornerà wallet_balance automaticamente
  // Se insert fallisce, ritorna errore (non fallback)
}
```

#### Fix 2: Aggiungere Limite Massimo Importo

**File:** `supabase/migrations/019_reseller_system_and_wallet.sql` - `add_wallet_credit()`

**Azione:**

```sql
-- Aggiungere all'inizio funzione:
IF p_amount > 10000 THEN
  RAISE EXCEPTION 'Importo massimo consentito: €10.000';
END IF;
```

**File:** `app/actions/wallet.ts` - `uploadBankTransferReceipt()`

**Azione:**

```typescript
// Dopo linea 57:
if (declaredAmount <= 0 || declaredAmount > 10000) {
  return { success: false, error: 'Importo deve essere tra €0.01 e €10.000' };
}
```

#### Fix 3: Aggiungere Controllo Duplicati `top_up_requests`

**File:** `app/actions/wallet.ts` - `uploadBankTransferReceipt()`

**Azione:**

```typescript
// Dopo linea 73, prima di insert:
// Verifica duplicati ultime 24h
const { data: recent } = await supabase
  .from('top_up_requests')
  .select('id')
  .eq('user_id', user.id)
  .eq('amount', declaredAmount)
  .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  .limit(1);

if (recent && recent.length > 0) {
  return { success: false, error: 'Richiesta duplicata. Attendi approvazione precedente.' };
}
```

### 4.2 Fix Medi (Priorità 2)

#### Fix 4: Implementare Funzione Approvazione `top_up_requests`

**File:** `app/actions/wallet.ts` (nuova funzione)

**Azione:**

```typescript
export async function approveTopUpRequest(
  requestId: string,
  approvedAmount?: number
): Promise<{ success: boolean; error?: string }> {
  // 1. Verifica admin
  // 2. Recupera top_up_requests
  // 3. Verifica status = 'pending'
  // 4. Usa add_wallet_credit() per accreditare
  // 5. Aggiorna status = 'approved'
  // 6. Log in audit_logs
}
```

#### Fix 5: Aggiungere Audit Log

**File:** Tutte le funzioni accredito

**Azione:**

```typescript
// Dopo accredito riuscito:
await supabaseAdmin.from('audit_logs').insert({
  action: 'wallet_credit_added',
  user_id: userId,
  target_user_id: targetUserId,
  amount: amount,
  metadata: { reason, transactionId },
});
```

### 4.3 Fix Bassi (Priorità 3)

#### Fix 6: Validazione File Upload

**File:** `app/actions/wallet.ts` - `uploadBankTransferReceipt()`

**Azione:**

```typescript
// Dopo linea 56:
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

if (file.size > MAX_FILE_SIZE) {
  return { success: false, error: 'File troppo grande (max 10MB)' };
}
if (!ALLOWED_TYPES.includes(file.type)) {
  return { success: false, error: 'Formato non supportato (solo JPG, PNG, PDF)' };
}
```

---

## 📝 5. FILE COINVOLTI

### File da Modificare (Priorità 1)

1. `actions/wallet.ts` - Rimuovere fallback manuale, aggiungere limiti
2. `actions/admin-reseller.ts` - Rimuovere fallback manuale
3. `actions/super-admin.ts` - Rimuovere fallback manuale (verificare)
4. `supabase/migrations/019_reseller_system_and_wallet.sql` - Aggiungere limite max in `add_wallet_credit()`

### File da Creare (Priorità 2)

5. `app/actions/wallet.ts` - Funzione `approveTopUpRequest()`
6. `app/actions/wallet.ts` - Funzione `rejectTopUpRequest()`

### File da Verificare

7. `supabase/migrations/027_wallet_topups.sql` - Aggiungere constraint UNIQUE su `(user_id, amount, created_at::date)` per prevenire duplicati giornalieri

---

## ✅ CHECKLIST IMPLEMENTAZIONE

- [ ] Fix 1: Rimuovere UPDATE manuale `wallet_balance` in tutti i fallback
- [ ] Fix 2: Aggiungere limite max €10.000 in `add_wallet_credit()` SQL
- [ ] Fix 2: Aggiungere validazione importo in `uploadBankTransferReceipt()`
- [ ] Fix 3: Aggiungere controllo duplicati `top_up_requests`
- [ ] Fix 4: Implementare `approveTopUpRequest()`
- [ ] Fix 5: Aggiungere audit log in tutte le funzioni accredito
- [ ] Fix 6: Validazione file upload

---

**Fine Report**
