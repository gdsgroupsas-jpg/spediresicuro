# 🚀 SpedireSicuro.it - Sistema Operativo Logistico AI-First

> **Versione:** 2.2.0 (Complete Documentation Update)  
> **Data Aggiornamento:** Dicembre 2025  
> **Stato:** 🟢 Produzione / 🟡 Beta (Moduli AI)  
> **Repo:** gdsgroupsas-jpg/spediresicuro  
> **Branch:** master

---

## 📚 GUIDA PER AI AGENT - DOCUMENTAZIONE COMPLETA

**👉 PER ANALIZZARE QUESTO PROGETTO, LEGGI PRIMA:**

1. **[`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md)** - Documentazione tecnica completa (architettura, stack, moduli, database, flussi, sicurezza)
2. **[`docs/README.md`](./docs/README.md)** - Indice completo di tutta la documentazione disponibile
3. **[`docs/AUTOMATION_AGENT_COMPLETA.md`](./docs/AUTOMATION_AGENT_COMPLETA.md)** - Documentazione completa Automation Service

**📋 QUESTO README È UN RIEPILOGO RAPIDO. Per dettagli tecnici completi, consulta i documenti sopra.**

---

## 🎯 LA VISIONE

**SpedireSicuro non è un semplice gestionale.** È un **Sistema Operativo Logistico** guidato dall'Intelligenza Artificiale.

**Obiettivo**: Azzerare la frizione tra intenzione ("Devo spedire questo") e azione (Etichetta stampata e corriere prenotato).

### I Pilastri del Manifesto

1. **AI-First, non AI-Added**: L'AI è il cuore (LangGraph + Gemini 2.0)
2. **Automazione Radicale**: Screenshot, PDF, email processati automaticamente
3. **Doctor Service (Self-Healing)**: Sistema che si monitora e auto-ripara
4. **Ecosistema Finanziario**: Wallet, pagamenti, fatturazione integrata

---

## 🏗️ STACK TECNOLOGICO

### Core Stack
- **Frontend**: Next.js 14 (App Router), React Server Components, TypeScript
- **Styling**: Tailwind CSS, Shadcn/UI, Framer Motion
- **Backend**: Next.js API Routes, Supabase (PostgreSQL)
- **Auth**: NextAuth.js v5 (Role-Based Access Control)

### AI & Automation Stack
- **LLM**: Google Gemini 2.0 Flash (Multimodale: Testo + Vision)
- **Agent Framework**: LangGraph (Orchestrazione a stati)
- **Browser Automation**: Puppeteer (servizio Express standalone su Railway)
- **OCR**: Ibrida (Tesseract.js + Gemini Vision)

### Infrastructure
- **Database**: Supabase (PostgreSQL con pgvector)
- **Hosting**: Vercel (Frontend), Railway (Automation Service)
- **Payments**: Banca Intesa XPay, Bonifici Smart (AI parsing)

**📖 Dettagli completi**: Vedi [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "SKILLSET & STACK TECNOLOGICO"

---

## 📦 MODULI E FUNZIONALITÀ

### 🧠 AI "Anne" - Assistente Virtuale
_Status: 🟡 Beta Avanzata_

- Chat interface sempre presente in dashboard
- Input multimodale (foto, screenshot WhatsApp)
- Workflow LangGraph: Ingestione → Estrazione → Validazione → Booking

**File Chiave**:
- `components/anne/` - Componenti UI
- `app/api/anne/` - API endpoints

**📖 Dettagli**: Vedi [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "3.1 Il Cervello: AI 'Anne'"

---

### 💼 CRM: Sistema Leads
_Status: 🟢 Produzione_

- Workflow stati: New → Contacted → Qualified → Negotiation → Won/Lost
- Assegnazione lead a contatto commerciale
- Conversione lead "Won" in utente attivo

**File Chiave**:
- `app/dashboard/admin/leads/page.tsx` - Dashboard admin
- `app/actions/leads.ts` - Server Actions
- `supabase/migrations/026_add_leads_system.sql` - Migration database

**📖 Dettagli**: Vedi [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "3.2 CRM: Sistema Leads"

---

### 💳 Finanza & Wallet
_Status: 🟢 Produzione (Sistema Sicuro Enterprise-Grade)_

#### Componenti Principali

**Ricarica Wallet**:
- XPay: Integrazione gateway Intesa Sanpaolo
- Smart Top-Up (Bonifico): Upload PDF/FOTO, AI Verification (Gemini Vision), validazioni server-side

**Sicurezza Wallet (CRITICAL)**:
- ❌ **VIETATO** aggiornare `users.wallet_balance` direttamente
- ✅ **UNICO MODO**: RPC `add_wallet_credit()` / `deduct_wallet_credit()` o INSERT su `wallet_transactions`
- ❌ **Nessun fallback manuale**: Se RPC fallisce → errore e stop

**File Chiave**:
- `app/dashboard/wallet/page.tsx` - Wallet utente
- `app/dashboard/admin/bonifici/page.tsx` - Gestione richieste top-up (admin)
- `app/actions/wallet.ts` - Modifica wallet (approve/reject/delete)
- `app/actions/topups-admin.ts` - Lettura richieste (getTopUpRequestsAdmin)

**⚠️ IMPORTANTE**: NON duplicare funzioni tra `wallet.ts` e `topups-admin.ts` (causa errori build Vercel)

**Migrations** (ordine obbligatorio):
1. `027_wallet_topups.sql` - Tabelle base
2. `028_wallet_security_fixes.sql` - Sicurezza
3. `029_add_topup_update_policy.sql` - Policy UPDATE
4. `030_add_topup_approve_function.sql` - Funzione SQL fallback

**📖 Dettagli Completi**:
- [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "3.3 Finanza & Wallet"
- [`INVENTARIO_SISTEMA_FINANZIARIO.md`](./INVENTARIO_SISTEMA_FINANZIARIO.md) - Inventario completo tabelle/endpoint finance
- [`FIX_WALLET_SECURITY_RIEPILOGO.md`](./FIX_WALLET_SECURITY_RIEPILOGO.md) - Implementazione sicurezza wallet
- [`TOPUPS_ADMIN_FALLBACK_AUTH.md`](./TOPUPS_ADMIN_FALLBACK_AUTH.md) - Fallback auth per top-ups admin

---

### 📄 Sistema Fatturazione
_Status: 🟢 Produzione_

- Generazione fatture automatica
- Gestione stato (draft, issued, paid, overdue, cancelled, refunded)
- Integrazione con SDI (Sistema di Interscambio)
- PDF generation automatica

**File Chiave**:
- `app/dashboard/fatture/page.tsx` - Fatture utente
- `app/dashboard/admin/invoices/page.tsx` - Gestione fatture admin
- `app/actions/invoices.ts` - Server Actions
- `supabase/migrations/025_add_invoices_system.sql` - Migration database

**📖 Dettagli**: Vedi [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "3.3.4 Sistema Fatturazione"

---

### 🚚 Spedizioni & Corrieri
_Status: 🟢 Produzione (Core)_

- Multi-Corriere: Spedisci.Online, GLS, BRT, Poste Italiane
- Comparatore Prezzi: Listini dinamici basati su ruolo
- Tracking: Monitoraggio spedizioni in tempo reale
- Resi: Gestione resi e scanner resi
- Contrassegni: Gestione contrassegni

**File Chiave**:
- `app/dashboard/spedizioni/` - Gestione spedizioni
- `actions/logistics.ts` - Server Actions logistica
- `actions/returns.ts` - Server Actions resi
- `actions/contrassegni.ts` - Server Actions contrassegni

**📖 Dettagli**: Vedi [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "3.4 Spedizioni & Corrieri"

---

### 🤖 Automation Service
_Status: 🟢 Produzione_

Sistema di automazione per Spedisci.Online:
- Estrazione automatica session cookies
- Gestione login con 2FA (email IMAP o manuale)
- Sincronizzazione spedizioni dal portale
- Sistema lock anti-conflitto
- Crittografia password (AES-256-GCM)

**👉 DOCUMENTAZIONE COMPLETA**: **[`docs/AUTOMATION_AGENT_COMPLETA.md`](./docs/AUTOMATION_AGENT_COMPLETA.md)**

**File Chiave**:
- `automation-service/src/agent.ts` - Classe SOA (agent principale)
- `automation-service/src/index.ts` - Server Express con endpoint
- `lib/automation/spedisci-online-agent.ts` - Versione Next.js integrata
- `actions/automation.ts` - Server Actions per dashboard
- `app/dashboard/admin/automation/page.tsx` - Dashboard UI admin

**Guide Operative**:
- [`automation-service/README.md`](./automation-service/README.md) - Setup Railway e sviluppo locale
- [`docs/AUTOMATION_SPEDISCI_ONLINE.md`](./docs/AUTOMATION_SPEDISCI_ONLINE.md) - Guida operativa e troubleshooting
- [`automation-service/SICUREZZA.md`](./automation-service/SICUREZZA.md) - Sicurezza e best practices
- [`automation-service/DEPLOY-RAILWAY.md`](./automation-service/DEPLOY-RAILWAY.md) - Deploy su Railway

**📖 Dettagli**: Vedi [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "Automation Service"

---

### 🛡️ Doctor Service & Diagnostica
_Status: 🟢 Produzione_

- Self-monitoring: Tabella `diagnostics_events`
- Tracciamento errori, warning e performance
- Notifiche automatiche su errori critici
- AI Analysis per suggerire fix

**File Chiave**:
- `app/dashboard/admin/logs/page.tsx` - Dashboard logs
- `actions/logs.ts` - Server Actions logs
- `supabase/migrations/023_diagnostics_events.sql` - Migration database

**📖 Dettagli**: Vedi [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "3.5 Doctor Service & Diagnostica"

---

### 👥 Reseller System
_Status: 🟢 Produzione_

- Gerarchia: Superadmin → Reseller → User
- Reseller vedono solo i propri utenti
- Margini configurabili per reseller
- Wallet separato per reseller

**File Chiave**:
- `app/dashboard/super-admin/page.tsx` - Gestione superadmin
- `app/dashboard/reseller-team/page.tsx` - Gestione team reseller
- `actions/admin-reseller.ts` - Server Actions reseller
- `supabase/migrations/019_reseller_system_and_wallet.sql` - Migration database

**📖 Dettagli**: Vedi [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "3.4.1 Reseller System"

---

## 🗄️ ARCHITETTURA DATI

### Tabelle Principali

**Utenti e Autenticazione**:
- `users` - Profili utenti, wallet_balance (gestito da trigger)

**Spedizioni**:
- `shipments` - Spedizioni (campi JSONB per dettagli corrieri)

**CRM**:
- `leads` - CRM pre-acquisizione

**Wallet e Pagamenti**:
- `wallet_transactions` - Storico transazioni wallet (trigger aggiorna balance)
- `top_up_requests` - Richieste ricarica bonifico
- `payment_transactions` - Transazioni XPay

**Fatturazione**:
- `invoices` - Fatture emesse
- `invoice_items` - Righe fattura

**Audit e Diagnostica**:
- `audit_logs` - Audit completo operazioni
- `diagnostics_events` - Log diagnostici strutturati

**Corrieri e Configurazioni**:
- `courier_configs` - Configurazioni corrieri (con automation)
- `price_lists` - Listini prezzi
- `price_list_entries` - Voci listino

### Funzioni SQL Wallet

- `add_wallet_credit(p_user_id, p_amount, p_description, p_created_by)` - Accredita wallet (max €10.000)
- `deduct_wallet_credit(p_user_id, p_amount, p_description, p_created_by)` - Addebita wallet
- `approve_top_up_request(p_request_id, p_admin_user_id, p_approved_amount)` - Approva richiesta (bypassa RLS)

**⚠️ IMPORTANTE**: Le funzioni aggiornano `users.wallet_balance` tramite trigger. **NON modificare manualmente** il campo.

**📖 Dettagli Completi**:
- [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "4. ARCHITETTURA DATI"
- [`INVENTARIO_SISTEMA_FINANZIARIO.md`](./INVENTARIO_SISTEMA_FINANZIARIO.md) - Inventario completo tabelle/endpoint finance

---

## 🛠️ SETUP & SVILUPPO

### Prerequisiti

- Node.js 18+
- npm o yarn
- Account Supabase
- Account Vercel (per deploy)
- Account Railway (per automation service)

### Variabili d'Ambiente (.env.local)

```bash
# Core Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # CRITICAL: Bypassa RLS in server actions

# AI (Gemini)
GOOGLE_API_KEY=...  # Gemini 2.0 Flash Key

# Payments (XPay)
XPAY_BO_API_KEY=...  # Banca Intesa Backoffice
XPAY_TERMINAL_ID=...  # Terminale POS Virtuale

# Automation Service
AUTOMATION_SERVICE_URL=http://localhost:3000  # o URL Railway in produzione
ENCRYPTION_KEY=...  # 64 caratteri hex (condiviso con automation-service)
AUTOMATION_SERVICE_TOKEN=...  # Token autenticazione automation service
CRON_SECRET_TOKEN=...  # Token cron job

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...  # Genera con: openssl rand -base64 32
```

**📖 Dettagli**: Vedi [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "6. SETUP & SVILUPPO"

### Installazione

```bash
# Clona repository
git clone https://github.com/gdsgroupsas-jpg/spediresicuro.git
cd spediresicuro

# Installa dipendenze
npm install

# Configura variabili d'ambiente
cp .env.example .env.local
# Modifica .env.local con i tuoi valori

# Avvia sviluppo
npm run dev
```

### Comandi Utili

```bash
# Sviluppo
npm run dev              # Avvio Next.js in sviluppo
npm run build            # Build produzione
npm run start            # Avvio produzione

# Database
npx supabase status      # Verifica connessione DB
npx supabase migration up  # Applica migrazioni pendenti

# Testing
npm run test:e2e         # Test end-to-end (Playwright)
npm run test:e2e:ui      # Test con UI interattiva
npm run test:e2e:debug   # Test in modalità debug

# Verifica
npm run type-check       # Verifica TypeScript
npm run lint             # Lint codice
npm run check:env        # Verifica variabili ambiente
```

### Applicazione Migrazioni

**⚠️ ORDINE OBBLIGATORIO per Wallet/Top-Up:**

```bash
# 1. Prerequisito
npx supabase migration up 027_wallet_topups

# 2. Sicurezza
npx supabase migration up 028_wallet_security_fixes

# 3. Policy UPDATE
npx supabase migration up 029_add_topup_update_policy

# 4. Funzione SQL fallback
npx supabase migration up 030_add_topup_approve_function
```

**📖 Dettagli**: Vedi [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "4.2 Migrazioni Wallet/Top-Up"

---

## 📁 STRUTTURA PROGETTO

```
spediresicuro/
├── app/                    # Next.js App Router
│   ├── actions/           # Server Actions (wallet, invoices, leads, fiscal, topups-admin)
│   ├── api/               # API Routes
│   ├── dashboard/         # Pagine dashboard
│   │   ├── admin/        # Admin (bonifici, leads, invoices, automation, logs)
│   │   ├── spedizioni/    # Gestione spedizioni
│   │   ├── wallet/       # Wallet utente
│   │   ├── fatture/      # Fatture utente
│   │   └── ...
│   └── ...
├── actions/               # Server Actions legacy (automation, logistics, ecc.)
├── components/            # Componenti React
│   ├── anne/             # AI Assistant
│   ├── automation/       # Componenti automation
│   ├── wallet/           # Componenti wallet
│   └── ...
├── lib/                   # Librerie e utilities
│   ├── automation/       # Automation agent (Next.js)
│   ├── adapters/          # Adapter corrieri
│   ├── security/         # Crittografia
│   └── ...
├── automation-service/    # Servizio automation standalone (Railway)
│   ├── src/
│   │   ├── agent.ts      # Classe SOA
│   │   └── index.ts      # Server Express
│   └── ...
├── supabase/
│   └── migrations/       # Migrazioni database (001-030)
├── docs/                  # Documentazione
│   ├── README.md         # Indice documentazione
│   ├── AUTOMATION_AGENT_COMPLETA.md
│   └── ...
└── ...
```

**📖 Dettagli**: Vedi [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "7. STRUTTURA FILE E ORGANIZZAZIONE"

---

## 🔒 SICUREZZA E BEST PRACTICES

### Wallet Balance (CRITICAL)

**REGOLE NON NEGOZIABILI:**
1. ❌ **MAI** fare `UPDATE users SET wallet_balance = ...` da codice
2. ✅ **SOLO** RPC `add_wallet_credit()` / `deduct_wallet_credit()` o INSERT su `wallet_transactions`
3. ❌ **Nessun fallback manuale**: Se RPC fallisce → errore e stop

**📖 Dettagli**: Vedi [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "8.1 Wallet Balance (CRITICAL)"

### Struttura File (NO DUPLICATI)

- `app/actions/wallet.ts` → Funzioni di modifica (approve/reject/delete)
- `app/actions/topups-admin.ts` → Funzioni di lettura (getTopUpRequestsAdmin)

**❌ NON duplicare funzioni** tra i due file (causa errori build Vercel)

**📖 Dettagli**: 
- [`docs/GUIDA_ANTI_DUPLICATI.md`](./docs/GUIDA_ANTI_DUPLICATI.md) - Come evitare errori build
- [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "7.1 Server Actions Wallet/Top-Up"

### Crittografia

- Password automation: AES-256-GCM
- Chiave: `ENCRYPTION_KEY` (64 caratteri hex)
- Mai esporre password nei log o al client

**📖 Dettagli**: Vedi [`automation-service/SICUREZZA.md`](./automation-service/SICUREZZA.md)

---

## 📚 DOCUMENTAZIONE COMPLETA - INDICE PER AI AGENT

### 📖 Documentazione Principale (LEGGI PRIMA)

1. **[`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md)** ⭐
   - Documentazione tecnica completa
   - Architettura, stack, moduli, database, flussi, sicurezza
   - **LEGGI QUESTO PER PRIMO**

2. **[`docs/README.md`](./docs/README.md)** ⭐
   - Indice completo di tutta la documentazione disponibile
   - Organizzato per categoria
   - **CONSULTA QUESTO PER TROVARE GUIDE SPECIFICHE**

### 🤖 Automation Service

- **[`docs/AUTOMATION_AGENT_COMPLETA.md`](./docs/AUTOMATION_AGENT_COMPLETA.md)** ⭐
  - Documentazione tecnica completa automation
  - Architettura, componenti, funzionalità, database, sicurezza, deploy, utilizzo, troubleshooting

- **[`automation-service/README.md`](./automation-service/README.md)**
  - Setup Railway e sviluppo locale
  - Endpoint, variabili d'ambiente, troubleshooting

- **[`docs/AUTOMATION_SPEDISCI_ONLINE.md`](./docs/AUTOMATION_SPEDISCI_ONLINE.md)**
  - Guida operativa e troubleshooting
  - Configurazione IMAP, lock manuale, best practices

- **[`automation-service/SICUREZZA.md`](./automation-service/SICUREZZA.md)**
  - Sicurezza e best practices
  - Crittografia, autenticazione, rate limiting

- **[`automation-service/DEPLOY-RAILWAY.md`](./automation-service/DEPLOY-RAILWAY.md)**
  - Deploy su Railway
  - Configurazione, troubleshooting build

### 💳 Sistema Finanziario

- **[`INVENTARIO_SISTEMA_FINANZIARIO.md`](./INVENTARIO_SISTEMA_FINANZIARIO.md)** ⭐
  - Inventario completo tabelle/endpoint finance
  - Migrazioni, funzioni SQL, server actions

- **[`FIX_WALLET_SECURITY_RIEPILOGO.md`](./FIX_WALLET_SECURITY_RIEPILOGO.md)**
  - Implementazione sicurezza wallet
  - Protezioni, validazioni, audit log

- **[`TOPUPS_ADMIN_FALLBACK_AUTH.md`](./TOPUPS_ADMIN_FALLBACK_AUTH.md)**
  - Fallback auth per top-ups admin
  - Se user non esiste in public.users

- **[`ANALISI_RISCHI_WALLET.md`](./ANALISI_RISCHI_WALLET.md)**
  - Analisi rischi e mitigazioni
  - Valutazione sicurezza wallet

### 🛠️ Guide Operative

- **[`docs/GUIDA_ANTI_DUPLICATI.md`](./docs/GUIDA_ANTI_DUPLICATI.md)**
  - Come evitare errori build e codice duplicato
  - Struttura file corretta, import separati

- **[`RIEPILOGO_FIX_APPROVE_TOPUP.md`](./RIEPILOGO_FIX_APPROVE_TOPUP.md)**
  - Fix completo approvazione top-up
  - Problema produzione risolto

### 🔍 Troubleshooting

- **[`docs/README.md`](./docs/README.md)** - Sezione Troubleshooting
  - Errori comuni
  - Fix specifici
  - Debug guide

### 📊 Altri Documenti Importanti

- **[`docs/COURIER_CONFIGS_SYSTEM.md`](./docs/COURIER_CONFIGS_SYSTEM.md)** - Sistema configurazioni corrieri
- **[`docs/README_API_CORRIERI.md`](./docs/README_API_CORRIERI.md)** - Documentazione API corrieri
- **[`docs/dashboard-redesign.md`](./docs/dashboard-redesign.md)** - Redesign dashboard e Anne Assistant

---

## 🚀 DEPLOY

### Vercel (Frontend)

1. Connetti repository GitHub a Vercel
2. Configura variabili d'ambiente
3. Deploy automatico su push a `master`

**📖 Dettagli**: Vedi [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md)

### Railway (Automation Service)

1. Crea nuovo servizio in Railway
2. Imposta Root Directory: `automation-service`
3. Configura variabili d'ambiente
4. Deploy automatico da GitHub

**📖 Dettagli**: Vedi [`automation-service/DEPLOY-RAILWAY.md`](./automation-service/DEPLOY-RAILWAY.md)

---

## 🧪 TESTING

### Test End-to-End

```bash
npm run test:e2e         # Esegui tutti i test
npm run test:e2e:ui     # Test con UI interattiva
npm run test:e2e:debug  # Test in modalità debug
```

**File**: `e2e/*.spec.ts`

### Test Manuali Wallet/Top-Up

1. ✅ Creazione top_up_request valida → status pending
2. ✅ Importo 0 o >10000 → deve fallire server-side
3. ✅ File .exe o >10MB → deve fallire
4. ✅ 6 richieste in 24h → la 6a deve fallire (rate limit)
5. ✅ Approva richiesta → 1 sola wallet_transaction, balance aumenta 1 volta
6. ✅ Doppia approva stessa richiesta → errore "già processata"
7. ✅ Rifiuta richiesta → status rejected, nessuna transazione wallet
8. ✅ Verifica audit_logs per tutti gli eventi

**📖 Dettagli**: Vedi [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "9. TESTING"

---

## ⚠️ REGOLE CRITICHE

### Wallet Balance
- ❌ **MAI** aggiornare direttamente `users.wallet_balance`
- ✅ **SOLO** RPC o INSERT su `wallet_transactions`

### Struttura File
- ❌ **NON duplicare** funzioni tra `wallet.ts` e `topups-admin.ts`
- ✅ Import separati nella UI

### Migrazioni
- ⚠️ **ORDINE OBBLIGATORIO** per wallet (027 → 028 → 029 → 030)
- ⚠️ Verificare prerequisiti prima di applicare

**📖 Dettagli**: Vedi [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md) sezione "8. SICUREZZA E BEST PRACTICES"

---

## 📞 NAVIGAZIONE DOCUMENTAZIONE PER AI AGENT

### Per Analizzare il Progetto

1. **Inizia da**: [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md)
2. **Consulta**: [`docs/README.md`](./docs/README.md) per trovare guide specifiche
3. **Per Automation**: [`docs/AUTOMATION_AGENT_COMPLETA.md`](./docs/AUTOMATION_AGENT_COMPLETA.md)
4. **Per Finance**: [`INVENTARIO_SISTEMA_FINANZIARIO.md`](./INVENTARIO_SISTEMA_FINANZIARIO.md)

### Per Troubleshooting

1. **Errori Build**: [`docs/GUIDA_ANTI_DUPLICATI.md`](./docs/GUIDA_ANTI_DUPLICATI.md)
2. **Automation**: [`docs/AUTOMATION_SPEDISCI_ONLINE.md`](./docs/AUTOMATION_SPEDISCI_ONLINE.md)
3. **Wallet**: [`FIX_WALLET_SECURITY_RIEPILOGO.md`](./FIX_WALLET_SECURITY_RIEPILOGO.md)

### Per Sviluppo

1. **Setup**: Sezione "SETUP & SVILUPPO" in questo README
2. **Architettura**: [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md)
3. **File Chiave**: Sezione "STRUTTURA PROGETTO" in questo README

---

## 📋 CHECKLIST PER AI AGENT

Prima di iniziare a lavorare sul progetto:

- [ ] Ho letto [`DOCUMENTAZIONE_COMPLETA_PROGETTO.md`](./DOCUMENTAZIONE_COMPLETA_PROGETTO.md)
- [ ] Ho consultato [`docs/README.md`](./docs/README.md) per trovare guide specifiche
- [ ] Ho verificato le regole critiche (Wallet Balance, Struttura File)
- [ ] Ho controllato l'ordine delle migrazioni se lavoro su wallet
- [ ] Ho verificato i riferimenti ai file chiave nel codice

---

**Ultimo aggiornamento:** Dicembre 2025  
**Versione:** 2.2.0  
**Repo:** gdsgroupsas-jpg/spediresicuro  
**Branch:** master

---

_Questo documento è la Verità. Se il codice differisce da questo documento, il codice deve essere aggiornato o questo documento emendato tramite PR._
