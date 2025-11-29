# ✅ Test Dopo Configurazione .env.local

**Hai modificato .env.local? Ecco cosa fare ora!**

---

## 🔄 Step 1: Riavvia il Server

**IMPORTANTE:** Dopo aver modificato `.env.local`, devi riavviare il server!

```bash
# Ferma il server (Ctrl+C se è in esecuzione)
# Poi riavvia:
npm run dev
```

---

## ✅ Step 2: Verifica Configurazione

### Verifica Console Server

Quando avvii `npm run dev`, controlla la console per:

**✅ Se vedi:**
- Nessun warning su Supabase
- Server avviato su http://localhost:3000

**❌ Se vedi:**
- `⚠️ Supabase URL o Anon Key non configurati`
- → Le variabili Supabase non sono state configurate correttamente

---

## 🗄️ Step 3: Verifica Tabella Supabase

Prima di testare l'autocomplete, assicurati che la tabella esista:

1. **Vai su Supabase Dashboard**
2. **Clicca su "Database"** nella sidebar
3. **Clicca su "Tables"**
4. **Verifica che esista la tabella `geo_locations`**

**Se NON esiste:**
- Vai su **SQL Editor**
- Copia il codice da `ISTRUZIONI_SUPABASE_PASSO_PASSO.md`
- Esegui il codice SQL

---

## 🧪 Step 4: Test Autocomplete Città

1. **Vai su:** http://localhost:3000/dashboard/spedizioni/nuova
2. **Se non sei loggato:** Fai login prima
3. **Nel campo "CITTÀ, PROVINCIA, CAP":**
   - Digita "Roma"
   - Dovrebbe mostrare risultati
   - **NON** dovrebbe mostrare "Errore di connessione. Riprova."

**✅ Se funziona:**
- Vedi risultati come "Roma (RM) - 00100, 00118..."
- Autocomplete funzionante!

**❌ Se NON funziona:**
- Vedi "Errore di connessione. Riprova."
- Controlla console browser (F12) per errori
- Controlla console server per errori

---

## 🔐 Step 5: Test OAuth Google

1. **Vai su:** http://localhost:3000/login
2. **Clicca "Accedi con Google"**
3. **Dovrebbe:**
   - Reindirizzare a Google per login
   - Permettere di selezionare account
   - Tornare all'app dopo login

**✅ Se funziona:**
- Login Google funzionante!

**❌ Se NON funziona:**
- Verifica che callback URL sia configurato in Google Console:
  - `http://localhost:3000/api/auth/callback/google`
- Controlla console browser per errori

---

## 🐛 Troubleshooting

### Errore: "Errore di connessione. Riprova."

**Possibili cause:**
1. Variabili Supabase non configurate correttamente
2. Tabella `geo_locations` non esiste
3. Database Supabase non accessibile

**Soluzione:**
1. Verifica `.env.local` ha valori reali (non "your-project")
2. Verifica tabella esiste in Supabase
3. Controlla console server per errori specifici

### Errore: "OAuth Google non funziona"

**Possibili cause:**
1. Callback URL non configurato in Google Console
2. `NEXTAUTH_URL` non è `http://localhost:3000`
3. Server non riavviato dopo modifiche

**Soluzione:**
1. Verifica Google Console ha callback: `http://localhost:3000/api/auth/callback/google`
2. Verifica `.env.local` ha `NEXTAUTH_URL=http://localhost:3000`
3. Riavvia server

---

## ✅ Checklist Finale

- [ ] Server riavviato dopo modifiche `.env.local`
- [ ] Nessun warning in console server
- [ ] Tabella `geo_locations` esiste in Supabase
- [ ] Autocomplete città funziona (digita "Roma" → vedi risultati)
- [ ] Login Google funziona (clicca "Accedi con Google" → funziona)

---

**Dopo aver riavviato il server, testa l'autocomplete!** 🚀

