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
  const errors: string[] = [];
  
  if (!hasNextAuthSecret) {
    errors.push('❌ NEXTAUTH_SECRET non configurato - OBBLIGATORIO!');
  }
  
  if (process.env.NODE_ENV === 'production' && !hasNextAuthUrl) {
    errors.push('⚠️ NEXTAUTH_URL non configurato - consigliato in produzione');
  }
  
  if (hasGoogle && process.env.NODE_ENV === 'production') {
    if (!nextAuthUrl.startsWith('https://')) {
      errors.push('⚠️ NEXTAUTH_URL deve essere HTTPS in produzione!');
    }
    console.log('📝 [AUTH CONFIG] Verifica che il callback URL sia configurato in Google Console:');
    console.log(`   ${nextAuthUrl}/api/auth/callback/google`);
  }
  
  if (errors.length > 0) {
    console.error('❌ [AUTH CONFIG] Errori di configurazione trovati:');
    errors.forEach(error => console.error(`   ${error}`));
    console.error('❌ [AUTH CONFIG] Questi errori causeranno l\'errore "Configuration" in NextAuth!');
  } else {
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
  const fallbackUrl = process.env.NODE_ENV === 'production' 
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
  console.error('❌ [AUTH CONFIG] Vai su Vercel → Settings → Environment Variables e aggiungi NEXTAUTH_SECRET');
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
          
          // ⚠️ NUOVO: Inizializza utenti demo se necessario (solo per utenti demo)
          if (credentials.email === 'admin@spediresicuro.it' || credentials.email === 'demo@spediresicuro.it') {
            try {
              console.log('🔄 [AUTH] Inizializzazione utenti demo per:', credentials.email);
              const { ensureDemoUsersExist } = await import('@/lib/database-init');
              await ensureDemoUsersExist();
              console.log('✅ [AUTH] Inizializzazione utenti demo completata');
            } catch (initError: any) {
              // Non bloccare il login se l'inizializzazione fallisce
              console.warn('⚠️ [AUTH] Errore inizializzazione utenti demo:', initError.message);
              console.warn('⚠️ [AUTH] Stack trace:', initError.stack);
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
            if (credentials.email === 'admin@spediresicuro.it' || credentials.email === 'demo@spediresicuro.it') {
              console.warn('⚠️ [AUTH] ATTENZIONE: Utente demo non trovato dopo inizializzazione!');
            }
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
          // ⚠️ IMPORTANTE: Non bloccare il login, ma logga tutto per debug
          // Il login può continuare anche se la creazione utente fallisce
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
      } else {
        console.log('🔄 [NEXTAUTH] jwt callback - aggiornamento token esistente:', {
          id: token.id,
          email: token.email,
          role: token.role,
          provider: token.provider,
        });
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
        
        console.log('✅ [NEXTAUTH] Session aggiornata:', {
          id: session.user.id,
          email: session.user.email,
          role: session.user.role,
          provider: (session.user as any).provider,
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
      const finalBaseUrl = (baseUrl.includes('localhost') && process.env.NODE_ENV === 'production') 
        ? correctBaseUrl 
        : baseUrl;
      
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
      const errorMsg = 'NEXTAUTH_SECRET è obbligatorio! Configura la variabile d\'ambiente.';
      console.error('❌ [AUTH CONFIG]', errorMsg);
      
      if (process.env.NODE_ENV === 'production') {
        throw new Error(errorMsg);
      }
      
      // ⚠️ SICUREZZA: In sviluppo, genera un secret casuale temporaneo
      // invece di usare un valore hardcoded prevedibile
      console.warn('⚠️ [AUTH CONFIG] NEXTAUTH_SECRET non configurato. Generando secret casuale per sviluppo.');
      console.warn('⚠️ [AUTH CONFIG] Le sessioni non saranno persistenti tra riavvii. Configura NEXTAUTH_SECRET in .env.local');
      const crypto = require('crypto');
      return crypto.randomBytes(32).toString('hex');
    }
    
    // Verifica che il secret sia abbastanza lungo (almeno 32 caratteri)
    if (secret.length < 32) {
      console.warn('⚠️ [AUTH CONFIG] NEXTAUTH_SECRET sembra troppo corto. Dovrebbe essere almeno 32 caratteri.');
    }
    
    console.log('✅ [AUTH CONFIG] NEXTAUTH_SECRET configurato correttamente');
    return secret;
  })(),
};

// Export auth function for server-side usage
export const { auth, handlers, signIn, signOut } = NextAuth(authOptions);

