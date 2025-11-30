# 🧪 TEST INTEGRAZIONI - Guida Test Locale

## 📋 Prerequisiti

Prima di testare, assicurati di avere:

1. ✅ Server di sviluppo avviato (`npm run dev`)
2. ✅ Database Supabase configurato (opzionale, funziona anche senza)
3. ✅ Utente loggato nel sistema
4. ✅ Variabili ambiente configurate (`.env.local`)

---

## 🎯 SCENARIO 1: Test con Supabase Configurato

### Setup

1. **Verifica configurazione Supabase:**
   ```bash
   # Controlla che queste variabili siano in .env.local
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
   ```

2. **Esegui migration per user_profiles:**
   - Vai su Supabase Dashboard → SQL Editor
   - Esegui il contenuto di `supabase/migrations/003_user_profiles_mapping.sql`
   - Verifica che la tabella `user_profiles` sia stata creata

### Test Steps

1. **Login nel sistema:**
   - Vai su `http://localhost:3000/login`
   - Fai login con email/password o OAuth

2. **Vai alla pagina integrazioni:**
   - URL: `http://localhost:3000/dashboard/integrazioni`
   - Dovresti vedere le card delle piattaforme

3. **Testa salvataggio integrazione:**
   - Clicca su "WooCommerce" (o altra piattaforma)
   - Compila il form con dati di test:
     - **Store URL:** `https://test-store.com`
     - **Consumer Key:** `ck_test1234567890`
     - **Consumer Secret:** `cs_test1234567890`
   - Clicca "Test Connessione" (dovrebbe fallire, ma valida i dati)
   - Clicca "Connetti" per salvare

4. **Verifica salvataggio:**
   - **Opzione A - Supabase Dashboard:**
     - Vai su Supabase → Table Editor → `user_integrations`
     - Dovresti vedere una riga con le tue credenziali
   - **Opzione B - UI:**
     - Ricarica la pagina integrazioni
     - La card WooCommerce dovrebbe mostrare "Attivo" (badge verde)

5. **Testa aggiornamento:**
   - Clicca di nuovo su WooCommerce
   - Modifica i dati (es. cambia Consumer Key)
   - Clicca "Connetti"
   - Verifica che i dati siano aggiornati (non duplicati)

### ✅ Risultato Atteso

- ✅ Form si apre correttamente
- ✅ Validazione Zod funziona (errori se URL/key non valide)
- ✅ Test connessione esegue (anche se fallisce)
- ✅ Salvataggio funziona senza errori
- ✅ Badge "Attivo" appare dopo salvataggio
- ✅ Dati salvati in Supabase (se configurato) o database locale

---

## 🎯 SCENARIO 2: Test SENZA Supabase (Fallback Locale)

### Setup

1. **Rimuovi/commenta variabili Supabase:**
   ```bash
   # In .env.local, commenta o rimuovi:
   # NEXT_PUBLIC_SUPABASE_URL=
   # NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ```

2. **Riavvia il server:**
   ```bash
   # Ctrl+C per fermare
   npm run dev
   ```

### Test Steps

1. **Login nel sistema:**
   - Vai su `http://localhost:3000/login`
   - Fai login

2. **Vai alla pagina integrazioni:**
   - URL: `http://localhost:3000/dashboard/integrazioni`

3. **Testa salvataggio:**
   - Clicca su "Shopify"
   - Compila il form:
     - **Shop URL:** `mystore` (o `mystore.myshopify.com`)
     - **Access Token:** `shpat_test1234567890`
   - Clicca "Test Connessione"
   - Clicca "Connetti"

4. **Verifica salvataggio:**
   - **Database locale:**
     - Apri `data/database.json`
     - Cerca il tuo utente (per email)
     - Verifica che `integrazioni` contenga la nuova integrazione

### ✅ Risultato Atteso

- ✅ Sistema funziona anche senza Supabase
- ✅ Dati salvati nel database JSON locale
- ✅ Nessun errore in console
- ✅ Badge "Attivo" appare dopo salvataggio

---

## 🎯 SCENARIO 3: Test Mapping Utente

### Setup

1. **Supabase configurato** (vedi Scenario 1)

2. **Crea utente in Supabase Auth (opzionale):**
   - Vai su Supabase → Authentication → Users
   - Crea un nuovo utente con la stessa email del tuo account NextAuth
   - Oppure usa l'email esistente se già presente

### Test Steps

1. **Login con NextAuth:**
   - Fai login con email: `test@example.com`

2. **Verifica mapping:**
   - Vai su Supabase → Table Editor → `user_profiles`
   - Cerca la riga con `email = 'test@example.com'`
   - Verifica che `supabase_user_id` sia popolato (se utente esiste in auth.users)

3. **Salva integrazione:**
   - Vai su `/dashboard/integrazioni`
   - Salva un'integrazione (es. Magento)
   - Verifica che in `user_integrations` il `user_id` corrisponda a `supabase_user_id` di `user_profiles`

### ✅ Risultato Atteso

- ✅ Mapping email -> UUID funziona
- ✅ Integrazione salvata con UUID corretto
- ✅ RLS (Row Level Security) funziona (solo le tue integrazioni visibili)

---

## 🐛 Debugging

### Problemi Comuni

**1. Errore: "Non autenticato"**
- ✅ Verifica di essere loggato
- ✅ Controlla che la sessione NextAuth sia valida
- ✅ Apri DevTools → Application → Cookies → verifica presenza cookie NextAuth

**2. Errore: "Utente non trovato"**
- ✅ Verifica che l'utente esista nel database locale (`data/database.json`)
- ✅ Se usi Supabase, verifica che `user_profiles` contenga il tuo email

**3. Errore: "relation user_profiles does not exist"**
- ✅ Esegui la migration `003_user_profiles_mapping.sql` su Supabase
- ✅ Verifica che la tabella sia stata creata

**4. Integrazione non appare come "Attivo"**
- ✅ Ricarica la pagina (F5)
- ✅ Verifica che `getIntegrations()` restituisca i dati
- ✅ Controlla console browser per errori

**5. Dati non salvati in Supabase**
- ✅ Verifica variabili ambiente Supabase
- ✅ Controlla che RLS policy permetta INSERT/UPDATE
- ✅ Verifica log Supabase per errori

### Log da Controllare

**Server (Terminal):**
```bash
# Cerca questi log:
✅ "Integrazione salvata con successo"
❌ "Errore saveIntegration:"
❌ "ERRORE CRITICO: Utente NextAuth non mappato"
```

**Browser (Console F12):**
```javascript
// Cerca errori:
❌ "Failed to fetch"
❌ "Unauthorized"
❌ "Network error"
```

**Supabase Dashboard:**
- Vai su Logs → API Logs
- Cerca errori 401, 403, 500

---

## ✅ Checklist Finale

Prima di considerare il test completato:

- [ ] Login funziona
- [ ] Pagina integrazioni si carica
- [ ] Form si apre correttamente
- [ ] Validazione Zod funziona (errori se dati invalidi)
- [ ] Test connessione esegue
- [ ] Salvataggio funziona (con o senza Supabase)
- [ ] Badge "Attivo" appare dopo salvataggio
- [ ] Aggiornamento integrazione funziona (non crea duplicati)
- [ ] Dati visibili in Supabase (se configurato) o database locale
- [ ] Nessun errore in console browser
- [ ] Nessun errore in console server

---

## 📝 Note

- **Fallback automatico:** Il sistema usa automaticamente il database locale se Supabase non è configurato
- **Mapping opzionale:** Se l'utente non esiste in Supabase Auth, il sistema funziona comunque (usa database locale)
- **RLS attivo:** Se usi Supabase, le integrazioni sono protette da Row Level Security
- **Test connessione:** Il test può fallire se le credenziali sono fake (è normale, serve solo per validare formato)

---

**Buon testing! 🚀**

