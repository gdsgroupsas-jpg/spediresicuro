# 📋 Pagina Admin Gestione Bonifici - Riepilogo

**Data:** 2025-01  
**URL:** `/dashboard/admin/bonifici`  
**Accesso:** Solo Admin/SuperAdmin

---

## 📁 FILE CREATI/MODIFICATI

### 1. Server Actions
**File:** `app/actions/topups-admin.ts` (NUOVO)

**Funzioni:**
- `getTopUpRequestsAdmin({ status, search, limit, offset })` - Lista richieste con filtri
- `getTopUpRequestAdmin(id)` - Dettaglio singola richiesta
- `verifyAdminAccess()` - Helper per verifica permessi admin

**Sicurezza:**
- ✅ Verifica admin/superadmin in ogni funzione
- ✅ Usa `supabaseAdmin` per bypassare RLS
- ✅ Join con tabella `users` per email e nome

### 2. Pagina UI
**File:** `app/dashboard/admin/bonifici/page.tsx` (NUOVO)

**Componenti:**
- Tabs per status: Pending | Manual Review | Approved | Rejected
- Tabella con colonne: Data, Utente, Importo, Stato, AI Conf, Azioni
- Modal/Dialog per dettagli e azioni
- Search bar per email/nome utente
- Toast notifications (sonner)

**Funzionalità:**
- ✅ Visualizza lista richieste filtrate per status
- ✅ Apre modal con dettagli richiesta
- ✅ Link "Apri ricevuta" per visualizzare file
- ✅ Input "Importo da accreditare" (default = amount richiesto)
- ✅ Textarea "Note/Motivo" per rifiuto
- ✅ Bottoni Approva/Rifiuta che chiamano server actions
- ✅ Refresh automatico lista dopo approvazione/rifiuto
- ✅ Conteggi dinamici per ogni tab

---

## 🔗 INTEGRAZIONE CON FUNZIONI ESISTENTI

La pagina usa le funzioni già implementate in `app/actions/wallet.ts`:
- `approveTopUpRequest(requestId, approvedAmount?)` - Approvazione atomica con rollback
- `rejectTopUpRequest(requestId, reason)` - Rifiuto con audit log

---

## 🧪 TEST MANUALI STEP-BY-STEP

### Prerequisiti
1. Avere almeno un utente admin/superadmin configurato
2. Avere almeno una richiesta `top_up_requests` con `status = 'pending'`
3. Browser con accesso all'applicazione

---

### Test 1: Accesso e Visualizzazione

**Passi:**
1. Accedi come admin/superadmin
2. Vai su `/dashboard/admin/bonifici`
3. Verifica che la pagina carichi senza errori

**Risultato atteso:**
- ✅ Pagina carica correttamente
- ✅ Tab "In Attesa" è attivo di default
- ✅ Tabella mostra richieste con status `pending`
- ✅ Colonne: Data, Utente, Importo, Stato, AI Conf, Azioni
- ✅ Conteggi tab aggiornati

**Query verifica:**
```sql
-- Conta richieste per status
SELECT status, COUNT(*) 
FROM top_up_requests 
GROUP BY status;
```

---

### Test 2: Creazione Richiesta e Visualizzazione

**Passi:**
1. Accedi come utente normale (non admin)
2. Crea una richiesta top-up (upload ricevuta bonifico)
3. Accedi come admin
4. Vai su `/dashboard/admin/bonifici`
5. Verifica che la richiesta appaia in tab "In Attesa"

**Risultato atteso:**
- ✅ Richiesta appare in tab "In Attesa"
- ✅ Email/nome utente visibili nella colonna "Utente"
- ✅ Importo corretto
- ✅ Status badge "In Attesa" (giallo)
- ✅ AI Confidence visibile (se disponibile)
- ✅ Bottone "Dettagli" presente

**Query verifica:**
```sql
-- Verifica richiesta creata
SELECT id, user_id, amount, status, created_at
FROM top_up_requests
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 1;
```

---

### Test 3: Visualizzazione Dettagli

**Passi:**
1. Dalla lista, clicca "Dettagli" su una richiesta `pending`
2. Verifica contenuto modal

**Risultato atteso:**
- ✅ Modal si apre
- ✅ Mostra: Utente (nome + email), Stato, Importo Richiesto
- ✅ AI Confidence con barra progresso (se disponibile)
- ✅ Link "Apri ricevuta" funzionante (apre file in nuova tab)
- ✅ Input "Importo da Accreditare" con valore default = amount
- ✅ Textarea "Note / Motivo Rifiuto" vuota
- ✅ Bottoni "Approva" e "Rifiuta" visibili

---

### Test 4: Approvazione Richiesta

**Passi:**
1. Apri dettagli di una richiesta `pending`
2. Verifica che "Importo da Accreditare" sia precompilato con amount
3. Clicca "Approva"
4. Verifica toast successo
5. Verifica che modal si chiuda
6. Verifica che lista si aggiorni

**Risultato atteso:**
- ✅ Toast: "Richiesta approvata. Credito di €X accreditato."
- ✅ Modal si chiude
- ✅ Lista si aggiorna automaticamente
- ✅ Richiesta sparisce da tab "In Attesa"
- ✅ Richiesta appare in tab "Approvate"
- ✅ Wallet utente aumenta di amount
- ✅ Audit log creato

**Query verifica:**
```sql
-- Verifica status richiesta
SELECT id, status, approved_by, approved_at, approved_amount
FROM top_up_requests
WHERE id = '<request_id>';
-- Deve essere: status='approved', approved_by=<admin_id>, approved_at IS NOT NULL

-- Verifica wallet_transaction creata
SELECT id, user_id, amount, type, description
FROM wallet_transactions
WHERE description LIKE '%Approvazione richiesta ricarica #<request_id>%';
-- Deve essere: 1 transazione, type='deposit', amount=<amount>

-- Verifica wallet_balance aggiornato
SELECT id, email, wallet_balance
FROM users
WHERE id = '<user_id>';
-- wallet_balance deve essere aumentato di <amount>

-- Verifica audit_log
SELECT action, resource_type, resource_id, user_id, metadata
FROM audit_logs
WHERE action = 'top_up_request_approved' AND resource_id = '<request_id>';
-- Deve esistere 1 record
```

---

### Test 5: Approvazione con Importo Diverso

**Passi:**
1. Apri dettagli di una richiesta `pending` con amount = 100
2. Modifica "Importo da Accreditare" a 80
3. Clicca "Approva"
4. Verifica risultato

**Risultato atteso:**
- ✅ Toast successo
- ✅ Wallet aumenta di 80 (non 100)
- ✅ `approved_amount` = 80 nella richiesta
- ✅ Audit log contiene `approved_amount: 80`

**Query verifica:**
```sql
SELECT approved_amount, amount
FROM top_up_requests
WHERE id = '<request_id>';
-- approved_amount deve essere 80, amount deve essere 100
```

---

### Test 6: Rifiuto Richiesta

**Passi:**
1. Apri dettagli di una richiesta `pending`
2. Inserisci motivo: "Ricevuta non leggibile"
3. Clicca "Rifiuta"
4. Verifica risultato

**Risultato atteso:**
- ✅ Toast: "Richiesta rifiutata con successo."
- ✅ Modal si chiude
- ✅ Lista si aggiorna
- ✅ Richiesta sparisce da tab "In Attesa"
- ✅ Richiesta appare in tab "Rifiutate"
- ✅ Wallet utente NON aumenta
- ✅ Audit log creato

**Query verifica:**
```sql
-- Verifica status richiesta
SELECT id, status, approved_by, approved_at, admin_notes
FROM top_up_requests
WHERE id = '<request_id>';
-- Deve essere: status='rejected', admin_notes='Ricevuta non leggibile'

-- Verifica NESSUNA wallet_transaction creata
SELECT COUNT(*) 
FROM wallet_transactions
WHERE description LIKE '%Approvazione richiesta ricarica #<request_id>%';
-- Deve essere: 0

-- Verifica audit_log
SELECT action, resource_type, resource_id, metadata
FROM audit_logs
WHERE action = 'top_up_request_rejected' AND resource_id = '<request_id>';
-- Deve esistere 1 record con metadata.reason
```

---

### Test 7: Doppia Approvazione (Idempotenza)

**Passi:**
1. Approva una richiesta (Test 4)
2. Vai su tab "Approvate"
3. Apri dettagli della richiesta già approvata
4. Clicca "Approva" di nuovo (se il bottone è ancora visibile)

**Risultato atteso:**
- ✅ Se bottone "Approva" è ancora visibile e cliccato:
  - Toast errore: "Richiesta già processata."
  - Nessuna nuova wallet_transaction creata
  - Wallet NON aumenta di nuovo
- ✅ Se bottone "Approva" è nascosto (status = 'approved'):
  - Modal mostra info approvazione
  - Nessun bottone azione visibile

**Query verifica:**
```sql
-- Conta transazioni per questa richiesta
SELECT COUNT(*) 
FROM wallet_transactions
WHERE description LIKE '%Approvazione richiesta ricarica #<request_id>%';
-- Deve essere: 1 (anche dopo doppio click)
```

---

### Test 8: Race Condition (Concorrenza)

**Passi:**
1. Apri due tab browser con `/dashboard/admin/bonifici`
2. Entrambe le tab: apri dettagli della stessa richiesta `pending`
3. In entrambe le tab: clicca "Approva" simultaneamente (o quasi)

**Risultato atteso:**
- ✅ Solo una approvazione riesce
- ✅ L'altra mostra errore: "Richiesta già processata."
- ✅ Solo 1 wallet_transaction creata
- ✅ Wallet aumenta solo 1 volta

**Query verifica:**
```sql
-- Conta transazioni
SELECT COUNT(*) 
FROM wallet_transactions
WHERE description LIKE '%Approvazione richiesta ricarica #<request_id>%';
-- Deve essere: 1 (anche con click simultanei)
```

---

### Test 9: Search

**Passi:**
1. Vai su `/dashboard/admin/bonifici`
2. Inserisci email utente nella search bar
3. Premi Enter o clicca "Aggiorna"
4. Verifica risultati

**Risultato atteso:**
- ✅ Lista filtra per email/nome utente
- ✅ Solo richieste dell'utente cercato sono visibili
- ✅ Search funziona anche con parte dell'email

---

### Test 10: Navigazione Tab

**Passi:**
1. Vai su `/dashboard/admin/bonifici`
2. Clicca su ogni tab: In Attesa | Revisione | Approvate | Rifiutate
3. Verifica contenuto

**Risultato atteso:**
- ✅ Ogni tab mostra solo richieste con status corrispondente
- ✅ Conteggi tab aggiornati correttamente
- ✅ Tabella si aggiorna quando cambi tab

---

### Test 11: Accesso Non Autorizzato

**Passi:**
1. Accedi come utente normale (non admin)
2. Vai su `/dashboard/admin/bonifici`
3. Verifica comportamento

**Risultato atteso:**
- ✅ Redirect a `/dashboard?error=unauthorized`
- ✅ O pagina mostra "Accesso negato"
- ✅ Nessun dato caricato

---

## ⚠️ NOTE TECNICHE

1. **Join Users:** La query fa join manuale con tabella `users` pubblica perché `top_up_requests.user_id` fa riferimento a `auth.users(id)`, non a `users(id)`. Se un utente non esiste in `users` pubblica, email e nome saranno `null`.

2. **Conteggi Tab:** I conteggi vengono calcolati caricando tutte le richieste (limit 1000) in background. Per performance migliori, si potrebbe creare una funzione RPC che restituisce solo i conteggi.

3. **Search:** La ricerca viene applicata dopo il fetch, quindi potrebbe essere lenta con molti risultati. Per performance migliori, si potrebbe usare una funzione RPC con ricerca SQL.

4. **Modal:** Il modal mostra bottoni Approva/Rifiuta solo se status è `pending` o `manual_review`. Se status è `approved` o `rejected`, mostra solo info.

---

## 📝 TODO FUTURI (Opzionali)

- [ ] Paginazione tabella (attualmente limit 100)
- [ ] Filtri avanzati (data range, importo min/max)
- [ ] Export CSV delle richieste
- [ ] Notifiche email all'utente su approvazione/rifiuto
- [ ] Bulk actions (approva/rifiuta multiple richieste)
- [ ] Statistiche dashboard (totale approvato, rifiutato, in attesa)

---

**Fine Documento**
