# Authentication - SpedireSicuro

## Overview

Questo documento descrive il sistema di autenticazione di SpedireSicuro basato su NextAuth.js v5, inclusi provider OAuth (Google, GitHub), autenticazione con credenziali (email/password), gestione sessioni JWT e sicurezza delle password.

## Target Audience

- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- NextAuth.js v5 knowledge
- OAuth 2.0 basics
- JWT (JSON Web Tokens) understanding
- Environment variables management

## Quick Reference

| Sezione                | Pagina                            | Link                                             |
| ---------------------- | --------------------------------- | ------------------------------------------------ |
| NextAuth Configuration | docs/8-SECURITY/AUTHENTICATION.md | [Configuration](#nextauth-configuration)         |
| Provider Supportati    | docs/8-SECURITY/AUTHENTICATION.md | [Providers](#authentication-providers)           |
| Session Management     | docs/8-SECURITY/AUTHENTICATION.md | [Sessions](#session-management)                  |
| Password Security      | docs/8-SECURITY/AUTHENTICATION.md | [Password](#password-security)                   |
| Acting Context         | docs/8-SECURITY/AUTHORIZATION.md  | [Acting Context](../8-SECURITY/AUTHORIZATION.md) |
| Authorization          | docs/8-SECURITY/AUTHORIZATION.md  | [Authorization](../8-SECURITY/AUTHORIZATION.md)  |

## Content

### NextAuth Configuration

**File:** `lib/auth-config.ts`

**Architettura:**

- NextAuth.js v5 con App Router
- JWT strategy per sessioni (no database session)
- Supporto multi-provider (Credentials, Google OAuth, GitHub OAuth)
- Callbacks personalizzati per session e JWT

**Configurazione Base:**

```typescript
export const authOptions = {
  basePath: '/api/auth',
  trustHost: true, // Importante per Vercel
  url: nextAuthUrl, // Auto-rilevato da VERCEL_URL o NEXTAUTH_URL
  providers: [
    // Credentials, Google, GitHub
  ],
  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60, // 30 giorni
  },
  secret: process.env.NEXTAUTH_SECRET, // OBBLIGATORIO
};
```

**Route Handler:**

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth-config';
export const { GET, POST } = handlers;
```

---

### Authentication Providers

#### 1. Credentials Provider (Email/Password)

**Configurazione:**

- Provider: `CredentialsProvider`
- Validazione: `verifyUserCredentials()` da `lib/database.ts`
- Password hashing: bcrypt (hash `$2a$`, `$2b$`, `$2x$`, `$2y$`)

**Flow:**

```
1. User inserisce email + password
2. NextAuth chiama authorize()
3. verifyUserCredentials() verifica:
   - Email esiste nel database
   - Password corrisponde (bcrypt.compare)
   - Email confermata (se richiesto)
4. Se valido → ritorna user object
5. NextAuth crea JWT token
```

**Esempio Authorize:**

```typescript
CredentialsProvider({
  name: 'Credentials',
  credentials: {
    email: { label: 'Email', type: 'email' },
    password: { label: 'Password', type: 'password' },
  },
  async authorize(credentials) {
    const { verifyUserCredentials } = await import('@/lib/database');
    const user = await verifyUserCredentials(
      credentials.email as string,
      credentials.password as string
    );
    return user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      : null;
  },
});
```

**Error Handling:**

- `EMAIL_NOT_CONFIRMED` → Errore esplicito per email non confermata
- Password errata → `null` (NextAuth mostra errore generico)
- Utente non trovato → `null`

---

#### 2. Google OAuth Provider

**Configurazione:**

- Provider: `GoogleProvider`
- Variabili ambiente: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Account linking: `allowDangerousEmailAccountLinking: true` (stessa email = stesso account)

**Setup Google Console:**

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea OAuth 2.0 Client ID
3. Configura callback URL: `https://yourdomain.com/api/auth/callback/google`
4. Copia `CLIENT_ID` e `CLIENT_SECRET` in Vercel env vars

**Flow:**

```
1. User clicca "Sign in with Google"
2. Redirect a Google OAuth consent screen
3. User autorizza → Google redirect a /api/auth/callback/google
4. NextAuth scambia code per access_token
5. NextAuth ottiene user profile da Google
6. signIn callback verifica/crea utente nel database
7. JWT token creato con user data
```

**Callback URL:**

- Produzione: `https://spediresicuro.vercel.app/api/auth/callback/google`
- Sviluppo: `http://localhost:3000/api/auth/callback/google`

---

#### 3. GitHub OAuth Provider

**Configurazione:**

- Provider: `GitHubProvider`
- Variabili ambiente: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- Account linking: `allowDangerousEmailAccountLinking: true`

**Setup GitHub:**

1. Vai su [GitHub Developer Settings](https://github.com/settings/developers)
2. Crea OAuth App
3. Configura callback URL: `https://yourdomain.com/api/auth/callback/github`
4. Copia `Client ID` e `Client Secret` in Vercel env vars

**Flow:** Identico a Google OAuth (vedi sopra)

---

### Session Management

**Strategy:** JWT (JSON Web Token)

**Vantaggi:**

- No database queries per validare sessione
- Stateless (scalabile)
- Funziona con serverless (Vercel)

**Session Data:**

```typescript
interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  provider: string; // 'credentials' | 'google' | 'github'
  is_reseller?: boolean;
  reseller_role?: string | null;
  parent_id?: string | null;
  wallet_balance?: number;
  account_type?: string;
}
```

**JWT Token Structure:**

```typescript
{
  sub: string,        // User ID
  email: string,
  name: string,
  role: string,
  provider: string,
  is_reseller: boolean,
  wallet_balance: number,
  // ... altri campi
  iat: number,        // Issued at
  exp: number,        // Expires at
}
```

**Session Callback:**

```typescript
async session({ session, token }) {
  if (session.user && token) {
    session.user.id = token.id;
    session.user.role = token.role;
    session.user.provider = token.provider;
    // ... altri campi da token
  }
  return session;
}
```

**JWT Callback:**

```typescript
async jwt({ token, user, account }) {
  // Prima chiamata (login): user presente
  if (user) {
    token.id = user.id;
    token.role = user.role;
    token.provider = account?.provider || 'credentials';
    // ... altri campi
  }

  // Chiamate successive: aggiorna da database se necessario
  // (es. wallet_balance cambia)

  return token;
}
```

**Session TTL:**

- Default: 30 giorni (`maxAge: 30 * 24 * 60 * 60`)
- Configurabile via `NEXTAUTH_SESSION_MAX_AGE` (opzionale)

---

### Password Security

**Hashing Algorithm:** bcrypt

**Formato Hash:**

- `$2a$`, `$2b$`, `$2x$`, `$2y$` → bcrypt hash
- Password in chiaro (backward compatibility, deprecato)

**Verifica Password:**

```typescript
// lib/database.ts - verifyUserCredentials()
if (dbUser.password.startsWith('$2')) {
  const bcrypt = require('bcryptjs');
  passwordMatch = await bcrypt.compare(password, dbUser.password);
} else {
  // Backward compatibility (deprecato)
  passwordMatch = dbUser.password === password;
}
```

**Best Practices:**

- ✅ Usa sempre bcrypt per nuove password
- ✅ Salt automatico (bcrypt gestisce)
- ✅ Cost factor: default 10 (configurabile)
- ❌ Mai password in chiaro nel database
- ❌ Mai log password (nemmeno hash)

**Password Reset:**

- TODO: Implementare flow password reset
- Suggerito: Token temporaneo via email, scadenza 1h

---

### Environment Variables

**Obbligatorie:**

```bash
NEXTAUTH_SECRET=<random-32-chars>  # OBBLIGATORIO
```

**Opzionali (OAuth):**

```bash
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
GITHUB_CLIENT_ID=<github-client-id>
GITHUB_CLIENT_SECRET=<github-client-secret>
```

**Opzionali (URL):**

```bash
NEXTAUTH_URL=https://yourdomain.com  # Auto-rilevato su Vercel
```

**Generazione NEXTAUTH_SECRET:**

```bash
# Genera secret sicuro (32+ caratteri)
openssl rand -base64 32

# O con Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Validazione Config:**

- `validateOAuthConfig()` verifica configurazione all'avvio
- Log errori critici se `NEXTAUTH_SECRET` mancante
- Warning se OAuth configurato ma URL non HTTPS

---

### Acting Context & Impersonation

**⚠️ IMPORTANTE:** L'autenticazione supporta impersonation tramite Acting Context.

**Pattern:**

- `getSafeAuth()` / `requireSafeAuth()` → Ritorna `ActingContext`
- `ActingContext.actor` → Chi esegue l'azione (SuperAdmin se impersonating)
- `ActingContext.target` → Per chi viene eseguita l'azione (cliente)

**Vedi:** [Authorization & Acting Context](AUTHORIZATION.md) per dettagli completi.

**Esempio:**

```typescript
import { requireSafeAuth } from '@/lib/safe-auth';

export async function createShipment(data: ShipmentData) {
  const context = await requireSafeAuth();

  // target.id = chi paga (cliente, anche se impersonating)
  // actor.id = chi clicca (SuperAdmin se impersonating)

  const { data: shipment } = await supabaseAdmin.from('shipments').insert({
    user_id: context.target.id, // ⚠️ Usa TARGET, non actor
    // ...
  });
}
```

---

### Security Best Practices

#### 1. Session Security

- ✅ JWT firmato con `NEXTAUTH_SECRET` (HMAC)
- ✅ Cookie HTTP-only (NextAuth gestisce)
- ✅ Cookie Secure in produzione (HTTPS only)
- ✅ Cookie SameSite=Lax (previene CSRF)

#### 2. Password Security

- ✅ Hash bcrypt (cost factor 10+)
- ✅ Salt automatico (bcrypt)
- ✅ Mai password in log
- ✅ Rate limiting su login (TODO)

#### 3. OAuth Security

- ✅ State parameter (NextAuth gestisce)
- ✅ PKCE per mobile (se implementato)
- ✅ Account linking sicuro (stessa email)
- ✅ Callback URL validati

#### 4. Environment Variables

- ✅ `NEXTAUTH_SECRET` obbligatorio
- ✅ OAuth secrets in Vercel env vars (non in repo)
- ✅ Rotazione secrets ogni 90 giorni (best practice)

---

## Examples

### Login con Credentials

```typescript
// Client-side
import { signIn } from 'next-auth/react';

await signIn('credentials', {
  email: 'user@example.com',
  password: 'password123',
  redirect: true,
  callbackUrl: '/dashboard',
});
```

### Login con Google OAuth

```typescript
// Client-side
import { signIn } from 'next-auth/react';

await signIn('google', {
  redirect: true,
  callbackUrl: '/dashboard',
});
```

### Verifica Sessione Server-Side

```typescript
// Server Action / API Route
import { auth } from '@/lib/auth-config';

export async function getMyData() {
  const session = await auth();

  if (!session?.user) {
    throw new Error('UNAUTHORIZED');
  }

  const userId = session.user.id;
  // ... query database
}
```

### Acting Context (Impersonation)

```typescript
// Server Action
import { requireSafeAuth } from '@/lib/safe-auth';

export async function rechargeWallet(amount: number) {
  const context = await requireSafeAuth();

  // context.target.id = chi riceve credito (cliente)
  // context.actor.id = chi esegue (SuperAdmin se impersonating)

  const { error } = await supabaseAdmin.rpc('add_wallet_credit', {
    p_user_id: context.target.id,
    p_amount: amount,
    p_created_by: context.actor.id,
  });
}
```

---

## Common Issues

| Issue                               | Soluzione                                                              |
| ----------------------------------- | ---------------------------------------------------------------------- |
| Errore "Configuration" in NextAuth  | Verifica `NEXTAUTH_SECRET` configurato in Vercel env vars              |
| OAuth callback redirect a localhost | Configura `NEXTAUTH_URL` o usa `VERCEL_URL` (auto-rilevato)            |
| Session non persiste                | Verifica cookie SameSite/Secure settings, controlla browser console    |
| Password non funziona               | Verifica hash bcrypt nel database, controlla `verifyUserCredentials()` |
| Impersonation non funziona          | Verifica cookie `sp_impersonate_id`, controlla middleware validation   |
| Email non confermata                | Verifica `email_confirmed_at` nel database, implementa flow conferma   |
| OAuth account linking fallisce      | Verifica `allowDangerousEmailAccountLinking: true` in provider config  |

---

## Related Documentation

- [Security Overview](OVERVIEW.md) - Architettura sicurezza generale
- [Authorization & Acting Context](AUTHORIZATION.md) - Impersonation e RBAC
- [Backend Architecture](../2-ARCHITECTURE/BACKEND.md) - API routes e Server Actions
- [Data Protection](DATA_PROTECTION.md) - Encryption e secrets management
- [Audit Logging](AUDIT_LOGGING.md) - Audit trail per operazioni autenticate

---

## Changelog

| Date       | Version | Changes                                                      | Author   |
| ---------- | ------- | ------------------------------------------------------------ | -------- |
| 2026-01-12 | 1.0.0   | Initial version - NextAuth v5, OAuth support, Acting Context | AI Agent |

---

_Last Updated: 2026-01-12_  
_Status: 🟢 Active_  
_Maintainer: Engineering Team_
