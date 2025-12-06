# 🔧 Fix Migration Price Lists

## ❌ Problema

Errore durante esecuzione migration:
```
ERROR: 42P01: relation "price_lists" does not exist
```

## ✅ Soluzione Applicata

La migration `020_advanced_price_lists_system.sql` è stata aggiornata per:

1. **Verificare/Creare tabella price_lists** prima di aggiungere foreign keys
2. **Separare aggiunta colonna da foreign key constraint** per evitare errori
3. **Gestire casi edge** dove tabelle potrebbero non esistere

## 🚀 Come Eseguire

### Opzione 1: Se price_lists NON esiste

La migration ora crea automaticamente la struttura base se la tabella non esiste.

### Opzione 2: Se price_lists esiste già

La migration estende semplicemente la tabella esistente con i nuovi campi.

### Esecuzione

```sql
-- In Supabase SQL Editor
-- Copia e incolla il contenuto di:
-- supabase/migrations/020_advanced_price_lists_system.sql
```

## ✅ Verifica Post-Migration

Dopo l'esecuzione, verifica:

```sql
-- Verifica colonne aggiunte a shipments
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shipments' 
AND column_name IN ('price_list_id', 'applied_price_rule_id');

-- Verifica colonne aggiunte a users
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'assigned_price_list_id';

-- Verifica colonne aggiunte a price_lists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'price_lists' 
AND column_name IN ('rules', 'priority', 'is_global', 'assigned_to_user_id', 'default_margin_percent');
```

## 🔍 Se Persistono Errori

1. **Verifica ordine migration:**
   - La migration `001_complete_schema.sql` dovrebbe essere eseguita prima
   - Se non l'hai eseguita, eseguila prima di 020

2. **Esegui manualmente:**
   ```sql
   -- Verifica che price_lists esista
   SELECT * FROM price_lists LIMIT 1;
   
   -- Se errore, crea tabella base
   -- (vedi migration 001_complete_schema.sql, righe 141-165)
   ```

3. **Esegui migration in parti:**
   - Esegui solo STEP 0 (verifica/crea tabella)
   - Poi esegui STEP 1 (aggiungi a shipments)
   - Poi esegui STEP 2 (aggiungi a users)
   - E così via...

## 📝 Note

- La migration è ora **idempotente** (può essere eseguita più volte)
- Controlla sempre l'esistenza prima di aggiungere foreign keys
- I messaggi `RAISE NOTICE` ti diranno cosa è stato fatto
