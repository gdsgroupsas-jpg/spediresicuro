-- ============================================
-- SCRIPT DI VERIFICA: user_integrations
-- ============================================
-- Esegui questo script per verificare che tutto sia stato creato correttamente

-- 1. Verifica che la tabella esista
SELECT 
    'Tabella user_integrations' AS check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_class c 
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = 'public' AND c.relname = 'user_integrations'
        ) THEN '✅ ESISTE' 
        ELSE '❌ NON ESISTE' 
    END AS status;

-- 2. Verifica colonne
SELECT 
    'Colonne tabella' AS check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_integrations'
ORDER BY ordinal_position;

-- 3. Verifica indici
SELECT 
    'Indici' AS check_type,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'user_integrations';

-- 4. Verifica RLS
SELECT 
    'RLS (Row Level Security)' AS check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON c.relnamespace = n.oid
            JOIN pg_tables t ON t.tablename = c.relname
            WHERE n.nspname = 'public' 
              AND c.relname = 'user_integrations'
              AND t.rowsecurity = true
        ) THEN '✅ ATTIVO' 
        ELSE '❌ NON ATTIVO' 
    END AS status;

-- 5. Verifica Policy
SELECT 
    'Policy RLS' AS check_type,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_integrations';

-- 6. Verifica Trigger
SELECT 
    'Trigger' AS check_type,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public' 
  AND event_object_table = 'user_integrations';

-- 7. Verifica Funzione
SELECT 
    'Funzione update_user_integrations_updated_at' AS check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' 
              AND p.proname = 'update_user_integrations_updated_at'
        ) THEN '✅ ESISTE' 
        ELSE '❌ NON ESISTE' 
    END AS status;

-- 8. Verifica Constraint UNIQUE
SELECT 
    'Constraint UNIQUE (user_id, provider)' AS check_type,
    conname AS constraint_name,
    contype AS constraint_type
FROM pg_constraint
WHERE conrelid = 'public.user_integrations'::regclass
  AND contype = 'u';

