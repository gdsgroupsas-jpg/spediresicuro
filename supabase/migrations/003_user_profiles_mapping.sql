-- ============================================
-- TABELLA: user_profiles (Mapping NextAuth <-> Supabase)
-- ============================================
-- Questa tabella mappa gli utenti NextAuth (email) agli utenti Supabase (UUID)
-- Necessaria per integrare NextAuth con Supabase Auth

-- Crea la tabella se non esiste
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Email da NextAuth (chiave univoca)
    email TEXT UNIQUE NOT NULL,
    
    -- UUID da Supabase Auth (se l'utente esiste in auth.users)
    supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Dati NextAuth
    nextauth_user_id TEXT, -- ID utente da NextAuth (se diverso da email)
    name TEXT,
    provider TEXT, -- 'credentials', 'google', 'github', 'facebook'
    provider_id TEXT, -- ID dal provider OAuth
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint: email deve essere univoca
    CONSTRAINT unique_email UNIQUE (email)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_supabase_user_id ON public.user_profiles(supabase_user_id) WHERE supabase_user_id IS NOT NULL;

-- Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Utenti vedono solo il loro profilo
CREATE POLICY "Utenti vedono solo il loro profilo" 
ON public.user_profiles 
FOR ALL 
TO authenticated
USING (
    (SELECT auth.uid()) = supabase_user_id 
    OR 
    (SELECT auth.email()) = email
)
WITH CHECK (
    (SELECT auth.uid()) = supabase_user_id 
    OR 
    (SELECT auth.email()) = email
);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_modtime
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE PROCEDURE update_user_profiles_updated_at();

-- Commenti
COMMENT ON TABLE public.user_profiles IS 'Mapping tra utenti NextAuth (email) e Supabase Auth (UUID)';
COMMENT ON COLUMN public.user_profiles.email IS 'Email utente da NextAuth (chiave primaria per mapping)';
COMMENT ON COLUMN public.user_profiles.supabase_user_id IS 'UUID utente in Supabase Auth (se esiste)';

