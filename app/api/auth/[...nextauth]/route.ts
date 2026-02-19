/**
 * NextAuth.js API Route Handler (v5)
 *
 * Gestisce l'autenticazione per il dashboard.
 * Usa provider Credentials per login semplice con email/password.
 */

// eslint-disable-next-line no-restricted-imports -- Route handler NextAuth: DEVE importare auth-config
import { handlers } from '@/lib/auth-config';

export const { GET, POST } = handlers;
