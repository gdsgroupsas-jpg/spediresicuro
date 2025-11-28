/**
 * Supabase Database Client
 *
 * Client configurato per accesso al database Supabase
 * con supporto service role per operazioni admin
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client pubblico (con RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client admin (bypassa RLS) - usare solo server-side
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper per creare client autenticato per utente specifico
export function getSupabaseClient(accessToken?: string) {
  if (!accessToken) {
    return supabase;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

// Type helpers
export type SupabaseClient = typeof supabase;
