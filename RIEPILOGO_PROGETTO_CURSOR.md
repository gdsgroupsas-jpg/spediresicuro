# 📋 RIEPILOGO PROGETTO SPEDIRESICURO - Per Cursor Agent

**Data Creazione**: 02 Dicembre 2025  
**Versione**: 1.0  
**Stato**: In Sviluppo Attivo

---

## 🎯 OBIETTIVO DEL PROGETTO

**SpedireSicuro.it** è una piattaforma SaaS completa per la gestione di spedizioni logistiche, con integrazione e-commerce, OCR automatico, e sistema di pricing dinamico.

**Stack Principale**: Next.js 14, TypeScript, Supabase (PostgreSQL), Vercel

---

## 🏗️ ARCHITETTURA TECNICA

### Frontend
- **Framework**: Next.js 14.2.33 (App Router)
- **Linguaggio**: TypeScript
- **UI**: React, TailwindCSS, Radix UI, Lucide Icons
- **Autenticazione**: NextAuth.js (Credentials + OAuth: Google, GitHub)
- **Deploy**: Vercel

### Backend/Database
- **Database**: Supabase (PostgreSQL)
- **ORM/Query**: Supabase Client (PostgREST)
- **Autenticazione DB**: NextAuth (non Supabase Auth nativo)
- **File Storage**: Supabase Storage (per documenti/immagini)

### Integrazioni
- **OCR**: Google Cloud Vision API, Anthropic Claude, Tesseract
- **E-commerce**: WooCommerce, Shopify, Magento, PrestaShop, Amazon
- **Corrieri**: GLS, SDA, Poste Italiane, Bartolini, DHL
- **Fatturazione**: Integrazione SDI (fatturazione elettronica)

---

## 📁 STRUTTURA PROGETTO

```
spediresicuro/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── spedizioni/          # CRUD spedizioni
│   │   ├── user/settings/       # Impostazioni utente
│   │   └── ...
│   ├── dashboard/               # Dashboard protetta
│   │   ├── spedizioni/          # Lista/gestione spedizioni
│   │   ├── crea-spedizione/     # Creazione nuova spedizione
│   │   └── ...
│   └── ...
├── lib/                         # Librerie e utilities
│   ├── database.ts              # ⚠️ CRITICO: Adapter Supabase (SOLO Supabase per spedizioni)
│   ├── supabase.ts              # Client Supabase
│   ├── auth-config.ts           # Configurazione NextAuth
│   └── ...
├── supabase/
│   └── migrations/              # Script SQL migrazioni
│       ├── 001_complete_schema.sql
│       ├── 003_user_profiles_mapping.sql
│       ├── 004_fix_shipments_schema.sql
│       └── 006_roles_and_permissions.sql  # ⚠️ NUOVO: Sistema ruoli/permessi
├── components/                  # Componenti React riutilizzabili
└── ...
```

---

## ⚠️ REGOLE CRITICHE - DA RISPETTARE SEMPRE

### 1. **NON USARE JSON FALLBACK PER SPEDIZIONI**
- ✅ **SOLO Supabase** per tutte le operazioni su spedizioni
- ❌ **MAI** `readDatabase()` o `writeDatabase()` per spedizioni
- ❌ **MAI** file system su Vercel (read-only)
- Se Supabase fallisce, **lanciare errore chiaro**, non fallback JSON

### 2. **Database: Supabase PostgreSQL**
- Tutte le spedizioni in tabella `shipments`
- Mapping NextAuth email → Supabase UUID tramite `user_profiles`
- Soft delete: campo `deleted = true` (non eliminazione fisica)
- Multi-tenancy: filtra per `user_id` o `created_by_user_email`

### 3. **Autenticazione: NextAuth (non Supabase Auth)**
- Utenti autenticati tramite NextAuth
- Email-based (non UUID-based)
- Provider: Credentials, Google, GitHub
- Session in JWT (non database)

### 4. **Ruoli e Permessi**
- **Ruoli disponibili**: `admin`, `user`, `agent`, `manager`, `merchant`, `support`, `viewer`
- **Default per nuovi utenti**: `user`
- **God View**: Solo `admin` può vedere tutti gli utenti e gestire ruoli/features
- **Killer Features**: Sistema di permessi per features premium (vedi sezione dedicata)

---

## 🔐 SISTEMA RUOLI E PERMESSI

### Ruoli Disponibili

| Ruolo | Descrizione | Permessi Default |
|-------|-------------|------------------|
| `admin` | Super amministratore | Accesso completo, gestione utenti, tutte le features |
| `user` | Utente standard | Features gratuite (OCR, Bulk Import) |
| `agent` | Agente/Operatore | Features base + gestione spedizioni |
| `manager` | Manager | Features avanzate + gestione team |
| `merchant` | E-commerce Merchant | Features business (API, Webhook) |
| `support` | Supporto tecnico | Accesso limitato per troubleshooting |
| `viewer` | Solo visualizzazione | Nessuna modifica, solo lettura |

### Killer Features

Le "killer features" sono funzionalità premium che possono essere:
- **Gratuite** (attualmente: OCR Scan, Bulk Import)
- **A pagamento** (API Access, Analytics Avanzati, White Label, etc.)

**Tabelle Database**:
- `killer_features`: Catalogo features disponibili
- `user_features`: Associazione utente-feature (quali features ha attive)
- `role_permissions`: Permessi di default per ruolo

**Funzioni Helper SQL**:
- `user_has_feature(email, feature_code)`: Verifica se utente ha accesso
- `get_user_active_features(email)`: Lista tutte le features attive
- `change_user_role(admin_email, target_email, new_role)`: Cambia ruolo (solo admin)
- `toggle_user_feature(admin_email, target_email, feature_code, activate)`: Attiva/disattiva feature

**View God View**:
- `god_view_users`: Vista completa utenti per dashboard admin

### Come Gestire Ruoli/Features

**Via SQL (Supabase Dashboard)**:
```sql
-- Cambia ruolo utente
SELECT change_user_role('admin@spediresicuro.it', 'user@example.com', 'manager');

-- Attiva feature per utente
SELECT toggle_user_feature('admin@spediresicuro.it', 'user@example.com', 'api_access', true);

-- Verifica se utente ha feature
SELECT user_has_feature('user@example.com', 'ocr_scan');
```

**Via API (da implementare)**:
- Endpoint `/api/admin/users` (solo admin)
- Endpoint `/api/admin/features` (solo admin)

---

## 📊 SCHEMA DATABASE PRINCIPALE

### Tabella `shipments` (Spedizioni)
- **ID**: UUID (primary key)
- **Multi-tenancy**: `user_id` (UUID) o `created_by_user_email` (TEXT)
- **Tracking**: `tracking_number` (UNIQUE), `ldv` (Lettera di Vettura)
- **Status**: ENUM `shipment_status` (pending, in_transit, delivered, etc.)
- **Mittente/Destinatario**: Campi separati (sender_name, recipient_name, etc.)
- **Pricing**: `base_price`, `surcharges`, `final_price`, `margin_percent`
- **Soft Delete**: `deleted` (BOOLEAN), `deleted_at`, `deleted_by_user_id`
- **Audit**: `created_by_user_email`, `created_at`, `updated_at`

### Tabella `users` (Utenti)
- **ID**: UUID (primary key)
- **Email**: TEXT (UNIQUE, NOT NULL)
- **Role**: ENUM `user_role` (admin, user, agent, manager, merchant, support, viewer)
- **Provider**: ENUM `auth_provider` (credentials, google, github, facebook)
- **Timestamps**: `created_at`, `updated_at`, `last_login_at`

### Tabella `user_profiles` (Mapping NextAuth ↔ Supabase)
- **Email**: TEXT (UNIQUE) - chiave NextAuth
- **supabase_user_id**: UUID (nullable) - chiave Supabase Auth
- **Metadata**: name, provider, provider_id

### Tabella `killer_features` (Catalogo Features)
- **Code**: TEXT (UNIQUE) - identificativo feature (es. 'ocr_scan', 'api_access')
- **Name/Description**: Nome e descrizione
- **Category**: automation, integration, analytics, premium
- **Pricing**: `price_monthly_cents`, `price_yearly_cents`, `is_free`
- **Availability**: `is_available`, `display_order`

### Tabella `user_features` (Utente ↔ Feature)
- **user_email**: TEXT - email utente
- **feature_id**: UUID - riferimento a killer_features
- **is_active**: BOOLEAN - se la feature è attiva
- **expires_at**: TIMESTAMPTZ (nullable) - scadenza feature
- **activation_type**: free, paid, trial, admin_grant, subscription

### Tabella `role_permissions` (Ruolo ↔ Feature)
- **role**: ENUM `user_role`
- **feature_code**: TEXT - riferimento a killer_features.code
- **has_access**: BOOLEAN - se il ruolo ha accesso di default
- **can_manage**: BOOLEAN - se può gestire la feature per altri

---

## 🔧 FUNZIONI CRITICHE DEL CODICE

### `lib/database.ts`
**⚠️ FILE CRITICO - NON MODIFICARE SENZA ATTENZIONE**

**Funzioni Spedizioni (SOLO Supabase)**:
- `addSpedizione(spedizione, userEmail)`: Salva spedizione in Supabase
- `getSpedizioni(userEmail)`: Recupera spedizioni filtrate per utente
- `mapSpedizioneToSupabase()`: Converte formato JSON → Supabase
- `mapSpedizioneFromSupabase()`: Converte formato Supabase → JSON

**Funzioni Utenti (JSON locale - da migrare)**:
- `findUserByEmail(email)`: Trova utente per email
- `createUser(user)`: Crea nuovo utente
- `updateUser(id, updates)`: Aggiorna utente
- `verifyUserCredentials(email, password)`: Verifica credenziali

**Helper**:
- `getSupabaseUserIdFromEmail(email)`: Mappa email NextAuth → UUID Supabase
- `isSupabaseConfigured()`: Verifica se Supabase è configurato

### `app/api/spedizioni/route.ts`
**API Routes per Spedizioni**:
- `GET`: Lista spedizioni (filtrate per utente)
- `POST`: Crea nuova spedizione
- `DELETE`: Soft delete spedizione

**⚠️ IMPORTANTE**: Tutte le route verificano autenticazione tramite `auth()` (NextAuth)

---

## 🚀 DEPLOY E AMBIENTE

### Variabili Ambiente Richieste

**Supabase**:
- `NEXT_PUBLIC_SUPABASE_URL`: URL progetto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Chiave anonima Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Chiave service role (server-side)

**NextAuth**:
- `NEXTAUTH_URL`: URL applicazione (es. https://spediresicuro.vercel.app)
- `NEXTAUTH_SECRET`: Secret per JWT

**OAuth** (opzionale):
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

**OCR/API** (opzionale):
- `GOOGLE_CLOUD_VISION_API_KEY`
- `ANTHROPIC_API_KEY`

### Deploy Vercel
- **Branch**: `master` (auto-deploy)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

**⚠️ IMPORTANTE**: Vercel ha file system read-only, quindi:
- ❌ Non usare `fs.writeFileSync()` o simili
- ✅ Usare solo Supabase per persistenza dati

---

## 🐛 PROBLEMI COMUNI E SOLUZIONI

### 1. "EROFS: read-only file system"
**Causa**: Tentativo di scrivere file su Vercel  
**Soluzione**: Rimuovere tutti i `readDatabase()`/`writeDatabase()` per spedizioni, usare solo Supabase

### 2. "Could not find the 'X' column of 'shipments'"
**Causa**: Colonna mancante nello schema Supabase  
**Soluzione**: Eseguire script `004_fix_shipments_schema.sql` su Supabase

### 3. "null value in column 'X' violates not-null constraint"
**Causa**: Campo obbligatorio non fornito o tipo errato  
**Soluzione**: Verificare mapping in `mapSpedizioneToSupabase()`, aggiungere campo nello script SQL

### 4. "Spedizioni non visibili nella lista"
**Causa**: Filtro `created_by_user_email` non corrisponde  
**Soluzione**: Verificare che `created_by_user_email` sia salvato correttamente in `addSpedizione()`

### 5. "duplicate key value violates unique constraint"
**Causa**: Vincolo UNIQUE su campo che non dovrebbe esserlo  
**Soluzione**: Rimuovere vincolo UNIQUE nello script SQL (es. `order_reference`)

---

## 📝 TODO E PROSSIMI SVILUPPI

### Priorità Alta
- [ ] Implementare API `/api/admin/users` per gestione utenti (god view)
- [ ] Implementare API `/api/admin/features` per gestione features
- [ ] Dashboard admin (god view) con lista utenti e gestione ruoli
- [ ] Migrare funzioni utenti da JSON a Supabase
- [ ] Implementare sistema di pagamento per killer features

### Priorità Media
- [ ] Sistema di notifiche email per eventi spedizioni
- [ ] Dashboard analytics avanzati
- [ ] Export report personalizzati
- [ ] Integrazione completa con più corrieri

### Priorità Bassa
- [ ] App mobile (React Native)
- [ ] API pubblica documentata (Swagger/OpenAPI)
- [ ] Sistema di webhook per integrazioni

---

## 🔗 LINK UTILI

- **Dashboard Vercel**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Repository GitHub**: https://github.com/gdsgroupsas-jpg/spediresicuro
- **Documentazione Next.js**: https://nextjs.org/docs
- **Documentazione Supabase**: https://supabase.com/docs

---

## 📞 CONTATTI E SUPPORTO

**Progetto**: SpedireSicuro.it  
**Sviluppatore**: GDS Group SAS  
**Email**: admin@spediresicuro.it

---

## ⚡ QUICK START PER NUOVO AGENT

1. **Leggi questo file** completamente
2. **Verifica ambiente**: Controlla variabili ambiente su Vercel
3. **Verifica database**: Controlla schema Supabase, esegui migrazioni se necessario
4. **Test locale**: `npm install && npm run dev`
5. **Regole d'oro**:
   - ✅ Sempre Supabase per spedizioni
   - ✅ Mai JSON fallback per spedizioni
   - ✅ Verificare autenticazione in tutte le API routes
   - ✅ Logging dettagliato per troubleshooting

---

**Ultimo Aggiornamento**: 02 Dicembre 2025  
**Versione Documento**: 1.0

