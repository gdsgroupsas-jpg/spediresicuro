# 🚀 SpediReSicuro.it

**Piattaforma SaaS per gestione intelligente delle spedizioni con ricarico**

> Da screenshot WhatsApp a spedizione prenotata in 30 secondi

---

## 📋 Indice

- [Panoramica](#-panoramica)
- [Stack Tecnologico](#-stack-tecnologico)
- [Funzionalità Implementate](#-funzionalità-implementate)
- [Installazione e Setup](#-installazione-e-setup)
- [Struttura Progetto](#-struttura-progetto)
- [API Disponibili](#-api-disponibili)
- [Database](#-database)
- [Autenticazione](#-autenticazione)
- [Deploy](#-deploy)
- [Convenzioni Codice](#-convenzioni-codice)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Panoramica

**SpediReSicuro** è una piattaforma innovativa che rivoluziona la gestione delle spedizioni attraverso:

- ✅ **OCR AI-powered** per estrazione automatica dati da screenshot WhatsApp/LDV
- ✅ **Gestione multi-corriere** (GLS, SDA, Bartolini) con prezzi dinamici
- ✅ **Sistema di margini personalizzabili** per rivendita
- ✅ **Geocoding automatico** per validazione indirizzi italiani
- ✅ **Export documenti** professionali (PDF, CSV, XLSX)
- ✅ **Autenticazione OAuth** (Google, GitHub, Facebook)
- ✅ **Dashboard completa** con statistiche e filtri avanzati

### 💡 Proposta di Valore

**Problema risolto:**
- Agenzie perdono 15-20 minuti per spedizione digitando dati manualmente
- Errori di trascrizione → mancate consegne → costi extra
- Confronto prezzi corrieri manuale e lento

**Soluzione:**
- **90% riduzione tempo** inserimento dati (30 sec vs 20 min)
- **Zero errori** trascrizione grazie a OCR AI
- **Confronto prezzi istantaneo** tra corrieri
- **Margini automatici** per rivendita

---

## 🛠️ Stack Tecnologico

### Frontend
- **Next.js 14** - Framework React con App Router
- **TypeScript** - Type safety end-to-end
- **Tailwind CSS** - Styling utility-first
- **Framer Motion** - Animazioni fluide
- **Lucide React** - Icone moderne

### Backend
- **Next.js API Routes** - Serverless functions
- **NextAuth v5** - Autenticazione OAuth
- **Supabase** - Database PostgreSQL (schema pronto)
- **Database JSON locale** - Fallback per sviluppo

### Integrazioni
- **Anthropic Claude** - OCR AI (opzionale)
- **Google Cloud Vision** - OCR alternativo (opzionale)
- **Tesseract.js** - OCR locale (opzionale)

### Export
- **jsPDF** - Generazione PDF
- **XLSX** - Export Excel
- **CSV** - Export dati

---

## ✨ Funzionalità Implementate

### 1. 🏠 Homepage & Landing
- ✅ Hero section con CTA
- ✅ Sezioni: Stats, Features, How It Works, Testimonials
- ✅ Design responsive e moderno
- ✅ SEO ottimizzato

### 2. 🔐 Autenticazione
- ✅ Login/Registrazione con email/password
- ✅ OAuth Google, GitHub, Facebook
- ✅ Session management con NextAuth v5
- ✅ Protezione route dashboard
- ✅ Utenti demo disponibili solo in modalità sviluppo (password gestite in modo sicuro)

### 3. 📊 Dashboard
- ✅ Dashboard principale con statistiche
- ✅ Navigazione tra sezioni
- ✅ Widget informativi
- ✅ Design glassmorphism

### 4. 📦 Gestione Spedizioni

#### Crea Spedizione (`/dashboard/spedizioni/nuova`)
- ✅ Form completo con validazione real-time
- ✅ Autocompletamento mittente predefinito
- ✅ Geocoding automatico (ricerca comuni italiani)
- ✅ Calcolo automatico prezzi con margine
- ✅ Generazione tracking number automatico
- ✅ AI Routing Advisor (suggerimento corriere ottimale)
- ✅ OCR upload per estrazione dati da immagini
- ✅ Preview ticket spedizione live
- ✅ Download PDF/CSV automatico dopo creazione

#### Lista Spedizioni (`/dashboard/spedizioni`)
- ✅ Tabella completa con tutte le informazioni
- ✅ Filtri avanzati:
  - Ricerca per destinatario, tracking, città
  - Filtro per status (tutte, in transito, consegnate, ecc.)
  - Filtro per data (oggi, settimana, mese, range personalizzato)
- ✅ Export CSV con tutti i dati
- ✅ Badge status colorati
- ✅ Link tracking esterni ai corrieri
- ✅ Soft delete con conferma

#### Dettaglio Spedizione (`/dashboard/spedizioni/[id]`)
- ✅ Visualizzazione completa dati spedizione
- ✅ Timeline eventi tracking
- ✅ Download LDV (Lettera di Vettura) PDF
- ✅ Modifica dati (da implementare)

### 5. 🔍 OCR (Optical Character Recognition)

#### Upload Immagine
- ✅ Drag & drop upload
- ✅ Preview immagine
- ✅ Estrazione automatica:
  - Nome destinatario
  - Indirizzo completo
  - CAP, Città, Provincia
  - Telefono (normalizzato +39)
  - Email
- ✅ Pre-popolamento form automatico
- ✅ Confidence score

#### Adapter Disponibili
- ✅ **Mock OCR** - Dati realistici per sviluppo (attivo di default)
- ✅ **Claude Vision** - OCR AI reale (richiede `ANTHROPIC_API_KEY`)
- ⚙️ **Tesseract.js** - OCR locale (skeleton pronto)

**Costi OCR Claude:**
- ~$0.003-0.005 per immagine
- 100 test ≈ $0.30-0.50

### 6. 🗺️ Geocoding & Ricerca Comuni
- ✅ Ricerca comuni italiani in tempo reale
- ✅ Autocompletamento con debounce (300ms)
- ✅ Supporto multi-CAP (se comune ha più CAP)
- ✅ Validazione automatica CAP/Provincia
- ✅ API: `/api/geo/search`

### 7. 💰 Calcolo Preventivi
- ✅ Calcolo prezzi multi-corriere
- ✅ Confronto prezzi istantaneo
- ✅ Margine configurabile
- ✅ Calcolo peso volumetrico
- ✅ Supplementi (express, assicurazione)

### 8. 📄 Export Documenti
- ✅ **PDF** - Lettera di Vettura professionale
- ✅ **CSV** - Export dati per Excel
- ✅ **XLSX** - Export Excel formattato
- ✅ Filename con timestamp automatico

### 9. ⚙️ Impostazioni Utente
- ✅ Configurazione mittente predefinito
- ✅ Salvataggio preferenze
- ✅ Autocompletamento automatico in nuove spedizioni

### 10. 🔗 Integrazioni E-commerce
- ✅ **Shopify** - Completo (REST API + GraphQL, Webhooks)
- ✅ **WooCommerce** - Completo (REST API, Webhooks)
- ⚙️ **Amazon SP-API** - Skeleton (da completare)
- ⚙️ **Magento** - Skeleton (da completare)
- ⚙️ **PrestaShop** - Skeleton (da completare)

**Features comuni:**
- Fetch ordini con filtri
- Push tracking info
- Sync prodotti e inventory
- Webhooks setup
- Retry logic + rate limiting

### 11. 🧠 AI Routing Advisor
- ✅ Analisi performance corrieri per zona
- ✅ Suggerimento corriere ottimale
- ✅ Calcolo qualità consegna
- ✅ Confronto costi/tempi

### 12. 📈 Analytics & Tracking
- ✅ Audit trail completo (chi ha creato/modificato/eliminato)
- ✅ Timestamp tutte le azioni
- ✅ Soft delete con tracciamento
- ✅ Statistiche dashboard

---

## 🚀 Installazione e Setup

### Prerequisiti

- **Node.js** 18+ ([Scarica qui](https://nodejs.org/))
- **npm** (viene con Node.js)
- **Git** (opzionale, per clonare)

### Passo 1: Clona il Repository

```bash
git clone https://github.com/gdsgroupsas-jpg/spediresicuro.git
cd spediresicuro
```

### Passo 2: Installa Dipendenze

```bash
npm install
```

### Passo 3: Configura Variabili d'Ambiente

Crea il file `.env.local` nella root del progetto:

```bash
# Windows (PowerShell)
Copy-Item env.example.txt .env.local

# Mac/Linux
cp env.example.txt .env.local
```

Modifica `.env.local` con i tuoi valori:

```env
# OBBLIGATORIO
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=GENERA_CHIAVE_32_CARATTERI  # openssl rand -base64 32

# OPZIONALE - OCR Claude Vision
ANTHROPIC_API_KEY=sk-ant-api03-xxx

# OPZIONALE - Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

# OPZIONALE - GitHub OAuth
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx

# OPZIONALE - Supabase (se vuoi usare PostgreSQL invece di JSON)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

**Genera NEXTAUTH_SECRET:**
```bash
# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Mac/Linux
openssl rand -base64 32
```

### Passo 4: Avvia Server di Sviluppo

```bash
npm run dev
```

Dovresti vedere:
```
✓ Ready in 2.3s
○ Local:        http://localhost:3000
```

### Passo 5: Apri nel Browser

Vai su **http://localhost:3000**

⚠️ **Nota:** Per l'ambiente di sviluppo, consulta la documentazione interna. In produzione, gli utenti devono registrarsi o utilizzare OAuth.

---

## 📁 Struttura Progetto

```
spediresicuro/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes (backend)
│   │   ├── auth/                 # Autenticazione
│   │   ├── spedizioni/           # CRUD spedizioni
│   │   ├── geo/                  # Ricerca comuni
│   │   ├── ocr/                  # OCR extraction
│   │   ├── corrieri/             # API corrieri
│   │   └── user/                 # API utente
│   ├── dashboard/                # Area dashboard
│   │   ├── spedizioni/           # Gestione spedizioni
│   │   ├── impostazioni/         # Impostazioni utente
│   │   └── integrazioni/         # Integrazioni e-commerce
│   ├── login/                    # Pagina login
│   ├── preventivo/               # Pagina preventivo
│   ├── track/                    # Tracking pubblico
│   ├── layout.tsx                # Layout principale
│   ├── page.tsx                  # Homepage
│   └── globals.css               # Stili globali
│
├── components/                   # Componenti React
│   ├── homepage/                 # Componenti homepage
│   ├── ocr/                      # Componenti OCR
│   ├── integrazioni/             # Componenti integrazioni
│   ├── ui/                       # Componenti UI riutilizzabili
│   └── logo/                     # Componenti logo
│
├── lib/                          # Logica business
│   ├── adapters/                 # Adapter pattern
│   │   ├── ocr/                  # OCR adapters (Mock, Claude, Tesseract)
│   │   ├── ecommerce/            # E-commerce adapters
│   │   ├── export/               # Export adapters (PDF, CSV, XLSX)
│   │   └── couriers/             # Courier adapters
│   ├── db/                       # Database modules (Supabase)
│   ├── engine/                    # Business logic engines
│   ├── database.ts               # Database JSON locale
│   └── auth-config.ts            # Configurazione NextAuth
│
├── types/                        # TypeScript types
│   ├── shipments.ts              # Tipi spedizioni
│   ├── geo.ts                    # Tipi geografici
│   └── corrieri.ts               # Tipi corrieri
│
├── data/                         # Database JSON locale
│   └── database.json             # File database (creato automaticamente)
│
├── public/                       # File statici
│   ├── brand/                    # Asset brand
│   └── favicon.svg
│
├── scripts/                      # Script di utilità
│
├── supabase/                     # Schema Supabase (opzionale)
│   └── migrations/               # Migration SQL
│
├── middleware.ts                  # Next.js middleware
├── next.config.js                # Configurazione Next.js
├── tailwind.config.js            # Configurazione Tailwind
├── tsconfig.json                 # Configurazione TypeScript
├── package.json                   # Dipendenze progetto
├── env.example.txt               # Template variabili ambiente
└── README.md                      # Questo file
```

---

## 🔌 API Disponibili

### Autenticazione
- `POST /api/auth/register` - Registrazione nuovo utente
- `POST /api/auth/[...nextauth]` - NextAuth endpoints

### Spedizioni
- `GET /api/spedizioni` - Lista spedizioni (con filtri)
- `POST /api/spedizioni` - Crea nuova spedizione
- `DELETE /api/spedizioni?id=xxx` - Soft delete spedizione
- `GET /api/spedizioni/[id]/ldv` - Download LDV PDF

### Geocoding
- `GET /api/geo/search?q=Milano` - Ricerca comuni italiani

### OCR
- `POST /api/ocr/extract` - Estrazione dati da immagine

### Corrieri
- `GET /api/corrieri/reliability` - AI Routing Advisor

### Utente
- `GET /api/user/settings` - Leggi impostazioni utente
- `PUT /api/user/settings` - Aggiorna impostazioni
- `GET /api/user/dati-cliente` - Dati cliente completati

### Integrazioni
- `GET /api/integrazioni` - Lista integrazioni disponibili
- `POST /api/integrazioni/test` - Test connessione integrazione

---

## 🗄️ Database

### Database JSON Locale (Attuale)

Il progetto usa un database JSON locale per sviluppo/testing:

**File:** `data/database.json`

**Struttura:**
```json
{
  "users": [],
  "spedizioni": [],
  "settings": {}
}
```

**Funzioni disponibili:** `lib/database.ts`
- `addSpedizione()`
- `getSpedizioni()`
- `updateSpedizione()`
- `deleteSpedizione()` (soft delete)

### Schema Supabase (Pronto per Produzione)

Schema PostgreSQL completo con 19+ tabelle:

- `users` - Utenti con OAuth
- `couriers` - Corrieri e configurazioni
- `price_lists` + `price_list_entries` - Listini corrieri
- `shipments` + `shipment_events` - Spedizioni e tracking
- `quotes` - Preventivi
- `products` - Catalogo prodotti
- `suppliers` - Fornitori
- `warehouses` + `inventory` - Magazzino
- `ecommerce_integrations` + `ecommerce_orders` - Integrazioni e-commerce
- `geo_analytics` - Analytics geografiche

**Migration:** `supabase/migrations/001_complete_schema.sql`

**Per attivare Supabase:**
1. Crea progetto su [supabase.com](https://supabase.com)
2. Configura variabili ambiente `.env.local`
3. Esegui migration: `npm run setup:supabase`

---

## 🔐 Autenticazione

### Credenziali Demo (Solo Sviluppo Locale)

⚠️ **Le credenziali demo sono disponibili solo in ambiente di sviluppo locale** (`NODE_ENV=development`).

In produzione, gli utenti devono registrarsi tramite il form di registrazione o utilizzare OAuth.

### OAuth Providers

Configurabili tramite variabili ambiente:

- **Google OAuth** - `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- **GitHub OAuth** - `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`
- **Facebook OAuth** - `FACEBOOK_CLIENT_ID` + `FACEBOOK_CLIENT_SECRET`

### Session Management

- NextAuth v5 con session JWT
- Protezione route tramite middleware
- Refresh automatico session

---

## 🚀 Deploy

### Deploy su Vercel (Raccomandato)

Il progetto è configurato per deploy automatico su Vercel:

1. **Push su GitHub** → Deploy automatico
2. Ogni push sul branch `master` attiva un nuovo deploy
3. Vercel usa la configurazione in `vercel.json`

**Setup Vercel:**
1. Vai su [vercel.com](https://vercel.com)
2. Collega repository GitHub
3. Vercel rileverà automaticamente Next.js
4. Configura variabili ambiente in Vercel dashboard

**Variabili ambiente Vercel:**
- `NEXTAUTH_URL` - URL produzione (es. https://spediresicuro.it)
- `NEXTAUTH_SECRET` - Genera nuovo per produzione
- `ANTHROPIC_API_KEY` - Opzionale (OCR)
- Altri provider OAuth se necessario

### Build Locale

```bash
# Build produzione
npm run build

# Avvia produzione locale
npm start
```

---

## 📝 Convenzioni Codice

### Naming
- **File:** kebab-case (es. `calcolo-prezzo.ts`)
- **Componenti:** PascalCase (es. `FormSpedizione.tsx`)
- **Variabili:** camelCase italiano (es. `prezzoTotale`)
- **Cartelle:** kebab-case (es. `app/preventivo/`)

### Commenti
- Sempre in italiano
- JSDoc per funzioni pubbliche
- Commenti esplicativi per logica complessa

### TypeScript
- Type safety al 100%
- Evitare `any` types
- Interfacce per oggetti complessi
- Enums per valori costanti

### Styling
- Tailwind CSS utility-first
- Design system con colori brand
- Responsive mobile-first
- Animazioni con Framer Motion

---

## 🧪 Comandi Disponibili

```bash
# Sviluppo
npm run dev              # Avvia server sviluppo
npm run dev:monitor      # Dev con error monitoring

# Build
npm run build            # Build produzione
npm run build:monitor    # Build con error monitoring
npm start                # Avvia produzione locale

# Quality
npm run lint             # ESLint check
npm run type-check       # TypeScript check
npm run check:errors     # Verifica errori

# Database
npm run setup:supabase   # Setup Supabase
npm run verify:supabase  # Verifica connessione
npm run seed:geo         # Seed dati geografici

# Configurazione
npm run verify:config    # Verifica config locale
npm run check:env        # Verifica variabili ambiente
```

---

## 🐛 Troubleshooting

### "Port 3000 already in use"
```bash
# Cambia porta
npm run dev -- -p 3001
```

### "Module not found"
```bash
# Reinstalla dipendenze
rm -rf node_modules package-lock.json
npm install
```

### Errori TypeScript
```bash
# Verifica errori
npm run type-check

# Controlla tsconfig.json
```

### Build fallisce
```bash
# Verifica errori build
npm run build

# Controlla variabili ambiente
npm run check:env
```

### OCR non funziona
- Verifica `ANTHROPIC_API_KEY` in `.env.local`
- Se non configurato, usa Mock OCR (default)
- Controlla console browser per errori

### Login non funziona
- Verifica `NEXTAUTH_SECRET` in `.env.local`
- Verifica `NEXTAUTH_URL` corrisponde al dominio
- Controlla `data/database.json` per utenti

---

## 📚 Risorse Utili

- [Documentazione Next.js](https://nextjs.org/docs)
- [Documentazione Tailwind CSS](https://tailwindcss.com/docs)
- [Documentazione TypeScript](https://www.typescriptlang.org/docs/)
- [Documentazione NextAuth](https://next-auth.js.org/)
- [Documentazione Supabase](https://supabase.com/docs)

---

## 📞 Supporto

Per problemi o domande:
- Apri una issue su GitHub
- Controlla la documentazione
- Verifica i log console/terminal

---

## 📄 Licenza

Progetto privato - Tutti i diritti riservati

---

**Versione:** 1.0.0  
**Ultimo aggiornamento:** Gennaio 2025  
**Status:** ✅ Funzionante e in produzione
