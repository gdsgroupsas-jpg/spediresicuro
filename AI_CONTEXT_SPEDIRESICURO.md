# SpedireSicuro.it — CONTEXT COMPLETO (AI-READY)

> Obiettivo di questo file: dare ad altre AI **tutto il contesto pratico** della repo `spediresicuro` (Next.js + Supabase + Automation Service), senza segreti.
>
> ⚠️ Nota sicurezza: **non** includo chiavi, token o password. Dove serve, uso placeholder.

---

## 1) Cos’è SpedireSicuro (in parole semplici)

SpedireSicuro.it è una piattaforma per **creare, gestire e tracciare spedizioni**, con:

- **Dashboard** per utenti, admin, superadmin
- **Preventivi** e logica di prezzo/margine
- **Listini corriere** (price lists) e calcolo tariffe
- **Wallet** (credito / transazioni)
- **Integrazioni** (e-commerce) e automazioni
- **AI “Anne”** (chat assistente) + flusso “agentico” per trasformare **foto / screenshot / testo** in una spedizione
- **Automation Service** separato (Express + Puppeteer) per automatizzare portali esterni (es. Spedisci.Online)
- **Diagnostica/monitoring** centralizzata

---

## 2) Stack tecnico (cosa c’è dentro)

### Frontend + Backend (stessa app Next.js)
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **NextAuth v5** (login: Credentials + OAuth Google/GitHub se configurati)
- **React Query** (presente nelle dipendenze)

### Database
- **Supabase (PostgreSQL)** con:
  - **RLS** (Row Level Security) in molte tabelle
  - funzioni SQL (RPC) per permessi, feature flags, automation locks, ecc.

### AI
- **Anthropic (Claude)** per chat “Anne”
- **Google Gemini** (LangChain + Gemini 2.0 Flash) per flusso multimodale (immagine → estrazione dati)
- **Google Vision** (opzionale) come OCR
- **Tesseract.js** (fallback OCR)

### Automation Service (servizio separato)
- **Node.js + Express**
- **Puppeteer** (browser automation)
- **Supabase** (salvataggio session/diagnostics e sync)
- **Rate limiting** su endpoint critici

---

## 3) Struttura cartelle (mappa mentale)

### Cartelle principali
- `app/` → Next.js App Router (pagine + route API)
- `components/` → componenti UI
- `lib/` → logica “core”: db, supabase, auth, ai, agent/orchestrator, automation
- `actions/` → Server Actions (es. GDPR export/cancellazione account)
- `supabase/` → schema e migrations SQL
- `automation-service/` → servizio Express separato per automazioni
- `scripts/` → script di setup/verifica (Supabase, env, seed geo, ecc.)
- `e2e/` → Playwright tests
- `types/` → tipi TypeScript

### Pagine (App Router)
- Pubbliche: `app/page.tsx`, `app/preventivo`, `app/preventivi`, `app/prezzi`, `app/come-funziona`, `app/contatti`, `app/track/[trackingId]`, pagine legali (privacy/cookie/terms)
- Dashboard: `app/dashboard/*` (spedizioni, listini, integrazioni, wallet, admin, super-admin, ecc.)
- Login: `app/login/page.tsx`

---

## 4) Autenticazione e ruoli (cosa succede davvero)

### NextAuth (file chiave)
- `lib/auth-config.ts`
  - provider **Credentials** (email/password)
  - provider **Google** e **GitHub** se configurati via env
  - callback che:
    - crea/aggiorna utente in tabella `users`
    - sincronizza profilo in `user_profiles`
    - carica nel token/sessione campi come reseller e wallet

### Ruoli / account_type
- Nel DB Supabase esistono campi come `role` e `account_type` (es. `user`, `admin`, `superadmin`).
- Molti endpoint admin verificano:
  - `role === 'admin'` oppure `account_type` `admin/superadmin`.

### Nota importante (sicurezza)
C’è una **auto-promozione superadmin** basata su una lista hardcoded di email:
- Vedi `app/api/auth/promote-superadmin/route.ts` e anche `lib/auth-config.ts` (logica simile)
- Nel contesto AI: **citare il file, non copiare email reali**.

---

## 5) Database: tabelle principali (Supabase)

Queste tabelle sono create dalle migrations in `supabase/migrations/`.

### Tabelle “core” (spedizioni)
- `shipments` → spedizioni (campi destinatario/mittente, prezzi, stato, soft delete, ecc.)
- `shipment_events` → eventi tracking (stato, descrizione, luogo, data)

### Utenti e profili
- `users` → utenti applicazione (role, account_type, wallet_balance, reseller, ecc.)
- `user_profiles` → mapping email ↔ supabase_user_id (utile per multi-tenancy e join con Supabase Auth)

### Feature flags
- `killer_features` → catalogo features
- `user_features` → features attive per singolo utente
- `role_permissions` → accesso features per ruolo
- `platform_features` → toggles “globali” di piattaforma (abilitata/visibile)

### Automation + integrazioni
- `courier_configs` → configurazioni corriere (session_data, automation_settings, contract_mapping, ecc.)
- `automation_locks` → lock per evitare conflitti (manuale vs agent)
- `user_integrations` / `ecommerce_integrations` → credenziali e collegamenti piattaforme (dipende dal flusso)

### Pricing
- `price_lists` → listini
- `price_list_entries` → righe tariffarie

### Wallet
- `wallet_transactions` → movimenti

### Diagnostica
- `diagnostics_events` → eventi di diagnostica (type, severity, context, correlation_id, ecc.)

### Geo
- `geo_locations` → comuni/cap/province (ricerca autocompletamento)

### Altre tabelle presenti (a grandi linee)
- `couriers`, `courier_zone_performance` (qualità/affidabilità)
- `api_versions`, `api_monitors` (monitoraggio versioni API corrieri)
- `audit_logs` (audit)
- `products`, `suppliers`, `warehouses`, `inventory`, `warehouse_movements` (area magazzino/fulfillment)
- `quotes` (preventivi)

---

## 6) Funzioni SQL (RPC) importanti

Dalle migrations risultano funzioni come:
- Lock automation: `check_automation_lock`, `acquire_automation_lock`, `release_automation_lock`, `extend_automation_lock`, `cleanup_expired_locks`
- Feature access: `user_has_feature`, `toggle_user_feature`, `get_user_active_features`
- Platform features: `is_platform_feature_enabled`, `is_platform_feature_visible`
- Gerarchia admin: `get_all_sub_admins`, `get_admin_level`, `update_admin_level`, `can_create_sub_admin`
- Spedizioni: `soft_delete_shipment`, trigger `update_shipments_updated_at`, calcoli volumetrici
- Wallet: `add_wallet_credit`, `deduct_wallet_credit`, `update_wallet_balance`
- GDPR: `anonymize_user_account`, `can_anonymize_user`

---

## 7) API Next.js (Route Handlers) — elenco completo e cosa fanno

Tutte le route sono in `app/api/**/route.ts`.

### Diagnostica / Health
- `GET /api/health` → stato app + check Supabase (degraded se DB non ok)
- `GET /api/diagnostics` → health check semplice diagnostics
- `POST /api/diagnostics` → riceve eventi diagnostici (token `DIAGNOSTICS_TOKEN`) e salva in `diagnostics_events`

### Auth
- `GET/POST /api/auth/[...nextauth]` → NextAuth handlers
- `POST /api/auth/register` → registra utente (salva in `users` via `lib/database`)
- `POST /api/auth/promote-superadmin` → promozione superadmin per email autorizzate (hardcoded)

### Utente
- `GET /api/user/info` → profilo utente + account_type
- `GET/POST /api/user/dati-cliente` → dati cliente (anagrafica/fatturazione)
- `GET/PUT /api/user/settings` → impostazioni (mittente predefinito)

### Spedizioni
- `GET /api/spedizioni` → lista spedizioni (filtrate per utente)
- `GET /api/spedizioni?id=...` → singola spedizione
- `POST /api/spedizioni` → crea spedizione (salva in Supabase) + prova creazione LDV via orchestrator
- `DELETE /api/spedizioni?id=...` → soft delete (Supabase)
- `POST /api/spedizioni/import` → crea spedizione “importata” da CSV/XLS (attenzione mapping tracking/LDV)
- `GET /api/spedizioni/[id]/ldv?format=pdf|csv|xlsx` → download LDV
  - ⚠️ Nota: importa `@/lib/adapters/export` ma **in repo non esiste** (endpoint probabilmente incompleto/broken).

### Export
- `GET /api/export/spediscionline` → CSV nel formato spedisci.online (separator `;`)

### Geo e indirizzi
- `GET /api/geo/search?q=...` → autocompletamento comuni/cap da `geo_locations`
- `POST /api/address/validate` → validazione indirizzo con Google Geocoding (se API key presente)

### OCR + Agent
- `POST /api/ocr/extract` → OCR immagine con adapter auto (Google Vision → Claude Vision → Tesseract)
- `POST /api/agent/process-shipment` → esegue grafo LangGraph:
  - estrazione (Gemini Vision se configurato)
  - validazione geo
  - selezione corriere (basata su performance)
  - calcolo margine
  - salvataggio spedizione

### Anne / Chat AI
- `POST /api/anne/chat` → chat base con Claude (prompt semplice, in italiano)
- `GET /api/anne/chat` → “suggestion” contestuale (semplice)
- `POST /api/ai/agent-chat` → “Anne Executive Business Partner” con tools + context builder + cache + rate limit

### Corrieri
- `GET /api/corrieri/reliability?citta=...&provincia=...` → reliability score
- `POST /api/corrieri/reliability` → suggerimento routing (confronta corriere scelto vs alternative)

### Automation (solo admin/superadmin)
- `POST /api/automation/spedisci-online/sync` → sync session/cookies/contratti (usa `lib/automation/spedisci-online-agent.ts`)

### Cron
- `GET /api/cron/automation-sync` → sync automation (richiede `CRON_SECRET_TOKEN` o header vercel cron)
- `GET /api/cron/trigger-sync` → chiama l’Automation Service per sincronizzare spedizioni (richiede config url/token)

### Feature flags
- `GET /api/features/list` → lista features disponibili/attive
- `GET /api/features/check?feature=...` → check accesso feature
- `GET /api/platform-features/check?feature=...` → check globale platform feature

### Admin
- `GET /api/admin/overview` → “God view” con statistiche globali
- `GET/POST /api/admin/features` → gestione killer features
- `GET/POST /api/admin/platform-features` → gestione platform features
- `DELETE /api/admin/shipments/[id]` → soft delete spedizione come admin
- `DELETE /api/admin/users/[id]` → cancella utente (con cleanup dipendenze)
- `GET /api/admin/users/[id]/features` → lista features per utente

### Wallet
- `GET /api/wallet/transactions` → transazioni wallet (tabella `wallet_transactions`)

### Notifications (PWA)
- `POST /api/notifications/subscribe` → salva subscription in `push_subscriptions` + notifica mock
- `POST /api/notifications/unsubscribe` → rimuove subscription

### Debug / Test
- `GET /api/debug/check-my-account-type` → diagnostica account_type
- `POST /api/test/auth-bypass` → solo test E2E (bloccato in produzione)

---

## 8) Automation Service (servizio separato) — cosa fa

Cartella: `automation-service/`

### Scopo
Automatizzare il portale (es. Spedisci.Online) con Puppeteer per:
- estrarre session cookie e CSRF
- leggere 2FA via email (IMAP)
- sincronizzare spedizioni dal portale e salvarle in Supabase
- inviare eventi di diagnostica

### Endpoint (Express)
- `GET /health` → ok
- `POST /api/sync` → sync configurazione (protetto da token)
- `POST /api/sync-shipments` → sync spedizioni (protetto da token)
- `GET /api/cron/sync` → sync automatica (protetto da token)
- `POST /api/diagnostics` → salva diagnostica (token + rate limit + sanitizzazione PII)

### Sicurezza
- Rate limit su sync e diagnostics
- Token Bearer richiesto
- Sanitizzazione PII (email/telefono) sul payload diagnostico

---

## 9) Variabili d’ambiente (ENV) — lista pratica

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo server)

### NextAuth
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `VERCEL_URL` (usato per auto-detect URL)

### OAuth
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

### AI
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY` (Gemini via LangChain)
- `NEXT_PUBLIC_GEMINI_API_KEY`, `NEXT_PUBLIC_GEMINI_LIVE_ENDPOINT` (voice/live)

### OCR / Google
- `GOOGLE_CLOUD_CREDENTIALS` oppure `GOOGLE_APPLICATION_CREDENTIALS`
- `GOOGLE_MAPS_API_KEY` oppure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

### Automation / Cron
- `AUTOMATION_SERVICE_URL`
- `AUTOMATION_SERVICE_TOKEN`
- `CRON_SECRET_TOKEN`
- `CRON_SECRET` o `VERCEL_CRON_SECRET` (usati dal trigger sync)

### Diagnostics
- `DIAGNOSTICS_TOKEN`

### Sicurezza credenziali
- `ENCRYPTION_KEY` (deve essere la **stessa** tra Next.js e automation-service)

### Push Notifications (PWA)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

### Test
- `PLAYWRIGHT_TEST_MODE`
- `TEST_USER_EMAIL`

### Automation Service (runtime)
- `SUPABASE_URL` (nel servizio separato)
- `PORT`
- `NODE_ENV`

---

## 10) Flussi principali (end-to-end)

### A) Creazione spedizione “manuale”
1. Utente entra in dashboard → `/dashboard/spedizioni/nuova`
2. UI chiama `POST /api/spedizioni`
3. Server:
   - valida campi
   - calcola prezzo base + margine + extra
   - salva in Supabase (`lib/database.addSpedizione`)
   - prova creazione LDV via orchestrator (se configurato)

### B) Import spedizioni da CSV/XLS
1. UI importa righe
2. Per ogni riga: `POST /api/spedizioni/import`
3. Salvataggio come “imported” con attenzione a:
   - `ldv` = tracking number (per Spedisci.Online)

### C) Export CSV per Spedisci.Online
1. Utente clicca export
2. `GET /api/export/spediscionline`
3. Risposta: file CSV con separatore `;`

### D) OCR / Screenshot WhatsApp → spedizione
1. UI invia immagine a `POST /api/agent/process-shipment`
2. LangGraph:
   - estrazione (Gemini Vision) oppure OCR fallback
   - validazione indirizzo
   - selezione corriere (performance)
   - calcolo margine
   - salva spedizione

### E) Sync automatico spedizioni dal portale esterno
1. Vercel Cron chiama `GET /api/cron/trigger-sync`
2. Next.js chiama Automation Service (`/api/sync-shipments`)
3. Automation Service fa scraping e upsert su `shipments`

---

## 11) GDPR (cosa è già implementato)

Da `docs/GDPR_IMPLEMENTATION.md`:
- Cookie banner con consenso granulare (`components/legal/CookieBanner.tsx`)
- Export dati utente (server action `actions/privacy.ts`)
- Cancellazione account con **anonimizzazione** (non delete brutale)
- Pagine legali: privacy/cookie/terms

---

## 12) Comandi utili (package.json)

- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Type check: `npm run type-check`

### Supabase
- Setup: `npm run setup:supabase`
- Verify: `npm run verify:supabase`
- Seed geo: `npm run seed:geo`

### E2E
- `npm run test:e2e`

---

## 13) Punti “delicati” / TODO noti

- **LDV download**: endpoint `GET /api/spedizioni/[id]/ldv` usa `@/lib/adapters/export` che **non esiste** → da implementare o correggere.
- **Upload tariffe**: PDF/OCR immagini nel route `POST /api/price-lists/upload` è marcato TODO (per ora ritorna vuoto).
- **Diagnostics duplicati**: esiste sia `POST /api/diagnostics` in Next.js sia `POST /api/diagnostics` nell’Automation Service. Sono simili ma non identici.

---

## 14) “Mini prompt” per dare questo progetto ad un’altra AI

Copia-incolla questo file e poi chiedi:

- “Leggi `AI_CONTEXT_SPEDIRESICURO.md` e dimmi come funziona il flusso **screenshot WhatsApp → spedizione** indicando file e endpoint coinvolti.”
- “Proponi come implementare `lib/adapters/export` per generare LDV in PDF/CSV/XLSX senza rompere gli endpoint esistenti.”
- “Elenca rischi sicurezza e cosa migliorare (senza cambiare behaviour degli endpoint).”
