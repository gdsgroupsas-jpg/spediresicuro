import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import type { User } from './database';

type CreateUserInput = {
  email: string;
  password: string;
  name: string;
  role?: 'user' | 'admin';
  accountType?: 'user' | 'admin';
  provider?: 'credentials' | 'google' | 'github' | 'facebook';
  providerId?: string;
  image?: string;
  parentAdminId?: string;
};

type CreateUserDeps = {
  findUserByEmail: (email: string) => Promise<User | undefined>;
  readDatabase: () => any;
  writeDatabase: (data: any) => void;
};

export async function createUserImpl(
  userData: CreateUserInput,
  deps: CreateUserDeps
): Promise<User> {
  // Verifica se l'utente esiste già (controlla sia JSON che Supabase)
  const existingUser = await deps.findUserByEmail(userData.email);
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
          const db = deps.readDatabase();
          db.utenti.push(newUser);
          deps.writeDatabase(db);
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
    const db = deps.readDatabase();
    db.utenti.push(newUser);
    deps.writeDatabase(db);
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
