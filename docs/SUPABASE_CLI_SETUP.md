# 🔧 Setup Supabase CLI e Verifica Schema

## 📦 Installazione Supabase CLI

### Opzione 1: npm (consigliato)

```bash
npm install --save-dev supabase
```

### Opzione 2: Scoop (Windows)

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Opzione 3: Download Binario

1. Vai su: https://github.com/supabase/cli/releases
2. Scarica il binario per Windows
3. Aggiungi al PATH

### Opzione 4: npm globale

```bash
npm install -g supabase
```

---

## 🔐 Login e Link Progetto

```bash
# Login a Supabase
supabase login

# Link al progetto remoto (usa URL e service_role_key)
supabase link --project-ref YOUR_PROJECT_REF
```

**Dove trovare PROJECT_REF**:

- Vai su Supabase Dashboard
- Settings → General
- Copia "Reference ID"

---

## 🔍 Verifica Schema e RLS

### Script Automatici

```bash
# Verifica schema completo shipments
npm run verify:schema

# Verifica solo RLS policies
npm run check:rls
```

### Verifica Manuale con CLI

```bash
# Lista migrazioni applicate
supabase migration list

# Verifica schema tabella shipments
supabase db inspect shipments

# Verifica RLS policies
supabase db inspect --schema public --table shipments
```

---

## 🧪 Test Diretto con SQL

### Connessione al Database

```bash
# Usa connection string da Supabase Dashboard
# Settings → Database → Connection string → URI

psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
```

### Query Verifica Schema

```sql
-- Verifica colonne obbligatorie
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shipments'
AND column_name IN ('id', 'tracking_number', 'status', 'sender_name', 'recipient_name', 'weight')
ORDER BY column_name;

-- Verifica RLS policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'shipments'
ORDER BY cmd, policyname;

-- Verifica se RLS è abilitato
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'shipments';
```

---

## 🔒 Verifica RLS Policies

### Policies Attese

1. **INSERT**:
   - `shipments_insert_own` - Utenti inseriscono proprie spedizioni
   - `shipments_insert_reseller` - Reseller inseriscono spedizioni
   - ⚠️ **service_role bypassa RLS automaticamente** ✅

2. **SELECT**:
   - `shipments_select_own` - Utenti vedono proprie spedizioni
   - `shipments_select_reseller` - Reseller vedono spedizioni

3. **UPDATE**:
   - `shipments_update_own` - Utenti aggiornano proprie spedizioni
   - `shipments_update_reseller` - Reseller aggiornano spedizioni

### Verifica che service_role Bypassi RLS

```sql
-- Test: service_role dovrebbe poter inserire senza problemi
-- (verificato tramite supabaseAdmin nel codice)
```

---

## 🛠️ Fix Comuni

### Problema: Tabella shipments non esiste

```bash
# Applica tutte le migrazioni
supabase db push

# Oppure applica manualmente
psql -f supabase/migrations/001_complete_schema.sql
psql -f supabase/migrations/004_fix_shipments_schema.sql
```

### Problema: RLS Policy mancante

```sql
-- Crea policy INSERT per service_role (opzionale, service_role bypassa RLS)
-- Ma se necessario, crea policy esplicita:

CREATE POLICY "Service role can insert shipments" ON shipments
FOR INSERT
TO service_role
WITH CHECK (true);
```

### Problema: Colonna mancante

```bash
# Applica migrazione fix schema
psql -f supabase/migrations/004_fix_shipments_schema.sql
```

---

## 📊 Verifica Completa

### Checklist

- [ ] Supabase CLI installato
- [ ] Progetto linkato
- [ ] Tabella `shipments` esiste
- [ ] Colonne obbligatorie presenti
- [ ] RLS policies configurate
- [ ] `supabaseAdmin` può inserire (test con script)
- [ ] `user_profiles` accessibile

### Comando Rapido

```bash
# Esegui tutti i test
npm run verify:schema && npm run check:rls
```

---

## 🔗 Riferimenti

- **Documentazione Supabase CLI**: https://supabase.com/docs/guides/cli
- **RLS Policies**: https://supabase.com/docs/guides/auth/row-level-security
- **Schema Migrations**: `supabase/migrations/`

---

## ⚠️ Note Importanti

1. **service_role bypassa RLS**: Il client `supabaseAdmin` usa `SUPABASE_SERVICE_ROLE_KEY` che bypassa automaticamente tutte le RLS policies. Non serve policy esplicita.

2. **Verifica in Produzione**: Gli script di verifica funzionano anche in produzione se le variabili ambiente sono configurate.

3. **Sicurezza**: Non esporre mai `SUPABASE_SERVICE_ROLE_KEY` nel client. Usa solo server-side.
