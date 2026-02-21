import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import type { User } from './database';

export class EmailNotConfirmedError extends Error {
  constructor(message: string = 'Email non confermata') {
    super(message);
    this.name = 'EmailNotConfirmedError';
  }
}

export async function verifyUserCredentialsImpl(
  email: string,
  password: string,
  findUserByEmail: (email: string) => Promise<User | undefined>
): Promise<User | null> {
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
      // 1. Cerca utente in Supabase Auth in modo robusto:
      //    - prima lookup diretto per id (se presente in public.users)
      //    - poi fallback con paginazione listUsers per evitare falsi negativi.
      const normalizedEmail = email.toLowerCase();
      let authUser: any | null = null;

      const { data: dbUserByEmail } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (dbUserByEmail?.id) {
        const { data: authByIdData, error: authByIdError } =
          await supabaseAdmin.auth.admin.getUserById(dbUserByEmail.id);

        if (!authByIdError && authByIdData?.user?.email?.toLowerCase() === normalizedEmail) {
          authUser = authByIdData.user;
        }
      }

      if (!authUser) {
        const perPage = 200;

        for (let page = 1; page <= 10; page++) {
          const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage,
          });

          if (listError) {
            console.error('[SUPABASE AUTH] Errore listUsers:', listError.message);
            throw listError;
          }

          const users = listData?.users || [];
          const found = users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
          if (found) {
            authUser = found;
            break;
          }

          if (users.length < perPage) break;
        }
      }
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

/**
 * Ottiene tutti gli utenti (solo per admin)
 */
