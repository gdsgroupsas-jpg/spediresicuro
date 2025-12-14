# 🔒 FIX WALLET SECURITY - Riepilogo Implementazione

**Data:** 2025-01  
**Status:** ✅ Completato  
**Migrations:** ✅ 027 e 028 eseguite con successo

---

## 📋 FILE MODIFICATI

### PR1 - Fix Doppio Accredito (CRITICAL)

| File | Modifiche |
|------|-----------|
| `actions/wallet.ts` | ❌ Rimosso fallback manuale UPDATE `wallet_balance` (linea 110-168) → Solo RPC, se fallisce ritorna errore |
| `actions/admin-reseller.ts` | ❌ Rimosso fallback manuale UPDATE `wallet_balance` (linea 445-486) → Solo RPC, se fallisce ritorna errore |
| `actions/super-admin.ts` | ❌ Rimosso fallback manuale INSERT + UPDATE (linea 200-224, 237-261) → Solo RPC, se fallisce ritorna errore |

**Risultato:** Eliminato rischio doppio accredito. Ora solo RPC `add_wallet_credit()` / `deduct_wallet_credit()` possono modificare `wallet_balance` (via trigger).

---

### PR2 - Limiti Importo + Validazioni

| File | Modifiche |
|------|-----------|
| `supabase/migrations/028_wallet_security_fixes.sql` | ✅ **NUOVO** - Aggiunto limite max €10.000 in `add_wallet_credit()` |
| `app/actions/wallet.ts` | ✅ Aggiunte validazioni: file type (JPG/PNG/PDF), file size (max 10MB), importo (€0.01-€10.000), rate limiting (max 5 richieste/24h) |

**Risultato:** 
- Nessun importo > €10.000 può essere accreditato
- File non validi vengono rifiutati server-side
- Rate limiting previene spam

---

### PR3 - Anti-Duplicati

| File | Modifiche |
|------|-----------|
| `supabase/migrations/028_wallet_security_fixes.sql` | ✅ Aggiunta colonna `file_hash` (SHA256) a `top_up_requests` |
| `app/actions/wallet.ts` | ✅ Controllo duplicati: stesso `file_hash` + `user_id` e stesso `amount` + `user_id` nelle ultime 24h |

**Risultato:** 
- Stesso file non può essere caricato due volte
- Stesso importo non può essere richiesto due volte in 24h se già pending

---

### PR4 - Approvazione/Rifiuto

| File | Modifiche |
|------|-----------|
| `app/actions/wallet.ts` | ✅ **NUOVO** - Funzione `approveTopUpRequest(requestId, approvedAmount?)` |
| `app/actions/wallet.ts` | ✅ **NUOVO** - Funzione `rejectTopUpRequest(requestId, reason)` |
| `supabase/migrations/028_wallet_security_fixes.sql` | ✅ Aggiunte colonne: `approved_by`, `approved_at`, `approved_amount` |

**Risultato:**
- Admin può approvare/rifiutare richieste
- Approvazione accredita wallet via RPC (no fallback)
- Verifica status (solo pending/manual_review possono essere approvate)
- Prevenzione doppia approvazione (status già processato)

---

### PR5 - Audit Log

| File | Modifiche |
|------|-----------|
| `app/actions/wallet.ts` | ✅ Audit log: `top_up_request_created`, `top_up_request_approved`, `top_up_request_rejected` |
| `actions/wallet.ts` | ✅ Audit log: `wallet_credit_added` (self-recharge) |
| `actions/super-admin.ts` | ✅ Audit log: `wallet_credit_added`, `wallet_credit_removed` |
| `actions/admin-reseller.ts` | ✅ Audit log: `wallet_credit_added` (reseller recharge) |

**Risultato:**
- Tutte le operazioni wallet sono tracciate in `audit_logs`
- Metadata include: amount, reason, transaction_id, target_user_id

---

## 📦 MIGRAZIONI SQL CREATE

### `028_wallet_security_fixes.sql`

**Contenuto:**
1. ✅ Aggiornamento `add_wallet_credit()` con limite max €10.000
2. ✅ Aggiunta colonna `file_hash` a `top_up_requests` (SHA256 per anti-duplicati)
3. ✅ Aggiunta colonne `approved_by`, `approved_at`, `approved_amount` a `top_up_requests`
4. ✅ Indice su `(user_id, file_hash)` per ricerca duplicati veloce
5. ✅ Controlli IF EXISTS con `pg_tables` per sicurezza (funziona anche se tabella non esiste ancora)

**Prerequisito:**
- ⚠️ **IMPORTANTE:** La migration `027_wallet_topups.sql` deve essere eseguita PRIMA (crea la tabella `top_up_requests`)
- Se la tabella non esiste, la migration 028 mostra warning ma non fallisce (salta le modifiche a `top_up_requests`)

**Come applicare:**
```bash
# 1. PRIMA esegui la 027 (se non già fatta)
supabase migration up 027_wallet_topups

# 2. POI esegui la 028
supabase migration up 028_wallet_security_fixes
```

**Status:** ✅ Migration testata e funzionante

---

## ✅ TEST MANUALI OBBLIGATORI

### Test 1: Creazione top_up_request valida
**Passi:**
1. Login come utente normale
2. Vai a `/dashboard/wallet`
3. Carica file PDF/JPG/PNG valido (< 10MB)
4. Inserisci importo tra €0.01 e €10.000
5. Submit

**Risultato atteso:**
- ✅ Richiesta creata con `status = 'pending'`
- ✅ Record in `top_up_requests` con `file_hash` popolato
- ✅ Record in `audit_logs` con `action = 'top_up_request_created'`

**Query verifica:**
```sql
SELECT * FROM top_up_requests WHERE user_id = '<user_id>' ORDER BY created_at DESC LIMIT 1;
SELECT * FROM audit_logs WHERE action = 'top_up_request_created' ORDER BY created_at DESC LIMIT 1;
```

---

### Test 2: Importo non valido (0 o >10000)
**Passi:**
1. Prova importo = 0 → deve fallire
2. Prova importo = 10001 → deve fallire
3. Prova importo = -100 → deve fallire

**Risultato atteso:**
- ✅ Errore server-side: "Importo non valido. Deve essere tra €0.01 e €10.000"
- ✅ Nessun record creato in `top_up_requests`

---

### Test 3: File non valido
**Passi:**
1. Prova upload file `.exe` → deve fallire
2. Prova upload file > 10MB → deve fallire

**Risultato atteso:**
- ✅ Errore: "Formato file non supportato" o "File troppo grande"
- ✅ Nessun record creato

---

### Test 4: Rate limiting (6 richieste in 24h)
**Passi:**
1. Crea 5 richieste valide (diverse)
2. Prova creare la 6a richiesta

**Risultato atteso:**
- ✅ Prime 5 richieste create con successo
- ✅ 6a richiesta fallisce: "Hai raggiunto il limite di 5 richieste nelle ultime 24 ore"

**Query verifica:**
```sql
SELECT COUNT(*) FROM top_up_requests 
WHERE user_id = '<user_id>' 
AND created_at >= NOW() - INTERVAL '24 hours';
```

---

### Test 5: Approvazione richiesta
**Passi:**
1. Login come admin/superadmin
2. Trova una richiesta con `status = 'pending'`
3. Chiama `approveTopUpRequest(requestId)`

**Risultato atteso:**
- ✅ `top_up_requests.status` = `'approved'`
- ✅ `top_up_requests.approved_by` = ID admin
- ✅ `top_up_requests.approved_at` = timestamp
- ✅ `top_up_requests.approved_amount` = amount accreditato
- ✅ 1 sola `wallet_transaction` creata (tipo 'deposit')
- ✅ `users.wallet_balance` aumentato esattamente di `approved_amount`
- ✅ Record in `audit_logs` con `action = 'top_up_request_approved'`

**Query verifica:**
```sql
-- Verifica richiesta
SELECT * FROM top_up_requests WHERE id = '<request_id>';

-- Verifica transazione wallet
SELECT * FROM wallet_transactions WHERE id = '<transaction_id>';

-- Verifica balance
SELECT wallet_balance FROM users WHERE id = '<user_id>';

-- Verifica audit
SELECT * FROM audit_logs WHERE action = 'top_up_request_approved' AND resource_id = '<request_id>';
```

---

### Test 6: Doppia approvazione (prevenzione)
**Passi:**
1. Approva una richiesta (Test 5)
2. Prova approvare di nuovo la stessa richiesta

**Risultato atteso:**
- ✅ Errore: "Richiesta già processata. Status attuale: approved"
- ✅ Nessuna nuova `wallet_transaction` creata
- ✅ `wallet_balance` NON aumenta di nuovo

**Query verifica:**
```sql
-- Conta transazioni per questa richiesta
SELECT COUNT(*) FROM wallet_transactions 
WHERE description LIKE '%Approvazione richiesta ricarica #<request_id>%';
-- Deve essere = 1
```

---

### Test 7: Rifiuto richiesta
**Passi:**
1. Login come admin
2. Trova richiesta `status = 'pending'`
3. Chiama `rejectTopUpRequest(requestId, 'Motivo test')`

**Risultato atteso:**
- ✅ `top_up_requests.status` = `'rejected'`
- ✅ `top_up_requests.admin_notes` = 'Motivo test'
- ✅ `top_up_requests.approved_by` = ID admin
- ✅ `top_up_requests.approved_at` = timestamp
- ✅ **Nessuna** `wallet_transaction` creata
- ✅ `users.wallet_balance` **NON** cambia
- ✅ Record in `audit_logs` con `action = 'top_up_request_rejected'`

**Query verifica:**
```sql
SELECT * FROM top_up_requests WHERE id = '<request_id>';
SELECT * FROM audit_logs WHERE action = 'top_up_request_rejected' AND resource_id = '<request_id>';
```

---

### Test 8: Verifica audit_logs completi
**Query:**
```sql
-- Tutti gli eventi wallet
SELECT action, resource_type, user_email, metadata, created_at 
FROM audit_logs 
WHERE resource_type IN ('wallet', 'top_up_request')
ORDER BY created_at DESC 
LIMIT 20;
```

**Risultato atteso:**
- ✅ Eventi presenti: `top_up_request_created`, `top_up_request_approved`, `top_up_request_rejected`, `wallet_credit_added`, `wallet_credit_removed`
- ✅ Metadata popolati con amount, transaction_id, target_user_id

---

## 🔍 CHECKLIST FINALE

- [x] PR1: Rimosso UPDATE manuale `wallet_balance` da tutti i file
- [x] PR1: Fallback manuali rimossi, solo RPC
- [x] PR2: Limite max €10.000 aggiunto in SQL `add_wallet_credit()`
- [x] PR2: Validazioni file (type, size) aggiunte
- [x] PR2: Validazione importo server-side
- [x] PR2: Rate limiting (max 5 richieste/24h)
- [x] PR3: Colonne `file_hash` aggiunta a `top_up_requests`
- [x] PR3: Controllo duplicati file_hash implementato
- [x] PR3: Controllo duplicati amount/24h implementato
- [x] PR4: Funzione `approveTopUpRequest()` implementata
- [x] PR4: Funzione `rejectTopUpRequest()` implementata
- [x] PR4: Colonne approvazione aggiunte a `top_up_requests`
- [x] PR5: Audit log per `top_up_request_created`
- [x] PR5: Audit log per `top_up_request_approved`
- [x] PR5: Audit log per `top_up_request_rejected`
- [x] PR5: Audit log per `wallet_credit_added`
- [x] PR5: Audit log per `wallet_credit_removed`

---

## ⚠️ NOTE IMPORTANTI

1. **Ordine migrations:** Eseguire PRIMA `027_wallet_topups.sql`, POI `028_wallet_security_fixes.sql`
2. **Migration 028 robusta:** Se `top_up_requests` non esiste, mostra warning ma non fallisce (usa controlli `pg_tables`)
3. **No breaking changes:** Tutte le modifiche sono retrocompatibili
4. **Audit log non blocca:** Se audit fallisce, l'operazione continua (non critico)
5. **RLS policies:** Le nuove colonne `approved_by` su `top_up_requests` richiedono policy UPDATE per admin (già presente via service_role)
6. **Status migrations:** ✅ 027 e 028 eseguite con successo

---

## 🚀 PROSSIMI PASSI (Opzionali)

- [ ] UI per admin: pagina lista `top_up_requests` pending con azioni approve/reject
- [ ] Notifica email utente quando richiesta approvata/rifiutata
- [ ] Dashboard admin: statistiche richieste (pending, approved, rejected)
- [ ] Webhook XPay: completare ciclo pagamento carta (non in scope PR1-5)

---

**Fine Documento**
