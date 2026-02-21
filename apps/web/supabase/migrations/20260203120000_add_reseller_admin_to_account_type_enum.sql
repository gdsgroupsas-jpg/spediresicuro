-- ============================================
-- MIGRAZIONE: Aggiunge 'reseller_admin' all'enum account_type
-- ============================================
--
-- Problema: L'enum account_type non include 'reseller_admin'
-- Soluzione: Aggiungere il valore all'enum esistente
--
-- ============================================

-- Verifica se l'enum esiste e aggiungi il valore
DO $$
BEGIN
    -- Verifica se account_type è un enum
    IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE t.typname = 'account_type'
        AND t.typtype = 'e'
    ) THEN
        -- Verifica se 'reseller_admin' non esiste già nell'enum
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'account_type'
            AND e.enumlabel = 'reseller_admin'
        ) THEN
            -- Aggiungi 'reseller_admin' all'enum
            ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'reseller_admin';
            RAISE NOTICE 'Aggiunto reseller_admin all''enum account_type';
        ELSE
            RAISE NOTICE 'reseller_admin già presente nell''enum account_type';
        END IF;
    ELSE
        -- account_type non è un enum, potrebbe essere TEXT con CHECK constraint
        RAISE NOTICE 'account_type non è un enum PostgreSQL. Verificare se è TEXT con CHECK constraint.';

        -- Prova ad aggiornare il CHECK constraint se esiste
        -- Prima rimuovi il vecchio constraint
        BEGIN
            ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_type_check;
        EXCEPTION WHEN undefined_object THEN
            -- Constraint non esisteva, va bene
            NULL;
        END;

        -- Aggiungi nuovo constraint con reseller_admin
        BEGIN
            ALTER TABLE users ADD CONSTRAINT users_account_type_check
            CHECK (account_type IN ('user', 'admin', 'superadmin', 'reseller', 'reseller_admin', 'byoc'));
            RAISE NOTICE 'Aggiunto CHECK constraint con reseller_admin';
        EXCEPTION WHEN duplicate_object THEN
            RAISE NOTICE 'CHECK constraint già esistente';
        END;
    END IF;
END;
$$;

-- ============================================
-- FINE MIGRAZIONE
-- ============================================
