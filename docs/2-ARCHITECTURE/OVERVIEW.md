# Architecture Overview - SpedireSicuro

## Overview

Questo documento descrive l'architettura generale di SpedireSicuro, un Logistics Operating System (Logistics OS) che orchestra spedizioni, pagamenti e corrieri. Include il Courier Adapter Pattern, la struttura del sistema, e i feature flags.

## Target Audience

- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- Node.js 18+
- Next.js 15 knowledge
- Supabase basics
- TypeScript familiarity

## Quick Reference

| Sezione             | Pagina                          | Link                                                |
| ------------------- | ------------------------------- | --------------------------------------------------- |
| System Overview     | docs/2-ARCHITECTURE/OVERVIEW.md | [System Overview](#system-overview)                 |
| Courier Adapter     | docs/2-ARCHITECTURE/OVERVIEW.md | [Courier Adapter Pattern](#courier-adapter-pattern) |
| Directory Structure | docs/2-ARCHITECTURE/OVERVIEW.md | [Directory Structure](#directory-structure)         |
| Feature Flags       | docs/2-ARCHITECTURE/OVERVIEW.md | [Feature Flags](#feature-flags)                     |
| Stack               | docs/2-ARCHITECTURE/OVERVIEW.md | [Stack Reality Check](#stack-reality-check)         |

## Content

### System Overview

SpedireSicuro è un'**applicazione Next.js 15** con architettura **App Router**, che usa **Supabase** (PostgreSQL) come database e **Vercel** per l'hosting.

**Architettura:** Logistics Operating System (Logistics OS) - Non è un comparatore prezzi, è un'infrastruttura B2B che orchestra spedizioni, pagamenti e corrieri.

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT (Browser)                   │
│  Next.js App Router + React Server Components       │
└─────────────┬───────────────────────────────────────┘
              │
              │ HTTPS
              ↓
┌─────────────────────────────────────────────────────┐
│              VERCEL (Edge Network)                   │
│  ├─ Static Assets (CDN)                             │
│  ├─ Server Components (Node.js)                     │
│  └─ API Routes (Node.js/Edge Runtime)               │
└─────────────┬───────────────────────────────────────┘
              │
              ├──────────────┬──────────────┬──────────────┐
              │              │              │              │
              ↓              ↓              ↓              ↓
      ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
      │ Supabase │   │  Gemini  │   │  XPay    │   │ Courier  │
      │ (DB+Auth)│   │   AI     │   │ Payment  │   │   APIs   │
      └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

**Riferimento Costituzione:**

- [README.md](../../README.md) - Costituzione del sistema (Courier Adapter pattern, 3 modelli operativi)
- [Business Vision](../9-BUSINESS/VISION.md) - Visione business completa

---

### Stack Reality Check

#### Frontend

- **Next.js 15.2+** - App Router (NOT Pages Router)
- **React 18+** - Server Components + Client Components
- **TypeScript** - Strict mode enabled
- **Tailwind CSS** - Utility-first styling
- **Shadcn/UI** - Component library (Radix UI primitives)
- **Framer Motion** - Animations (glassmorphism effects)

#### Backend

- **Next.js API Routes** - `/app/api/**` (Node.js runtime)
- **Server Actions** - `/app/actions/**` (React Server Actions)
- **Supabase Client** - RLS-enforced queries
- **Supabase Admin** - Bypass RLS (server-side only)

#### Database

- **PostgreSQL 15+** - Via Supabase
- **Row Level Security (RLS)** - Tenant isolation
- **Triggers** - Auto-update wallet balance
- **Functions (RPC)** - Business logic in DB

#### Authentication

- **NextAuth.js v5** - Session management
- **Supabase Auth** - User storage (auth.users)
- **Custom Impersonation** - Acting Context system

#### AI/Automation

- **Google Gemini 2.0 Flash** - Multimodal AI (text + vision)
- **LangGraph** - AI workflow orchestration (LIVE - Agent Orchestrator)
- **Puppeteer** - Browser automation (external service)

#### Payments

- **Intesa XPay** - Credit card processing (integration ready, not live)
- **Manual Bank Transfer** - Current live payment method

#### Monitoring

- **Vercel Analytics** - Performance monitoring
- **Supabase Logs** - Database query logs
- **Custom Diagnostics** - `diagnostics_events` table

Vedi [Backend](BACKEND.md) e [Frontend](FRONTEND.md) per dettagli specifici.

---

### Directory Structure

```
spediresicuro/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth group routes
│   │   └── login/
│   ├── dashboard/                # Protected dashboard
│   │   ├── page.tsx             # Main dashboard
│   │   ├── wallet/              # Wallet management
│   │   ├── spedizioni/          # Shipments
│   │   ├── admin/               # Admin pages
│   │   └── impostazioni/        # Settings
│   ├── api/                      # API routes
│   │   ├── auth/[...nextauth]/  # NextAuth endpoints
│   │   ├── shipments/           # Shipment APIs
│   │   ├── wallet/              # Wallet APIs
│   │   ├── impersonate/         # Impersonation APIs
│   │   └── cron/                # Cron jobs
│   ├── actions/                  # Server Actions
│   │   ├── wallet.ts            # Wallet operations
│   │   ├── topups-admin.ts      # Top-up approval
│   │   └── privacy.ts           # GDPR operations
│   └── layout.tsx               # Root layout
│
├── components/                   # React components
│   ├── ui/                      # Shadcn/UI components
│   ├── dashboard/               # Dashboard-specific
│   └── shared/                  # Shared components
│
├── lib/                          # Core libraries
│   ├── auth-config.ts           # NextAuth configuration
│   ├── safe-auth.ts             # Acting Context implementation
│   ├── db/                      # Database utilities
│   │   └── client.ts            # Supabase clients
│   ├── adapters/                # Courier adapters
│   │   └── couriers/            # Courier adapter implementations
│   ├── security/                # Security utilities
│   │   ├── audit-log.ts         # Audit logging
│   │   ├── audit-actions.ts     # Action constants
│   │   └── security-events.ts   # Security event logging
│   ├── payments/                # Payment integrations
│   │   └── intesa-xpay.ts       # XPay integration
│   └── supabase-server.ts       # Server-side Supabase client
│
├── supabase/                     # Database
│   ├── migrations/              # SQL migrations
│   └── seed.sql                 # Seed data (if any)
│
├── middleware.ts                 # Next.js middleware (auth + impersonation)
├── .env.local                   # Local environment variables (not committed)
├── .env.example                 # Template for env vars
└── package.json                 # Dependencies
```

---

### Courier Adapter Pattern (Provider Agnostic)

**Problema:** Il sistema deve supportare multiple provider corrieri (Spedisci.Online, Poste, GLS, ecc.) senza hardcodare logica specifica per provider.

**Soluzione:** Interfaccia adapter astratta con implementazioni specifiche per provider.

#### Core Interface

```typescript
// lib/adapters/couriers/base.ts
export abstract class CourierAdapter {
  protected credentials: CourierCredentials;
  protected courierCode: string;

  constructor(credentials: CourierCredentials, courierCode: string) {
    this.credentials = credentials;
    this.courierCode = courierCode;
  }

  abstract connect(): Promise<boolean>;
  abstract createShipment(data: any): Promise<ShippingLabel>;
  abstract getTracking(trackingNumber: string): Promise<TrackingEvent[]>;
  async cancelShipment?(trackingNumber: string): Promise<void>;
}
```

#### Implementazioni

- `SpedisciOnlineAdapter` - Spedisci.Online API (JSON + CSV fallback)
- `PosteAdapter` - Poste Italiane API
- `MockCourierAdapter` - Testing

#### Factory Pattern

```typescript
// lib/couriers/factory.ts
export async function getShippingProvider(
  userId: string,
  providerId: string
): Promise<CourierAdapter | null> {
  // 1. Load config from DB (courier_configs)
  // 2. Decrypt credentials
  // 3. Instantiate adapter based on providerId
  // 4. Return adapter or null
}
```

**Key Insight:** La business logic (creazione spedizione, tracking) NON chiama mai direttamente le API corriere. Usa sempre l'interfaccia `CourierAdapter`.

**Benefici:**

- ✅ Facile aggiungere nuovi corrieri (basta implementare adapter)
- ✅ Testing con MockCourierAdapter
- ✅ Supporto BYOC (utente fornisce proprie credenziali)
- ✅ Isolamento multi-tenant (ogni utente può avere config diversa)

**Files:**

- `lib/adapters/couriers/base.ts` - Classe base astratta
- `lib/adapters/couriers/spedisci-online.ts` - Implementazione Spedisci.Online
- `lib/adapters/couriers/poste.ts` - Implementazione Poste
- `lib/couriers/factory.ts` - Factory per istanziare adapter

**⚠️ IMPORTANTE:** Le credenziali sono salvate criptate nel database (`courier_configs`). Il factory decripta automaticamente quando istanzia l'adapter.

---

### Feature Flags

#### Live Features (Production Ready)

- ✅ **User Dashboard** - Shipment creation, tracking
- ✅ **Wallet System** - Prepaid credit, top-ups
- ✅ **Multi-Courier** - GLS, BRT, Poste (via Spedisci.Online)
- ✅ **Reseller System** - Hierarchical user management
- ✅ **Acting Context** - SuperAdmin impersonation
- ✅ **Audit Logging** - Security event tracking
- ✅ **GDPR Compliance** - Data export, anonymization
- ✅ **CRM Leads** - Lead management, conversion
- ✅ **Courier Configs** - Encrypted credential storage
- ✅ **Cancelled Shipments** - Soft delete with audit trail

#### Partially Implemented (Infrastructure Ready, UI Missing)

- ✅ **AI Anne Chat UI** - Backend orchestrator completo, chat UI implementata
- 🟡 **Smart Top-Up OCR** - Gemini Vision integration exists, not exposed
- 🟡 **Invoice System** - Tables exist, PDF generation missing
- 🟡 **XPay Payments** - Integration ready, not enabled
- 🟡 **Doctor Service** - Diagnostics logging active, UI dashboard missing

#### Planned (Backlog)

- 📋 **OCR Immagini** - Supporto completo per estrazione dati da immagini (attualmente placeholder)
- 📋 **Fiscal Brain** - F24, LIPE tracking
- 📋 **Multi-Region** - Database sharding
- 📋 **Mobile App** - React Native
- 📋 **API Marketplace** - Public API for integrations

**Key Insight:** Non dichiarare feature come "live" a meno che l'UI non sia accessibile agli utenti.

---

### Environment-Specific Behavior

#### Development (`npm run dev`)

- Uses `NEXT_PUBLIC_SUPABASE_URL` from `.env.local`
- NextAuth callback: `http://localhost:3000/api/auth/callback`
- Hot reload enabled
- Source maps enabled

#### Production (Vercel)

- Uses environment variables from Vercel dashboard
- NextAuth callback: `https://spediresicuro.it/api/auth/callback`
- Optimized builds (tree shaking, minification)
- Edge functions for faster response

#### Preview (Vercel Preview Deployments)

- Separate DB instance (or same as dev)
- Unique preview URL per branch
- Same env vars as production (configurable)

Vedi [6-DEPLOYMENT/ENV_VARS.md](../6-DEPLOYMENT/ENV_VARS.md) per dettagli sulle variabili d'ambiente.

---

### Security Boundaries

#### Client-Side (Browser)

- **Can access:** Public Supabase anon key (RLS enforced)
- **Cannot access:** Service role key, API secrets, encrypted passwords
- **Pattern:** Use Server Actions for sensitive operations

#### Server-Side (Node.js)

- **Can access:** All secrets via environment variables
- **Can bypass:** RLS via `supabaseAdmin`
- **Pattern:** Validate input, enforce business rules

#### Database (PostgreSQL)

- **Enforces:** RLS policies, CHECK constraints, foreign keys
- **Trusted:** Only server-side code (service role)
- **Pattern:** Defense in depth, never trust client

Vedi [8-SECURITY/OVERVIEW.md](../8-SECURITY/OVERVIEW.md) per dettagli sulla sicurezza.

---

## Examples

### Usare Courier Adapter

```typescript
import { getShippingProvider } from '@/lib/couriers/factory';

// Ottieni adapter per utente
const adapter = await getShippingProvider(userId, 'spedisci_online');

if (!adapter) {
  throw new Error('Provider non disponibile per questo utente');
}

// Usa adapter (agnostico rispetto al provider)
const label = await adapter.createShipment({
  recipient: {
    /* ... */
  },
  packages: [
    /* ... */
  ],
});
```

### Verificare Feature Flag

```typescript
// Feature flags sono gestiti via database (users.capabilities)
const { data: user } = await supabase
  .from('users')
  .select('capabilities')
  .eq('id', userId)
  .single();

const hasAIFeatures = user?.capabilities?.includes('ai_chat');
```

---

## Common Issues

| Issue                               | Soluzione                                                            |
| ----------------------------------- | -------------------------------------------------------------------- |
| Provider non disponibile            | Verifica che esista configurazione in `courier_configs` per l'utente |
| Credenziali criptate non decriptate | Verifica che `ENCRYPTION_KEY` sia configurata correttamente          |
| Adapter ritorna null                | Controlla log per errori di decriptazione o configurazione mancante  |
| Feature flag non funziona           | Verifica che `users.capabilities` contenga il flag richiesto         |

---

## Related Documentation

- [Frontend Architecture](FRONTEND.md) - Next.js, React patterns
- [Backend Architecture](BACKEND.md) - API routes, Server Actions
- [Database Architecture](DATABASE.md) - Schema, RLS, migrations
- [AI Orchestrator](AI_ORCHESTRATOR.md) - LangGraph, Workers
- [Security Overview](../8-SECURITY/OVERVIEW.md) - Sicurezza e compliance
- [Business Vision](../9-BUSINESS/VISION.md) - Visione business

---

## Changelog

| Date       | Version | Changes         | Author   |
| ---------- | ------- | --------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version | AI Agent |

---

_Last Updated: 2026-01-12_  
_Status: 🟢 Active_  
_Maintainer: Team_
