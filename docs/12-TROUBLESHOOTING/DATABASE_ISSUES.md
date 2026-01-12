# Database Issues - Troubleshooting

## Overview
Guida completa per risolvere problemi comuni del database Supabase/PostgreSQL in SpedireSicuro.

## Target Audience
- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents

## Prerequisites
- Accesso a Supabase Dashboard
- Conoscenza base SQL
- Familiarità con PostgreSQL

---

## Connection Issues

### Connection Timeout

**Problema:**
```
Error: Database connection timeout
Error: PGRST301 - Connection pool exhausted
```

**Soluzione:**

1. **Verifica stato Supabase:**
   ```bash
   npx supabase status
   ```

2. **Se locale, riavvia:**
   ```bash
   npx supabase stop
   npx supabase start
   ```

3. **Verifica environment variables:**
   ```bash
   # Verifica .env.local
   NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
   SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
   ```

4. **Verifica connection pool:**
   - Supabase Dashboard → Settings → Database
   - Connection pool: default 60 connections
   - Se esaurito, aumenta pool size o ottimizza query

---

### Connection Pool Exhausted

**Problema:**
```
PGRST301 - Connection pool exhausted
```

**Cause:**
- Troppe connessioni aperte simultaneamente
- Query lente che tengono connessioni aperte
- Connection leaks (connessioni non chiuse)

**Soluzione:**

1. **Verifica query lente:**
   ```sql
   SELECT 
     query,
     calls,
     total_time,
     mean_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 10;
   ```

2. **Ottimizza query:**
   - Aggiungi indici mancanti
   - Usa `LIMIT` per query grandi
   - Evita `SELECT *` su tabelle grandi

3. **Chiudi connessioni:**
   - Usa `try/finally` per chiudere sempre
   - Evita connessioni globali persistenti

---

## Migration Issues

### Migration Already Exists

**Problema:**
```
ERROR: relation "table_name" already exists
```

**Soluzione:**

1. **Verifica migration già applicata:**
   ```sql
   SELECT * FROM supabase_migrations.schema_migrations
   ORDER BY version DESC;
   ```

2. **Se migration già applicata:**
   - ✅ OK, significa già fatto
   - Salta questa migration

3. **Se migration parzialmente applicata:**
   - Verifica stato oggetti database
   - Applica solo parti mancanti

---

### Migration Fails

**Problema:**
```
ERROR: syntax error at or near "..."
ERROR: permission denied
```

**Soluzione:**

1. **Verifica SQL syntax:**
   - Controlla virgolette, punti e virgola
   - Verifica caratteri speciali

2. **Verifica permessi:**
   - Usa Service Role Key per migrations
   - Verifica di essere admin su Supabase

3. **Esegui sezione per sezione:**
   - Dividi migration in parti più piccole
   - Esegui e verifica ogni parte

---

### Missing Column After Migration

**Problema:**
```
Error: column "column_name" does not exist
```

**Soluzione:**

1. **Verifica migration applicata:**
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'table_name' 
   AND column_name = 'column_name';
   ```

2. **Se colonna mancante:**
   ```sql
   ALTER TABLE table_name 
   ADD COLUMN IF NOT EXISTS column_name TYPE;
   ```

3. **Verifica migration:**
   - Controlla che migration sia stata eseguita
   - Riapplica migration se necessario

---

## RLS (Row Level Security) Issues

### RLS Policy Blocks Operation

**Problema:**
```
Error: new row violates row-level security policy
Error: permission denied for table "table_name"
```

**Soluzione:**

1. **Verifica RLS abilitato:**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' 
   AND tablename = 'table_name';
   ```

2. **Verifica policy esistente:**
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'table_name';
   ```

3. **Verifica Acting Context:**
   - Usa `requireSafeAuth()` per ottenere `context.target.id`
   - Query deve filtrare per `user_id = context.target.id`

4. **Per operazioni admin:**
   - Usa `supabaseAdmin` (bypass RLS)
   - ⚠️ Solo server-side, mai client-side

**Vedi:** [Security Overview](../8-SECURITY/OVERVIEW.md) - RLS policies

---

### RLS Policy Missing

**Problema:**
```
Users can see other users' data
```

**Soluzione:**

1. **Crea policy mancante:**
   ```sql
   CREATE POLICY "tenant_isolation" ON table_name
   FOR SELECT USING (
     user_id = auth.uid()
     OR EXISTS (
       SELECT 1 FROM users
       WHERE id = auth.uid() 
       AND role IN ('admin', 'superadmin')
     )
   );
   ```

2. **Verifica tutte le tabelle:**
   ```sql
   SELECT tablename 
   FROM pg_tables 
   WHERE schemaname = 'public' 
   AND rowsecurity = false;
   ```

**Vedi:** [Security Overview](../8-SECURITY/OVERVIEW.md) - RLS setup

---

## Query Performance Issues

### Slow Queries

**Problema:**
```
Query takes > 1 second
Database timeout
```

**Soluzione:**

1. **Identifica query lente:**
   ```sql
   SELECT 
     query,
     calls,
     total_time,
     mean_time,
     max_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 10;
   ```

2. **Verifica indici:**
   ```sql
   -- Verifica indici su tabella
   SELECT 
     indexname,
     indexdef
   FROM pg_indexes
   WHERE tablename = 'table_name';
   ```

3. **Aggiungi indici mancanti:**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_table_user_id 
   ON table_name(user_id);
   
   CREATE INDEX IF NOT EXISTS idx_table_created_at 
   ON table_name(created_at);
   ```

4. **Ottimizza query:**
   - Usa `EXPLAIN ANALYZE` per vedere execution plan
   - Evita `SELECT *`, seleziona solo colonne necessarie
   - Usa `LIMIT` per query grandi

---

### Missing Indexes

**Problema:**
```
Sequential scan on large table
```

**Soluzione:**

1. **Identifica tabelle senza indici:**
   ```sql
   SELECT 
     t.tablename,
     COUNT(i.indexname) AS index_count
   FROM pg_tables t
   LEFT JOIN pg_indexes i ON t.tablename = i.tablename
   WHERE t.schemaname = 'public'
   GROUP BY t.tablename
   HAVING COUNT(i.indexname) = 0;
   ```

2. **Aggiungi indici critici:**
   ```sql
   -- Foreign keys
   CREATE INDEX idx_shipments_user_id ON shipments(user_id);
   
   -- Timestamps (per ordering)
   CREATE INDEX idx_shipments_created_at ON shipments(created_at DESC);
   
   -- Composite (per query comuni)
   CREATE INDEX idx_shipments_user_created 
   ON shipments(user_id, created_at DESC);
   ```

---

## Data Integrity Issues

### Wallet Balance Inconsistency

**Problema:**
```
Wallet balance doesn't match transactions sum
```

**Soluzione:**

1. **Verifica integrità:**
   ```sql
   SELECT 
     u.id,
     u.wallet_balance,
     COALESCE(SUM(wt.amount), 0) AS calculated_balance
   FROM users u
   LEFT JOIN wallet_transactions wt ON wt.user_id = u.id
   GROUP BY u.id, u.wallet_balance
   HAVING u.wallet_balance != COALESCE(SUM(wt.amount), 0);
   ```

2. **Se inconsistenza trovata:**
   - Verifica che tutte le transazioni siano registrate
   - Verifica che funzioni atomiche siano usate
   - Ricalcola saldo se necessario

**Vedi:** [Wallet Feature](../11-FEATURES/WALLET.md) - Wallet system

---

### Orphan Records

**Problema:**
```
Shipments without user_id
Foreign key violations
```

**Soluzione:**

1. **Identifica orphan records:**
   ```sql
   SELECT * FROM shipments 
   WHERE user_id IS NULL;
   ```

2. **Fix orphan records:**
   ```sql
   -- Se possibile, associa a utente corretto
   UPDATE shipments s
   SET user_id = u.id
   FROM users u
   WHERE s.user_id IS NULL
   AND s.email = u.email;
   ```

3. **Prevenzione:**
   - Usa `NOT NULL` constraint su foreign keys
   - Valida dati prima di inserimento
   - Usa `requireSafeAuth()` per ottenere user_id

---

## Function/RPC Issues

### Function Not Found

**Problema:**
```
Error: function "function_name" does not exist
```

**Soluzione:**

1. **Verifica funzione esiste:**
   ```sql
   SELECT 
     routine_name,
     routine_type
   FROM information_schema.routines
   WHERE routine_schema = 'public'
   AND routine_name = 'function_name';
   ```

2. **Se funzione mancante:**
   - Verifica migration applicata
   - Riapplica migration se necessario

3. **Verifica permessi:**
   ```sql
   -- Verifica SECURITY DEFINER
   SELECT 
     proname,
     prosecdef
   FROM pg_proc
   WHERE proname = 'function_name';
   ```

---

### RPC Function Error

**Problema:**
```
Error: column reference "id" is ambiguous
Error: RPC function returns error
```

**Soluzione:**

1. **Verifica parametri:**
   - Controlla che tutti i parametri richiesti siano passati
   - Verifica tipi parametri corretti

2. **Verifica column references:**
   ```sql
   -- Qualifica tutte le colonne con alias
   -- BEFORE: WHERE id = p_user_id
   -- AFTER: WHERE u.id = p_user_id
   ```

3. **Test funzione:**
   ```sql
   SELECT function_name(param1, param2);
   ```

---

## Backup & Restore

### Backup Database

**Soluzione:**

1. **Via Supabase Dashboard:**
   - Settings → Database → Backups
   - Crea backup manuale

2. **Via CLI:**
   ```bash
   npx supabase db dump -f backup.sql
   ```

---

### Restore Database

**Soluzione:**

1. **Via Supabase Dashboard:**
   - Settings → Database → Backups
   - Seleziona backup → Restore

2. **Via CLI:**
   ```bash
   npx supabase db reset
   psql -f backup.sql
   ```

**⚠️ ATTENZIONE:** Restore sovrascrive dati esistenti!

---

## Related Documentation

- [Database Architecture](../2-ARCHITECTURE/DATABASE.md) - Architettura database
- [Security Overview](../8-SECURITY/OVERVIEW.md) - RLS policies
- [Wallet Feature](../11-FEATURES/WALLET.md) - Wallet system
- [Common Issues](COMMON_ISSUES.md) - Problemi comuni generali

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0.0 | Initial version | Dev Team |

---

*Last Updated: 2026-01-12*  
*Status: 🟢 Active*  
*Maintainer: Dev Team*
