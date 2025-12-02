# 🧪 Test Locale - SpedireSicuro

## Checklist Test Locale

### ✅ Prerequisiti
- [ ] Server avviato: `npm run dev`
- [ ] Supabase configurato in `.env.local`
- [ ] Test Supabase: `GET /api/test/supabase` → `status: "success"`

### ✅ Test 1: Login
1. Vai su `http://localhost:3000/login`
2. Login con credenziali di sviluppo (configurate nel file lib/database.ts)
3. ✅ Dovresti essere reindirizzato alla dashboard
4. Controlla log server: `✅ [SUPABASE] Profilo utente sincronizzato...`

### ✅ Test 2: Creazione Spedizione
1. Vai su `http://localhost:3000/dashboard/spedizioni/nuova`
2. Compila il form (almeno campi obbligatori)
3. Clicca "Salva"
4. ✅ Dovresti vedere messaggio di successo
5. Controlla log server:
   - `✅ [SUPABASE] Spedizione salvata con successo!` OPPURE
   - `📁 [JSON] Spedizione salvata in JSON locale`

### ✅ Test 3: Lista Spedizioni
1. Vai su `http://localhost:3000/dashboard/spedizioni`
2. ✅ Dovresti vedere la spedizione appena creata
3. Controlla log server: `✅ [SUPABASE] Recuperate X spedizioni` OPPURE `📁 [JSON] Trovate X spedizioni`

### ✅ Test 4: Export CSV
1. Crea almeno 1 spedizione con status `pending`
2. Vai su `http://localhost:3000/api/export/spediscionline`
3. ✅ Dovrebbe scaricare un file CSV
4. Controlla log server: `✅ [SUPABASE] Esportate X spedizioni` OPPURE `📁 [JSON] Esportate X spedizioni`

### ✅ Test 5: Verifica Supabase Dashboard
1. Vai su Supabase Dashboard → Table Editor → `shipments`
2. ✅ Dovresti vedere le spedizioni create
3. Controlla se hanno `user_id` (potrebbe essere `null` se utente non in auth.users)

## 🔍 Cosa Controllare nei Log

### Log Positivi (Tutto OK):
```
✅ [SUPABASE] User ID trovato in user_profiles per user@example.com
✅ [SUPABASE] Spedizione salvata con successo! ID: xyz-789
✅ [SUPABASE] Recuperate 5 spedizioni
```

### Log Fallback (Funziona ma usa JSON):
```
⚠️ [SUPABASE] Nessun user_id trovato per user@example.com
📁 [JSON] Spedizione salvata in JSON locale
📁 [JSON] Trovate 5 spedizioni nel database JSON
```

### Log Errori (Problema):
```
❌ [SUPABASE] Errore salvataggio: connection failed
❌ [SUPABASE] Errore lettura: timeout
```

## 📝 Note Importanti

1. **Multi-tenancy**: In locale potrebbe non funzionare perfettamente se gli utenti non esistono in `auth.users` di Supabase. Questo è normale e non blocca il funzionamento.

2. **RLS**: In locale usiamo `supabaseAdmin` che bypassa RLS. Questo è corretto per sviluppo.

3. **Fallback JSON**: Se Supabase non è disponibile, il sistema usa automaticamente JSON locale. Nessun errore!

4. **user_id null**: Se vedi spedizioni con `user_id = null`, significa che l'utente NextAuth non esiste in Supabase Auth. Funziona comunque, ma senza isolamento completo.

## 🎯 Risultato Atteso

Se tutto funziona, dovresti vedere:
- ✅ Login funziona
- ✅ Spedizioni salvate (in Supabase o JSON)
- ✅ Lista spedizioni funziona
- ✅ Export CSV funziona
- ✅ Log chiari che mostrano cosa sta succedendo


