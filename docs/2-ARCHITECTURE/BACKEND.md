# Backend Architecture - SpedireSicuro

## Overview

Questa documentazione descrive l'architettura backend di SpedireSicuro, inclusi API Routes, Server Actions, Supabase integration e patterns di autenticazione.

## Target Audience

- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- Node.js 18+
- Supabase knowledge
- Next.js API routes familiarity
- PostgreSQL basics

## Quick Reference

| Sezione         | Pagina                         | Link                               |
| --------------- | ------------------------------ | ---------------------------------- |
| API Routes      | docs/2-ARCHITECTURE/BACKEND.md | [API Routes](#api-routes)          |
| Server Actions  | docs/2-ARCHITECTURE/BACKEND.md | [Server Actions](#server-actions)  |
| Supabase Client | docs/2-ARCHITECTURE/BACKEND.md | [Supabase](#supabase-client-setup) |
| Authentication  | docs/2-ARCHITECTURE/BACKEND.md | [Auth](#authentication)            |
| Error Handling  | docs/2-ARCHITECTURE/BACKEND.md | [Errors](#error-handling)          |

## Content

### API Routes

**Directory Structure:**

```
app/api/
├── admin/
│   ├── users/[id]/route.ts      # User CRUD
│   ├── overview/route.ts         # Admin stats
│   └── features/route.ts        # Feature toggles
├── auth/
│   ├── [...nextauth]/route.ts    # NextAuth callbacks
│   └── register/route.ts        # User registration
├── shipments/
│   ├── create/route.ts          # Create shipment
│   └── [id]/ldv/route.ts        # Download label
├── quotes/
│   ├── realtime/route.ts        # Real-time quotes
│   └── compare/route.ts         # Quote comparison
├── wallet/
│   └── transactions/route.ts     # Wallet transactions
└── stripe/
    └── webhook/route.ts          # Stripe webhooks
```

**Pattern Standard:**

```typescript
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // 1. Auth check
    const auth = await requireSafeAuth();

    // 2. Validation
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // 3. Database query
    const { data, error } = await supabaseAdmin.from('table').select('*').eq('id', id).single();

    if (error) throw error;

    // 4. Response
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validation
    const validated = schema.parse(body);

    // Business logic
    // ...

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
```

**Esempio Reale: Create Shipment API (da `app/api/shipments/create/route.ts`):**

```typescript
import { supabaseAdmin } from '@/lib/db/client';
import { requireSafeAuth } from '@/lib/safe-auth';
import { createShipmentSchema } from '@/lib/validations/shipment';

export async function POST(request: Request) {
  // 1. Auth check (Acting Context for impersonation)
  const context = await requireSafeAuth();
  const targetId = context.target.id; // Who pays
  const actorId = context.actor.id; // Who clicked

  try {
    const body = await request.json();

    // 2. Validation
    const validated = createShipmentSchema.parse(body);

    // 3. Idempotency check
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          userId: targetId,
          recipient: validated.recipient,
          timestamp: Math.floor(Date.now() / 5000),
        })
      )
      .digest('hex');

    // 4. Acquire lock
    const { data: lockResult } = await supabaseAdmin.rpc('acquire_idempotency_lock', {
      p_idempotency_key: idempotencyKey,
      p_user_id: targetId,
      p_ttl_minutes: 30,
    });

    if (!lockResult?.[0]?.acquired) {
      return Response.json(
        { error: 'DUPLICATE_REQUEST', message: 'Richiesta già in elaborazione.' },
        { status: 409 }
      );
    }

    // 5. Wallet debit
    const { error: walletError } = await supabaseAdmin.rpc('decrement_wallet_balance', {
      p_user_id: targetId,
      p_amount: estimatedCost,
    });

    if (walletError) {
      return Response.json({ error: 'INSUFFICIENT_CREDIT' }, { status: 402 });
    }

    // 6. Create shipment
    const { data: shipment, error: shipmentError } = await supabaseAdmin
      .from('shipments')
      .insert({
        user_id: targetId,
        carrier: validated.carrier,
        tracking_number: trackingNumber,
        // ... altri campi
      })
      .select()
      .single();

    // 7. Complete lock
    await supabaseAdmin.rpc('complete_idempotency_lock', {
      p_idempotency_key: idempotencyKey,
      p_shipment_id: shipment.id,
      p_status: 'completed',
    });

    return Response.json({ success: true, shipment });
  } catch (error: any) {
    // Error handling con compensazione wallet
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

### Server Actions

**File Location:** `actions/` e `app/actions/`

**Pattern:**

```typescript
'use server';

import { requireSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { z } from 'zod';

// Schema validazione
const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

/**
 * Server Action: Crea utente
 */
export async function createUser(data: z.infer<typeof schema>) {
  try {
    // 1. Auth check
    const context = await requireSafeAuth();
    const targetId = context.target.id;

    // 2. Validation
    const validated = schema.parse(data);

    // 3. Database operation
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert(validated)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: user };
  } catch (error: any) {
    console.error('Errore createUser:', error);
    return { success: false, error: error.message };
  }
}
```

**Esempio Reale: Wallet Actions (da `actions/wallet.ts`):**

```typescript
'use server';

import { requireSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { writeWalletAuditLog } from '@/lib/security/audit-log';

/**
 * Server Action: Ricarica wallet dell'utente corrente
 */
export async function rechargeMyWallet(
  amount: number,
  reason: string = 'Ricarica wallet utente'
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  transactionId?: string;
  newBalance?: number;
}> {
  try {
    // 1. Get Safe Auth (Acting Context)
    const context = await requireSafeAuth();
    const targetId = context.target.id; // Who receives credit
    const actorId = context.actor.id; // Who clicked

    // 2. Valida importo
    if (amount <= 0) {
      return {
        success: false,
        error: "L'importo deve essere positivo.",
      };
    }

    // 3. Verifica se l'actor è admin/superadmin
    const isAdmin = context.target.role === 'SUPERADMIN' || context.target.role === 'ADMIN';

    // 4. Ricarica diretta per admin
    if (isAdmin) {
      const { data: txData, error: txError } = await supabaseAdmin.rpc('add_wallet_credit', {
        p_user_id: targetId,
        p_amount: amount,
        p_description: reason,
        p_created_by: actorId,
      });

      if (txError) {
        return {
          success: false,
          error: txError.message || 'Errore durante la ricarica.',
        };
      }

      // 5. Audit log
      await writeWalletAuditLog(context, 'WALLET_RECHARGE', amount, txData, {
        reason,
        type: 'admin_recharge',
      });

      const { data: updatedUser } = await supabaseAdmin
        .from('users')
        .select('wallet_balance')
        .eq('id', targetId)
        .single();

      return {
        success: true,
        message: `Ricarica di €${amount} completata.`,
        transactionId: txData,
        newBalance: updatedUser?.wallet_balance || 0,
      };
    }

    // Utente normale: crea richiesta di ricarica
    // TODO: Implementare sistema approvazioni
    return {
      success: false,
      error: 'Richiesta di ricarica non ancora implementata.',
    };
  } catch (error: any) {
    console.error('Errore in rechargeMyWallet:', error);
    return {
      success: false,
      error: error.message || 'Errore durante la ricarica.',
    };
  }
}

/**
 * Server Action: Ottieni transazioni wallet
 */
export async function getMyWalletTransactions(): Promise<{
  success: boolean;
  transactions?: any[];
  error?: string;
}> {
  try {
    const context = await requireSafeAuth();
    const targetId = context.target.id;

    const { data: transactions, error } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      transactions: transactions || [],
    };
  } catch (error: any) {
    console.error('Errore in getMyWalletTransactions:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
```

### Supabase Client Setup

**Client vs Admin:**

```typescript
// lib/db/client.ts
import { createClient } from '@supabase/supabase-js';

// Client: Per operazioni client-side (RLS applicato)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Admin: Per operazioni server-side (RLS bypassato)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

**Acting Context Pattern:**

```typescript
// lib/safe-auth.ts
import { getServerSession } from 'next-auth';

interface AuthContext {
  target: { id: string; email: string; role: string };
  actor: { id: string; email: string; role: string };
  isImpersonating: boolean;
}

export async function requireSafeAuth(): Promise<AuthContext> {
  const session = await getServerSession();

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // Acting Context: target vs actor
  return {
    target: {
      id: session.user.id,
      email: session.user.email!,
      role: session.user.role,
    },
    actor: {
      id: session.user.id, // Stesso se non impersonating
      email: session.user.email!,
      role: session.user.role,
    },
    isImpersonating: session.user.acting_as !== session.user.id,
  };
}
```

**Query Patterns:**

```typescript
// SELECT
const { data, error } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();

// INSERT
const { data, error } = await supabaseAdmin
  .from('shipments')
  .insert({ carrier: 'GLS', status: 'pending' })
  .select()
  .single();

// UPDATE
const { error } = await supabaseAdmin
  .from('shipments')
  .update({ status: 'in_transit' })
  .eq('id', shipmentId);

// DELETE
const { error } = await supabaseAdmin.from('shipments').delete().eq('id', shipmentId);

// RPC (Stored Procedure)
const { data, error } = await supabaseAdmin.rpc('decrement_wallet_balance', {
  p_user_id: userId,
  p_amount: 10,
});
```

### Authentication

**NextAuth Configuration:**

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Custom auth logic
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', credentials?.email)
          .single();

        if (user && (await verifyPassword(credentials?.password!, user.password))) {
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
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
  },
});

export { handler as GET, handler as POST };
```

**Acting Context (Impersonation):**

```typescript
// Permette ai superadmin di agire per conto di altri utenti
const context = await requireSafeAuth();

// target: chi riceve l'azione (es. chi paga la spedizione)
const targetId = context.target.id;

// actor: chi esegue l'azione (es. chi clicca il bottone)
const actorId = context.actor.id;

// impersonation: se true, actor != target
const isImpersonating = context.isImpersonating;
```

### Error Handling

**Standard Error Response:**

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
}
```

**Error Codes:**

- `UNAUTHORIZED` - Autenticazione mancante
- `FORBIDDEN` - Permesso negato (RBAC)
- `NOT_FOUND` - Risorsa non trovata
- `VALIDATION_ERROR` - Input non valido
- `RATE_LIMIT_EXCEEDED` - Troppi richieste
- `INTERNAL_ERROR` - Errore server
- `WALLET_INSUFFICIENT` - Credito insufficiente
- `DUPLICATE_REQUEST` - Idempotency lock attivo

**Pattern Try-Catch:**

```typescript
try {
  // Operation
  return { success: true, data };
} catch (error: any) {
  console.error('Operation failed:', error);

  // Specific error handling
  if (error.code === 'PGRST116') {
    return { success: false, error: 'Risorsa non trovata', code: 'NOT_FOUND' };
  }

  if (error.code === '23505') {
    return { success: false, error: 'Duplicato', code: 'DUPLICATE' };
  }

  // Generic error
  return {
    success: false,
    error: error.message || 'Operazione fallita',
    code: 'INTERNAL_ERROR',
  };
}
```

### Rate Limiting

**Upstash Redis Implementation:**

```typescript
// lib/security/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  analytics: true,
});

export async function checkRateLimit(identifier: string) {
  const { success, limit, remaining } = await ratelimit.limit(identifier);

  return {
    allowed: success,
    limit,
    remaining,
    retryAfter: success ? null : 60,
  };
}
```

**Usage in API Routes:**

```typescript
export async function GET(request: Request) {
  const { data: session } = await getServerSession();
  const identifier = session?.user?.id || request.ip;

  const { allowed, remaining } = await checkRateLimit(identifier);

  if (!allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMIT_EXCEEDED' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '20',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.floor(Date.now() / 1000 + 60).toString(),
        },
      }
    );
  }

  // ... rest of the handler
}
```

## Examples

### Esempio API Route Completa: Create Shipment

Vedi [API Routes](#api-rides) per esempio completo con idempotency, wallet debit e compensazione.

### Esempio Server Action: Wallet Recharge

Vedi [Server Actions](#server-actions) per esempio completo con Acting Context e audit log.

## Common Issues

| Issue                 | Soluzione                                                  |
| --------------------- | ---------------------------------------------------------- |
| RLS policy violation  | Usa `supabaseAdmin` per bypassare RLS su server            |
| Race condition wallet | Usa RPC `decrement_wallet_balance` con `SELECT FOR UPDATE` |
| Idempotency failure   | Usa `acquire_idempotency_lock` prima di mutare stato       |
| Session not available | Verifica `NEXTAUTH_SECRET` configurato                     |
| CORS error            | Configura headers in `next.config.js`                      |

## Related Documentation

- [Frontend Architecture](FRONTEND.md) - Next.js App Router patterns
- [API Documentation](../3-API/OVERVIEW.md) - API endpoints completi
- [Security](../8-SECURITY/OVERVIEW.md) - Autenticazione e RLS

## Changelog

| Date       | Version | Changes         | Author   |
| ---------- | ------- | --------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version | AI Agent |

---

_Last Updated: 2026-01-12_
_Status: 🟢 Active_
_Maintainer: Dev Team_
