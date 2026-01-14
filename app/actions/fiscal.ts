'use server';

import { auth } from '@/lib/auth-config';
import { createServerActionClient } from '@/lib/supabase-server';
import { getSupabaseUserIdFromEmail } from '@/lib/database';
import { getFiscalContext } from '@/lib/agent/fiscal-data';

export async function getMyFiscalData() {
  // ⚠️ FIX REGRESSIONE: Usa NextAuth invece di Supabase Auth
  const session = await auth();
  
  if (!session?.user?.email) {
    throw new Error('Utente non autenticato');
  }

  // Ottieni userId Supabase dalla tabella users usando email NextAuth
  const supabaseUserId = await getSupabaseUserIdFromEmail(
    session.user.email,
    session.user.id
  );

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

  // Usa ruolo da database o fallback a sessione NextAuth
  const role = userData?.role || (session.user as any).role || 'user';

  // Chiama la funzione di logica interna
  return await getFiscalContext(supabaseUserId, role);
}
