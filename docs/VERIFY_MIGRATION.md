# ✅ Verifica Migrazione 031_fix_ambiguous_id_rpc

## 🎯 Verifica Funzione Aggiornata

### Query di Verifica

Esegui questa query in Supabase SQL Editor per verificare che la funzione sia stata aggiornata:

```sql
-- Verifica che la funzione esista e abbia l'alias corretto
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'get_courier_config_for_user';
```

**Risultato atteso**: Dovresti vedere la definizione della funzione con `u.id` qualificato nelle subquery.

### Test Funzione

Testa la funzione con un utente esistente:

```sql
-- Sostituisci USER_UUID con un UUID reale dalla tabella users
SELECT * FROM get_courier_config_for_user(
  'USER_UUID_HERE'::uuid,
  'spedisci_online'
);
```

**Risultato atteso**: 
- ✅ Nessun errore 42702 (ambiguous column reference)
- ✅ Restituisce configurazione o nessun risultato (se non configurata)

---

## 🧪 Test Completo End-to-End

### 1. Verifica Deploy Vercel

1. Vai su: https://vercel.com/dashboard
2. Seleziona progetto → **Deployments**
3. Verifica che l'ultimo deploy sia completato (commit `2834f93`)
4. Clicca sul deploy → **Logs**
5. Cerca errori durante il build

### 2. Test Endpoint Diagnostico

```bash
curl https://tuo-dominio.vercel.app/api/test-supabase
```

**Risultato atteso**:
```json
{
  "isConfigured": true,
  "connectionTest": { "success": true },
  "insertTest": { "success": true },
  "diagnosis": {
    "issue": "All checks passed",
    "severity": "NONE"
  }
}
```

### 3. Test Creazione Spedizione

1. **Login** alla produzione
2. **Vai su**: "Crea Spedizione"
3. **Compila form**:
   - Mittente: Test Sender
   - Destinatario: Test Recipient  
   - Peso: 1 kg
   - Corriere: GLS (o qualsiasi disponibile)
4. **Invia**
5. **Verifica**:
   - ✅ Spedizione creata con successo
   - ✅ Nessun errore nel browser
   - ✅ Nessun errore 42702 nei log Vercel

### 4. Verifica Database

```sql
-- Verifica che le nuove spedizioni abbiano user_id non null
SELECT 
  id,
  user_id,
  tracking_number,
  created_by_user_email,
  created_at
FROM shipments
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;
```

**Risultato atteso**:
- ✅ `user_id` NON è null per le nuove spedizioni
- ✅ `created_by_user_email` è popolato

---

## 🔍 Monitoraggio Log Vercel

### Pattern da Cercare (Successo)

```
✅ [SUPABASE] Spedizione salvata con successo! ID: ...
✅ [ORCHESTRATOR] LDV creata (method): ...
✅ [SUPABASE] User ID trovato: ...
```

### Pattern da Evitare (Errori)

```
❌ [SUPABASE] Errore salvataggio: { code: "42702" }
❌ [BROKER] Errore decriptazione api_key
❌ [ORCHESTRATOR] Nessuna configurazione trovata
```

---

## ✅ Checklist Completamento

- [x] Migrazione SQL applicata ("Success. No rows returned")
- [ ] Funzione verificata (query sopra)
- [ ] Deploy Vercel completato
- [ ] Endpoint `/api/test-supabase` ritorna successo
- [ ] Creazione spedizione funziona
- [ ] Nessun errore 42702 nei log
- [ ] `user_id` non null nel database
- [ ] Label generata (se orchestrator configurato)

---

## 🆘 Se Qualcosa Non Funziona

### Problema: Funzione ancora dà errore 42702

**Causa**: Funzione non aggiornata correttamente

**Fix**:
1. Verifica definizione funzione (query sopra)
2. Se non aggiornata, ri-esegui migrazione manualmente
3. Verifica che non ci siano errori di sintassi SQL

### Problema: user_id ancora null

**Causa**: NextAuth session.user.id non disponibile

**Fix**:
1. Verifica struttura sessione: `lib/auth-config.ts` session callback
2. Verifica che `session.user.id` sia impostato nel token callback
3. Controlla log per messaggi: `⚠️ [SUPABASE] Usando NextAuth user.id come fallback`

### Problema: Decriptazione fallisce

**Causa**: ENCRYPTION_KEY mismatch

**Fix**:
1. Verifica ENCRYPTION_KEY in Vercel
2. Se ruotata, riconfigura credenziali in `/dashboard/admin/configurations`
3. Dovresti vedere errore chiaro: `CREDENTIAL_DECRYPT_FAILED: Impossibile decriptare...`

---

**Status**: Migrazione applicata ✅ - Pronto per test end-to-end
