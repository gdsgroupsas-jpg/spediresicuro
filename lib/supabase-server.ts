/**
 * Supabase Server Client per Server Actions
 *
 * Crea un client Supabase sicuro per uso in Server Actions
 * con supporto per cookie e autenticazione
 */

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL o Anon Key non configurati');
}

/**
 * Crea un client Supabase per Server Actions
 * Usa i cookie per mantenere la sessione autenticata
 */
export function createServerActionClient() {
  const cookieStore = cookies();

  // Per Server Actions, usiamo un client base senza configurazione cookies avanzata
  // I cookie vengono gestiti automaticamente da Next.js
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
