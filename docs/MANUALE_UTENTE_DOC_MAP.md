# 📚 Doc Map - Manuale Utente SpedireSicuro

> **Versione:** 1.0  
> **Data:** 2024  
> **Scopo:** Mappa completa delle funzionalità per reseller/point fisico  
> **Metodologia:** Analisi codebase (zero assunzioni)

---

## 📋 Indice

1. [Mappa Pagine](#1-mappa-pagine)
2. [Flussi Principali](#2-flussi-principali)
3. [Ruoli e Permessi](#3-ruoli-e-permessi)
4. [Glossario Campi](#4-glossario-campi-principali)
5. [Open Questions / TBD](#5-open-questions--tbd)

---

## 1. Mappa Pagine

### 1.1 Pagine Pubbliche

| URL/Route | Titolo | Scopo | File |
|-----------|--------|-------|------|
| `/` | Homepage | Landing page con hero, features, Annie AI showcase | `app/page.tsx` |
| `/login` | Login | Autenticazione (email/password, OAuth Google/GitHub/Facebook) | `app/login/page.tsx` |
| `/preventivo` | Calcola Preventivo | Calcolo preventivo spedizioni (form peso/città) | `app/preventivo/page.tsx` |
| `/preventivi` | Preventivi | TBD | `app/preventivi/page.tsx` |
| `/prezzi` | Prezzi | TBD | `app/prezzi/page.tsx` |
| `/track/[trackingId]` | Tracking | Pagina pubblica tracking spedizione per cliente finale | `app/track/[trackingId]/page.tsx` |
| `/come-funziona` | Come Funziona | TBD | `app/come-funziona/page.tsx` |
| `/contatti` | Contatti | TBD | `app/contatti/page.tsx` |
| `/privacy-policy` | Privacy Policy | TBD | `app/privacy-policy/page.tsx` |
| `/terms-conditions` | Termini e Condizioni | TBD | `app/terms-conditions/page.tsx` |
| `/cookie-policy` | Cookie Policy | TBD | `app/cookie-policy/page.tsx` |
| `/manuale` | Manuale | TBD | `app/manuale/page.tsx` |

### 1.2 Dashboard - Area Autenticata

| URL/Route | Titolo | Scopo | File | Ruolo Minimo |
|-----------|--------|-------|------|--------------|
| `/dashboard` | Dashboard | Panoramica statistiche, attività recente, quick actions | `app/dashboard/page.tsx` | `user` |
| `/dashboard/dati-cliente` | Dati Cliente | Onboarding: completamento dati anagrafici obbligatori | `app/dashboard/dati-cliente/page.tsx` | `user` |
| `/dashboard/spedizioni` | Lista Spedizioni | Visualizzazione, filtri, export, import, eliminazione | `app/dashboard/spedizioni/page.tsx` | `user` |
| `/dashboard/spedizioni/nuova` | Nuova Spedizione | Creazione spedizione (manuale o OCR/AI) | `app/dashboard/spedizioni/nuova/page.tsx` | `user` |
| `/dashboard/spedizioni/[id]` | Dettaglio Spedizione | Visualizzazione dettagli singola spedizione | `app/dashboard/spedizioni/[id]/page.tsx` | `user` |
| `/dashboard/wallet` | Wallet | Gestione saldo, transazioni, ricarica | `app/dashboard/wallet/page.tsx` | `user` |
| `/dashboard/impostazioni` | Impostazioni | TBD | `app/dashboard/impostazioni/page.tsx` | `user` |
| `/dashboard/profile/privacy` | Privacy | TBD | `app/dashboard/profile/privacy/page.tsx` | `user` |
| `/dashboard/integrazioni` | Integrazioni | TBD | `app/dashboard/integrazioni/page.tsx` | `user` |
| `/dashboard/listini` | Listini | TBD | `app/dashboard/listini/page.tsx` | `user` |
| `/dashboard/listini/[id]` | Dettaglio Listino | TBD | `app/dashboard/listini/[id]/page.tsx` | `user` |
| `/dashboard/fatture` | Fatture | TBD | `app/dashboard/fatture/page.tsx` | `user` |
| `/dashboard/fatture/[id]` | Dettaglio Fattura | TBD | `app/dashboard/fatture/[id]/page.tsx` | `user` |
| `/dashboard/bonifici` | Bonifici | TBD | `app/dashboard/bonifici/page.tsx` | `user` |
| `/dashboard/finanza` | Finanza | TBD | `app/dashboard/finanza/page.tsx` | `user` |
| `/dashboard/contrassegni` | Contrassegni | TBD | `app/dashboard/contrassegni/page.tsx` | `user` |
| `/dashboard/resi` | Resi | TBD | `app/dashboard/resi/page.tsx` | `user` |
| `/dashboard/scanner-resi` | Scanner Resi | TBD | `app/dashboard/scanner-resi/page.tsx` | `user` |
| `/dashboard/ocr-scanner` | OCR Scanner | TBD | `app/dashboard/ocr-scanner/page.tsx` | `user` |
| `/dashboard/posta` | Posta | TBD | `app/dashboard/posta/page.tsx` | `user` |
| `/dashboard/voice` | Voice | TBD | `app/dashboard/voice/page.tsx` | `user` |
| `/dashboard/team` | Team | TBD | `app/dashboard/team/page.tsx` | `user` |

### 1.3 Dashboard - Reseller

| URL/Route | Titolo | Scopo | File | Ruolo Minimo |
|-----------|--------|-------|------|--------------|
| `/dashboard/reseller-team` | Reseller Team | Gestione sub-utenti, statistiche team | `app/dashboard/reseller-team/page.tsx` | `reseller` |

### 1.4 Dashboard - Admin

| URL/Route | Titolo | Scopo | File | Ruolo Minimo |
|-----------|--------|-------|------|--------------|
| `/dashboard/admin` | Admin Dashboard | Vista globale utenti, spedizioni, statistiche | `app/dashboard/admin/page.tsx` | `admin` |
| `/dashboard/admin/users` | Utenti | TBD | `app/dashboard/admin/users/[userId]/page.tsx` | `admin` |
| `/dashboard/admin/logs` | Logs | TBD | `app/dashboard/admin/logs/page.tsx` | `admin` |
| `/dashboard/admin/configurations` | Configurazioni | TBD | `app/dashboard/admin/configurations/page.tsx` | `admin` |
| `/dashboard/admin/features` | Features | TBD | `app/dashboard/admin/features/page.tsx` | `admin` |
| `/dashboard/admin/automation` | Automation | TBD | `app/dashboard/admin/automation/page.tsx` | `admin` |
| `/dashboard/admin/bonifici` | Bonifici Admin | TBD | `app/dashboard/admin/bonifici/page.tsx` | `admin` |
| `/dashboard/admin/invoices` | Fatture Admin | TBD | `app/dashboard/admin/invoices/page.tsx` | `admin` |
| `/dashboard/admin/leads` | Leads | TBD | `app/dashboard/admin/leads/page.tsx` | `admin` |

### 1.5 Dashboard - Super Admin

| URL/Route | Titolo | Scopo | File | Ruolo Minimo |
|-----------|--------|-------|------|--------------|
| `/dashboard/super-admin` | Super Admin | Gestione completa piattaforma, utenti, wallet | `app/dashboard/super-admin/page.tsx` | `superadmin` |

### 1.6 Pagine Utility

| URL/Route | Titolo | Scopo | File |
|-----------|--------|-------|------|
| `/auth/callback` | Auth Callback | Callback OAuth/NextAuth | `app/auth/callback/page.tsx` |
| `/promote-superadmin` | Promote Superadmin | TBD | `app/promote-superadmin/page.tsx` |
| `/fix-admin` | Fix Admin | TBD | `app/fix-admin/page.tsx` |

---

## 2. Flussi Principali

### 2.1 Flusso Registrazione e Onboarding

**File di riferimento:**
- `app/login/page.tsx` (registrazione)
- `app/dashboard/dati-cliente/page.tsx` (onboarding)
- `app/dashboard/page.tsx` (gate dati cliente)

**Passo-passo:**

1. **Registrazione** (`/login` - modalità "Registrati")
   - Inserimento: nome, email, password, conferma password, tipo account (user/admin)
   - Validazione: password min 8 caratteri, email valida
   - Invio email conferma (se abilitata)
   - Redirect a `/login` con messaggio "Email confermata" dopo click link

2. **Login** (`/login` - modalità "Accedi")
   - Credenziali: email/password OPPURE OAuth (Google/GitHub/Facebook)
   - Verifica email confermata (se richiesta)
   - Redirect a `/dashboard` se dati cliente completati
   - Redirect a `/dashboard/dati-cliente` se dati incompleti

3. **Onboarding Dati Cliente** (`/dashboard/dati-cliente`)
   - **OBBLIGATORIO** prima di accedere al resto del dashboard
   - Campi richiesti: TBD (verificare `app/dashboard/dati-cliente/page.tsx`)
   - Salvataggio flag `datiCompletati = true` in database
   - Redirect automatico a `/dashboard` dopo completamento

4. **Gate Dashboard** (`/dashboard/page.tsx`)
   - Controllo automatico dati cliente completati
   - Se incompleti → redirect a `/dashboard/dati-cliente`
   - Se completati → mostra dashboard

**Note:**
- Utente test `test@spediresicuro.it` bypassa gate dati-cliente
- Flag salvato in `localStorage` per performance (ma controllo primario è database)

---

### 2.2 Flusso Creazione Spedizione

**File di riferimento:**
- `app/dashboard/spedizioni/nuova/page.tsx` (form creazione)
- `app/api/spedizioni/route.ts` (POST - creazione)
- `app/dashboard/spedizioni/page.tsx` (lista)

**Passo-passo:**

1. **Accesso Form** (`/dashboard/spedizioni/nuova`)
   - Due modalità: **Manuale** o **AI Import** (OCR)
   - Progress bar mostra completamento form (%)

2. **Modalità AI Import** (se selezionata)
   - Upload immagine (screenshot WhatsApp, foto documento, etc.)
   - OCR estrae: nome, indirizzo, CAP, città, telefono, email destinatario
   - Popola automaticamente form destinatario
   - File: `components/ocr/ocr-upload.tsx` (TBD - verificare esistenza)

3. **Compilazione Form Manuale**
   - **Mittente:**
     - Nome completo (obbligatorio)
     - Indirizzo (obbligatorio)
     - Città/Provincia/CAP (autocompletamento con `AsyncLocationCombobox`)
     - Telefono (obbligatorio, formato italiano)
     - Email (opzionale)
   - **Destinatario:**
     - Nome completo (obbligatorio)
     - Indirizzo (obbligatorio)
     - Città/Provincia/CAP (autocompletamento)
     - Telefono (obbligatorio se contrassegno attivo)
     - Email (opzionale)
   - **Dettagli Pacco:**
     - Peso (kg) - obbligatorio
     - Dimensioni (lunghezza, larghezza, altezza in cm) - opzionali
     - Tipo spedizione: Standard / Express / Assicurata
     - Corriere: GLS / SDA / Bartolini / Poste Italiane
     - Note (opzionale)
   - **Contrassegno (COD):**
     - Checkbox attiva/disattiva
     - Importo (obbligatorio se attivo)

4. **Validazione e Preview**
   - Validazione real-time campi (icona verde/rossa)
   - Preview ticket spedizione (colonna destra sticky)
   - Calcolo costo stimato
   - AI Routing Advisor suggerisce corriere migliore

5. **Submit** (`POST /api/spedizioni`)
   - Salvataggio in database (`shipments` table)
   - Creazione tracking number
   - Tentativo creazione LDV (Lettera di Vettura) via broker (Spedisci.online)
   - Se LDV OK → download etichetta originale
   - Se LDV KO → generazione ticket PDF locale
   - Addebito wallet (se modello Broker)
   - Redirect a `/dashboard/spedizioni?refresh=true`

6. **Visualizzazione Lista** (`/dashboard/spedizioni`)
   - Refresh automatico lista dopo creazione
   - Filtri: ricerca, status, data, corriere, resi
   - Export: CSV, XLSX, PDF
   - Azioni: visualizza dettagli, download LDV, elimina

**Note:**
- Wallet: regola "No Credit, No Label" (nessuna etichetta senza credito)
- Formato download: PDF o CSV (selezionabile)
- Real-time: aggiornamenti automatici lista via Supabase Realtime

---

### 2.3 Flusso Gestione Wallet

**File di riferimento:**
- `app/dashboard/wallet/page.tsx` (interfaccia wallet)
- `app/api/wallet/transactions/route.ts` (API transazioni)
- `components/wallet/recharge-wallet-dialog.tsx` (dialog ricarica)

**Passo-passo:**

1. **Visualizzazione Wallet** (`/dashboard/wallet`)
   - Saldo corrente (EUR)
   - Statistiche: totale crediti, totale debiti, numero transazioni
   - Lista transazioni (cronologica, più recenti prima)
   - Filtri: tutte / crediti / debiti

2. **Ricarica Wallet** (pulsante "Ricarica")
   - Dialog modale: `RechargeWalletDialog`
   - Upload PDF/immagine bonifico
   - Inserimento importo
   - Creazione richiesta ricarica (`top_up_requests` table)
   - Status: `pending` → attesa approvazione admin
   - Notifica email admin (TBD - verificare)

3. **Approvazione Ricarica** (solo admin/superadmin)
   - Visualizzazione richieste pending (`/dashboard/admin/bonifici` - TBD)
   - Approvazione → incremento wallet via funzione atomica
   - Creazione transazione wallet (`wallet_transactions`)
   - Notifica utente (TBD)

4. **Transazioni Wallet**
   - Tipo: `deposit` (ricarica), `shipment_cost` (spesa spedizione), `admin_gift`, `refund`
   - Visualizzazione: importo, tipo, descrizione, data, saldo dopo transazione
   - Export: TBD

**Note:**
- Operazioni atomiche: `increment_wallet_balance()`, `decrement_wallet_balance()`
- Limiti: max €10.000 per operazione, max €100.000 saldo totale
- Audit trail: tutte le transazioni in `wallet_transactions` (immutabile)

---

### 2.4 Flusso Tracking Spedizione

**File di riferimento:**
- `app/track/[trackingId]/page.tsx` (pagina pubblica tracking)

**Passo-passo:**

1. **Accesso Tracking** (`/track/[trackingId]`)
   - URL pubblico (non richiede autenticazione)
   - Inserimento tracking number o accesso diretto via URL

2. **Visualizzazione Status**
   - Status: `in_transit`, `delivered`, `exception`, `out_for_delivery`
   - Stima consegna
   - Posizione corrente
   - Nome destinatario

3. **Storico Eventi**
   - Lista eventi cronologica (più recenti prima)
   - Ogni evento: data, ora, status, location, descrizione

4. **Upsell** (se implementato)
   - Prodotto suggerito con codice sconto
   - Timer countdown scadenza offerta

**Note:**
- Dati mock attualmente (verificare integrazione API corrieri reali)
- Design ottimizzato per conversioni (CRO)

---

### 2.5 Flusso Import Ordini

**File di riferimento:**
- `app/dashboard/spedizioni/page.tsx` (pulsante "Importa Ordini")
- `components/import/import-orders.tsx` (TBD - verificare)

**Passo-passo:**

1. **Apertura Dialog Import** (`/dashboard/spedizioni`)
   - Pulsante "Importa Ordini"
   - Dialog modale: `ImportOrders`

2. **Upload File**
   - Formato: CSV (verificare formato esatto)
   - Validazione colonne richieste
   - Preview dati prima import

3. **Import Batch**
   - Creazione multiple spedizioni
   - Validazione per ogni riga
   - Report: successi / errori

4. **Visualizzazione Importati**
   - Badge "Importato" su spedizioni create
   - Badge "Verificato" dopo verifica manuale
   - Filtro "Solo importati"

**Note:**
- Formato CSV compatibile con Spedisci.online (verificare struttura)
- Real-time: nuove spedizioni appaiono automaticamente in lista

---

### 2.6 Flusso Scanner LDV (Killer Feature)

**File di riferimento:**
- `app/dashboard/spedizioni/page.tsx` (pulsante "Scanner LDV")
- `components/ScannerLDVImport.tsx` (TBD - verificare)

**Passo-passo:**

1. **Verifica Feature** (`/dashboard/spedizioni`)
   - Controllo killer feature `ldv_scanner_import` attiva
   - Pulsante visibile solo se feature abilitata

2. **Apertura Scanner**
   - Modal fullscreen
   - Accesso camera (mobile/desktop)
   - Scansione barcode/QR code LDV

3. **Import Automatico**
   - Estrazione dati da barcode
   - Creazione spedizione automatica
   - Aggiornamento real-time lista

**Note:**
- Feature richiede abilitazione manuale (admin)
- Real-time: spedizione appare su tutti i dispositivi

---

### 2.7 Flusso Resi

**File di riferimento:**
- `app/dashboard/resi/page.tsx` (lista resi)
- `app/dashboard/scanner-resi/page.tsx` (scanner resi)
- `components/ReturnScanner.tsx` (TBD - verificare)

**Passo-passo:**

1. **Registrazione Reso** (`/dashboard/spedizioni` - pulsante "Registra Reso")
   - Scanner barcode/QR code spedizione originale
   - Creazione spedizione reso (flag `is_return = true`)
   - Collegamento a spedizione originale

2. **Visualizzazione Resi** (`/dashboard/resi`)
   - Lista spedizioni con `is_return = true`
   - Status: `requested`, `processing`, `completed`, `cancelled`
   - Filtri per status

**Note:**
- Badge "Reso" visibile in lista spedizioni
- Real-time: aggiornamenti automatici

---

## 3. Ruoli e Permessi

**File di riferimento:**
- `lib/rbac.ts` (definizione ruoli e permessi)
- `supabase/migrations/006_roles_and_permissions.sql`
- `supabase/migrations/008_admin_user_system.sql`

### 3.1 Gerarchia Ruoli

```
superadmin (massimo livello)
  ├── admin
  │     ├── reseller
  │     │     └── user (base)
  │     └── user
  └── user
```

### 3.2 Ruolo: `user` (Base)

**Permessi:**
- `view_dashboard` - Accesso dashboard
- `create_shipment` - Creazione spedizioni
- `view_shipments` - Visualizzazione proprie spedizioni
- `view_analytics` - Visualizzazione statistiche personali

**Limitazioni:**
- Vede solo le proprie spedizioni (RLS)
- Non può gestire altri utenti
- Wallet limitato a proprie operazioni

**File verificati:**
- `app/dashboard/page.tsx` (dashboard base)
- `app/dashboard/spedizioni/page.tsx` (lista filtrata per user_id)

---

### 3.3 Ruolo: `reseller`

**Permessi (oltre a `user`):**
- `manage_users` - Gestione sub-utenti
- `manage_integrations` - Configurazione integrazioni
- `manage_wallet` - Gestione wallet sub-utenti

**Funzionalità:**
- Creazione sub-utenti (`/dashboard/reseller-team`)
- Visualizzazione statistiche team
- Ricarica wallet sub-utenti
- Gerarchia: reseller → sub-user (via `parent_user_id`)

**File verificati:**
- `app/dashboard/reseller-team/page.tsx`
- `components/reseller-team/*` (TBD - verificare)

**Note:**
- Campo `is_reseller = true` in `users` table
- Campo `parent_user_id` per gerarchia

---

### 3.4 Ruolo: `admin`

**Permessi (oltre a `reseller`):**
- `view_audit_logs` - Visualizzazione log sistema

**Funzionalità:**
- Dashboard admin (`/dashboard/admin`)
- Vista globale utenti e spedizioni
- Gestione configurazioni
- Approvazione ricariche wallet
- Gestione killer features utenti
- Logs sistema

**File verificati:**
- `app/dashboard/admin/page.tsx`
- `app/dashboard/admin/users/[userId]/page.tsx`
- `app/dashboard/admin/logs/page.tsx`

**Note:**
- Può vedere tutte le spedizioni (RLS bypass)
- Può modificare wallet utenti

---

### 3.5 Ruolo: `superadmin`

**Permessi (tutti):**
- `manage_platform` - Gestione completa piattaforma

**Funzionalità:**
- Dashboard super admin (`/dashboard/super-admin`)
- Gestione completa utenti (creazione, eliminazione, promozione)
- Gestione wallet globale
- Bypass "No Credit, No Label" (per testing)
- Configurazione piattaforma

**File verificati:**
- `app/dashboard/super-admin/page.tsx`
- `actions/super-admin.ts` (gestione wallet, utenti)

**Note:**
- Account tipo `account_type = 'superadmin'`
- Può bypassare tutte le restrizioni

---

### 3.6 Verifica Ruoli nel Codice

**Pattern comune:**
```typescript
// Verifica ruolo
const { data: session } = useSession();
const userRole = (session?.user as any)?.role;

// Controllo permesso
if (userRole === 'admin' || userRole === 'superadmin') {
  // Mostra funzionalità admin
}
```

**API RBAC:**
- `lib/rbac.ts`: funzioni `hasRole()`, `hasPermission()`
- Middleware: `middleware.ts` (TBD - verificare protezione route)

---

## 4. Glossario Campi Principali

### 4.1 Spedizione (Shipment)

**Tabella:** `shipments`

| Campo | Tipo | Obbligatorio | Descrizione | Note |
|-------|------|--------------|-------------|------|
| `id` | UUID | Sì | Identificativo univoco | Primary key |
| `user_id` | UUID | Sì | Proprietario spedizione | Foreign key → users |
| `tracking_number` | TEXT | Sì | Numero tracking univoco | Unique constraint |
| `external_tracking_number` | TEXT | No | Tracking corriere esterno | Da API corriere |
| `ldv` | TEXT | No | Lettera di Vettura | Per scansione barcode |
| `status` | ENUM | Sì | Status spedizione | Valori: `draft`, `pending`, `in_preparazione`, `in_transito`, `consegnata`, `eccezione`, `annullata` |
| `sender_name` | TEXT | Sì | Nome mittente | |
| `sender_address` | TEXT | No | Indirizzo mittente | |
| `sender_city` | TEXT | No | Città mittente | |
| `sender_zip` | TEXT | No | CAP mittente | |
| `sender_province` | TEXT | No | Provincia mittente | |
| `sender_country` | TEXT | No | Paese mittente | Default: 'IT' |
| `sender_phone` | TEXT | No | Telefono mittente | |
| `sender_email` | TEXT | No | Email mittente | |
| `recipient_name` | TEXT | Sì | Nome destinatario | |
| `recipient_address` | TEXT | Sì | Indirizzo destinatario | |
| `recipient_city` | TEXT | Sì | Città destinatario | |
| `recipient_zip` | TEXT | Sì | CAP destinatario | |
| `recipient_province` | TEXT | Sì | Provincia destinatario | |
| `recipient_country` | TEXT | No | Paese destinatario | Default: 'IT' |
| `recipient_phone` | TEXT | Sì | Telefono destinatario | Obbligatorio se contrassegno |
| `recipient_email` | TEXT | No | Email destinatario | |
| `weight` | DECIMAL(10,3) | Sì | Peso (kg) | |
| `length` | DECIMAL(10,2) | No | Lunghezza (cm) | |
| `width` | DECIMAL(10,2) | No | Larghezza (cm) | |
| `height` | DECIMAL(10,2) | No | Altezza (cm) | |
| `volumetric_weight` | DECIMAL(10,3) | No | Peso volumetrico | Calcolato |
| `courier_id` | UUID | No | ID corriere | Foreign key → couriers |
| `service_type` | ENUM | Sì | Tipo servizio | Valori: `standard`, `express`, `economy`, `same_day`, `next_day` |
| `cash_on_delivery` | BOOLEAN | Sì | Contrassegno attivo | Default: false |
| `cash_on_delivery_amount` | DECIMAL(10,2) | No | Importo contrassegno | Se COD attivo |
| `insurance` | BOOLEAN | Sì | Assicurazione | Default: false |
| `base_price` | DECIMAL(10,2) | No | Prezzo base | |
| `surcharges` | DECIMAL(10,2) | No | Supplementi | |
| `total_cost` | DECIMAL(10,2) | No | Costo totale | base_price + surcharges |
| `margin_percent` | DECIMAL(5,2) | No | Margine percentuale | Default: 15 |
| `final_price` | DECIMAL(10,2) | No | Prezzo finale cliente | |
| `is_return` | BOOLEAN | Sì | Flag reso | Default: false |
| `created_at` | TIMESTAMPTZ | Sì | Data creazione | |
| `updated_at` | TIMESTAMPTZ | Sì | Data ultimo aggiornamento | |
| `shipped_at` | TIMESTAMPTZ | No | Data spedizione | |
| `delivered_at` | TIMESTAMPTZ | No | Data consegna | |

**File di riferimento:**
- `types/shipments.ts` (interfaccia TypeScript)
- `supabase/migrations/001_complete_schema.sql`
- `supabase/migrations/004_fix_shipments_schema.sql`

---

### 4.2 Destinatario (Recipient)

**Embedded in:** `shipments.recipient_*`

| Campo | Tipo | Obbligatorio | Descrizione | Note |
|-------|------|--------------|-------------|------|
| `recipient_name` | TEXT | Sì | Nome completo | |
| `recipient_type` | ENUM | Sì | Tipo destinatario | Valori: `B2C`, `B2B` (Default: `B2C`) |
| `recipient_address` | TEXT | Sì | Indirizzo completo | |
| `recipient_address_number` | TEXT | No | Numero civico separato | Se indirizzo non include numero |
| `recipient_city` | TEXT | Sì | Città | Autocompletamento disponibile |
| `recipient_zip` | TEXT | Sì | CAP | Autocompletamento disponibile |
| `recipient_province` | TEXT | Sì | Provincia (2 lettere) | Es: "RM", "MI" |
| `recipient_country` | TEXT | No | Paese | Default: 'IT' |
| `recipient_phone` | TEXT | Sì* | Telefono | *Obbligatorio se contrassegno attivo |
| `recipient_email` | TEXT | No | Email | |
| `recipient_notes` | TEXT | No | Note aggiuntive | |
| `recipient_reference` | TEXT | No | Riferimento destinatario | Campo libero |

**Validazione:**
- Telefono: formato italiano (`+39` o `0039` o numero senza prefisso)
- Email: formato standard (se fornita)
- CAP: validazione formato italiano (5 cifre)

**File di riferimento:**
- `app/dashboard/spedizioni/nuova/page.tsx` (form destinatario)
- `components/ui/async-location-combobox.tsx` (autocompletamento città)

---

### 4.3 Corriere (Courier)

**Tabella:** `couriers` (TBD - verificare esistenza)

**Campi principali:**
- `id` (UUID)
- `name` (TEXT) - Es: "GLS", "SDA", "Bartolini", "Poste Italiane"
- `code` (TEXT) - Codice interno
- `active` (BOOLEAN) - Se disponibile

**Corrieri supportati (da codice):**
- GLS
- SDA
- Bartolini
- Poste Italiane
- DHL (TBD - verificare)
- BRT (TBD - verificare)
- UPS (TBD - verificare)

**File di riferimento:**
- `app/dashboard/spedizioni/nuova/page.tsx` (selezione corriere)
- `types/corrieri.ts` (TBD - verificare)

**Note:**
- Integrazione broker: Spedisci.online (verificare configurazione contratti)

---

### 4.4 Wallet (Portafoglio)

**Tabella:** `users.wallet_balance` + `wallet_transactions`

| Campo | Tipo | Obbligatorio | Descrizione | Note |
|-------|------|--------------|-------------|------|
| `wallet_balance` | DECIMAL(10,2) | Sì | Saldo corrente | Default: 0.00, CHECK >= 0 |
| `id` (transazione) | UUID | Sì | ID transazione | Primary key |
| `user_id` | UUID | Sì | Proprietario wallet | Foreign key → users |
| `amount` | DECIMAL(10,2) | Sì | Importo | Positivo: credito, Negativo: debito |
| `type` | TEXT | Sì | Tipo transazione | Valori: `deposit`, `shipment_cost`, `admin_gift`, `refund`, `feature_purchase` |
| `description` | TEXT | No | Descrizione | |
| `reference_id` | UUID | No | ID riferimento | Es: shipment_id |
| `reference_type` | TEXT | No | Tipo riferimento | Es: 'shipment' |
| `created_by` | UUID | No | Chi ha creato | Per admin_gift |
| `created_at` | TIMESTAMPTZ | Sì | Data transazione | |

**Operazioni atomiche:**
- `increment_wallet_balance(user_id, amount)` - Credito
- `decrement_wallet_balance(user_id, amount)` - Debito
- `add_wallet_credit(user_id, amount, description, created_by)` - Credito con audit

**Limiti:**
- Max €10.000 per singola operazione
- Max €100.000 saldo totale
- Saldo non può essere negativo (CHECK constraint)

**File di riferimento:**
- `app/dashboard/wallet/page.tsx` (interfaccia)
- `app/api/wallet/transactions/route.ts` (API)
- `supabase/migrations/040_wallet_atomic_operations.sql` (funzioni atomiche)
- `docs/MONEY_FLOWS.md` (documentazione flussi)

**Note:**
- Regola "No Credit, No Label": nessuna etichetta senza credito (tranne superadmin)
- Audit trail completo: tutte le transazioni immutabili

---

### 4.5 Dati Cliente (Onboarding)

**Tabella:** `dati_cliente` (TBD - verificare nome esatto)

**Campi (TBD - verificare `app/dashboard/dati-cliente/page.tsx`):**
- Nome completo
- Partita IVA (se azienda)
- Indirizzo
- Città/Provincia/CAP
- Telefono
- Email (già in `users.email`)
- Altri campi TBD

**Flag:**
- `datiCompletati` (BOOLEAN) - Se onboarding completato

**File di riferimento:**
- `app/dashboard/dati-cliente/page.tsx`
- `app/api/user/dati-cliente/route.ts` (TBD - verificare)

---

## 5. Open Questions / TBD

### 5.1 Funzionalità Non Verificate

| Funzionalità | Status | Note |
|--------------|-------|------|
| OCR Upload | TBD | Componente `components/ocr/ocr-upload.tsx` - verificare esistenza |
| Import Orders | TBD | Componente `components/import/import-orders.tsx` - verificare esistenza |
| Scanner LDV | TBD | Componente `components/ScannerLDVImport.tsx` - verificare esistenza |
| Return Scanner | TBD | Componente `components/ReturnScanner.tsx` - verificare esistenza |
| AI Routing Advisor | TBD | Componente `components/ai-routing-advisor.tsx` - verificare esistenza |
| Async Location Combobox | TBD | Componente `components/ui/async-location-combobox.tsx` - verificare esistenza |
| Recharge Wallet Dialog | TBD | Componente `components/wallet/recharge-wallet-dialog.tsx` - verificare esistenza |

### 5.2 API Non Verificate

| Endpoint | Status | Note |
|----------|--------|------|
| `GET /api/user/dati-cliente` | TBD | Verificare struttura risposta |
| `POST /api/user/dati-cliente` | TBD | Verificare campi richiesti |
| `GET /api/features/check` | TBD | Verificare formato killer features |
| `GET /api/corrieri/reliability` | TBD | Verificare dati restituiti |
| `POST /api/spedizioni/import` | TBD | Verificare formato CSV richiesto |
| `GET /api/spedizioni/[id]/ldv` | TBD | Verificare formati supportati (PDF/CSV/XLSX) |

### 5.3 Database Schema Non Verificato

| Tabella | Status | Note |
|---------|--------|------|
| `dati_cliente` | TBD | Verificare nome esatto e struttura |
| `couriers` | TBD | Verificare esistenza e campi |
| `wallet_topups` | TBD | Verificare struttura richieste ricarica |
| `price_lists` | TBD | Verificare struttura listini |
| `integrations` | TBD | Verificare struttura integrazioni |
| `killer_features` | TBD | Verificare sistema killer features |

### 5.4 Flussi Non Documentati

| Flusso | Status | Note |
|--------|--------|------|
| Gestione Fatture | TBD | `/dashboard/fatture` - verificare funzionalità |
| Gestione Bonifici | TBD | `/dashboard/bonifici` - verificare funzionalità |
| Gestione Contrassegni | TBD | `/dashboard/contrassegni` - verificare funzionalità |
| Gestione Listini | TBD | `/dashboard/listini` - verificare funzionalità |
| Integrazioni E-commerce | TBD | `/dashboard/integrazioni` - verificare piattaforme supportate |
| OCR Scanner | TBD | `/dashboard/ocr-scanner` - verificare funzionalità |
| Voice Interface | TBD | `/dashboard/voice` - verificare funzionalità |
| Posta | TBD | `/dashboard/posta` - verificare funzionalità |
| Team Management | TBD | `/dashboard/team` vs `/dashboard/reseller-team` - differenze |

### 5.5 Business Logic Non Verificata

| Logica | Status | Note |
|--------|--------|------|
| Calcolo Prezzo | TBD | Verificare formula: base_price + surcharges + margine |
| Margine Configurabile | TBD | Verificare se margine è per-utente o globale |
| Modello BYOC | TBD | Verificare se "Bring Your Own Courier" è implementato |
| Modello Broker | TBD | Verificare integrazione Spedisci.online completa |
| Idempotency | TBD | Verificare sistema idempotency_key per spedizioni |
| Real-time Updates | TBD | Verificare Supabase Realtime subscriptions |

### 5.6 Permessi Non Verificati

| Permesso | Status | Note |
|----------|--------|------|
| `manage_platform` | TBD | Verificare cosa include esattamente |
| `manage_integrations` | TBD | Verificare limitazioni per reseller |
| `view_audit_logs` | TBD | Verificare cosa mostrano i log |
| Gerarchia Reseller | TBD | Verificare se reseller può avere sub-reseller |

### 5.7 UI/UX Non Verificata

| Elemento | Status | Note |
|----------|--------|------|
| Responsive Design | TBD | Verificare ottimizzazione mobile |
| Accessibilità | TBD | Verificare WCAG compliance |
| Localizzazione | TBD | Verificare supporto lingue |
| Dark Mode | TBD | Verificare se supportato |

---

## 6. Note Metodologiche

### 6.1 Fonti Verificate

- ✅ File pagine: `app/**/page.tsx`
- ✅ File API: `app/api/**/route.ts`
- ✅ Schema database: `supabase/migrations/*.sql`
- ✅ Tipi TypeScript: `types/*.ts`
- ✅ RBAC: `lib/rbac.ts`
- ✅ Documentazione: `docs/*.md`

### 6.2 Fonti NON Verificate

- ❌ Componenti React: `components/**/*.tsx` (solo alcuni verificati)
- ❌ Actions: `actions/**/*.ts` (solo alcuni verificati)
- ❌ Hooks: `hooks/**/*.ts` (solo alcuni verificati)
- ❌ Configurazioni: `next.config.js`, `tailwind.config.js`
- ❌ Environment variables: `.env*` (non accessibili)

### 6.3 Assunzioni Evitate

- ❌ Nessuna assunzione su pricing/business model
- ❌ Nessuna assunzione su feature non trovate nel codice
- ❌ Nessuna assunzione su integrazioni esterne non documentate
- ✅ Tutto marcato "TBD" se non verificabile

---

## 7. Prossimi Passi

1. **Verifica Componenti**: Controllare esistenza e funzionalità componenti React menzionati
2. **Verifica API**: Testare endpoint API per validare struttura risposte
3. **Verifica Database**: Eseguire query su schema reale per validare tabelle
4. **Completamento Flussi**: Documentare flussi mancanti (fatture, bonifici, etc.)
5. **Screenshot/Video**: Aggiungere screenshot per ogni pagina principale
6. **Esempi Pratici**: Aggiungere esempi concreti per ogni flusso

---

**Fine Documento**



