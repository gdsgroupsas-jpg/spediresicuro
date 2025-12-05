# 📘 DOCUMENTAZIONE COMPLETA PROGETTO SPEDIRESICURO.IT
## Prompt per Google Gemini AI - Analisi Completa

**Data Creazione:** 2025-12-03  
**Versione Progetto:** 1.0.0  
**Status:** ✅ In Produzione  
**Repository:** https://github.com/gdsgroupsas-jpg/spediresicuro.git

---

## 🎯 OBIETTIVO DEL DOCUMENTO

Questo documento fornisce una panoramica completa e dettagliata del progetto **SpedireSicuro.it** per permettere a Google Gemini AI di comprendere:
- Cos'è il progetto e cosa fa
- Come è strutturato tecnicamente
- Quali sono le funzionalità principali
- Come funziona ogni componente
- Come configurare e deployare
- Quali sono le dipendenze e le relazioni tra componenti

---

## 📋 INDICE

1. [Panoramica Generale](#1-panoramica-generale)
2. [Obiettivo e Business Model](#2-obiettivo-e-business-model)
3. [Stack Tecnologico Completo](#3-stack-tecnologico-completo)
4. [Architettura del Sistema](#4-architettura-del-sistema)
5. [Struttura File e Cartelle](#5-struttura-file-e-cartelle)
6. [Database Schema](#6-database-schema)
7. [API Endpoints](#7-api-endpoints)
8. [Componenti Principali](#8-componenti-principali)
9. [Flussi di Lavoro](#9-flussi-di-lavoro)
10. [Sicurezza](#10-sicurezza)
11. [Integrazioni](#11-integrazioni)
12. [Configurazione](#12-configurazione)
13. [Deploy](#13-deploy)
14. [Troubleshooting](#14-troubleshooting)

---

## 🤝 INTEGRAZIONE CON CURSOR AI AGENT

### Chi è Cursor AI Agent?

**Cursor AI Agent** (Auto) è l'assistente AI integrato nell'IDE Cursor che ha accesso diretto al codice del progetto. Può:
- Leggere e modificare file del progetto
- Eseguire comandi terminale
- Cercare nel codebase
- Creare e modificare codice
- Gestire Git (commit, push)

### Come Collaborare con Cursor AI Agent

Quando Gemini analizza questo progetto e identifica modifiche o miglioramenti da fare, può **preparare istruzioni chiare** per Cursor AI Agent:

**Formato Richiesta Consigliato:**
```
"Modifica il file [percorso] per [scopo]. 
Aggiungi [funzionalità] nella funzione [nome]. 
Segui le convenzioni: [kebab-case per file, PascalCase per componenti, camelCase italiano per variabili]."
```

**Esempio Pratico:**
```
"Modifica il file lib/couriers/factory.ts per aggiungere supporto al corriere 'BRT'. 
Crea nuovo adapter in lib/adapters/couriers/brt.ts seguendo il pattern di spedisci-online.ts. 
Aggiungi case 'brt' nel factory con import del nuovo adapter."
```

### Cosa Può Fare Cursor AI Agent

- ✅ **Modificare Codice**: Cambiare file esistenti o crearne di nuovi
- ✅ **Cercare nel Codebase**: Trovare dove è usata una funzione o variabile
- ✅ **Eseguire Comandi**: npm, git, test, build
- ✅ **Gestire Git**: Commit e push modifiche
- ✅ **Verificare Errori**: Controllare linting e type errors

### Cosa NON Può Fare Cursor AI Agent

- ❌ **Accedere a Servizi Esterni**: Non può chiamare API esterne o accedere a Supabase/Vercel direttamente
- ❌ **Eseguire Deploy**: Non può fare deploy automatico (serve approvazione manuale)
- ❌ **Modificare Variabili d'Ambiente**: Non può modificare `.env.local` (file protetto)

### Workflow Consigliato

1. **Gemini Analizza** → Identifica problema/miglioramento
2. **Gemini Prepara Istruzioni** → Scrive richiesta chiara per Cursor AI Agent
3. **Cursor AI Agent Esegue** → Modifica codice, testa, committa
4. **Gemini Verifica** → Controlla risultato e suggerisce ottimizzazioni

### Convenzioni da Rispettare

Quando prepari istruzioni per Cursor AI Agent, ricorda:
- **File**: kebab-case (es. `user-profile.tsx`)
- **Componenti**: PascalCase (es. `UserProfile`)
- **Variabili**: camelCase italiano (es. `prezzoTotale`, `datiCliente`)
- **Commenti**: Sempre in italiano
- **TypeScript**: Usa types definiti in `types/`

---

## 1. PANORAMICA GENERALE

### Cos'è SpedireSicuro.it?

**SpedireSicuro.it** è una **piattaforma SaaS (Software as a Service)** per la gestione di spedizioni logistiche con sistema di preventivi e ricarico configurabile.

### Cosa Fa la Piattaforma?

La piattaforma permette a utenti e aziende di:

1. **Calcolare Preventivi Spedizioni**
   - Inserire dati di spedizione (mittente, destinatario, peso, dimensioni)
   - Ottenere preventivi da multiple compagnie di spedizione
   - Applicare margini di ricarico configurabili
   - Confrontare prezzi e tempi di consegna

2. **Gestire Spedizioni**
   - Creare nuove spedizioni
   - Tracciare spedizioni in tempo reale
   - Generare Lettere di Vettura (LDV) interne
   - Gestire resi e rimborsi

3. **Automatizzare Processi**
   - Integrazione automatica con Spedisci.Online (estrazione session cookies)
   - Integrazione con store e-commerce (WooCommerce, Shopify, Magento, PrestaShop, Amazon)
   - OCR automatico per estrarre dati da screenshot WhatsApp
   - Sincronizzazione automatica ordini

4. **Multi-Tenant**
   - Ogni utente ha le proprie configurazioni corrieri isolate
   - Sistema di ruoli (admin, user, merchant)
   - Dashboard personalizzate per tipo utente

### Caratteristiche Principali

- ✅ **Preventivi Istantanei**: Calcolo automatico con margini configurabili
- ✅ **Multi-Corriere**: Supporto per GLS, SDA, Poste Italiane, Bartolini, DHL, Spedisci.Online
- ✅ **Automation**: Browser automation per estrarre session cookies da Spedisci.Online
- ✅ **OCR**: Estrazione dati da screenshot con AI (Claude, Google Vision, Tesseract)
- ✅ **Realtime**: Aggiornamenti spedizioni in tempo reale
- ✅ **Sicurezza**: Criptazione AES-256-GCM, RLS, Audit Logging
- ✅ **GDPR Compliant**: Gestione dati personali conforme GDPR

---

## 2. OBIETTIVO E BUSINESS MODEL

### Obiettivo del Progetto

Il progetto è stato sviluppato con focus su:
1. **Rivendibilità**: Codice pulito e ben documentato per facilitare la vendita
2. **Costi Zero**: Utilizzo di servizi gratuiti (Vercel, Supabase free tier)
3. **Scalabilità**: Architettura che supporta crescita senza riscritture
4. **Performance**: Caricamento < 2 secondi

### Modello di Business

Il sistema genera ricavi attraverso:

1. **Ricarico su Spedizioni**
   - Il sistema applica un margine percentuale sul costo base del corriere
   - Esempio: Corriere costa 10€ → Cliente paga 15€ (margine 50%)
   - Margine configurabile per utente/corriere

2. **Commissioni Fisse**
   - Commissione fissa per ogni spedizione gestita
   - Esempio: 2€ per spedizione

3. **Piani Abbonamento** (futuro)
   - Abbonamento mensile/annuale per aziende
   - Features premium (API access, analytics avanzate)

### Utenti Target

- **E-commerce**: Store online che spediscono prodotti
- **Aziende**: Aziende che gestiscono molte spedizioni
- **Rivenditori**: Intermediari che rivendono servizi di spedizione

---

## 3. STACK TECNOLOGICO COMPLETO

### Frontend

| Tecnologia | Versione | Scopo |
|------------|----------|-------|
| **Next.js** | 14.2.0 | Framework React con App Router |
| **React** | 18.2.0 | Libreria UI |
| **TypeScript** | 5.3.0 | Type safety |
| **Tailwind CSS** | 3.4.0 | Styling utility-first |
| **Framer Motion** | 11.0.0 | Animazioni |
| **React Hook Form** | 7.50.0 | Gestione form |
| **Zod** | 3.22.0 | Validazione schema |
| **Lucide React** | 0.555.0 | Icone |
| **cmdk** | 1.0.0 | Command palette |

### Backend

| Tecnologia | Versione | Scopo |
|------------|----------|-------|
| **Next.js API Routes** | 14.2.0 | Serverless functions |
| **NextAuth.js** | 5.0.0-beta.30 | Autenticazione |
| **Supabase Client** | 2.39.0 | Database client |
| **Puppeteer** | 24.15.0 | Browser automation |
| **Cheerio** | 1.0.0 | HTML parsing |
| **IMAP** | 0.8.19 | Lettura email (2FA) |

### Database

| Tecnologia | Scopo |
|------------|-------|
| **PostgreSQL** | Database relazionale (hosted su Supabase) |
| **Supabase** | Backend as a Service (database + auth + storage) |
| **Row Level Security (RLS)** | Isolamento dati multi-tenant |
| **Realtime** | Aggiornamenti live (subscriptions) |

### Sicurezza & Criptazione

| Tecnologia | Scopo |
|------------|-------|
| **AES-256-GCM** | Criptazione credenziali API |
| **bcrypt** | Hash password utenti |
| **JWT** | Session tokens (NextAuth) |
| **Audit Logging** | Tracciamento operazioni sensibili |

### Altri Servizi

| Servizio | Scopo |
|----------|-------|
| **Vercel** | Hosting e deploy (serverless) |
| **Supabase** | Database, Auth, Storage |
| **Anthropic Claude** | AI per OCR e analisi |
| **Google Cloud Vision** | OCR immagini (opzionale) |
| **Tesseract.js** | OCR locale (fallback) |

### Librerie Utilità

| Libreria | Versione | Scopo |
|----------|----------|-------|
| **jsPDF** | 2.5.2 | Generazione PDF (LDV) |
| **jspdf-autotable** | 3.8.4 | Tabelle in PDF |
| **xlsx** | 0.18.5 | Export Excel |
| **@zxing/library** | 0.20.0 | Generazione barcode |
| **qs** | 6.11.0 | Serializzazione form data |

---

## 4. ARCHITETTURA DEL SISTEMA

### Pattern Architetturali Utilizzati

#### 1. Multi-Tenant Architecture

Ogni utente ha configurazioni corrieri isolate:
- Tabella `users` con campo `assigned_config_id`
- Tabella `courier_configs` con configurazioni per utente
- RLS (Row Level Security) per isolamento dati
- Fallback a configurazione default se utente non ha config assegnata

**File chiave:**
- `lib/db/couriers.ts` - Gestione configurazioni
- `supabase/migrations/010_courier_configs_system.sql` - Schema database

#### 2. Factory Pattern

Istanziazione dinamica di provider corrieri:
- `lib/couriers/factory.ts` - Factory per creare adapter corrieri
- Supporta: Spedisci.Online, GLS, BRT, Poste Italiane, SDA, DHL
- Interfaccia comune `CourierAdapter`

**Esempio:**
```typescript
const courier = CourierFactory.create('spedisci-online', config);
const quote = await courier.getQuote(shipmentData);
```

#### 3. Adapter Pattern

Adattatori per ogni corriere con interfaccia comune:
- `lib/adapters/couriers/base.ts` - Interfaccia base
- `lib/adapters/couriers/spedisci-online.ts` - Adapter Spedisci.Online
- Ogni adapter implementa metodi: `getQuote()`, `createShipment()`, `track()`

#### 4. Server Actions (Next.js)

Logica server-side type-safe:
- `actions/` - Cartella con server actions
- Autenticazione integrata automatica
- Type-safe con TypeScript

**Esempio:**
```typescript
// actions/automation.ts
export async function toggleAutomation(configId: string) {
  'use server';
  // Logica server-side
}
```

### Flusso Dati Generale

```
1. Utente → Frontend (React/Next.js)
2. Frontend → API Route (/app/api/*)
3. API Route → Server Action (actions/*)
4. Server Action → Database (Supabase)
5. Database → Risposta → Frontend
```

### Architettura Multi-Layer

```
┌─────────────────────────────────────┐
│   PRESENTATION LAYER                │
│   (app/, components/)               │
│   - React Components                 │
│   - Pages                            │
│   - UI Components                    │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   API LAYER                         │
│   (app/api/)                        │
│   - REST Endpoints                   │
│   - Authentication                   │
│   - Validation                       │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   BUSINESS LOGIC LAYER               │
│   (actions/, lib/)                  │
│   - Server Actions                   │
│   - Business Rules                  │
│   - Adapters                         │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   DATA LAYER                        │
│   (lib/db/, lib/supabase.ts)        │
│   - Database Queries                │
│   - Data Access                     │
│   - Encryption/Decryption           │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   DATABASE                          │
│   (Supabase PostgreSQL)             │
│   - Tables                           │
│   - RLS Policies                    │
│   - Realtime                         │
└─────────────────────────────────────┘
```

---

## 5. STRUTTURA FILE E CARTELLE

### Struttura Completa

```
spediresicuro-master/
│
├── app/                              # Next.js App Router
│   ├── api/                          # API Routes (REST endpoints)
│   │   ├── admin/                    # Endpoints admin
│   │   │   ├── overview/             # GET - Panoramica sistema
│   │   │   ├── users/[id]/           # GET/PUT - Gestione utenti
│   │   │   ├── shipments/[id]/      # GET - Dettagli spedizione
│   │   │   ├── features/             # POST - Gestione features
│   │   │   └── create-demo-user/     # POST - Crea utente demo
│   │   │
│   │   ├── auth/                     # Autenticazione
│   │   │   ├── [...nextauth]/        # NextAuth handler
│   │   │   └── register/             # POST - Registrazione
│   │   │
│   │   ├── automation/               # Automation Spedisci.Online
│   │   │   └── spedisci-online/
│   │   │       └── sync/            # POST - Sync manuale
│   │   │
│   │   ├── cron/                     # Cron jobs
│   │   │   └── automation-sync/       # GET - Sync automatico
│   │   │
│   │   ├── user/                     # Endpoints utente
│   │   │   ├── info/                 # GET - Info utente
│   │   │   ├── settings/             # GET/PUT - Impostazioni
│   │   │   └── dati-cliente/         # GET/PUT - Dati cliente
│   │   │
│   │   ├── spedizioni/               # Gestione spedizioni
│   │   │   ├── route.ts              # GET/POST - Lista/Crea
│   │   │   ├── [id]/ldv/             # GET - Genera LDV PDF
│   │   │   └── import/               # POST - Import CSV
│   │   │
│   │   ├── ocr/                      # OCR
│   │   │   └── extract/              # POST - Estrai dati da immagine
│   │   │
│   │   ├── geo/                      # Geocoding
│   │   │   └── search/               # GET - Ricerca indirizzi
│   │   │
│   │   ├── integrazioni/             # Integrazioni e-commerce
│   │   │   ├── route.ts              # GET - Lista integrazioni
│   │   │   └── test/                 # POST - Test integrazione
│   │   │
│   │   └── health/                   # Health check
│   │       └── route.ts              # GET - Status sistema
│   │
│   ├── dashboard/                    # Dashboard protetta
│   │   ├── layout.tsx                # Layout dashboard (auth required)
│   │   ├── page.tsx                  # Dashboard principale
│   │   │
│   │   ├── admin/                    # Dashboard admin
│   │   │   ├── page.tsx              # Overview admin
│   │   │   ├── automation/           # Gestione automation
│   │   │   ├── configurations/       # Gestione configurazioni corrieri
│   │   │   └── users/                # Gestione utenti
│   │   │
│   │   ├── spedizioni/               # Gestione spedizioni
│   │   │   ├── page.tsx              # Lista spedizioni
│   │   │   ├── nuova/                # Crea nuova spedizione
│   │   │   └── [id]/                 # Dettagli spedizione
│   │   │
│   │   ├── integrazioni/             # Integrazioni e-commerce
│   │   ├── impostazioni/             # Impostazioni account
│   │   ├── dati-cliente/             # Dati cliente
│   │   └── team/                     # Gestione team
│   │
│   ├── preventivo/                   # Pagina preventivo pubblico
│   ├── preventivi/                   # Lista preventivi
│   ├── track/[trackingId]/          # Tracking pubblico
│   ├── login/                        # Login
│   ├── contatti/                     # Contatti
│   ├── prezzi/                       # Prezzi
│   │
│   ├── layout.tsx                    # Layout principale (root)
│   ├── page.tsx                      # Homepage
│   ├── globals.css                   # Stili globali
│   ├── error.tsx                     # Error boundary
│   └── not-found.tsx                 # 404 page
│
├── actions/                          # Server Actions Next.js
│   ├── admin.ts                      # Actions admin
│   ├── automation.ts                 # Actions automation
│   ├── configurations.ts              # Actions configurazioni
│   ├── integrations.ts               # Actions integrazioni
│   └── shipments.ts                  # Actions spedizioni
│
├── components/                       # Componenti React
│   ├── ui/                           # Componenti UI base
│   │   ├── card.tsx                  # Card component
│   │   ├── field-tooltip.tsx         # Tooltip per form
│   │   └── async-location-combobox.tsx # Autocomplete indirizzi
│   │
│   ├── homepage/                     # Componenti homepage
│   │   ├── features-section.tsx      # Sezione features
│   │   ├── stats-section.tsx         # Statistiche
│   │   ├── how-it-works.tsx         # Come funziona
│   │   ├── testimonials-section.tsx # Testimonianze
│   │   └── cta-section.tsx          # Call to action
│   │
│   ├── integrazioni/                 # Componenti integrazioni
│   │   ├── integration-card.tsx     # Card integrazione
│   │   ├── integration-dialog.tsx   # Dialog configurazione
│   │   ├── courier-api-config.tsx   # Config corriere
│   │   └── spedisci-online-config.tsx # Config Spedisci.Online
│   │
│   ├── automation/                   # Componenti automation
│   │   └── otp-input-modal.tsx      # Modal input OTP (2FA)
│   │
│   ├── ocr/                          # Componenti OCR
│   │   └── ocr-upload.tsx           # Upload immagine OCR
│   │
│   ├── logo/                         # Logo componenti
│   ├── header.tsx                    # Header sito
│   ├── footer.tsx                     # Footer sito
│   ├── hero-section.tsx              # Hero section homepage
│   ├── dashboard-nav.tsx             # Navigazione dashboard
│   ├── ScannerLDV.tsx                # Scanner LDV
│   ├── ReturnScanner.tsx            # Scanner resi
│   └── providers.tsx                # React providers (context)
│
├── lib/                              # Librerie e utilities
│   ├── adapters/                     # Adattatori esterni
│   │   ├── couriers/                 # Adattatori corrieri
│   │   │   ├── base.ts               # Interfaccia base
│   │   │   ├── index.ts              # Export
│   │   │   └── spedisci-online.ts   # Adapter Spedisci.Online
│   │   │
│   │   ├── ecommerce/                # Adattatori e-commerce
│   │   │   ├── base.ts               # Interfaccia base
│   │   │   ├── index.ts              # Export
│   │   │   ├── woocommerce.ts        # WooCommerce
│   │   │   ├── shopify.ts            # Shopify
│   │   │   ├── magento.ts            # Magento
│   │   │   ├── prestashop.ts         # PrestaShop
│   │   │   └── amazon.ts             # Amazon
│   │   │
│   │   ├── ocr/                      # Adattatori OCR
│   │   │   ├── base.ts               # Interfaccia base
│   │   │   ├── index.ts              # Export
│   │   │   ├── claude.ts             # Anthropic Claude
│   │   │   ├── google-vision.ts      # Google Cloud Vision
│   │   │   ├── tesseract.ts          # Tesseract.js
│   │   │   └── mock.ts               # Mock per test
│   │   │
│   │   ├── export/                   # Export dati
│   │   │   ├── index.ts              # Export
│   │   │   ├── pdf.ts                # Export PDF
│   │   │   ├── csv.ts                # Export CSV
│   │   │   └── xlsx.ts               # Export Excel
│   │   │
│   │   └── social/                   # Social media (futuro)
│   │
│   ├── automation/                   # Automation agent
│   │   └── spedisci-online-agent.ts  # Agent Spedisci.Online
│   │
│   ├── couriers/                     # Factory corrieri
│   │   └── factory.ts                # Factory pattern
│   │
│   ├── db/                           # Database access
│   │   ├── index.ts                  # Export
│   │   ├── client.ts                 # Supabase client
│   │   ├── shipments.ts              # Query spedizioni
│   │   ├── products.ts               # Query prodotti
│   │   ├── warehouses.ts             # Query magazzini
│   │   ├── price-lists.ts            # Query listini
│   │   ├── analytics.ts              # Query analytics
│   │   └── ecommerce.ts              # Query e-commerce
│   │
│   ├── security/                     # Sicurezza
│   │   ├── encryption.ts              # Criptazione AES-256-GCM
│   │   └── audit-log.ts              # Audit logging
│   │
│   ├── engine/                       # Business logic
│   │   └── fulfillment-orchestrator.ts # Orchestratore spedizioni
│   │
│   ├── hooks/                        # React hooks
│   │   └── use-features.ts          # Hook features
│   │
│   ├── monitoring/                   # Monitoring
│   │   └── api-versioning.ts        # Versionamento API
│   │
│   ├── utils/                        # Utilities
│   │   ├── file-parser.ts            # Parser file
│   │   └── ...                       # Altri utilities
│   │
│   ├── auth.ts                       # Configurazione NextAuth
│   ├── auth-config.ts                # Config auth
│   ├── supabase.ts                   # Client Supabase (client-side)
│   ├── supabase-server.ts            # Client Supabase (server-side)
│   ├── database.ts                   # ⚠️ CRITICO: Adapter database
│   ├── database-init.ts              # Inizializzazione database
│   ├── constants.ts                  # Costanti
│   ├── utils.ts                      # Utilities generali
│   └── generate-shipment-document.ts # Generazione documenti
│
├── hooks/                            # React hooks globali
│   └── useRealtimeShipments.ts      # Hook realtime spedizioni
│
├── types/                            # TypeScript types
│   ├── geo.ts                        # Types geocoding
│   └── ...                           # Altri types
│
├── supabase/                         # Database migrations
│   ├── migrations/                   # File SQL migrations
│   │   ├── 001_complete_schema.sql   # Schema base completo
│   │   ├── 002_user_integrations.sql # Integrazioni utente
│   │   ├── 003_user_profiles_mapping.sql # Mapping profili
│   │   ├── 006_roles_and_permissions.sql # Ruoli e permessi
│   │   ├── 008_admin_user_system.sql # Sistema admin
│   │   ├── 010_courier_configs_system.sql # Configurazioni corrieri
│   │   ├── 011_add_ldv_scanner_feature.sql # Feature scanner LDV
│   │   ├── 012_enable_realtime_shipments.sql # Realtime
│   │   ├── 013_security_audit_logs.sql # Audit logging
│   │   ├── 015_extend_courier_configs_session_data.sql # Automation
│   │   ├── 016_automation_locks.sql  # Sistema lock
│   │   └── 017_encrypt_automation_passwords.sql # Criptazione password
│   │
│   └── README_SHIPMENTS.md           # Documentazione shipments
│
├── scripts/                          # Script utility
│   ├── setup-supabase.ts             # Setup iniziale Supabase
│   ├── verify-supabase.ts            # Verifica connessione
│   ├── check-table-structure.ts      # Verifica struttura tabelle
│   ├── fix-schema.ts                  # Fix schema
│   ├── seed-geo.ts                   # Seed dati geografici
│   └── ...                           # Altri script
│
├── public/                           # File statici
│   ├── logo.svg                      # Logo
│   └── ...                           # Altri asset
│
├── data/                             # Dati locali (fallback)
│   ├── database.json                 # Database JSON locale
│   └── database.example.json         # Esempio database
│
├── docs/                             # Documentazione
│   ├── AUTOMATION_SPEDISCI_ONLINE.md # Guida automation
│   ├── SECURITY_CREDENTIALS.md       # Sicurezza credenziali
│   ├── COURIER_CONFIGS_SYSTEM.md     # Sistema configurazioni
│   └── ...                           # Altri documenti
│
├── .env.example                      # Template variabili ambiente
├── .env.local                         # ⚠️ Variabili locali (NON committare)
├── package.json                      # Dipendenze progetto
├── tsconfig.json                     # Configurazione TypeScript
├── tailwind.config.js                # Configurazione Tailwind
├── next.config.js                    # Configurazione Next.js
├── postcss.config.js                 # Configurazione PostCSS
├── vercel.json                       # Configurazione Vercel
├── middleware.ts                     # Next.js middleware (auth)
└── README.md                         # README principale
```

### File Critici da Capire

#### 1. `lib/database.ts` ⚠️ CRITICO
**NON MODIFICARE SENZA ATTENZIONE**

Questo file è l'adapter principale per il database. Gestisce:
- Connessione a Supabase
- Fallback a JSON locale se Supabase non disponibile
- Query base per tutte le tabelle
- Gestione errori

**Struttura:**
```typescript
export const db = {
  shipments: { ... },    // Query spedizioni
  users: { ... },        // Query utenti
  courierConfigs: { ... }, // Query configurazioni corrieri
  // ...
}
```

#### 2. `lib/supabase.ts` e `lib/supabase-server.ts`
- `supabase.ts`: Client per client-side (browser)
- `supabase-server.ts`: Client per server-side (API routes, server actions)

**Differenza chiave:**
- Client-side usa `NEXT_PUBLIC_SUPABASE_ANON_KEY` (pubblica, limitata da RLS)
- Server-side usa `SUPABASE_SERVICE_ROLE_KEY` (privata, bypassa RLS)

#### 3. `lib/security/encryption.ts`
Gestisce criptazione/decrittazione credenziali:
- Algoritmo: AES-256-GCM
- Chiave: `ENCRYPTION_KEY` (variabile d'ambiente)
- Usato per: `api_key`, `api_secret`, password automation

#### 4. `lib/automation/spedisci-online-agent.ts`
Agent per automation Spedisci.Online:
- Browser automation con Puppeteer
- Estrazione session cookies
- Supporto 2FA (email/manuale)
- Gestione lock per conflitti

#### 5. `actions/automation.ts`
Server actions per automation:
- `toggleAutomation()` - Abilita/disabilita
- `saveAutomationSettings()` - Salva configurazione
- `manualSync()` - Sync manuale
- `getAutomationStatus()` - Verifica stato

---

## 6. DATABASE SCHEMA

### Tabelle Principali

#### 1. `users` - Utenti

**Scopo:** Gestione utenti multi-tenant

**Campi principali:**
```sql
id UUID PRIMARY KEY
email TEXT UNIQUE NOT NULL
password TEXT (hash bcrypt, vuoto per OAuth)
name TEXT NOT NULL
role user_role DEFAULT 'user'  -- 'admin', 'user', 'merchant'
provider auth_provider DEFAULT 'credentials'  -- 'credentials', 'google', 'github', 'facebook'
provider_id TEXT  -- ID dal provider OAuth
image TEXT  -- Avatar URL
company_name TEXT
vat_number TEXT  -- P.IVA
phone TEXT
account_type TEXT  -- 'individual', 'company'
assigned_config_id UUID  -- Configurazione corriere assegnata
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
last_login_at TIMESTAMPTZ
```

**Indici:**
- `idx_users_email` su `email`
- `idx_users_role` su `role`
- `idx_users_provider` su `(provider, provider_id)`

**RLS:** ✅ Attivo - Utente vede solo i propri dati (admin vede tutto)

---

#### 2. `courier_configs` - Configurazioni Corrieri

**Scopo:** Configurazioni API corrieri per ogni utente/azienda

**Campi principali:**
```sql
id UUID PRIMARY KEY
name TEXT NOT NULL  -- Nome configurazione
provider_id TEXT NOT NULL  -- 'spedisci-online', 'gls', 'sda', etc.
api_key TEXT  -- Criptato (AES-256-GCM)
api_secret TEXT  -- Criptato (AES-256-GCM)
base_url TEXT
contract_mapping JSONB  -- Mapping contratti
is_active BOOLEAN DEFAULT true
is_default BOOLEAN DEFAULT false  -- Configurazione default per provider

-- Automation Fields (Spedisci.Online)
session_data JSONB  -- Session cookies, CSRF tokens, contract IDs
automation_settings JSONB  -- 2FA, IMAP, credenziali
automation_enabled BOOLEAN DEFAULT false
last_automation_sync TIMESTAMPTZ
session_status TEXT  -- 'active', 'expired', 'error'

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
created_by UUID  -- Utente che ha creato
```

**Indici:**
- `idx_courier_configs_provider` su `provider_id`
- `idx_courier_configs_active` su `is_active`

**RLS:** ✅ Attivo - Solo admin può vedere/modificare

**Criptazione:**
- `api_key` e `api_secret` sono criptati con AES-256-GCM
- Chiave: `ENCRYPTION_KEY` (variabile d'ambiente)
- Decriptazione solo server-side

---

#### 3. `shipments` - Spedizioni

**Scopo:** Gestione spedizioni

**Campi principali:**
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
tracking_number TEXT UNIQUE
ldv TEXT  -- Lettera di Vettura
status shipment_status DEFAULT 'draft'  -- 'draft', 'pending', 'shipped', 'delivered', etc.
courier_code TEXT  -- Codice corriere
courier_name TEXT

-- Mittente
sender_name TEXT
sender_address TEXT
sender_city TEXT
sender_zip TEXT
sender_province TEXT
sender_country TEXT DEFAULT 'IT'
sender_phone TEXT
sender_email TEXT

-- Destinatario
recipient_name TEXT
recipient_address TEXT
recipient_city TEXT
recipient_zip TEXT
recipient_province TEXT
recipient_country TEXT DEFAULT 'IT'
recipient_phone TEXT
recipient_email TEXT

-- Dettagli spedizione
weight_kg DECIMAL(10,2)
dimensions_cm JSONB  -- {length, width, height}
package_type TEXT  -- 'box', 'envelope', 'pallet'
insurance_value DECIMAL(10,2)
cod_amount DECIMAL(10,2)  -- Contrassegno

-- Pricing
base_price DECIMAL(10,2)  -- Prezzo base corriere
margin_percent DECIMAL(5,2)  -- Margine applicato
surcharges DECIMAL(10,2)  -- Surcharge aggiuntivi
final_price DECIMAL(10,2)  -- Prezzo finale cliente

-- Tracking
estimated_delivery_date DATE
actual_delivery_date DATE
delivery_notes TEXT

-- Soft delete
deleted BOOLEAN DEFAULT false
deleted_at TIMESTAMPTZ
deleted_by_user_id UUID

-- Audit
created_by_user_email TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

**Indici:**
- `idx_shipments_user_id` su `user_id`
- `idx_shipments_tracking_number` su `tracking_number`
- `idx_shipments_status` su `status`
- `idx_shipments_courier_code` su `courier_code`

**RLS:** ✅ Attivo - Utente vede solo le proprie spedizioni

**Realtime:** ✅ Abilitato - Aggiornamenti live

---

#### 4. `automation_locks` - Sistema Lock

**Scopo:** Prevenire conflitti tra automation agent e uso manuale

**Campi principali:**
```sql
id UUID PRIMARY KEY
config_id UUID REFERENCES courier_configs(id)
lock_type TEXT NOT NULL  -- 'agent' | 'manual'
locked_by UUID REFERENCES users(id)
reason TEXT  -- Motivo lock
expires_at TIMESTAMPTZ NOT NULL  -- Scadenza lock
created_at TIMESTAMPTZ
```

**Funzionamento:**
- Lock manuale: Utente blocca agent per X minuti
- Lock agent: Agent blocca durante operazioni
- Auto-expire dopo timeout
- Previene conflitti simultanei

---

#### 5. `audit_logs` - Audit Logging

**Scopo:** Tracciamento operazioni sensibili

**Campi principali:**
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
action TEXT NOT NULL  -- 'access_credentials', 'modify_config', 'delete_config', etc.
resource_type TEXT  -- 'courier_config', 'user', etc.
resource_id UUID
details JSONB  -- Dettagli operazione
ip_address TEXT
user_agent TEXT
created_at TIMESTAMPTZ
```

**Eventi tracciati:**
- Accesso a credenziali criptate
- Modifiche configurazioni
- Eliminazioni
- Decriptazioni
- Login/logout

---

#### 6. `killer_features` - Catalogo Features

**Scopo:** Sistema feature flags

**Campi principali:**
```sql
id UUID PRIMARY KEY
code TEXT UNIQUE NOT NULL  -- 'ocr_scan', 'api_access', etc.
name TEXT NOT NULL
description TEXT
category TEXT  -- 'automation', 'integration', 'analytics', 'premium'
price_monthly_cents INTEGER
price_yearly_cents INTEGER
is_free BOOLEAN DEFAULT false
is_available BOOLEAN DEFAULT true
display_order INTEGER
created_at TIMESTAMPTZ
```

---

#### 7. `user_features` - Utente ↔ Feature

**Scopo:** Associazione utente-feature

**Campi principali:**
```sql
id UUID PRIMARY KEY
user_email TEXT NOT NULL
feature_id UUID REFERENCES killer_features(id)
is_active BOOLEAN DEFAULT true
expires_at TIMESTAMPTZ  -- Scadenza feature
activation_type TEXT  -- 'free', 'paid', 'trial', 'admin_grant', 'subscription'
created_at TIMESTAMPTZ
```

---

### Relazioni tra Tabelle

```
users (1) ──→ (N) shipments
users (1) ──→ (N) courier_configs (created_by)
courier_configs (1) ──→ (N) automation_locks
users (1) ──→ (N) audit_logs
users (N) ──→ (N) killer_features (tramite user_features)
```

---

### Migrations

**Ordine di esecuzione (IMPORTANTE):**

1. `001_complete_schema.sql` - Schema base completo
2. `002_user_integrations.sql` - Integrazioni utente
3. `003_user_profiles_mapping.sql` - Mapping profili NextAuth ↔ Supabase
4. `006_roles_and_permissions.sql` - Ruoli e permessi
5. `008_admin_user_system.sql` - Sistema admin
6. `010_courier_configs_system.sql` - Sistema configurazioni corrieri
7. `011_add_ldv_scanner_feature.sql` - Feature scanner LDV
8. `012_enable_realtime_shipments.sql` - Realtime spedizioni
9. `013_security_audit_logs.sql` - Audit logging
10. `015_extend_courier_configs_session_data.sql` - Estensione automation
11. `016_automation_locks.sql` - Sistema lock
12. `017_encrypt_automation_passwords.sql` - Criptazione password automation

**⚠️ IMPORTANTE:** Eseguire migrations in ordine numerico!

---

## 7. API ENDPOINTS

### Autenticazione

#### `POST /api/auth/register`
Registrazione nuovo utente

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "Nome Utente"
}
```

**Response:**
```json
{
  "success": true,
  "user": { ... }
}
```

---

#### `GET /api/auth/[...nextauth]`
NextAuth handler (login, logout, session, callback OAuth)

**Endpoints automatici:**
- `GET /api/auth/signin` - Pagina login
- `POST /api/auth/signin` - Login
- `POST /api/auth/signout` - Logout
- `GET /api/auth/session` - Session corrente
- `GET /api/auth/callback/google` - Callback Google OAuth
- `GET /api/auth/callback/github` - Callback GitHub OAuth

---

### Admin APIs

#### `GET /api/admin/overview`
Panoramica completa sistema (solo admin)

**Response:**
```json
{
  "users": { "total": 100, "active": 80 },
  "shipments": { "total": 500, "pending": 20 },
  "configs": { "total": 10, "active": 8 }
}
```

---

#### `GET /api/admin/users/[id]`
Dettagli utente specifico

**Response:**
```json
{
  "user": { ... },
  "shipments": [ ... ],
  "features": [ ... ]
}
```

---

#### `GET /api/admin/shipments/[id]`
Dettagli spedizione specifica

---

#### `POST /api/admin/features`
Gestione features utente

**Body:**
```json
{
  "userEmail": "user@example.com",
  "featureCode": "ocr_scan",
  "action": "activate" | "deactivate"
}
```

---

### User APIs

#### `GET /api/user/info`
Informazioni utente corrente

**Response:**
```json
{
  "user": { ... },
  "features": [ ... ],
  "assignedConfig": { ... }
}
```

---

#### `GET /api/user/settings`
Impostazioni utente

#### `PUT /api/user/settings`
Aggiorna impostazioni

**Body:**
```json
{
  "name": "Nuovo Nome",
  "phone": "+39 123 456 7890"
}
```

---

#### `GET /api/user/dati-cliente`
Dati cliente (mittente predefinito)

#### `PUT /api/user/dati-cliente`
Aggiorna dati cliente

**Body:**
```json
{
  "name": "Nome Azienda",
  "address": "Via Example 123",
  "city": "Milano",
  "zip": "20100",
  "vat": "IT12345678901"
}
```

---

### Automation APIs

#### `POST /api/automation/spedisci-online/sync`
Sync manuale automation Spedisci.Online

**Body:**
```json
{
  "configId": "uuid-config",
  "otp": "123456"  // Opzionale, se 2FA manuale
}
```

**Response:**
```json
{
  "success": true,
  "sessionStatus": "active",
  "expiresAt": "2025-12-04T10:00:00Z"
}
```

---

#### `GET /api/cron/automation-sync`
Cron job sync automatico (chiamato da Vercel Cron)

**Query params:**
- `configId` (opzionale) - Se specificato, sync solo quella config

---

### Shipments APIs

#### `GET /api/spedizioni`
Lista spedizioni utente corrente

**Query params:**
- `status` - Filtra per status
- `page` - Paginazione
- `limit` - Limite risultati

**Response:**
```json
{
  "shipments": [ ... ],
  "total": 100,
  "page": 1
}
```

---

#### `POST /api/spedizioni`
Crea nuova spedizione

**Body:**
```json
{
  "sender": { ... },
  "recipient": { ... },
  "weight": 2.5,
  "dimensions": { "length": 30, "width": 20, "height": 15 },
  "courierCode": "gls",
  "insuranceValue": 100
}
```

**Response:**
```json
{
  "success": true,
  "shipment": { ... },
  "quote": {
    "basePrice": 10.00,
    "margin": 15.00,
    "finalPrice": 11.50
  }
}
```

---

#### `GET /api/spedizioni/[id]`
Dettagli spedizione

---

#### `GET /api/spedizioni/[id]/ldv`
Genera LDV (Lettera di Vettura) in PDF

**Response:** PDF file (binary)

---

#### `POST /api/spedizioni/import`
Import spedizioni da CSV

**Body:** FormData con file CSV

**Response:**
```json
{
  "success": true,
  "imported": 50,
  "errors": [ ... ]
}
```

---

### OCR APIs

#### `POST /api/ocr/extract`
Estrai dati da immagine (screenshot WhatsApp)

**Body:** FormData con file immagine

**Response:**
```json
{
  "success": true,
  "data": {
    "recipientName": "Mario Rossi",
    "address": "Via Example 123",
    "city": "Milano",
    "zip": "20100",
    "phone": "+39 123 456 7890"
  }
}
```

---

### Geo APIs

#### `GET /api/geo/search`
Ricerca indirizzi (autocomplete)

**Query params:**
- `q` - Query ricerca
- `country` - Paese (default: 'IT')

**Response:**
```json
{
  "results": [
    {
      "address": "Via Example 123",
      "city": "Milano",
      "zip": "20100",
      "province": "MI",
      "country": "IT"
    }
  ]
}
```

---

### Integrations APIs

#### `GET /api/integrazioni`
Lista integrazioni disponibili

**Response:**
```json
{
  "integrations": [
    {
      "id": "woocommerce",
      "name": "WooCommerce",
      "status": "available",
      "configured": false
    }
  ]
}
```

---

#### `POST /api/integrazioni/test`
Test connessione integrazione

**Body:**
```json
{
  "type": "woocommerce",
  "config": {
    "url": "https://store.example.com",
    "apiKey": "xxx",
    "apiSecret": "xxx"
  }
}
```

---

### Health Check

#### `GET /api/health`
Health check sistema

**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2025-12-03T10:00:00Z"
}
```

---

## 8. COMPONENTI PRINCIPALI

### Frontend Components

#### `components/hero-section.tsx`
Hero section homepage con CTA

**Props:**
- `variant?: 'brand' | 'tech-trust' | 'energy-professional' | 'modern-minimal'`

**Funzionalità:**
- Headline animata con gradiente
- CTA buttons (Primario: /preventivo, Secondario: /come-funziona)
- Social proof (statistiche, rating)
- Mockup animato (screenshot WhatsApp → etichetta)

---

#### `components/dashboard-nav.tsx`
Navigazione dashboard con breadcrumbs

**Props:**
- `title: string`
- `subtitle?: string`
- `breadcrumbs?: Array<{label: string, href: string}>`
- `actions?: ReactNode` - Azioni custom
- `showBackButton?: boolean`

**Funzionalità:**
- Breadcrumbs navigazione
- Pulsante back
- Azioni custom (es. "Nuova Spedizione")
- Mobile quick links

---

#### `components/integrazioni/integration-card.tsx`
Card integrazione e-commerce

**Props:**
- `integration: Integration`
- `onConfigure: () => void`
- `onTest: () => void`

**Funzionalità:**
- Mostra status integrazione
- Pulsante configura
- Pulsante test connessione
- Badge status (connected, disconnected, error)

---

#### `components/automation/otp-input-modal.tsx`
Modal input OTP per 2FA manuale

**Props:**
- `open: boolean`
- `onClose: () => void`
- `onSubmit: (otp: string) => Promise<void>`

**Funzionalità:**
- Input 6 cifre OTP
- Validazione formato
- Submit con loading state

---

#### `components/ocr/ocr-upload.tsx`
Upload immagine per OCR

**Funzionalità:**
- Drag & drop immagine
- Preview immagine
- Estrazione dati con AI
- Mostra risultati estratti

---

### Backend Components

#### `lib/automation/spedisci-online-agent.ts`
Agent automation Spedisci.Online

**Classe:** `SpedisciOnlineAgent`

**Metodi principali:**
- `async login(credentials, twoFactorMethod): Promise<SessionData>`
- `async extractSessionData(): Promise<SessionData>`
- `async refreshSession(): Promise<SessionData>`
- `async readOTPFromEmail(imapConfig): Promise<string>`

**Flusso:**
1. Apre browser con Puppeteer
2. Naviga a Spedisci.Online
3. Esegue login con credenziali
4. Se 2FA email: legge codice da IMAP
5. Se 2FA manuale: richiede OTP all'utente
6. Estrae session cookies, CSRF token, contract IDs
7. Salva in `courier_configs.session_data`

---

#### `lib/couriers/factory.ts`
Factory per creare adapter corrieri

**Funzione:**
```typescript
export function createCourierAdapter(
  providerId: string,
  config: CourierConfig
): CourierAdapter
```

**Provider supportati:**
- `'spedisci-online'` → `SpedisciOnlineAdapter`
- `'gls'` → `GLSAdapter`
- `'sda'` → `SDAAdapter`
- `'poste'` → `PosteItalianeAdapter`
- `'bartolini'` → `BartoliniAdapter`
- `'dhl'` → `DHLAdapter`

---

#### `lib/security/encryption.ts`
Criptazione/decrittazione credenziali

**Funzioni:**
- `encrypt(text: string): string` - Cripta testo
- `decrypt(encryptedText: string): string` - Decripta testo

**Algoritmo:** AES-256-GCM
**Chiave:** `ENCRYPTION_KEY` (variabile d'ambiente, 64 caratteri hex)

**⚠️ IMPORTANTE:**
- Chiave OBBLIGATORIA in produzione
- Senza chiave, credenziali salvate in chiaro
- Chiave NON committare mai nel repository

---

#### `lib/security/audit-log.ts`
Audit logging operazioni sensibili

**Funzione:**
```typescript
export async function logAuditEvent(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details?: Record<string, any>
): Promise<void>
```

**Eventi tracciati:**
- `'access_credentials'` - Accesso a credenziali
- `'modify_config'` - Modifica configurazione
- `'delete_config'` - Eliminazione configurazione
- `'decrypt_credentials'` - Decriptazione credenziali

---

## 9. FLUSSI DI LAVORO

### Flusso: Creazione Spedizione

```
1. Utente → /dashboard/spedizioni/nuova
2. Compila form (mittente, destinatario, peso, dimensioni)
3. Seleziona corriere
4. Click "Calcola Preventivo"
   ↓
5. Frontend → POST /api/spedizioni
   ↓
6. API Route → Server Action createShipment()
   ↓
7. Server Action:
   - Valida dati
   - Recupera configurazione corriere (courier_configs)
   - Decripta credenziali API (se necessario)
   - Chiama adapter corriere → getQuote()
   - Applica margine configurabile
   - Calcola prezzo finale
   ↓
8. Salva spedizione in database (shipments)
   ↓
9. Response → Frontend
   ↓
10. Mostra preventivo all'utente
11. Utente conferma → Crea spedizione
```

---

### Flusso: Automation Spedisci.Online

```
1. Admin → /dashboard/admin/automation
2. Configura automation:
   - Credenziali Spedisci.Online (email, password)
   - Metodo 2FA (email IMAP o manuale)
   - Se IMAP: configurazione IMAP (host, port, user, password)
3. Click "Abilita Automation"
   ↓
4. Frontend → Server Action toggleAutomation()
   ↓
5. Server Action:
   - Cripta password Spedisci.Online
   - Cripta password IMAP (se IMAP)
   - Salva in courier_configs.automation_settings
   - Imposta automation_enabled = true
   ↓
6. Click "Sync Manuale" (o cron automatico)
   ↓
7. Frontend → POST /api/automation/spedisci-online/sync
   ↓
8. API Route → SpedisciOnlineAgent.login()
   ↓
9. Agent:
   - Apre browser Puppeteer
   - Naviga a Spedisci.Online
   - Esegue login
   - Se 2FA email: legge codice da IMAP
   - Se 2FA manuale: richiede OTP all'utente
   - Estrae session cookies, CSRF token, contract IDs
   ↓
10. Salva session_data in courier_configs
11. Imposta session_status = 'active'
12. Imposta last_automation_sync = NOW()
   ↓
13. Response → Frontend
14. Mostra stato session (attiva, scade tra X ore)
```

---

### Flusso: OCR da Screenshot

```
1. Utente → /dashboard/spedizioni/nuova
2. Click "Carica Screenshot WhatsApp"
3. Upload immagine
   ↓
4. Frontend → POST /api/ocr/extract
   ↓
5. API Route:
   - Riceve file immagine
   - Chiama adapter OCR (Claude, Google Vision, o Tesseract)
   ↓
6. OCR Adapter:
   - Analizza immagine
   - Estrae testo con AI
   - Parsa dati (nome, indirizzo, città, CAP, telefono)
   ↓
7. Response → Frontend
   ↓
8. Pre-compila form con dati estratti
9. Utente verifica e modifica se necessario
```

---

### Flusso: Generazione LDV

```
1. Utente → /dashboard/spedizioni/[id]
2. Click "Genera LDV"
   ↓
3. Frontend → GET /api/spedizioni/[id]/ldv
   ↓
4. API Route:
   - Recupera spedizione da database
   - Genera PDF con jsPDF
   - Inserisce dati: mittente, destinatario, tracking, barcode
   ↓
5. Response → PDF file (binary)
   ↓
6. Browser scarica PDF
```

---

## 10. SICUREZZA

### Livelli di Protezione

#### 1. Criptazione Credenziali

**Algoritmo:** AES-256-GCM
**Chiave:** `ENCRYPTION_KEY` (variabile d'ambiente, 64 caratteri hex)

**Campi criptati:**
- `courier_configs.api_key`
- `courier_configs.api_secret`
- `courier_configs.automation_settings.imap_password`
- `courier_configs.automation_settings.spedisci_online_password`

**Implementazione:**
- File: `lib/security/encryption.ts`
- Funzioni: `encrypt()`, `decrypt()`
- Chiave MAI nel codice, solo variabile d'ambiente

**⚠️ CRITICO:**
- Chiave OBBLIGATORIA in produzione
- Senza chiave, credenziali salvate in chiaro
- Chiave NON committare mai

---

#### 2. Row Level Security (RLS)

**Attivo su tutte le tabelle sensibili:**
- `users` - Utente vede solo i propri dati (admin vede tutto)
- `courier_configs` - Solo admin può vedere/modificare
- `shipments` - Utente vede solo le proprie spedizioni
- `audit_logs` - Solo admin può vedere

**Policies esempio (users):**
```sql
-- Utente vede solo i propri dati
CREATE POLICY "Users can view own data"
ON users FOR SELECT
USING (auth.uid()::text = id::text OR 
       (SELECT role FROM users WHERE id = auth.uid()::uuid) = 'admin');

-- Admin vede tutto
CREATE POLICY "Admins can view all"
ON users FOR SELECT
USING ((SELECT role FROM users WHERE id = auth.uid()::uuid) = 'admin');
```

---

#### 3. Autenticazione

**Provider:** NextAuth.js v5

**Metodi supportati:**
- Credentials (email/password)
- Google OAuth
- GitHub OAuth
- Facebook OAuth (opzionale)

**Session:**
- JWT-based
- Scadenza: 30 giorni
- Refresh automatico

**Protezione route:**
- Middleware su tutte le route `/dashboard/*`
- Verifica session prima di renderizzare

**File chiave:**
- `lib/auth.ts` - Configurazione NextAuth
- `middleware.ts` - Protezione route

---

#### 4. Audit Logging

**Tabella:** `audit_logs`

**Eventi tracciati:**
- `'access_credentials'` - Accesso a credenziali criptate
- `'modify_config'` - Modifica configurazione
- `'delete_config'` - Eliminazione configurazione
- `'decrypt_credentials'` - Decriptazione credenziali
- `'login'` - Login utente
- `'logout'` - Logout utente

**Dettagli salvati:**
- User ID
- Action
- Resource type/ID
- IP address
- User agent
- Timestamp

**File:** `lib/security/audit-log.ts`

---

#### 5. Server-Side Only

**Password MAI inviate al client:**
- Decriptazione SOLO server-side
- Client riceve solo dati non sensibili
- API routes verificano autenticazione

**Esempio:**
```typescript
// ❌ SBAGLIATO - Password nel client
const decrypted = decrypt(encryptedPassword); // Nel browser

// ✅ CORRETTO - Decriptazione server-side
// API Route
const decrypted = decrypt(encryptedPassword); // Nel server
return { success: true }; // Non invia password
```

---

### Variabili d'Ambiente Critiche

```env
# Database
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # Pubblica, limitata da RLS
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # ⚠️ SOLO server-side, bypassa RLS

# Sicurezza
ENCRYPTION_KEY=64-char-hex-key  # ⚠️ OBBLIGATORIA in produzione
NEXTAUTH_SECRET=random-secret
NEXTAUTH_URL=https://tuo-sito.vercel.app

# OAuth
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx

# App
NEXT_PUBLIC_APP_URL=https://tuo-sito.vercel.app
NEXT_PUBLIC_DEFAULT_MARGIN=15
```

---

## 11. INTEGRAZIONI

### Corrieri Supportati

#### Spedisci.Online
- **Adapter:** `lib/adapters/couriers/spedisci-online.ts`
- **Automation:** ✅ Supportata (browser automation)
- **Metodi:** `getQuote()`, `createShipment()`, `track()`

#### GLS
- **Adapter:** `lib/adapters/couriers/gls.ts` (da implementare)
- **API:** GLS API (se disponibile)

#### SDA (Bartolini)
- **Adapter:** `lib/adapters/couriers/sda.ts` (da implementare)

#### Poste Italiane
- **Adapter:** `lib/adapters/couriers/poste.ts` (da implementare)

#### DHL
- **Adapter:** `lib/adapters/couriers/dhl.ts` (da implementare)

---

### E-commerce Supportati

#### WooCommerce
- **Adapter:** `lib/adapters/ecommerce/woocommerce.ts`
- **Metodi:** `getOrders()`, `updateOrderStatus()`, `syncShipments()`

#### Shopify
- **Adapter:** `lib/adapters/ecommerce/shopify.ts`
- **Metodi:** `getOrders()`, `updateOrderStatus()`, `syncShipments()`

#### Magento
- **Adapter:** `lib/adapters/ecommerce/magento.ts`

#### PrestaShop
- **Adapter:** `lib/adapters/ecommerce/prestashop.ts`

#### Amazon
- **Adapter:** `lib/adapters/ecommerce/amazon.ts`

---

### OCR Providers

#### Anthropic Claude
- **Adapter:** `lib/adapters/ocr/claude.ts`
- **Status:** ✅ Attivo
- **Costo:** Pay-per-use

#### Google Cloud Vision
- **Adapter:** `lib/adapters/ocr/google-vision.ts`
- **Status:** ⚠️ Configurato ma non attivo (billing non abilitato)
- **Costo:** ~$1.50 per 1000 immagini

#### Tesseract.js
- **Adapter:** `lib/adapters/ocr/tesseract.ts`
- **Status:** ✅ Attivo (fallback)
- **Costo:** Gratuito (locale)

---

## 12. CONFIGURAZIONE

### Setup Iniziale

#### 1. Clona Repository

```bash
git clone https://github.com/gdsgroupsas-jpg/spediresicuro.git
cd spediresicuro
```

#### 2. Installa Dipendenze

```bash
npm install
```

#### 3. Configura Variabili d'Ambiente

Copia `.env.example` in `.env.local`:

```bash
copy .env.example .env.local
```

Compila `.env.local` con i tuoi valori.

---

### Configurazione Supabase

#### 1. Crea Progetto Supabase

1. Vai su [https://app.supabase.com](https://app.supabase.com)
2. Crea nuovo progetto
3. Salva URL e chiavi

#### 2. Esegui Migrations

Esegui migrations in ordine numerico:

1. `001_complete_schema.sql`
2. `002_user_integrations.sql`
3. `003_user_profiles_mapping.sql`
4. `006_roles_and_permissions.sql`
5. `008_admin_user_system.sql`
6. `010_courier_configs_system.sql`
7. `011_add_ldv_scanner_feature.sql`
8. `012_enable_realtime_shipments.sql`
9. `013_security_audit_logs.sql`
10. `015_extend_courier_configs_session_data.sql`
11. `016_automation_locks.sql`
12. `017_encrypt_automation_passwords.sql`

**Come eseguire:**
- Vai su Supabase Dashboard → SQL Editor
- Incolla contenuto migration
- Esegui

#### 3. Configura RLS

RLS è già configurato nelle migrations, ma verifica:
- Supabase Dashboard → Authentication → Policies
- Verifica che policies siano attive

---

### Generazione Chiavi

#### ENCRYPTION_KEY

```bash
# Genera chiave sicura (64 caratteri hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**⚠️ IMPORTANTE:**
- Salva chiave in modo sicuro
- NON committare mai
- Senza chiave, credenziali non possono essere decriptate

#### NEXTAUTH_SECRET

```bash
# Genera secret NextAuth
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

### Configurazione OAuth (Opzionale)

#### Google OAuth

1. Vai su [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Crea OAuth 2.0 Client ID
3. Aggiungi callback URL:
   - Sviluppo: `http://localhost:3000/api/auth/callback/google`
   - Produzione: `https://tuo-sito.vercel.app/api/auth/callback/google`
4. Copia `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` in `.env.local`

#### GitHub OAuth

1. Vai su [GitHub Settings → Developers → OAuth Apps](https://github.com/settings/developers)
2. Crea nuova OAuth App
3. Aggiungi callback URL:
   - Sviluppo: `http://localhost:3000/api/auth/callback/github`
   - Produzione: `https://tuo-sito.vercel.app/api/auth/callback/github`
4. Copia `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET` in `.env.local`

---

### Avvio Sviluppo

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000)

---

## 13. DEPLOY

### Deploy su Vercel

#### 1. Collega Repository

1. Vai su [vercel.com](https://vercel.com)
2. Clicca "New Project"
3. Seleziona repository `spediresicuro`
4. Vercel rileva automaticamente Next.js

#### 2. Configura Variabili d'Ambiente

Vercel Dashboard → Settings → Environment Variables

Aggiungi tutte le variabili da `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY` ⚠️ **CRITICA**
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (se OAuth)
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` (se OAuth)

**⚠️ NON includere `NODE_ENV`** (Vercel lo gestisce automaticamente)

#### 3. Configurazione Vercel

File `vercel.json`:
```json
{
  "functions": {
    "app/api/automation/**/*.ts": {
      "maxDuration": 300
    },
    "app/api/cron/**/*.ts": {
      "maxDuration": 300
    }
  }
}
```

**Spiegazione:**
- Automation routes richiedono più tempo (Puppeteer)
- Timeout aumentato a 300 secondi

#### 4. Deploy

**Automatico:**
- Ogni push su `master` → Deploy automatico

**Manuale:**
- Vercel Dashboard → Deploy

#### 5. URL Deploy

Vercel fornisce URL tipo:
- `spediresicuro.vercel.app`
- Puoi aggiungere dominio custom

---

### Configurazione Cron Jobs (Opzionale)

Per sync automatico automation:

1. Vercel Dashboard → Cron Jobs
2. Crea nuovo cron:
   - Path: `/api/cron/automation-sync`
   - Schedule: `0 */6 * * *` (ogni 6 ore)
   - Method: GET

---

## 14. TROUBLESHOOTING

### Problemi Comuni

#### 1. "Cannot find module"

**Soluzione:**
```bash
rm -rf node_modules package-lock.json
npm install
```

---

#### 2. "Invalid API key" (Supabase)

**Cause:**
- Chiavi errate in `.env.local`
- Spazi extra nelle chiavi
- Chiave incompleta

**Soluzione:**
- Verifica che chiavi siano corrette
- Copia chiavi complete (no spazi)
- Riavvia server sviluppo

---

#### 3. "Port 3000 already in use"

**Soluzione:**
```bash
npm run dev -- -p 3001
```

---

#### 4. "Encryption key missing"

**Errore:** Credenziali non possono essere decriptate

**Soluzione:**
- Verifica che `ENCRYPTION_KEY` sia in `.env.local`
- Chiave deve essere 64 caratteri hex
- Riavvia server

---

#### 5. Puppeteer su Vercel non funziona

**Errore:** Timeout o errori Puppeteer

**Soluzione:**
- Verifica `vercel.json` con timeout aumentato
- Puppeteer richiede args speciali (già configurati in agent)

---

#### 6. RLS blocca query

**Errore:** "Row Level Security policy violation"

**Soluzione:**
- Verifica che utente sia autenticato
- Verifica policies RLS in Supabase
- Se admin, verifica che `role = 'admin'` in database

---

### Debug

#### Log Server-Side

Aggiungi log in API routes:
```typescript
console.log('Debug:', { data });
```

Vedi log in:
- Sviluppo: Terminale
- Produzione: Vercel Dashboard → Functions → Logs

#### Log Client-Side

Aggiungi log in componenti:
```typescript
console.log('Debug:', { data });
```

Vedi log in:
- Browser DevTools → Console

---

## 📚 RISORSE AGGIUNTIVE

### Documentazione Disponibile

- `README.md` - README principale
- `RIEPILOGO_COMPLETO_PIATTAFORMA.md` - Riepilogo tecnico completo
- `docs/AUTOMATION_SPEDISCI_ONLINE.md` - Guida automation
- `docs/SECURITY_CREDENTIALS.md` - Sicurezza credenziali
- `docs/COURIER_CONFIGS_SYSTEM.md` - Sistema configurazioni

### Link Utili

- **Repository:** https://github.com/gdsgroupsas-jpg/spediresicuro.git
- **Next.js Docs:** https://nextjs.org/docs
- **Supabase Docs:** https://supabase.com/docs
- **Tailwind CSS Docs:** https://tailwindcss.com/docs
- **NextAuth Docs:** https://next-auth.js.org/

---

## ✅ CHECKLIST SETUP COMPLETO

Prima di iniziare a sviluppare, verifica:

- [ ] Repository clonato
- [ ] Dipendenze installate (`npm install`)
- [ ] File `.env.local` creato e configurato
- [ ] Supabase configurato (progetto creato, migrations eseguite)
- [ ] `ENCRYPTION_KEY` generata e configurata
- [ ] `NEXTAUTH_SECRET` generato e configurato
- [ ] Server sviluppo avviato (`npm run dev`)
- [ ] Homepage visibile su `http://localhost:3000`
- [ ] Database connesso (verifica in Supabase Dashboard)
- [ ] RLS policies attive (verifica in Supabase Dashboard)

**Se tutti i punti sono spuntati, sei pronto per sviluppare! 🎉**

---

**Documento generato:** 2025-12-03  
**Versione:** 1.0.0  
**Per:** Google Gemini AI  
**Scopo:** Analisi completa progetto SpedireSicuro.it

