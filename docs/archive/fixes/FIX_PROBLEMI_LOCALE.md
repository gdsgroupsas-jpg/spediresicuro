# 🔧 Fix Problemi in Locale - Guida Rapida

## 🎯 Problemi Comuni e Soluzioni

### ❌ Problema 1: Server non parte

**Sintomi:**
- `npm run dev` non funziona
- Errori di compilazione TypeScript
- Porta 3000 già in uso

**Soluzioni:**

```bash
# 1. Verifica che la porta 3000 non sia occupata
netstat -ano | findstr :3000

# 2. Se occupata, termina il processo o usa un'altra porta
# Modifica package.json o usa:
PORT=3001 npm run dev

# 3. Pulisci cache e reinstalla
rm -rf .next node_modules
npm install
npm run dev
```

---

### ❌ Problema 2: Login non funziona

**Sintomi:**
- Errore "Credenziali non valide"
- Redirect a `/login` dopo il login
- Sessione non riconosciuta

**Soluzioni:**

#### 2.1 Verifica Variabili d'Ambiente

```bash
# Verifica che .env.local esista e contenga:
NEXT_PUBLIC_SUPABASE_URL=https://tuo-progetto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXTAUTH_SECRET=una-stringa-casuale-lunga
NEXTAUTH_URL=http://localhost:3000
```

#### 2.2 Verifica Utente Test nel Database

```bash
# Esegui lo script per creare/verificare l'utente test
node scripts/create-test-reseller.js
```

#### 2.3 Verifica Password Hash

Se l'utente esiste ma il login non funziona, potrebbe essere un problema di hash password:

```bash
# Verifica che la password sia hashata correttamente
# Lo script create-test-reseller.js lo fa automaticamente
```

#### 2.4 Riavvia il Server

Dopo aver modificato `.env.local`, **DEVI riavviare il server**:

```bash
# Ctrl+C per fermare
# Poi:
npm run dev
```

---

### ❌ Problema 3: Redirect a dati-cliente dopo login

**Sintomi:**
- Dopo il login, vieni reindirizzato a `/dashboard/dati-cliente`
- Anche per l'utente test

**Soluzioni:**

#### 3.1 Verifica Email Utente

Assicurati che l'email sia esattamente `test@spediresicuro.it` (minuscolo):

```bash
# Verifica nel database
# Lo script create-test-reseller.js usa già toLowerCase()
```

#### 3.2 Verifica Modifiche al Codice

Le modifiche che abbiamo fatto dovrebbero:
- ✅ Saltare la validazione per `test@spediresicuro.it`
- ✅ Non reindirizzare a dati-cliente per `test@spediresicuro.it`

**Verifica che le modifiche siano presenti:**

1. `app/api/user/dati-cliente/route.ts` - linea ~100
2. `app/dashboard/dati-cliente/page.tsx` - linea ~212
3. `app/dashboard/page.tsx` - linea ~220
4. `app/login/page.tsx` - linea ~219

#### 3.3 Pulisci localStorage

Apri la console del browser (F12) e esegui:

```javascript
// Pulisci localStorage
localStorage.clear();

// Oppure solo per l'utente test
localStorage.removeItem('datiCompletati_test@spediresicuro.it');
```

Poi fai logout e login di nuovo.

---

### ❌ Problema 4: Errori TypeScript/Compilazione

**Sintomi:**
- Errori durante `npm run dev`
- File non trovati
- Errori di tipo

**Soluzioni:**

```bash
# 1. Verifica che tutti i file siano presenti
# 2. Pulisci e ricompila
rm -rf .next
npm run dev

# 3. Se persistono errori, verifica i file modificati
# Controlla che non ci siano errori di sintassi
```

---

### ❌ Problema 5: Database Supabase non raggiungibile

**Sintomi:**
- Errori "Supabase non configurato"
- Errori di connessione
- Timeout

**Soluzioni:**

1. **Verifica variabili d'ambiente:**
   ```bash
   # In .env.local
   NEXT_PUBLIC_SUPABASE_URL=https://tuo-progetto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   ```

2. **Verifica che Supabase sia online:**
   - Vai su https://supabase.com/dashboard
   - Verifica che il progetto sia attivo

3. **Verifica RLS (Row Level Security):**
   - Se RLS è attivo, potrebbe bloccare le query
   - Per test, potresti dover disabilitare temporaneamente RLS

---

## 🔍 Debug Step-by-Step

### Step 1: Verifica Configurazione Base

```bash
# 1. Verifica .env.local
cat .env.local | grep -E "SUPABASE|NEXTAUTH"

# 2. Verifica che il server parta
npm run dev

# 3. Apri http://localhost:3000
# Dovresti vedere la homepage
```

### Step 2: Test Login Utente Test

```bash
# 1. Vai su http://localhost:3000/login
# 2. Inserisci:
#    Email: test@spediresicuro.it
#    Password: test123
# 3. Clicca "Accedi"
# 4. Dovresti essere reindirizzato a /dashboard
# 5. NON dovresti essere reindirizzato a /dashboard/dati-cliente
```

### Step 3: Verifica Log Console

Apri la console del browser (F12) e cerca:

```
✅ [LOGIN] Login riuscito
✅ [DASHBOARD] Utente test rilevato, salvo flag e NON reindirizzo a dati-cliente
```

Se vedi questi messaggi, tutto funziona!

---

## 🚨 Se Niente Funziona

### Reset Completo

```bash
# 1. Ferma il server (Ctrl+C)

# 2. Pulisci tutto
rm -rf .next node_modules package-lock.json

# 3. Reinstalla
npm install

# 4. Verifica .env.local
# Assicurati che tutte le variabili siano presenti

# 5. Ricrea utente test
node scripts/create-test-reseller.js

# 6. Riavvia
npm run dev
```

---

## 📋 Checklist Finale

Prima di dire che non funziona, verifica:

- [ ] `.env.local` esiste e contiene tutte le variabili
- [ ] Server parte senza errori (`npm run dev`)
- [ ] Utente test esiste nel database (verifica con script)
- [ ] Email utente test è esattamente `test@spediresicuro.it` (minuscolo)
- [ ] Password utente test è `test123`
- [ ] Server è stato riavviato dopo modifiche a `.env.local`
- [ ] localStorage è stato pulito (se necessario)
- [ ] Console browser non mostra errori (F12)
- [ ] Console server non mostra errori

---

## 💡 Suggerimenti

1. **Sempre riavvia il server** dopo modifiche a `.env.local`
2. **Pulisci localStorage** se vedi comportamenti strani
3. **Controlla la console** del browser per errori JavaScript
4. **Controlla la console** del server per errori backend
5. **Verifica i log** con prefisso `[LOGIN]` o `[DASHBOARD]`

---

**Se il problema persiste, descrivi:**
- Cosa stai facendo esattamente
- Quale errore vedi (screenshot o testo)
- Cosa vedi nella console del browser
- Cosa vedi nella console del server


