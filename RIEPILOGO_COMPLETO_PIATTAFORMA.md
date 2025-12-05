# 📊 RIEPILOGO COMPLETO PIATTAFORMA - SpedireSicuro.it

**Data Analisi:** 2025-12-03  
**Versione:** 1.0.0  
**Status:** ✅ In Produzione su Vercel  
**Repository:** https://github.com/gdsgroupsas-jpg/spediresicuro.git  
**Branch Principale:** master

---

## 🎯 OBIETTIVO DEL PROGETTO

**SpedireSicuro.it** è una piattaforma SaaS per la gestione di spedizioni con sistema di preventivi e ricarico configurabile. Il sistema permette di:
- Calcolare preventivi spedizioni con margine configurabile
- Gestire multiple configurazioni corrieri (multi-tenant)
- Automatizzare estrazione session cookies da Spedisci.Online
- Integrare store e-commerce
- Generare LDV (Lettere di Vettura) interne

---

## 🛠️ STACK TECNOLOGICO

### **Frontend**
- **Framework:** Next.js 14.2.33 (App Router)
- **Linguaggio:** TypeScript 5.3.0
- **Styling:** Tailwind CSS 3.4.0
- **UI Components:** 
  - Lucide React (icone)
  - Framer Motion (animazioni)
  - React Hook Form + Zod (form validation)
  - cmdk (command palette)

### **Backend**
- **Runtime:** Node.js (Vercel Serverless Functions)
- **Authentication:** NextAuth.js 5.0.0-beta.30
- **Database:** 
  - **Primario:** Supabase (PostgreSQL)
  - **Fallback:** JSON locale (`data/database.json`)
- **ORM/Query:** Supabase Client (@supabase/supabase-js 2.39.0)

### **Database & Storage**
- **PostgreSQL:** Supabase (hosted)
- **Migrations:** 17 file SQL in `supabase/migrations/`
- **RLS (Row Level Security):** ✅ Attivo su tutte le tabelle sensibili
- **Realtime:** ✅ Abilitato per spedizioni

### **Automazione & Browser Emulation**
- **Puppeteer:** 24.15.0 (browser automation)
- **Cheerio:** 1.0.0 (HTML parsing)
- **IMAP:** 0.8.19 (lettura email per 2FA)
- **QS:** 6.11.0 (form data serialization)

### **Sicurezza & Criptazione**
- **Algoritmo:** AES-256-GCM
- **Chiave:** `ENCRYPTION_KEY` (variabile d'ambiente)
- **Audit Logging:** ✅ Tabella `audit_logs`
- **RLS Policies:** ✅ Implementate su tutte le tabelle

### **Deployment**
- **Hosting:** Vercel (serverless)
- **CDN:** Vercel Edge Network
- **Build:** Next.js Production Build
- **CI/CD:** Deploy automatico su push a `master`

### **Altre Dipendenze**
- **PDF Generation:** jsPDF 2.5.2 + jspdf-autotable 3.8.4
- **OCR:** Tesseract.js 6.0.1
- **Excel:** xlsx 0.18.5
- **Barcode:** @zxing/library 0.20.0
- **AI/ML:** @anthropic-ai/sdk 0.71.0
- **Vision:** @google-cloud/vision 5.3.4

---

## 🏗️ ARCHITETTURA DEL SISTEMA

### **Pattern Architetturali**

1. **Multi-Tenant Architecture**
   - Ogni utente ha configurazioni corrieri isolate
   - Sistema di assegnazione configurazioni (`assigned_config_id`)
   - Fallback a configurazione default per provider

2. **Factory Pattern**
   - `lib/couriers/factory.ts` - Istanzia provider corrieri dinamicamente
   - Supporta: Spedisci.Online, GLS, BRT, Poste Italiane

3. **Adapter Pattern**
   - `lib/adapters/couriers/` - Adattatori per ogni corriere
   - Interfaccia comune `CourierAdapter`

4. **Server Actions (Next.js)**
   - `actions/` - Logica server-side
   - Type-safe con TypeScript
   - Autenticazione integrata

### **Struttura Directory**

```
spediresicuro-master/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── admin/                # Endpoints admin
│   │   ├── automation/           # Automation endpoints
│   │   ├── user/                 # User endpoints
│   │   └── ...
│   ├── dashboard/                # Dashboard pages
│   │   ├── admin/                # Admin dashboard
│   │   │   ├── automation/       # Automation management
│   │   │   ├── configurations/   # Courier configs
│   │   │   └── page.tsx          # Main admin dashboard
│   │   ├── integrazioni/         # Integrations page
│   │   └── ...
│   └── ...
├── actions/                      # Server Actions
│   ├── automation.ts             # Automation actions
│   ├── configurations.ts          # Config management
│   └── ...
├── lib/                          # Core libraries
│   ├── adapters/                 # Courier adapters
│   ├── automation/               # Automation agent
│   ├── couriers/                 # Courier factory
│   ├── security/                 # Encryption, audit
│   └── ...
├── components/                   # React components
├── supabase/                     # Database migrations
│   └── migrations/               # 17 SQL migrations
└── scripts/                      # Utility scripts
```

---

## 🗄️ DATABASE SCHEMA

### **Tabelle Principali**

#### **1. `users`**
- Gestione utenti multi-tenant
- Campi: `id`, `email`, `name`, `role`, `account_type`, `assigned_config_id`
- RLS: ✅ Solo utente può vedere i propri dati

#### **2. `courier_configs`**
- Configurazioni API corrieri
- Campi: `id`, `name`, `provider_id`, `api_key` (criptato), `api_secret` (criptato), `base_url`, `contract_mapping`, `is_active`, `is_default`
- **Automation Fields:**
  - `session_data` (JSONB) - Session cookies, CSRF tokens
  - `automation_settings` (JSONB) - 2FA, IMAP, credenziali
  - `automation_enabled` (BOOLEAN)
  - `last_automation_sync` (TIMESTAMPTZ)
  - `session_status` (TEXT)
- RLS: ✅ Solo admin può vedere/modificare

#### **3. `shipments`**
- Gestione spedizioni
- Campi: `id`, `user_id`, `tracking_number`, `status`, `courier_code`, `final_price`, etc.
- Realtime: ✅ Abilitato per aggiornamenti live

#### **4. `automation_locks`**
- Sistema di lock per prevenire conflitti agent/manuale
- Campi: `id`, `config_id`, `lock_type` ('agent' | 'manual'), `locked_by`, `reason`, `expires_at`
- Auto-expire dopo timeout

#### **5. `audit_logs`**
- Log di sicurezza e audit
- Traccia: accessi, modifiche, eliminazioni credenziali

#### **6. `killer_features`**
- Sistema feature flags
- Gestione funzionalità premium

### **Migrations Eseguite**

1. `001_complete_schema.sql` - Schema base
2. `002_user_integrations.sql` - Integrazioni utente
3. `003_user_profiles_mapping.sql` - Mapping profili
4. `004_fix_shipments_schema.sql` - Fix schema spedizioni
5. `006_roles_and_permissions.sql` - Ruoli e permessi
6. `007_add_pickup_scanning_fields.sql` - Campi scanning
7. `008_admin_user_system.sql` - Sistema admin
8. `009_gdpr_privacy_policies.sql` - GDPR compliance
9. `010_courier_configs_system.sql` - Sistema configurazioni corrieri
10. `011_add_ldv_scanner_feature.sql` - Feature scanner LDV
11. `012_enable_realtime_shipments.sql` - Realtime spedizioni
12. `013_security_audit_logs.sql` - Audit logging
13. `014_api_versioning_monitoring.sql` - Versionamento API
14. `015_extend_courier_configs_session_data.sql` - Estensione automation
15. `016_automation_locks.sql` - Sistema lock
16. `017_encrypt_automation_passwords.sql` - Criptazione password automation

---

## 🔐 SICUREZZA

### **Livelli di Protezione**

#### **1. Criptazione Credenziali**
- **Algoritmo:** AES-256-GCM
- **Campi Criptati:**
  - `api_key` (courier_configs)
  - `api_secret` (courier_configs)
  - `imap_password` (automation_settings)
  - `spedisci_online_password` (automation_settings)
- **Chiave:** `ENCRYPTION_KEY` (variabile d'ambiente, NON nel codice)

#### **2. Row Level Security (RLS)**
- ✅ Attivo su: `users`, `courier_configs`, `shipments`, `audit_logs`
- ✅ Policies per admin/user isolation
- ✅ Verifica `account_type` o `role` per accesso

#### **3. Autenticazione**
- **Provider:** NextAuth.js
- **Metodi:** Credentials, Google OAuth, GitHub OAuth
- **Session:** JWT-based
- **Protection:** Middleware su tutte le route `/dashboard/*`

#### **4. Audit Logging**
- Tabella `audit_logs` traccia:
  - Accessi a credenziali
  - Modifiche configurazioni
  - Eliminazioni
  - Decriptazioni

#### **5. Server-Side Only**
- Password **MAI** inviate al client
- Decriptazione **SOLO** server-side
- Client riceve solo dati non sensibili

### **Variabili d'Ambiente Critiche**

```env
# Database
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # ⚠️ SOLO server-side

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

## 🤖 SISTEMA AUTOMATION SPEDISCI.ONLINE

### **Componenti**

1. **Agent (`lib/automation/spedisci-online-agent.ts`)**
   - Classe `SpedisciOnlineAgent`
   - Browser automation con Puppeteer
   - Estrazione session cookies, CSRF tokens, contract IDs
   - Supporto 2FA: Email (IMAP) o Manuale (Microsoft Authenticator)

2. **Server Actions (`actions/automation.ts`)**
   - `toggleAutomation()` - Abilita/disabilita
   - `saveAutomationSettings()` - Salva configurazione
   - `manualSync()` - Sync manuale
   - `getAutomationStatus()` - Verifica stato
   - `acquireManualLock()` / `releaseManualLock()` - Gestione lock

3. **Lock System (`supabase/migrations/016_automation_locks.sql`)**
   - Previene conflitti tra agent e uso manuale
   - Lock manuale: utente blocca agent per X minuti
   - Lock agent: agent blocca durante operazioni
   - Auto-expire dopo timeout

4. **Dashboard (`app/dashboard/admin/automation/page.tsx`)**
   - Interfaccia gestione automation
   - Form configurazione diretto (no modal)
   - Sync manuale con supporto OTP
   - Visualizzazione stato session

### **Flusso Automation**

```
1. Utente configura automation (credenziali, IMAP, 2FA)
2. Agent esegue login su Spedisci.Online
3. Se 2FA email: legge codice da IMAP
4. Se 2FA manuale: richiede OTP all'utente
5. Estrae session cookies, CSRF token, contract IDs
6. Salva in `courier_configs.session_data`
7. Cron job (opzionale) esegue refresh periodico
```

### **Sicurezza Automation**

- ✅ Password Spedisci.Online criptate (AES-256-GCM)
- ✅ Password IMAP criptate
- ✅ Session data salvata in database (scade dopo 24h)
- ✅ Lock system previene conflitti
- ✅ Audit logging di tutte le operazioni

---

## 📡 API ENDPOINTS

### **Admin APIs**
- `GET /api/admin/overview` - Panoramica completa (solo admin)
- `GET /api/admin/users/[id]` - Dettagli utente
- `GET /api/admin/shipments/[id]` - Dettagli spedizione
- `POST /api/admin/features` - Gestione features

### **User APIs**
- `GET /api/user/info` - Informazioni utente corrente
- `GET /api/user/settings` - Impostazioni utente
- `PUT /api/user/settings` - Aggiorna impostazioni
- `GET /api/user/dati-cliente` - Dati cliente

### **Automation APIs**
- `POST /api/automation/spedisci-online/sync` - Sync manuale
- `GET /api/cron/automation-sync` - Cron job sync

### **Shipments APIs**
- `POST /api/spedizioni` - Crea spedizione
- `GET /api/spedizioni/[id]/ldv` - Genera LDV
- `POST /api/spedizioni/import` - Import CSV

### **Integrations APIs**
- `GET /api/integrazioni` - Lista integrazioni
- `POST /api/integrazioni/test` - Test integrazione

---

## 🎨 INTERFACCIA UTENTE

### **Dashboard Principale**
- `/dashboard` - Overview con statistiche
- `/dashboard/spedizioni` - Gestione spedizioni
- `/dashboard/integrazioni` - Integrazioni store
- `/dashboard/impostazioni` - Impostazioni account
- `/dashboard/dati-cliente` - Dati cliente

### **Admin Dashboard**
- `/dashboard/admin` - God view (tutti utenti/spedizioni)
- `/dashboard/admin/configurations` - Gestione configurazioni corrieri
- `/dashboard/admin/automation` - Gestione automation Spedisci.Online
- `/dashboard/admin/users` - Gestione utenti

### **Componenti UI**
- `DashboardNav` - Navigazione con breadcrumbs
- `IntegrationCard` - Card integrazioni
- `OTPInputModal` - Modal input OTP per 2FA
- Design system con Tailwind CSS

---

## 🚀 DEPLOYMENT

### **Vercel Configuration**

**File:** `vercel.json`
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

### **Build Process**
1. `npm install` - Installa dipendenze
2. `next build` - Build produzione
3. Deploy automatico su Vercel Edge Network

### **Environment Variables (Vercel)**
- Configurate in Vercel Dashboard → Settings → Environment Variables
- Separate per Production/Preview/Development

---

## 📊 STATO ATTUALE

### **✅ Funzionalità Implementate**

1. **Sistema Multi-Tenant Corrieri**
   - ✅ Configurazioni dinamiche da database
   - ✅ Assegnazione configurazioni per utente
   - ✅ Fallback a configurazione default
   - ✅ Criptazione credenziali

2. **Automation Spedisci.Online**
   - ✅ Browser automation con Puppeteer
   - ✅ Estrazione session cookies
   - ✅ Supporto 2FA (email/manuale)
   - ✅ Lock system per conflitti
   - ✅ Dashboard gestione

3. **Sistema Spedizioni**
   - ✅ Creazione spedizioni
   - ✅ Generazione LDV interna (PDF)
   - ✅ Tracking
   - ✅ Realtime updates

4. **Sicurezza**
   - ✅ Criptazione AES-256-GCM
   - ✅ RLS su tutte le tabelle
   - ✅ Audit logging
   - ✅ Server-side only per password

5. **Admin Dashboard**
   - ✅ Gestione utenti
   - ✅ Gestione configurazioni
   - ✅ Gestione automation
   - ✅ Statistiche globali

### **⚠️ Limitazioni Note**

1. **Puppeteer su Vercel**
   - Richiede configurazione speciale (args: `--no-sandbox`, etc.)
   - Timeout aumentato a 300s per automation routes

2. **2FA Manuale**
   - Richiede input OTP manuale
   - Non compatibile con cron automatici

3. **Encryption Key**
   - ⚠️ **OBBLIGATORIA** in produzione
   - Senza chiave, credenziali salvate in chiaro

---

## 🔧 CONFIGURAZIONE NECESSARIA

### **1. Variabili d'Ambiente Vercel**

**Obbligatorie:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY` ⚠️ **CRITICA**
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`

**Opzionali (OAuth):**
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`

### **2. Database Supabase**

**Migrations da Eseguire:**
1. `001_complete_schema.sql`
2. `002_user_integrations.sql`
3. `003_user_profiles_mapping.sql`
4. `006_roles_and_permissions.sql`
5. `008_admin_user_system.sql`
6. `010_courier_configs_system.sql`
7. `013_security_audit_logs.sql`
8. `015_extend_courier_configs_session_data.sql`
9. `016_automation_locks.sql`
10. `017_encrypt_automation_passwords.sql`

**Ordine:** Eseguire in ordine numerico (001 → 017)

### **3. Generazione ENCRYPTION_KEY**

```bash
# Genera chiave sicura (64 caratteri hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**⚠️ IMPORTANTE:** Salva la chiave in modo sicuro. Senza di essa, le credenziali criptate non possono essere decriptate.

---

## 📈 METRICHE & PERFORMANCE

### **Build Time**
- Build locale: ~30-60 secondi
- Build Vercel: ~20-40 secondi

### **Bundle Size**
- Client bundle: ~500KB (gzipped)
- Server functions: Ottimizzate per serverless

### **Database Performance**
- Indici su: `users.email`, `courier_configs.provider_id`, `shipments.user_id`
- Query ottimizzate con RLS

---

## 🐛 PROBLEMI NOTI & SOLUZIONI

### **1. GoTrueClient Multiple Instances**
- **Problema:** Warning su istanze multiple Supabase client
- **Soluzione:** Aggiunto `storageKey: 'spediresicuro-auth'` univoco

### **2. Puppeteer su Vercel**
- **Problema:** Puppeteer richiede configurazione speciale
- **Soluzione:** Args `--no-sandbox`, `--disable-setuid-sandbox`, `--single-process`

### **3. TailwindCSS Build Error**
- **Problema:** TailwindCSS non trovato durante build
- **Soluzione:** Spostato da `devDependencies` a `dependencies`

---

## 🔄 WORKFLOW SVILUPPO

### **Git**
- **Repository:** https://github.com/gdsgroupsas-jpg/spediresicuro.git
- **Branch:** `master` (deploy automatico)
- **Account:** gdsgroupsas-jpg

### **Deploy**
- **Automatico:** Push su `master` → Deploy Vercel
- **Manual:** Vercel Dashboard → Deploy

### **Testing**
- **Locale:** `npm run dev`
- **Build:** `npm run build`
- **Type Check:** `npm run type-check`

---

## 📚 DOCUMENTAZIONE DISPONIBILE

- `docs/AUTOMATION_SPEDISCI_ONLINE.md` - Guida automation
- `docs/SICUREZZA_AUTOMATION.md` - Sicurezza automation
- `docs/AUTOMATION_LOCK_SYSTEM.md` - Sistema lock
- `docs/SECURITY_CREDENTIALS.md` - Sicurezza credenziali
- `docs/COURIER_CONFIGS_SYSTEM.md` - Sistema configurazioni
- `RIEPILOGO_FINALE_AUTOMATION.md` - Riepilogo automation

---

## 🎯 PROSSIMI SVILUPPI (Roadmap)

1. **Miglioramenti Automation**
   - Supporto più provider 2FA
   - Retry automatico su errori
   - Monitoring avanzato

2. **Integrazioni E-commerce**
   - Shopify (in sviluppo)
   - WooCommerce (in sviluppo)
   - Amazon (in sviluppo)

3. **Features Premium**
   - Sistema abbonamenti
   - Analytics avanzate
   - API pubbliche

---

## ⚠️ AVVERTENZE CRITICHE

1. **ENCRYPTION_KEY**
   - ⚠️ **NON** committare mai nel repository
   - ⚠️ **NON** condividere pubblicamente
   - ⚠️ **OBBLIGATORIA** in produzione

2. **SUPABASE_SERVICE_ROLE_KEY**
   - ⚠️ **SOLO** server-side
   - ⚠️ **NON** esporre nel client
   - ⚠️ Bypassa RLS (usare con cautela)

3. **Automation Agent**
   - ⚠️ Usare solo su account propri
   - ⚠️ Legale solo se account Spedisci.Online è tuo
   - ⚠️ Rispettare ToS di Spedisci.Online

---

## 📞 SUPPORTO & CONTATTI

- **Repository:** https://github.com/gdsgroupsas-jpg/spediresicuro.git
- **Deploy:** Vercel (automatico)
- **Database:** Supabase (PostgreSQL)

---

**Documento generato:** 2025-12-03  
**Versione Piattaforma:** 1.0.0  
**Status:** ✅ Production Ready

