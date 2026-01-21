# 🔍 Verifica e Crea Utenti Demo in Supabase

## 🎯 Obiettivo

Verificare che gli utenti demo esistano in Supabase e crearli se mancano.

## ✅ Metodo 1: Usa l'Endpoint API (PIÙ SEMPLICE)

### Passo 1: Verifica Utenti Esistenti

1. **Apri il browser** e vai su:

   ```
   http://localhost:3000/api/test/create-admin-user
   ```

   (se sei in locale) oppure

   ```
   https://spediresicuro.vercel.app/api/test/create-admin-user
   ```

   (se sei su Vercel)

2. **Dovresti vedere** un JSON con queste informazioni:
   ```json
   {
     "success": true,
     "supabaseConfigured": true,
     "supabaseTest": { "success": true },
     "existingUser": {
       "id": "...",
       "email": "admin@spediresicuro.it",
       "name": "Admin",
       "role": "admin"
     },
     "message": "Utente admin già esistente"
   }
   ```

### Passo 2: Crea Utenti Se Mancano

Se vedi `"existingUser": null`, significa che gli utenti non esistono. Per crearli:

1. **Apri un terminale** o usa **Postman/Thunder Client**
2. **Fai una richiesta POST** a:

   ```
   POST http://localhost:3000/api/test/create-admin-user
   ```

   oppure

   ```
   POST https://spediresicuro.vercel.app/api/test/create-admin-user
   ```

3. **Dovresti ricevere** una risposta tipo:
   ```json
   {
     "success": true,
     "message": "Inizializzazione completata: 2 utenti creati, 0 già esistenti",
     "adminUser": {
       "id": "...",
       "email": "admin@spediresicuro.it",
       "name": "Admin",
       "role": "admin"
     },
     "stats": {
       "created": 2,
       "skipped": 0
     }
   }
   ```

### Usa cURL (se hai cURL installato)

```bash
# Verifica
curl http://localhost:3000/api/test/create-admin-user

# Crea utenti
curl -X POST http://localhost:3000/api/test/create-admin-user
```

---

## ✅ Metodo 2: Verifica Manualmente in Supabase Dashboard

### Passo 1: Accedi a Supabase

1. Vai su: https://supabase.com/dashboard
2. Seleziona il tuo progetto

### Passo 2: Vai alla Tabella Users

1. Menu laterale → **Table Editor**
2. Clicca su **users**

### Passo 3: Verifica Utenti

Cerca questi utenti nella tabella:

1. **Admin:**
   - Email: `admin@spediresicuro.it`
   - Password: `admin123`
   - Role: `admin`

2. **Demo:**
   - Email: `demo@spediresicuro.it`
   - Password: `demo123`
   - Role: `user`

### Passo 4: Crea Manualmente Se Mancano

Se gli utenti non esistono, puoi crearli manualmente:

1. Clicca su **Insert row** (o **Aggiungi riga**)
2. Compila i campi:
   - `email`: `admin@spediresicuro.it`
   - `password`: `admin123`
   - `name`: `Admin`
   - `role`: `admin`
   - `created_at`: (lascia vuoto, si crea automaticamente)
   - `updated_at`: (lascia vuoto, si crea automaticamente)
3. Clicca **Save**

Ripeti per l'utente demo con:

- `email`: `demo@spediresicuro.it`
- `password`: `demo123`
- `name`: `Demo User`
- `role`: `user`

---

## ✅ Metodo 3: Usa lo Script (Avanzato)

Se hai Node.js installato e vuoi usare lo script:

1. **Apri un terminale** nella cartella del progetto
2. **Esegui:**
   ```bash
   npx ts-node --project tsconfig.scripts.json scripts/verifica-crea-utenti-supabase.ts
   ```

Lo script ti dirà:

- ✅ Se Supabase è configurato
- ✅ Se la connessione funziona
- ✅ Quali utenti esistono
- ✅ Quali utenti sono stati creati

---

## ❌ Problemi Comuni

### Problema 1: "Supabase non è configurato"

**Causa:** Le variabili d'ambiente Supabase non sono configurate.

**Soluzione:**

1. Verifica che nel file `env.local` ci siano:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
   ```
2. Su Vercel, verifica che le stesse variabili siano configurate

### Problema 2: "La tabella users non esiste"

**Causa:** La tabella `users` non è stata creata in Supabase.

**Soluzione:**

1. Vai su Supabase Dashboard → **SQL Editor**
2. Esegui questo SQL per creare la tabella:
   ```sql
   CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY,
     email TEXT UNIQUE NOT NULL,
     password TEXT,
     name TEXT NOT NULL,
     role TEXT NOT NULL DEFAULT 'user',
     provider TEXT,
     provider_id TEXT,
     image TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

### Problema 3: "Service Role Key non ha i permessi"

**Causa:** La Service Role Key non può scrivere nella tabella.

**Soluzione:**

1. Verifica che la variabile `SUPABASE_SERVICE_ROLE_KEY` sia configurata correttamente
2. La Service Role Key bypassa Row Level Security, quindi dovrebbe funzionare
3. Se non funziona, verifica che la chiave sia corretta in Supabase Dashboard → Settings → API

### Problema 4: "Email già registrata" ma l'utente non esiste

**Causa:** Potrebbe esserci un problema con la ricerca o con i dati.

**Soluzione:**

1. Verifica manualmente in Supabase Dashboard se l'utente esiste
2. Se esiste ma ha dati diversi, aggiornalo manualmente
3. Se non esiste, prova a crearlo manualmente o con l'endpoint API

---

## ✅ Verifica Finale

Dopo aver creato gli utenti, verifica che il login funzioni:

1. Vai su `/login`
2. Prova a fare login con:
   - Email: `admin@spediresicuro.it`
   - Password: `admin123`
3. Dovrebbe funzionare! 🎉

---

## 📋 Checklist

Prima di considerare il problema risolto:

- [ ] Supabase è configurato (variabili d'ambiente presenti)
- [ ] La tabella `users` esiste in Supabase
- [ ] L'utente `admin@spediresicuro.it` esiste in Supabase
- [ ] L'utente `demo@spediresicuro.it` esiste in Supabase
- [ ] Il login con `admin@spediresicuro.it` / `admin123` funziona
- [ ] Il login con `demo@spediresicuro.it` / `demo123` funziona

---

**Ultimo aggiornamento:** Guida per verificare e creare utenti demo in Supabase.
