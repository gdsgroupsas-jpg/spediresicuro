/**
 * NextAuth Configuration (v5)
 * 
 * Configurazione centralizzata per NextAuth.js v5
 * Supporta: Credentials, Google OAuth, GitHub OAuth
 */

import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';

// Validazione configurazione OAuth
function validateOAuthConfig() {
  const hasGoogle = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const hasGitHub = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  const nextAuthUrl = getNextAuthUrl();
  
  // Log sempre in produzione per debug
  console.log('🔍 OAuth Config Check:', {
    google: hasGoogle ? '✅ Configurato' : '⚠️ Non configurato',
    github: hasGitHub ? '✅ Configurato' : '⚠️ Non configurato',
    nextAuthUrl: nextAuthUrl,
    vercelUrl: process.env.VERCEL_URL || 'N/A',
    nodeEnv: process.env.NODE_ENV || 'N/A',
  });
  
  // ⚠️ Warning se Google OAuth configurato ma URL non valido
  if (hasGoogle && process.env.NODE_ENV === 'production') {
    if (!nextAuthUrl.startsWith('https://')) {
      console.warn('⚠️ ATTENZIONE: NEXTAUTH_URL deve essere HTTPS in produzione!');
    }
    console.log('📝 Verifica che il callback URL sia configurato in Google Console:');
    console.log(`   ${nextAuthUrl}/api/auth/callback/google`);
  }
  
  return { hasGoogle, hasGitHub };
}

// Verifica configurazione all'avvio
validateOAuthConfig();

// Determina URL base per NextAuth (locale o produzione)
function getNextAuthUrl(): string {
  // ⚠️ PRIORITÀ: Usa NEXTAUTH_URL se configurato (per produzione)
  // Questo permette di usare l'URL di produzione anche quando VERCEL_URL è presente
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  // In produzione su Vercel, usa VERCEL_URL se disponibile (per preview deploy)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Fallback per sviluppo locale
  return process.env.NODE_ENV === 'production' 
    ? 'https://spediresicuro.vercel.app' // Dominio Vercel produzione
    : 'http://localhost:3000';
}

export const authOptions = {
  // URL base per NextAuth (necessario per OAuth callbacks)
  basePath: '/api/auth',
  // Trust host per permettere callbacks dinamici (importante per Vercel)
  trustHost: true,
  // URL esplicito per produzione
  url: getNextAuthUrl(),
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
          
          // ⚠️ NUOVO: Inizializza utenti demo se necessario (solo per utenti demo)
          if (credentials.email === 'admin@spediresicuro.it' || credentials.email === 'demo@spediresicuro.it') {
            try {
              const { ensureDemoUsersExist } = await import('@/lib/database-init');
              await ensureDemoUsersExist();
            } catch (initError: any) {
              // Non bloccare il login se l'inizializzazione fallisce
              console.warn('⚠️ [AUTH] Errore inizializzazione utenti demo:', initError.message);
            }
          }
          
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
            });
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
            };
          } else {
            console.log('❌ [AUTH] Utente non trovato o password errata');
          }
        } catch (error: any) {
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

          const existingUser = await findUserByEmail(user.email);
          console.log('👤 [NEXTAUTH] Utente esistente trovato:', !!existingUser);

          if (!existingUser) {
            // Crea nuovo utente OAuth
            console.log('➕ [NEXTAUTH] Creazione nuovo utente OAuth');
            await createUser({
              email: user.email,
              password: '', // Password vuota per utenti OAuth
              name: user.name || user.email.split('@')[0] || 'Utente',
              role: 'user',
              provider: account?.provider as 'google' | 'github',
              providerId: account?.providerAccountId,
              image: user.image || undefined,
            });
            console.log('✅ [NEXTAUTH] Nuovo utente OAuth creato con successo');
          } else if (account?.provider && !existingUser.provider) {
            // Aggiorna utente esistente con provider OAuth
            console.log('🔄 [NEXTAUTH] Aggiornamento utente esistente con provider OAuth');
            updateUser(existingUser.id, {
              provider: account.provider as 'google' | 'github',
              providerId: account.providerAccountId,
              image: user.image || undefined,
            });
            console.log('✅ [NEXTAUTH] Utente aggiornato con successo');
          }

          // ⚠️ NUOVO: Crea/aggiorna profilo in user_profiles Supabase
          try {
            const { supabaseAdmin } = await import('@/lib/supabase');
            const { isSupabaseConfigured } = await import('@/lib/supabase');
            
            if (isSupabaseConfigured()) {
              await supabaseAdmin
                .from('user_profiles')
                .upsert(
                  {
                    email: user.email,
                    name: user.name || user.email.split('@')[0],
                    provider: account?.provider || 'credentials',
                    provider_id: account?.providerAccountId || null,
                    nextauth_user_id: user.id || null,
                  },
                  { onConflict: 'email' }
                );
              console.log(`✅ [SUPABASE] Profilo utente sincronizzato in user_profiles per ${user.email}`);
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
          // Non bloccare il login in caso di errore, ma logga tutto
        }
      }

      console.log('✅ [NEXTAUTH] signIn callback completato con successo');
      return true;
    },
    async jwt({ token, user, account }: any) {
      // Prima chiamata (dopo login)
      if (user) {
        token.role = (user.role as string) || 'user';
        token.provider = account?.provider || 'credentials';
      }

      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.role = (token.role as string) || 'user';
        session.user.provider = (token.provider as string) || 'credentials';
      }
      return session;
    },
    async redirect({ url, baseUrl }: any) {
      console.log('🔄 [NEXTAUTH] redirect callback chiamato:', { url, baseUrl });
      
      // Se l'URL è relativo, usa baseUrl
      if (url.startsWith('/')) {
        // Reindirizza sempre al dashboard (la pagina dashboard gestirà il controllo dati cliente)
        // Se l'URL è già /dashboard o /dashboard/dati-cliente, mantienilo
        if (url.startsWith('/dashboard')) {
          const redirectUrl = `${baseUrl}${url}`;
          console.log('✅ [NEXTAUTH] Redirect a:', redirectUrl);
          return redirectUrl;
        }
        // Altrimenti reindirizza al dashboard
        const redirectUrl = `${baseUrl}/dashboard`;
        console.log('✅ [NEXTAUTH] Redirect a dashboard:', redirectUrl);
        return redirectUrl;
      }
      
      // Se l'URL è assoluto e dello stesso dominio, permetti
      try {
        const urlObj = new URL(url);
        if (urlObj.origin === baseUrl) {
          console.log('✅ [NEXTAUTH] Redirect a URL assoluto stesso dominio:', url);
          return url;
        }
      } catch (error) {
        console.warn('⚠️ [NEXTAUTH] Errore parsing URL:', error);
      }
      
      // Altrimenti reindirizza al dashboard
      const redirectUrl = `${baseUrl}/dashboard`;
      console.log('✅ [NEXTAUTH] Redirect fallback a dashboard:', redirectUrl);
      return redirectUrl;
    },
  },
  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60, // 30 giorni
  },
  secret: process.env.NEXTAUTH_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXTAUTH_SECRET è obbligatorio in produzione! Configura la variabile d\'ambiente.');
    }
    // In sviluppo, genera un warning ma permette di continuare
    console.warn('⚠️ NEXTAUTH_SECRET non configurato. Configura .env.local per sicurezza!');
    return 'dev-secret-not-for-production-change-in-env-local';
  })(),
};

// Export auth function for server-side usage
export const { auth, handlers, signIn, signOut } = NextAuth(authOptions);

