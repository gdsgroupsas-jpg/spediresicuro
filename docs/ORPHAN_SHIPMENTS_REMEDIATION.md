# Remediation: Orphan Shipments

## 📊 Problema

Shipments orfane: record con `user_id IS NULL AND created_by_user_email IS NULL`.

Questi record violano il principio di multi-tenancy e possono esporre dati a utenti non autorizzati.

## 🛠️ Soluzione Implementata

### 1. Migration di Remediation (034_remediate_orphan_shipments.sql)

**Strategia:** Soft delete delle shipments orfane esistenti.

**Query eseguita:**

```sql
UPDATE shipments
SET
  deleted = true,
  deleted_at = NOW(),
  notes = COALESCE(notes || E'\n', '') || '[ORPHAN_REMEDIATION] ...',
  updated_at = NOW()
WHERE user_id IS NULL
  AND created_by_user_email IS NULL
  AND deleted = false;
```

**Risultato atteso:**

- Tutte le shipments orfane marcate come `deleted = true`
- `deleted_at` impostato a NOW()
- Motivo salvato in `notes`

### 2. Migration di Prevenzione (035_prevent_orphan_shipments.sql)

**Strategia:** Constraint + Trigger per impedire nuovi orfani.

**Constraint:**

```sql
ALTER TABLE shipments
ADD CONSTRAINT shipments_no_orphan_check
CHECK (
  user_id IS NOT NULL
  OR created_by_user_email IS NOT NULL
);
```

**Regola:** Almeno uno tra `user_id` e `created_by_user_email` deve essere NOT NULL.

**Trigger:**

- `trigger_prevent_orphan_shipment` (BEFORE INSERT)
- `trigger_prevent_orphan_shipment_update` (BEFORE UPDATE)

**Comportamento:**

- INSERT con entrambi null → `ORPHAN_SHIPMENT_PREVENTED` exception
- UPDATE che setta entrambi a null → `ORPHAN_SHIPMENT_PREVENTED` exception

## 📋 Come Applicare

### Step 1: Applica Migration di Remediation

```bash
# In Supabase SQL Editor o via CLI
psql $DATABASE_URL -f supabase/migrations/034_remediate_orphan_shipments.sql
```

**Verifica:**

```sql
-- Dovrebbe restituire 0
SELECT COUNT(*)
FROM shipments
WHERE user_id IS NULL
  AND created_by_user_email IS NULL
  AND deleted = false;
```

### Step 2: Applica Migration di Prevenzione

```bash
# In Supabase SQL Editor o via CLI
psql $DATABASE_URL -f supabase/migrations/035_prevent_orphan_shipments.sql
```

**Verifica constraint:**

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'shipments_no_orphan_check';
```

**Verifica trigger:**

```sql
SELECT tgname, tgtype
FROM pg_trigger
WHERE tgname LIKE '%prevent_orphan%';
```

### Step 3: Test di Prevenzione

```sql
-- Questo DEVE fallire
INSERT INTO shipments (
  tracking_number,
  sender_name,
  recipient_name,
  weight,
  user_id,
  created_by_user_email
) VALUES (
  'TEST_ORPHAN',
  'Test',
  'Test',
  1,
  NULL,  -- user_id null
  NULL   -- created_by_user_email null
);
-- Atteso: ERROR: ORPHAN_SHIPMENT_PREVENTED
```

```sql
-- Questo DEVE funzionare (almeno uno NOT NULL)
INSERT INTO shipments (
  tracking_number,
  sender_name,
  recipient_name,
  weight,
  user_id,
  created_by_user_email
) VALUES (
  'TEST_VALID',
  'Test',
  'Test',
  1,
  NULL,           -- user_id null
  'test@test.com' -- created_by_user_email NOT NULL ✅
);
-- Atteso: SUCCESS
```

## ✅ Verifica Finale

### Audit Script

```bash
npm run audit:security
```

**Atteso:**

```
ORPHAN_SHIPMENTS: PASS (count: 0)
```

### Query Diretta

```sql
-- Verifica orfani attivi (deve essere 0)
SELECT COUNT(*) as orphan_count
FROM shipments
WHERE user_id IS NULL
  AND created_by_user_email IS NULL
  AND deleted = false;

-- Verifica orfani soft-deleted (per audit)
SELECT COUNT(*) as remediated_count
FROM shipments
WHERE user_id IS NULL
  AND created_by_user_email IS NULL
  AND deleted = true;
```

## 🔒 Protezione DB

### Constraint CHECK

**Regola:** `user_id IS NOT NULL OR created_by_user_email IS NOT NULL`

**Motivazione:**

- `user_id` è il campo primario per multi-tenancy (preferito)
- `created_by_user_email` è fallback per compatibilità legacy/NextAuth
- Almeno uno deve essere presente per garantire tracciabilità

**Alternativa considerata:**

- `user_id IS NOT NULL` sempre → troppo restrittivo (blocca service_role operations)
- `created_by_user_email IS NOT NULL` sempre → non sufficiente (email può essere spoofata)

**Scelta finale:** Constraint OR permette:

- ✅ User normale: `user_id NOT NULL` (preferito)
- ✅ Service role: `user_id NULL, created_by_user_email NOT NULL` (con audit)
- ❌ Orfano: `user_id NULL, created_by_user_email NULL` (bloccato)

### Trigger

**Funzione:** `prevent_orphan_shipment()`

**Comportamento:**

- Valida PRIMA di INSERT/UPDATE
- Lancia exception chiara se violazione
- Messaggio: `ORPHAN_SHIPMENT_PREVENTED: Shipment non può essere creata senza user_id o created_by_user_email`

## 📝 Note

- **Service Role Operations:** Possono ancora inserire con `user_id NULL` se `created_by_user_email` è presente
- **Legacy Data:** Le shipments orfane esistenti vengono soft-deleted, non eliminate fisicamente
- **Audit Trail:** Il motivo della remediation è salvato in `notes`
