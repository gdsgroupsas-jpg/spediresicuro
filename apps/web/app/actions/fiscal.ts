'use server';

import { getSafeAuth } from '@/lib/safe-auth';
import { createServerActionClient } from '@/lib/supabase-server';
import { getSupabaseUserIdFromEmail } from '@/lib/database';
import { getFiscalContext } from '@/lib/agent/fiscal-data';

export async function getMyFiscalData() {
  // Usa getSafeAuth per supportare impersonation
  const context = await getSafeAuth();

  if (!context?.actor?.email) {
    throw new Error('Utente non autenticato');
  }

  // Ottieni userId Supabase dalla tabella users usando email NextAuth
  const supabaseUserId = await getSupabaseUserIdFromEmail(context.actor.email, context.actor.id);

  if (!supabaseUserId) {
    throw new Error('Impossibile ottenere userId Supabase - verifica autenticazione');
  }

  // Recupera ruolo dalla tabella users o dalla sessione NextAuth
  const supabase = createServerActionClient();
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', supabaseUserId)
    .single();

  // Usa ruolo da database o fallback a context
  const role = userData?.role || context.actor.role || 'user';

  // Chiama la funzione di logica interna
  return await getFiscalContext(supabaseUserId, role);
}
