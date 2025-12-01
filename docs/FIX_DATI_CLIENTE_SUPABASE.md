# 🔧 Fix Salvataggio Dati Cliente in Supabase

## 🎯 Problema

Quando provi a salvare i dati cliente, vedi questo errore:
```
EROFS: read-only file system, open '/var/task/data/database.json'
```

## 🔍 Causa

Su Vercel, il file system è **read-only** (solo lettura). Il codice ora salva prima in Supabase, ma la tabella `users` potrebbe non avere il campo `dati_cliente`.

## ✅ Soluzione

### Passo 1: Verifica Schema Tabella Users

1. Vai su **Supabase Dashboard** → **Table Editor** → **users**
2. Verifica se esiste il campo `dati_cliente`

### Passo 2: Aggiungi Campo dati_cliente

Se il campo non esiste, esegui questo SQL in **Supabase Dashboard** → **SQL Editor**:

```sql
-- Aggiungi campo dati_cliente alla tabella users
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS dati_cliente JSONB;

-- Aggiungi anche default_sender se non esiste (per mittente predefinito)
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS default_sender JSONB;

-- Aggiungi campo integrazioni se non esiste (per integrazioni e-commerce)
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS integrazioni JSONB;
```

### Passo 3: Verifica Schema Completo

Esegui questo SQL per verificare che tutti i campi siano presenti:

```sql
-- Verifica struttura tabella users
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
```

Dovresti vedere questi campi:
- ✅ `id` (UUID)
- ✅ `email` (TEXT)
- ✅ `password` (TEXT)
- ✅ `name` (TEXT)
- ✅ `role` (TEXT)
- ✅ `provider` (TEXT)
- ✅ `provider_id` (TEXT)
- ✅ `image` (TEXT)
- ✅ `dati_cliente` (JSONB) ← **IMPORTANTE per salvare dati cliente**
- ✅ `default_sender` (JSONB) ← Per mittente predefinito
- ✅ `integrazioni` (JSONB) ← Per integrazioni e-commerce
- ✅ `created_at` (TIMESTAMPTZ)
- ✅ `updated_at` (TIMESTAMPTZ)

## ✅ Verifica che Funzioni

Dopo aver aggiunto il campo:

1. Vai su `/dashboard/dati-cliente`
2. Compila il form con i dati cliente
3. Clicca su **Salva**
4. Dovrebbe funzionare senza errori! 🎉

## ❌ Se Ancora Non Funziona

### Verifica Log di Vercel

1. Vai su **Vercel Dashboard** → **Deployments** → **Logs**
2. Cerca messaggi che iniziano con `❌ [SUPABASE]`
3. Questi ti diranno esattamente cosa manca

### Errori Comuni

#### Errore: "column 'dati_cliente' does not exist"
**Causa:** Il campo non esiste nella tabella

**Soluzione:** Esegui lo SQL sopra per aggiungere il campo

#### Errore: "invalid input syntax for type jsonb"
**Causa:** I dati non sono in formato JSON valido

**Soluzione:** Il codice gestisce automaticamente la conversione, ma verifica che i dati siano validi

#### Errore: "permission denied for table users"
**Causa:** La Service Role Key non ha i permessi

**Soluzione:** Verifica che `SUPABASE_SERVICE_ROLE_KEY` sia configurata correttamente su Vercel

---

## 📋 Checklist

Prima di considerare il problema risolto:

- [ ] Campo `dati_cliente` esiste nella tabella `users` (tipo JSONB)
- [ ] Campo `default_sender` esiste nella tabella `users` (tipo JSONB)
- [ ] Campo `integrazioni` esiste nella tabella `users` (tipo JSONB)
- [ ] Variabili Supabase configurate su Vercel
- [ ] Il salvataggio dati cliente funziona senza errori

---

**Nota**: Ho aggiornato il codice per salvare automaticamente in Supabase quando disponibile. Ora devi solo assicurarti che la tabella abbia i campi necessari!

