# 📋 Test Plan: Gestione reseller_role dal Super Admin Panel

## ✅ Pre-requisiti

1. **Migrazione 051 applicata**:
   ```sql
   -- Verifica colonna esiste
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'users' AND column_name = 'reseller_role';
   ```
   **Risultato atteso**: `reseller_role`

2. **Utenti di test**:
   - Super Admin (account_type='superadmin')
   - Reseller A (is_reseller=true, reseller_role='user')
   - Reseller B (is_reseller=true, reseller_role='admin')

---

## 🧪 Test 1: Promuovi Reseller User → Admin

### Steps:
1. Login come Super Admin
2. Vai a `/dashboard/super-admin`
3. Trova Reseller A (reseller_role='user')
4. Nella colonna "Ruolo Reseller", cambia da "User" a "Admin"
5. Verifica toast: "Reseller A è ora Admin Reseller"

### Verifiche:
- ✅ Toast successo mostrato
- ✅ Select aggiornato a "Admin"
- ✅ Tabella refresh automatico

### Verifica DB:
```sql
SELECT id, email, is_reseller, reseller_role
FROM users
WHERE email = '<reseller_a_email>';
```
**Risultato atteso**: `reseller_role = 'admin'`

### Verifica Audit Log:
```sql
SELECT action, metadata
FROM audit_logs
WHERE action = 'reseller_role_updated'
ORDER BY created_at DESC
LIMIT 1;
```
**Risultato atteso**: 
```json
{
  "target_user_email": "<reseller_a_email>",
  "old_role": "user",
  "new_role": "admin"
}
```

---

## 🧪 Test 2: Reseller Admin Può Cancellare Config

### Steps:
1. Login come Reseller A (ora admin dopo Test 1)
2. Vai a `/dashboard/integrazioni`
3. Verifica: vedi la tua configurazione Spedisci.Online
4. Verifica: vedi pulsanti Elimina/Modifica/Toggle
5. Clicca Elimina
6. Verifica: configurazione eliminata con successo

### Verifiche:
- ✅ Pulsanti Elimina/Modifica/Toggle visibili
- ✅ Eliminazione riuscita
- ✅ Nessun errore "Accesso negato"

### Log Atteso:
```
✅ [verifyConfigAccess] Reseller admin, owner_user_id match: OK
✅ Configurazione eliminata: <id>
```

---

## 🧪 Test 3: Declassa Reseller Admin → User

### Steps:
1. Login come Super Admin
2. Vai a `/dashboard/super-admin`
3. Trova Reseller A (ora reseller_role='admin')
4. Nella colonna "Ruolo Reseller", cambia da "Admin" a "User"
5. Verifica toast: "Reseller A è ora User Reseller"

### Verifiche:
- ✅ Toast successo mostrato
- ✅ Select aggiornato a "User"
- ✅ Tabella refresh automatico

### Verifica DB:
```sql
SELECT reseller_role FROM users WHERE email = '<reseller_a_email>';
```
**Risultato atteso**: `reseller_role = 'user'`

---

## 🧪 Test 4: Reseller User NON Può Cancellare Config

### Steps:
1. Login come Reseller A (ora user dopo Test 3)
2. Vai a `/dashboard/integrazioni`
3. Verifica: vedi la tua configurazione Spedisci.Online
4. Verifica: NON vedi pulsanti Elimina/Modifica/Toggle
5. (Opzionale) Prova chiamata API diretta `DELETE /api/configurations/<id>`
6. Verifica: errore "Accesso negato"

### Verifiche:
- ✅ Pulsanti Elimina/Modifica/Toggle NON visibili
- ✅ API ritorna errore "Accesso negato"

### Log Atteso:
```
❌ [verifyConfigAccess] Reseller user: accesso negato
```

---

## 🧪 Test 5: Super Admin Può Cambiare Ruolo Solo Reseller

### Steps:
1. Login come Super Admin
2. Vai a `/dashboard/super-admin`
3. Trova utente normale (is_reseller=false)
4. Verifica: colonna "Ruolo Reseller" mostra "—" (non modificabile)
5. Trova Reseller B (is_reseller=true)
6. Verifica: colonna "Ruolo Reseller" mostra select con opzioni

### Verifiche:
- ✅ Utenti non reseller: colonna mostra "—"
- ✅ Reseller: colonna mostra select funzionante

---

## 🧪 Test 6: Super Admin NON Può Cambiare Ruolo Super Admin

### Steps:
1. Login come Super Admin
2. Vai a `/dashboard/super-admin`
3. Trova altro Super Admin (account_type='superadmin')
4. Verifica: colonna "Ruolo Reseller" mostra "—" o select disabilitato

### Verifiche:
- ✅ Super Admin: select disabilitato o non visibile

---

## 🧪 Test 7: Error Handling

### Test 7a: Tentativo Cambio Ruolo Utente Non Reseller
1. Super Admin prova a cambiare ruolo utente normale (is_reseller=false)
2. **Verifica**: Errore "Solo gli utenti reseller possono avere un ruolo reseller"

### Test 7b: Tentativo Cambio Ruolo da Non Super Admin
1. Login come Reseller Admin
2. Prova chiamata API diretta `updateResellerRole`
3. **Verifica**: Errore "Solo i Super Admin possono cambiare i ruoli reseller"

### Test 7c: Ruolo Non Valido
1. Super Admin prova a passare ruolo 'invalid'
2. **Verifica**: Errore "Ruolo non valido. Deve essere 'admin' o 'user'"

---

## 📊 Checklist Finale

- [ ] Test 1: Promuovi Reseller User → Admin ✅
- [ ] Test 2: Reseller Admin può cancellare config ✅
- [ ] Test 3: Declassa Reseller Admin → User ✅
- [ ] Test 4: Reseller User NON può cancellare config ✅
- [ ] Test 5: Super Admin può cambiare ruolo solo reseller ✅
- [ ] Test 6: Super Admin NON può cambiare ruolo super admin ✅
- [ ] Test 7: Error handling ✅

---

## 🎯 Risultato Atteso

**Tutti i test passano** ✅

**Feature completa e funzionante**:
- Super Admin può gestire ruoli reseller dalla UI
- RBAC funziona correttamente (reseller_admin vs reseller_user)
- Nessuna regressione su utenti normali
- Audit log completo

---

**Firma**:  
Senior Full-Stack Engineer  
Data: 2025-12-28

