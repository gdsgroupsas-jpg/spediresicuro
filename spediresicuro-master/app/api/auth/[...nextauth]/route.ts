/**
 * NextAuth.js API Route Handler (v5)
 * 
 * Gestisce l'autenticazione per il dashboard.
 * Usa provider Credentials per login semplice con email/password.
 */

import { handlers } from '@/lib/auth-config';

export const { GET, POST } = handlers;

