# 🔧 FIX: UNIQUE Constraint per Upsert savePersonalConfiguration

**Data**: 2025-12-28  
**Problema**: `savePersonalConfiguration` fallisce con errore PostgreSQL 42P10: "there is no unique or exclusion constraint matching the ON CONFLICT specification"  
**Causa**: Upsert usa `onConflict: 'owner_user_id,provider_id'` ma non esiste constraint UNIQUE su queste colonne  
**Soluzione**: Aggiunge UNIQUE INDEX parziale su `(owner_user_id, provider_id)` per configurazioni personali

---

## 📋 ANALISI PROBLEMA

### Upsert in `savePersonalConfiguration`

**File**: `actions/configurations.ts` (righe 376-383)

```typescript
const { data: result, error: upsertError } = await supabaseAdmin
  .from('courier_configs')
  .upsert(configData, {
    onConflict: 'owner_user_id,provider_id', // ❌ Constraint non esiste
    ignoreDuplicates: false,
  })
  .select()
  .single();
```

**Errore PostgreSQL**:
```
42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

---

### Colonne Usate in ON CONFLICT

**Colonne**: `owner_user_id, provider_id`

**Logica**:
- Ogni utente può avere **al massimo una configurazione per provider**
- Esempio: utente A può avere 1 config per `spedisci_online`, 1 per `gls`, ecc.
- Configurazioni globali (`owner_user_id IS NULL`) non sono vincolate

---

## 📋 VERIFICA SCHEMA ATTUALE

### Query Verifica Constraint Esistenti

```sql
-- Verifica constraint UNIQUE esistenti
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'courier_configs'::regclass
  AND contype IN ('u', 'x'); -- u = UNIQUE, x = EXCLUSION

-- Verifica indici UNIQUE esistenti
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'courier_configs'
  AND indexdef LIKE '%UNIQUE%';
```

**Risultato Atteso**:
- ❌ Nessun constraint UNIQUE su `(owner_user_id, provider_id)`
- ✅ Esiste `idx_courier_configs_unique_default` (solo per `is_default = true`)

---

## 📋 MIGRAZIONE SQL

### File: `supabase/migrations/052_add_unique_owner_provider_constraint.sql`

**Contenuto**:
1. **Verifica duplicati** (query READ-ONLY)
2. **Cleanup duplicati** (script opzionale)
3. **Crea UNIQUE INDEX parziale**:
   ```sql
   CREATE UNIQUE INDEX idx_courier_configs_unique_owner_provider
   ON public.courier_configs(owner_user_id, provider_id)
   WHERE owner_user_id IS NOT NULL;
   ```

**Caratteristiche**:
- ✅ **Parziale**: solo per `owner_user_id IS NOT NULL` (configurazioni personali)
- ✅ **Non vincola**: configurazioni globali (`owner_user_id IS NULL`) possono avere più config per provider
- ✅ **Idempotente**: verifica esistenza prima di creare

---

## 📋 CLEANUP DUPLICATI

### File: `supabase/migrations/CLEANUP_DUPLICATE_CONFIGS.sql`

**Script di Cleanup** (eseguire PRIMA della migrazione 052):

1. **STEP 1**: Verifica duplicati (READ-ONLY)
   ```sql
   SELECT owner_user_id, provider_id, COUNT(*) as count
   FROM courier_configs
   WHERE owner_user_id IS NOT NULL
   GROUP BY owner_user_id, provider_id
   HAVING COUNT(*) > 1;
   ```

2. **STEP 2**: Preview record da eliminare (READ-ONLY)
   - Mostra quali record verranno eliminati
   - Mantiene il record più recente (`created_at DESC`)

3. **STEP 3**: Elimina duplicati
   ```sql
   DELETE FROM courier_configs
   WHERE id IN (
     SELECT id FROM (
       SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY owner_user_id, provider_id 
           ORDER BY created_at DESC
         ) as rn
       FROM courier_configs
       WHERE owner_user_id IS NOT NULL
     ) ranked
     WHERE rn > 1
   );
   ```

4. **STEP 4**: Verifica risultato (0 duplicati)

---

## 📋 PROCEDURA APPLICAZIONE

### 1. Verifica Duplicati

```sql
-- Esegui query STEP 1 da CLEANUP_DUPLICATE_CONFIGS.sql
SELECT 
  owner_user_id, 
  provider_id, 
  COUNT(*) as count
FROM courier_configs
WHERE owner_user_id IS NOT NULL
GROUP BY owner_user_id, provider_id
HAVING COUNT(*) > 1;
```

**Se ci sono duplicati**:
- Esegui cleanup (STEP 3 da `CLEANUP_DUPLICATE_CONFIGS.sql`)
- Verifica risultato (STEP 4)

**Se NON ci sono duplicati**:
- Procedi direttamente alla migrazione 052

---

### 2. Applica Migrazione 052

**Opzione A: Supabase Dashboard**
1. Vai su https://supabase.com/dashboard
2. Seleziona progetto SpedireSicuro
3. Vai a **SQL Editor**
4. Copia contenuto di `052_add_unique_owner_provider_constraint.sql`
5. Esegui query

**Opzione B: Supabase CLI**
```bash
supabase db push
```

---

### 3. Verifica Constraint Creato

```sql
-- Verifica indice creato
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'courier_configs'
  AND indexname = 'idx_courier_configs_unique_owner_provider';
```

**Risultato Atteso**:
```
indexname: idx_courier_configs_unique_owner_provider
indexdef: CREATE UNIQUE INDEX idx_courier_configs_unique_owner_provider 
          ON public.courier_configs (owner_user_id, provider_id) 
          WHERE (owner_user_id IS NOT NULL)
```

---

## 📋 TEST PLAN

### Test 1: Wizard Salva Configurazione (Upsert)

**Steps**:
1. Login come reseller
2. Vai a `/dashboard/integrazioni`
3. Completa wizard Spedisci.Online
4. Salva

**Verifiche**:
- ✅ Nessun errore 42P10
- ✅ Configurazione salvata con successo
- ✅ Log: `✅ Configurazione personale salvata (upsert)`

**Query Verifica**:
```sql
SELECT id, owner_user_id, provider_id, account_type
FROM courier_configs
WHERE owner_user_id = '<user_id>'
  AND provider_id = 'spedisci_online';
```

**Risultato Atteso**: 1 record (non duplicati)

---

### Test 2: Wizard Aggiorna Configurazione Esistente (Upsert)

**Steps**:
1. Login come reseller (stesso account Test 1)
2. Vai a `/dashboard/integrazioni`
3. Modifica configurazione esistente (cambia API key)
4. Salva

**Verifiche**:
- ✅ Nessun errore 42P10
- ✅ Configurazione aggiornata (non duplicata)
- ✅ Log: `✅ Configurazione personale salvata (upsert)`

**Query Verifica**:
```sql
SELECT COUNT(*) as count
FROM courier_configs
WHERE owner_user_id = '<user_id>'
  AND provider_id = 'spedisci_online';
```

**Risultato Atteso**: `count = 1` (non duplicati)

---

### Test 3: Spedizione Trova Configurazione

**Steps**:
1. Login come reseller (stesso account Test 1)
2. Vai a `/dashboard/spedizioni/nuova`
3. Compila form e submit

**Verifiche**:
- ✅ Log: `✅ [Booking] Configurazione personale trovata per utente: <email>`
- ✅ Spedizione creata con successo
- ✅ Tracking number presente

---

### Test 4: Tentativo Duplicato (Dovrebbe Fallire)

**Steps**:
1. (Opzionale) Prova insert manuale duplicato
2. Verifica constraint funziona

**Query Test**:
```sql
-- Dovrebbe fallire con UNIQUE constraint violation
INSERT INTO courier_configs (
  owner_user_id, 
  provider_id, 
  name, 
  api_key, 
  base_url
)
VALUES (
  '<user_id>',
  'spedisci_online',
  'Test Duplicato',
  'test-key',
  'https://test.com'
);
```

**Risultato Atteso**: Errore `duplicate key value violates unique constraint`

---

## 📋 RIEPILOGO

| Aspetto | Prima | Dopo |
|---------|-------|------|
| **Constraint UNIQUE** | ❌ NON esiste | ✅ Esiste (parziale) |
| **Upsert** | ❌ Errore 42P10 | ✅ Funziona |
| **Duplicati** | ⚠️ Possibili | ✅ Impossibili (constraint) |
| **Config Globali** | ✅ OK | ✅ OK (non vincolate) |
| **Config Personali** | ⚠️ Duplicati possibili | ✅ Una per utente/provider |

---

## 📋 FILE CREATI

1. **`supabase/migrations/052_add_unique_owner_provider_constraint.sql`**
   - Migrazione principale
   - Crea UNIQUE INDEX parziale
   - Verifica finale

2. **`supabase/migrations/CLEANUP_DUPLICATE_CONFIGS.sql`**
   - Script di cleanup duplicati
   - 5 step (verifica → preview → elimina → verifica → statistiche)

3. **`FIX_UPSERT_UNIQUE_CONSTRAINT.md`**
   - Documentazione completa
   - Procedura applicazione
   - Test plan

---

**Firma**:  
Senior Supabase/Postgres Engineer  
Data: 2025-12-28

