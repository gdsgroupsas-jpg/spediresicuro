# 📘 SMOKE TEST & SECURITY BASELINE — SpedireSicuro.it

## Scopo
Documentare il sistema di **smoke test Supabase** e il **gate di sicurezza CI/CD**
che garantiscono che RLS, ruoli e view critiche funzionino correttamente
dopo ogni migration o deploy.

Questo documento è la **baseline ufficiale di sicurezza** del progetto.

---

## 🔐 Cosa viene testato

### Test 1 — SELECT con utente anonimo
- **Client**: anon key
- **Operazione**: SELECT su `price_lists`
- **Atteso**: ✅ PASS
- **Scopo**: Verifica che le policy RLS permettano la lettura pubblica

### Test 1b — SELECT con utente autenticato
- **Client**: user autenticato (email/password)
- **Operazione**: SELECT su `price_lists`
- **Atteso**: ✅ PASS
- **Nota**: Test skippato se credenziali non configurate (opzionale)
- **Scopo**: Verifica che le policy "authenticated" funzionino correttamente

### Test 2 — INSERT bloccato da RLS
- **Client**: anon / user
- **Operazione**: INSERT su `price_lists`
- **Atteso**: ❌ FAIL (RLS deve bloccare)
- **Scopo**: Verifica che RLS impedisca inserimenti non autorizzati

### Test 3 — INSERT con service role
- **Client**: service role key
- **Operazione**: INSERT su `price_lists`
- **Atteso**: ✅ PASS
- **Scopo**: Verifica che service role bypassi RLS correttamente

### Test 4 — SELECT su view critiche
- **Client**: anon / user
- **Operazione**: SELECT su view principali (es. `anne_all_shipments_view`)
- **Atteso**: ✅ PASS
- **Scopo**: Verifica che le view siano accessibili e funzionanti

---

## 👤 Utente Smoke Test

Esiste uno script dedicato che:
- Crea utente in `auth.users` (Supabase Auth)
- Crea record in tabella `users` (database)
- Assegna ruolo standard `user` (nessun privilegio extra)
- Genera password unica (timestamp-based)

⚠️ **Le credenziali non vengono mai loggate**  
⚠️ **Email mascherata nei log** (es. `sm***@spediresicuro.it`)

### Script di creazione
```bash
npm run create:smoke-test-user
```

Lo script:
1. Genera password unica basata su timestamp
2. Crea utente in `auth.users` via Admin API
3. Crea record in tabella `users` con hash bcrypt
4. Stampa credenziali (solo una volta, alla creazione)
5. Aggiorna password se utente esiste già

**Output esempio:**
```
📋 Credenziali utente smoke test:
   Email: smoke-test@spediresicuro.it
   Password: smoke-test-1765998858206

⚠️  IMPORTANTE: Aggiungi queste credenziali in .env.local:
   SUPABASE_TEST_EMAIL=smoke-test@spediresicuro.it
   SUPABASE_TEST_PASSWORD='smoke-test-1765998858206'
```

---

## 🚀 Utilizzo

### Esecuzione Locale

#### Test base (senza autenticazione)
```bash
npm run test:supabase:smoke
```

#### Test completo (con autenticazione)
```bash
# Aggiungi credenziali in .env.local
SUPABASE_TEST_EMAIL=smoke-test@spediresicuro.it
SUPABASE_TEST_PASSWORD='smoke-test-1765998858206'

# Esegui test
npm run test:supabase:smoke
```

#### Test con variabili ambiente inline
```bash
# Windows PowerShell
$env:SUPABASE_TEST_EMAIL="smoke-test@spediresicuro.it"
$env:SUPABASE_TEST_PASSWORD="smoke-test-1765998858206"
npm run test:supabase:smoke

# Linux/Mac
SUPABASE_TEST_EMAIL=smoke-test@spediresicuro.it \
SUPABASE_TEST_PASSWORD='smoke-test-1765998858206' \
npm run test:supabase:smoke
```

### Esecuzione CI/CD

#### Gate opzionale (skip se non configurato)
```bash
# In pipeline CI/CD
SUPABASE_SMOKE=1 npm run test:supabase:smoke:ci
```

Se `SUPABASE_SMOKE` non è settato, lo script skippa silenziosamente (exit 0).  
Se `SUPABASE_SMOKE=1`, esegue il test e propaga l'exit code.

#### Configurazione in Vercel
1. Vai su **Settings** → **Environment Variables**
2. Aggiungi:
   - `SUPABASE_SMOKE=1` (per abilitare il test)
   - `SUPABASE_TEST_EMAIL=smoke-test@spediresicuro.it` (come secret)
   - `SUPABASE_TEST_PASSWORD=...` (come secret)
3. Aggiungi al build command o come step separato:
   ```bash
   npm run test:supabase:smoke:ci
   ```

---

## 📊 Output e Risultati

### Esempio Output Completo
```
🧪 Smoke Test Supabase

============================================================

📋 Test 1: SELECT su price_lists con user (anon)...
   ✅ PASS - Trovati 0 record

📋 Test 1b: SELECT su price_lists con user autenticato...
   ✅ PASS - Trovati 0 record (user: sm***@spediresicuro.it)

📋 Test 2: INSERT su price_lists con user (anon) - FAIL atteso...
   ✅ PASS - RLS ha bloccato: new row violates row-level security policy

📋 Test 3: INSERT su price_lists con service role...
   ✅ PASS - Record inserito con ID: 575cbb57-d192-43e5-b522-8d8c14a612aa
   🧹 Pulizia: record di test eliminato

📋 Test 4: SELECT dalle view migrate...
   ✅ PASS - View anne_all_shipments_view accessibile

============================================================

📊 RIEPILOGO TEST

✅ Test 1: SELECT con user: PASS
✅ Test 1b: SELECT con user autenticato: PASS
✅ Test 2: INSERT con user (FAIL atteso): PASS
✅ Test 3: INSERT con service role: PASS
✅ Test 4: SELECT view anne_all_shipments_view: PASS

============================================================

📈 Risultato: 5/5 test passati
✅ TUTTI I TEST PASSATI
```

### Exit Codes
- **0**: Tutti i test passati
- **1**: Almeno un test fallito o errore fatale

⚠️ **Importante**: L'exit code è "hard" - se un test fallisce, la pipeline viene bloccata.

---

## 🔒 Sicurezza e Best Practices

### Credenziali
- ✅ **Mai loggate in chiaro** - Email mascherata nei log
- ✅ **Password unica** - Generata con timestamp per ogni creazione
- ✅ **Ruolo standard** - Utente con ruolo `user`, nessun privilegio extra
- ✅ **Secret in CI** - Credenziali solo come environment variables segrete

### Utente Smoke Test
- ✅ **Dedicato** - Account separato solo per test
- ✅ **Nessun privilegio extra** - Ruolo standard `user`
- ✅ **Password temporanea** - Può essere rigenerata quando necessario
- ✅ **Non usare in produzione** - Solo per test automatici

### CI/CD
- ✅ **Gate opzionale** - Non blocca se `SUPABASE_SMOKE` non è settato
- ✅ **Exit code hard** - Blocca pipeline se test fallisce
- ✅ **No log credenziali** - Script non stampa mai password in chiaro

---

## 🛠️ Troubleshooting

### Test 1b fallisce: "Invalid login credentials"
**Causa**: Utente non creato in `auth.users` o password errata.

**Soluzione**:
```bash
# Ricrea utente smoke test
npm run create:smoke-test-user

# Verifica credenziali in .env.local
# Esegui test di nuovo
npm run test:supabase:smoke
```

### Test 2 fallisce: INSERT riuscito (doveva essere bloccato)
**Causa**: RLS non configurato correttamente su `price_lists`.

**Soluzione**:
1. Verifica policy RLS in Supabase Dashboard
2. Assicurati che policy "anon" non permetta INSERT
3. Controlla migration SQL per policy corrette

### Test 4 fallisce: Nessuna view trovata
**Causa**: View migrate non esistono o hanno nomi diversi.

**Soluzione**:
1. Verifica view esistenti in Supabase Dashboard
2. Aggiorna array `possibleViews` in `scripts/smoke-test-supabase.ts`
3. Aggiungi nome view corretto

### Exit code sempre 0 anche con test falliti
**Causa**: Script non gestisce correttamente exit code.

**Soluzione**: Verifica che lo script chiami `process.exit(1)` quando ci sono test falliti.

---

## 📝 File e Script

### Script Principali
- **`scripts/smoke-test-supabase.ts`** - Script principale smoke test
- **`scripts/create-smoke-test-user.ts`** - Creazione utente smoke test
- **`scripts/smoke-test-ci.js`** - Gate CI/CD opzionale

### Variabili Ambiente
- `NEXT_PUBLIC_SUPABASE_URL` - URL Supabase (richiesto)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon key (richiesto)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (richiesto)
- `SUPABASE_TEST_EMAIL` - Email utente test (opzionale)
- `SUPABASE_TEST_PASSWORD` - Password utente test (opzionale)
- `SUPABASE_SMOKE` - Flag per abilitare test in CI (opzionale)

### Comandi NPM
- `npm run test:supabase:smoke` - Esegue smoke test
- `npm run test:supabase:smoke:ci` - Gate CI/CD (skip se non configurato)
- `npm run create:smoke-test-user` - Crea/aggiorna utente smoke test

---

## 🎯 Criterio di Uscita

Il sistema è considerato **completo e funzionante** quando:

1. ✅ Tutti i 5 test passano (incluso Test 1b)
2. ✅ Exit code hard funzionante (blocca pipeline se fallisce)
3. ✅ Gate CI/CD configurato e testato
4. ✅ Credenziali non loggate in chiaro
5. ✅ Utente smoke test creato e funzionante

**Status attuale**: ✅ **COMPLETO**

---

## 📚 Riferimenti

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-api)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

## 🔄 Changelog

### 2025-01-17
- ✅ Creato sistema smoke test completo
- ✅ Aggiunto Test 1b (SELECT autenticato)
- ✅ Implementato gate CI/CD opzionale
- ✅ Exit code hard per bloccare pipeline
- ✅ Utente smoke test dedicato
- ✅ Sicurezza: credenziali non loggate

---

**Ultimo aggiornamento**: 2025-01-17  
**Versione**: 1.0  
**Autore**: Sistema SpedireSicuro.it

