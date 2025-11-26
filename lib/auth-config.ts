/**
 * NextAuth Configuration (v5)
 * 
 * Configurazione centralizzata per NextAuth.js v5
 */

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // TODO: In futuro, verifica credenziali da database Supabase
        // Per ora, sistema semplice per sviluppo
        // In produzione, usa Supabase Auth o database utenti
        
        // Credenziali di default per sviluppo
        const validCredentials = [
          {
            email: 'admin@spediresicuro.it',
            password: 'admin123',
            name: 'Admin',
            role: 'admin',
          },
          {
            email: 'demo@spediresicuro.it',
            password: 'demo123',
            name: 'Demo User',
            role: 'user',
          },
        ];

        const user = validCredentials.find(
          (cred) =>
            cred.email === credentials.email &&
            cred.password === credentials.password
        );

        if (user) {
          return {
            id: user.email,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        (session.user as any).role = token.role;
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

