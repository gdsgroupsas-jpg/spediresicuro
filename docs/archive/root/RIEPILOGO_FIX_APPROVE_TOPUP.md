# 🔧 RIEPILOGO COMPLETO: Fix Approvazione Top-Up Requests

## 📋 PROBLEMA ORIGINALE

### Sintomi in Produzione

Quando un admin clicca **"Approva"** su una richiesta di ricarica wallet (`top_up_requests`) su `/dashboard/admin/bonifici`:

1. ❌ **Errore visualizzato**: `"Impossibile approvare: UPDATE fallito (permessi/policy/RLS/trigger)."`
2. ❌ **Stato nel DB**: La richiesta resta `status = 'pending'` (non viene aggiornata)
3. ❌ **Campi vuoti**: `approved_by`, `approved_at`, `approved_amount` restano `NULL`
4. ❌ **Nessuna transazione**: Non viene creata alcuna `wallet_transaction`
5. ❌ **Wallet non incrementato**: Il saldo wallet dell'utente non aumenta

### Log Client-Side (Console Browser)

```
✅ Approving request: f9f41d2c-f4d9-494b-a2a1-3ea220685551 with amount: undefined
✅ Approve result:
{
  success: false,
  error: "Impossibile approvare: UPDATE fallito (permessi/policy/RLS/trigger)."
}
```

### Root Cause Identificato

L'UPDATE atomico su `top_up_requests` fallisce silenziosamente:

- **RLS (Row Level Security)** è abilitato su `top_up_requests`
- **Manca policy UPDATE**: La tabella ha solo policy per SELECT e INSERT
- **Service role key** dovrebbe bypassare RLS, ma potrebbe non funzionare correttamente
- **Messaggio fuorviante**: Il codice diceva "già processata" anche quando era ancora pending

---

## ✅ SOLUZIONI IMPLEMENTATE

### 1. Fix Diagnostica Errori (Commit `774e5c1`)

**File**: `app/actions/wallet.ts` - Funzione `approveTopUpRequest()`

**Problema**: Il codice non distingueva correttamente tra:

- Richiesta non trovata
- Richiesta già processata
- UPDATE fallito per altri motivi (RLS/permessi/trigger)

**Fix**: Logica di diagnostica migliorata che distingue i 3 casi:

```typescript
// Caso 1: Richiesta non esiste
if (!existingRequest) {
  return { error: 'Richiesta non trovata.' };
}

// Caso 2: Richiesta già processata
if (existingRequest.status !== 'pending' && existingRequest.status !== 'manual_review') {
  return { error: 'Richiesta già processata.' };
}

// Caso 3: UPDATE fallito ma status ancora pending
return { error: 'Impossibile approvare: UPDATE fallito (permessi/policy/RLS/trigger).' };
```

**Log diagnostici aggiunti**:

- `[TOPUP_APPROVE] UPDATE failed` - quando UPDATE fallisce
- `[TOPUP_APPROVE] UPDATE failed but status still pending/manual_review` - caso critico
- `[TOPUP_APPROVE] UPDATE successful` - quando UPDATE riesce
- `[TOPUP_APPROVE] Wallet credit successful` - quando RPC add_wallet_credit riesce
- `[TOPUP_APPROVE] Rollback failed - CRITICAL` - se rollback fallisce

---

### 2. Migration 029: Policy UPDATE per Admin (Commit `ce91f71` → `08d9597`)

**File**: `supabase/migrations/029_add_topup_update_policy.sql`

**Problema**: Manca policy UPDATE su `top_up_requests`. La tabella ha solo:

- ✅ Policy SELECT: `"Users can view own top-up requests"`
- ✅ Policy INSERT: `"Users can create top-up requests"`
- ❌ Policy UPDATE: **MANCANTE**

**Fix**: Creata policy UPDATE che permette aggiornamenti a:

1. **Service role key** (`auth.uid() IS NULL`) - bypassa RLS
2. **Utenti admin autenticati** (account_type IN ('admin', 'superadmin') OR role = 'admin')

```sql
CREATE POLICY "Admins can update top-up requests"
ON top_up_requests FOR UPDATE
USING (
  auth.uid() IS NULL  -- Service role key
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND (
      users.account_type IN ('admin', 'superadmin')
      OR users.role = 'admin'
    )
  )
)
WITH CHECK (
  -- Stessa logica
);
```

**Nota**: La policy è idempotente (usa `DROP POLICY IF EXISTS` prima di crearla).

---

### 3. Migration 030: Funzione SQL con SECURITY DEFINER (Commit `3bb5d64`)

**File**: `supabase/migrations/030_add_topup_approve_function.sql`

**Problema**: Se la policy UPDATE non basta, serve un fallback che bypassa completamente RLS.

**Fix**: Creata funzione SQL `approve_top_up_request()` che:

- Usa `SECURITY DEFINER` per bypassare RLS completamente
- Verifica status prima di aggiornare
- Ritorna `success`, `error_message`, `updated_id`

```sql
CREATE OR REPLACE FUNCTION approve_top_up_request(
  p_request_id UUID,
  p_admin_user_id UUID,
  p_approved_amount DECIMAL(10,2)
)
RETURNS TABLE(
  success BOOLEAN,
  error_message TEXT,
  updated_id UUID
) AS $$
-- Verifica status
-- Aggiorna richiesta
-- Ritorna risultato
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Uso**: Può essere chiamata via RPC come fallback se UPDATE diretto fallisce.

---

### 4. Logging Migliorato (Commit `ce91f71` → `08d9597`)

**File**: `app/actions/wallet.ts`

**Aggiunte**:

- Log prima dell'UPDATE con tutti i parametri
- Verifica presenza `SUPABASE_SERVICE_ROLE_KEY` in env
- Log completo di tutti i campi error (`message`, `code`, `details`, `hint`)

```typescript
console.info('[TOPUP_APPROVE] Attempting UPDATE', {
  requestId,
  adminUserId: adminCheck.userId,
  amountToCredit,
  usingServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
});

// Se errore:
console.error('[TOPUP_APPROVE] UPDATE error details', {
  requestId,
  updatePayload,
  errorMessage: updateError.message,
  errorCode: updateError.code,
  errorDetails: updateError.details,
  errorHint: updateError.hint,
});
```

---

## 📁 FILE MODIFICATI

### Backend (TypeScript)

- ✅ `app/actions/wallet.ts` - Funzione `approveTopUpRequest()` migliorata

### Database (SQL Migrations)

- ✅ `supabase/migrations/029_add_topup_update_policy.sql` - Policy UPDATE
- ✅ `supabase/migrations/030_add_topup_approve_function.sql` - Funzione SQL fallback

### Frontend (già funzionante)

- ✅ `app/dashboard/admin/bonifici/page.tsx` - UI già corretta

---

## 🚀 PROCEDURA DI DEPLOY E TEST

### Step 1: Eseguire Migration su Supabase

**IMPORTANTE**: Le migration devono essere eseguite **in ordine** su Supabase:

1. **Verifica prerequisiti**:

   ```sql
   -- Verifica che la tabella esista
   SELECT EXISTS (
     SELECT 1 FROM pg_tables
     WHERE schemaname = 'public' AND tablename = 'top_up_requests'
   );
   -- Deve ritornare TRUE
   ```

2. **Esegui Migration 029**:

   ```bash
   # Via Supabase CLI
   supabase db push

   # Oppure esegui manualmente il file:
   # supabase/migrations/029_add_topup_update_policy.sql
   ```

3. **Esegui Migration 030**:

   ```bash
   # Via Supabase CLI
   supabase db push

   # Oppure esegui manualmente il file:
   # supabase/migrations/030_add_topup_approve_function.sql
   ```

4. **Verifica migration eseguite**:

   ```sql
   -- Verifica policy
   SELECT * FROM pg_policies
   WHERE tablename = 'top_up_requests' AND policyname = 'Admins can update top-up requests';
   -- Deve ritornare 1 riga

   -- Verifica funzione
   SELECT proname FROM pg_proc
   WHERE proname = 'approve_top_up_request';
   -- Deve ritornare 1 riga
   ```

### Step 2: Verificare Variabili d'Ambiente

**Vercel Dashboard** → Project → Settings → Environment Variables

Verifica che sia presente:

- ✅ `SUPABASE_SERVICE_ROLE_KEY` - **CRITICO**: Deve essere configurata
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Nota**: `SUPABASE_SERVICE_ROLE_KEY` è la chiave che bypassa RLS. Se manca o è errata, l'UPDATE fallirà.

### Step 3: Test Manuale

1. **Apri pagina admin bonifici**:

   ```
   https://www.spediresicuro.it/dashboard/admin/bonifici
   ```

2. **Crea/Seleziona richiesta pending**:
   - Deve avere `status = 'pending'` o `'manual_review'`
   - Importo valido (es. 100.00)

3. **Clicca "Approva"**:
   - Campo "Importo da Accreditare" può essere vuoto (usa importo originale)
   - Oppure compila importo diverso

4. **Verifica risultato**:
   - ✅ **Successo**: Toast verde "Richiesta approvata..."
   - ❌ **Errore**: Toast rosso con messaggio specifico

5. **Verifica nel DB** (se successo):

   ```sql
   -- Verifica richiesta aggiornata
   SELECT id, status, approved_by, approved_at, approved_amount
   FROM top_up_requests
   WHERE id = '<request_id>';
   -- status deve essere 'approved'
   -- approved_by, approved_at, approved_amount devono essere popolati

   -- Verifica transazione wallet creata
   SELECT id, user_id, amount, type, description
   FROM wallet_transactions
   WHERE description LIKE '%<request_id>%';
   -- Deve esistere 1 riga con type = 'deposit'

   -- Verifica wallet incrementato
   SELECT id, wallet_balance
   FROM users
   WHERE id = '<user_id>';
   -- wallet_balance deve essere incrementato
   ```

### Step 4: Controllare Log Server-Side

**Vercel Dashboard** → Project → Functions → Logs

Cerca log con prefisso `[TOPUP_APPROVE]`:

**Se UPDATE riesce**:

```
[TOPUP_APPROVE] Attempting UPDATE { requestId: '...', adminUserId: '...', amountToCredit: 100, usingServiceRole: true }
[TOPUP_APPROVE] UPDATE successful { requestId: '...', userId: '...', approvedAmount: 100, adminUserId: '...' }
[TOPUP_APPROVE] Wallet credit successful { requestId: '...', transactionId: '...', userId: '...', amount: 100 }
[TOPUP_APPROVE] Audit log inserted { requestId: '...' }
```

**Se UPDATE fallisce**:

```
[TOPUP_APPROVE] Attempting UPDATE { requestId: '...', adminUserId: '...', amountToCredit: 100, usingServiceRole: true }
[TOPUP_APPROVE] UPDATE failed { requestId: '...', updateError: '...', updateErrorCode: '...', updateErrorDetails: '...' }
[TOPUP_APPROVE] UPDATE failed but status still pending/manual_review {
  requestId: '...',
  currentStatus: 'pending',
  updateError: '...',
  updateErrorCode: '...',
  updateErrorDetails: '...',
  adminUserId: '...'
}
```

**Campi error da controllare**:

- `updateErrorCode`: Codice errore PostgreSQL (es. `42501` = insufficient privileges)
- `updateErrorDetails`: Dettagli specifici dell'errore
- `updateErrorHint`: Suggerimento per risolvere

---

## 🔍 TROUBLESHOOTING

### Problema: UPDATE continua a fallire dopo migration

**Possibili cause**:

1. **Migration non eseguite**:

   ```sql
   -- Verifica
   SELECT * FROM pg_policies WHERE tablename = 'top_up_requests';
   -- Deve includere "Admins can update top-up requests"
   ```

2. **Service role key non configurata**:
   - Controlla log: `usingServiceRole: false` → chiave mancante
   - Verifica Vercel env vars

3. **Trigger o constraint bloccano UPDATE**:

   ```sql
   -- Verifica trigger
   SELECT * FROM pg_trigger WHERE tgrelid = 'top_up_requests'::regclass;

   -- Verifica constraint
   SELECT * FROM pg_constraint WHERE conrelid = 'top_up_requests'::regclass;
   ```

4. **RLS ancora attivo nonostante service role**:
   - Prova a disabilitare temporaneamente RLS per test:
   ```sql
   ALTER TABLE top_up_requests DISABLE ROW LEVEL SECURITY;
   -- Testa UPDATE
   ALTER TABLE top_up_requests ENABLE ROW LEVEL SECURITY;
   ```

### Problema: Funzione RPC non disponibile

**Verifica**:

```sql
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'approve_top_up_request';
-- prosecdef deve essere TRUE (SECURITY DEFINER)
```

**Se manca**: Esegui migration 030.

### Problema: Policy non funziona con service role

**Workaround**: Usa funzione SQL come fallback.

Modifica `app/actions/wallet.ts` in `approveTopUpRequest()`:

```typescript
// Dopo UPDATE fallito, prova funzione RPC
if (updateError || !updatedRequest) {
  // ... diagnostica ...

  // Se status ancora pending, prova funzione SQL
  if (
    existingRequest &&
    (existingRequest.status === 'pending' || existingRequest.status === 'manual_review')
  ) {
    console.info('[TOPUP_APPROVE] Trying RPC fallback', { requestId });

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('approve_top_up_request', {
      p_request_id: requestId,
      p_admin_user_id: adminCheck.userId,
      p_approved_amount: amountToCredit,
    });

    if (rpcError || !rpcResult || !rpcResult[0]?.success) {
      console.error('[TOPUP_APPROVE] RPC fallback failed', {
        requestId,
        rpcError: rpcError?.message,
        rpcResult,
      });
      return {
        success: false,
        error:
          rpcResult?.[0]?.error_message || 'Impossibile approvare: UPDATE e RPC fallback falliti.',
      };
    }

    // RPC riuscito: procedi con add_wallet_credit
    const updatedRequest = {
      id: requestId,
      user_id: existingRequest.user_id, // Usa user_id dalla SELECT precedente
      approved_amount: amountToCredit,
    };

    // Continua con add_wallet_credit...
  }
}
```

---

## 📊 CHECKLIST FINALE

Prima di considerare il problema risolto:

- [ ] Migration 029 eseguita su Supabase
- [ ] Migration 030 eseguita su Supabase
- [ ] Policy UPDATE verificata: `SELECT * FROM pg_policies WHERE tablename = 'top_up_requests'`
- [ ] Funzione SQL verificata: `SELECT proname FROM pg_proc WHERE proname = 'approve_top_up_request'`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurata su Vercel
- [ ] Test manuale: Approva richiesta → successo
- [ ] Verifica DB: `top_up_requests.status = 'approved'`
- [ ] Verifica DB: `wallet_transactions` creata
- [ ] Verifica DB: `users.wallet_balance` incrementato
- [ ] Log server-side: Nessun errore `[TOPUP_APPROVE]`

---

## 🔗 COMMIT E FILE

### Commit History

1. `774e5c1` - Fix diagnostica errori + logging
2. `ce91f71` - Migration 029 (prima versione)
3. `08d9597` - Migration 029 migliorata (auth.uid() IS NULL) + logging
4. `3bb5d64` - Migration 030 (funzione SQL fallback)

### File Modificati

- `app/actions/wallet.ts` - Funzione `approveTopUpRequest()` migliorata
- `supabase/migrations/029_add_topup_update_policy.sql` - Policy UPDATE
- `supabase/migrations/030_add_topup_approve_function.sql` - Funzione SQL

---

## 📝 NOTE TECNICHE

### Perché Service Role Key dovrebbe bypassare RLS?

La `SUPABASE_SERVICE_ROLE_KEY` ha il ruolo `service_role` che in Supabase bypassa automaticamente RLS. Tuttavia:

- Se la chiave non è configurata correttamente, RLS può ancora bloccare
- Alcune versioni di Supabase richiedono policy esplicite anche per service role
- La policy UPDATE aggiunta garantisce che funzioni anche senza service role

### Perché funzione SQL con SECURITY DEFINER?

`SECURITY DEFINER` esegue la funzione con i privilegi del creatore (di solito `postgres`), bypassando completamente RLS. È il fallback più robusto.

### Perché log dettagliati?

I log con prefisso `[TOPUP_APPROVE]` permettono di:

- Capire esattamente dove fallisce l'operazione
- Verificare se service role key è configurata
- Diagnosticare errori PostgreSQL specifici (codice, dettagli, hint)

---

## 🆘 SUPPORTO

Se il problema persiste dopo aver seguito questa guida:

1. **Raccogli informazioni**:
   - Log server-side completi (Vercel Functions Logs)
   - Output delle query SQL di verifica
   - Screenshot dell'errore in UI

2. **Verifica configurazione**:
   - Service role key presente e corretta
   - Migration eseguite correttamente
   - Policy e funzione create nel DB

3. **Test isolato**:
   - Prova UPDATE diretto via Supabase SQL Editor
   - Prova chiamata RPC `approve_top_up_request()` direttamente

---

**Ultimo aggiornamento**: 2025-01-XX  
**Versione documento**: 1.0
