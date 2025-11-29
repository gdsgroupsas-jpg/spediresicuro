/**
 * Client Supabase per il progetto
 * 
 * Configurazione client Supabase per accesso al database.
 * Supporta sia client-side che server-side.
 */

import { createClient } from '@supabase/supabase-js';

// Tipi per le variabili ambiente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Verifica che le variabili siano configurate
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase URL o Anon Key non configurati. ' +
    'Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  );
}

/**
 * Client Supabase per uso client-side (browser)
 * Usa la chiave anonima (pubblica, sicura per Row Level Security)
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Non persistiamo sessioni per questo progetto
  },
});

/**
 * Client Supabase Admin per uso server-side (API routes, scripts)
 * Usa la service role key (privata, bypassa RLS)
 * 
 * ⚠️ USARE SOLO IN SERVER-SIDE! Non esporre mai questa chiave nel client.
 */
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Verifica configurazione admin
if (!supabaseAdmin && process.env.NODE_ENV === 'production') {
  console.warn(
    '⚠️ Supabase Service Role Key non configurata. ' +
    'Aggiungi SUPABASE_SERVICE_ROLE_KEY in .env.local per script di seeding.'
  );
}

