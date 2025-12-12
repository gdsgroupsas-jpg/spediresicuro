# 📚 DOCUMENTAZIONE COMPLETA PROGETTO - SpedireSicuro.it

**Versione:** 1.0.0  

**Data:** 09 Dicembre 2025  

**Repository:** https://github.com/gdsgroupsas-jpg/spediresicuro.git  

**Branch principale:** master  

**Account GitHub:** gdsgroupsas-jpg

---

## 📋 INDICE

1. [Panoramica del Progetto](#panoramica)
2. [Stack Tecnologico](#stack)
3. [Architettura del Sistema](#architettura)
4. [Struttura del Progetto](#struttura)
5. [Funzionalità Principali](#funzionalita)
6. [Database e Schema](#database)
7. [API e Endpoint](#api)
8. [Configurazione e Setup](#configurazione)
9. [Deployment](#deployment)
10. [Sicurezza](#sicurezza)
11. [Testing](#testing)
12. [Automation Service](#automation-service)
13. [Sistema di Diagnostica](#diagnostica)
14. [Componenti Chiave](#componenti)
15. [Flussi di Lavoro](#flussi)
16. [Variabili d'Ambiente](#variabili)
17. [Script e Utilità](#script)
18. [Documentazione Aggiuntiva](#documentazione)

---

## 🎯 1. PANORAMICA DEL PROGETTO {#panoramica}

### Descrizione

**SpedireSicuro.it** è una piattaforma web completa per la gestione di spedizioni con ricarico configurabile. Il sistema permette di:

- Creare preventivi e spedizioni in modo rapido e automatizzato
- Integrare con corrieri esterni (Spedisci.Online, GLS, BRT, Poste Italiane)
- Gestire utenti multi-livello (admin, reseller, utenti finali)
- Automatizzare processi tramite AI e OCR
- Monitorare eventi diagnostici e performance
- Gestire wallet e transazioni finanziarie
- Fornire dashboard amministrativa completa

### Obiettivi del Progetto

1. **Velocità**: Ridurre il tempo di creazione spedizioni del 90%
2. **Automazione**: Integrazione AI per estrazione dati da screenshot/documenti
3. **Scalabilità**: Supporto multi-utente con gerarchie complesse
4. **Sicurezza**: GDPR compliant, crittografia end-to-end
5. **Performance**: Tempo di risposta sotto 2 secondi
6. **Budget Zero**: Utilizzo di servizi gratuiti o low-cost

### Modello di Business

- **Margine configurabile** su ogni spedizione
- **Sistema commissioni** per reseller
- **Possibile abbonamento** per aziende
- **Wallet system** per gestione crediti

---

## 🛠️ 2. STACK TECNOLOGICO {#stack}

### Frontend

- **Framework**: Next.js 14 (App Router)
- **Linguaggio**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Lucide React (icone), Radix UI (componenti accessibili)
- **Animazioni**: Framer Motion
- **Form Management**: React Hook Form + Zod
- **State Management**: React Query (TanStack Query)
- **AI Integration**: Anthropic Claude SDK

### Backend

- **Runtime**: Node.js
- **Framework**: Next.js API Routes
- **Database**: PostgreSQL (Supabase)
- **Autenticazione**: NextAuth.js v5
- **ORM/Query**: Supabase Client (PostgreSQL)
- **File Processing**: Puppeteer, Tesseract.js, jsPDF

### Servizi Esterni

- **Database**: Supabase (PostgreSQL hosted)
- **Deploy**: Vercel (Next.js app)
- **Automation Service**: Standalone Express server (porta 3000)
- **AI Assistant**: Anthropic Claude API
- **OCR**: Tesseract.js, Google Cloud Vision
- **Email**: IMAP (per lettura email)

### Tools di Sviluppo

- **Testing**: Playwright (E2E)
- **Linting**: ESLint
- **Type Checking**: TypeScript
- **Build**: Next.js SWC compiler
- **Version Control**: Git

---

## 🏗️ 3. ARCHITETTURA DEL SISTEMA {#architettura}

### Componenti Principali

```
┌─────────────────────────────────────────────────────────┐
│                    NEXT.JS APPLICATION                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Frontend   │  │  API Routes  │  │ Server Actions│ │
│  │  (React)     │  │  (Backend)   │  │  (Server)     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                        │
                        │ HTTP/REST
                        │
┌─────────────────────────────────────────────────────────┐
│              AUTOMATION SERVICE (Express)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Puppeteer  │  │  Diagnostics │  │   Sync API    │ │
│  │  (Browser)   │  │   Endpoint   │  │   Endpoint   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                        │
                        │ PostgreSQL
                        │
┌─────────────────────────────────────────────────────────┐
│              SUPABASE (PostgreSQL)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Users      │  │  Shipments   │  │  Diagnostics  │ │
│  │   Tables     │  │   Tables     │  │    Events     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Flusso Dati

1. **Utente** → Interagisce con frontend Next.js
2. **Frontend** → Chiama API Routes o Server Actions
3. **API Routes** → Possono chiamare Automation Service
4. **Automation Service** → Esegue automazioni browser (Puppeteer)
5. **Database** → Tutti i servizi salvano/leggono da Supabase
6. **Diagnostics** → Eventi salvati in `diagnostics_events`

---

## 📁 4. STRUTTURA DEL PROGETTO {#struttura}

```
spediresicuro-master/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── admin/                # Endpoint admin
│   │   ├── automation/           # Endpoint automation
│   │   ├── diagnostics/          # Endpoint diagnostica
│   │   ├── features/             # Feature flags
│   │   ├── ocr/                  # OCR processing
│   │   └── ...
│   ├── dashboard/                # Dashboard pages
│   │   ├── admin/                # Admin dashboard
│   │   │   ├── logs/             # Log diagnostici
│   │   │   ├── configurations/   # Configurazioni corrieri
│   │   │   └── features/         # Feature management
│   │   ├── spedizioni/           # Gestione spedizioni
│   │   ├── wallet/               # Wallet utente
│   │   └── ...
│   ├── page.tsx                  # Homepage
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Stili globali
│
├── components/                   # Componenti React riutilizzabili
│   ├── ai/                       # Componenti AI (Anne)
│   ├── dashboard/                # Componenti dashboard
│   ├── homepage/                 # Componenti homepage
│   └── ...
│
├── lib/                          # Utilities e configurazioni
│   ├── actions/                  # Server Actions
│   ├── adapters/                 # Adapter per corrieri
│   ├── ai/                       # Integrazione AI
│   ├── automation/               # Automation logic
│   ├── config/                   # Configurazioni (navigation, ecc.)
│   ├── db/                       # Database client
│   ├── security/                 # Sicurezza (encryption, audit)
│   └── ...
│
├── types/                        # TypeScript types
│   ├── diagnostics.ts            # Tipi diagnostica
│   ├── shipments.ts              # Tipi spedizioni
│   ├── analytics.ts             # Tipi analytics
│   └── index.ts                  # Export centralizzato
│
├── actions/                      # Server Actions (legacy)
│   ├── admin.ts                  # Actions admin
│   ├── get-logs.ts               # Actions log diagnostici
│   └── ...
│
├── supabase/                     # Database migrations
│   └── migrations/               # File SQL migration
│       ├── 001_complete_schema.sql
│       ├── 023_diagnostics_events.sql
│       └── ...
│
├── automation-service/           # Servizio Express standalone
│   ├── src/
│   │   ├── agent.ts              # Classe SOA (SpedisciOnlineAgent)
│   │   └── index.ts              # Server Express
│   ├── .env                      # Variabili ambiente (non committato)
│   └── package.json
│
├── scripts/                      # Script di utilità
│   ├── setup-supabase.ts        # Setup database
│   ├── verify-supabase.ts       # Verifica configurazione
│   └── ...
│
├── docs/                         # Documentazione
│   └── archive/                  # Documentazione storica
│
├── e2e/                          # Test end-to-end (Playwright)
│   ├── happy-path.spec.ts
│   └── ...
│
├── public/                       # File statici
│   ├── brand/                    # Logo, favicon
│   └── ...
│
├── .env.example                  # Template variabili ambiente
├── package.json                  # Dipendenze progetto
├── next.config.js                # Configurazione Next.js
├── tsconfig.json                 # Configurazione TypeScript
├── tailwind.config.js            # Configurazione Tailwind
└── README.md                     # Guida rapida
```

---

## ⚡ 5. FUNZIONALITÀ PRINCIPALI {#funzionalita}

### 5.1 Gestione Spedizioni

- **Creazione Spedizione**: Form completo con validazione
- **Import da CSV**: Importazione massiva da file
- **OCR Scanner**: Estrazione dati da screenshot/documenti
- **Tracking**: Monitoraggio stato spedizioni
- **Etichette**: Generazione PDF etichette
- **LDV Scanner**: Scansione lettere di vettura

### 5.2 Dashboard Utente

- **Panoramica**: Statistiche e overview
- **Spedizioni**: Lista e dettagli spedizioni
- **Wallet**: Gestione crediti e transazioni
- **Impostazioni**: Configurazione account
- **Integrazioni**: Connessioni API corrieri

### 5.3 Dashboard Admin

- **God View**: Vista completa sistema
- **Gestione Utenti**: CRUD utenti, ruoli, permessi
- **Configurazioni Corrieri**: Gestione API keys e settings
- **Feature Flags**: Attivazione/disattivazione features
- **Log Diagnostici**: Visualizzazione eventi sistema
- **Automazioni**: Gestione sync automatici
- **Listini Prezzi**: Gestione listini personalizzati

### 5.4 Sistema Reseller

- **Multi-livello**: Gerarchia admin → reseller → utenti
- **Wallet Reseller**: Gestione crediti per clienti
- **Commissioni**: Sistema commissioni configurabile
- **Team Management**: Gestione team e sub-admin

### 5.5 AI Assistant (Anne)

- **Chat AI**: Assistente virtuale con Claude AI
- **Suggerimenti Contestuali**: Suggerimenti proattivi
- **Estrazione Dati**: AI per estrarre dati da screenshot
- **Voice Control**: Controllo vocale (sperimentale)

### 5.6 OCR e Automazione

- **OCR Avanzato**: Tesseract.js + Google Cloud Vision
- **Estrazione Dati**: Da screenshot WhatsApp, email, documenti
- **Automation Service**: Sync automatico con corrieri
- **Browser Automation**: Puppeteer per login e scraping

### 5.7 Sistema Diagnostica

- **Eventi Diagnostici**: Tracciamento errori, warning, info
- **Performance Monitoring**: Metriche performance
- **Correlation ID**: Tracciamento richieste
- **Dashboard Log**: Visualizzazione eventi in tempo reale

---

## 🗄️ 6. DATABASE E SCHEMA {#database}

### Database: Supabase (PostgreSQL)

### Tabelle Principali

#### `users`

- Gestione utenti con ruoli (user, admin, superadmin)
- Profili estesi con dati cliente
- Integrazioni con corrieri

#### `shipments`

- Spedizioni complete con stato
- Tracking informazioni
- Dati mittente/destinatario
- Prezzi e margini

#### `diagnostics_events`

- Eventi diagnostici del sistema
- Type: error, warning, info, performance, user_action
- Severity: critical, high, medium, low, info
- Context: JSONB con dettagli
- Correlation ID per tracciamento

#### `courier_configs`

- Configurazioni API corrieri
- Credenziali criptate
- Mapping contratti

#### `user_features`

- Feature flags per utenti
- Killer features attive

#### `wallet_transactions`

- Transazioni wallet
- Ricariche e prelievi
- Reseller wallet

#### `price_lists`

- Listini prezzi personalizzati
- Assegnazione a utenti

### Migrations

Tutte le migrations sono in `supabase/migrations/`:

- `001_complete_schema.sql` - Schema base
- `023_diagnostics_events.sql` - Tabella diagnostica
- `024_add_correlation_id.sql` - Correlation ID
- `019_reseller_system_and_wallet.sql` - Sistema reseller
- E altre...

### Row Level Security (RLS)

- **Politiche RLS** configurate per sicurezza
- **Service Role** per operazioni admin
- **Anon Key** per operazioni client-side (con RLS)

---

## 🔌 7. API E ENDPOINT {#api}

### API Routes Next.js (`app/api/`)

#### Admin

- `GET /api/admin/overview` - Statistiche admin
- `GET /api/admin/users/[id]` - Dettagli utente
- `POST /api/admin/users/[id]/features` - Assegna features
- `GET /api/admin/shipments/[id]` - Dettagli spedizione

#### Automation

- `POST /api/automation/spedisci-online/sync` - Sync corriere

#### Diagnostics

- `POST /api/diagnostics` - Salva evento diagnostico

#### Features

- `GET /api/features/list` - Lista features disponibili
- `GET /api/features/check` - Verifica feature utente

#### OCR

- `POST /api/ocr/extract` - Estrazione testo da immagine

#### Spedizioni

- `GET /api/spedizioni` - Lista spedizioni
- `POST /api/spedizioni/import` - Import CSV
- `GET /api/spedizioni/[id]/ldv` - Dettagli LDV

#### Wallet

- `GET /api/wallet/transactions` - Transazioni wallet

### Automation Service (Express - porta 3000)

#### Health

- `GET /health` - Health check

#### Sync

- `POST /api/sync` - Sync configurazione corriere
- `POST /api/sync-shipments` - Sync spedizioni
- `GET /api/cron/sync` - Sync automatico (cron)

#### Diagnostics

- `POST /api/diagnostics` - Salva evento diagnostico
  - Rate limit: 30 req/min
  - Auth: Bearer token

### Autenticazione

Tutti gli endpoint (tranne `/health`) richiedono:

- **Header**: `Authorization: Bearer <token>`
- **Token**: Configurato in variabili ambiente

---

## ⚙️ 8. CONFIGURAZIONE E SETUP {#configurazione}

### Prerequisiti

- Node.js 18+
- npm o yarn
- Account Supabase
- Account Vercel (per deploy)
- Account Anthropic (per AI Assistant - opzionale)

### Setup Locale

#### 1. Clone Repository

```bash
git clone https://github.com/gdsgroupsas-jpg/spediresicuro.git
cd spediresicuro
```

#### 2. Installazione Dipendenze

```bash
npm install
```

#### 3. Configurazione Variabili Ambiente

Crea `.env.local` nella root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tuo-progetto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<genera_con_openssl>

# Encryption
ENCRYPTION_KEY=<64_caratteri_hex>

# Diagnostics
DIAGNOSTICS_TOKEN=<token_sicuro>

# Automation Service
AUTOMATION_SERVICE_TOKEN=<token_sicuro>

# AI (opzionale)
ANTHROPIC_API_KEY=sk-ant-...
```

#### 4. Setup Database

```bash
# Esegui migrations Supabase
# Vai su Supabase Studio > SQL Editor
# Esegui i file in supabase/migrations/ in ordine
```

#### 5. Avvio Server

```bash
npm run dev
```

Server disponibile su: `http://localhost:3000`

### Setup Automation Service

```bash
cd automation-service
npm install

# Crea .env
cp ESEMPIO_ENV.txt .env
# Modifica .env con i tuoi valori

npm start
```

---

## 🚀 9. DEPLOYMENT {#deployment}

### Vercel (Next.js App)

1. **Connetti Repository**
   - Vai su Vercel Dashboard
   - Importa repository GitHub
   - Configura progetto

2. **Configura Variabili Ambiente**
   - Settings > Environment Variables
   - Aggiungi tutte le variabili da `.env.local`
   - **IMPORTANTE**: `NEXTAUTH_URL` = URL Vercel

3. **Deploy Automatico**
   - Ogni push su `master` → deploy automatico
   - Configurato in `.github/workflows/deploy.yml`

### Automation Service

Il servizio può essere deployato su:

- **Railway** (configurato con Dockerfile)
- **Heroku**
- **VPS** (Node.js standalone)

Vedi `automation-service/DEPLOY-RAILWAY.md` per dettagli.

---

## 🔐 10. SICUREZZA {#sicurezza}

### Autenticazione

- **NextAuth.js v5**: Gestione sessioni
- **JWT Tokens**: Per API authentication
- **Bearer Tokens**: Per Automation Service

### Crittografia

- **ENCRYPTION_KEY**: Per password corrieri
- **Bcrypt**: Per hash password utenti
- **HTTPS**: Obbligatorio in produzione

### Row Level Security (RLS)

- **Supabase RLS**: Politiche per accesso dati
- **Service Role**: Solo server-side
- **Anon Key**: Con RLS abilitato

### Headers Sicurezza

Configurati in `next.config.js`:

- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

### Rate Limiting

- **Diagnostics**: 30 req/min
- **Sync**: 20 req/10min
- Implementato con `express-rate-limit`

### GDPR Compliance

- Privacy Policy
- Cookie Policy
- Gestione consensi
- Dati criptati

---

## 🧪 11. TESTING {#testing}

### E2E Testing (Playwright)

```bash
npm run test:e2e              # Esegui tutti i test
npm run test:e2e:ui          # UI mode
npm run test:e2e:debug       # Debug mode
```

Test disponibili:

- `happy-path.spec.ts` - Flusso completo
- `form-validation.spec.ts` - Validazione form
- `shipments-list.spec.ts` - Lista spedizioni

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

---

## 🤖 12. AUTOMATION SERVICE {#automation-service}

### Descrizione

Servizio Express standalone che gestisce:

- **Browser Automation**: Puppeteer per login e scraping
- **Sync Corrieri**: Sincronizzazione automatica spedizioni
- **Diagnostics**: Endpoint per eventi diagnostici

### Struttura

```
automation-service/
├── src/
│   ├── agent.ts          # Classe SOA (SpedisciOnlineAgent)
│   └── index.ts          # Server Express
├── .env                  # Variabili ambiente
└── package.json
```

### Classe SOA

**SpedisciOnlineAgent** (`SOA`):

- `performLogin()`: Login centralizzato
- `syncShipmentsFromPortal()`: Sync spedizioni
- `extractSessionData()`: Estrazione dati sessione

### Endpoint

- `GET /health` - Health check
- `POST /api/sync` - Sync configurazione
- `POST /api/sync-shipments` - Sync spedizioni
- `POST /api/diagnostics` - Salva evento diagnostico

### Rate Limiting

- **Sync**: 20 richieste / 10 minuti
- **Diagnostics**: 30 richieste / minuto

---

## 📊 13. SISTEMA DI DIAGNOSTICA {#diagnostica}

### Tabella `diagnostics_events`

Schema:

```sql
- id: UUID (primary key)
- type: VARCHAR (error, warning, info, performance, user_action)
- severity: VARCHAR (critical, high, medium, low, info)
- context: JSONB (max 10KB, max 3 livelli)
- user_id: UUID (opzionale)
- ip_address: INET (opzionale)
- user_agent: TEXT (opzionale)
- correlation_id: UUID (opzionale)
- created_at: TIMESTAMPTZ
```

### Endpoint Diagnostics

**POST `/api/diagnostics`** (Automation Service)

Request:

```json
{
  "type": "error",
  "severity": "high",
  "context": {
    "message": "Errore durante sync",
    "error": "Connection timeout"
  },
  "correlation_id": "uuid-opzionale"
}
```

Response:

```json
{
  "success": true,
  "id": "uuid-evento",
  "message": "Evento diagnostico salvato con successo"
}
```

### Dashboard Log

**Pagina**: `/dashboard/admin/logs`

Funzionalità:

- Visualizzazione eventi in tempo reale
- Filtri per type, severity, data
- Espansione JSON completo
- Formato data: `dd/MM HH:mm`
- Badge colorati per severità

### Correlation ID

Permette di tracciare richieste attraverso più eventi:

- Stesso `correlation_id` = stessa richiesta
- Utile per debugging richieste complesse

---

## 🧩 14. COMPONENTI CHIAVE {#componenti}

### Navigation Config

**File**: `lib/config/navigationConfig.ts`

Configurazione centralizzata menu:

- Menu dinamici basati su ruolo
- Sezioni collapsibili
- Feature flags

### Dashboard Nav

**File**: `components/dashboard-nav.tsx`

Componente navigazione dashboard:

- Breadcrumbs
- Back button
- Quick actions

### Anne Assistant

**File**: `components/ai/pilot/pilot-modal.tsx`

Assistente AI:

- Chat con Claude AI
- Suggerimenti contestuali
- Floating button

### Log Row

**File**: `app/dashboard/admin/logs/log-row.tsx`

Componente riga log:

- Formattazione data
- Badge severità
- Espansione JSON

### Server Actions

**File**: `actions/get-logs.ts`

Server Action per log:

- `getSystemLogs(limit)`: Recupera log da Supabase

---

## 🔄 15. FLUSSI DI LAVORO {#flussi}

### Creazione Spedizione

1. Utente compila form o usa OCR
2. Validazione dati lato client
3. Submit → Server Action
4. Calcolo prezzi con margine
5. Creazione spedizione in Supabase
6. Integrazione corriere (se configurato)
7. Generazione etichetta PDF
8. Notifica utente

### Sync Automatico

1. Cron job chiama `/api/cron/sync`
2. Automation Service avvia Puppeteer
3. Login su portale corriere
4. Estrazione spedizioni
5. Salvataggio in Supabase
6. Notifica utenti

### OCR Processing

1. Utente carica immagine
2. Frontend chiama `/api/ocr/extract`
3. Processing con Tesseract.js
4. Estrazione testo
5. Parsing dati (mittente, destinatario, ecc.)
6. Pre-compilazione form

### Diagnostics Event

1. Evento generato in codice
2. Chiamata `POST /api/diagnostics`
3. Validazione payload
4. Rate limiting check
5. Salvataggio in Supabase
6. Response con ID evento

---

## 🔑 16. VARIABILI D'AMBIENTE {#variabili}

### Next.js (.env.local)

**Obbligatorie:**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `ENCRYPTION_KEY`

**Opzionali:**

- `ANTHROPIC_API_KEY` (per AI)
- `GOOGLE_CLIENT_ID/SECRET` (per OAuth)
- `DIAGNOSTICS_TOKEN`
- `AUTOMATION_SERVICE_TOKEN`

### Automation Service (.env)

**Obbligatorie:**

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DIAGNOSTICS_TOKEN`
- `AUTOMATION_SERVICE_TOKEN`
- `CRON_SECRET_TOKEN`
- `ENCRYPTION_KEY` (deve essere identico a Next.js)

**Opzionali:**

- `PORT` (default: 3000)
- `NODE_ENV` (default: development)

### Generazione Token

**NEXTAUTH_SECRET:**

```bash
openssl rand -base64 32
```

**ENCRYPTION_KEY:**

```bash
openssl rand -hex 32
```

**DIAGNOSTICS_TOKEN, AUTOMATION_SERVICE_TOKEN:**

Usa script `GENERA_TOKEN.ps1` o genera stringa casuale 32+ caratteri

Vedi `GUIDA_VARIABILI_AMBIENTE.md` per dettagli completi.

---

## 📜 17. SCRIPT E UTILITÀ {#script}

### Script NPM

```bash
npm run dev              # Avvio sviluppo
npm run build            # Build produzione
npm run start            # Avvio produzione
npm run lint             # Linting
npm run type-check       # Type checking
npm run test:e2e         # Test E2E
```

### Script Database

```bash
npm run setup:supabase       # Setup database
npm run verify:supabase      # Verifica configurazione
npm run check:table          # Verifica struttura tabelle
```

### Script PowerShell

- `GENERA_TOKEN.ps1` - Genera token sicuri
- `GENERA_ENCRYPTION_KEY.ps1` - Genera encryption key
- `automation-service/test-diagnostics.ps1` - Test endpoint diagnostics

---

## 📚 18. DOCUMENTAZIONE AGGIUNTIVA {#documentazione}

### File Principali

- `README.md` - Guida rapida
- `RECAP_PROGETTO_COMPLETO.md` - Recap completo sistema diagnostica
- `GUIDA_VARIABILI_AMBIENTE.md` - Guida variabili ambiente
- `GUIDA_RAPIDA_VERCEL.md` - Guida deploy Vercel
- `DOCUMENTAZIONE_COMPLETA_PROGETTO.md` - Questo documento

### Cartelle Documentazione

- `docs/` - Documentazione tecnica attiva
- `docs/archive/` - Documentazione storica/obsoleta

### Documenti Importanti

- `supabase/migrations/README_SHIPMENTS.md` - Schema spedizioni
- `components/ai/pilot/README.md` - Documentazione Anne AI
- `automation-service/DEPLOY-RAILWAY.md` - Deploy Automation Service

---

## 🎓 CONVENZIONI DI CODICE

### Naming

- **File**: kebab-case (es: `get-logs.ts`)
- **Componenti**: PascalCase (es: `LogRow.tsx`)
- **Variabili**: camelCase italiano (es: `prezzoTotale`)
- **Commenti**: Italiano

### Struttura

- **Server Components**: Default (quando possibile)
- **Client Components**: `'use client'` quando necessario
- **Server Actions**: `'use server'` in file dedicati

### Best Practices

- TypeScript strict mode
- Error handling completo
- Logging per debugging
- Validazione input (Zod)
- Rate limiting su API

---

## 🐛 TROUBLESHOOTING

### Problemi Comuni

1. **Build Error: supabaseUrl is required**
   - Verifica `.env.local` contiene `NEXT_PUBLIC_SUPABASE_URL`
   - Riavvia server dopo modifiche `.env`

2. **Error: Cannot find module 'express'**
   - Esegui `npm install` in `automation-service/`

3. **Diagnostics non salvano nel DB**
   - Verifica `.env` in `automation-service/`
   - Controlla `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`

4. **Rate Limit Error**
   - Aspetta il timeout o aumenta limit in codice

---

## 📞 SUPPORTO

### Repository

- **GitHub**: https://github.com/gdsgroupsas-jpg/spediresicuro.git
- **Branch**: master
- **Account**: gdsgroupsas-jpg

### Contatti

Per problemi o domande:

1. Controlla documentazione in `docs/`
2. Verifica variabili ambiente
3. Controlla log server
4. Consulta `GUIDA_VARIABILI_AMBIENTE.md`

---

## ✅ CHECKLIST SETUP COMPLETO

### Sviluppo Locale

- [ ] Repository clonato
- [ ] `npm install` eseguito
- [ ] `.env.local` configurato
- [ ] Database Supabase configurato
- [ ] Migrations eseguite
- [ ] Server Next.js avviato (`npm run dev`)
- [ ] Automation Service avviato (se necessario)

### Produzione

- [ ] Variabili ambiente configurate su Vercel
- [ ] Deploy automatico configurato
- [ ] Automation Service deployato
- [ ] Test E2E passati
- [ ] Monitoring attivo

---

**Documento creato**: 09 Dicembre 2025  

**Ultima modifica**: 09 Dicembre 2025  

**Versione**: 1.0.0  

**Stato**: ✅ Completo

---

*Questo documento è stato creato per fornire una panoramica completa del progetto SpedireSicuro.it. Per dettagli specifici, consulta i file di documentazione nella cartella `docs/`.*

