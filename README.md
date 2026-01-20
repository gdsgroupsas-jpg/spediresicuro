# 📦 SpedireSicuro.it - Logistics Operating System

> **Version:** 1.0.0
> **Last Updated:** January 20, 2026
> **Status:** 🚧 In Development | 🔒 Security Hardened
> **Release:** v1.0.0

---

<div align="center">

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![Security](https://img.shields.io/badge/security-hardened-success)
![Stack](https://img.shields.io/badge/stack-Next.js%2014%20%2B%20Supabase-blue)
![Issues](https://img.shields.io/badge/P0%20issues-4%20remaining-orange)

</div>

---

## 🚀 New Here? Start Here!

**For AI Chat Sessions:** Read [docs/START_HERE.md](./docs/START_HERE.md) to sync quickly on current system state.

**For Contributors:** Read [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

**For Documentation:** Browse [docs/INDEX.md](./docs/INDEX.md) to find what you need.

---

## ⚠️ WARNING: This is NOT a Price Comparator

**SpedireSicuro is a Logistics Operating System (Logistics OS):** A B2B infrastructure that orchestrates shipments, payments, and carriers.

**⚠️ STATUS: IN DEVELOPMENT / TESTING**

Questo progetto è attualmente in fase di sviluppo e testing. **NON è ancora pronto per uso in produzione.** L'obiettivo è raggiungere production readiness nei prossimi mesi, a condizione che tutti i componenti (sviluppo, AI, testing) rispettino rigorosamente i principi architetturali.

**This is financial and logistics infrastructure.** Every code change must respect the architectural principles defined in this document. No "feature creep" or architectural drift is allowed.

---

## 📜 DOCUMENTO MASTER ARCHITETTURALE

**⚠️ COSTITUZIONE DEL SISTEMA**

Qualsiasi modifica al codice deve rispettare rigorosamente i principi qui descritti. Non sono ammesse "derive" o "feature creep" non allineate a questa visione.

---

## 🤖 GUIDA PER LE AI (AI Agents & Auditors)

**Questa sezione è dedicata alle AI che analizzano o modificano questo codebase.**

### Visione di Business in Breve

SpedireSicuro è un **Logistics Operating System** che supporta **3 modelli operativi formali**:

1. **Broker/Arbitraggio (B2B Core):** Target Reseller/Agenzie. Guadagno: Spread su spedizioni. Wallet interno obbligatorio.
2. **SaaS/BYOC:** Target E-commerce/Aziende con propri contratti. Guadagno: Canone o fee per etichetta. Wallet NON toccato (solo fee SaaS).
3. **Web Reseller (B2C):** Target Utenti privati occasionali. Guadagno: Spread (come Broker). Wallet "Web Channel" centralizzato.

### Principi Architetturali Inderogabili

1. **Financial Core:** "No Credit, No Label" - Nessuna etichetta senza credito nel wallet
2. **Atomicità:** Solo funzioni SQL atomiche per wallet (`decrement_wallet_balance`, `increment_wallet_balance`)
3. **Idempotenza:** Ogni operazione ha `idempotency_key`
4. **Multi-Tenant:** Isolamento completo via RLS (Row Level Security)
5. **AI-First:** LangGraph Supervisor coordina worker specializzati (OCR, Address, Pricing, Booking)

### Documenti Chiave da Leggere

- **README.md** (questo file) - Costituzione del sistema
- **MIGRATION_MEMORY.md** - Stato sviluppo attuale e architettura AI
- **docs/MONEY_FLOWS.md** - Sistema wallet e flussi finanziari
- **docs/ARCHITECTURE.md** - Deep dive tecnico
- **docs/SECURITY.md** - Architettura sicurezza multi-tenant

### Cosa NON Fare

- ❌ MAI update diretto a `wallet_balance` (solo funzioni RPC atomiche)
- ❌ NON mischiare logica dei 3 modelli operativi
- ❌ NON bypassare wallet per "fare prima"
- ❌ NON loggare PII (indirizzi, nomi, telefoni) - solo `user_id_hash` e `trace_id`

### Stato Sviluppo

- ✅ Core architetturale completato (FASE 1-2.8)
- 🟡 Rollout controllato in corso (FASE 3)
- 📋 Scaling futuro (FASE 4)

**Per dettagli completi, vedere sezione "Roadmap" più sotto.**

---

## 🎯 1. Visione & Identità

### What SpedireSicuro IS

**SpedireSicuro NON è un semplice comparatore di prezzi.**

**SpedireSicuro è un Logistics OS (Sistema Operativo Logistico):** Un'infrastruttura B2B che orchestra spedizioni, pagamenti e corrieri.

### Value Proposition

Il valore non è solo "vendere la spedizione", ma fornire l'infrastruttura per gestirla.

- **Per il Cliente B2B:** Siamo il suo gestionale operativo.
- **Per il Canale B2C:** Siamo il "Reseller Web" invisibile che gestisce il fulfillment.

### Storia & Evoluzione del Progetto

**Versione 0.1-0.2 (2024):** Sistema base di gestione spedizioni con integrazione corrieri.

**Versione 0.3 (2025 - Attuale):** Trasformazione in Logistics OS con:

- **AI-First Architecture:** LangGraph Supervisor + Gemini 2.0 Flash per automazione radicale
- **Multi-Model Business:** Supporto formale per 3 modelli operativi (Broker, BYOC, B2C)
- **Financial Core:** Sistema wallet atomizzato con "No Credit, No Label"
- **Time-Saving Massivo:** OCR AI riduce inserimento da ~3 minuti a ~10 secondi per reseller

**Stato Attuale (Dicembre 2025 - Versione 0.3):**

- ✅ FASE 1-2.8: Architettura & Migrazione completata (264 unit test, 90 integration test)
- 🟡 FASE 3: Rollout & Economics in corso (validazione GTM)
- 📋 FASE 4: Scaling & Optimization (futuro)

---

## 🎯 Feature Principali

### Core Features

#### Gestione Spedizioni

- **Creazione Spedizioni**: Form completo con validazione, supporto multi-corriere (GLS, BRT, Poste Italiane via Spedisci.Online)
- **Tracking Spedizioni**: Monitoraggio stato spedizioni in tempo reale
- **Download LDV**: Download etichette originali dai corrieri o fallback generato
- **Spedizioni Cancellate**: Sistema soft delete con audit trail completo, cancellazione simultanea su Spedisci.Online, visibilità reseller per sub-user (31 Dicembre 2025)
  - Pagina dedicata `/dashboard/spedizioni/cancellate`
  - Tracking completo: chi, quando, come ha cancellato
  - RBAC: Admin vede tutto, Reseller vede proprie + sub-user, User vede solo proprie

#### Sistema Wallet

- **Wallet Prepagato**: Sistema wallet atomizzato con "No Credit, No Label"
- **Operazioni Atomiche**: Debit/Credit garantiti con funzioni SQL atomiche
- **Idempotency**: Prevenzione doppi addebiti con sistema di lock
- **Audit Trail**: Tutti i movimenti tracciati in `wallet_transactions`

#### Multi-Corriere

- **Integrazione Spedisci.Online**: Aggregatore per GLS, BRT, Poste Italiane, UPS, ecc.
- **Multi-Account Support**: Gestione simultanea di multipli account Spedisci.Online per utente con routing intelligente.
- **Configurazioni BYOC**: Supporto "Bring Your Own Carrier" per clienti con contratti propri
- **Configurazioni Reseller**: Ogni reseller può avere le proprie credenziali corriere
- **Fulfillment Orchestrator**: Routing intelligente tra adapter diretti e broker

#### Sistema Reseller

- **Gerarchia Utenti**: Reseller possono creare e gestire sub-user
- **Visibilità Multi-Tenant**: Reseller vedono le proprie spedizioni + quelle dei sub-user
- **Wallet Separati**: Ogni reseller ha il proprio wallet indipendente
- **RBAC Completo**: Controllo accessi basato su ruoli (Admin, Reseller, User)

#### AI Orchestrator (Anne)

- **LangGraph Supervisor**: Orchestrazione intelligente con worker specializzati
- **OCR Worker**: Estrazione dati da testo e immagini (Gemini Vision)
- **Address Worker**: Normalizzazione indirizzi italiani (CAP, provincia, città)
- **Pricing Worker**: Calcolo preventivi multi-corriere
- **Booking Worker**: Prenotazione spedizioni con preflight checks
- **Telemetria Strutturata**: Tracking completo di tutte le operazioni AI
- **Multi-Provider AI**: Supporto per Anthropic Claude e DeepSeek (selezione tramite UI Superadmin)

#### Sicurezza & Compliance

- **Row Level Security (RLS)**: Isolamento multi-tenant a livello database
- **Acting Context**: SuperAdmin può agire per conto utenti (completamente auditato)
- **GDPR Compliance**: Export dati e anonimizzazione supportati
- **Audit Logging**: Tutte le operazioni sensibili tracciate
- **Encryption**: Credenziali corrieri criptate at rest

### 🟡 Feature in Sviluppo

- **AI Anne Chat UI**: Backend orchestrator completo, chat UI in sviluppo
- **XPay Payments**: Integrazione pagamenti carta per ricarica wallet (backend ready)
- **Invoice System**: Generazione fatture PDF (tabelle DB pronte)

### 📋 Feature Pianificate

- **WhatsApp Native Bot**: Creazione spedizioni via chat WhatsApp
- **Self-Healing Logistics**: Sistema che si auto-monitora e auto-ripara
- **White-label Ready**: Rivendibilità ad altri consorzi/logistici

**Versione 1.0 (Go To Market - Futuro):**

- Release ufficiale al momento del Go To Market
- Tutte le feature core stabilizzate e validate
- Production ready con SLA e supporto

**Visione Futura (Post 1.0):**

- WhatsApp Native Bot per creazione spedizioni via chat
- Self-Healing Logistics (sistema che si auto-monitora e auto-ripara)
- White-label ready per rivendibilità ad altri consorzi/logistici

---

## 🏛️ 2. Architettura di Business (Il Modello Ibrido)

Il sistema supporta **TRE modalità operative** che convivono sulla stessa codebase. **Non devono mai essere mischiate logicamente.**

### A. Modello "Broker / Arbitraggio" (B2B Core)

**Target:** Agenzie, CAF, Reseller.

**Funzionamento:**

- Il cliente usa i **NOSTRI contratti corriere** (es. Spedisci.online Master).
- Il sistema gestisce credenziali e contratti centralmente.

**Flusso Denaro:**

```
Cliente → Wallet Interno → Pagamento Fornitore
```

**Guadagno:** Spread (Prezzo Vendita - Prezzo Acquisto).

**Implementazione:**

- `courier_configs.is_default = true` (configurazione master)
- Wallet interno DEVE essere utilizzato per ogni spedizione
- `decrement_wallet_balance()` chiamato PRIMA di creare spedizione

---

### B. Modello "SaaS / BYOC" (Bring Your Own Carrier)

**Target:** E-commerce strutturati, Aziende con propri contratti.

**Funzionamento:**

- Il cliente inserisce le **SUE credenziali** (es. API Key Spedisci.online, Credenziali Poste).
- Il sistema usa le credenziali del cliente per chiamare il corriere.

**Flusso Denaro:**

```
Cliente → Pagamento Diretto Corriere
Wallet Interno → SOLO per fee SaaS (se applicabile)
```

**Guadagno:** Canone Software o Fee per etichetta.

**Implementazione:**

- `courier_configs.owner_user_id = user_id` (configurazione BYOC)
- Wallet interno **NON viene toccato** per la spedizione (solo fee SaaS)
- Credenziali criptate con `ENCRYPTION_KEY`

---

### C. Modello "Web Reseller" (B2C Channel)

**Target:** Utente privato occasionale (sito pubblico).

**Funzionamento:**

- Architetturalmente, il B2C è trattato come **UN UNICO GRANDE RESELLER** ("Web Channel").
- L'utente finale non ha dashboard. Paga al checkout.
- Il sistema usa il wallet del "Web Channel" per generare l'etichetta.

**Flusso Denaro:**

```
Utente B2C → Checkout (Pagamento Carta) → Wallet "Web Channel" → Pagamento Fornitore
```

**Guadagno:** Spread (Prezzo Vendita - Prezzo Acquisto), identico al modello Broker. Il margine viene applicato al prezzo mostrato all'utente B2C al checkout.

**Vantaggio:** Nessuna gestione account/wallet per utenti da 1 spedizione l'anno.

**Implementazione:**

- Utente B2C → Checkout → Pagamento → Wallet "Web Channel" → Etichetta
- Nessun wallet personale per utente B2C
- Il "Web Channel" è un account reseller speciale con wallet prepagato

---

## 💰 3. Financial Core ("Wallet Only")

Il cuore del sistema **non è la spedizione, è il WALLET**. Vige la regola:

### 🚫 **"No Credit, No Label"**

Nessuna etichetta viene generata senza credito disponibile nel wallet.

---

### Principi Finanziari Inderogabili

#### ✅ 1. Atomicità

**Ogni movimento di denaro DEVE usare le funzioni SQL atomiche.**

```typescript
// ✅ CORRETTO
await supabaseAdmin.rpc('decrement_wallet_balance', {
  p_user_id: userId,
  p_amount: cost,
});

// ❌ VIETATO ASSOLUTAMENTE
await supabaseAdmin.from('users').update({ wallet_balance: newBalance }).eq('id', userId);
```

**Funzioni Atomiche Disponibili:**

- `decrement_wallet_balance(user_id, amount)` - Debit atomico con lock pessimistico
- `increment_wallet_balance(user_id, amount)` - Credit atomico con lock pessimistico
- `add_wallet_credit(user_id, amount, description, created_by)` - Credit con audit trail

**Migrations:**

- `040_wallet_atomic_operations.sql` - Funzioni atomiche
- `041_remove_wallet_balance_trigger.sql` - Rimozione trigger legacy

---

#### ✅ 2. Idempotenza

**Ogni addebito DEVE avere una `idempotency_key` per prevenire doppi addebiti.**

```typescript
// Genera idempotency key
const idempotencyKey = crypto
  .createHash('sha256')
  .update(
    JSON.stringify({
      userId: targetId,
      recipient: validated.recipient,
      packages: validated.packages,
      timestamp: Math.floor(Date.now() / 5000),
    })
  )
  .digest('hex');

// Acquire lock PRIMA di debit
const { data: lockResult } = await supabaseAdmin.rpc('acquire_idempotency_lock', {
  p_idempotency_key: idempotencyKey,
  p_user_id: targetId,
  p_ttl_minutes: 30,
});
```

**Tabella:** `idempotency_locks` (migration `044_idempotency_locks.sql`)

**Stati Lock:**

- `in_progress` - Operazione in corso
- `completed` - Spedizione creata (idempotent replay)
- `failed` - Errore dopo debit (non ri-debitare)

---

#### ✅ 3. Audit Trail

**Nessun saldo cambia senza una riga corrispondente in `wallet_transactions`.**

```typescript
// 1. Debit atomico
await supabaseAdmin.rpc('decrement_wallet_balance', {...})

// 2. INSERT ledger (audit trail)
await supabaseAdmin.from('wallet_transactions').insert({
  user_id: targetId,
  amount: -finalCost,
  type: 'SHIPMENT_CHARGE',
  description: `Spedizione ${trackingNumber}`
})
```

**Tabella:** `wallet_transactions` (immutabile, append-only)

**Invariante:** `SUM(wallet_transactions.amount) = users.wallet_balance` (per ogni utente)

---

#### ✅ 4. Prepagato Puro

**Nessun "Pay as you go" con carta per singola etichetta B2B.**

**Flusso Obbligatorio:**

1. Cliente ricarica wallet (bonifico o carta)
2. Admin approva ricarica (se bonifico)
3. Cliente crea spedizione (debit da wallet)

**NON è permesso:**

- Pagamento diretto carta per singola spedizione B2B
- "Credito automatico" senza approvazione

---

## 🔌 4. Architettura Tecnica (Plug & Play)

Il sistema è **agnostico rispetto al fornitore logistico**.

### Pattern "Courier Adapter"

Il `FulfillmentEngine` non deve sapere se sta chiamando Spedisci.online, Poste o GLS. Usa un'interfaccia standard:

```typescript
interface CourierAdapter {
  createShipping(
    payload: ShipmentPayload,
    credentials: CourierCredentials
  ): Promise<ShipmentResult>;
  deleteShipping(shipmentId: string): Promise<void>;
  trackShipment(trackingNumber: string): Promise<TrackingResult>;
}
```

**Implementazioni:**

- `SpedisciOnlineAdapter` - Adapter per Spedisci.online
- `PosteAdapter` - Adapter per Poste Italiane (se implementato)
- `GLSAdapter` - Adapter per GLS (se implementato)

**Routing Intelligente:**
Il motore decide quale Adapter usare e quali credenziali iniettare (Master vs Utente) in base alla configurazione `courier_configs`.

**File:** `lib/services/couriers/courier-factory.ts`

---

### Stack Tecnologico

#### Backend

- **Next.js 14** - App Router con Server Actions
- **TypeScript** - Strict type checking
- **Supabase** - PostgreSQL con RLS (Row Level Security) stretta

#### Frontend

- **React 18** - Server Components + Client Components
- **Tailwind CSS + Shadcn/UI** - Component library
- **Framer Motion** - Animazioni

#### Database

- **PostgreSQL 15+** (via Supabase)
- **Row Level Security (RLS)** - Isolamento multi-tenant
- **Functions SQL** - Operazioni atomiche (SECURITY DEFINER)

#### AI Agent Orchestrator ("Anne")

**Anne NON è un chatbot generico.**

Anne è un **AI Agent Orchestrator** basato su **LangGraph Supervisor** che coordina worker specializzati per gestire richieste di preventivi e prenotazioni spedizioni.

**Architettura:**

- **Supervisor Router** (`lib/agent/orchestrator/supervisor-router.ts`) - Entry point unico per `/api/ai/agent-chat`
- **Supervisor** (`lib/agent/orchestrator/supervisor.ts`) - Single Decision Point per routing (`decideNextStep()`)
- **LangGraph Pricing Graph** (`lib/agent/orchestrator/pricing-graph.ts`) - Orchestrazione workflow con conditional edges

**Data Flow:**

```
User Input (messaggio)
    │
    ▼
supervisorRouter()  ← Entry point UNICO
    │
    ├─── Intent Detection (pricing vs non-pricing)
    ├─── OCR Pattern Detection
    ├─── Booking Confirmation Detection
    │
    ▼
supervisor.decideNextStep()  ← SINGLE DECISION POINT (funzione pura)
    │
    ├─── next_step: 'ocr_worker' → OCR Worker → arricchisce shipmentDraft
    ├─── next_step: 'address_worker' → Address Worker → normalizza indirizzi
    ├─── next_step: 'pricing_worker' → Pricing Worker → calcola preventivi
    ├─── next_step: 'booking_worker' → Booking Worker → prenota spedizione
    ├─── next_step: 'legacy' → Claude Legacy Handler
    └─── next_step: 'END' → Risposta finale al client
    │
    ▼ (torna a supervisor dopo ogni worker)
supervisor.decideNextStep()  ← Valuta nuovo stato, decide prossimo step
    │
    └─── ... (loop fino a END o MAX_ITERATIONS)
```

**Pattern Chiave:** L'input utente passa dal Supervisor, viene arricchito dai Worker (merge non distruttivo in `shipmentDraft`), e **solo alla fine** diventa un'azione DB (booking) o risposta al client.

**Worker Attivi:**

1. **Address Worker** (`lib/agent/workers/address.ts`) - Normalizzazione indirizzi italiani (CAP, provincia, città)
2. **Pricing Worker** (`lib/agent/workers/pricing.ts`) - Calcolo preventivi multi-corriere
3. **OCR Worker** (`lib/agent/workers/ocr.ts`) - Estrazione dati da testo/screenshot (immagini: placeholder)
4. **Booking Worker** (`lib/agent/workers/booking.ts`) - Prenotazione spedizioni (preflight + adapter)

**Safety Invariants (CRITICO):**

- **No Silent Booking:** Nessuna prenotazione senza conferma esplicita utente (`containsBookingConfirmation()`)
- **Pre-flight Checks:** Validazione obbligatoria prima di chiamate API esterne (`preflightCheck()`)
- **Single Decision Point:** Solo `supervisor.ts` imposta `next_step`, worker non decidono routing autonomamente
- **No PII nei Log:** Mai loggare `addressLine1`, `postalCode`, `fullName`, `phone` (solo `trace_id`, `user_id_hash`)

**Documentazione:**

- `MIGRATION_MEMORY.md` - Stato migrazione e architettura dettagliata (Single Source of Truth)
- `docs/ARCHITECTURE.md` - Deep dive tecnico con diagrammi e verifiche
- `lib/agent/orchestrator/` - Implementazione orchestrator

---

## 🚫 5. Anti-Pattern (COSA NON FARE)

### ❌ NON creare logica di prezzo hardcoded nel frontend

```typescript
// ❌ VIETATO
const price = 8.5; // Hardcoded nel frontend

// ✅ CORRETTO
const { data: price } = await fetch('/api/shipments/estimate', {
  method: 'POST',
  body: JSON.stringify(shipmentData),
});
```

**Il prezzo viene sempre dal Backend/API.**

---

### ❌ NON bypassare il Wallet per "fare prima"

```typescript
// ❌ VIETATO
if (walletError) {
  // "Facciamo finta che sia andato bene"
  await supabaseAdmin.from('users').update({ wallet_balance: ... })
}

// ✅ CORRETTO
if (walletError) {
  throw new Error(`Wallet debit failed: ${walletError.message}`)
}
```

**Se il wallet è giù, si ferma tutto.**

---

### ❌ NON mischiare la logica B2C con quella B2B

```typescript
// ❌ VIETATO
if (user.isB2C) {
  // Logica B2C inline
} else {
  // Logica B2B inline
}

// ✅ CORRETTO
// B2C è trattato come "cliente speciale" del sistema B2B
// Usa stesso flusso, ma con wallet "Web Channel"
```

**Il B2C è solo un "cliente speciale" del sistema B2B.**

---

## 🛠️ 6. Developer Guide

### Prerequisiti

- **Node.js 18+** e npm
- **Supabase account** (cloud o local)
- **Git** per clonazione repository

### Setup Locale

#### Opzione 1: Supabase Cloud (Consigliato)

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

#### Opzione 2: Supabase Local (Avanzato)

```bash
# 1-2. Stesso di sopra

# 3. Avvia Supabase localmente (richiede Docker)
npx supabase start

# 4. Configura .env.local con URL locali
# (Forniti dal comando supabase start)

# 5-6. Stesso di sopra
```

---

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

# Opzionali (per funzionalità complete)
GOOGLE_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_google_oauth_id
GOOGLE_CLIENT_SECRET=your_google_oauth_secret
```

Vedi [`.env.example`](.env.example) per lista completa.

---

### Comandi Utili

```bash
# Sviluppo
npm run dev                 # Avvia server di sviluppo

# Verifica
npm run setup:check         # Verifica setup completo
npm run check:env:simple    # Verifica variabili ambiente
npm run type-check          # Validazione TypeScript
npm run lint                # Validazione ESLint

# Database (se usi Supabase local)
npx supabase start          # Avvia Supabase locale
npx supabase stop           # Ferma Supabase locale
npx supabase status         # Verifica stato Supabase
npx supabase db reset       # Reset e applica migrations

# Testing
npm run test:e2e            # Esegui test Playwright E2E
```

---

## 📚 Documentazione Essenziale

### Documenti Core (Leggere PRIMA di sviluppare)

**⭐ Documentazione Enterprise-Grade Completa:**

- **[docs/REVISIONE_FINALE_ENTERPRISE.md](docs/REVISIONE_FINALE_ENTERPRISE.md)** - ⭐ **DOCUMENTAZIONE ENTERPRISE COMPLETA** - Vision, Business Architecture, Financial Core, Technical Stack, AI Orchestrator, Security, Developer Guide, Roadmap, Quick Reference

**Per Visione Business:**

- **[docs/VISION_BUSINESS.md](docs/VISION_BUSINESS.md)** - Visione business completa, modelli di ricavo, target, strategia

**Per Architettura Tecnica:**

- **[docs/SECURITY.md](docs/SECURITY.md)** - Architettura multi-tenant, Acting Context, RLS policies
- **[docs/MONEY_FLOWS.md](docs/MONEY_FLOWS.md)** - Sistema wallet, anti-fraud, idempotency
- **[docs/OPS_RUNBOOK.md](docs/OPS_RUNBOOK.md)** - Deployment, incident response, monitoring
- **[docs/DB_SCHEMA.md](docs/DB_SCHEMA.md)** - Tabelle database, RLS policies, invarianti
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Deep dive tecnico, patterns, performance
- **[docs/SPEDIZIONI_CANCELLATE.md](docs/SPEDIZIONI_CANCELLATE.md)** - Sistema soft delete con audit trail e cancellazione simultanea
- **[MIGRATION_MEMORY.md](MIGRATION_MEMORY.md)** - ⭐ Architettura AI Orchestrator (LangGraph Supervisor, Workers, OCR) - Single Source of Truth per migrazione Anne → LangGraph

### Documenti Operativi

- **[docs/MIGRATIONS.md](docs/MIGRATIONS.md)** - Storia migrations (49+ migrations), procedure rollback
- **[WALLET_SECURITY_GUARDRAILS.md](WALLET_SECURITY_GUARDRAILS.md)** - Regole critiche wallet (NON BYPASSABILE)
- **[AUDIT_GO_NOGO_PIVOT.md](AUDIT_GO_NOGO_PIVOT.md)** - Audit strategico GO/NO-GO/PIVOT

**Deploy e Pre-Launch:**

- **[DEPLOY_READINESS_CHECKLIST.md](DEPLOY_READINESS_CHECKLIST.md)** - Checklist pratica per deploy production
- **[PRE_LAUNCH_CHECKLIST_CORRETTA.md](PRE_LAUNCH_CHECKLIST_CORRETTA.md)** - Checklist pre-launch corretta e allineata al codebase
- **[VERIFICA_CHECKLIST_PRE_LAUNCH.md](VERIFICA_CHECKLIST_PRE_LAUNCH.md)** - Report completo verifica checklist pre-launch
- **[ANALISI_SICUREZZA_FIX_REGRESSIONI.md](ANALISI_SICUREZZA_FIX_REGRESSIONI.md)** - Analisi sicurezza fix - verifica regressioni
- **[RIEPILOGO_CORREZIONI_DEPLOY.md](RIEPILOGO_CORREZIONI_DEPLOY.md)** - Riepilogo correzioni e preparazione deploy

### Documenti AI/Validazione

- **[WALLET_AUDIT_REPORT.md](WALLET_AUDIT_REPORT.md)** - Audit wallet completo (P0 fixes applicati)
- **[WALLET_AI_VALIDATION_PROMPT.md](WALLET_AI_VALIDATION_PROMPT.md)** - Prompt per validazione AI esterna

---

## 🗺️ Roadmap

### ✅ FASE 1-2.8 — Architettura & Migrazione (COMPLETATA)

**Status:** ✅ Tutte le fasi completate e validate

- **FASE 1:** Pricing graph, Supervisor Router, Intent Detector, Rate limiting distribuito
- **FASE 2.1-2.2:** Supervisor Router hardening, Telemetria strutturata, Guardrail
- **FASE 2.3:** Address Worker (normalizzazione indirizzi italiani)
- **FASE 2.4:** OCR Worker (estrazione dati da testo)
- **FASE 2.5:** OCR Immagini (Gemini Vision con retry + fallback)
- **FASE 2.6:** Booking Worker (prenotazione spedizioni)
- **FASE 2.7:** Dynamic Platform Fees (fee configurabili per utente)
- **FASE 2.8:** SuperAdmin UI (gestione platform fees)

**Deliverable:**

- Test unit: 264 test passati
- Test integration: 90 test passati
- Test E2E: Suite completa Playwright attiva
- OCR Vision: 10 immagini processate nel test, 90% confidence, 0% clarification rate

**Vedi:** [MIGRATION_MEMORY.md](MIGRATION_MEMORY.md) per dettagli completi

---

### 🚀 FASE 3 — Rollout & Economics (IN CORSO)

**Status:** 🟡 Pianificazione e setup

**Obiettivo:** Validare esposizione reale, sostenibilità economica e readiness GTM senza modifiche architetturali.

**Fasi:**

- **FASE 3.1:** Controlled Rollout (Cohort 0 → 1 → 2)
- **FASE 3.2:** Economics Observation (costi reali, alert threshold, kill switch)
- **FASE 3.3:** GTM Readiness Gates (Prodotto, Economics, Operativo)

**Feature Recenti (31 Dicembre 2025):**

- ✅ **Sistema Spedizioni Cancellate**:
  - Soft delete con audit trail completo (`deleted_by_user_id`, `deleted_by_user_email`, `deleted_by_user_name`)
  - Cancellazione simultanea su Spedisci.Online (priorità configurazione: reseller → owner → default)
  - Visibilità reseller per sub-user (RBAC completo)
  - Pagina dedicata `/dashboard/spedizioni/cancellate` con ricerca e filtri
  - Migration: `050_add_deleted_by_user_email.sql`
  - Vedi [docs/SPEDIZIONI_CANCELLATE.md](docs/SPEDIZIONI_CANCELLATE.md) per documentazione completa

**Vedi:** [PHASE_3_ROLLOUT_PLAN.md](PHASE_3_ROLLOUT_PLAN.md) per roadmap dettagliata

---

### 🔮 FASE 4 — Scaling & Optimization (FUTURE)

**Status:** 📋 Pianificazione futura

**Obiettivi potenziali:**

- Pricing optimization basato su dati reali
- Automation avanzata (scheduling, batch processing)
- Partnership e integrazioni
- Scaling infrastruttura

**Nota:** FASE 4 sarà definita dopo validazione FASE 3.

---

## 🧪 Testing & Validazione

### Wallet & Label Invariants (Governance)

**⚠️ INVARIANTE: “No Credit, No Label” (bidirezionale).**  
Questo flusso è considerato **chiuso** (bugfix completato) e protetto da test automatici.

- **No Credit, No Label**: nessuna label/spedizione deve essere generata senza credito disponibile.
- **No Label, No Credit**: se la label non viene creata o la spedizione non viene salvata a DB, il credito **non deve restare scalato** (refund/compensation).
- **Regola di governance**: qualsiasi modifica al flusso wallet/spedizioni/corriere deve mantenere verdi gli smoke test wallet.

Esegui sempre:

```bash
npm run smoke:wallet
```

Nota CI: esiste un job `wallet-smoke` (attualmente **non bloccante**) che diventerà blocking dopo un periodo di stabilizzazione.

### Wallet Security Tests

```bash
# Test validazione fix wallet P0
node scripts/test-wallet-fix-validation.js
```

**Output Atteso:**

- ✅ deduct_wallet_credit atomica
- ✅ wallet_transactions senza status
- ✅ No race condition
- ✅ Funzioni wallet configurate

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

---

## 🚢 Deployment

### Vercel (Consigliato)

1. Push code su GitHub
2. Importa progetto in Vercel dashboard
3. Configura environment variables
4. Deploy automatico su ogni push a `master`

**Vedi [docs/OPS_RUNBOOK.md](docs/OPS_RUNBOOK.md) per checklist deployment completa.**

---

## 🔐 Security

### Principi di Sicurezza

- **Multi-Tenant Isolation:** Row Level Security (RLS) su tutte le tabelle tenant
- **Audit Logging:** Tutte le operazioni sensibili loggate con actor/target tracking
- **Impersonation:** SuperAdmin può agire per conto utenti (completamente auditato)
- **Encryption:** Credenziali corrieri criptate at rest
- **GDPR:** Export dati e anonimizzazione supportati

**Vedi [docs/SECURITY.md](docs/SECURITY.md) per dettagli architettura sicurezza.**

---

## 🤝 Contributing

Leggi [CONTRIBUTING.md](CONTRIBUTING.md) per:

- Checklist code review
- Requisiti security gate
- Best practices migrations
- Regole ESLint (no uso diretto `auth()`)

---

## 📞 Support

- **Documentazione:** Vedi cartella `docs/` per guide complete
- **Issues:** [GitHub Issues](https://github.com/gdsgroupsas-jpg/spediresicuro/issues)
- **Security:** Segnala vulnerabilità via GitHub Security Advisories

---

## 📋 Quick Reference

### File Critici da Conoscere

#### API Routes

- `app/api/spedizioni/route.ts` - Gestione spedizioni (creazione, cancellazione simultanea, lista)
- `app/api/spedizioni/cancellate/route.ts` - Recupero spedizioni cancellate (RBAC, paginazione)
- `app/api/spedizioni/[id]/ldv/route.ts` - Download LDV (etichetta originale o fallback)
- `app/api/shipments/create/route.ts` - Creazione spedizione (wallet debit + idempotency)

#### Database Migrations

- `supabase/migrations/040_wallet_atomic_operations.sql` - Funzioni atomiche wallet
- `supabase/migrations/044_idempotency_locks.sql` - Sistema idempotency
- `supabase/migrations/050_add_deleted_by_user_email.sql` - Soft delete con audit trail (31 Dicembre 2025)

#### Core Libraries

- `lib/wallet/retry.ts` - Smart retry per lock contention
- `lib/services/fulfillment/orchestrator.ts` - Fulfillment Orchestrator (routing intelligente)
- `lib/agent/orchestrator/supervisor-router.ts` - AI Orchestrator entry point

#### Documentazione

- `WALLET_SECURITY_GUARDRAILS.md` - Regole critiche wallet (NON BYPASSABILE)
- `docs/SPEDIZIONI_CANCELLATE.md` - Documentazione completa sistema soft delete
- `MIGRATION_MEMORY.md` - Architettura AI Orchestrator (Single Source of Truth)

### Funzioni SQL Atomiche

- `decrement_wallet_balance(user_id, amount)` - Debit atomico
- `increment_wallet_balance(user_id, amount)` - Credit atomico
- `add_wallet_credit(user_id, amount, description, created_by)` - Credit con audit trail
- `acquire_idempotency_lock(key, user_id, ttl)` - Lock idempotency
- `complete_idempotency_lock(key, shipment_id, status)` - Completa lock

---

**⚠️ RICORDA: Questo è un Logistics OS, non un comparatore prezzi. Ogni modifica deve rispettare i principi architetturali definiti in questo documento.**

---

---

## ⚠️ DISCLAIMER

**Questo progetto è in fase di sviluppo attivo.**

- ✅ **Security P0 fixes applicati** (wallet race conditions risolte)
- ✅ **Core features implementate** (shipment creation, wallet, idempotency, soft delete, AI orchestrator)
- 🟡 **Core features in testing** (validazione GTM in corso)
- 🟡 **Onboarding in miglioramento** (semplificazione in corso)
- ❌ **NON production ready** - Obiettivo: production readiness nei prossimi mesi

**Feature Recenti (2 Gennaio 2026):**

- ✅ **FIX CRITICO**: Salvataggio `shipment_id_external` ora funziona per TUTTI i corrieri (incluso Poste Italiane)
- ✅ Cancellazione spedizioni su Spedisci.Online ora funziona correttamente
- ✅ Metodo `getIncrementIdByTracking()` per recupero increment_id da tracking

**Feature (31 Dicembre 2025):**

- ✅ Sistema Spedizioni Cancellate con audit trail completo
- ✅ Cancellazione simultanea su Spedisci.Online
- ✅ RBAC completo per visibilità reseller
- ✅ Fix nome file PDF: ora usa solo tracking number

**Non utilizzare in produzione senza test completi e validazione business.**

---

_Last updated: January 2, 2026_  
_Architecture Version: 0.3.1 (Logistics OS)_  
_Status: 🟡 In Development / Testing_  
_Next Major: 1.0.0 (Go To Market Release)_

---

## 📖 Per le AI: Quick Reference

**Se sei un'AI che analizza questo codebase, leggi PRIMA:**

1. **Sezione "GUIDA PER LE AI"** (sopra) - Visione business in breve
2. **[docs/VISION_BUSINESS.md](docs/VISION_BUSINESS.md)** - Visione business completa
3. **[MIGRATION_MEMORY.md](MIGRATION_MEMORY.md)** - Stato sviluppo tecnico attuale
4. **[README.md](README.md)** (questo file) - Costituzione completa

**Punti chiave da ricordare:**

- ✅ 3 modelli operativi FORMALI (Broker, BYOC, B2C) - Non sono "idee", sono pilastri
- ✅ Modello ricavo B2C: Spread (come Broker), non "quasi assente"
- ✅ BYOC è business model separato con implementazione completa
- ✅ Roadmap pragmatica: Feature "visionarie" in FASE 4 (futuro)
- ✅ Financial Core: "No Credit, No Label" - Wallet atomizzato

---

## 📝 Changelog Recente

### 🔧 Fix Critici Produzione (9 Gennaio 2026 - PR #41)

1. **Servizi Accessori - ID Numerici**:
   - ✅ Scoperto formato corretto: array numeri `[200001]` invece di stringhe
   - ✅ Mappatura automatica nome servizio → ID numerico (Exchange=200001, Document Return=200002, etc.)
   - ✅ Retry intelligente con fallback a stringhe numeriche se necessario
   - **File**: `lib/adapters/couriers/spedisci-online.ts`

2. **Validazione Corriere Obbligatorio**:
   - ✅ Pulsante "Genera Spedizione" disabilitato senza selezione corriere
   - ✅ Validazione esplicita in `handleSubmit` con avviso visivo
   - ✅ Prevenzione creazione spedizioni per errore
   - **File**: `app/dashboard/spedizioni/nuova/page.tsx`

3. **Multi-Configurazione Spedisci.Online**:
   - ✅ Rimosso deduplicazione errata che filtrava config valide
   - ✅ Ora carica tutte le configurazioni attive correttamente
   - ✅ Logging dettagliato per debug multi-account
   - **File**: `app/api/quotes/realtime/route.ts`, `lib/actions/spedisci-online.ts`

4. **Cleanup Automatico Test Script**:
   - ✅ Script test cancella automaticamente tutte le spedizioni create
   - ✅ Cleanup anche in caso di CTRL+C o errore fatale
   - ✅ Flag `--dry-run` per testare senza creare spedizioni
   - **File**: `scripts/test-accessori-services-completo.ts`

**Vedi [docs/REVISIONE_FINALE_ENTERPRISE.md](docs/REVISIONE_FINALE_ENTERPRISE.md) per dettagli completi PR #40 e #41.**

### 🐛 Fix Critici (2 Gennaio 2026)

1. **FIX CRITICO: Cancellazione Spedisci.Online per Poste Italiane**:
   - ✅ **BUG RISOLTO**: Il salvataggio di `shipment_id_external` era dentro un blocco `else` e NON veniva eseguito per "Poste Italiane"
   - ✅ Spostato salvataggio `shipment_id_external` FUORI dal blocco condizionale corriere
   - ✅ Ora `shipment_id_external` viene salvato per TUTTI i corrieri (Poste Italiane, GLS, BRT, UPS, ecc.)
   - ✅ Cancellazione su Spedisci.Online ora funziona correttamente
   - **File**: `app/api/spedizioni/route.ts`

2. **Miglioramenti Logging e Debugging**:
   - ✅ Aggiunto metodo `getIncrementIdByTracking()` in SpedisciOnlineAdapter
   - ✅ Log dettagliati per `shipment_id_external` durante UPDATE spedizione
   - ✅ Migliorata gestione errori 404 durante cancellazione
   - **File**: `lib/adapters/couriers/spedisci-online.ts`

### 🐛 Fix Critici (31 Dicembre 2025)

1. **Fix Cancellazione Spedisci.Online**:
   - ✅ Salvataggio `shipmentId` (increment_id) durante creazione spedizione
   - ✅ Estrazione corretta `increment_id` dal tracking (numero finale invece di `parseInt()`)
   - ✅ Priorità: `shipment_id_external` > estrazione da tracking
   - **File**: `lib/adapters/couriers/spedisci-online.ts`, `lib/engine/fulfillment-orchestrator.ts`, `app/api/spedizioni/route.ts`

2. **Fix Nome File PDF**:
   - ✅ Nome file ora usa solo tracking number (es: `3UW1LZ1549886.pdf`)
   - ✅ Rimosso prefisso `LDV_` e suffisso data
   - **File**: `app/dashboard/spedizioni/nuova/page.tsx`, `app/api/spedizioni/[id]/ldv/route.ts`, `lib/adapters/export/index.ts`

### ✨ Feature Implementate

1. **Sistema Spedizioni Cancellate**:
   - ✅ Soft delete con audit trail completo
   - ✅ Cancellazione simultanea su Spedisci.Online
   - ✅ RBAC per visibilità reseller
   - ✅ Pagina dedicata `/dashboard/spedizioni/cancellate`
   - **File**: `app/api/spedizioni/cancellate/route.ts`, `app/dashboard/spedizioni/cancellate/page.tsx`, `supabase/migrations/050_add_deleted_by_user_email.sql`

### 🔍 Miglioramenti Debugging

- ✅ Log dettagliati per tracciare `shipmentId` durante creazione
- ✅ Log dettagliati per tracciare estrazione `increment_id` durante cancellazione
- ✅ Log migliorati per download LDV (verifica `label_data` disponibilità)
