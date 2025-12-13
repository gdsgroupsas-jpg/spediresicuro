'use server';

import { createServerActionClient } from '@/lib/supabase-server';
import { getFiscalContext } from '@/lib/agent/fiscal-data';

export async function getMyFiscalData() {
  const supabase = createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Utente non autenticato');
  }

  // Recupera ruolo
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = userData?.role || 'user';

  // Chiama la funzione di logica interna
  return await getFiscalContext(user.id, role);
}
