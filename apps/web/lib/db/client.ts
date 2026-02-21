/**
 * Supabase Database Client
 *
 * Client configurato per accesso al database Supabase
 * con supporto service role per operazioni admin
 */

import { createClient } from '@supabase/supabase-js';

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase URL o Anon Key non configurati. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  );
}

// Use placeholder values during build if not configured
const buildTimeUrl = supabaseUrl || 'https://xxxxxxxxxxxxxxxxxxxxx.supabase.co';
const buildTimeAnonKey =
  supabaseAnonKey ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.placeholder';
const buildTimeServiceKey =
  supabaseServiceKey ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY0NTE5MjAwMCwiZXhwIjoxOTYwNzY4MDAwfQ.placeholder';

// Client pubblico (con RLS e Realtime abilitato)
// ⚠️ IMPORTANTE: Usa storage key univoco per evitare istanze multiple
export const supabase = createClient(buildTimeUrl, buildTimeAnonKey, {
  auth: {
    persistSession: false,
    storageKey: 'spediresicuro-auth', // Chiave univoca per evitare conflitti
  },
  realtime: {
    params: {
      eventsPerSecond: 10, // Limita eventi per performance
    },
  },
  global: {
    headers: {
      'x-client-info': 'spediresicuro@1.0.0',
    },
  },
});

// Client admin (bypassa RLS) - usare solo server-side
// ⚠️ IMPORTANTE: Verifica se la service key esiste prima di usare il placeholder
export const supabaseAdmin = supabaseServiceKey
  ? createClient(buildTimeUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : createClient(buildTimeUrl, buildTimeServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

// Helper per creare client autenticato per utente specifico
export function getSupabaseClient(accessToken?: string) {
  if (!accessToken) {
    return supabase;
  }

  return createClient(buildTimeUrl, buildTimeAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

// Type helpers
export type SupabaseClient = typeof supabase;
