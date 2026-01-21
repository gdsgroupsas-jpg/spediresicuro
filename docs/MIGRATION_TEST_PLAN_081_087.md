# 🧪 Migration Test Plan - 081-087

**Enterprise Hardening - Fase 1-2: Capability Flags + tenant_id**

---

## ⚠️ IMPORTANTE

**Le migrazioni NON sono state ancora eseguite sul database!**

Questo documento descrive come testare ed eseguire le migrazioni prima del merge.

---

## 📋 Migrazioni da Testare

1. **081_account_capabilities_table.sql** - Tabella capability
2. **082_has_capability_function.sql** - Funzione helper
3. **083_populate_capabilities_from_roles.sql** - Popolazione dati
4. **084_add_tenant_id_to_users.sql** - Campo tenant_id
5. **085_get_user_tenant_function.sql** - Funzione helper tenant
6. **086_populate_tenant_id_from_parent.sql** - Popolazione tenant_id
7. **087_update_rls_users_tenant_id.sql** - Aggiornamento RLS

---

## 🧪 Test Plan

### Fase 1: Test Locale (Supabase CLI)

```bash
# 1. Verifica Supabase CLI installato
npx supabase --version

# 2. Link al progetto (se non già fatto)
npx supabase link --project-ref [PROJECT_REF]

# 3. Test migrazioni su database locale/staging
npx supabase db reset  # Applica tutte le migrazioni da zero

# 4. Verifica sintassi SQL
npx supabase migration list
```

### Fase 2: Test Sintassi SQL

```bash
# Verifica che i file SQL siano validi
# (Esegui manualmente su Supabase Dashboard SQL Editor)
```

### Fase 3: Test Idempotenza

```sql
-- Esegui ogni migrazione DUE volte per verificare idempotenza
-- Dovrebbero tutte usare IF NOT EXISTS / IF EXISTS
```

### Fase 4: Verifica Post-Migrazione

```sql
-- Esegui script di verifica
\i scripts/test-migrations-081-087.sql

-- Oppure via Supabase Dashboard:
-- Copia e incolla contenuto di scripts/test-migrations-081-087.sql
```

---

## 🚀 Esecuzione Migrazioni

### Opzione 1: Supabase Dashboard (Consigliato per Test)

1. Vai su [Supabase Dashboard](https://app.supabase.com)
2. Seleziona progetto
3. Vai su **SQL Editor**
4. Esegui migrazioni in ordine:
   - `081_account_capabilities_table.sql`
   - `082_has_capability_function.sql`
   - `083_populate_capabilities_from_roles.sql`
   - `084_add_tenant_id_to_users.sql`
   - `085_get_user_tenant_function.sql`
   - `086_populate_tenant_id_from_parent.sql`
   - `087_update_rls_users_tenant_id.sql`
5. Esegui script verifica: `scripts/test-migrations-081-087.sql`

### Opzione 2: Supabase CLI

```bash
# Push migrazioni a staging
npx supabase db push

# Verifica applicate
npx supabase migration list
```

### Opzione 3: Script Automatico (da implementare)

```bash
# TODO: Creare script che esegue tutte le migrazioni in sequenza
npm run migrate:081-087
```

---

## ✅ Checklist Pre-Produzione

- [ ] **Test locale eseguito** (`npx supabase db reset`)
- [ ] **Sintassi SQL verificata** (nessun errore)
- [ ] **Idempotenza testata** (eseguite 2 volte)
- [ ] **Script verifica eseguito** (tutti i check passano)
- [ ] **Regression test passati** (codice TypeScript funziona)
- [ ] **Backup database** (se produzione)
- [ ] **Test su staging** (se disponibile)

---

## 🔍 Verifica Post-Migrazione

### Query di Verifica

```sql
-- 1. Verifica tabella account_capabilities
SELECT COUNT(*) FROM account_capabilities WHERE revoked_at IS NULL;

-- 2. Verifica funzione has_capability
SELECT has_capability('user-id', 'can_manage_pricing');

-- 3. Verifica campo tenant_id
SELECT COUNT(*) FROM users WHERE tenant_id IS NOT NULL;

-- 4. Verifica funzione get_user_tenant
SELECT get_user_tenant('user-id');

-- 5. Verifica RLS policy
SELECT * FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_select_reseller';
```

---

## ⚠️ Rollback (se necessario)

Le migrazioni sono **non breaking** e usano `IF NOT EXISTS`, quindi:

- Possono essere eseguite più volte senza problemi
- Non rimuovono dati esistenti
- Mantengono fallback a `parent_id` e `role`

**Rollback manuale** (solo se necessario):

```sql
-- Rimuovi campo tenant_id (solo se necessario)
ALTER TABLE users DROP COLUMN IF EXISTS tenant_id;

-- Rimuovi tabella capability (solo se necessario)
DROP TABLE IF EXISTS account_capabilities;

-- Rimuovi funzioni (solo se necessario)
DROP FUNCTION IF EXISTS has_capability(UUID, TEXT);
DROP FUNCTION IF EXISTS get_user_tenant(UUID);
```

---

## 📝 Note

- **Non breaking**: Tutte le migrazioni mantengono compatibilità
- **Idempotenti**: Possono essere eseguite più volte
- **Fallback attivo**: `parent_id` e `role` continuano a funzionare
- **Test obbligatori**: Eseguire PRIMA del merge in master

---

**Status:** ⚠️ **MIGRAZIONI NON ANCORA ESEGUITE - TEST OBBLIGATORI PRIMA DEL MERGE**
