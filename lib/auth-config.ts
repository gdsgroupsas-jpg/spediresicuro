/**
 * NextAuth Configuration (v5)
 *
 * Configurazione centralizzata per NextAuth.js v5
 * Supporta: Credentials, Google OAuth, GitHub OAuth
 */

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GitHubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';

// Validazione configurazione OAuth
function validateOAuthConfig() {
  const hasGoogle = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const hasGitHub = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  const nextAuthUrl = getNextAuthUrl();
  const hasNextAuthSecret = !!process.env.NEXTAUTH_SECRET;
  const hasNextAuthUrl = !!process.env.NEXTAUTH_URL;

  // Log sempre in produzione per debug
  console.log('🔍 [AUTH CONFIG] OAuth Config Check:', {
    google: hasGoogle ? '✅ Configurato' : '⚠️ Non configurato',
    github: hasGitHub ? '✅ Configurato' : '⚠️ Non configurato',
    nextAuthUrl: nextAuthUrl,
    hasNextAuthUrl: hasNextAuthUrl,
    hasNextAuthSecret: hasNextAuthSecret,
    vercelUrl: process.env.VERCEL_URL || 'N/A',
    nodeEnv: process.env.NODE_ENV || 'N/A',
  });

  // ⚠️ Errori critici che causano "Configuration"
  const criticalErrors: string[] = [];
  const warnings: string[] = [];

  if (!hasNextAuthSecret) {
    criticalErrors.push('❌ NEXTAUTH_SECRET non configurato - OBBLIGATORIO!');
  }

  if (process.env.NODE_ENV === 'production' && !hasNextAuthUrl && !process.env.VERCEL_URL) {
    warnings.push('⚠️ NEXTAUTH_URL non configurato - consigliato in produzione');
  }

  if (hasGoogle && process.env.NODE_ENV === 'production') {
    if (!nextAuthUrl.startsWith('https://') && !process.env.VERCEL_URL) {
      warnings.push('⚠️ NEXTAUTH_URL deve essere HTTPS in produzione!');
    }
    console.log('📝 [AUTH CONFIG] Verifica che il callback URL sia configurato in Google Console:');
    console.log(`   ${nextAuthUrl}/api/auth/callback/google`);
  }

  if (criticalErrors.length > 0) {
    console.error('❌ [AUTH CONFIG] ERRORI CRITICI - Causano "Configuration":');
    criticalErrors.forEach((error) => console.error(`   ${error}`));
  }

  if (warnings.length > 0) {
    console.warn('⚠️ [AUTH CONFIG] Avvisi (non bloccanti):');
    warnings.forEach((warning) => console.warn(`   ${warning}`));
  }

  if (criticalErrors.length === 0 && warnings.length === 0) {
    console.log('✅ [AUTH CONFIG] Configurazione OAuth valida');
  }

  return { hasGoogle, hasGitHub };
}

// Verifica configurazione all'avvio
validateOAuthConfig();

// Determina URL base per NextAuth (locale o produzione)
function getNextAuthUrl(): string {
  // ⚠️ IMPORTANTE: In produzione su Vercel, rileva automaticamente l'URL corretto
  // per evitare redirect a localhost:3000

  // Se siamo su Vercel (produzione o preview)
  if (process.env.VERCEL_URL) {
    const vercelUrl = `https://${process.env.VERCEL_URL}`;
    console.log('🌐 [AUTH] Rilevato URL Vercel:', vercelUrl);

    // Se NEXTAUTH_URL è configurato ma punta a localhost, ignoralo e usa VERCEL_URL
    if (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.includes('localhost')) {
      console.warn('⚠️ [AUTH] NEXTAUTH_URL punta a localhost, uso VERCEL_URL invece');
      return vercelUrl;
    }

    // Se NEXTAUTH_URL è configurato correttamente (non localhost), usalo
    if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes('localhost')) {
      console.log('✅ [AUTH] Usando NEXTAUTH_URL configurato:', process.env.NEXTAUTH_URL);
      return process.env.NEXTAUTH_URL;
    }

    // Altrimenti usa VERCEL_URL
    return vercelUrl;
  }

  // Se NEXTAUTH_URL è configurato e non siamo su Vercel, usalo
  if (process.env.NEXTAUTH_URL) {
    console.log('✅ [AUTH] Usando NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
    return process.env.NEXTAUTH_URL;
  }

  // Fallback per sviluppo locale
  const fallbackUrl =
    process.env.NODE_ENV === 'production'
      ? 'https://spediresicuro.vercel.app' // Dominio Vercel produzione (fallback)
      : 'http://localhost:3000';

  console.log('📝 [AUTH] Usando URL fallback:', fallbackUrl);
  return fallbackUrl;
}

// ⚠️ IMPORTANTE: Valida configurazione prima di creare authOptions
const nextAuthUrl = getNextAuthUrl();
const nextAuthSecret = process.env.NEXTAUTH_SECRET;

// Log configurazione per debug
console.log('🔍 [AUTH CONFIG] Configurazione NextAuth:', {
  nextAuthUrl,
  hasNextAuthSecret: !!nextAuthSecret,
  hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
  vercelUrl: process.env.VERCEL_URL || 'N/A',
  nodeEnv: process.env.NODE_ENV || 'N/A',
});

// ⚠️ Verifica che NEXTAUTH_SECRET sia configurato in produzione
if (process.env.NODE_ENV === 'production' && !nextAuthSecret) {
  console.error('❌ [AUTH CONFIG] ERRORE CRITICO: NEXTAUTH_SECRET non configurato in produzione!');
  console.error('❌ [AUTH CONFIG] Questo causerà l\'errore "Configuration" in NextAuth.');
  console.error(
    '❌ [AUTH CONFIG] Vai su Vercel → Settings → Environment Variables e aggiungi NEXTAUTH_SECRET'
  );
}

export const authOptions = {
  // URL base per NextAuth (necessario per OAuth callbacks)
  basePath: '/api/auth',
  // Trust host per permettere callbacks dinamici (importante per Vercel)
  trustHost: true,
  // URL esplicito per produzione
  url: nextAuthUrl,
  providers: [
    // Provider Credentials (Email/Password)
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials: Partial<Record<string, unknown>> | undefined) {
        console.log('🔐 [AUTH] authorize chiamato con:', {
          hasEmail: !!credentials?.email,
          hasPassword: !!credentials?.password,
          email: credentials?.email,
        });

        // Type guard per verificare che le credenziali siano valide
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ [AUTH] Credenziali mancanti');
          return null;
        }

        try {
          // Verifica credenziali dal database
          console.log('🔍 [AUTH] Importazione verifyUserCredentials...');
          const { verifyUserCredentials } = await import('@/lib/database');

          console.log('🔍 [AUTH] Verifica credenziali per:', credentials.email);
          const user = await verifyUserCredentials(
            credentials.email as string,
            credentials.password as string
          );

          if (user) {
            console.log('✅ [AUTH] Utente trovato:', {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              provider: user.provider,
            });
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
            };
          } else {
            console.log('❌ [AUTH] Utente non trovato o password errata per:', credentials.email);
            // Se è un utente demo e non è stato trovato, potrebbe essere un problema di inizializzazione
            if (
              credentials.email === 'admin@spediresicuro.it' ||
              credentials.email === 'demo@spediresicuro.it'
            ) {
              console.warn('⚠️ [AUTH] ATTENZIONE: Utente demo non trovato dopo inizializzazione!');
            }
          }
        } catch (error: any) {
          // ⚠️ CRITICO: Gestione errore email non confermata (check robusto senza instanceof)
          const isEmailNotConfirmed =
            error?.name === 'EmailNotConfirmedError' ||
            error?.message?.includes('Email non confermata') ||
            error?.message?.includes('email non confermata') ||
            error?.message?.includes('EMAIL_NOT_CONFIRMED');

          if (isEmailNotConfirmed) {
            console.log('❌ [AUTH] Email non confermata per:', credentials.email);
            // Rilancia l'errore con un messaggio che NextAuth può gestire
            throw new Error('EMAIL_NOT_CONFIRMED');
          }

          console.error('❌ [AUTH] Errore durante verifica credenziali:', {
            message: error?.message,
            stack: error?.stack,
            name: error?.name,
          });
        }

        return null;
      },
    }),

    // Google OAuth Provider (solo se configurato)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true, // Permette linking account con stessa email
            // ⚠️ IMPORTANTE: Configurazione esplicita per produzione
            authorization: {
              params: {
                prompt: 'consent',
                access_type: 'offline',
                response_type: 'code',
              },
            },
          }),
        ]
      : []),

    // GitHub OAuth Provider (solo se configurato)
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
    // ⚠️ IMPORTANTE: Non reindirizzare a /login dopo OAuth callback
    // NextAuth gestirà il redirect tramite il callback redirect
  },
  callbacks: {
    async signIn({ user, account, profile }: any) {
      console.log('🔐 [NEXTAUTH] signIn callback chiamato:', {
        provider: account?.provider,
        email: user?.email,
        hasAccount: !!account,
        hasProfile: !!profile,
      });

      // Se l'utente si registra tramite OAuth, crealo/aggiornalo nel database
      if (account?.provider !== 'credentials' && user?.email) {
        try {
          console.log('📝 [NEXTAUTH] Creazione/aggiornamento utente OAuth per:', user.email);
          const { findUserByEmail, createUser, updateUser } = await import('@/lib/database');

          let dbUser = await findUserByEmail(user.email);
          console.log('👤 [NEXTAUTH] Utente esistente trovato:', !!dbUser);

          if (!dbUser) {
            // Crea nuovo utente OAuth
            console.log('➕ [NEXTAUTH] Creazione nuovo utente OAuth');
            const newUser = await createUser({
              email: user.email,
              password: '', // Password vuota per utenti OAuth
              name: user.name || user.email.split('@')[0] || 'Utente',
              role: 'user',
              provider: account?.provider as 'google' | 'github',
              providerId: account?.providerAccountId,
              image: user.image || undefined,
            });
            console.log('✅ [NEXTAUTH] Nuovo utente OAuth creato con successo');
            dbUser = newUser; // Salva il nuovo utente creato
          } else if (account?.provider && !dbUser.provider) {
            // Aggiorna utente esistente con provider OAuth
            console.log('🔄 [NEXTAUTH] Aggiornamento utente esistente con provider OAuth');
            await updateUser(dbUser.id, {
              provider: account.provider as 'google' | 'github',
              providerId: account.providerAccountId,
              image: user.image || undefined,
            });
            console.log('✅ [NEXTAUTH] Utente aggiornato con successo');
          }

          // ⚠️ CRITICAL FIX: Assegna l'ID del database all'utente OAuth
          // Questo assicura che user.id sia l'ID del nostro database, non l'ID di Google/GitHub
          if (dbUser) {
            user.id = dbUser.id;
            user.role = dbUser.role;
            console.log('✅ [NEXTAUTH] ID database assegnato a user OAuth:', {
              userId: user.id,
              userRole: user.role,
              email: user.email,
            });
          }

          // ⚠️ NUOVO: Crea/aggiorna profilo in user_profiles Supabase
          try {
            const { supabaseAdmin } = await import('@/lib/supabase');
            const { isSupabaseConfigured } = await import('@/lib/supabase');

            if (isSupabaseConfigured()) {
              await supabaseAdmin.from('user_profiles').upsert(
                {
                  email: user.email,
                  name: user.name || user.email.split('@')[0],
                  provider: account?.provider || 'credentials',
                  provider_id: account?.providerAccountId || null,
                  nextauth_user_id: user.id || null,
                },
                { onConflict: 'email' }
              );
              console.log(
                `✅ [SUPABASE] Profilo utente sincronizzato in user_profiles per ${user.email}`
              );
            }
          } catch (supabaseError: any) {
            // Non bloccare il login se la sincronizzazione Supabase fallisce
            console.warn('⚠️ [SUPABASE] Errore sincronizzazione profilo:', supabaseError.message);
          }
        } catch (error: any) {
          console.error('❌ [NEXTAUTH] Errore gestione utente OAuth:', error);
          console.error('❌ [NEXTAUTH] Dettagli errore:', {
            message: error?.message,
            stack: error?.stack,
            name: error?.name,
          });
          // ⚠️ IMPORTANTE: Non bloccare il login, ma logga tutto per debug
          // Il login può continuare anche se la creazione utente fallisce
        }
      }

      // ⚠️ AUTO-PROMOZIONE SUPERADMIN
      // Lista email autorizzate come superadmin (hardcoded per sicurezza)
      const AUTHORIZED_SUPERADMINS = [
        'sigorn@hotmail.it',
        'gdsgroupsas@gmail.com',
        'admin@spediresicuro.it',
        'salvatore.squillante@gmail.com',
      ];

      if (user?.email && AUTHORIZED_SUPERADMINS.includes(user.email)) {
        try {
          console.log('👑 [AUTO-PROMOTE] Email autorizzata rilevata:', user.email);
          const { supabaseAdmin } = await import('@/lib/db/client');

          // Verifica se l'utente è già superadmin
          const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('account_type')
            .eq('email', user.email)
            .single();

          if (existingUser?.account_type !== 'superadmin') {
            console.log('🔄 [AUTO-PROMOTE] Promozione a superadmin in corso...');

            // Aggiorna utente a superadmin
            const { error: updateError } = await supabaseAdmin
              .from('users')
              .update({
                account_type: 'superadmin',
                admin_level: 0,
                parent_admin_id: null,
                role: 'admin',
                updated_at: new Date().toISOString(),
              })
              .eq('email', user.email);

            if (!updateError) {
              console.log('✅ [AUTO-PROMOTE] Utente promosso a superadmin automaticamente');
              user.role = 'admin'; // Aggiorna anche il ruolo nella sessione

              // Log audit
              try {
                await supabaseAdmin.from('audit_logs').insert({
                  user_id: user.id,
                  action: 'auto_promote_superadmin_at_login',
                  severity: 'info',
                  message: `Auto-promozione a superadmin al login: ${user.email}`,
                  metadata: { email: user.email, account_type: 'superadmin' },
                  created_at: new Date().toISOString(),
                });
              } catch (auditError) {
                console.warn('⚠️ [AUTO-PROMOTE] Errore audit log (non critico)');
              }
            } else {
              console.error('❌ [AUTO-PROMOTE] Errore durante promozione:', updateError);
            }
          } else {
            console.log('✅ [AUTO-PROMOTE] Utente già superadmin');
          }
        } catch (error: any) {
          console.error('❌ [AUTO-PROMOTE] Errore auto-promozione:', error?.message);
          // Non bloccare il login
        }
      }

      // ⚠️ NUOVO: Aggiorna last_login_at per metriche Active Users
      // Fail-safe: non blocca il login se fallisce
      // Rollback: TRACK_LAST_LOGIN=false
      if (user?.email) {
        try {
          const { updateLastLogin } = await import('@/lib/metrics/login-tracker');
          await updateLastLogin(user.email);
        } catch (error: any) {
          // Già gestito in updateLastLogin, questo è solo safety extra
          console.warn(
            '⚠️ [NEXTAUTH] updateLastLogin wrapper error (non-blocking):',
            error.message
          );
        }
      }

      console.log('✅ [NEXTAUTH] signIn callback completato con successo');
      return true;
    },
    async jwt({ token, user, account }: any) {
      // Prima chiamata (dopo login)
      if (user) {
        console.log('🔐 [NEXTAUTH] jwt callback - creazione token per utente:', {
          id: user.id,
          email: user.email,
          role: user.role,
          provider: account?.provider,
        });
        token.id = user.id; // ⚠️ IMPORTANTE: Salva ID utente nel token
        token.role = (user.role as string) || 'user';
        token.provider = account?.provider || 'credentials';
        token.email = user.email;
        token.name = user.name;

        // ⚠️ NUOVO: Carica campi reseller e wallet da Supabase se disponibile
        if (user.email && typeof window === 'undefined') {
          // Solo server-side
          try {
            const { supabaseAdmin } = await import('@/lib/db/client');
            const { data: userData, error } = await supabaseAdmin
              .from('users')
              .select(
                'id, is_reseller, reseller_role, parent_id, wallet_balance, account_type, dati_cliente'
              )
              .eq('email', user.email)
              .single();

            if (!error && userData) {
              token.is_reseller = userData.is_reseller || false;
              token.reseller_role = userData.reseller_role || null;
              token.parent_id = userData.parent_id || null;
              token.wallet_balance = parseFloat(userData.wallet_balance || '0') || 0;
              token.account_type = userData.account_type || 'user';
              // Onboarding status from dati_cliente JSONB
              token.onboarding_complete = userData.dati_cliente?.datiCompletati === true;

              console.log('✅ [NEXTAUTH] Campi reseller/wallet/onboarding caricati:', {
                is_reseller: token.is_reseller,
                reseller_role: token.reseller_role,
                parent_id: token.parent_id,
                wallet_balance: token.wallet_balance,
                account_type: token.account_type,
                onboarding_complete: token.onboarding_complete,
              });
            }
          } catch (error: any) {
            console.warn(
              '⚠️ [NEXTAUTH] Errore caricamento campi reseller/wallet (non critico):',
              error.message
            );
            // Non critico, usa valori di default
            token.is_reseller = false;
            token.reseller_role = null;
            token.parent_id = null;
            token.wallet_balance = 0;
            token.account_type = 'user';
            token.onboarding_complete = false;
          }
        }
      } else {
        console.log('🔄 [NEXTAUTH] jwt callback - aggiornamento token esistente:', {
          id: token.id,
          email: token.email,
          role: token.role,
          provider: token.provider,
          is_reseller: token.is_reseller,
          reseller_role: token.reseller_role,
          wallet_balance: token.wallet_balance,
          onboarding_complete: token.onboarding_complete,
        });

        // Aggiorna wallet_balance e onboarding_complete periodicamente
        if (token.email && typeof window === 'undefined') {
          const lastUpdate = (token.wallet_last_update as number) || 0;
          const now = Date.now();
          const fiveMinutes = 5 * 60 * 1000;

          // Refresh if: 5 min passed OR onboarding not complete (check more frequently)
          const shouldRefresh =
            now - lastUpdate > fiveMinutes || token.onboarding_complete !== true;

          if (shouldRefresh) {
            try {
              const { supabaseAdmin } = await import('@/lib/db/client');
              const { data: userData } = await supabaseAdmin
                .from('users')
                .select('wallet_balance, dati_cliente')
                .eq('email', token.email)
                .single();

              if (userData) {
                token.wallet_balance = parseFloat(userData.wallet_balance || '0') || 0;
                token.onboarding_complete = userData.dati_cliente?.datiCompletati === true;
                token.wallet_last_update = now;

                if (token.onboarding_complete) {
                  console.log('✅ [NEXTAUTH] Onboarding completed, JWT updated:', token.email);
                }
              }
            } catch (error: any) {
              console.warn(
                '⚠️ [NEXTAUTH] Errore aggiornamento wallet/onboarding (non critico):',
                error.message
              );
            }
          }
        }
      }

      return token;
    },
    async session({ session, token }: any) {
      console.log('🔐 [NEXTAUTH] session callback chiamato:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        tokenId: token.id,
        tokenEmail: token.email,
        tokenRole: token.role,
        tokenProvider: token.provider,
      });

      if (session.user) {
        // ⚠️ IMPORTANTE: Salva ID utente nella sessione
        session.user.id = token.id;
        session.user.role = (token.role as string) || 'user';
        session.user.provider = (token.provider as string) || 'credentials';

        // Assicurati che email e name siano presenti
        if (token.email) {
          session.user.email = token.email;
        }
        if (token.name) {
          session.user.name = token.name;
        }

        // ⚠️ NUOVO: Aggiungi campi reseller e wallet alla sessione
        (session.user as any).is_reseller = token.is_reseller || false;
        (session.user as any).reseller_role = token.reseller_role || null;
        (session.user as any).parent_id = token.parent_id || null;
        (session.user as any).wallet_balance = token.wallet_balance || 0;
        (session.user as any).account_type = token.account_type || 'user';
        (session.user as any).onboarding_complete = token.onboarding_complete || false;

        console.log('✅ [NEXTAUTH] Session aggiornata:', {
          id: session.user.id,
          email: session.user.email,
          role: session.user.role,
          provider: (session.user as any).provider,
          is_reseller: (session.user as any).is_reseller,
          reseller_role: (session.user as any).reseller_role,
          wallet_balance: (session.user as any).wallet_balance,
          account_type: (session.user as any).account_type,
          onboarding_complete: (session.user as any).onboarding_complete,
        });
      }
      return session;
    },
    async redirect({ url, baseUrl }: any) {
      // ⚠️ IMPORTANTE: Usa sempre l'URL corretto (non localhost in produzione)
      const correctBaseUrl = getNextAuthUrl();

      console.log('🔄 [NEXTAUTH] redirect callback chiamato:', {
        url,
        baseUrl,
        correctBaseUrl,
        nodeEnv: process.env.NODE_ENV,
        vercelUrl: process.env.VERCEL_URL,
      });

      // Se baseUrl punta a localhost ma siamo in produzione, usa correctBaseUrl
      const finalBaseUrl =
        baseUrl.includes('localhost') && process.env.NODE_ENV === 'production'
          ? correctBaseUrl
          : baseUrl;

      // ⚠️ P0 FIX: Gestione esplicita per URL vuoto o '/' (fail-safe a onboarding)
      // Questo evita redirect a home quando NextAuth chiama redirect con URL vuoto
      if (!url || url === '/' || url === '') {
        const redirectUrl = `${finalBaseUrl}/dashboard/dati-cliente`;
        console.log('⚠️ [NEXTAUTH] URL vuoto o /, redirect fail-safe a onboarding:', redirectUrl);
        return redirectUrl;
      }

      // ⚠️ IMPORTANTE: Se l'URL è /login, reindirizza sempre al dashboard
      // Questo evita loop di redirect dopo OAuth callback
      if (url === '/login' || url.startsWith('/login')) {
        const redirectUrl = `${finalBaseUrl}/dashboard`;
        console.log('⚠️ [NEXTAUTH] URL è /login, reindirizzo a dashboard:', redirectUrl);
        return redirectUrl;
      }

      // Se l'URL è relativo, usa finalBaseUrl
      if (url.startsWith('/')) {
        // Reindirizza sempre al dashboard (la pagina dashboard gestirà il controllo dati cliente)
        // Se l'URL è già /dashboard o /dashboard/dati-cliente, mantienilo
        if (url.startsWith('/dashboard')) {
          const redirectUrl = `${finalBaseUrl}${url}`;
          console.log('✅ [NEXTAUTH] Redirect a:', redirectUrl);
          return redirectUrl;
        }
        // Altrimenti reindirizza al dashboard
        const redirectUrl = `${finalBaseUrl}/dashboard`;
        console.log('✅ [NEXTAUTH] Redirect a dashboard:', redirectUrl);
        return redirectUrl;
      }

      // Se l'URL è assoluto e dello stesso dominio, permetti
      try {
        const urlObj = new URL(url);
        const baseUrlObj = new URL(finalBaseUrl);

        // Se l'URL è dello stesso dominio, permetti
        if (urlObj.origin === baseUrlObj.origin) {
          console.log('✅ [NEXTAUTH] Redirect a URL assoluto stesso dominio:', url);
          return url;
        }

        // Se l'URL punta a localhost ma siamo in produzione, reindirizza al dominio corretto
        if (urlObj.origin.includes('localhost') && process.env.NODE_ENV === 'production') {
          const correctedUrl = url.replace(urlObj.origin, baseUrlObj.origin);
          console.log('⚠️ [NEXTAUTH] URL corretto da localhost a produzione:', correctedUrl);
          return correctedUrl;
        }
      } catch (error) {
        console.warn('⚠️ [NEXTAUTH] Errore parsing URL:', error);
      }

      // Altrimenti reindirizza al dashboard
      const redirectUrl = `${finalBaseUrl}/dashboard`;
      console.log('✅ [NEXTAUTH] Redirect fallback a dashboard:', redirectUrl);
      return redirectUrl;
    },
  },
  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60, // 30 giorni
  },
  secret: (() => {
    const secret = process.env.NEXTAUTH_SECRET;

    // ⚠️ IMPORTANTE: Valida NEXTAUTH_SECRET
    if (!secret) {
      const errorMsg = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ ERRORE CRITICO: NEXTAUTH_SECRET NON CONFIGURATO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NextAuth richiede NEXTAUTH_SECRET per funzionare.

🔧 COME RISOLVERE:

1. Vai su Vercel Dashboard
2. Seleziona il progetto "spediresicuro"
3. Settings → Environment Variables
4. Aggiungi nuova variabile:
   - Nome: NEXTAUTH_SECRET
   - Valore: (genera con: openssl rand -base64 32)
   - Environment: Production, Preview, Development
5. Redeploy l'applicazione

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `;
      console.error(errorMsg);

      if (process.env.NODE_ENV === 'production') {
        throw new Error('NEXTAUTH_SECRET non configurato');
      }

      // In sviluppo, genera un warning ma permette di continuare
      console.warn('⚠️ [AUTH CONFIG] NEXTAUTH_SECRET non configurato. Usando secret di sviluppo.');
      return 'dev-secret-not-for-production-change-in-env-local-please';
    }

    // Verifica che il secret sia abbastanza lungo (almeno 32 caratteri)
    if (secret.length < 32) {
      console.warn(
        '⚠️ [AUTH CONFIG] NEXTAUTH_SECRET sembra troppo corto. Consigliato almeno 32 caratteri.'
      );
    }

    console.log('✅ [AUTH CONFIG] NEXTAUTH_SECRET configurato correttamente');
    return secret;
  })(),
};

// Export auth function for server-side usage
// Initialize NextAuth
const nextAuthResult = NextAuth(authOptions);

// Export handlers, signIn, signOut directly
export const { handlers, signIn, signOut } = nextAuthResult;

// Wrap auth to support E2E test bypass
export const auth = async (...args: any[]) => {
  // ⚠️ E2E TEST BYPASS (Solo CI/Test Environment)
  const isCI = process.env.CI === 'true';
  const isPlaywrightMode = process.env.PLAYWRIGHT_TEST_MODE === 'true';

  if (process.env.NODE_ENV !== 'production' || isCI || isPlaywrightMode) {
    try {
      const { headers } = await import('next/headers');
      const headersList = headers();
      const testHeader = headersList.get('x-test-mode');

      if (testHeader === 'playwright' || isPlaywrightMode) {
        // console.log('🧪 [AUTH CONFIG] Test mode bypass active via wrapper');
        return {
          user: {
            id: '00000000-0000-0000-0000-000000000000', // Valid Nil UUID
            email: process.env.TEST_USER_EMAIL || 'test@example.com',
            name: 'Test User E2E',
            role: 'admin', // Force admin role
            image: null,
            // Mock extended fields potentially used
            is_reseller: true,
            reseller_role: 'admin',
            account_type: 'superadmin', // Force superadmin for permissions
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
      }
    } catch (e) {
      // Ignore error if headers() not available
    }
  }

  return (nextAuthResult.auth as any)(...args);
};
