# 🚀 Supabase CLI - Workflow Automatico

**Obiettivo:** Eliminare caricamento manuale SQL su Supabase Dashboard

---

## ✅ Cosa Posso Fare Automaticamente

### 1. **Creare Nuove Migrazioni SQL**
```bash
# Creo automaticamente file migrazione numerato
npx supabase migration new nome_migrazione
# Esempio: npx supabase migration new fix_cron_security
```

### 2. **Applicare Migrazioni al Database Remoto**
```bash
# Applica tutte le migrazioni pendenti
npx supabase db push

# Applica migrazione specifica
npx supabase db push --include-all
```

### 3. **Leggere Log e Stato Database**
```bash
# Verifica stato connessione
npx supabase db remote commit

# Lista migrazioni applicate
npx supabase migration list

# Esegui query SQL
npx supabase db execute "SELECT * FROM shipments LIMIT 5"
```

### 4. **Fix e Verifiche Automatiche**
```bash
# Ispeziona schema tabella
npx supabase db inspect shipments

# Verifica RLS policies
npx supabase db inspect --schema public --table shipments
```

---

## 🔧 Setup Iniziale (Una Volta)

### Step 1: Login a Supabase
```bash
npx supabase login
```
Apre browser per autenticazione.

### Step 2: Link Progetto Remoto
```bash
# Trova PROJECT_REF in Supabase Dashboard > Settings > General > Reference ID
npx supabase link --project-ref YOUR_PROJECT_REF
```

**Dove trovare PROJECT_REF:**
- Vai su: https://supabase.com/dashboard
- Seleziona progetto
- Settings → General
- Copia "Reference ID" (es: `pxwmposcsvsusjxdjues`)

### Step 3: Verifica Link
```bash
npx supabase projects list
```

---

## 📝 Workflow Completo (Esempio)

### Scenario: Aggiungere nuova colonna a `shipments`

**Prima (Manuale):**
1. Creare file SQL manualmente
2. Aprire Supabase Dashboard
3. Copiare/incollare SQL
4. Eseguire manualmente
5. Verificare risultato

**Dopo (Automatico):**
```bash
# 1. Creo migrazione automaticamente
npx supabase migration new add_new_column_to_shipments

# 2. Scrivo SQL nel file creato (supabase/migrations/036_add_new_column_to_shipments.sql)
# File creato automaticamente con timestamp

# 3. Applico automaticamente al database remoto
npx supabase db push

# 4. Verifico risultato
npx supabase db inspect shipments
```

**Tempo:** 2 minuti vs 10 minuti manuali

---

## 🛠️ Comandi Utili per Me (Claude)

### Creare Migrazione
```bash
npx supabase migration new nome_descriptivo
```

### Applicare Migrazioni
```bash
npx supabase db push
```

### Verificare Schema
```bash
npx supabase db inspect table_name
```

### Eseguire Query
```bash
npx supabase db execute "SELECT column_name FROM information_schema.columns WHERE table_name='shipments'"
```

### Leggere Log
```bash
npx supabase db remote commit
npx supabase migration list
```

---

## 📋 Esempio Pratico: Fix RLS Policy

**Task:** Aggiungere policy RLS per nuova tabella

**Workflow:**
```bash
# 1. Creo migrazione
npx supabase migration new add_rls_policy_new_table

# 2. File creato: supabase/migrations/036_add_rls_policy_new_table.sql
# Scrivo SQL nel file

# 3. Applico
npx supabase db push

# 4. Verifico
npx supabase db inspect new_table
```

**Risultato:** ✅ Fix applicato automaticamente, nessun intervento manuale

---

## ⚠️ Note Importanti

### Database Remoto vs Locale
- **Remoto (Cloud):** Usa `npx supabase db push` → applica a Supabase Cloud
- **Locale (Docker):** Richiede Docker Desktop → `npx supabase start`

### Sicurezza
- Le migrazioni vengono applicate con `SUPABASE_SERVICE_ROLE_KEY`
- Verifica sempre il contenuto SQL prima di `db push`
- Usa `--dry-run` se disponibile per preview

### Backup
- Supabase Cloud ha backup automatici
- Prima di migrazioni distruttive, esporta schema:
```bash
npx supabase db dump --schema public > backup.sql
```

---

## ✅ Vantaggi Workflow Automatico

1. ✅ **Nessun copia/incolla manuale**
2. ✅ **Versionamento automatico** (file numerati)
3. ✅ **Rollback facile** (migrazioni reversibili)
4. ✅ **Verifica automatica** (CLI controlla sintassi)
5. ✅ **Storia completa** (tutte le migrazioni in `supabase/migrations/`)

---

## 🎯 Prossimi Step

1. **Link progetto** (una volta):
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

2. **Workflow automatico attivo:**
   - Creo migrazioni con `migration new`
   - Applico con `db push`
   - Verifico con `db inspect`

**Status:** ✅ Pronto per workflow automatico





