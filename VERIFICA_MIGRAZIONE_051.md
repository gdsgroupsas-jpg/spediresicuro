# 🔍 Verifica Migrazione 051 - reseller_role

## Come Verificare che la Migrazione sia Applicata

### Opzione 1: Supabase Dashboard
1. Vai su https://supabase.com/dashboard
2. Seleziona il progetto SpedireSicuro
3. Vai a **Database** → **Migrations**
4. Cerca migrazione `051_add_reseller_role.sql`
5. Verifica che sia **Applied** (stato verde)

### Opzione 2: SQL Query Diretta
```sql
-- Verifica che la colonna esista
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name = 'reseller_role';

-- Risultato atteso:
-- column_name: reseller_role
-- data_type: text
-- is_nullable: YES
-- column_default: NULL
```

### Opzione 3: Verifica Indice
```sql
-- Verifica che l'indice esista
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users'
  AND indexname = 'idx_users_reseller_role';

-- Risultato atteso:
-- indexname: idx_users_reseller_role
```

## Se la Migrazione NON è Applicata

### Applica Manualmente
1. Vai su Supabase Dashboard → **SQL Editor**
2. Copia il contenuto di `supabase/migrations/051_add_reseller_role.sql`
3. Esegui la query
4. Verifica con le query sopra

### Oppure via Supabase CLI
```bash
supabase db push
```

---

**IMPORTANTE**: La migrazione deve essere applicata PRIMA di testare la feature.

