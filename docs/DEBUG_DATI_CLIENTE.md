# 🔍 Debug Salvataggio Dati Cliente

## 🎯 Problema

Il salvataggio dei dati cliente non funziona. Ecco come capire esattamente cosa sta succedendo.

## 🔍 Step 1: Controlla i Log di Vercel

1. Vai su **Vercel Dashboard** → **Deployments** → **Logs**
2. Cerca messaggi che iniziano con:
   - `🔄 [SUPABASE] Aggiornamento utente in Supabase`
   - `❌ [SUPABASE] Errore aggiornamento utente`
   - `❌ [DATI CLIENTE] Errore salvataggio`

## 🔍 Step 2: Controlla la Console del Browser

1. Apri il sito su Vercel
2. Premi **F12** per aprire la console
3. Vai su `/dashboard/dati-cliente`
4. Compila il form e clicca **Salva**
5. Cerca messaggi di errore nella console

## ❌ Errori Comuni e Soluzioni

### Errore 1: "column 'dati_cliente' does not exist"

**Causa:** Il campo `dati_cliente` non esiste nella tabella `users`.

**Soluzione:**
1. Vai su **Supabase Dashboard** → **SQL Editor**
2. Esegui questo SQL:
   ```sql
   ALTER TABLE users 
     ADD COLUMN IF NOT EXISTS dati_cliente JSONB;
   ```
3. Fai un nuovo deploy

### Errore 2: "invalid input syntax for type uuid"

**Causa:** L'ID utente è TEXT ma la tabella si aspetta UUID.

**Soluzione:**
1. Verifica che l'ID utente sia un UUID valido
2. Se la tabella usa UUID ma gli utenti hanno ID TEXT, devi convertire:
   ```sql
   -- Verifica tipo campo id
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'users' AND column_name = 'id';
   ```

### Errore 3: "permission denied for table users"

**Causa:** La Service Role Key non ha i permessi.

**Soluzione:**
1. Verifica che `SUPABASE_SERVICE_ROLE_KEY` sia configurata su Vercel
2. Verifica che la chiave sia corretta in Supabase Dashboard → Settings → API

### Errore 4: "relation 'users' does not exist"

**Causa:** La tabella `users` non esiste.

**Soluzione:**
1. Crea la tabella con lo script SQL in `scripts/verifica-schema-users.sql`
2. Oppure usa la migration in `supabase/migrations/001_complete_schema.sql`

### Errore 5: EROFS (read-only file system)

**Causa:** Il codice sta ancora cercando di scrivere nel JSON invece di Supabase.

**Soluzione:**
1. Verifica che Supabase sia configurato (variabili ambiente su Vercel)
2. Verifica che `isSupabaseConfigured()` ritorni `true`
3. Controlla i log per vedere se il codice sta usando Supabase

## ✅ Verifica Configurazione

### 1. Verifica Variabili Supabase su Vercel

Vai su **Vercel Dashboard** → **Settings** → **Environment Variables** e verifica:
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

### 2. Verifica Schema Tabella Users

Esegui questo SQL in Supabase:

```sql
-- Verifica struttura tabella
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
```

Deve includere:
- ✅ `id` (UUID o TEXT)
- ✅ `dati_cliente` (JSONB)
- ✅ `default_sender` (JSONB)
- ✅ `integrazioni` (JSONB)

### 3. Verifica Utente Esistente

Esegui questo SQL per vedere se l'utente esiste:

```sql
-- Cerca utente per email
SELECT id, email, name, role 
FROM users 
WHERE email = 'admin@spediresicuro.it';
```

## 🔧 Test Rapido

Crea un endpoint di test per verificare che Supabase funzioni:

1. Vai su `/api/test/supabase`
2. Dovresti vedere informazioni sulla connessione Supabase
3. Se ci sono errori, li vedrai chiaramente

## 📋 Checklist Debug

Prima di chiedere aiuto, verifica:

- [ ] Variabili Supabase configurate su Vercel
- [ ] Tabella `users` esiste in Supabase
- [ ] Campo `dati_cliente` esiste (tipo JSONB)
- [ ] Utente esiste in Supabase (verifica con SQL)
- [ ] Log di Vercel mostrano errori specifici
- [ ] Console browser mostra errori specifici

---

**Nota**: Dopo aver fatto le modifiche, fai sempre un nuovo deploy su Vercel per applicare le modifiche!




