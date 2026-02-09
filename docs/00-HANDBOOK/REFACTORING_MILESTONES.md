# Refactoring Milestones - SpedireSicuro

## Obiettivo

Ridurre complessità e debito tecnico nei moduli critici identificati dall'audit.

---

## Milestone 1: VAT Logic Consolidation ✅

**Target:** Eliminare duplicazione logica IVA
**Completato:** 2026-02-05

### Deliverables

- [x] Creare `lib/pricing/vat-handler.ts` con funzioni pure
- [x] Sostituire 5+ occorrenze duplicate in `price-lists-advanced.ts`
- [x] Test unit parametrici per tutti i casi VAT (22 test)
- [x] Test verdi su tutta la suite (1175 unit + 195 integration)

### File coinvolti

- `lib/db/price-lists-advanced.ts` (refactored)
- `lib/pricing/vat-utils.ts` (esistente)
- `lib/pricing/vat-handler.ts` (nuovo)
- `tests/unit/vat-handler.test.ts` (nuovo)

### Impatto ottenuto

- ~60 righe di codice duplicate rimosse
- 3 funzioni helper riusabili (`normalizePricesToExclVAT`, `normalizeCustomAndSupplierPrices`, `isManuallyModified`)
- Un solo punto di manutenzione per pattern di normalizzazione VAT

---

## Milestone 2: Pricing Decomposition ✅

**Target:** Spezzare `calculateWithDefaultMargin()` da 670 righe
**Completato:** 2026-02-05

### Deliverables

- [x] Estrarre `recoverMasterListPrice()`
- [x] Estrarre `calculateMatrixPrice()`
- [x] Estrarre `determineSupplierPrice()`
- [x] Test unit per pricing helpers (12 test)
- [x] Test verdi su tutta la suite (1187 unit + 195 integration)

### File coinvolti

- `lib/db/price-lists-advanced.ts` (refactored)
- `lib/pricing/pricing-helpers.ts` (nuovo)
- `tests/unit/pricing-helpers.test.ts` (nuovo)

### Impatto ottenuto

- 3 funzioni helper estratte e testate
- ~100 righe di logica complessa modularizzate
- Responsabilità ben separate (master recovery, matrix calc, supplier determination)

---

## Milestone 3: Workspace Integration in Pricing ✅

**Target:** Multi-tenant safety nel calcolo prezzi
**Completato:** 2026-02-05

### Deliverables

- [x] Aggiungere `workspace_id` filter in `getApplicablePriceList()`
- [x] Aggiungere `workspace_id` filter in `calculatePriceWithRules()`
- [x] Scope cache master list per workspace
- [x] Test multi-tenant isolation (12 test)
- [x] Test security price-lists isolation (12 test)
- [x] RLS migration per nascondere listini supplier globali
- [x] Test verdi su tutta la suite (1199 unit)

### File coinvolti

- `lib/db/price-lists-advanced.ts` (refactored)
- `lib/services/pricing/pricing-service.ts` (refactored)
- `lib/services/pricing/calculate-from-pricelist.ts` (refactored)
- `lib/engine/fulfillment-orchestrator.ts` (refactored)
- `lib/ai/tools.ts` (refactored)
- `actions/price-lists.ts` (refactored)
- `app/api/quotes/*.ts` (refactored)
- `app/api/spedizioni/route.ts` (refactored)
- `tests/unit/pricing-workspace-isolation.test.ts` (nuovo)
- `tests/security/price-lists-isolation.test.ts` (nuovo)
- `supabase/migrations/20260205120000_fix_price_lists_rls_hide_supplier.sql` (nuovo)

### Impatto ottenuto

- Cache `masterListCache` scoped per workspace (chiave: `{workspaceId}:{masterListId}`)
- Filtro workspace in tutte le query pricing
- Listini globali (workspace_id=NULL) accessibili ma supplier globali nascosti ai reseller
- 24 nuovi test (12 isolation + 12 security)

---

## Milestone 4: Unified Logging ✅

**Target:** Logging strutturato e parsabile
**Completato:** 2026-02-05

### Deliverables

- [x] Creare `lib/logging/price-logger.ts` con logger strutturato
- [x] Livelli configurabili (PRICE_LOG_LEVEL=debug|info|warn|error)
- [x] Verbose mode disabilitabile (PRICE_LOG_VERBOSE=false)
- [x] JSON output per parsing in produzione (PRICE_LOG_JSON=true)
- [x] Context automatico (operation, priceListId, workspaceId, userId)
- [x] Helper functions (logPricingDetails, logPricingError)
- [x] Integrazione in pricing-helpers.ts
- [x] Test verdi su tutta la suite (1219 unit, +20 nuovi test logger)

### File coinvolti

- `lib/logging/price-logger.ts` (nuovo)
- `lib/pricing/pricing-helpers.ts` (refactored)
- `tests/unit/price-logger.test.ts` (nuovo)

### Impatto ottenuto

- Logger strutturato con livelli e contesto
- Log parsabili JSON per monitoring in produzione
- Verbose mode per debug dettagliato disabilitabile
- 20 nuovi test per il modulo logger

---

## Milestone 5: Caching Strategy Unification ✅

**Target:** Cache layer centralizzato
**Completato:** 2026-02-05

### Deliverables

- [x] Creare `lib/cache/pricing-cache.ts`
- [x] Unificare TTL (30s master-list, 5min quote, 1min price-list → tutti configurabili)
- [x] Invalidation strategy esplicita (per workspace, tipo, pattern, età)
- [x] Test cache hit/miss/invalidation (34 test)
- [x] Test verdi su tutta la suite (1253 unit)

### File coinvolti

- `lib/cache/pricing-cache.ts` (nuovo)
- `tests/unit/pricing-cache.test.ts` (nuovo)

### Impatto ottenuto

- Cache centralizzata con TTL configurabili via env:
  - `PRICING_CACHE_DEFAULT_TTL` (default: 30s)
  - `PRICING_CACHE_MASTER_TTL` (default: 30s)
  - `PRICING_CACHE_QUOTE_TTL` (default: 5min)
  - `PRICING_CACHE_PRICELIST_TTL` (default: 1min)
  - `PRICING_CACHE_MAX_ENTRIES` (default: 1000)
  - `PRICING_CACHE_DEBUG` (default: false)
- Workspace scoping per isolamento multi-tenant
- LRU eviction quando cache è piena
- Statistiche (hit rate, size per tipo/workspace)
- Helper functions (`withMasterListCache`, `buildQuoteCacheKey`)
- 34 nuovi test

---

## Security Hardening ✅

**Target:** Fix vulnerabilità identificate da code review severa
**Completato:** 2026-02-06

### Fix CRITICAL

| Issue                             | File                      | Fix                                           |
| --------------------------------- | ------------------------- | --------------------------------------------- |
| Division by zero con vatRate=-100 | `vat-utils.ts`            | Input validation: vatRate deve essere [0,100] |
| NaN/Infinity propagation          | `vat-utils.ts`            | `assertFinitePositive()` su tutti gli input   |
| Floating point precision          | `vat-utils.ts`            | `roundToTwoDecimals()` su tutti i risultati   |
| Cache invalidation totale         | `pricing-cache.ts`        | Blocco keyPattern vuoto                       |
| Info sensibili nei log            | `price-logger.ts`         | PII scrubbing in produzione                   |
| LRU errato (insertion order)      | `price-lists-advanced.ts` | LRU basato su `accessTime`                    |

### Fix HIGH

| Issue                        | File               | Fix                                   |
| ---------------------------- | ------------------ | ------------------------------------- |
| parseInt NaN su env invalide | `pricing-cache.ts` | `parseEnvInt()` con fallback          |
| Cache key collision          | `pricing-cache.ts` | `escapeCacheKeyPart()` per separatore |

### Test aggiunti

- `tests/unit/vat-utils-critical.test.ts` - 29 test input validation
- `tests/unit/validators.test.ts` - 16 test SQL injection prevention

### Impatto

- Prevenzione errori runtime su input malformati
- Precisione finanziaria garantita (2 decimali)
- Nessun leak di dati sensibili in produzione
- Cache thread-safe con eviction corretta

---

## Wallet Refund Accounting ✅

**Target:** Tracciabilita contabile completa per rimborsi wallet
**Completato:** 2026-02-06

### Problema

I rimborsi cancellazione spedizione usavano `increment_wallet_balance()` che registra
transazioni con tipo `DEPOSIT`. Impossibile distinguere ricariche volontarie da rimborsi
nello storico movimenti. Per un operatore finanziario questo e inaccettabile.

### Soluzione (standard enterprise: Stripe, PayPal)

Ogni movimento economico ha la sua controparte contabile distinta:

| Evento                   | Funzione SQL               | Tipo transazione  |
| ------------------------ | -------------------------- | ----------------- |
| Creazione spedizione     | `decrement_wallet_balance` | `SHIPMENT_CHARGE` |
| Cancellazione spedizione | `refund_wallet_balance`    | `SHIPMENT_REFUND` |
| Ricarica wallet          | `increment_wallet_balance` | `DEPOSIT`         |

### Deliverables

- [x] Nuova funzione SQL `refund_wallet_balance()` con tipo `SHIPMENT_REFUND`
- [x] Idempotenza via `idempotency_key` (previene doppi rimborsi)
- [x] Lock pessimistico `FOR UPDATE NOWAIT` (concurrency-safe)
- [x] Reference tracking: `reference_id` (shipment_id) + `reference_type` (shipment_cancellation)
- [x] Aggiornati 3 percorsi rimborso: user cancel, admin cancel, compensazione errore corriere
- [x] Skip rimborso per superadmin (wallet non debitato alla creazione)
- [x] Compensation queue come fallback se rimborso fallisce
- [x] 25 test di coerenza contabile
- [x] Migration applicata in produzione
- [x] Test verdi su tutta la suite (1348 unit)

### File coinvolti

- `supabase/migrations/20260206100000_wallet_refund_function.sql` (nuovo)
- `app/api/spedizioni/route.ts` (refactored: `increment` → `refund`)
- `app/api/admin/shipments/[id]/route.ts` (refactored: `increment` → `refund`)
- `lib/shipments/create-shipment-core.ts` (refactored: `increment` → `refund`)
- `tests/unit/wallet-refund-accounting.test.ts` (nuovo)

### Impatto

- Ogni euro in entrata/uscita dal wallet ha tipo contabile distinto
- Storico movimenti leggibile: il cliente vede "Rimborso cancellazione spedizione XY"
- Audit trail completo: chi ha rimborsato, quando, per quale spedizione
- Idempotenza: retry sicuri senza doppi accrediti
- Standard enterprise (Stripe, PayPal registrano OGNI movimento con tipo dedicato)

---

## Reseller Team Navigation ✅

**Target:** Esperienza reseller coerente — navigazione, settings, eliminazione pagine legacy
**Completato:** 2026-02-06

### Problema

L'infrastruttura workspace/team era completa (DB, API, types, auth, pagina team, invite flow)
ma l'esperienza reseller era frammentata:

- "Team Workspace" sepolto in "Il Mio Account" in fondo alla sidebar
- Pagina legacy `/dashboard/reseller-team` confondeva con la nuova `/dashboard/workspace/team`
- Nessuna pagina "Impostazioni Workspace" per panoramica

### Deliverables

- [x] Spostare "Il Mio Team" e "Impostazioni Workspace" nella sezione "Gestione Business"
- [x] Guard anti-duplicazione: reseller non vede `workspace-team` in "Il Mio Account"
- [x] Redirect pagina legacy `reseller-team` → `reseller/clienti`
- [x] Nuova pagina Workspace Settings (read-only): info workspace, organizzazione, wallet, team count, ruolo e permessi
- [x] 29 nuovi test (7 navigazione + 22 workspace settings)
- [x] Test verdi su tutta la suite (1377 unit)

### File coinvolti

- `lib/config/navigationConfig.ts` (refactored)
- `app/dashboard/reseller-team/page.tsx` (sostituito con redirect)
- `app/dashboard/workspace/settings/page.tsx` (nuovo)
- `tests/unit/navigationConfig.test.ts` (aggiornato)
- `tests/unit/workspace-settings.test.ts` (nuovo)

### Review sicurezza

- Pagina settings read-only, nessuna mutazione
- Permission check `settings:view` prima del render
- Fetch members protetto server-side (auth + `members:view`)
- Nessun dato di terzi esposto (solo info proprie dell'utente)
- Nessuna email nei log (GDPR)

---

## WelcomeGate — Onboarding Cinematografico ✅

**Target:** Primo impatto memorabile per ogni nuovo utente
**Completato:** 2026-02-06

### Problema

Il primo login mostrava un banale "Benvenuto!" con checkmark verde. Zero emozione,
zero brand identity. Stessa esperienza per invitati, reseller e utenti normali.

### Soluzione

Animazione cinematografica in 3 fasi (~5.5s):

1. **Logo prende vita** — anello SVG si disegna (stroke-dasharray), freccia scatta con spring bounce, pulse ring
2. **Anne parla** — typing effect personalizzato ("Ciao Marco!", "Benvenuto nel team di Acme Logistics")
3. **Fade-out** → redirect alla dashboard

### Deliverables

- [x] `lib/welcome-gate-helpers.ts` — funzioni pure testabili (messaggi, particelle, ruoli)
- [x] `components/invite/welcome-gate.tsx` — componente full-screen con logo animato + typing
- [x] Integrazione in `app/invite/[token]/page.tsx` (dopo accept invite)
- [x] Integrazione in `app/dashboard/page.tsx` (primo login, localStorage)
- [x] `prefers-reduced-motion`: tutto istantaneo, redirect dopo 2s
- [x] 22 test unit
- [x] Test verdi su tutta la suite (1532 unit)

### Varianti personalizzate

| Contesto             | Messaggio Anne                    | Badge                       |
| -------------------- | --------------------------------- | --------------------------- |
| Invitato a workspace | "Benvenuto nel team di {orgName}" | Ruolo (Operatore, Admin...) |
| Reseller nuovo       | "Benvenuto su SpedireSicuro"      | Nessuno                     |
| Utente normale       | "Benvenuto su SpedireSicuro"      | Nessuno                     |

---

## Workspace Hierarchy Hardening ✅

**Target:** Fix critici gerarchia workspace e visibilita utenti
**Completato:** 2026-02-06

### Problemi risolti

| Problema                                     | Root Cause                                        | Fix                                                                                                  |
| -------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Reseller invisibili nella pagina clienti     | Query legacy `parent_id` invece di workspace V2   | Upgrade a `workspace_members` + `parent_workspace_id` con fallback legacy                            |
| Workspace assegnati al parent sbagliato      | Due workspace `platform depth=0` nella stessa org | Provisioning hardened: ricerca per nome esatto "SpedireSicuro Platform" con fallback single-platform |
| Team member (Dario) mostrato come "Reseller" | Trigger DB forza `type='reseller'` per depth=1    | Badge override basato su `owner_account_type` nel workspace switcher                                 |
| Team member con workspace separato inutile   | Auto-provisioning trattava admin come reseller    | Migrazione manuale: Dario spostato nel team Platform come admin                                      |

### Architettura workspace (regola definitiva)

```text
SpedireSicuro Platform [platform, depth=0]
  ├── {Reseller} Workspace [reseller, depth=1] — owner: reseller
  │   └── {Cliente} Workspace [client, depth=2] — owner: cliente del reseller
  └── Team members → aggiunti come MEMBRI del Platform (non workspace separati)
```

**Regola critica:** i membri del team (admin, operatori) NON hanno workspace propri.
Vanno aggiunti come `workspace_members` del workspace Platform con ruolo appropriato.
Solo i reseller e i loro clienti hanno workspace dedicati.

### Trigger DB da conoscere

Il trigger `enforce_workspace_depth` forza automaticamente il tipo workspace:

- `depth=0` → `type='platform'`
- `depth=1` → `type='reseller'`
- `depth=2` → `type='client'`

Non e possibile cambiare il tipo direttamente via UPDATE. Il badge nel workspace
switcher usa `owner_account_type` per mostrare "Admin" quando l'owner e admin/superadmin.

### Deliverables

- [x] Hardened provisioning in `app/api/auth/supabase-callback/route.ts`
- [x] Upgrade query clienti a workspace V2 in `actions/reseller-clients.ts`
- [x] Nuova action `getChildWorkspaces()` per pannello workspace
- [x] Pannello gerarchia workspace in `app/dashboard/reseller/clienti/page.tsx`
- [x] Badge "Admin" nel workspace switcher (`owner_account_type` override)
- [x] `UserWorkspaceInfo.owner_account_type` — campo opzionale per superadmin view
- [x] API `/api/workspaces/my` arricchita con owner info
- [x] Fix DB: Dario migrato da workspace standalone a membro Platform
- [x] Fix DB: workspace orfani riparentati sotto SpedireSicuro Platform
- [x] Script diagnostici in `scripts/` per debug futuro
- [x] Test verdi su tutta la suite (1532 unit)

### File modificati

- `app/api/auth/supabase-callback/route.ts` (provisioning hardened)
- `app/api/workspaces/my/route.ts` (owner_account_type per superadmin)
- `actions/reseller-clients.ts` (workspace V2 query + getChildWorkspaces)
- `app/dashboard/reseller/clienti/page.tsx` (pannello workspace)
- `components/workspace-switcher.tsx` (badge Admin override)
- `types/workspace.ts` (owner_account_type)
- `scripts/fix-*.ts`, `scripts/check-*.ts` (diagnostica e fix DB)

---

## Email & Communication Platform

### FASE 1: Premium Welcome Email ✅

**Commit:** `6659b7e` | **Completato:** 2026-02-09

Email di benvenuto premium "Ferrari-level" con design Stripe/Linear/Vercel.
Due varianti: self-registration (no credenziali) e reseller-created (con credenziali + branding).
Sanitizzazione XSS su tutti i parametri, subject dinamico, 36 test.

### FASE 2: Workspace Email Infrastructure ✅

**Commit:** `d7014c9` | **Completato:** 2026-02-09

Infrastruttura completa email workspace-scoped: 3 tabelle DB, 3 RPC SECURITY DEFINER,
RLS isolamento, sanitizzazione HTML 4-pass, webhook svix auth, rate limit fail-closed.
17 fix sicurezza post-review. 61 test (31 unit + 30 security).

Dettagli: `docs/00-HANDBOOK/features/WORKSPACE_EMAIL_INFRASTRUCTURE.md`

### FASE 3: Posta Reseller UI — IN CORSO

Inbox Gmail-style workspace-scoped per reseller.

### FASE 4: Bacheca Broadcast — PROSSIMA

Sistema annunci per comunicazione reseller → team/clienti.

### FASE 5: Dominio Email Custom — PIANIFICATA

Gestione domini custom via Resend API (SPF, DKIM, MX).

---

## Tracking

| Milestone                         | Status         | Completato |
| --------------------------------- | -------------- | ---------- |
| 1. VAT Consolidation              | ✅ Completato  | 2026-02-05 |
| 2. Pricing Decomposition          | ✅ Completato  | 2026-02-05 |
| 3. Workspace Integration          | ✅ Completato  | 2026-02-05 |
| 4. Unified Logging                | ✅ Completato  | 2026-02-05 |
| 5. Cache Unification              | ✅ Completato  | 2026-02-05 |
| 6. Security Hardening             | ✅ Completato  | 2026-02-06 |
| 7. Wallet Refund Accounting       | ✅ Completato  | 2026-02-06 |
| 8. Reseller Team Navigation       | ✅ Completato  | 2026-02-06 |
| 9. WelcomeGate Onboarding         | ✅ Completato  | 2026-02-06 |
| 10. Workspace Hierarchy Hardening | ✅ Completato  | 2026-02-06 |
| 11. Premium Welcome Email (F1)    | ✅ Completato  | 2026-02-09 |
| 12. Workspace Email Infra (F2)    | ✅ Completato  | 2026-02-09 |
| 13. Posta Reseller UI (F3)        | 🔄 In corso    | —          |
| 14. Bacheca Broadcast (F4)        | ⏳ Prossima    | —          |
| 15. Dominio Custom Email (F5)     | 📋 Pianificata | —          |

---

## Note

- Ogni milestone richiede test verdi PRIMA del merge
- Documentazione aggiornata DOPO verifica in produzione
- Nessuna milestone dipende strettamente dalle altre (parallelizzabili)
