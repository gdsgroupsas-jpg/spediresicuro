# Prompt per Continuare Documentazione SpedireSicuro

## 🎯 CONTESTO

Stai continuando il lavoro di documentazione per SpedireSicuro. La Fase 2 è stata completata parzialmente:

### ✅ COMPLETATO (Fase 2)

**2-ARCHITECTURE:**

- ✅ `docs/2-ARCHITECTURE/FRONTEND.md` - Next.js, React patterns
- ✅ `docs/2-ARCHITECTURE/BACKEND.md` - API routes, Server Actions
- ✅ `docs/2-ARCHITECTURE/OVERVIEW.md` - Sistema generale, Courier Adapter, Feature Flags
- ✅ `docs/2-ARCHITECTURE/DATABASE.md` - Wallet, RLS, Idempotency
- ✅ `docs/2-ARCHITECTURE/AI_ORCHESTRATOR.md` - LangGraph, Workers

**4-UI-COMPONENTS:**

- ✅ `docs/4-UI-COMPONENTS/OVERVIEW.md` - Sistema componenti
- ✅ `docs/4-UI-COMPONENTS/WORKFLOWS.md` - User flows

**8-SECURITY:**

- ✅ `docs/8-SECURITY/OVERVIEW.md` - Multi-Tenant, RLS, Security Boundaries
- ✅ `docs/8-SECURITY/AUTHORIZATION.md` - Acting Context, RBAC
- ✅ `docs/8-SECURITY/AUDIT_LOGGING.md` - Audit Taxonomy
- ✅ `docs/8-SECURITY/DATA_PROTECTION.md` - Encryption, Secrets
- ✅ `docs/8-SECURITY/GDPR.md` - Compliance GDPR

**9-BUSINESS:**

- ✅ `docs/9-BUSINESS/VISION.md` - Visione business, Strategia, Roadmap
- ✅ `docs/9-BUSINESS/BUSINESS_MODELS.md` - 3 modelli operativi

---

## 📋 COSA MANCA (Priorità)

### P0 - Per Sostituire Vecchi Documenti

**8-SECURITY:**

- ❌ `docs/8-SECURITY/AUTHENTICATION.md` - NextAuth, OAuth (già parzialmente in BACKEND.md, ma serve versione security-focused)

**9-BUSINESS:**

- ❌ `docs/9-BUSINESS/PRICING.md` - Politiche pricing (opzionale, può essere integrato in BUSINESS_MODELS.md)
- ❌ `docs/9-BUSINESS/FINANCIAL.md` - Money flows, P&L (opzionale)

### P1 - Per Completare ARCHITECTURE.md

**11-FEATURES:**

- ❌ `docs/11-FEATURES/WALLET.md` - Sistema wallet (feature-focused, non solo tecnico)
- ❌ `docs/11-FEATURES/SHIPMENTS.md` - Gestione spedizioni, Compensation Queue (feature-focused)
- ❌ `docs/11-FEATURES/PRICE_LISTS.md` - Listini avanzati, clone, assign, sync

### P2 - Completamento Generale

**11-FEATURES:**

- ❌ `docs/11-FEATURES/RESELLER_HIERARCHY.md` - Gerarchia reseller
- ❌ `docs/11-FEATURES/AI_FEATURES_TOGGLE.md` - Toggle capabilities AI
- ❌ `docs/11-FEATURES/FINANCIAL_TRACKING.md` - Tracking costi/p&l

---

## 📝 ISTRUZIONI

### 1. Usa SEMPRE il Template

**File:** `docs/_TEMPLATE.md`

**Sezioni Obbligatorie:**

- Overview (2-3 righe)
- Target Audience
- Prerequisites
- Quick Reference (tabella)
- Content (dettagliato)
- Examples (codice funzionante)
- Common Issues (tabella)
- Related Documentation (link)
- Changelog

### 2. Fonti da Analizzare

**Per 8-SECURITY/AUTHENTICATION.md:**

- `docs/2-ARCHITECTURE/BACKEND.md` - Sezione Authentication
- `docs/SECURITY.md` - Vecchio documento (se esiste ancora)
- `lib/auth-config.ts` - NextAuth configuration
- `app/api/auth/[...nextauth]/route.ts` - NextAuth route

**Per 11-FEATURES/WALLET.md:**

- `docs/2-ARCHITECTURE/DATABASE.md` - Sezione Wallet System
- `docs/ARCHITECTURE.md` - Sezione Wallet System (vecchio)
- `app/dashboard/wallet/` - UI wallet
- `actions/wallet.ts` - Server Actions wallet

**Per 11-FEATURES/SHIPMENTS.md:**

- `docs/2-ARCHITECTURE/DATABASE.md` - Sezione Compensation Queue
- `docs/ARCHITECTURE.md` - Sezione Compensation Queue (vecchio)
- `app/dashboard/spedizioni/` - UI spedizioni
- `app/api/shipments/create/route.ts` - API creazione spedizione

**Per 11-FEATURES/PRICE_LISTS.md:**

- `docs/ARCHITECTURE.md` - Sezione "Listini Avanzati"
- `app/dashboard/listini/` - UI listini (se esiste)
- Database schema `price_lists`, `advanced_price_lists`

### 3. Regole IMPORTANTI

- ✅ **Sempre:** Usa template, copia da codice esistente, link a docs esistenti
- ✅ **Sicurezza:** NON esporre API keys, secrets, password reali. Usa placeholder.
- ✅ **Single Source of Truth:** Ogni concetto in UN SOLO posto, link invece di duplicare
- ✅ **"Good Enough":** Documenta solo P0+P1, non cercare perfezione
- ❌ **Mai:** Scrivere da zero senza analizzare codice, esporre dati sensibili

### 4. Dopo Creazione

1. Aggiorna `docs/README.md` con link al nuovo documento
2. Aggiorna tabella "Stato Documentazione" in `docs/README.md`
3. Verifica che non ci siano dati sensibili (grep per `api_key`, `secret`, `password`)
4. Verifica type-check passa

---

## 🎯 OBIETTIVO FINALE

Al completamento, la nuova documentazione deve coprire completamente:

- ✅ `ARCHITECTURE.md` → `docs/2-ARCHITECTURE/` + `docs/11-FEATURES/`
- ✅ `SECURITY.md` → `docs/8-SECURITY/`
- ✅ `VISION_BUSINESS.md` → `docs/9-BUSINESS/`

Poi i vecchi documenti possono essere spostati in `docs/archive/` senza perdita di informazioni.

---

## 📚 Riferimenti Chiave

- **Template:** `docs/_TEMPLATE.md`
- **Indice:** `docs/README.md`
- **Esempio buono:** `docs/2-ARCHITECTURE/FRONTEND.md`
- **Vecchi documenti:** `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/VISION_BUSINESS.md`

---

## 🚀 Inizia Con

**Priorità P0:**

1. `docs/8-SECURITY/AUTHENTICATION.md` - Per completare 8-SECURITY
2. `docs/11-FEATURES/WALLET.md` - Per completare ARCHITECTURE.md
3. `docs/11-FEATURES/SHIPMENTS.md` - Per completare ARCHITECTURE.md
4. `docs/11-FEATURES/PRICE_LISTS.md` - Per completare ARCHITECTURE.md

**Comando per iniziare:**

1. Leggi `docs/_TEMPLATE.md`
2. Analizza codice sorgente per dettagli tecnici
3. Crea documento usando template
4. Aggiorna `docs/README.md`

**Vai!** 🚀
