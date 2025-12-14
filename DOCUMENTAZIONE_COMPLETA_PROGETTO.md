# 📜 MANIFESTO TECNICO DI PROGETTO - SpedireSicuro.it

> **Versione:** 2.2.0 (Complete Documentation Update)  
> **Data Aggiornamento:** Dicembre 2025  
> **Stato:** 🟢 Produzione / 🟡 Beta (Moduli AI)

---

## 🎯 1. LA VISIONE (Il "Perché")

**SpedireSicuro non è un semplice gestionale.** È un **Sistema Operativo Logistico** guidato dall'Intelligenza Artificiale.

L'obiettivo non è solo permettere agli utenti di spedire pacchi, ma di **azzerare la frizione** tra l'intenzione ("Devo spedire questo") e l'azione (Etichetta stampata e corriere prenotato).

### I Pilastri del Manifesto

1.  **AI-First, non AI-Added**: L'AI non è una feature accessoria, è il cuore. Il sistema è costruito attorno a un grafo decisionale (LangGraph) e modelli multimodali (Gemini 2.0) che vedono, ragionano e agiscono.
2.  **Automazione Radicale**: Se un umano deve fare copia-incolla, abbiamo fallito. Screenshot, PDF, email vengono ingeriti e processati automaticamente.
3.  **Doctor Service (Self-Healing)**: Il sistema si monitora da solo. Se una chiamata API fallisce, il sistema se ne accorge, notifica e tenta di riparare o suggerire fix.
4.  **Ecosistema Finanziario**: Non solo logistica, ma gestione del credito. Wallet ricaricabile, pagamenti diretti (XPay) e gestione fiscale integrata.

---

## 🏗️ 2. SKILLSET & STACK TECNOLOGICO

Per operare su questo progetto è richiesto il seguente profilo tecnico "Full Stack AI Engineer":

### Core Stack

- **Frontend**: Next.js 14 (App Router), React Server Components, TypeScript.
- **Styling**: Tailwind CSS, Shadcn/UI, Framer Motion (Glassmorphism UI).
- **Backend**: Next.js API Routes (Edge/Node), Supabase (PostgreSQL).
- **Auth**: NextAuth.js v5 (Role-Based Access Control).

### AI & Automation Stack

- **LLM Provider**: **Google Gemini 2.0 Flash** (Multimodale: Testo + Vision).
- **Agent Framework**: LangGraph (Orchestrazione a stati: Extraction -> Validation -> Action).
- **Browser Automation**: Puppeteer (su servizio Express standalone) per interazione con portali corrieri legacy.
- **OCR Strategy**: Ibrida (Tesseract.js locale + Gemini Vision per comprensione semantica).

### Infrastructure

- **Database**: Supabase (PostgreSQL con pgvector).
- **Hosting**: Vercel (Frontend), Railway/VPS (Automation Service).
- **Payments**: Integrazione Banca Intesa XPay, Bonifici Smart (Parsing ricevute).

---

## 📦 3. STATO DEL PROGETTO E MODULI

Il sistema è diviso in moduli interconnessi. Ecco lo stato dell'arte attuale:

### 3.1 🧠 Il Cervello: AI "Anne"

_Status: 🟡 Beta Avanzata_

- **Chat Interface**: Assistente virtuale sempre presente in dashboard.
- **Multimodal Input**: Accetta foto di etichette, screenshot di chat WhatsApp.
- **LangGraph Workflow**:
  1.  **Ingestione**: Analisi visuale dell'input.
  2.  **Estrazione**: Identificazione Mittente/Destinatario/Misure.
  3.  **Validazione**: Check CAP/Città, normalizzazione telefoni (+39...).
  4.  **Booking**: Selezione corriere migliore (algoritmo interno smart-routing).

### 3.2 💼 CRM: Sistema Leads

_Status: 🟢 Produzione_

Modulo dedicato all'acquisizione e conversione clienti (Dashboard Admin).

- **Workflow Stati**: New -> Contacted -> Qualified -> Negotiation -> Won/Lost.
- **Gestione**: Assegnazione lead a contatto commerciale, stima valore, note.
- **Conversion**: Un click per convertire un Lead "Won" in un Utente attivo della piattaforma.

### 3.3 💳 Finanza & Wallet

_Status: 🟢 Produzione (Sistema Sicuro Enterprise-Grade)_

Sistema finanziario completo per la gestione del credito prepagato con sicurezza enterprise-grade.

**Componenti**:
- Wallet ricaricabile (XPay + Bonifici Smart)
- Sistema fatturazione integrato
- Audit log completo
- Sicurezza multi-livello

#### 3.3.1 Ricarica Wallet

- **Ricarica XPay**: Integrazione diretta gateway Intesa Sanpaolo (Carte di Credito). Calcolo commissioni dinamico.
- **Smart Top-Up (Bonifico)**:
  - Utente carica PDF/FOTO della distinta di bonifico.
  - **AI Verification**: Il sistema legge l'importo e il CRO dalla ricevuta (Gemini Vision).
  - **Validazioni Server-Side**:
    - Importo: €0.01 - €10.000 (limite massimo per singola operazione)
    - File: JPG/PNG/PDF, max 10MB
    - Rate limiting: max 5 richieste per utente nelle ultime 24h
    - Anti-duplicati: controllo SHA-256 del file e importo+user_id nelle ultime 24h
  - **Workflow Approvazione**:
    - Richiesta creata con `status = 'pending'`
    - Admin visualizza su `/dashboard/admin/bonifici`
    - Approvazione atomica e idempotente (previene doppio accredito)
    - Accredito via RPC `add_wallet_credit()` (unica fonte di verità per saldo)

#### 3.3.2 Sicurezza Wallet (CRITICAL)

**REGOLE NON NEGOZIABILI:**
1. ❌ **VIETATO** aggiornare `users.wallet_balance` direttamente da codice applicativo
2. ✅ **UNICO MODO** per modificare saldo: RPC `add_wallet_credit()` / `deduct_wallet_credit()` oppure INSERT su `wallet_transactions` (trigger aggiorna balance)
3. ❌ **Nessun fallback manuale**: Se RPC fallisce → errore e stop (no bypass)

**Protezioni Implementate:**
- ✅ Limite massimo €10.000 per singola operazione (SQL function)
- ✅ Controllo duplicati (file_hash SHA-256 + importo+user_id/24h)
- ✅ Approvazione atomica (UPDATE con WHERE status IN ('pending','manual_review'))
- ✅ Rollback automatico se accredito RPC fallisce
- ✅ Audit log completo (tutte le operazioni tracciate in `audit_logs`)
- ✅ RLS policies per admin (UPDATE policy su `top_up_requests`)
- ✅ SQL function `approve_top_up_request()` con SECURITY DEFINER (fallback robusto)

#### 3.3.3 Pagina Admin Bonifici

**Path**: `/dashboard/admin/bonifici`

**Funzionalità:**
- Visualizzazione richieste con tabs (In Attesa, Approvate, Rifiutate)
- Dettagli richiesta: importo, utente (email/name), file ricevuta, data
- Azioni:
  - **Approva**: Accredita wallet (con importo personalizzabile)
  - **Rifiuta**: Rifiuta richiesta con motivo
  - **Elimina**: Hard delete solo per richieste pending/manual_review

**File Coinvolti:**
- `app/dashboard/admin/bonifici/page.tsx` - UI React
- `app/actions/topups-admin.ts` - Server actions per lettura (getTopUpRequestsAdmin, getTopUpRequestAdmin)
- `app/actions/wallet.ts` - Server actions per modifica (approveTopUpRequest, rejectTopUpRequest, deleteTopUpRequest)

**⚠️ IMPORTANTE - Struttura File Corretta:**
- `topups-admin.ts` contiene SOLO funzioni di lettura e verifica admin
- `wallet.ts` contiene SOLO funzioni di modifica wallet (approve/reject/delete)
- **NON duplicare funzioni** tra i due file (causa errori build Vercel)

#### 3.3.4 Sistema Fatturazione

_Status: 🟢 Produzione_

- Generazione fatture automatica
- Gestione stato (draft, issued, paid, overdue, cancelled, refunded)
- Integrazione con SDI (Sistema di Interscambio)
- PDF generation automatica
- Tracking pagamenti

**Pagine**: `/dashboard/fatture`, `/dashboard/admin/invoices`  
**Actions**: `app/actions/invoices.ts`  
**Migration**: `025_add_invoices_system.sql`

#### 3.3.5 Consapevolezza Fiscale

Il sistema traccia scadenze (F24, LIPE) e fornisce un contesto fiscale all'AI per rispondere a domande dell'utente.

**Actions**: `app/actions/fiscal.ts`

### 3.4 🚚 Spedizioni & Corrieri

_Status: 🟢 Produzione (Core)_

- **Multi-Corriere**: Integrazione con Spedisci.Online, GLS, BRT, Poste Italiane.
- **Comparatore Prezzi**: Listini dinamici basati su ruolo utente (Reseller vs User).
- **Tracking**: Monitoraggio spedizioni in tempo reale
- **Resi**: Gestione resi e scanner resi
- **Contrassegni**: Gestione contrassegni

**Pagine**: 
- `/dashboard/spedizioni` - Lista spedizioni
- `/dashboard/spedizioni/nuova` - Crea nuova spedizione
- `/dashboard/spedizioni/[id]` - Dettaglio spedizione
- `/dashboard/resi` - Gestione resi
- `/dashboard/scanner-resi` - Scanner resi
- `/dashboard/contrassegni` - Gestione contrassegni

**Actions**: `actions/logistics.ts`, `actions/returns.ts`, `actions/contrassegni.ts`

#### 3.4.1 Reseller System

_Status: 🟢 Produzione_

- Gerarchia: Superadmin -> Reseller -> User
- Reseller vedono solo i propri utenti
- Margini configurabili per reseller
- Wallet separato per reseller

**Pagine**: 
- `/dashboard/super-admin` - Gestione superadmin
- `/dashboard/reseller-team` - Gestione team reseller
- `/dashboard/team` - Gestione team utente

**Actions**: `actions/admin-reseller.ts`, `actions/super-admin.ts`  
**Migration**: `019_reseller_system_and_wallet.sql`

### 3.5 🛡️ Doctor Service & Diagnostica

_Status: 🟢 Produzione_

- **Self-Monitoring**: Tabella `diagnostics_events` che traccia errori, warning e performance.
- **Automation**: Se l'Automation Service crasha o un login corriere fallisce, il Doctor notifica.
- **AI Analysis**: L'AI può analizzare i log per suggerire fix al codice o alla configurazione.

---

## 🗄️ 4. ARCHITETTURA DATI (Supabase)

Schema database PostgreSQL chiave per lo sviluppo:

### 4.1 Tabelle Principali

#### Tabelle Utenti e Autenticazione
- `users`: Profili estesi, collegamenti padre-figlio (Reseller), preferenze, `wallet_balance` (gestito solo da trigger).

#### Tabelle Spedizioni
- `shipments`: Tabella centrale spedizioni. Include campi JSONB per dettagli corrieri.

#### Tabelle CRM
- `leads`: Gestione CRM pre-acquisizione (stati: new, contacted, qualified, negotiation, won, lost).

#### Tabelle Wallet e Pagamenti
- `wallet_transactions`: Storico immutabile di ricariche e spese. **Trigger automatico** aggiorna `users.wallet_balance` su INSERT.
- `top_up_requests`: Richieste di ricarica bonifico.
  - Colonne: `id`, `user_id`, `amount`, `status` (pending/manual_review/approved/rejected)
  - Sicurezza: `file_hash` (SHA-256), `approved_by`, `approved_at`, `approved_amount`
  - Storage: `file_url` (Supabase Storage bucket `receipts`)
- `payment_transactions`: Transazioni XPay (carte di credito).

#### Tabelle Fatturazione
- `invoices`: Fatture emesse (stati: draft, issued, paid, overdue, cancelled, refunded).
- `invoice_items`: Righe fattura.

#### Tabelle Audit e Diagnostica
- `audit_logs`: Audit completo di tutte le operazioni wallet e top-up.
- `diagnostics_events`: Log strutturati (JSONB context) per debugging.

#### Tabelle Corrieri e Configurazioni
- `courier_configs`: Configurazioni corrieri con automation (session_data, automation_settings).
- `price_lists`: Listini prezzi.
- `price_list_entries`: Voci listino prezzi.

### 4.2 Migrazioni Wallet/Top-Up (Ordine Critico)

**⚠️ ORDINE OBBLIGATORIO:**

1. **027_wallet_topups.sql** (PREREQUISITO)
   - Crea tabella `top_up_requests`
   - Crea tabella `payment_transactions`
   - Crea bucket storage `receipts`
   - RLS policies SELECT/INSERT

2. **028_wallet_security_fixes.sql**
   - Aggiunge colonne sicurezza: `file_hash`, `approved_by`, `approved_at`, `approved_amount`
   - Aggiunge limite max €10.000 in `add_wallet_credit()`
   - Indici per ricerca duplicati

3. **029_add_topup_update_policy.sql**
   - Aggiunge RLS policy UPDATE per admin/service_role
   - Permette aggiornamenti da `supabaseAdmin` (service role key)

4. **030_add_topup_approve_function.sql**
   - Crea funzione SQL `approve_top_up_request()` con SECURITY DEFINER
   - Fallback robusto se UPDATE diretto fallisce per RLS

### 4.3 Funzioni SQL Wallet

- `add_wallet_credit(p_user_id, p_amount, p_description, p_created_by)`: Accredita wallet (limite max €10.000)
- `deduct_wallet_credit(p_user_id, p_amount, p_description, p_created_by)`: Addebita wallet
- `approve_top_up_request(p_request_id, p_admin_user_id, p_approved_amount)`: Approva richiesta (bypassa RLS)

**⚠️ IMPORTANTE**: Le funzioni `add_wallet_credit()` e `deduct_wallet_credit()` aggiornano `users.wallet_balance` tramite trigger. **NON modificare manualmente** il campo `wallet_balance`.

---

## 🚀 5. FLUSSI OPERATIVI CHIAVE

### Flusso "Smart Top-Up" (Ricarica Bonifico)

1.  Utente apre dialogo Wallet -> Tab "Bonifico".
2.  Upload PDF/JPG distinta (validazione: tipo, dimensione max 10MB).
3.  Frontend invia file a Server Action `uploadBankTransferReceipt()`.
4.  **Validazioni Server-Side**:
    - File type: JPG/PNG/PDF
    - File size: max 10MB
    - Importo: €0.01 - €10.000
    - Rate limiting: max 5 richieste/24h
    - Anti-duplicati: controllo SHA-256 file_hash e importo+user_id/24h
5.  Gemini AI analizza documento -> Estrae Importo, Data, CRO.
6.  Record creato in `top_up_requests` (Status: `pending`, `file_hash` SHA-256 calcolato).
7.  Audit log: `top_up_request_created`.
8.  Admin visualizza su `/dashboard/admin/bonifici` (tab "In Attesa").
9.  Admin clicca "Approva" → `approveTopUpRequest()`:
    - UPDATE atomico: `status = 'approved'` (solo se status IN ('pending','manual_review'))
    - RPC `add_wallet_credit()` → crea `wallet_transaction` → trigger aggiorna `users.wallet_balance`
    - Se RPC fallisce → rollback a `pending`
    - Audit log: `top_up_request_approved`
10. Utente vede saldo aggiornato in dashboard wallet.

### Flusso "AI Booking" (Anne)

1.  Utente incolla screenshot WhatsApp in chat.
2.  Gemini Vision analizza immagine -> Estrae indirizzo dest e mittente nascosto.
3.  LangGraph valida indirizzi (Geocoding check).
4.  L'AI chiede: "Vuoi assicurare il pacco per 500€ come scritto nella chat?".
5.  Utente conferma -> Spedizione creata in bozza.

---

## 🛠️ 6. SETUP & SVILUPPO

### Variabili d'Ambiente Critiche (.env.local)

```bash
# Core
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...  # CRITICAL: Usato per bypassare RLS in server actions admin

# AI (Cervello)
GOOGLE_API_KEY=...      # Gemini 2.0 Flash Key

# Payments
XPAY_BO_API_KEY=...     # Banca Intesa Backoffice
XPAY_TERMINAL_ID=...    # Terminale POS Virtuale

# Automation
AUTOMATION_SERVICE_URL=http://localhost:3000  # o URL Railway in produzione
ENCRYPTION_KEY=...      # Chiave condivisa per crittografia password corrieri (64 caratteri hex)
AUTOMATION_SERVICE_TOKEN=...  # Token autenticazione automation service
CRON_SECRET_TOKEN=...  # Token cron job

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...  # Genera con: openssl rand -base64 32
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

### Applicazione Migrazioni Wallet

**⚠️ ORDINE OBBLIGATORIO:**

```bash
# 1. PREREQUISITO: Assicurati che 027 sia applicata
npx supabase migration up 027_wallet_topups

# 2. Applica fix sicurezza
npx supabase migration up 028_wallet_security_fixes

# 3. Aggiungi policy UPDATE
npx supabase migration up 029_add_topup_update_policy

# 4. Aggiungi funzione SQL fallback
npx supabase migration up 030_add_topup_approve_function
```

---

## 📁 7. STRUTTURA FILE E ORGANIZZAZIONE

### 7.1 Server Actions Wallet/Top-Up

**⚠️ REGOLA CRITICA - NO DUPLICATI:**

- **`app/actions/wallet.ts`**: 
  - Funzioni di modifica wallet: `approveTopUpRequest()`, `rejectTopUpRequest()`, `deleteTopUpRequest()`
  - Funzioni ricarica: `initiateCardRecharge()`, `uploadBankTransferReceipt()`
  - **NON contiene** funzioni di lettura admin

- **`app/actions/topups-admin.ts`**:
  - Funzioni di lettura: `getTopUpRequestsAdmin()`, `getTopUpRequestAdmin()`
  - Verifica admin: `verifyAdminAccess()`
  - **NON contiene** funzioni di modifica (approve/reject/delete)

**❌ ERRORE COMUNE**: Duplicare funzioni tra i due file causa errori build Vercel (`Module has no exported member`).

**✅ SOLUZIONE**: Import separati nella UI:
```typescript
// ✅ CORRETTO
import { getTopUpRequestsAdmin } from '@/app/actions/topups-admin';
import { approveTopUpRequest } from '@/app/actions/wallet';

// ❌ SBAGLIATO
import { approveTopUpRequest } from '@/app/actions/topups-admin'; // Non esiste lì!
```

### 7.2 Pagine Dashboard

#### Dashboard Utente
- `/dashboard` - Dashboard principale
- `/dashboard/wallet` - Wallet utente (ricarica, storico transazioni)
- `/dashboard/spedizioni` - Lista spedizioni
- `/dashboard/spedizioni/nuova` - Crea nuova spedizione
- `/dashboard/spedizioni/[id]` - Dettaglio spedizione
- `/dashboard/fatture` - Fatture utente
- `/dashboard/fatture/[id]` - Dettaglio fattura
- `/dashboard/resi` - Gestione resi
- `/dashboard/scanner-resi` - Scanner resi
- `/dashboard/contrassegni` - Gestione contrassegni
- `/dashboard/integrazioni` - Configurazione integrazioni
- `/dashboard/impostazioni` - Impostazioni utente
- `/dashboard/dati-cliente` - Dati cliente
- `/dashboard/listini` - Listini prezzi
- `/dashboard/listini/[id]` - Dettaglio listino

#### Dashboard Admin
- `/dashboard/admin` - Dashboard admin
- `/dashboard/admin/bonifici` - Gestione richieste top-up
- `/dashboard/admin/leads` - Gestione leads CRM
- `/dashboard/admin/invoices` - Gestione fatture
- `/dashboard/admin/automation` - Gestione automation
- `/dashboard/admin/configurations` - Configurazioni corrieri
- `/dashboard/admin/logs` - Log diagnostici
- `/dashboard/admin/features` - Gestione feature flags

#### Dashboard Reseller/Superadmin
- `/dashboard/super-admin` - Gestione superadmin
- `/dashboard/reseller-team` - Gestione team reseller
- `/dashboard/team` - Gestione team utente

### 7.3 Migrazioni Supabase

**Path**: `supabase/migrations/`

**Naming**: `NNN_nome_descrittivo.sql` (NNN = numero progressivo)

**Ordine**: Sempre verificare prerequisiti nelle migrazioni (es. 028 richiede 027).

---

## 🔒 8. SICUREZZA E BEST PRACTICES

### 8.1 Wallet Balance (CRITICAL)

**REGOLE NON NEGOZIABILI:**
1. ❌ **MAI** fare `UPDATE users SET wallet_balance = ...` da codice applicativo
2. ✅ **SOLO** RPC `add_wallet_credit()` / `deduct_wallet_credit()` oppure INSERT su `wallet_transactions`
3. ❌ **Nessun fallback manuale**: Se RPC fallisce → errore e stop

**Perché?**
- Il trigger su `wallet_transactions` è l'unica fonte di verità
- Evita race conditions e doppio accredito
- Garantisce audit trail completo

### 8.2 Approvazione Top-Up (Atomica e Idempotente)

**Pattern Implementato:**
```typescript
// UPDATE atomico: solo se status IN ('pending','manual_review')
UPDATE top_up_requests
SET status = 'approved', approved_by = ..., approved_at = NOW()
WHERE id = $1 AND status IN ('pending','manual_review')
RETURNING *;

// Se 0 righe aggiornate → già processata o non trovata
// Se 1 riga aggiornata → procedi con RPC add_wallet_credit()
```

**Benefici:**
- Previene doppia approvazione (race condition)
- Idempotente: chiamare 2 volte ha stesso effetto della prima
- Rollback automatico se RPC fallisce

### 8.3 RLS (Row Level Security)

- `top_up_requests`: Policy SELECT (utente vede solo le proprie), INSERT (utente può creare), UPDATE (solo admin/service_role)
- `wallet_transactions`: Policy SELECT (utente vede solo le proprie)
- `users.wallet_balance`: Non direttamente accessibile, solo via trigger

### 8.4 Audit Log

Tutte le operazioni wallet/top-up sono tracciate in `audit_logs`:
- `top_up_request_created`
- `top_up_request_approved`
- `top_up_request_rejected`
- `wallet_credit_added`
- `wallet_credit_removed`

**Metadata**: Include amount, requestId, targetUser, transactionId, correlationId.

---

## 🧪 9. TESTING

### 9.1 Test Wallet/Top-Up

**Test Manuali Obbligatori:**
1. ✅ Creazione top_up_request valida → status pending
2. ✅ Importo 0 o >10000 → deve fallire server-side
3. ✅ File .exe o >10MB → deve fallire
4. ✅ 6 richieste in 24h → la 6a deve fallire (rate limit)
5. ✅ Approva richiesta → 1 sola wallet_transaction, balance aumenta 1 volta
6. ✅ Doppia approva stessa richiesta → errore "già processata", nessun nuovo accredito
7. ✅ Rifiuta richiesta → status rejected, nessuna transazione wallet
8. ✅ Verifica audit_logs per tutti gli eventi

### 9.2 Test Build Vercel

**Checklist Pre-Deploy:**
- [ ] Nessun import errato (verificare `topups-admin.ts` vs `wallet.ts`)
- [ ] Nessun merge conflict marker (`<<<<<<<`, `=======`, `>>>>>>>`)
- [ ] TypeScript compila senza errori
- [ ] ESLint warnings accettabili (non errori)

---

## 📚 10. DOCUMENTAZIONE AGGIUNTIVA

### Guide Disponibili

- `RIEPILOGO_FIX_APPROVE_TOPUP.md` - Fix completo approvazione top-up (problema produzione)
- `FIX_WALLET_SECURITY_RIEPILOGO.md` - Implementazione sicurezza wallet (PR1-PR5)
- `INVENTARIO_SISTEMA_FINANZIARIO.md` - Inventario completo tabelle/endpoint finance
- `TOPUPS_ADMIN_FALLBACK_AUTH.md` - Fallback auth per top-ups admin (se user non esiste in public.users)

### Automation Service

**Documentazione Completa**: [`docs/AUTOMATION_AGENT_COMPLETA.md`](./docs/AUTOMATION_AGENT_COMPLETA.md)

**Quick Start**: [`automation-service/README.md`](./automation-service/README.md)

**Guide Operative**:
- [`docs/AUTOMATION_SPEDISCI_ONLINE.md`](./docs/AUTOMATION_SPEDISCI_ONLINE.md) - Guida operativa e troubleshooting
- [`automation-service/SICUREZZA.md`](./automation-service/SICUREZZA.md) - Sicurezza e best practices
- [`automation-service/DEPLOY-RAILWAY.md`](./automation-service/DEPLOY-RAILWAY.md) - Deploy su Railway

**Componenti Principali**:
- `automation-service/src/agent.ts` - Classe SOA (agent principale)
- `automation-service/src/index.ts` - Server Express con endpoint
- `lib/automation/spedisci-online-agent.ts` - Versione Next.js integrata
- `actions/automation.ts` - Server Actions per dashboard
- `app/dashboard/admin/automation/page.tsx` - Dashboard UI admin

**Funzionalità**:
- ✅ Estrazione automatica session cookies da Spedisci.Online
- ✅ Gestione login con 2FA (email IMAP o manuale)
- ✅ Sincronizzazione spedizioni dal portale
- ✅ Sistema lock anti-conflitto
- ✅ Crittografia password (AES-256-GCM)
- ✅ Rate limiting e autenticazione endpoint

---

_Questo documento è la Verità. Se il codice differisce da questo documento, il codice deve essere aggiornato o questo documento emendato tramite PR._
