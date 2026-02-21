-- ============================================
-- MIGRAZIONE: Campi per Password Reset
-- ============================================
--
-- Aggiunge campi per gestire il reset password:
-- - reset_token_hash: hash SHA256 del token (non salviamo mai il token in chiaro)
-- - reset_token_expires: timestamp scadenza token
--
-- ============================================

-- Aggiungi colonne se non esistono
DO $$
BEGIN
    -- reset_token_hash
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'reset_token_hash'
    ) THEN
        ALTER TABLE public.users ADD COLUMN reset_token_hash TEXT;
        RAISE NOTICE 'Aggiunta colonna reset_token_hash';
    END IF;

    -- reset_token_expires
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'reset_token_expires'
    ) THEN
        ALTER TABLE public.users ADD COLUMN reset_token_expires TIMESTAMPTZ;
        RAISE NOTICE 'Aggiunta colonna reset_token_expires';
    END IF;
END;
$$;

-- Indice per ricerca veloce per email + token (usato durante reset)
CREATE INDEX IF NOT EXISTS idx_users_reset_token
ON public.users(email, reset_token_hash)
WHERE reset_token_hash IS NOT NULL;

-- Commenti
COMMENT ON COLUMN public.users.reset_token_hash IS 'Hash SHA256 del token di reset password';
COMMENT ON COLUMN public.users.reset_token_expires IS 'Timestamp di scadenza del token reset';

-- ============================================
-- FINE MIGRAZIONE
-- ============================================
