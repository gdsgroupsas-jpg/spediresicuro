# 📜 MANIFESTO TECNICO DI PROGETTO - SpedireSicuro.it

> **Versione:** 2.0.0 (AI-First Era)  
> **Data Aggiornamento:** 14 Dicembre 2025  
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

_Status: 🟢 Produzione_

Sistema finanziario interno per la gestione del credito prepagato.

- **Ricarica XPay**: Integrazione diretta gateway Intesa Sanpaolo (Carte di Credito). Calcolo commissioni dinamico.
- **Smart Top-Up (Bonifico)**:
  - Utente carica PDF/FOTO della distinta di bonifico.
  - **AI Verification**: Il sistema legge l'importo e il CRO dalla ricevuta.
  - Accredito semi-automatico (previa conferma admin o automatico su base trust).
- **Consapevolezza Fiscale**: Il sistema traccia scadenze (F24, LIPE) e fornisce un contesto fiscale all'AI per rispondere a domande dell'utente.

### 3.4 🚚 Spedizioni & Corrieri

_Status: 🟢 Produzione (Core)_

- **Multi-Corriere**: Integrazione con Spedisci.Online, GLS, BRT, Poste.
- **Comparatore Prezzi**: Listini dinamici basati su ruolo utente (Reseller vs User).
- **Reseller System**:
  - Gerarchia: Superadmin -> Reseller -> User.
  - I Reseller vedono solo i propri utenti e guadagnano sui margini configurati.

### 3.5 🛡️ Doctor Service & Diagnostica

_Status: 🟢 Produzione_

- **Self-Monitoring**: Tabella `diagnostics_events` che traccia errori, warning e performance.
- **Automation**: Se l'Automation Service crasha o un login corriere fallisce, il Doctor notifica.
- **AI Analysis**: L'AI può analizzare i log per suggerire fix al codice o alla configurazione.

---

## 🗄️ 4. ARCHITETTURA DATI (Supabase)

Schema database PostgreSQL chiave per lo sviluppo:

- `users`: Profili estesi, collegamenti padre-figlio (Reseller), preferenze.
- `shipments`: Tabella centrale spedizioni. Include campi JSONB per dettagli corrieri.
- `leads`: (Nuova) Gestione CRM pre-acquisizione.
- `wallet_transactions`: Storico immutabile di ricariche e spese.
- `wallet_topups`: Richieste di ricarica (Stato: pending -> approved/rejected) con link alle ricevute.
- `diagnostics_events`: Log strutturati (JSONB context) per debugging.

---

## 🚀 5. FLUSSI OPERATIVI CHIAVE

### Flusso "Smart Top-Up" (Ricarica Bonifico)

1.  Utente apre dialogo Wallet -> Tab "Bonifico".
2.  Upload PDF/JPG distinta.
3.  Frontend invia file a Server Action.
4.  Gemini AI analizza documento -> Estrae Importo, Data, CRO.
5.  Record creato in `wallet_topups` (Status: `pending_verification`).
6.  Admin riceve notifica -> Approva -> Transazione scritta in `wallet_transactions` -> Saldo aggiornato.

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
SUPABASE_SERVICE_ROLE_KEY=...

# NextAuth
NEXTAUTH_URL=http://localhost:3000  # ⚠️ Solo per sviluppo locale
NEXTAUTH_SECRET=...

# AI (Cervello)
GOOGLE_API_KEY=...      # Gemini 2.0 Flash Key

# Payments
XPAY_BO_API_KEY=...     # Banca Intesa Backoffice
XPAY_TERMINAL_ID=...    # Terminale POS Virtuale

# Automation
AUTOMATION_SERVICE_URL=http://localhost:3000
```

### 🚀 Percorsi di Sviluppo

Il progetto supporta **due percorsi di sviluppo** a seconda delle tue esigenze:

#### **Percorso 1: Sviluppo con Supabase Cloud** (Consigliato per iniziare)

**Requisiti:**
- ✅ Account Supabase Cloud (gratuito)
- ✅ File `.env.local` configurato con credenziali Supabase Cloud
- ❌ **NON richiede Docker**

**Setup:**
```bash
# 1. Verifica configurazione
npm run setup:check

# 2. Avvia sviluppo
npm run dev
```

**Verifiche:**
- ✅ `npm run check:env:simple` → PASS
- ✅ `npm run check:errors` → PASS
- ⚠️ `npx supabase status` → WARN (Docker non necessario)

**Vantaggi:**
- Setup rapido (no Docker)
- Database cloud sempre disponibile
- Ideale per sviluppo collaborativo

---

#### **Percorso 2: Sviluppo con Supabase Locale**

**Requisiti:**
- ✅ Docker Desktop installato e in esecuzione
- ✅ File `.env.local` configurato
- ✅ Supabase CLI installato (`npm install -g supabase`)

**Setup:**
```bash
# 1. Avvia Supabase locale
npx supabase start

# 2. Verifica configurazione
npm run setup:check

# 3. Avvia sviluppo
npm run dev
```

**Verifiche:**
- ✅ `npm run check:env:simple` → PASS
- ✅ `npm run check:errors` → PASS
- ✅ `npx supabase status` → PASS

**Vantaggi:**
- Database locale isolato
- Controllo completo su migrations
- Ideale per test offline

---

### 📋 Comandi Utili

```bash
# Verifica setup completo (consigliato prima di iniziare)
npm run setup:check

# Sviluppo
npm run dev          # Avvio Next.js

# Verifiche
npm run check:env:simple  # Verifica variabili .env.local
npm run check:errors      # Verifica errori nel log

# Supabase (solo se locale)
npx supabase status      # Verifica Supabase locale
npx supabase start       # Avvia Supabase locale
npx supabase stop        # Ferma Supabase locale
```

---

_Questo documento è la Verità. Se il codice differisce da questo documento, il codice deve essere aggiornato o questo documento emendato tramite PR._
