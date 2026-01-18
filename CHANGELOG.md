# Changelog

Tutte le modifiche significative al progetto SpedireSicuro sono documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## Versioning Strategy

Questo progetto segue [Semantic Versioning 2.0.0](https://semver.org/):

- **Major (X)**: Breaking changes, major architectural shifts
- **Minor (Y)**: New features, backward compatible
- **Patch (Z)**: Bug fixes, security patches

## Release Process

1. Tutte le modifiche significative vanno in `[Unreleased]`
2. Al deploy in produzione, spostare il contenuto in nuova sezione `[X.Y.Z]`
3. Aggiungere data alla release
4. Creare nuova sezione vuota `[Unreleased]`

---

## [Unreleased]

Ultimo aggiornamento: 2026-01-18

### Added
- **Health Readiness/Liveness** - Nuovi endpoint `/api/health/ready` e `/api/health/live` per probe uptime/dep readiness
- **VAT Semantics in Price Lists (ADR-001)** - Implementazione semantica IVA esplicita nei listini prezzi (FASE 0-8 completata)
  - Colonne `vat_mode` e `vat_rate` aggiunte a `price_lists` e `shipments` (migration 110)
  - Supporto prezzi con IVA inclusa o esclusa
  - Utility functions per normalizzazione e calcolo IVA (`lib/pricing/vat-utils.ts`)
  - Calcolo margine sempre su base IVA esclusa (Invariant #1)
  - Fix critico: gestione corretta margine 0 quando master e custom hanno `vat_mode` diversi
  - Fix critico: Surcharges seguono `vat_mode` del listino (non sempre IVA esclusa)
  - Backward compatibility completa (NULL = 'excluded')
  - Quote API: campi VAT opzionali aggiunti (FASE 4)
  - UI: Badge VAT con feature flag `NEXT_PUBLIC_SHOW_VAT_SEMANTICS` (FASE 5)
  - Shipment creation: persistenza VAT context (FASE 6)
  - Data migration: legacy → explicit (migration 111, conservativa) (FASE 7)
  - Test suite enterprise-grade: 62 unit test + integration + regression (FASE 8)
  - Manual testing checklist completa
  - Documentazione: ADR-001, Implementation Plan, Migration Memory aggiornato
  - **Fix post-implementazione (16/01/2025):**
    - Fix display costo fornitore: aggiunto `supplierPriceOriginal` per mostrare prezzo master nella modalità VAT corretta
    - Fix matching entry matrice: migliorata selezione entry più specifica per fasce di peso sovrapposte
    - Logging dettagliato per debug matching entry e prezzi fornitore

### Added
- **AI Capabilities Toggle** - Toggle per abilitare/disabilitare capabilities AI di Anne nella dashboard admin
  - Componente `AiFeaturesCard` nella pagina admin
  - Toggle specifico per "Gestione Listini" (price list management)
  - Actions `updateUserAiFeatures` per aggiornare metadata utente
  - Refresh automatico stato locale dopo toggle
  - Commits: 9df1a86, 11c331c, a4a31e1, 5dc5791, fd7de78, 88ac7fe

- **Anne Price List Management** - Abilitazione dell'agente Anne alla gestione dei listini prezzi
  - Strumenti AI: `search_master_price_lists`, `clone_price_list`, `assign_price_list`
  - Worker: `price-list-manager` per gestione intenti complessi
  - Sicurezza RBAC: Superadmin accesso completo, Reseller accesso negato di default
  - Graph integration: nodo `price_list_worker` in pricing-graph.ts
  - Documentazione: `docs/ANNE_PRICE_LIST_CAPABILITIES.md`

- **Reseller Personalized Price Lists** - Sistema enterprise-grade per reseller con listini personalizzati
  - Clone supplier price lists con custom margins (percent o fixed)
  - Creazione listini vuoti con import CSV
  - Operazioni CRUD complete per price list entries
  - UI matrix-style per preview e editing manuale
  - Enterprise audit trail con logging completo
  - Integrazione con preventivatore intelligente
  - Miglioramenti matching geografico zone/provincia/regione

### Fixed
- **Admin Overview KPI** - KPI admin server-side via RPC con filtri no-limit e esclusione cancellate/test (salva include testspediresicuro+)
- **Admin Overview Data Quality** - Lista spedizioni ora esclude soft-delete/cancellate; detection test include tracking con `TEST`; query utenti con fallback colonne opzionali
- **Metadata Column Missing** - Risolto problema colonna metadata mancante usando `auth.users` invece di `users` (5dc5791)
- **Supabase Client** - Usa client Supabase corretto e migliora log errori (fd7de78)
- **Local State Update** - Aggiorna stato locale con metadata freschi dopo toggle (11c331c)
- **Dashboard Refresh** - Refresh automatico dashboard dopo toggle AI features (a4a31e1)
- **TypeScript Build Error** - Risolto errore TS su assegnazione potenzialmente undefined (9c85761)
- **Service Accessori Format** - Formato corretto: array numeri `[200001]` invece di stringhe
- **Validazione Corriere Obbligatorio** - Pulsante "Genera Spedizione" disabilitato senza selezione corriere
- **Multi-Configurazione Spedisci.Online** - Rimosso deduplicazione errata che filtrava config valide
- **Creazione Spedizione Refresh** - Reset cache quote comparator + ricaricamento corrieri dopo reset
- **Refresh Lista Spedizioni** - Ottimizzato con timestamp invece di `cache: 'no-store'`

### Security
- 🔒 Metadata access limitato a service role solo
- 🔒 Audit logging per tutte le operazioni toggle AI
- 🔒 Rimozione endpoint di test esposti in produzione (redis, supabase, spedisci-online)
- 🔒 Bloccato PLAYWRIGHT_TEST_MODE bypass in produzione

### Documentation
- Aggiornato `MIGRATION_MEMORY.md` con Anne price list capabilities
- Documentazione completa per reseller personalized price lists (PR#43)
- Documentazione AI features toggle workflow

---

## [0.3.1] - 2026-01-02

### Added
- **Anne Price List Management** - Abilitazione dell'agente Anne alla gestione dei listini prezzi
  - Strumenti AI: `search_master_price_lists`, `clone_price_list`, `assign_price_list`
  - Worker: `price-list-manager` per gestione intenti complessi
  - Sicurezza RBAC: Superadmin accesso completo, Reseller accesso negato di default
  - Graph integration: nodo `price_list_worker` in pricing-graph.ts
  - Documentazione: `docs/ANNE_PRICE_LIST_CAPABILITIES.md`

### Changed
- **MIGRATION_MEMORY.md** - Aggiornato con Anne price list capabilities

---

## [0.3.0] - 2025-12-27

### Added
- **Dynamic Platform Fees** - Fee configurabili per utente
  - DB migration 050: colonna `platform_fee_override`, tabella `platform_fee_history`
  - Service layer `lib/services/pricing/platform-fee.ts`
  - Worker integration: BookingWorker applica fee dinamica
  - SuperAdmin UI: `CurrentFeeDisplay`, `UpdateFeeDialog`, `FeeHistoryTable`

- **Fase 2.8: SuperAdmin UI** - Gestione platform fee via UI

### Fixed
- **Platform Fee Audit** - Fix foreign key constraint in audit history

---

## [0.2.0] - 2025-12-20

### Added
- **OCR Immagini** - Integrazione Gemini Vision per OCR da immagini
  - Vision support con max 1 retry per errori transient
  - Fallback: clarification request immediata
  - 10 immagini test processate, 90% confidence
  - Test integration: 13 test passati

- **Booking Worker** - Prenotazione spedizioni con preflight checks
  - Pre-flight check: verifica recipient/parcel/pricing_option
  - Conferma esplicita utente via pattern matching
  - Test integration: 30 test passati

---

## [0.1.0] - 2025-12-01

### Added
- **LangGraph Supervisor Architecture** - Orchestrazione AI Anne con LangGraph
  - Supervisor Router come entry point unico
  - Workers: OCR, Address, Pricing, Booking
  - Telemetria strutturata
  - Rate limiting distribuito (Upstash Redis)

- **Address Worker** - Normalizzazione indirizzi italiani
  - Estrazione CAP, provincia, città
  - Schema Zod per validazione
  - Test: 107 test passati

- **OCR Worker** - Estrazione dati da testo
  - Parsing deterministico con regex
  - Output `ShipmentDraft` con missing fields
  - Test: 25 test passati

- **Pricing Worker** - Calcolo preventivi multi-corriere
  - Single source of truth: `lib/pricing/calculator.ts`
  - Contract tests: 18 test passati

### Changed
- **MIGRATION_MEMORY.md** - Creato come Single Source of Truth per migrazione Anne

---

## Note per Sviluppatori

### Vulnerabilità Note (Non Fixabili senza Breaking Changes)
- `xlsx` - Prototype Pollution (no fix disponibile, considerare migrazione)
- `jspdf/dompurify` - Richiede major upgrade
- `vercel CLI` - Solo dev dependency
- `glob` - Richiede eslint-config-next 16.x

### Prossimi Passi Prioritari
1. Valutare migrazione da `xlsx` a `exceljs`
2. Implementare CSP reporting endpoint
3. Configurare WAF (Cloudflare/Vercel)

---

**Vedi anche:**
- [MIGRATION_MEMORY.md](MIGRATION_MEMORY.md) - Architettura AI Anne dettagliata
- [docs/README.md](docs/README.md) - Indice documentazione completo
