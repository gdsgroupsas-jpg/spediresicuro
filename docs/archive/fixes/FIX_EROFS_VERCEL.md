# 🔧 Fix Errore EROFS su Vercel - Utenti Demo

## 🎯 Problema

Quando provi a creare utenti su Vercel, vedi questo errore:
```json
{
  "success": false,
  "error": "EROFS: read-only file system, open '/var/task/data/database.json'"
}
```

## 🔍 Causa

Su Vercel, il file system è **read-only** (solo lettura). Il codice cerca di salvare prima in Supabase, ma se Supabase fallisce, prova a salvare in JSON, che non funziona su Vercel.

## ✅ Soluzione

Devi assicurarti che **Supabase sia configurato correttamente** su Vercel e che la **tabella `users` esista**.

### Passo 1: Verifica Variabili Supabase su Vercel

1. Vai su **Vercel Dashboard** → **Settings** → **Environment Variables**
2. Verifica che ci siano queste variabili:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Se mancano, aggiungile con i valori dal tuo progetto Supabase

### Passo 2: Verifica Tabella Users in Supabase

1. Vai su **Supabase Dashboard** → **Table Editor**
2. Verifica che esista la tabella **`users`**
3. Se non esiste, creala con questo SQL:

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

### Passo 3: Crea Utenti Manualmente in Supabase

Se l'endpoint API non funziona, crea gli utenti manualmente:

1. Vai su **Supabase Dashboard** → **Table Editor** → **users**
2. Clicca su **Insert row**
3. Crea l'utente admin:
   - `email`: `admin@spediresicuro.it`
   - `password`: `admin123`
   - `name`: `Admin`
   - `role`: `admin`
   - `id`: Lascia vuoto (si genera automaticamente) oppure usa `1`
4. Clicca **Save**
5. Ripeti per l'utente demo:
   - `email`: `demo@spediresicuro.it`
   - `password`: `demo123`
   - `name`: `Demo User`
   - `role`: `user`
   - `id`: Lascia vuoto oppure usa `2`

### Passo 4: Verifica che Funzioni

Dopo aver creato gli utenti:

1. Vai su `/login`
2. Prova a fare login con:
   - Email: `admin@spediresicuro.it`
   - Password: `admin123`
3. Dovrebbe funzionare! 🎉

---

## ❌ Se Ancora Non Funziona

### Verifica Log di Vercel

1. Vai su **Vercel Dashboard** → **Deployments** → **Logs**
2. Cerca messaggi che iniziano con `❌ [SUPABASE]`
3. Questi ti diranno esattamente cosa manca

### Errori Comuni

#### Errore: "relation 'users' does not exist"
**Causa:** La tabella `users` non esiste in Supabase

**Soluzione:** Crea la tabella con lo SQL sopra

#### Errore: "permission denied for table users"
**Causa:** La Service Role Key non ha i permessi

**Soluzione:** Verifica che `SUPABASE_SERVICE_ROLE_KEY` sia configurata correttamente su Vercel

#### Errore: "invalid input syntax for type uuid"
**Causa:** Il campo `id` nella tabella è UUID ma stai usando TEXT

**Soluzione:** Modifica lo schema della tabella o usa UUID per gli ID

---

## 📋 Checklist

Prima di considerare il problema risolto:

- [ ] Variabili Supabase configurate su Vercel
- [ ] Tabella `users` esiste in Supabase
- [ ] Utenti demo creati in Supabase (manualmente o via API)
- [ ] Login funziona con `admin@spediresicuro.it` / `admin123`

---

**Nota**: Su Vercel, **NON puoi usare il database JSON** perché il file system è read-only. Devi usare **Supabase** per salvare gli utenti.

