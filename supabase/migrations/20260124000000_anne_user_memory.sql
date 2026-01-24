-- ============================================================
-- Migration: anne_user_memory
-- Description: Tabella per memorizzare preferenze utente per Anne AI
-- Date: 2026-01-24
-- ============================================================

-- Crea tabella anne_user_memory
CREATE TABLE IF NOT EXISTS public.anne_user_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    preferences JSONB DEFAULT '{}'::jsonb,
    default_sender JSONB DEFAULT '{}'::jsonb,
    preferred_couriers TEXT[] DEFAULT '{}',
    communication_style JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Constraint per unicità user_id (necessario per UPSERT)
    CONSTRAINT anne_user_memory_user_id_unique UNIQUE (user_id)
);

-- Commento tabella
COMMENT ON TABLE public.anne_user_memory IS 'Memorizza preferenze utente per Anne AI (tono, mittente predefinito, corrieri preferiti)';

-- Indice per lookup veloce per user_id
CREATE INDEX IF NOT EXISTS idx_anne_user_memory_user_id ON public.anne_user_memory(user_id);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

-- Abilita RLS sulla tabella
ALTER TABLE public.anne_user_memory ENABLE ROW LEVEL SECURITY;

-- Policy: Gli utenti possono vedere solo i propri dati
CREATE POLICY "Users can view own memory"
    ON public.anne_user_memory
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Gli utenti possono inserire solo i propri dati
CREATE POLICY "Users can insert own memory"
    ON public.anne_user_memory
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Gli utenti possono aggiornare solo i propri dati
CREATE POLICY "Users can update own memory"
    ON public.anne_user_memory
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Gli utenti possono eliminare solo i propri dati
CREATE POLICY "Users can delete own memory"
    ON public.anne_user_memory
    FOR DELETE
    USING (auth.uid() = user_id);

-- Policy: Admin e superadmin possono vedere tutti i dati (per supporto)
CREATE POLICY "Admins can view all memory"
    ON public.anne_user_memory
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin', 'superadmin')
        )
    );

-- ============================================================
-- Trigger per updated_at
-- ============================================================

-- Funzione per aggiornare updated_at (riusa se esiste già)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger su update
DROP TRIGGER IF EXISTS update_anne_user_memory_updated_at ON public.anne_user_memory;
CREATE TRIGGER update_anne_user_memory_updated_at
    BEFORE UPDATE ON public.anne_user_memory
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Grant permissions
-- ============================================================

-- Permessi per service_role (usato da supabaseAdmin)
GRANT ALL ON public.anne_user_memory TO service_role;

-- Permessi per authenticated users (via RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anne_user_memory TO authenticated;
