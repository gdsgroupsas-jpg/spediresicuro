# API Overview - SpedireSicuro

> **Scopo:** Panoramica completa delle API di SpedireSicuro per sviluppatori e integratori

## Overview

Questa documentazione fornisce una panoramica di tutte le API disponibili in SpedireSicuro, incluse REST endpoints, Server Actions e Webhooks.

## Target Audience

- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents

## Quick Reference

| Tipo           | Documentazione                         | Scope                        |
| -------------- | -------------------------------------- | ---------------------------- |
| REST API       | [REST_API.md](REST_API.md)             | Endpoints HTTP completi      |
| Server Actions | [SERVER_ACTIONS.md](SERVER_ACTIONS.md) | Server Actions Next.js       |
| Webhooks       | [WEBHOOKS.md](WEBHOOKS.md)             | Webhooks Stripe, ecc.        |
| Error Codes    | [ERROR_CODES.md](ERROR_CODES.md)       | Codici errore standardizzati |

---

## Architecture Overview

SpedireSicuro utilizza due approcci per le API:

### 1. REST API Endpoints

**File:** `app/api/**/*.ts`  
**Pattern:** `/api/[resource]/[id?]/[action]/route.ts`

**Esempi:**

```
POST /api/shipments/create
GET  /api/shipments/[id]
PUT  /api/shipments/[id]/cancel
GET  /api/quotes/realtime
```

**Autenticazione:**

- NextAuth session (cookie-based)
- Service role per admin operations (SUPABASE_SERVICE_ROLE_KEY)

**Caratteristiche:**

- JSON Request/Response
- Error handling standardizzato
- Rate limiting distribuito (Upstash Redis)
- CORS configurato per Next.js

### 2. Server Actions

**File:** `actions/**/*.ts`  
**Pattern:** Funzioni TypeScript esportate

**Esempi:**

```typescript
import { createShipment } from '@/actions/shipments';

const result = await createShipment(shipmentData);
```

**Vantaggi:**

- Type-safe
- Accesso diretto a database (Supabase client)
- Validazione automatica con Zod
- Integrato con React Query

---

## API Categories

### 📦 Core API

- **Shipments:** Creazione, lettura, aggiornamento, cancellazione spedizioni
- **Quotes:** Preventivi real-time, storico preventivi
- **Tracking:** Tracking spedizioni in tempo reale
- **LDV:** Download etichette (PDF)

### 👥 Users & Auth

- **Auth:** Login, logout, registrazione, OAuth
- **Users:** CRUD utenti, profili, metadata
- **Roles:** Gestione ruoli (Admin, Reseller, User)
- **Capabilities:** Permessi granulari (RBAC)

### 💰 Wallet & Payments

- **Wallet:** Lettura saldo, operazioni credit/debit
- **Transactions:** Storico movimenti wallet
- **Payments:** Stripe checkout, webhook handling
- **Invoices:** Generazione e download fatture

### 📋 Price Lists & Configurations

- **Price Lists:** CRUD listini prezzi
- **Supplier Lists:** Listini fornitori (master)
- **Reseller Lists:** Listini personalizzati
- **Courier Configs:** Configurazioni corrieri

### 🤖 AI Agent

- **Anne Chat:** Chat con agente AI
- **Anne Tools:** Strumenti AI (OCR, pricing, booking)
- **AI Features:** Toggle capabilities AI

### 🔧 Admin & SuperAdmin

- **Overview:** Statistiche dashboard
- **Doctor:** Diagnostica sistema
- **Financial:** P&L, costi piattaforma
- **Logs:** Audit logs e tracking

### 🎨 Integrations

- **Spedisci.Online:** Adapter API principale
- **Poste:** Adapter API Poste
- **GLS:** Adapter GLS (TODO)
- **Other:** Corrieri aggiuntivi

---

## Authentication & Authorization

### User Authentication

- **NextAuth:** Gestione sessioni
- **Providers:** Google, GitHub, Email/Password
- **Session:** Cookie-based, JWT token

### API Keys & Service Role

- **ANON KEY:** Client-side operations (pubblico)
- **SERVICE ROLE:** Server-side admin operations
- **Acting Context:** SuperAdmin può agire per conto utenti

### RBAC & Capabilities

- **Roles:** Admin, SuperAdmin, Reseller, User, BYOC
- **Capabilities:** Granular permissions (es. `can_manage_price_lists`)
- **RLS:** Row Level Security su database PostgreSQL

**Vedi:** [SECURITY](../8-SECURITY/OVERVIEW.md) - Architettura sicurezza completa

---

## Request/Response Format

### Standard Error Response

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
}
```

**Error Codes Comuni:**

- `UNAUTHORIZED` - Autenticazione mancante
- `FORBIDDEN` - Permesso negato (RBAC)
- `NOT_FOUND` - Risorsa non trovata
- `VALIDATION_ERROR` - Input non valido
- `RATE_LIMIT_EXCEEDED` - Troppi richieste
- `INTERNAL_ERROR` - Errore server
- `WALLET_INSUFFICIENT` - Credito insufficiente

**Vedi:** [ERROR_CODES.md](ERROR_CODES.md) - Codici errore completi

---

## Rate Limiting

### Policy

- **Default:** 20 richieste/minuto per utente
- **Distribuito:** Upstash Redis
- **Fallback:** In-memory se Redis non disponibile

### Headers Response

```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1704040000
```

**Vedi:** [lib/security/rate-limit.ts](../../lib/security/rate-limit.ts) - Implementazione rate limiting

---

## Documentation Links

### Core API Documentation

- [REST API - Complete](REST_API.md) - Tutti gli endpoints
- [Server Actions](SERVER_ACTIONS.md) - Catalog completo actions
- [Error Codes](ERROR_CODES.md) - Codici errore

### Feature-Specific APIs

- [Shipments API](../11-FEATURES/SHIPMENTS.md) - API spedizioni
- [Wallet API](../11-FEATURES/WALLET.md) - API wallet
- [Price Lists API](../11-FEATURES/PRICE_LISTS.md) - API listini
- [AI Agent API](../10-AI-AGENT/OVERVIEW.md) - API Anne

### Integrations

- [Spedisci.Online](../../lib/adapters/couriers/spedisci-online.ts) - Adapter principale
- [Poste Italiane](../../lib/adapters/couriers/poste.ts) - Adapter Poste

---

## Common Patterns

### 1. Validazione Input (Zod)

```typescript
import { z } from 'zod';

const shipmentSchema = z.object({
  recipient_name: z.string().min(1),
  weight: z.number().positive(),
  // ...
});

const validated = shipmentSchema.parse(input);
```

### 2. Error Handling Standardizzato

```typescript
try {
  const result = await someOperation();
  return { success: true, data: result };
} catch (error: any) {
  console.error('Operation failed:', error);
  return {
    success: false,
    error: error.message || 'Operation failed',
  };
}
```

### 3. React Query Integration

```typescript
// Server Action
export async function getShipments() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// Component
const { data: shipments } = useQuery({
  queryKey: ['shipments'],
  queryFn: getShipments,
});
```

---

## Changelog

| Date       | Version | Changes         | Author   |
| ---------- | ------- | --------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version | Dev Team |

---

_Last Updated: 2026-01-12_  
_Status: 🟢 Active_  
_Maintainer: Dev Team_
