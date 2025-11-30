# Setup Integrazioni - Supabase

## ⚠️ IMPORTANTE: Esegui questo SQL su Supabase

Prima di usare la pagina integrazioni, devi eseguire lo schema SQL per creare la tabella `user_integrations`.

### Passo 1: Vai su Supabase Dashboard

1. Accedi a [Supabase Dashboard](https://app.supabase.com)
2. Seleziona il tuo progetto **SPEDIRESICURO**
3. Vai su **SQL Editor** (menu laterale sinistro)

### Passo 2: Esegui lo Schema

1. Clicca su **New Query** o apri un nuovo editor SQL
2. Copia e incolla il contenuto del file `supabase/migrations/002_user_integrations.sql`
3. **IMPORTANTE**: Supabase ti mostrerà un avviso "Potential issue detected" perché lo script contiene operazioni `DROP`
4. Questo è **NORMALE e SICURO** - i DROP servono per pulire oggetti esistenti e evitare conflitti
5. Clicca **"Run this query"** (bottone giallo) per eseguire

### Passo 3: Verifica Creazione Tabella

Dopo aver eseguito lo SQL, verifica che tutto sia stato creato correttamente:

1. Vai su **Table Editor** in Supabase
2. Dovresti vedere la tabella `user_integrations` nella lista
3. Controlla che ci siano tutte le colonne:
   - `id` (UUID, Primary Key)
   - `user_id` (UUID, Foreign Key)
   - `provider` (TEXT)
   - `credentials` (JSONB)
   - `settings` (JSONB)
   - `is_active` (BOOLEAN)
   - `last_sync` (TIMESTAMP)
   - `error_log` (TEXT)
   - `created_at` (TIMESTAMP)
   - `updated_at` (TIMESTAMP)

### Passo 4: Verifica RLS e Policy

1. Vai su **Authentication** → **Policies**
2. Cerca la policy "Utenti vedono solo le loro integrazioni"
3. Verifica che sia attiva

## 🔒 Sicurezza

- **Row Level Security (RLS)**: Attiva - ogni utente vede solo le sue integrazioni
- **Credenziali**: Salvate in JSONB (in produzione, considera la crittografia)
- **Constraint UNIQUE**: Un utente può avere solo un account per provider

## 📝 Note Tecniche

- **Per ora** le Server Actions usano il database JSON locale come fallback
- Quando Supabase è configurato, le Server Actions useranno automaticamente la tabella `user_integrations`
- Le credenziali sono salvate in formato JSONB per flessibilità tra provider diversi
- Il trigger `update_user_integrations_modtime` aggiorna automaticamente `updated_at` ad ogni modifica

## 🐛 Risoluzione Problemi

### Errore: "relation already exists"
- Lo script usa `CREATE TABLE IF NOT EXISTS`, quindi è sicuro eseguirlo più volte
- Se vedi questo errore, significa che la tabella esiste già - va bene!

### Errore: "policy already exists"
- Lo script fa `DROP POLICY IF EXISTS` prima di creare, quindi non dovresti vedere questo errore
- Se lo vedi, esegui manualmente: `DROP POLICY IF EXISTS "Utenti vedono solo le loro integrazioni" ON public.user_integrations;`

### Avviso Supabase: "Potential issue detected"
- **È NORMALE!** Supabase avvisa per operazioni `DROP` come protezione
- I DROP nello script sono sicuri perché usano `IF EXISTS`
- Clicca **"Run this query"** per procedere
