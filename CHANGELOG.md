# Changelog

Tutte le modifiche significative al progetto SpedireSicuro sono documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
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
