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
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 OAuth Config Check:', {
      google: hasGoogle ? '✅ Configurato' : '⚠️ Non configurato',
      github: hasGitHub ? '✅ Configurato' : '⚠️ Non configurato',
      nextAuthUrl: process.env.NEXTAUTH_URL || '⚠️ Non configurato',
    });
  }
  
  return { hasGoogle, hasGitHub };
}

// Verifica configurazione all'avvio
validateOAuthConfig();

export const authOptions = {
  // URL base per NextAuth (necessario per OAuth callbacks)
  basePath: '/api/auth',
  // Trust host per permettere callbacks dinamici
  trustHost: true,
  providers: [
    // Provider Credentials (Email/Password)
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials: Partial<Record<string, unknown>> | undefined) {
        // Type guard per verificare che le credenziali siano valide
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Verifica credenziali dal database
        const { verifyUserCredentials } = await import('@/lib/database');
        const user = verifyUserCredentials(
          credentials.email as string,
          credentials.password as string
        );

        if (user) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
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
      // Se l'utente si registra tramite OAuth, crealo/aggiornalo nel database
      if (account?.provider !== 'credentials' && user?.email) {
        try {
          const { findUserByEmail, createUser, updateUser } = await import('@/lib/database');

          const existingUser = findUserByEmail(user.email);

          if (!existingUser) {
            // Crea nuovo utente OAuth
            createUser({
              email: user.email,
              password: '', // Password vuota per utenti OAuth
              name: user.name || user.email.split('@')[0] || 'Utente',
              role: 'user',
              provider: account?.provider as 'google' | 'github',
              providerId: account?.providerAccountId,
              image: user.image || undefined,
            });
          } else if (account?.provider && !existingUser.provider) {
            // Aggiorna utente esistente con provider OAuth
            updateUser(existingUser.id, {
              provider: account.provider as 'google' | 'github',
              providerId: account.providerAccountId,
              image: user.image || undefined,
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
        } catch (error) {
          console.error('Errore gestione utente OAuth:', error);
          // Non bloccare il login in caso di errore
        }
      }

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
  },
  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60, // 30 giorni
  },
  secret: process.env.NEXTAUTH_SECRET || 'spediresicuro-secret-key-change-in-production',
};

// Export auth function for server-side usage
export const { auth, handlers, signIn, signOut } = NextAuth(authOptions);

