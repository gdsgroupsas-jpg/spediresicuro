# 📚 Documentazione SpedireSicuro

> **Ultimo aggiornamento:** 2026-01-12  
> **Versione documentazione:** 1.0.0  
> **Stato:** 🟢 Enterprise-Grade

---

## 🚀 Quick Start

**Sei nuovo? Inizia qui:**

1. ⏱️ [1-GETTING-STARTED](1-GETTING-STARTED/README.md) - Setup in 5 minuti
2. 🏗️ [2-ARCHITECTURE](2-ARCHITECTURE/) - Architettura tecnica
3. 🤖 [10-AI-AGENT](10-AI-AGENT/) - Sistema AI Anne

**Per sviluppo:** 4. 🌐 [3-API](3-API/) - Endpoints e Server Actions 5. 🎨 [4-UI-COMPONENTS](4-UI-COMPONENTS/) - Componenti React 6. 🧪 [5-TESTING](5-TESTING/) - Strategy e testing

**Per operatività:** 7. 🚀 [6-DEPLOYMENT](6-DEPLOYMENT/) - Deploy e CI/CD 8. 🔧 [7-OPERATIONS](7-OPERATIONS/) - Monitoring e troubleshooting

**Per sicurezza e business:** 9. 🔒 [8-SECURITY](8-SECURITY/) - Sicurezza e compliance 10. 💼 [9-BUSINESS](9-BUSINESS/) - Visione business e modelli

---

## 📋 Indice Completo

### 🟢 1-GETTING-STARTED - Onboarding Rapido

- [Quick Start](1-GETTING-STARTED/QUICK_START.md) - Setup in 5 minuti
- [Local Development](1-GETTING-STARTED/LOCAL_DEVELOPMENT.md) - Setup locale completo
- [Onboarding](1-GETTING-STARTED/ONBOARDING.md) - Nuovi team member
- [First Contribution](1-GETTING-STARTED/FIRST_CONTRIBUTION.md) - Prima PR

### 🏗️ 2-ARCHITECTURE - Architettura Tecnica

- [Overview](2-ARCHITECTURE/OVERVIEW.md) - Architettura generale, Courier Adapter, Feature Flags
- [Frontend](2-ARCHITECTURE/FRONTEND.md) - Next.js, React patterns
- [Backend](2-ARCHITECTURE/BACKEND.md) - API routes, Server Actions
- [Database](2-ARCHITECTURE/DATABASE.md) - Schema, migrations, RLS, Wallet, Idempotency
- [AI Orchestrator](2-ARCHITECTURE/AI_ORCHESTRATOR.md) - LangGraph, Workers, Supervisor Pattern

### 🌐 3-API - API Documentation

- [Overview](3-API/OVERVIEW.md) - API generale e patterns
- [REST API](3-API/REST_API.md) - Endpoints REST completi
- [Server Actions](3-API/SERVER_ACTIONS.md) - Catalog Server Actions
- [Webhooks](3-API/WEBHOOKS.md) - Webhooks (Stripe, ecc.)
- [Error Codes](3-API/ERROR_CODES.md) - Codici errore standardizzati

**Status:** ✅ **Completo** - Tutti i documenti P1 creati

### 🎨 4-UI-COMPONENTS - UI & Componenti

- [Overview](4-UI-COMPONENTS/OVERVIEW.md) - Sistema componenti
- [Shadcn/UI](4-UI-COMPONENTS/SHADCN_UI.md) - Componenti Shadcn/UI
- [Custom Components](4-UI-COMPONENTS/CUSTOM_COMPONENTS.md) - Componenti custom
- [Dashboards](4-UI-COMPONENTS/DASHBOARDS.md) - Pattern dashboard
- [Forms](4-UI-COMPONENTS/FORMS.md) - Form patterns & validation
- [Workflows](4-UI-COMPONENTS/WORKFLOWS.md) - User flows (UX)

### 🧪 5-TESTING - Testing & QA

- [Strategy](5-TESTING/STRATEGY.md) - Strategia testing completa

**Status:** ✅ **Completo** - Strategia testing documentata

### 🚀 6-DEPLOYMENT - Deployment & CI/CD

- [Overview](6-DEPLOYMENT/OVERVIEW.md) - Deployment strategy
- [Vercel](6-DEPLOYMENT/VERCEL.md) - Deploy su Vercel
- [CI/CD](6-DEPLOYMENT/CI_CD.md) - GitHub Actions, Vercel CI

**Status:** ✅ **Completo** - Documenti P1 creati

### 🔧 7-OPERATIONS - Operations & Monitoring

- [Monitoring](7-OPERATIONS/MONITORING.md) - Dashboard monitoring e operations

**Status:** ✅ **Completo** - Monitoring documentato

### 🔒 8-SECURITY - Security & Compliance

- [Overview](8-SECURITY/OVERVIEW.md) - Overview sicurezza
- [Authentication](8-SECURITY/AUTHENTICATION.md) - NextAuth, OAuth
- [Authorization](8-SECURITY/AUTHORIZATION.md) - RBAC, capabilities
- [Data Protection](8-SECURITY/DATA_PROTECTION.md) - Encryption, secrets
- [Audit Logging](8-SECURITY/AUDIT_LOGGING.md) - Audit trail
- [GDPR](8-SECURITY/GDPR.md) - Compliance GDPR

### 💼 9-BUSINESS - Business & Product

- [Vision](9-BUSINESS/VISION.md) - Visione business completa
- [Business Models](9-BUSINESS/BUSINESS_MODELS.md) - 3 modelli operativi
- [Pricing](9-BUSINESS/PRICING.md) - Politiche pricing
- [Financial](9-BUSINESS/FINANCIAL.md) - Money flows, P&L

### 🤖 10-AI-AGENT - AI Orchestrator (Anne)

- [Overview](10-AI-AGENT/OVERVIEW.md) - Anne AI overview
- [Architecture](10-AI-AGENT/ARCHITECTURE.md) - LangGraph architecture
- [Workers](10-AI-AGENT/WORKERS.md) - Worker specific (OCR, Address, Pricing, Booking)
- [Tools](10-AI-AGENT/TOOLS.md) - AI tools catalog
- [Prompts](10-AI-AGENT/PROMPTS.md) - Prompt engineering
- [Telemetry](10-AI-AGENT/TELEMETRY.md) - Monitoring AI
- [MIGRATION_MEMORY](10-AI-AGENT/MIGRATION_MEMORY.md) - **Single Source of Truth** per migrazione Anne

### ✨ 11-FEATURES - Features del Prodotto

- [Wallet](11-FEATURES/WALLET.md) - Sistema wallet
- [Shipments](11-FEATURES/SHIPMENTS.md) - Gestione spedizioni
- [Price Lists](11-FEATURES/PRICE_LISTS.md) - Listini prezzi
- [Reseller Hierarchy](11-FEATURES/RESELLER_HIERARCHY.md) - Gerarchia reseller
- [AI Features Toggle](11-FEATURES/AI_FEATURES_TOGGLE.md) - Toggle capabilities AI
- [Financial Tracking](11-FEATURES/FINANCIAL_TRACKING.md) - Tracking costi/p&l

### 🔧 12-TROUBLESHOOTING - Troubleshooting

- [Common Issues](12-TROUBLESHOOTING/COMMON_ISSUES.md) - Problemi comuni
- [Database Issues](12-TROUBLESHOOTING/DATABASE_ISSUES.md) - Database errors
- [API Issues](12-TROUBLESHOOTING/API_ISSUES.md) - API errors
- [Performance Issues](12-TROUBLESHOOTING/PERFORMANCE_ISSUES.md) - Performance lenta
- [Debug Guide](12-TROUBLESHOOTING/DEBUG_GUIDE.md) - Guide debugging

**Status:** ✅ **Completo** - Tutti i documenti P2 creati

### 🗄️ Archive - Documentazione Storica

- [Storico](archive/) - Documentazione obsoleta (solo riferimento)

---

## 🔍 Come Navigare

### Per Sviluppatori Nuovi

1. Leggi [1-GETTING-STARTED/QUICK_START.md](1-GETTING-STARTED/QUICK_START.md) (5 min)
2. Configura ambiente locale
3. Inizia a sviluppare! 🚀

### Per Sviluppatori Senior

1. Leggi [2-ARCHITECTURE/OVERVIEW.md](2-ARCHITECTURE/OVERVIEW.md)
2. Approfondisci modulo specifico (Backend, Database, AI)
3. Contribuisci alla documentazione! 📝

### Per DevOps/Operations

1. Leggi [6-DEPLOYMENT/OVERVIEW.md](6-DEPLOYMENT/OVERVIEW.md)
2. Segui [7-OPERATIONS/](7-OPERATIONS/) per monitoring e troubleshooting
3. Usa [CHANGELOG.md](../CHANGELOG.md) per tracking versioni 📋

### Per AI Agents

1. **LEGGI PRIMA:** [AI_AGENT_GUIDE.md](AI_AGENT_GUIDE.md) - Come navigare la documentazione
2. Poi leggi [2-ARCHITECTURE/OVERVIEW.md](2-ARCHITECTURE/OVERVIEW.md) - Architettura generale
3. Per AI Anne: [10-AI-AGENT/MIGRATION_MEMORY.md](10-AI-AGENT/MIGRATION_MEMORY.md) - Single Source of Truth
4. Segui i **Safety Invariants**! 🛡️

---

## 📝 Contribuisci alla Documentazione

### Template per Nuovi Documenti

1. Copia il template: [\_TEMPLATE.md](_TEMPLATE.md)
2. Riempili le sezioni obbligatorie (Overview, Target Audience, Content)
3. Aggiungi alla sezione appropriata
4. Aggiorna questo README.md con link al nuovo documento

### Regole

- ✅ Usa il template: [\_TEMPLATE.md](_TEMPLATE.md)
- ✅ Single Source of Truth: ogni concetto in UN SOLO posto
- ✅ Link, non duplicare: referenzia invece di ripetere
- ✅ "Good Enough": non cercare la perfezione, documento solo ciò che serve
- ✅ Aggiorna CHANGELOG: ogni nuova feature va in CHANGELOG

---

## 📋 Quick Reference

| Così stai cercando?   | Vai qui                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| Setup rapido locale   | [1-GETTING-STARTED/QUICK_START.md](1-GETTING-STARTED/QUICK_START.md)       |
| Architettura progetto | [2-ARCHITECTURE/OVERVIEW.md](2-ARCHITECTURE/OVERVIEW.md)                   |
| API endpoints         | [3-API/REST_API.md](3-API/REST_API.md)                                     |
| Componenti UI         | [4-UI-COMPONENTS/OVERVIEW.md](4-UI-COMPONENTS/OVERVIEW.md)                 |
| Testing strategy      | [5-TESTING/STRATEGY.md](5-TESTING/STRATEGY.md)                             |
| Deploy su Vercel      | [6-DEPLOYMENT/VERCEL.md](6-DEPLOYMENT/VERCEL.md)                           |
| Monitoring & alerting | [7-OPERATIONS/MONITORING.md](7-OPERATIONS/MONITORING.md)                   |
| Sicurezza & RLS       | [8-SECURITY/OVERVIEW.md](8-SECURITY/OVERVIEW.md)                           |
| Visione business      | [9-BUSINESS/VISION.md](9-BUSINESS/VISION.md)                               |
| Sistema AI (Anne)     | [10-AI-AGENT/OVERVIEW.md](10-AI-AGENT/OVERVIEW.md)                         |
| Feature specifiche    | [11-FEATURES/](11-FEATURES/)                                               |
| Troubleshooting       | [12-TROUBLESHOOTING/COMMON_ISSUES.md](12-TROUBLESHOOTING/COMMON_ISSUES.md) |
| Storico commit        | [CHANGELOG.md](../CHANGELOG.md)                                            |
| Architettura AI       | [MIGRATION_MEMORY.md](MIGRATION_MEMORY.md)                                 |

---

## 🔗 Links Rapidi

### Principali

- [README.md](../README.md) - Costituzione sistema
- [CHANGELOG.md](../CHANGELOG.md) - Storico versioni
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Linee guida contribuzione
- [MIGRATION_MEMORY.md](../MIGRATION_MEMORY.md) - Architettura AI Anne

### Documentazione Chiave

- [AI Agent Guide](AI_AGENT_GUIDE.md) - 🤖 **Per AI Agents: Come navigare la documentazione**
- [Architecture Overview](2-ARCHITECTURE/OVERVIEW.md) - Architettura tecnica completa
- [Security Overview](8-SECURITY/OVERVIEW.md) - Architettura sicurezza
- [Business Vision](9-BUSINESS/VISION.md) - Visione business
- [ANNE_PRICE_LIST_CAPABILITIES.md](ANNE_PRICE_LIST_CAPABILITIES.md) - Anne capabilities
- [Archive - Documenti Storici](archive/root/) - Vecchi documenti (ARCHITECTURE.md, SECURITY.md, VISION_BUSINESS.md)

---

## 🎯 Stato Documentazione

| Sezione            | Stato        | Copertura | Note                                                                                                                |
| ------------------ | ------------ | --------- | ------------------------------------------------------------------------------------------------------------------- |
| 1-GETTING-STARTED  | ✅ Fase 1    | 25%       | Quick start fatto                                                                                                   |
| 2-ARCHITECTURE     | ✅ Fase 2    | 85%       | OVERVIEW.md, DATABASE.md, AI_ORCHESTRATOR.md creati                                                                 |
| 3-API              | ✅ Fase 2    | 100%      | OVERVIEW.md, REST_API.md, SERVER_ACTIONS.md, WEBHOOKS.md, ERROR_CODES.md creati                                     |
| 4-UI-COMPONENTS    | ✅ Fase 2    | 40%       | OVERVIEW.md e WORKFLOWS.md creati                                                                                   |
| 5-TESTING          | ✅ Fase 2    | 100%      | STRATEGY.md creato                                                                                                  |
| 6-DEPLOYMENT       | ✅ Fase 2    | 100%      | OVERVIEW.md, VERCEL.md, CI_CD.md creati                                                                             |
| 7-OPERATIONS       | ✅ Fase 2    | 100%      | MONITORING.md creato                                                                                                |
| 8-SECURITY         | ✅ Fase 2    | 100%      | OVERVIEW.md, AUTHENTICATION.md, AUTHORIZATION.md, AUDIT_LOGGING.md, DATA_PROTECTION.md, GDPR.md creati              |
| 9-BUSINESS         | ✅ Fase 2    | 80%       | VISION.md e BUSINESS_MODELS.md creati                                                                               |
| 10-AI-AGENT        | 🟢 Esistente | 95%       | MIGRATION_MEMORY attivo                                                                                             |
| 11-FEATURES        | ✅ Fase 2    | 100%      | WALLET.md, SHIPMENTS.md, PRICE_LISTS.md, RESELLER_HIERARCHY.md, AI_FEATURES_TOGGLE.md, FINANCIAL_TRACKING.md creati |
| 12-TROUBLESHOOTING | ✅ Fase 2    | 100%      | COMMON_ISSUES.md, DATABASE_ISSUES.md, API_ISSUES.md, PERFORMANCE_ISSUES.md, DEBUG_GUIDE.md creati                   |

---

## 💡 Tips per Trovare Cosa Cerchi

### Cerca per Keyword

- Se cerchi "wallet" → vai in [11-FEATURES/WALLET.md](11-FEATURES/WALLET.md)
- Se cerchi "API" → vai in [3-API/](3-API/)
- Se cerchi "deploy" → vai in [6-DEPLOYMENT/](6-DEPLOYMENT/)

### Cerca per Task

- Se vuoi "creare una spedizione" → [4-UI-COMPONENTS/WORKFLOWS.md](4-UI-COMPONENTS/WORKFLOWS.md)
- Se vuoi "testare il codice" → [5-TESTING/](5-TESTING/)
- Se vuoi "deploy in produzione" → [6-DEPLOYMENT/OVERVIEW.md](6-DEPLOYMENT/OVERVIEW.md)

### Cerca per Problema

- "Database connection failed" → [12-TROUBLESHOOTING/DATABASE_ISSUES.md](12-TROUBLESHOOTING/DATABASE_ISSUES.md)
- "API returns 500" → [12-TROUBLESHOOTING/API_ISSUES.md](12-TROUBLESHOOTING/API_ISSUES.md)
- "Performance lenta" → [12-TROUBLESHOOTING/PERFORMANCE_ISSUES.md](12-TROUBLESHOOTING/PERFORMANCE_ISSUES.md)

---

_Last Updated: 2026-01-12_  
_Version: 1.0.0_  
_Status: 🟢 Active_
