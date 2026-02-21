import { supabaseAdmin } from '@/lib/supabase';

export async function getSupabaseUserIdFromEmailImpl(
  email: string,
  nextAuthUserId?: string | null
): Promise<string | null> {
  try {
    // 1. Cerca prima in user_profiles (veloce grazie all'indice su email)
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .select('supabase_user_id, name, provider')
      .eq('email', email)
      .single();

    if (!error && profile?.supabase_user_id) {
      console.log(`✅ [SUPABASE] User ID trovato in user_profiles per ${email}`);
      return profile.supabase_user_id;
    }

    // 2. Se non trovato in user_profiles, cerca in auth.users
    const {
      data: { users },
      error: authError,
    } = await supabaseAdmin.auth.admin.listUsers();

    if (!authError && users) {
      const supabaseUser = users.find((u: any) => u.email === email);
      if (supabaseUser) {
        console.log(
          `✅ [SUPABASE] User trovato in auth.users per ${email} - creo/aggiorno profilo`
        );

        // Crea o aggiorna il profilo in user_profiles
        try {
          const { data: updatedProfile, error: upsertError } = await supabaseAdmin
            .from('user_profiles')
            .upsert(
              {
                email,
                supabase_user_id: supabaseUser.id,
                name:
                  supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || null,
                provider: supabaseUser.app_metadata?.provider || 'credentials',
                provider_id: supabaseUser.app_metadata?.provider_id || null,
              },
              { onConflict: 'email' }
            )
            .select('supabase_user_id')
            .single();

          if (!upsertError && updatedProfile?.supabase_user_id) {
            console.log(`✅ [SUPABASE] Profilo creato/aggiornato in user_profiles`);
            return updatedProfile.supabase_user_id;
          } else if (upsertError) {
            console.warn('⚠️ [SUPABASE] Errore creazione profilo:', upsertError.message);
          }
        } catch (upsertError: any) {
          console.warn('⚠️ [SUPABASE] Errore upsert profilo:', upsertError.message);
        }

        // Restituisci comunque l'ID anche se l'upsert fallisce
        return supabaseUser.id;
      }
    }

    // 3. FALLBACK: Usa NextAuth session.user.id se disponibile
    if (nextAuthUserId) {
      console.log(
        `ℹ️ [SUPABASE] Usando NextAuth user.id come fallback: ${nextAuthUserId.substring(0, 8)}...`
      );
      // Crea/aggiorna profilo con NextAuth ID come riferimento temporaneo
      try {
        await supabaseAdmin.from('user_profiles').upsert(
          {
            email,
            supabase_user_id: null, // Non abbiamo UUID Supabase, ma abbiamo NextAuth ID
            // Salva NextAuth ID in un campo custom se disponibile, altrimenti usa email come riferimento
          },
          { onConflict: 'email' }
        );
      } catch (createError: any) {
        console.warn(
          '⚠️ [SUPABASE] Impossibile creare profilo con NextAuth ID:',
          createError.message
        );
      }
      // Restituisci NextAuth ID come fallback (non è UUID Supabase, ma è meglio di null)
      return nextAuthUserId;
    }

    // 4. Se non esiste né in user_profiles né in auth.users né NextAuth ID, crea profilo senza supabase_user_id
    try {
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('user_profiles')
        .upsert(
          {
            email,
            supabase_user_id: null, // Nessun utente Supabase Auth
          },
          { onConflict: 'email' }
        )
        .select('id')
        .single();

      if (!createError && newProfile) {
        console.log(
          `ℹ️ [SUPABASE] Profilo creato senza supabase_user_id per ${email} (utente solo NextAuth)`
        );
        // Restituisci null perché non c'è UUID Supabase
        return null;
      }
    } catch (createError: any) {
      // Ignora errori di creazione profilo (non critico)
      console.warn('⚠️ [SUPABASE] Impossibile creare profilo:', createError.message);
    }

    console.warn(
      `⚠️ [SUPABASE] Nessun user_id trovato per ${email} - spedizione salvata senza user_id`
    );
    return null;
  } catch (error: any) {
    console.error('❌ [SUPABASE] Errore getSupabaseUserIdFromEmail:', error.message);
    // FALLBACK: Se tutto fallisce, usa NextAuth ID se disponibile
    if (nextAuthUserId) {
      console.log(
        `ℹ️ [SUPABASE] Fallback a NextAuth user.id dopo errore: ${nextAuthUserId.substring(0, 8)}...`
      );
      return nextAuthUserId;
    }
    return null;
  }
}

/**
 * Helper: Converte un valore in numero o null (gestisce false, undefined, null, stringhe)
 */
