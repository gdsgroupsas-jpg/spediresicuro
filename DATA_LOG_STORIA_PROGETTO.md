# SpedireSicuro.it — Enterprise System Blueprint & Audit Log

> **Enterprise-grade technical dossier** basato **esclusivamente** su ciò che è presente nella codebase.  
> Obiettivo: fornire una rappresentazione verificabile del sistema, utile a CTO/Head of Engineering per audit, onboarding tecnico, risk review e decision‑making.

---

## 0) Metodo e perimetro
- **Fonte unica:** repository corrente (codice + documenti presenti).  
- **Nessuna deduzione non supportata** da file reali.  
- **Ogni sezione** è tracciabile con path concreti.

---

## 1) Executive Snapshot (verificabile)
SpedireSicuro.it è un **Logistics Operating System** costruito su **Next.js 14 (App Router)** con backend **Supabase**. Il cuore del sistema è **transazionale e governato** da invarianti: **wallet prepagato**, **idempotency lock**, **compensation queue** e **security fail‑closed**.

**Evidenze principali:**
- **Fail‑closed security** e onboarding gate server‑authoritative: `middleware.ts`.
- **Core spedizioni idempotente con compensazioni**: `lib/shipments/create-shipment-core.ts`.
- **Pagamenti attivi con Stripe**: `lib/payments/stripe.ts`.
- **AI Orchestrator reale con LangGraph**: `lib/agent/orchestrator/graph.ts`.

---

## 2) Architettura reale (Blueprint)

### 2.1 Routing & UI
- **App Router** con pagine pubbliche, legali e dashboard in `app/`.
- Componentistica modulare per aree business, OCR, wallet e dashboard in `components/`.

### 2.2 Security & Auth (Fail‑Closed)
- **NextAuth v5** con Credentials + OAuth (Google/GitHub) in `lib/auth-config.ts`.
- **Middleware deny‑by‑default** per `/dashboard` e `/api/` in `middleware.ts`.
- **Onboarding gate**: utenti autenticati con onboarding incompleto vengono forzati su `/dashboard/dati-cliente`.
- **Security headers + CSP** definiti in `next.config.js`.

### 2.3 Data Layer (Supabase)
- Backend Postgres con RLS e RPC per flussi critici.
- Tabelle specialistiche (es. **geo_locations** per autocompletamento) in `supabase/schema.sql`.

### 2.4 Core Transazionale (Wallet + Spedizioni)
Flusso operativo implementato in `lib/shipments/create-shipment-core.ts`:
1. **Idempotency lock** tramite RPC (`acquire_idempotency_lock`).
2. **Pre‑debito wallet** prima della chiamata al corriere.
3. **Chiamata corriere** e gestione errori.
4. **Persistenza spedizione** in `shipments`.
5. **Compensazione automatica** in caso di fallimento (refund + compensation_queue).

### 2.5 Pagamenti
- **Stripe** è provider attivo per ricariche wallet (`lib/payments/stripe.ts`).
- Gestione transazioni in `payment_transactions` (stato `pending` → `completed`).

### 2.6 AI Logistics Agent
- **LangGraph** con nodi reali (`extract_data`, `validate_geo`, `select_courier`, `calculate_margins`, `save_shipment`) in `lib/agent/orchestrator/graph.ts`.
- Endpoint di ingestion: `app/api/agent/process-shipment/route.ts`.

---

## 3) Invarianti Operative (Governance)
Queste regole sono **enforced in codice** e non opzionali:

1. **No Credit, No Label**
   - Nessuna label viene generata senza credito disponibile.
   - Il debit avviene prima della chiamata corriere.

2. **Idempotency First**
   - Ogni richiesta di creazione spedizione è serializzata da un lock con stati `in_progress / completed / failed`.

3. **Fail‑Closed Security**
   - Accesso a dashboard e API solo con sessione valida.
   - Onboarding obbligatorio e verificato lato server.

4. **Compensation Queue**
   - Ogni fallimento post‑corriere o post‑DB genera record in `compensation_queue` (best‑effort).

---

## 4) Mappa moduli critici (con path verificati)

| Area | Path principali | Descrizione |
|------|------------------|-------------|
| Auth & Session | `lib/auth-config.ts` | Config NextAuth v5, provider, callback, session handling |
| Security Gateway | `middleware.ts` | Fail‑closed, route guard, onboarding gate |
| Spedizioni | `lib/shipments/create-shipment-core.ts` | Idempotency, wallet debit, compensazioni |
| Pagamenti | `lib/payments/stripe.ts` | Stripe checkout + transazioni DB |
| AI Orchestrator | `lib/agent/orchestrator/graph.ts` | LangGraph workflow |
| AI API | `app/api/agent/process-shipment/route.ts` | Ingress OCR/LLM |
| Geo Search | `supabase/schema.sql` | `geo_locations` e indici |

---

## 5) Operazioni & Qualità

### 5.1 Strumenti operativi
La cartella `scripts/` contiene utilità per:
- setup e verifica Supabase,
- smoke tests wallet e flows critici,
- diagnosi errori,
- audit e sync.

### 5.2 Testing & QA
- **Vitest** per unit/integration.
- **Playwright** per E2E, con bypass controllato in modalità test.

---

## 6) Allineamento Documentale (Audit)

**Allineato con la codebase:**
- wallet idempotente + compensation queue,
- orchestrazione AI reale con LangGraph,
- security fail‑closed,
- Stripe attivo come provider pagamenti.

**Gap documentali individuati (README):**
- Link a documenti **non presenti** in repo.
- Riferimenti a pagamenti **XPay** non coerenti con Stripe attivo.

---

## 7) Conclusione (CTO View)
Il repository descrive un sistema **transaction‑first** con policy di sicurezza e resilienza tipiche di infrastrutture enterprise.  
La maturità tecnica risiede soprattutto nella **governance transazionale** (wallet + idempotency), nell’**enforcement dei gate** (auth + onboarding) e nella presenza di una **pipeline AI operativa** integrata nel flusso.  
La priorità di miglioramento non è il core, ma l’**allineamento della documentazione** ai file realmente disponibili.

---

## 8) Nota metodologica
Documento generato **solo** dalla codebase corrente.  
Nessun README precedente o fonte esterna è stata utilizzata.
