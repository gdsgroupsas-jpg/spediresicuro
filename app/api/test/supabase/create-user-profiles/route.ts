/**
 * Route API per creare automaticamente la tabella user_profiles
 * 
 * Endpoint: POST /api/test/supabase/create-user-profiles
 * 
 * ⚠️ ATTENZIONE: Usa solo in sviluppo/test. In produzione crea le tabelle manualmente.
 */

import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const CREATE_USER_PROFILES_SQL = `
-- Crea tabella user_profiles per mapping NextAuth <-> Supabase
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nextauth_user_id TEXT,
    name TEXT,
    provider TEXT,
    provider_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_email UNIQUE (email)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_supabase_user_id ON public.user_profiles(supabase_user_id) WHERE supabase_user_id IS NOT NULL;

-- Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Utenti vedono solo il loro profilo
DROP POLICY IF EXISTS "Utenti vedono solo il loro profilo" ON public.user_profiles;
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

DROP TRIGGER IF EXISTS update_user_profiles_modtime ON public.user_profiles;
CREATE TRIGGER update_user_profiles_modtime
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION update_user_profiles_updated_at();

-- Commenti per documentazione
COMMENT ON TABLE public.user_profiles IS 'Mapping tra utenti NextAuth (email) e Supabase Auth (UUID)';
COMMENT ON COLUMN public.user_profiles.email IS 'Email utente da NextAuth (chiave primaria per mapping)';
COMMENT ON COLUMN public.user_profiles.supabase_user_id IS 'UUID utente in Supabase Auth (se esiste)';
`;

export async function POST() {
  try {
    // Verifica che Supabase sia configurato
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Supabase non configurato',
          message: 'Configura prima Supabase in .env.local',
        },
        { status: 400 }
      );
    }

    // Verifica se la tabella esiste già
    const { error: checkError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .limit(1);

    if (!checkError) {
      return NextResponse.json(
        {
          success: true,
          message: '✅ Tabella user_profiles già esistente',
          alreadyExists: true,
        },
        { status: 200 }
      );
    }

    // Esegui SQL per creare la tabella
    // Nota: Supabase Admin non ha metodo diretto per eseguire SQL raw
    // Dobbiamo usare RPC o eseguire tramite API REST
    // Per semplicità, usiamo il metodo rpc se disponibile, altrimenti restituiamo lo script
    
    // Tentativo: eseguiamo le query una per una usando operazioni Supabase
    // In realtà, per creare tabelle dobbiamo usare SQL Editor di Supabase
    // Questo endpoint serve principalmente per verificare e fornire lo script
    
    return NextResponse.json(
      {
        success: false,
        message: '⚠️ Creazione automatica non supportata',
        instructions: [
          'La creazione di tabelle richiede privilegi admin che non sono disponibili via API.',
          'Esegui lo script SQL manualmente nel Supabase SQL Editor:',
        ],
        sqlScript: CREATE_USER_PROFILES_SQL,
        steps: [
          '1. Vai su Supabase Dashboard → SQL Editor',
          '2. Clicca "New Query"',
          '3. Copia e incolla lo script SQL sopra',
          '4. Clicca "Run" o premi Ctrl+Enter',
          '5. Verifica con GET /api/test/supabase',
        ],
        alternative: 'Puoi anche eseguire il file: supabase/migrations/003_user_profiles_mapping.sql',
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        message: 'Errore durante la creazione della tabella',
      },
      { status: 500 }
    );
  }
}



