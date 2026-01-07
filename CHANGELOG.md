# Changelog

Tutte le modifiche significative al progetto SpedireSicuro sono documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **Fase 3: Reseller Tier System** - Sistema categorizzazione automatica reseller
  - Enum `reseller_tier`: small (<10 sub-users), medium (10-100), enterprise (>100)
  - Campo `reseller_tier` in tabella `users` (nullable, solo per reseller)
  - Funzione DB `get_reseller_tier(user_id)` per calcolo automatico tier
  - Helper TypeScript `lib/db/tier-helpers.ts` con funzioni: `getResellerTier()`, `calculateTierFromSubUsers()`, `getTierLimits()`, `isTierAtLimit()`
  - Componente UI `TierBadge` per visualizzazione tier (small/medium/enterprise)
  - Integrazione tier badge in `ClientsHierarchyView` per superadmin
  - Migrations: 088 (enum e campo), 089 (funzione), 090 (popolamento iniziale)
  - Test: 17/17 unit test per tier-helpers, 782/786 suite completa, 0 regressioni
  - Documentazione: `docs/DEVELOPMENT_PLAN_FASE3.md`, script verifica `scripts/test-migrations-088-090.sql`
- **Fase 4: Gestione Clienti UI Gerarchica** - Vista unificata clienti per Superadmin/Admin
  - `getAllClientsForUser()` - Backend: struttura gerarchica Reseller → Sub-Users + BYOC
  - `ClientsHierarchyView` - Frontend: componente gerarchico con ResellerCard expandable
  - `BYOCSection` - Frontend: sezione dedicata clienti BYOC standalone
  - `useAllClients()` - Hook React Query per fetch dati gerarchici
  - Superadmin vede tutti i clienti in modo gerarchico (Reseller → Sub-Users nested + BYOC)
  - Reseller mantiene vista originale (solo propri Sub-Users) - non breaking
  - Stats aggregate: Reseller, Sub-Users, BYOC, Wallet Totale
  - Access control: capability `can_view_all_clients` o `account_type === 'superadmin'`
  - **Operatività Completa:**
    - Menu azioni Reseller: Ricarica Wallet, Crea Sub-User, Elimina Reseller
    - Menu azioni Sub-Users: Gestisci Wallet, Elimina Cliente
    - Menu azioni BYOC: Gestisci Wallet, Elimina Cliente
    - Pulsante "Crea Reseller" con dialog dedicato
    - Integrazione `CreateResellerDialog`, `CreateUserDialog`, `WalletRechargeDialog`
    - Conferma eliminazioni con `ConfirmActionDialog`
    - Refresh automatico dopo operazioni
  - **Query Resilienti:**
    - Fallback automatico se colonne opzionali mancanti (`company_name`, `phone`, `reseller_tier`)
    - Compatibilità con database locali senza tutte le migrations
  - **UI/UX Miglioramenti:**
    - Fix contrasti: testi grigi → neri (`text-gray-900`) per massima leggibilità
    - Dropdown menu: label e items con contrasto ottimizzato
    - Card hover effects e transizioni smooth
    - Badge e icone con colori distintivi e leggibili
  - Test: 5/5 backend, 765/765 suite completa, 0 regressioni
- **Reseller System Enhancement** - Miglioramenti sistema reseller
  - Reseller creati con `account_type='reseller'` invece di `'user'`
  - Migration per aggiungere `'reseller'` all'enum `account_type`
  - Script `create-reseller.ts` per creazione programmatica reseller
- **Role Badge System** - Sistema badge ruoli con colori distintivi
  - `lib/utils/role-badges.tsx` - Utility per badge ruoli
  - Super Admin: rosso, Admin: amber, Reseller: teal, BYOC: blu, User: grigio
  - Visualizzazione ruoli corretta in admin dashboard
- **Platform Fee Improvements** - Miglioramenti gestione fee
  - Feedback visibile dopo salvataggio (toast + messaggi nel dialog)
  - Supporto per fee = 0 (gratis) con preset dedicato
  - Fix foreign key constraint in audit history
- **Documentation** - Nuova documentazione
  - `docs/FLUSSO_CREAZIONE_RESELLER.md` - Flusso creazione reseller
  - `docs/SPIEGAZIONE_FEE_VS_ABBONAMENTO.md` - Differenza fee vs abbonamento
- **Stripe Integration** - Completa integrazione pagamenti Stripe (sostituisce Intesa XPay)
  - `lib/payments/stripe.ts` - Client Stripe con checkout session
  - `app/api/stripe/webhook/route.ts` - Webhook con signature verification
  - `app/api/stripe/create-checkout/route.ts` - Creazione sessioni checkout
- **Invoice System** - Sistema fatturazione completo
  - `lib/invoices/pdf-generator.ts` - Generazione PDF con jsPDF
  - `app/api/invoices/generate/route.ts` - API generazione fatture
  - `app/api/invoices/download/route.ts` - API download PDF
  - `app/dashboard/fatture/page.tsx` - UI fatture
- **Doctor Dashboard** - Dashboard diagnostica per admin
  - `app/api/admin/doctor/route.ts` - API health check sistema
  - `app/dashboard/admin/doctor/page.tsx` - UI diagnostica
- **Nuovo endpoint sicuro** - `/api/integrations/validate-spedisci-online`
  - Migrato da `/api/test-spedisci-online` con path più appropriato
- **Test E2E** - Nuovi test Playwright
  - `e2e/doctor-dashboard.spec.ts`
  - `e2e/invoice-generation.spec.ts`
  - `e2e/stripe-payment.spec.ts`

### Changed
- **UI Admin Dashboard** - Miglioramenti visualizzazione
  - Pagina dettaglio utente: sfondo grigio chiaro (`bg-slate-50`) invece di gradient
  - Card bianche invece di scure per migliore leggibilità
  - Testo scuro su sfondo chiaro (fix: email invisibili nero su nero)
  - Stile allineato alla pagina "Nuova Spedizione"
- **Security Hardening**
  - `app/dashboard/layout.tsx` - Bloccato `PLAYWRIGHT_TEST_MODE` in produzione
  - `lib/hooks/use-service-worker.ts` - Sostituito `innerHTML` con DOM API sicure
  - `app/api/stripe/webhook/route.ts` - Structured logging senza PII
- **SpedisciOnlineWizard** - Aggiornato per usare nuovo endpoint `/api/integrations/validate-spedisci-online`

### Removed
- ❌ `app/api/test-redis/route.ts` - Endpoint diagnostico rimosso per sicurezza
- ❌ `app/api/test-supabase/route.ts` - Endpoint diagnostico rimosso per sicurezza  
- ❌ `app/api/test-spedisci-online/route.ts` - Migrato a nuovo path
- ❌ `lib/payments/intesa-xpay.ts` - Sostituito da Stripe

### Security
- 🔒 Rimossi 3 endpoint di test esposti in produzione
- 🔒 Bloccato bypass autenticazione test mode in produzione
- 🔒 Eliminato logging PII (userId, amount) in webhook
- 🔒 Fixato potenziale XSS via innerHTML
- 🔒 `npm audit fix` - 5 vulnerabilità corrette

### Fixed
- **Autocomplete Città** - Fix riapre dopo selezione
  - Autocomplete non si riapre più dopo prima selezione
  - Aggiunto flag `isSelectionInProgress` per prevenire loop
  - Non fa ricerca se città è già validata
- **Platform Fee Audit** - Fix foreign key constraint
  - Risolto errore `platform_fee_history_changed_by_fkey`
  - Audit gestito manualmente con adminUserId corretto
  - Trigger automatico disabilitato (non funzionava con service role)
- **Reseller Display** - Fix visualizzazione ruolo
  - Reseller ora mostrati come "Reseller" invece di "Utente"
  - Usa `account_type` e `is_reseller` per determinare ruolo
  - Tabella admin dashboard aggiornata con query corretta
- Wallet dialog ora usa Stripe invece di XPay
- Service worker notification usa DOM API sicure

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

**Vedi anche:** [docs/SESSION_STATUS_2026_01_01.md](docs/SESSION_STATUS_2026_01_01.md) per dettagli sessione
