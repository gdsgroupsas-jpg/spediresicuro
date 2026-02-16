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

### FASE 3: Posta Reseller UI — COMPLETATA

**Commit:** `46652eb` | **Completato:** 2026-02-09

Inbox Gmail-style workspace-scoped per reseller: 3 API routes (emails CRUD, email detail,
email addresses), pagina posta-workspace con compose/reply/forward/star/trash/search/pagination,
navigation config aggiornata per reseller. 20 test unit per auth, isolamento, CRUD, navigation.

Dettagli: `docs/00-HANDBOOK/features/POSTA_RESELLER_UI.md`

### FASE 4: Bacheca Broadcast — COMPLETATA

**Commit:** `954d171` | **Completato:** 2026-02-09

Board annunci workspace-scoped: 2 API routes (announcements CRUD, announcement detail),
pagina bacheca con composer (target/priority/pin), filtri (tutti/team/clienti), dettaglio
con read tracking, role-based access (owner/admin creano, tutti leggono).
Clienti del reseller accedono via parent_workspace_id. Sanitizzazione HTML, 23 test unit.

Dettagli: `docs/00-HANDBOOK/features/BACHECA_BROADCAST.md`

### FASE 5: Dominio Email Custom — PIANIFICATA

Gestione domini custom via Resend API (SPF, DKIM, MX).

---

## Tracking

| Milestone                           | Status         | Completato |
| ----------------------------------- | -------------- | ---------- |
| 1. VAT Consolidation                | ✅ Completato  | 2026-02-05 |
| 2. Pricing Decomposition            | ✅ Completato  | 2026-02-05 |
| 3. Workspace Integration            | ✅ Completato  | 2026-02-05 |
| 4. Unified Logging                  | ✅ Completato  | 2026-02-05 |
| 5. Cache Unification                | ✅ Completato  | 2026-02-05 |
| 6. Security Hardening               | ✅ Completato  | 2026-02-06 |
| 7. Wallet Refund Accounting         | ✅ Completato  | 2026-02-06 |
| 8. Reseller Team Navigation         | ✅ Completato  | 2026-02-06 |
| 9. WelcomeGate Onboarding           | ✅ Completato  | 2026-02-06 |
| 10. Workspace Hierarchy Hardening   | ✅ Completato  | 2026-02-06 |
| 11. Premium Welcome Email (F1)      | ✅ Completato  | 2026-02-09 |
| 12. Workspace Email Infra (F2)      | ✅ Completato  | 2026-02-09 |
| 13. Posta Reseller UI (F3)          | ✅ Completato  | 2026-02-09 |
| 14. Bacheca Broadcast (F4)          | ✅ Completato  | 2026-02-09 |
| 15. Dominio Custom Email (F5)       | 📋 Pianificata | —          |
| 16. Reseller Transfer Atomico       | ✅ Completato  | 2026-02-12 |
| 17. Gestione Contratti UI           | ✅ Completato  | 2026-02-12 |
| 18. Fattura a Fine Mese (Postpaid)  | ✅ Completato  | 2026-02-12 |
| 19. Wallet UI & Admin Notifications | ✅ Completato  | 2026-02-12 |
| 20. Auth Migration & Security DRY   | ✅ Completato  | 2026-02-13 |

---

### FASE 6: Wallet Post-Paid & Reseller Transfer — COMPLETATA (2026-02-12)

#### Milestone 16: Reseller Transfer Atomico

RPC SQL `reseller_transfer_credit` con lock deterministico, idempotency, e doppia transazione (RESELLER_TRANSFER_OUT + RESELLER_TRANSFER_IN). Sostituisce la vecchia `add_wallet_credit` per i trasferimenti reseller.

**File chiave:** `supabase/migrations/20260216100000_reseller_transfer_credit.sql`, `actions/admin-reseller.ts`

#### Milestone 17: Gestione Contratti UI

Dialog per Reseller per cambiare billing_mode (prepagato/postpagato) dei propri sub-user. Protezione: blocca cambio postpagato->prepagato se ci sono spedizioni non fatturate. Badge billing mode sulla client card.

**File chiave:** `app/dashboard/reseller/clienti/_components/billing-mode-dialog.tsx`, `actions/admin-reseller.ts`

#### Milestone 18: Fattura a Fine Mese (Post-Paid)

Sub-user postpagato spedisce senza saldo. `POSTPAID_CHARGE` traccia consumo senza toccare wallet_balance. Compensazione automatica su errore. `generatePostpaidMonthlyInvoice()` per fatturazione mensile. Vista SQL `postpaid_monthly_summary`.

**File chiave:** `lib/shipments/create-shipment-core.ts`, `lib/wallet/credit-check.ts`, `actions/invoice-recharges.ts`

**Audit:** 14 bug trovati e fixati in 4 round di review. 42 nuovi test.

---

### Milestone 19: Wallet UI & Admin Notifications ✅

**Commit:** `fa03aff` | **Completato:** 2026-02-12

#### Problemi risolti

| Problema                                                       | Fix                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| Card wallet illeggibili (testo grigio chiaro su sfondo bianco) | `variant="dark"` su 6 Card components nella wallet page |
| Nessuna notifica admin quando utente crea richiesta ricarica   | Email automatica a tutti admin/superadmin via Resend    |
| Bucket storage `receipts` mai creato da migrazione             | Nuova migrazione SQL con bucket + RLS policies          |
| SuperAdmin non può azzerare wallet da UI                       | Bottone "Azzera Wallet" in ManageWalletCard             |

#### Deliverables

- [x] Fix contrasto UI: `variant="dark"` su chart, 4 stats cards, transactions list
- [x] `sendAdminTopUpNotificationEmail()` in `lib/email/resend.ts` (template amber)
- [x] Chiamata non-bloccante in `uploadBankTransferReceipt()` con try/catch
- [x] Migrazione `20260217100000_create_receipts_storage_bucket.sql` (bucket + RLS)
- [x] Bottone "Azzera Wallet" con pre-fill debit dialog (importo completo + motivo)
- [x] Migrazione `20260217110000_reset_wallet_pilot_gdsgroupsas.sql`
- [x] 6 nuovi test Azzera Wallet + 22 test notifiche/bucket/contrast
- [x] Test verdi su tutta la suite (2772 unit)

#### File coinvolti

- `app/dashboard/wallet/page.tsx` (variant="dark" su 6 Card)
- `app/actions/wallet.ts` (import + chiamata email admin)
- `lib/email/resend.ts` (nuova funzione `sendAdminTopUpNotificationEmail`)
- `components/admin/manage-wallet-card.tsx` (bottone Azzera Wallet + prefill dialog)
- `supabase/migrations/20260217100000_create_receipts_storage_bucket.sql` (nuovo)
- `supabase/migrations/20260217110000_reset_wallet_pilot_gdsgroupsas.sql` (nuovo)
- `tests/unit/topup-requests-notifications.test.ts` (22 nuovi test)
- `tests/unit/manage-wallet-card.test.ts` (6 nuovi test)

---

### Milestone 20: Auth Migration & Security DRY ✅

**Commits:** `d653f0a`, `62b2546`, `6fa690e`, `3563cdc`, `d1a003f` | **Completato:** 2026-02-13

Migrazione completa dell'architettura auth da `getSafeAuth` a `getWorkspaceAuth` per
isolamento multi-tenant, con refactor DRY del bypass E2E e defense-in-depth.

#### Architettura Auth (post-migrazione)

| Funzione             | Uso corretto                                                   | File                             |
| -------------------- | -------------------------------------------------------------- | -------------------------------- |
| `getWorkspaceAuth()` | Operazioni workspace-scoped (listini, spedizioni, team)        | `lib/workspace-auth.ts`          |
| `getSafeAuth()`      | Operazioni globali (auth, wallet, debug, invite, integrazioni) | `lib/safe-auth.ts`               |
| `isSuperAdmin()`     | Check permessi admin — importare SEMPRE da `workspace-auth`    | Re-export da `workspace-auth.ts` |
| `isE2ETestMode()`    | Bypass E2E centralizzato — unico punto di verifica             | `lib/test-mode.ts`               |

#### Fasi completate

##### P0-P3: Migrazione Auth (151 file auditati)

- 113 file migrati a `getWorkspaceAuth()` (API routes + server actions)
- 31 file confermati legittimi su `getSafeAuth()` (wallet, auth, debug, invite)
- 7 file con entrambi (admin overview, impersonation — corretto by design)
- Zero violazioni `isSuperAdmin` (tutti importano da workspace-auth)

##### Defense-in-depth: Strip x-test-mode header

- `middleware.ts`: strippa `x-test-mode` da tutte le request client
- Stessa logica di `x-sec-workspace-id` — impedisce header injection

##### DRY: isE2ETestMode centralizzato

- `lib/test-mode.ts`: funzione unica per bypass E2E
- Sostituisce logica duplicata in 4 file (auth-config, workspace-auth, api-middleware, layout)
- Gate 1: `NODE_ENV !== 'production'` (o CI/Playwright env)
- Gate 2: header `x-test-mode=playwright` (o PLAYWRIGHT_TEST_MODE env)

##### E2E fix: workspace context in test mode

- `workspace-auth.ts`: crea fake WorkspaceActingContext quando in test mode
- Risolve regressione E2E causata dalla migrazione P1/P2
- 14/14 E2E test passati (prima 4 fallivano)

#### Test

- 2866 unit test verdi (+47 rispetto a pre-migrazione)
- 7 test `isE2ETestMode` (tutte le combinazioni env/header/production)
- 21 test isolamento workspace listini (unit + security)
- 4 pipeline CI GREEN (CI Gate, E2E, Security Scanning, Release Guard)

#### File chiave

- `lib/test-mode.ts` (NUOVO — centralizzazione bypass E2E)
- `lib/workspace-auth.ts` (E2E bypass + re-export isSuperAdmin)
- `lib/auth-config.ts` (refactored per usare isE2ETestMode)
- `lib/api-middleware.ts` (refactored per usare isE2ETestMode)
- `middleware.ts` (strip x-test-mode header)
- `app/layout.tsx` (refactored per usare isE2ETestMode)
- `tests/unit/middleware.test.ts` (9 nuovi test security)
- `tests/unit/price-lists-workspace-isolation.test.ts` (9 test isolamento)
- `tests/security/price-lists-isolation.test.ts` (12 test security)

---

## Note

- Ogni milestone richiede test verdi PRIMA del merge
- Documentazione aggiornata DOPO verifica in produzione
- Nessuna milestone dipende strettamente dalle altre (parallelizzabili)
