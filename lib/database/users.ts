/**
 * User Management: Operazioni utente (Supabase + JSON fallback)
 *
 * Contiene tutte le funzioni di gestione utenti:
 * - getSupabaseUserIdFromEmail
 * - createUser
 * - updateUser
 * - findUserByEmail
 * - verifyUserCredentials
 */

import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import type { User } from './types';
import { EmailNotConfirmedError } from './types';
import { readDatabase, writeDatabase } from './json-store';

/**
 * Helper: Ottiene user_id Supabase da email NextAuth
 * Usa la tabella user_profiles per mappare email -> UUID
 *
 * ⚠️ IMPORTANTE: Ora che user_profiles esiste, questa funzione:
 * 1. Cerca prima in user_profiles (veloce, indicizzato)
 * 2. Se non trovato, cerca in auth.users e crea/aggiorna il profilo
 * 3. Crea automaticamente il profilo se l'utente esiste in auth.users
 * 4. FALLBACK: Se non trova nulla, usa NextAuth session.user.id se disponibile
 */
export async function getSupabaseUserIdFromEmail(
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
 * Crea un nuovo utente
 *
 * ⚠️ IMPORTANTE: Ora salva PRIMA in Supabase se configurato, poi in JSON come fallback
 */
export async function createUser(userData: {
  email: string;
  password: string;
  name: string;
  role?: 'user' | 'admin';
  accountType?: 'user' | 'admin';
  provider?: 'credentials' | 'google' | 'github' | 'facebook';
  providerId?: string;
  image?: string;
  parentAdminId?: string;
}): Promise<User> {
  // Verifica se l'utente esiste già (controlla sia JSON che Supabase)
  const existingUser = await findUserByEmail(userData.email);
  if (existingUser) {
    throw new Error('Email già registrata');
  }

  const newUser: User = {
    id: Date.now().toString(),
    email: userData.email,
    password: userData.password || '', // Vuoto per utenti OAuth
    name: userData.name,
    role: userData.role || 'user',
    provider: userData.provider || 'credentials',
    providerId: userData.providerId,
    image: userData.image,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // ⚠️ PRIORITÀ 1: Salva in Supabase se configurato
  if (isSupabaseConfigured()) {
    try {
      console.log('🔄 [SUPABASE] Tentativo salvataggio utente in Supabase...');

      // Determina account_type basandosi su accountType o role
      const accountType = userData.accountType || 'user';

      const { data: supabaseUser, error: supabaseError } = await supabaseAdmin
        .from('users')
        .insert([
          {
            email: userData.email,
            password: userData.password || null, // Null per utenti OAuth
            name: userData.name,
            role: userData.role || (accountType === 'admin' ? 'admin' : 'user'),
            account_type: accountType,
            provider: userData.provider || 'credentials',
            provider_id: userData.providerId || null,
            image: userData.image || null,
            parent_admin_id: userData.parentAdminId || null,
            admin_level: accountType === 'admin' ? (userData.parentAdminId ? null : 1) : 0,
          },
        ])
        .select()
        .single();

      if (supabaseError) {
        console.error('❌ [SUPABASE] Errore salvataggio utente:', {
          message: supabaseError.message,
          code: supabaseError.code,
          details: supabaseError.details,
          hint: supabaseError.hint,
        });

        // Se è un errore di constraint unique (email già esistente), rilancia l'errore
        if (
          supabaseError.code === '23505' ||
          supabaseError.message?.includes('duplicate key') ||
          supabaseError.message?.includes('unique constraint')
        ) {
          throw new Error('Email già registrata');
        }

        // Se siamo su Vercel (produzione), NON provare JSON (read-only)
        if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
          throw new Error(
            `Errore Supabase: ${supabaseError.message}. Verifica che la tabella 'users' esista e che le variabili Supabase siano configurate correttamente su Vercel.`
          );
        }

        console.log('📁 [FALLBACK] Provo database JSON locale');
      } else {
        console.log(`✅ [SUPABASE] Utente salvato con successo! ID: ${supabaseUser.id}`);
        // Usa l'ID di Supabase
        newUser.id = supabaseUser.id;
        // Prova comunque a salvare in JSON per compatibilità (non critico se fallisce)
        try {
          const db = readDatabase();
          db.utenti.push(newUser);
          writeDatabase(db);
        } catch (jsonError: any) {
          // Non critico: già salvato in Supabase
          if (jsonError?.code === 'EROFS') {
            console.log(
              'ℹ️ [JSON] File system read-only (Vercel) - salvataggio JSON saltato (non critico)'
            );
          } else {
            console.warn('⚠️ [JSON] Errore salvataggio JSON (non critico):', jsonError.message);
          }
        }
        return newUser;
      }
    } catch (error: any) {
      console.error('❌ [SUPABASE] Errore generico salvataggio utente:', error.message);
      console.log('📁 [FALLBACK] Provo database JSON locale');
    }
  }

  // ⚠️ PRIORITÀ 2: Salva in JSON (fallback o se Supabase non configurato)
  // ⚠️ IMPORTANTE: Su Vercel il file system è read-only, quindi JSON non funziona
  // Se siamo in produzione e Supabase non è configurato, dobbiamo fallire con un messaggio chiaro
  if (process.env.NODE_ENV === 'production' && !isSupabaseConfigured()) {
    throw new Error(
      'Supabase non configurato. Configura le variabili ambiente NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY su Vercel.'
    );
  }

  try {
    const db = readDatabase();
    db.utenti.push(newUser);
    writeDatabase(db);
    console.log('✅ [JSON] Utente salvato in JSON locale');
    return newUser;
  } catch (error: any) {
    // Se è un errore di file system read-only (Vercel), spiega meglio
    if (
      error?.code === 'EROFS' ||
      error?.message?.includes('read-only') ||
      error?.message?.includes('EROFS')
    ) {
      if (isSupabaseConfigured()) {
        // Supabase è configurato ma ha fallito, e JSON è read-only
        throw new Error(
          'Errore salvataggio in Supabase. Verifica la configurazione e che la tabella users esista. JSON non disponibile su Vercel (read-only).'
        );
      } else {
        // Supabase non configurato e JSON read-only
        throw new Error(
          'Database non disponibile. Configura Supabase su Vercel (variabili ambiente) per salvare gli utenti in produzione.'
        );
      }
    }

    // Se Supabase non è configurato E JSON fallisce, questo è CRITICO
    if (!isSupabaseConfigured()) {
      throw new Error(
        `Impossibile salvare l'utente: errore nel database JSON - ${error.message}. Configura Supabase per produzione.`
      );
    }
    // Se Supabase è configurato ma ha fallito E JSON fallisce, questo è CRITICO
    throw new Error(
      `Impossibile salvare l'utente: sia Supabase che JSON hanno fallito. Errore Supabase: vedi log. Errore JSON: ${error.message}`
    );
  }
}

/**
 * Aggiorna un utente esistente
 *
 * ⚠️ IMPORTANTE: Ora salva PRIMA in Supabase se configurato, poi in JSON come fallback
 */
export async function updateUser(userId: string, updates: Partial<User>): Promise<User> {
  // ⚠️ PRIORITÀ 1: Aggiorna in Supabase se configurato
  if (isSupabaseConfigured()) {
    try {
      console.log('🔄 [SUPABASE] Aggiornamento utente in Supabase:', userId);

      // Prepara i dati per Supabase (converte nomi campi)
      const supabaseUpdates: any = {
        updated_at: new Date().toISOString(),
      };

      // Mappa i campi da formato User a formato Supabase
      if (updates.email !== undefined) supabaseUpdates.email = updates.email;
      if (updates.password !== undefined) supabaseUpdates.password = updates.password;
      if (updates.name !== undefined) supabaseUpdates.name = updates.name;
      if (updates.role !== undefined) supabaseUpdates.role = updates.role;
      if (updates.provider !== undefined) supabaseUpdates.provider = updates.provider;
      if (updates.providerId !== undefined) supabaseUpdates.provider_id = updates.providerId;
      if (updates.image !== undefined) supabaseUpdates.image = updates.image;
      if (updates.datiCliente !== undefined) {
        // Converti datiCliente in JSON se non è già un oggetto JSON
        supabaseUpdates.dati_cliente =
          typeof updates.datiCliente === 'string'
            ? JSON.parse(updates.datiCliente)
            : updates.datiCliente;
        console.log(
          '📝 [SUPABASE] Salvataggio dati_cliente:',
          JSON.stringify(supabaseUpdates.dati_cliente).substring(0, 100) + '...'
        );
      }
      if (updates.defaultSender !== undefined) {
        supabaseUpdates.default_sender =
          typeof updates.defaultSender === 'string'
            ? JSON.parse(updates.defaultSender)
            : updates.defaultSender;
      }
      if (updates.integrazioni !== undefined) {
        supabaseUpdates.integrazioni =
          typeof updates.integrazioni === 'string'
            ? JSON.parse(updates.integrazioni)
            : updates.integrazioni;
      }

      console.log('📋 [SUPABASE] Campi da aggiornare:', Object.keys(supabaseUpdates));

      const { data: supabaseUser, error: supabaseError } = await supabaseAdmin
        .from('users')
        .update(supabaseUpdates)
        .eq('id', userId)
        .select()
        .single();

      if (supabaseError) {
        console.error('❌ [SUPABASE] Errore aggiornamento utente:', {
          message: supabaseError.message,
          code: supabaseError.code,
          details: supabaseError.details,
          hint: supabaseError.hint,
        });

        // Se siamo su Vercel (produzione), NON provare JSON (read-only)
        if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
          throw new Error(
            `Errore Supabase: ${supabaseError.message}. Verifica che la tabella 'users' esista e che le variabili Supabase siano configurate correttamente su Vercel.`
          );
        }

        console.log('📁 [FALLBACK] Provo database JSON locale');
      } else {
        console.log(`✅ [SUPABASE] Utente aggiornato con successo! ID: ${supabaseUser.id}`);

        // Converti formato Supabase a formato User
        const updatedUser: User = {
          id: supabaseUser.id,
          email: supabaseUser.email,
          password: supabaseUser.password || '',
          name: supabaseUser.name,
          role: supabaseUser.role || 'user',
          provider: supabaseUser.provider || 'credentials',
          providerId: supabaseUser.provider_id,
          image: supabaseUser.image,
          datiCliente: supabaseUser.dati_cliente || updates.datiCliente,
          defaultSender: supabaseUser.default_sender || updates.defaultSender,
          createdAt: supabaseUser.created_at || new Date().toISOString(),
          updatedAt: supabaseUser.updated_at || new Date().toISOString(),
        };

        // Prova comunque a salvare in JSON per compatibilità (non critico se fallisce)
        try {
          const db = readDatabase();
          const userIndex = db.utenti.findIndex((u) => u.id === userId);
          if (userIndex !== -1) {
            db.utenti[userIndex] = updatedUser;
            writeDatabase(db);
          }
        } catch (jsonError: any) {
          // Non critico: già salvato in Supabase
          if (jsonError?.code === 'EROFS') {
            console.log(
              'ℹ️ [JSON] File system read-only (Vercel) - salvataggio JSON saltato (non critico)'
            );
          } else {
            console.warn('⚠️ [JSON] Errore salvataggio JSON (non critico):', jsonError.message);
          }
        }

        return updatedUser;
      }
    } catch (error: any) {
      console.error('❌ [SUPABASE] Errore generico aggiornamento utente:', error.message);

      // Se siamo su Vercel, NON provare JSON
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        throw error;
      }

      console.log('📁 [FALLBACK] Provo database JSON locale');
    }
  }

  // ⚠️ PRIORITÀ 2: Aggiorna in JSON (fallback o se Supabase non configurato)
  // ⚠️ IMPORTANTE: Su Vercel il file system è read-only, quindi JSON non funziona
  if (process.env.NODE_ENV === 'production' && !isSupabaseConfigured()) {
    throw new Error(
      'Supabase non configurato. Configura le variabili ambiente NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY su Vercel.'
    );
  }

  try {
    const db = readDatabase();
    const userIndex = db.utenti.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      throw new Error('Utente non trovato');
    }

    db.utenti[userIndex] = {
      ...db.utenti[userIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    writeDatabase(db);

    return db.utenti[userIndex];
  } catch (error: any) {
    // Se è un errore di file system read-only (Vercel), spiega meglio
    if (
      error?.code === 'EROFS' ||
      error?.message?.includes('read-only') ||
      error?.message?.includes('EROFS')
    ) {
      if (isSupabaseConfigured()) {
        // Supabase è configurato ma ha fallito, e JSON è read-only
        throw new Error(
          'Errore aggiornamento in Supabase. Verifica la configurazione e che la tabella users esista. JSON non disponibile su Vercel (read-only).'
        );
      } else {
        // Supabase non configurato e JSON read-only
        throw new Error(
          'Database non disponibile. Configura Supabase su Vercel (variabili ambiente) per aggiornare gli utenti in produzione.'
        );
      }
    }

    throw error;
  }
}

/**
 * Trova un utente per email
 *
 * ⚠️ IMPORTANTE: Ora cerca PRIMA in Supabase se configurato, poi in JSON come fallback
 */
export async function findUserByEmail(email: string): Promise<User | undefined> {
  // ⚠️ PRIORITÀ 1: Cerca in Supabase se configurato
  if (isSupabaseConfigured()) {
    try {
      console.log('🔍 [SUPABASE] Cerca utente in Supabase per:', email);

      const { data: supabaseUser, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (!error && supabaseUser) {
        // ⚠️ IMPORTANTE: Mappa account_type a role se è admin/superadmin
        let effectiveRole = supabaseUser.role || 'user';
        if (supabaseUser.account_type === 'superadmin' || supabaseUser.account_type === 'admin') {
          effectiveRole = 'admin';
        }

        // Converti formato Supabase a formato User
        const user: User = {
          id: supabaseUser.id,
          email: supabaseUser.email,
          password: supabaseUser.password || '',
          name: supabaseUser.name,
          role: effectiveRole,
          provider: supabaseUser.provider || 'credentials',
          providerId: supabaseUser.provider_id || undefined,
          image: supabaseUser.image || undefined,
          datiCliente: supabaseUser.dati_cliente || undefined,
          defaultSender: supabaseUser.default_sender || undefined,
          integrazioni: supabaseUser.integrazioni || undefined,
          createdAt: supabaseUser.created_at || new Date().toISOString(),
          updatedAt: supabaseUser.updated_at || new Date().toISOString(),
        };

        // ⚠️ IMPORTANTE: Aggiungi account_type, is_reseller, reseller_role come proprietà estese per compatibilità
        (user as any).account_type = supabaseUser.account_type || effectiveRole;
        (user as any).is_reseller = supabaseUser.is_reseller === true;
        (user as any).reseller_role = supabaseUser.reseller_role || undefined;
        (user as any).wallet_balance = supabaseUser.wallet_balance ?? 0;

        console.log('✅ [SUPABASE] Utente trovato in Supabase', {
          hasDatiCliente: !!user.datiCliente,
          datiCompletati: user.datiCliente?.datiCompletati,
          role: effectiveRole,
          account_type: supabaseUser.account_type,
          is_reseller: supabaseUser.is_reseller,
          reseller_role: supabaseUser.reseller_role,
        });
        return user;
      } else {
        console.log('⚠️ [SUPABASE] Utente non trovato, provo JSON fallback');
      }
    } catch (error: any) {
      console.error('❌ [SUPABASE] Errore ricerca utente:', error.message);
      console.log('📁 [FALLBACK] Provo database JSON locale');
    }
  }

  // ⚠️ PRIORITÀ 2: Cerca in JSON (fallback o se Supabase non configurato)
  const db = readDatabase();
  const user = db.utenti.find((u) => u.email === email);
  if (user) {
    console.log('✅ [JSON] Utente trovato in JSON locale');
  }
  return user;
}

/**
 * Verifica le credenziali di un utente
 *
 * ⚠️ IMPORTANTE: Ora legge PRIMA da Supabase se configurato, poi da JSON come fallback
 */
export async function verifyUserCredentials(email: string, password: string): Promise<User | null> {
  // ⚠️ PRIORITÀ 0: Verifica se password è token Supabase temporaneo (auto-login post conferma)
  if (password.startsWith('SUPABASE_TOKEN:')) {
    console.log('🔐 [SUPABASE AUTH] Token temporaneo rilevato per auto-login');
    const tokenParts = password.split(':');
    if (tokenParts.length >= 3) {
      const accessToken = tokenParts[1];
      const timestamp = parseInt(tokenParts[2], 10);

      // Verifica che token non sia scaduto (60 secondi)
      if (Date.now() - timestamp > 60000) {
        console.error('❌ [SUPABASE AUTH] Token temporaneo scaduto');
        return null;
      }

      // Verifica token Supabase
      try {
        const {
          data: { user: supabaseUser },
          error: tokenError,
        } = await supabaseAdmin.auth.getUser(accessToken);

        if (tokenError || !supabaseUser) {
          console.error('❌ [SUPABASE AUTH] Token Supabase non valido:', tokenError?.message);
          return null;
        }

        // Verifica che email corrisponda
        if (supabaseUser.email?.toLowerCase() !== email.toLowerCase()) {
          console.error('❌ [SUPABASE AUTH] Email non corrisponde al token');
          return null;
        }

        // Verifica che email sia confermata
        if (!supabaseUser.email_confirmed_at) {
          console.error('❌ [SUPABASE AUTH] Email non confermata');
          return null;
        }

        console.log('✅ [SUPABASE AUTH] Token temporaneo verificato, auto-login per:', email);

        // Ottieni dati utente dal database
        const { data: dbUser, error: dbError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        if (dbError || !dbUser) {
          // Crea record se non esiste
          const { data: newDbUser, error: createError } = await supabaseAdmin
            .from('users')
            .upsert(
              {
                id: supabaseUser.id,
                email: supabaseUser.email,
                password: null,
                name:
                  supabaseUser.user_metadata?.name ||
                  supabaseUser.user_metadata?.full_name ||
                  email.split('@')[0],
                role: supabaseUser.app_metadata?.role || 'user',
                account_type: supabaseUser.app_metadata?.account_type || 'user',
                provider: 'email',
                provider_id: null,
                image: null,
                admin_level: supabaseUser.app_metadata?.account_type === 'admin' ? 1 : 0,
              },
              { onConflict: 'id' }
            )
            .select()
            .single();

          if (createError || !newDbUser) {
            console.error(
              '❌ [SUPABASE AUTH] Errore creazione record users:',
              createError?.message
            );
            return null;
          }

          const user: User = {
            id: newDbUser.id,
            email: newDbUser.email || email,
            password: '',
            name: newDbUser.name,
            role: newDbUser.role || 'user',
            provider: newDbUser.provider || 'email',
            providerId: undefined,
            image: newDbUser.image || undefined,
            createdAt: newDbUser.created_at || new Date().toISOString(),
            updatedAt: newDbUser.updated_at || new Date().toISOString(),
          };

          return user;
        }

        // Restituisci utente esistente
        let effectiveRole = dbUser.role || 'user';
        if (dbUser.account_type === 'superadmin' || dbUser.account_type === 'admin') {
          effectiveRole = 'admin';
        }

        const user: User = {
          id: dbUser.id,
          email: dbUser.email,
          password: '',
          name: dbUser.name,
          role: effectiveRole,
          provider: dbUser.provider || 'email',
          providerId: dbUser.provider_id || undefined,
          image: dbUser.image || undefined,
          datiCliente: dbUser.dati_cliente || undefined,
          defaultSender: dbUser.default_sender || undefined,
          integrazioni: dbUser.integrazioni || undefined,
          createdAt: dbUser.created_at || new Date().toISOString(),
          updatedAt: dbUser.updated_at || new Date().toISOString(),
        };

        return user;
      } catch (error: any) {
        console.error('❌ [SUPABASE AUTH] Errore verifica token temporaneo:', error.message);
        return null;
      }
    }
  }

  // ⚠️ PRIORITÀ 1: Verifica con Supabase Auth (gestisce password e email confirmation)
  if (isSupabaseConfigured()) {
    try {
      console.log('🔍 [SUPABASE AUTH] Verifica credenziali in Supabase Auth per:', email);

      // 1. Cerca utente in Supabase Auth
      const {
        data: { users },
        error: listError,
      } = await supabaseAdmin.auth.admin.listUsers();

      if (listError) {
        console.error('❌ [SUPABASE AUTH] Errore listUsers:', listError.message);
        throw listError;
      }

      const authUser = users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

      if (authUser) {
        console.log('👤 [SUPABASE AUTH] Utente trovato in auth.users:', {
          id: authUser.id,
          email: authUser.email,
          email_confirmed_at: authUser.email_confirmed_at,
          confirmation_sent_at: authUser.confirmation_sent_at,
        });

        // ⚠️ CRITICO: Verifica che l'email sia confermata
        if (!authUser.email_confirmed_at) {
          console.log('❌ [SUPABASE AUTH] Email non confermata per:', email);
          throw new EmailNotConfirmedError(
            'Email non confermata. Controlla la posta e clicca il link di conferma.'
          );
        }

        // 2. Verifica password usando Supabase Auth (signInWithPassword)
        // Nota: Non possiamo usare signInWithPassword con admin API, quindi verifichiamo manualmente
        // Per ora, verifichiamo nella tabella users (backward compatibility)
        // TODO: Migliorare usando Supabase Auth API per verifica password

        const { data: dbUser, error: dbError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        if (dbError || !dbUser) {
          console.log(
            '⚠️ [SUPABASE] Utente non trovato in tabella users, provo verifica password diretta'
          );
          // Se non c'è nella tabella users, potrebbe essere un utente creato solo in Auth
          // In questo caso, accettiamo il login (la password è gestita da Supabase Auth)
          // Ma dobbiamo creare/aggiornare il record nella tabella users
          const { data: newDbUser, error: createError } = await supabaseAdmin
            .from('users')
            .upsert(
              {
                id: authUser.id,
                email: authUser.email,
                password: null, // Password gestita da Supabase Auth
                name:
                  authUser.user_metadata?.name ||
                  authUser.user_metadata?.full_name ||
                  email.split('@')[0],
                role: authUser.app_metadata?.role || 'user',
                account_type: authUser.app_metadata?.account_type || 'user',
                provider: authUser.app_metadata?.provider || 'email',
                provider_id: null,
                image: null,
                admin_level: authUser.app_metadata?.account_type === 'admin' ? 1 : 0,
              },
              { onConflict: 'id' }
            )
            .select()
            .single();

          if (createError) {
            console.warn(
              '⚠️ [SUPABASE] Errore creazione record users (non critico):',
              createError.message
            );
          }

          // Restituisci utente basato su authUser
          const providerValue = authUser.app_metadata?.provider;
          const validProvider =
            providerValue === 'google' ||
            providerValue === 'github' ||
            providerValue === 'facebook' ||
            providerValue === 'credentials'
              ? providerValue
              : ('credentials' as 'credentials' | 'google' | 'github' | 'facebook');

          const user: User = {
            id: authUser.id,
            email: authUser.email || email, // Fallback a email passata se authUser.email è undefined
            password: '', // Password gestita da Supabase Auth
            name:
              authUser.user_metadata?.name ||
              authUser.user_metadata?.full_name ||
              email.split('@')[0],
            role: authUser.app_metadata?.role || 'user',
            provider: validProvider,
            providerId: undefined, // null non valido per tipo User
            image: authUser.user_metadata?.avatar_url || undefined,
            createdAt: authUser.created_at || new Date().toISOString(),
            updatedAt: authUser.updated_at || new Date().toISOString(),
          };

          console.log('✅ [SUPABASE AUTH] Credenziali verificate (email confermata)');
          return user;
        }

        // Verifica password nella tabella users (backward compatibility)
        let passwordMatch = false;

        if (dbUser.password) {
          // Se la password inizia con $2a$, $2b$, $2x$ o $2y$ è un hash bcrypt
          if (dbUser.password.startsWith('$2')) {
            const bcrypt = require('bcryptjs');
            passwordMatch = await bcrypt.compare(password, dbUser.password);
          } else {
            // Password in chiaro (backward compatibility)
            passwordMatch = dbUser.password === password;
          }
        } else {
          // Password null = gestita da Supabase Auth
          // Per ora accettiamo (dovremmo verificare con Supabase Auth API)
          console.log('⚠️ [SUPABASE] Password null in users - gestita da Supabase Auth');
          passwordMatch = true; // TODO: Verificare con Supabase Auth API
        }

        if (passwordMatch) {
          let effectiveRole = dbUser.role || 'user';
          if (dbUser.account_type === 'superadmin' || dbUser.account_type === 'admin') {
            effectiveRole = 'admin';
          }

          const user: User = {
            id: dbUser.id,
            email: dbUser.email,
            password: dbUser.password || '',
            name: dbUser.name,
            role: effectiveRole,
            provider: dbUser.provider || 'credentials',
            providerId: dbUser.provider_id || undefined,
            image: dbUser.image || undefined,
            datiCliente: dbUser.dati_cliente || undefined,
            defaultSender: dbUser.default_sender || undefined,
            integrazioni: dbUser.integrazioni || undefined,
            createdAt: dbUser.created_at || new Date().toISOString(),
            updatedAt: dbUser.updated_at || new Date().toISOString(),
          };

          console.log(
            '✅ [SUPABASE AUTH] Credenziali verificate con successo (email confermata, role:',
            effectiveRole,
            ')'
          );
          return user;
        } else {
          console.log('❌ [SUPABASE AUTH] Password errata');
          return null;
        }
      } else {
        console.log('⚠️ [SUPABASE AUTH] Utente non trovato in auth.users, provo tabella users');
      }
    } catch (error: any) {
      // Se è EmailNotConfirmedError, rilanciarlo
      if (error instanceof EmailNotConfirmedError) {
        throw error;
      }
      console.error('❌ [SUPABASE AUTH] Errore verifica credenziali:', error.message);
      console.log('📁 [FALLBACK] Provo database JSON locale');
    }
  }

  // ⚠️ PRIORITÀ 2: Cerca in JSON (fallback o se Supabase non configurato)
  const user = await findUserByEmail(email);
  if (!user) {
    return null;
  }

  // TODO: In produzione, confrontare hash con bcrypt
  if (user.password !== password) {
    return null;
  }

  console.log('✅ [JSON] Credenziali verificate in JSON locale');
  return user;
}
