# 📦 SpedireSicuro.it - Logistics Operating System

> **Version:** 3.0.0 (Logistics OS Architecture)  
> **Last Updated:** December 23, 2025  
> **Status:** 🟡 In Development / Testing | 🔒 Security P0 Cleared

---

<div align="center">

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![Security](https://img.shields.io/badge/security-P0%20cleared-success)
![Stack](https://img.shields.io/badge/stack-Next.js%2014%20%2B%20Supabase-blue)

</div>

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

## 🎯 1. Visione & Identità

### What SpedireSicuro IS

**SpedireSicuro NON è un semplice comparatore di prezzi.**

**SpedireSicuro è un Logistics OS (Sistema Operativo Logistico):** Un'infrastruttura B2B che orchestra spedizioni, pagamenti e corrieri.

### Value Proposition

Il valore non è solo "vendere la spedizione", ma fornire l'infrastruttura per gestirla.

- **Per il Cliente B2B:** Siamo il suo gestionale operativo.
- **Per il Canale B2C:** Siamo il "Reseller Web" invisibile che gestisce il fulfillment.

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

**Vantaggio:** Nessuna gestione account/wallet per utenti da 1 spedizione l'anno.

**Implementazione:**
- Utente B2C → Checkout → Pagamento → Wallet "Web Channel" → Etichetta
- Nessun wallet personale per utente B2C

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
  p_amount: cost
})

// ❌ VIETATO ASSOLUTAMENTE
await supabaseAdmin
  .from('users')
  .update({ wallet_balance: newBalance })
  .eq('id', userId)
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
  .update(JSON.stringify({
    userId: targetId,
    recipient: validated.recipient,
    packages: validated.packages,
    timestamp: Math.floor(Date.now() / 5000)
  }))
  .digest('hex')

// Acquire lock PRIMA di debit
const { data: lockResult } = await supabaseAdmin.rpc('acquire_idempotency_lock', {
  p_idempotency_key: idempotencyKey,
  p_user_id: targetId,
  p_ttl_minutes: 30
})
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
  createShipping(payload: ShipmentPayload, credentials: CourierCredentials): Promise<ShipmentResult>
  deleteShipping(shipmentId: string): Promise<void>
  trackShipment(trackingNumber: string): Promise<TrackingResult>
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

#### AI Agent ("Anne")
**Anne NON è un chatbot generico.**

Anne è un operatore che ha:
- **Accesso in lettura:** Log, diagnostica, audit trail
- **Accesso in scrittura:** Solo tramite "Draft/Approval" (admin deve approvare)

**Implementazione:**
- `lib/ai/anne.ts` - Logica Anne
- `docs/ANNE_IMPLEMENTATION.md` - Documentazione completa

---

## 🚫 5. Anti-Pattern (COSA NON FARE)

### ❌ NON creare logica di prezzo hardcoded nel frontend

```typescript
// ❌ VIETATO
const price = 8.50 // Hardcoded nel frontend

// ✅ CORRETTO
const { data: price } = await fetch('/api/shipments/estimate', {
  method: 'POST',
  body: JSON.stringify(shipmentData)
})
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

- **[docs/SECURITY.md](docs/SECURITY.md)** - Architettura multi-tenant, Acting Context, RLS policies
- **[docs/MONEY_FLOWS.md](docs/MONEY_FLOWS.md)** - Sistema wallet, anti-fraud, idempotency
- **[docs/OPS_RUNBOOK.md](docs/OPS_RUNBOOK.md)** - Deployment, incident response, monitoring
- **[docs/DB_SCHEMA.md](docs/DB_SCHEMA.md)** - Tabelle database, RLS policies, invarianti
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Deep dive tecnico, patterns, performance

### Documenti Operativi

- **[docs/MIGRATIONS.md](docs/MIGRATIONS.md)** - Storia migrations (49+ migrations), procedure rollback
- **[WALLET_SECURITY_GUARDRAILS.md](WALLET_SECURITY_GUARDRAILS.md)** - Regole critiche wallet (NON BYPASSABILE)
- **[AUDIT_GO_NOGO_PIVOT.md](AUDIT_GO_NOGO_PIVOT.md)** - Audit strategico GO/NO-GO/PIVOT

### Documenti AI/Validazione

- **[WALLET_AUDIT_REPORT.md](WALLET_AUDIT_REPORT.md)** - Audit wallet completo (P0 fixes applicati)
- **[WALLET_AI_VALIDATION_PROMPT.md](WALLET_AI_VALIDATION_PROMPT.md)** - Prompt per validazione AI esterna

---

## 🧪 Testing & Validazione

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

- `app/api/shipments/create/route.ts` - Creazione spedizione (wallet debit + idempotency)
- `supabase/migrations/040_wallet_atomic_operations.sql` - Funzioni atomiche wallet
- `supabase/migrations/044_idempotency_locks.sql` - Sistema idempotency
- `lib/wallet/retry.ts` - Smart retry per lock contention
- `WALLET_SECURITY_GUARDRAILS.md` - Regole critiche wallet

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
- 🟡 **Core features in testing** (shipment creation, wallet, idempotency)
- 🟡 **Onboarding in miglioramento** (semplificazione in corso)
- ❌ **NON production ready** - Obiettivo: production readiness nei prossimi mesi

**Non utilizzare in produzione senza test completi e validazione business.**

---

_Last updated: December 23, 2025_  
_Architecture Version: 3.0.0 (Logistics OS)_  
_Status: 🟡 In Development / Testing_
