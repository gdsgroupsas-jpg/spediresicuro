# 🔍 Verifica Schema Tabella Users in Supabase

## 🎯 Problema

Quando provi a salvare una registrazione, ci sono errori perché lo schema della tabella `users` in Supabase non corrisponde a quello che il codice si aspetta.

## 📋 Schema Atteso dal Codice

Il codice cerca di inserire questi campi nella tabella `users`:

```typescript
{
  email: string,           // TEXT UNIQUE NOT NULL
  password: string | null, // TEXT (null per OAuth)
  name: string,            // TEXT NOT NULL
  role: string,            // TEXT (default 'user')
  provider: string,        // TEXT (default 'credentials')
  provider_id: string | null, // TEXT
  image: string | null     // TEXT
}
```

**Nota:** Il codice NON passa l'`id` perché Supabase lo genera automaticamente.

## ✅ Schema Corretto per Supabase

La tabella `users` dovrebbe avere questa struttura:

### Opzione 1: Schema Semplice (Consigliato)

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT, -- Hash bcrypt (null per OAuth)
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'user' o 'admin'
  provider TEXT DEFAULT 'credentials', -- 'credentials', 'google', 'github', 'facebook'
  provider_id TEXT, -- ID dal provider OAuth
  image TEXT, -- Avatar URL
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
```

### Opzione 2: Schema Completo (con ENUM)

Se vuoi usare ENUM (più sicuro ma più complesso):

```sql
-- Crea ENUM per role
CREATE TYPE user_role AS ENUM ('user', 'admin');

-- Crea ENUM per provider
CREATE TYPE auth_provider AS ENUM ('credentials', 'google', 'github', 'facebook');

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  provider auth_provider DEFAULT 'credentials',
  provider_id TEXT,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🔧 Come Verificare e Correggere

### Passo 1: Verifica Schema Attuale

1. Vai su **Supabase Dashboard** → **Table Editor** → **users**
2. Clicca su **View structure** o **Schema**
3. Verifica quali colonne esistono

### Passo 2: Verifica Campi Obbligatori

Assicurati che esistano questi campi:

- ✅ `id` (UUID, PRIMARY KEY, auto-generato)
- ✅ `email` (TEXT, UNIQUE, NOT NULL)
- ✅ `password` (TEXT, nullable)
- ✅ `name` (TEXT, NOT NULL)
- ✅ `role` (TEXT o ENUM, default 'user')
- ✅ `provider` (TEXT o ENUM, default 'credentials')
- ✅ `provider_id` (TEXT, nullable)
- ✅ `image` (TEXT, nullable)
- ✅ `created_at` (TIMESTAMPTZ, default NOW())
- ✅ `updated_at` (TIMESTAMPTZ, default NOW())

### Passo 3: Correggi Schema se Necessario

Se mancano campi o hanno il tipo sbagliato, esegui questo SQL in **Supabase Dashboard** → **SQL Editor**:

```sql
-- Aggiungi campi mancanti (se non esistono)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE NOT NULL,
  ADD COLUMN IF NOT EXISTS password TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'credentials',
  ADD COLUMN IF NOT EXISTS provider_id TEXT,
  ADD COLUMN IF NOT EXISTS image TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Crea indici se non esistono
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
```

### Passo 4: Se la Tabella Non Esiste

Se la tabella `users` non esiste, creala con questo SQL:

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  provider TEXT DEFAULT 'credentials',
  provider_id TEXT,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

## ❌ Problemi Comuni

### Problema 1: "column 'id' does not exist"

**Causa:** La tabella non ha il campo `id` o ha un tipo diverso.

**Soluzione:**

```sql
-- Se la tabella esiste ma manca id
ALTER TABLE users ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- Se id esiste ma è TEXT invece di UUID
ALTER TABLE users ALTER COLUMN id TYPE UUID USING id::uuid;
```

### Problema 2: "column 'role' does not exist"

**Causa:** Il campo `role` non esiste.

**Soluzione:**

```sql
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
```

### Problema 3: "invalid input syntax for type uuid"

**Causa:** Il campo `id` è UUID ma stai cercando di inserire TEXT.

**Soluzione:** Il codice NON deve passare l'id - Supabase lo genera automaticamente. Verifica che il codice non passi l'id.

### Problema 4: "null value in column 'name' violates not-null constraint"

**Causa:** Il campo `name` è NOT NULL ma non viene passato.

**Soluzione:** Verifica che il codice passi sempre `name` quando crea un utente.

## ✅ Verifica Finale

Dopo aver corretto lo schema:

1. Prova a registrare un nuovo utente
2. Controlla i log di Vercel per errori
3. Verifica in Supabase Dashboard che l'utente sia stato creato

## 📋 Checklist

Prima di considerare il problema risolto:

- [ ] Tabella `users` esiste in Supabase
- [ ] Campo `id` è UUID e auto-generato
- [ ] Campo `email` è TEXT UNIQUE NOT NULL
- [ ] Campo `password` è TEXT (nullable)
- [ ] Campo `name` è TEXT NOT NULL
- [ ] Campo `role` è TEXT (default 'user')
- [ ] Campo `provider` è TEXT (default 'credentials')
- [ ] Campo `provider_id` è TEXT (nullable)
- [ ] Campo `image` è TEXT (nullable)
- [ ] Campi `created_at` e `updated_at` esistono
- [ ] Indici su `email` e `role` esistono
- [ ] La registrazione funziona senza errori

---

**Nota**: Se usi ENUM invece di TEXT, devi prima creare i tipi ENUM e poi modificare la tabella. Lo schema semplice con TEXT è più flessibile e più facile da gestire.
