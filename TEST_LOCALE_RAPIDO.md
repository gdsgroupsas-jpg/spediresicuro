# ⚡ TEST LOCALE RAPIDO - 5 Minuti

## 🚀 Setup Veloce

### 1. Avvia Server (30 secondi)

```bash
npm run dev
```

Attendi: `✓ Ready in 2.3s` → Server attivo su `http://localhost:3000`

---

## 🧪 TEST 1: Verifica Login (1 minuto)

1. **Apri browser:** `http://localhost:3000`
2. **Vai a login:** `http://localhost:3000/login`
3. **Login con:**
   - Email: qualsiasi email esistente nel database
   - Password: la password che hai usato
   - **OPPURE** usa OAuth (Google/GitHub se configurato)

✅ **Risultato atteso:** Dashboard si carica

---

## 🧪 TEST 2: Pagina Integrazioni (2 minuti)

1. **Vai a:** `http://localhost:3000/dashboard/integrazioni`
2. **Verifica:**
   - ✅ Vedi le card delle piattaforme (Shopify, WooCommerce, Amazon, etc.)
   - ✅ Universal Widget card in alto
   - ✅ Tutte le card mostrano "Non Connesso" (badge grigio)

3. **Clicca su "WooCommerce"**
   - ✅ Dialog si apre
   - ✅ Form con 3 campi: Store URL, Consumer Key, Consumer Secret

4. **Compila form (dati fake per test):**
   ```
   Store URL: https://test-store.com
   Consumer Key: ck_test1234567890
   Consumer Secret: cs_test1234567890
   ```

5. **Clicca "Test Connessione"**
   - ✅ Mostra "Test in corso..."
   - ✅ Dopo qualche secondo mostra risultato (può fallire, è normale con dati fake)

6. **Clicca "Connetti"**
   - ✅ Mostra "Salvataggio..."
   - ✅ Dialog si chiude
   - ✅ Card WooCommerce mostra "Attivo" (badge verde pulsante)

---

## 🧪 TEST 3: Verifica Salvataggio (1 minuto)

### Opzione A: Database Locale

1. **Apri file:** `data/database.json`
2. **Cerca il tuo utente** (per email)
3. **Verifica campo `integrazioni`:**
   ```json
   "integrazioni": [
     {
       "platform": "woocommerce",
       "credentials": {
         "store_url": "https://test-store.com",
         "api_key": "ck_test1234567890",
         "api_secret": "cs_test1234567890"
       },
       "connectedAt": "2025-01-XX...",
       "status": "active"
     }
   ]
   ```

### Opzione B: Supabase (se configurato)

1. **Vai su:** Supabase Dashboard → Table Editor → `user_integrations`
2. **Verifica:** Riga con provider = "woocommerce" e le tue credenziali

---

## ✅ Checklist Completa

- [ ] Server avviato senza errori
- [ ] Login funziona
- [ ] Pagina integrazioni si carica
- [ ] Card piattaforme visibili
- [ ] Dialog si apre al click
- [ ] Form mostra campi corretti
- [ ] Validazione funziona (prova URL invalido)
- [ ] Test connessione esegue
- [ ] Salvataggio funziona
- [ ] Badge "Attivo" appare
- [ ] Dati salvati (database locale o Supabase)

---

## 🐛 Se Qualcosa Non Funziona

### Errore: "Cannot find module"
```bash
npm install
```

### Errore: "Port 3000 already in use"
```bash
# Windows PowerShell
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Poi riavvia
npm run dev
```

### Errore: "Non autenticato"
- Verifica di essere loggato
- Controlla cookie nel browser (F12 → Application → Cookies)

### Dialog non si apre
- Apri console browser (F12)
- Cerca errori JavaScript
- Verifica che `framer-motion` sia installato

---

**Tempo totale stimato: 5 minuti** ⏱️

