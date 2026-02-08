# SpedireSicuro.it - Logistics Operating System

> **Last Updated:** January 31, 2026
> **Status:** In Development / Testing
> **Started:** November 26, 2025

---

<div align="center">

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![Security](https://img.shields.io/badge/security-hardened-success)
![Stack](https://img.shields.io/badge/stack-Next.js%2015%20%2B%20Supabase-blue)

</div>

---

## New Here? Start Here

**For AI Chat Sessions:** Read [docs/START_HERE.md](./docs/START_HERE.md) to sync quickly on current system state.

**For Contributors:** Read [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

**For Documentation:** Browse [docs/INDEX.md](./docs/INDEX.md) to find what you need.

---

## WARNING: This is NOT a Price Comparator

**SpedireSicuro is a Logistics Operating System (Logistics OS):** A B2B infrastructure that orchestrates shipments, payments, and carriers.

**STATUS: IN DEVELOPMENT / TESTING**

Questo progetto e' attualmente in fase di sviluppo e testing. **NON e' ancora pronto per uso in produzione.** L'obiettivo e' raggiungere production readiness nei prossimi mesi, a condizione che tutti i componenti (sviluppo, AI, testing) rispettino rigorosamente i principi architetturali.

**This is financial and logistics infrastructure.** Every code change must respect the architectural principles defined in this document. No "feature creep" or architectural drift is allowed.

---

## GUIDA PER LE AI (AI Agents & Auditors)

**Questa sezione e' dedicata alle AI che analizzano o modificano questo codebase.**

### Visione di Business in Breve

SpedireSicuro e' un **Logistics Operating System** che supporta **3 modelli operativi formali**:

1. **Broker/Arbitraggio (B2B Core):** Target Reseller/Agenzie. Guadagno: Spread su spedizioni. Wallet interno obbligatorio.
2. **SaaS/BYOC:** Target E-commerce/Aziende con propri contratti. Guadagno: Canone o fee per etichetta. Wallet NON toccato (solo fee SaaS).
3. **Web Reseller (B2C):** Target Utenti privati occasionali. Guadagno: Spread (come Broker). Wallet "Web Channel" centralizzato.

### Principi Architetturali Inderogabili

1. **Financial Core:** "No Credit, No Label" - Nessuna etichetta senza credito nel wallet
2. **Atomicita':** Solo funzioni SQL atomiche per wallet (`decrement_wallet_balance`, `increment_wallet_balance`)
3. **Idempotenza:** Ogni operazione ha `idempotency_key`
4. **Multi-Tenant:** Isolamento completo via RLS (Row Level Security)
5. **AI-First:** LangGraph Supervisor coordina worker specializzati (OCR, Address, Pricing, Booking)

### Documenti Chiave da Leggere

- **README.md** (questo file) - Costituzione del sistema
- **MIGRATION_MEMORY.md** - Stato sviluppo attuale e architettura AI
- **docs/MONEY_FLOWS.md** - Sistema wallet e flussi finanziari
- **docs/2-ARCHITECTURE/OVERVIEW.md** - Deep dive tecnico
- **docs/8-SECURITY/OVERVIEW.md** - Architettura sicurezza multi-tenant

### Cosa NON Fare

- MAI update diretto a `wallet_balance` (solo funzioni RPC atomiche)
- NON mischiare logica dei 3 modelli operativi
- NON bypassare wallet per "fare prima"
- NON loggare PII (indirizzi, nomi, telefoni) - solo `user_id_hash` e `trace_id`

---

## Storia & Evoluzione del Progetto

**Day One: 26 Novembre 2025** - Setup iniziale progetto e prima configurazione deploy Vercel.

**Novembre-Dicembre 2025:** Costruzione architettura core - wallet atomizzato, integrazione corrieri (Spedisci.Online), sistema multi-tenant con RLS, AI Orchestrator "Anne" con LangGraph Supervisor.

**Gennaio 2026:** Espansione funzionalita' - sistema fatture, gestione giacenze, rubrica contatti, client email (Posta), OCR scanner, listini fornitori, integrazioni multi-provider (SpediamoPro), analytics finanziarie reseller, sistema contrassegni e resi.

**Stato Attuale (Gennaio 2026):**

- 1260+ commit, 31 database migrations
- 27 dashboard pages
- Core architetturale completato e in testing
- Rollout & Economics in corso (validazione GTM)

---

## Feature Principali

### Core Features

#### Gestione Spedizioni

- **Creazione Spedizioni**: Form wizard completo con validazione, supporto multi-corriere (GLS, BRT, Poste Italiane, UPS, FedEx, TNT via Spedisci.Online e SpediamoPro)
- **Tracking Spedizioni**: Monitoraggio stato in tempo reale con normalizzazione status multi-corriere
- **Download LDV**: Download etichette originali dai corrieri o fallback generato
- **Spedizioni Cancellate**: Soft delete con audit trail, cancellazione simultanea su Spedisci.Online, RBAC reseller
- **Gestione Giacenze**: Rilevamento automatico da tracking, azioni (riconsegna, reso, distruzione) con addebito wallet

#### Sistema Wallet

- **Wallet Prepagato**: Sistema atomizzato con "No Credit, No Label"
- **Operazioni Atomiche**: Debit/Credit con funzioni SQL atomiche e lock pessimistico
- **Idempotency**: Prevenzione doppi addebiti con `idempotency_locks`
- **Rimborso Automatico**: Refund su cancellazione spedizione
- **Audit Trail**: Tutti i movimenti in `wallet_transactions` (immutabile, append-only)

#### Multi-Corriere

- **Spedisci.Online**: Aggregatore per GLS, BRT, Poste Italiane, UPS, ecc.
- **SpediamoPro**: Integrazione completa come provider alternativo
- **Multi-Account**: Gestione simultanea di multipli account per utente con routing intelligente
- **BYOC**: Supporto "Bring Your Own Carrier" per clienti con contratti propri
- **Fulfillment Orchestrator**: Routing intelligente tra adapter diretti e broker

#### Sistema Reseller

- **Gerarchia Utenti**: Reseller possono creare e gestire sub-user
- **Visibilita' Multi-Tenant**: Reseller vedono proprie spedizioni + quelle dei sub-user
- **Wallet Separati**: Ogni reseller ha il proprio wallet indipendente
- **Analytics**: Report fiscale per provider con margini, analytics finanziarie
- **Listini Personalizzati**: Listini fornitori e personalizzati per reseller
- **Team Management**: Gestione team reseller

#### Sistema Fatture

- **Generazione Fatture**: Creazione fatture con calcolo automatico IVA
- **FatturaPA XML**: Generazione XML conforme al formato italiano
- **Download PDF/XML**: Export fatture in entrambi i formati
- **Gestione Completa**: Lista, dettaglio, stati (bozza, emessa)

#### Comunicazioni

- **Client Email (Posta)**: Inbox, compose, reply-all, drafts, cartelle (inbox/sent/drafts/trash) - superadmin
- **Email Transazionali**: Integrazione Resend per notifiche
- **Webhook Inbound**: Ricezione email in entrata
- **Telegram Bot**: Notifiche e automazioni via Telegram

#### Rubrica Contatti

- **Gestione Contatti**: CRUD completo con autocomplete da Posta
- **Integrazione Wizard**: Selezione rapida mittente/destinatario

#### AI Orchestrator (Anne)

- **LangGraph Supervisor**: Orchestrazione intelligente con worker specializzati
- **OCR Worker**: Estrazione dati da testo e immagini (Gemini Vision)
- **Address Worker**: Normalizzazione indirizzi italiani (CAP, provincia, citta')
- **Pricing Worker**: Calcolo preventivi multi-corriere
- **Booking Worker**: Prenotazione spedizioni con preflight checks
- **Multi-Provider AI**: Supporto per Anthropic Claude e DeepSeek

#### OCR Scanner

- **Scansione Documenti**: OCR per estrazione dati spedizione da immagini/PDF
- **Dashboard Dedicata**: `/dashboard/ocr-scanner`

#### Sicurezza & Compliance

- **Row Level Security (RLS)**: Isolamento multi-tenant a livello database
- **Acting Context**: SuperAdmin puo' agire per conto utenti (completamente auditato)
- **API Key Authentication**: Autenticazione per integrazioni esterne con hashing SHA-256
- **CSP Headers**: Content Security Policy completa con report endpoint
- **Sentry**: Error tracking e monitoring
- **Encryption**: Credenziali corrieri criptate at rest

#### Altre Feature

- **Contrassegni**: Gestione contrassegni spedizioni
- **Resi / Scanner Resi**: Gestione resi con scanner dedicato
- **Configurazioni Corrieri**: UI per gestione configurazioni
- **Integrazioni**: Dashboard per gestione integrazioni esterne
- **Impostazioni**: Profilo utente e privacy
- **Voice**: Funzionalita' vocale
- **Dashboard Admin**: Gestione utenti, spedizioni, bonifici, automazioni, metriche, logs, features, invoices, leads, doctor
- **Super Admin**: Listini master, verifica costi, financial overview

---

## Stack Tecnologico

### Backend

- **Next.js 15** (^15.5.11) - App Router con Server Actions
- **TypeScript** (^5.3.0) - Strict type checking
- **Supabase** - PostgreSQL con RLS (Row Level Security)
- **Sentry** - Error tracking e performance monitoring

### Frontend

- **React 18** (^18.2.0) - Server Components + Client Components
- **Tailwind CSS + Shadcn/UI** - Component library
- **Framer Motion** - Animazioni
- **Lucide React** - Icone

### Database

- **PostgreSQL 15+** (via Supabase)
- **31 migrations** - Schema completo con RLS policies
- **Functions SQL** - Operazioni atomiche wallet (SECURITY DEFINER)

### Infrastruttura

- **Vercel** - Deploy automatico
- **Resend** - Email transazionali
- **Sentry** - Monitoring
- **ESLint 9** (^9.39.2) - Linting

---

## Architettura di Business (Il Modello Ibrido)

Il sistema supporta **TRE modalita' operative** che convivono sulla stessa codebase. **Non devono mai essere mischiate logicamente.**

### A. Modello "Broker / Arbitraggio" (B2B Core)

**Target:** Agenzie, CAF, Reseller.

**Funzionamento:**

- Il cliente usa i **NOSTRI contratti corriere** (es. Spedisci.online Master).
- Il sistema gestisce credenziali e contratti centralmente.

**Flusso Denaro:**

```
Cliente -> Wallet Interno -> Pagamento Fornitore
```

**Guadagno:** Spread (Prezzo Vendita - Prezzo Acquisto).

**Implementazione:**

- `courier_configs.is_default = true` (configurazione master)
- Wallet interno DEVE essere utilizzato per ogni spedizione
- `decrement_wallet_balance()` chiamato PRIMA di creare spedizione

### B. Modello "SaaS / BYOC" (Bring Your Own Carrier)

**Target:** E-commerce strutturati, Aziende con propri contratti.

**Funzionamento:**

- Il cliente inserisce le **SUE credenziali** (es. API Key Spedisci.online, Credenziali Poste).
- Il sistema usa le credenziali del cliente per chiamare il corriere.

**Flusso Denaro:**

```
Cliente -> Pagamento Diretto Corriere
Wallet Interno -> SOLO per fee SaaS (se applicabile)
```

**Guadagno:** Canone Software o Fee per etichetta.

**Implementazione:**

- `courier_configs.owner_user_id = user_id` (configurazione BYOC)
- Wallet interno **NON viene toccato** per la spedizione (solo fee SaaS)
- Credenziali criptate con `ENCRYPTION_KEY`

### C. Modello "Web Reseller" (B2C Channel)

**Target:** Utente privato occasionale (sito pubblico).

**Funzionamento:**

- Architetturalmente, il B2C e' trattato come **UN UNICO GRANDE RESELLER** ("Web Channel").
- L'utente finale non ha dashboard. Paga al checkout.
- Il sistema usa il wallet del "Web Channel" per generare l'etichetta.

**Flusso Denaro:**

```
Utente B2C -> Checkout (Pagamento Carta) -> Wallet "Web Channel" -> Pagamento Fornitore
```

**Guadagno:** Spread (Prezzo Vendita - Prezzo Acquisto).

---

## Financial Core ("Wallet Only")

Il cuore del sistema **non e' la spedizione, e' il WALLET**. Vige la regola:

### **"No Credit, No Label"**

Nessuna etichetta viene generata senza credito disponibile nel wallet.

### Principi Finanziari Inderogabili

#### 1. Atomicita'

**Ogni movimento di denaro DEVE usare le funzioni SQL atomiche.**

```typescript
// CORRETTO
await supabaseAdmin.rpc('decrement_wallet_balance', {
  p_user_id: userId,
  p_amount: cost,
});

// VIETATO ASSOLUTAMENTE
await supabaseAdmin.from('users').update({ wallet_balance: newBalance }).eq('id', userId);
```

**Funzioni Atomiche Disponibili:**

- `decrement_wallet_balance(user_id, amount)` - Debit atomico con lock pessimistico
- `increment_wallet_balance(user_id, amount)` - Credit atomico con lock pessimistico
- `add_wallet_credit(user_id, amount, description, created_by)` - Credit con audit trail

#### 2. Idempotenza

**Ogni addebito DEVE avere una `idempotency_key` per prevenire doppi addebiti.**

```typescript
const idempotencyKey = crypto
  .createHash('sha256')
  .update(JSON.stringify({ userId, recipient, packages, timestamp: Math.floor(Date.now() / 5000) }))
  .digest('hex');

const { data: lockResult } = await supabaseAdmin.rpc('acquire_idempotency_lock', {
  p_idempotency_key: idempotencyKey,
  p_user_id: targetId,
  p_ttl_minutes: 30,
});
```

#### 3. Audit Trail

**Nessun saldo cambia senza una riga corrispondente in `wallet_transactions`.**

**Invariante:** `SUM(wallet_transactions.amount) = users.wallet_balance` (per ogni utente)

#### 4. Prepagato Puro

**Nessun "Pay as you go" con carta per singola etichetta B2B.**

Flusso obbligatorio:

1. Cliente ricarica wallet (bonifico o carta)
2. Admin approva ricarica (se bonifico)
3. Cliente crea spedizione (debit da wallet)

---

## Anti-Pattern (COSA NON FARE)

### NON creare logica di prezzo hardcoded nel frontend

```typescript
// VIETATO
const price = 8.5;

// CORRETTO
const { data: price } = await fetch('/api/shipments/estimate', {
  method: 'POST',
  body: JSON.stringify(shipmentData),
});
```

### NON bypassare il Wallet per "fare prima"

```typescript
// VIETATO - se il wallet e' giu', si ferma tutto
if (walletError) {
  await supabaseAdmin.from('users').update({ wallet_balance: ... })
}

// CORRETTO
if (walletError) {
  throw new Error(`Wallet debit failed: ${walletError.message}`)
}
```

### NON mischiare la logica B2C con quella B2B

Il B2C e' solo un "cliente speciale" del sistema B2B. Usa lo stesso flusso, ma con wallet "Web Channel".

---

## Developer Guide

### Prerequisiti

- **Node.js 18+** e npm
- **Supabase account** (cloud o local)
- **Git**

### Setup Locale

```bash
# 1. Clona repository
git clone https://github.com/gdsgroupsas-jpg/spediresicuro.git
cd spediresicuro

# 2. Installa dipendenze
npm install

# 3. Configura environment
cp .env.example .env.local
# Modifica .env.local con le tue credenziali Supabase

# 4. Verifica setup
npm run setup:check

# 5. Avvia server di sviluppo
npm run dev
```

### Environment Variables

Copia `.env.example` a `.env.local` e configura:

```bash
# Obbligatori
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_random_secret_32_chars
ENCRYPTION_KEY=your_encryption_key_32_chars

# Opzionali (per funzionalita' complete)
GOOGLE_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_google_oauth_id
GOOGLE_CLIENT_SECRET=your_google_oauth_secret
```

Vedi [`.env.example`](.env.example) per lista completa.

### Comandi Utili

```bash
# Sviluppo
npm run dev                 # Avvia server di sviluppo
npm run build               # Build produzione (SEMPRE eseguire prima di push)

# Verifica
npm run setup:check         # Verifica setup completo
npm run type-check          # Validazione TypeScript
npm run lint                # Validazione ESLint

# Database (se usi Supabase local)
npx supabase start          # Avvia Supabase locale
npx supabase stop           # Ferma Supabase locale
npx supabase db reset       # Reset e applica migrations

# Testing
npm run test                # Unit test
npm run smoke:wallet        # Smoke test wallet invariants
```

---

## Dashboard Pages

Il sistema ha **27 pagine dashboard**:

| Sezione         | Path                                 | Descrizione                                  |
| --------------- | ------------------------------------ | -------------------------------------------- |
| Home            | `/dashboard`                         | Overview principale                          |
| Spedizioni      | `/dashboard/spedizioni`              | Lista, creazione, dettaglio, cancellate      |
| Wallet          | `/dashboard/wallet`                  | Saldo, transazioni, ricarica                 |
| Fatture         | `/dashboard/fatture`                 | Lista e dettaglio fatture                    |
| Giacenze        | `/dashboard/giacenze`                | Gestione spedizioni in giacenza              |
| Rubrica         | `/dashboard/rubrica`                 | Gestione contatti                            |
| Posta           | `/dashboard/posta`                   | Client email (superadmin)                    |
| Listini         | `/dashboard/listini`                 | Listini prezzi                               |
| Contrassegni    | `/dashboard/contrassegni`            | Gestione contrassegni                        |
| Resi            | `/dashboard/resi`                    | Gestione resi                                |
| OCR Scanner     | `/dashboard/ocr-scanner`             | Scansione documenti                          |
| Integrazioni    | `/dashboard/integrazioni`            | Gestione integrazioni                        |
| Config Corrieri | `/dashboard/configurazioni-corrieri` | Configurazione corrieri                      |
| Dati Cliente    | `/dashboard/dati-cliente`            | Profilo cliente                              |
| Impostazioni    | `/dashboard/impostazioni`            | Impostazioni account                         |
| Voice           | `/dashboard/voice`                   | Funzionalita' vocale                         |
| Finanza         | `/dashboard/finanza`                 | Analytics finanziarie                        |
| Bonifici        | `/dashboard/bonifici`                | Gestione bonifici                            |
| Team            | `/dashboard/team`                    | Gestione team                                |
| Reseller        | `/dashboard/reseller/*`              | Clienti, listini, preventivo, report fiscale |
| BYOC            | `/dashboard/byoc/*`                  | Listini fornitore BYOC                       |
| Admin           | `/dashboard/admin/*`                 | Users, shipments, configs, metrics, logs     |
| Super Admin     | `/dashboard/super-admin/*`           | Listini master, verifica costi, financial    |

---

## Documentazione

### Documenti Core

- **[docs/START_HERE.md](docs/START_HERE.md)** - Punto di partenza per AI e contributors
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Linee guida sviluppo
- **[MIGRATION_MEMORY.md](MIGRATION_MEMORY.md)** - Architettura AI Orchestrator (Single Source of Truth)

### Architettura

- **[docs/2-ARCHITECTURE/OVERVIEW.md](docs/2-ARCHITECTURE/OVERVIEW.md)** - Overview architettura
- **[docs/2-ARCHITECTURE/FRONTEND.md](docs/2-ARCHITECTURE/FRONTEND.md)** - Architettura frontend
- **[docs/MONEY_FLOWS.md](docs/MONEY_FLOWS.md)** - Sistema wallet e flussi finanziari
- **[docs/8-SECURITY/OVERVIEW.md](docs/8-SECURITY/OVERVIEW.md)** - Architettura sicurezza multi-tenant

### Milestones

- **[docs/milestones/MILESTONE-OUTREACH-S3.md](docs/milestones/MILESTONE-OUTREACH-S3.md)** - Sprint S3: Multi-Channel Outreach System

### Operativo

- **[docs/6-DEPLOYMENT/VERCEL.md](docs/6-DEPLOYMENT/VERCEL.md)** - Deploy Vercel
- **[docs/OPS_RUNBOOK.md](docs/OPS_RUNBOOK.md)** - Deployment, incident response, monitoring
- **[WALLET_SECURITY_GUARDRAILS.md](WALLET_SECURITY_GUARDRAILS.md)** - Regole critiche wallet

---

## Quick Reference

### File Critici

#### API Routes

- `app/api/spedizioni/route.ts` - Gestione spedizioni (creazione, cancellazione, lista)
- `app/api/shipments/create/route.ts` - Creazione spedizione (wallet debit + idempotency)
- `app/api/quotes/realtime/route.ts` - Preventivi multi-corriere in tempo reale
- `app/api/giacenze/` - Gestione giacenze (lista, dettaglio, azioni)
- `app/api/invoices/` - Fatture (lista, PDF, XML)

#### Core Libraries

- `lib/wallet/retry.ts` - Smart retry per lock contention
- `lib/services/fulfillment/orchestrator.ts` - Fulfillment Orchestrator
- `lib/services/giacenze/giacenze-service.ts` - Servizio giacenze
- `lib/agent/orchestrator/supervisor-router.ts` - AI Orchestrator entry point
- `lib/adapters/couriers/spedisci-online.ts` - Adapter Spedisci.Online

#### Funzioni SQL Atomiche

- `decrement_wallet_balance(user_id, amount)` - Debit atomico
- `increment_wallet_balance(user_id, amount)` - Credit atomico
- `add_wallet_credit(user_id, amount, description, created_by)` - Credit con audit trail
- `acquire_idempotency_lock(key, user_id, ttl)` - Lock idempotency

---

## Testing & Validazione

### Wallet Invariants

**INVARIANTE: "No Credit, No Label" (bidirezionale).**

- **No Credit, No Label**: nessuna label senza credito disponibile.
- **No Label, No Credit**: se la label non viene creata, il credito non resta scalato (refund/compensation).

```bash
npm run smoke:wallet
```

### Type Checking & Linting

```bash
npm run type-check
npm run lint
npm run build          # Build completa (CONSIGLIATA prima di push)
```

---

## Deployment

### Vercel

1. Push code su GitHub
2. Deploy automatico su ogni push a `master`
3. Environment variables configurate su Vercel dashboard

---

## Security

- **Multi-Tenant Isolation:** Row Level Security (RLS) su tutte le tabelle tenant
- **Audit Logging:** Tutte le operazioni sensibili loggate
- **Acting Context:** SuperAdmin puo' agire per conto utenti (auditato)
- **Encryption:** Credenziali corrieri criptate at rest
- **CSP:** Content Security Policy con report endpoint
- **API Keys:** Hashing SHA-256, rate limiting, auto-expiry

Vedi [docs/SECURITY.md](docs/SECURITY.md) per dettagli.

---

## Contributing

Leggi [CONTRIBUTING.md](CONTRIBUTING.md) per checklist code review, requisiti security gate, e best practices.

---

## Support

- **Documentazione:** Cartella `docs/`
- **Issues:** [GitHub Issues](https://github.com/gdsgroupsas-jpg/spediresicuro/issues)
- **Security:** GitHub Security Advisories

---

**Questo e' un Logistics OS, non un comparatore prezzi. Ogni modifica deve rispettare i principi architetturali definiti in questo documento.**

---

_Last updated: January 31, 2026_
_Status: In Development / Testing_
