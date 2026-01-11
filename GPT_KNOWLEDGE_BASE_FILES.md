# 📚 SpedireSicuro - Documentazione Docs/

> **Spiegazione completa dei file nella cartella docs/**

---

## 📊 PANORAMICA RAPIDA

**Totale Files:** 108 file markdown  
**Categorie:** 10 categorie principali  
**Attivi:** ~85 file  
**Archiviati:** ~23 file (NON usare)

---

## ✅ CATEGORIA 1: DOCUMENTAZIONE CORE (PRIORITÀ 1)

Questi sono i **file più importanti** che il GPT DEVE conoscere.

### 📋 Indice e Guide Generali

| File | Descrizione | Perché Importante |
|------|-------------|------------------|
| **README.md** | Indice documentazione attiva | Entry point, spiega cosa consultare e cosa evitare |
| **MIGRATION_MEMORY.md** | Architettura AI e stato sviluppo | ⭐ SINGLE SOURCE OF TRUTH per architettura AI |
| **ROADMAP.md** | Features in corso e future | Piano sviluppo, stato features |
| **REVISIONE_FINALE_ENTERPRISE.md** | ⭐ Enterprise completa | Vision, Business, Technical Stack, AI, Security, Developer Guide |
| **SPIEGAZIONE_SEMPLICE_ENTERPRISE.md** | Spiegazione semplice enterprise | Versione semplificata per capire sistema |

### 🏛️ Architettura e Business

| File | Descrizione |
|------|-------------|
| **ARCHITECTURE.md** | Deep dive tecnico, patterns, performance |
| **VISION_BUSINESS.md** | Visione business completa, modelli ricavo, target |
| **MONEY_FLOWS.md** | Sistema wallet, anti-fraud, idempotency |
| **SECURITY.md** | Architettura sicurezza multi-tenant, RLS policies |
| **DB_SCHEMA.md** | Tabelle database, RLS policies, invarianti |
| **STORIA_ACCOUNT_TYPE.md** | Evoluzione account types (role → account_type) |
| **SPIEGAZIONE_FEE_VS_ABBONAMENTO.md** | Differenza fee per etichetta vs abbonamento |

### 🧪 Testing e QA

| File | Descrizione |
|------|-------------|
| **TESTING_QA_PLAN.md** | Piano testing QA completo |
| **TEST_TYPES_EXPLAINED.md** | Spiegazione tipi test (unit, integration, e2e) |
| **TEST_IMPORTANCE_EXPLAINED.md** | Perché i test sono importanti |
| **PLAYWRIGHT_VS_VITEST.md** | Confronto Playwright vs Vitest |
| **E2E_TEST_COMPLETED.md** | Test E2E completati |

---

## ⚙️ CATEGORIA 2: SETUP E CONFIGURAZIONE (PRIORITÀ 2)

Guide per configurare l'ambiente di sviluppo e strumenti.

### Supabase e Database

| File | Descrizione |
|------|-------------|
| **SUPABASE_SETUP_GUIDE.md** | Setup completo Supabase (cloud/local) |
| **SUPABASE_SECURITY_GUIDE.md** | Guida sicurezza Supabase |
| **SUPABASE_CLI_SETUP.md** | Setup Supabase CLI |
| **MIGRATIONS.md** | Storia migrations, procedure rollback |
| **CHECK_MIGRATIONS_GUIDA.md** | Guida verifiche migrations |
| **CHECK_MIGRATIONS_GUIDA_V2.md** | Guida verifiche migrations v2 |
| **VERIFY_MIGRATION.md** | Verifica migrations applicate |

### OAuth e Autenticazione

| File | Descrizione |
|------|-------------|
| **OAUTH_SETUP.md** | Configurazione OAuth (Google, GitHub) |
| **MICROSOFT_AUTHENTICATOR_SETUP.md** | Setup Microsoft Authenticator |

### Tool e Configurazione

| File | Descrizione |
|------|-------------|
| **GEO_AUTOCOMPLETE_SETUP.md** | Setup autocompletamento geografico |
| **CI_AND_TELEMETRY.md** | CI/CD e telemetria |
| **VS_CODE_TEST_SETUP.md** | Setup testing in VS Code |

---

## 🔐 CATEGORIA 3: SICUREZZA (PRIORITÀ 2)

Documentazione sicurezza, crittografia, compliance.

### Guide Sicurezza

| File | Descrizione |
|------|-------------|
| **SICUREZZA_AUTOMATION.md** | Sicurezza sistema automation |
| **SICUREZZA_CRITICA_PASSWORD.md** | Gestione password critiche |
| **SICUREZZA_GEO_LOCATIONS.md** | Sicurezza geo locations |
| **SICUREZZA_COMMIT.md** | Best practices commit sicuri |
| **CSP_SECURITY_POLICY.md** | Content Security Policy |
| **CONFIGURAZIONE_ENCRYPTION_KEY.md** | Configurazione chiavi encryption |
| **COME_PROTEGGO_I_MIEI_DATI.md** | Privacy e protezione dati utenti |
| **GDPR_IMPLEMENTATION.md** | Implementazione GDPR |

### Audit e Verifiche

| File | Descrizione |
|------|-------------|
| **SECURITY_AUDIT_COMPLETE.md** | Audit sicurezza completo |
| **ANALISI_FASE0_AUDIT.md** | Analisi audit fase 0 |
| **POST_DEPLOY_SECURITY_CHECKLIST.md** | Checklist sicurezza post-deploy |
| **SMOKE_TEST_SECURITY_BASELINE.md** | ⭐ Baseline sicurezza: smoke test Supabase |

---

## 🚀 CATEGORIA 4: CORRIERI E API (PRIORITÀ 2)

Documentazione integrazione corrieri e API.

| File | Descrizione |
|------|-------------|
| **README_API_CORRIERI.md** | Sistema completo API corrieri |
| **COURIER_CONFIGS_SYSTEM.md** | Sistema configurazioni corrieri |
| **GUIDA_REGISTRAZIONE_POSTE.md** | Registrazione API Poste Italiane |
| **SPEDIZIONI_CANCELLATE.md** | ⭐ Sistema soft delete con audit trail |
| **API_VERSIONING.md** | Sistema versioning API |

---

## 🤖 CATEGORIA 5: AI, ANNE E LLM (PRIORITÀ 3)

Documentazione AI Orchestrator, LangGraph, providers.

### AI Required Reading

| File | Descrizione |
|------|-------------|
| **AI_REQUIRED_READING.md** | Documentazione fondamentale per AI |

### Anne AI Assistant

| File | Descrizione |
|------|-------------|
| **AGENT_TESTING_PROMPT_RESELLER.md** | Prompt testing Anne per Reseller |
| **AGENT_TESTING_PROMPT_SUPERADMIN.md** | Prompt testing Anne per Superadmin |

### Calcolo Prezzi e Anne

| File | Descrizione |
|------|-------------|
| **ANALISI_CALCOLO_PREZZI_ANNE.md** | Analisi calcolo prezzi Anne |
| **SOLUZIONI_CALCOLO_PREZZI_ANNE.md** | Soluzioni calcolo prezzi Anne |

### Cursor/LLM Setup

| File | Descrizione |
|------|-------------|
| **CURSOR_GLM_SETUP.md** | Setup Cursor GLM (LLM) |
| **CURSOR_GLM_CHECKLIST.md** | Checklist setup Cursor GLM |
| **CURSOR_GLM_TROUBLESHOOTING.md** | Troubleshooting Cursor GLM |
| **CURSOR_GLM_MODEL_NAME_FIX.md** | Fix nome modello Cursor GLM |

### MCP (Model Context Protocol)

| File | Descrizione |
|------|-------------|
| **CURSOR_MCP_SETUP_COMPLETATO.md** | Setup MCP completato |
| **CURSOR_MCP_VISION_SETUP.md** | Setup MCP Vision |
| **CURSOR_ZAI_CONFIGURAZIONE_COMPLETA.md** | Configurazione completa Cursor ZAI |
| **MCP_ANTI_CRASH_POLICY.md** | Politica anti-crash MCP |

---

## 🏢 CATEGORIA 6: FEATURES SPECIFICHE (PRIORITÀ 3)

Documentazione per feature specifiche del sistema.

### Reseller e Clienti

| File | Descrizione |
|------|-------------|
| **FLUSSO_CREAZIONE_RESELLER.md** | Flusso creazione reseller |
| **RESELLER_SHIPMENT_CREATION.md** | Creazione spedizioni reseller |
| **MANUALE_UTENTE_RESELLER_V1.md** | Manuale utente reseller v1 |
| **ROADMAP_ENTERPRISE_LISTINI_WALLET.md** | Roadmap enterprise listini wallet |

### Courier Selection

| File | Descrizione |
|------|-------------|
| **DESIGN_COURIER_SELECTION_REALTIME.md** | Design selection corriere realtime |
| **DESIGN_COURIER_SELECTION_ENTERPRISE_GAPS.md** | Gap selection corriere enterprise |

### Integration Hub

| File | Descrizione |
|------|-------------|
| **INTEGRATION_HUB_QUICK_START.md** | Quick start Integration Hub |
| **INTEGRATION_HUB_IMPLEMENTATION.md** | Implementazione Integration Hub |
| **INTEGRATION_HUB_REFACTOR.md** | Refactor Integration Hub |
| **INTEGRATION_HUB_COMPLETE.md** | Integration Hub completo |

### Utility e Altro

| File | Descrizione |
|------|-------------|
| **MANUALE_UTENTE_DOC_MAP.md** | Mappa documentazione utente |
| **GUIDA_ANTI_DUPLICATI.md** | Guida prevenzione duplicati |
| **ORPHAN_SHIPMENTS_REMEDIATION.md** | Rimozione spedizioni orfane |

---

## 📊 CATEGORIA 7: OBSERVABILITY E MONITORING (PRIORITÀ 3)

Monitoring, logging, telemetria.

| File | Descrizione |
|------|-------------|
| **OBSERVABILITY_WALLET_IDEMPOTENCY.md** | Observability wallet idempotency |
| **SECURITY_GATE_ACTING_CONTEXT.md** | Security gate acting context |
| **CAPABILITY_SYSTEM_USAGE.md** | Uso sistema capability |

---

## 🔧 CATEGORIA 8: AUTOMATION E OPERATIONS (PRIORITÀ 3)

Automation, deployments, operazioni.

| File | Descrizione |
|------|-------------|
| **AUTOMATION_SPEDISCI_ONLINE.md** | Automation SpedisciOnline |
| **AUTOMATION_LOCK_SYSTEM.md** | Sistema lock automation |
| **OPS_RUNBOOK.md** | Runbook operazioni |
| **COME_METTERE_IN_PRODUCTION.md** | Come mettere in produzione |
| **ALERTS_SETUP.md** | Setup alert |
| **SLACK_SETUP_QUICK.md** | Setup Slack |
| **CHECKLIST_INTEGRAZIONE_MANUALE_IN_APP.md** | Checklist integrazione manuale |

### Sync Listini

| File | Descrizione |
|------|-------------|
| **SYNC_LISTINI_FORNITORE.md** | Sync listini fornitore |
| **TEST_E2E_SYNC.md** | Test E2E sync |

---

## 🐛 CATEGORIA 9: FIX REPORTS E DIAGNOSTICS (PRIORITÀ 4)

Report di fix, diagnosi, troubleshooting.

### Spedisci.Online 401

| File | Descrizione |
|------|-------------|
| **FIX_SPEDISCI_ONLINE_401.md** | Fix SpedisciOnline 401 |
| **SPEDISCI_ONLINE_401_FIX_SUMMARY.md** | Summary fix 401 |
| **SPEDISCI_ONLINE_401_FIX_COMPLETE.md** | Fix 401 completo |

### Shipment Creation

| File | Descrizione |
|------|-------------|
| **DIAGNOSTIC_SHIPMENT_CREATION_FAILURE.md** | Diagnostica fallimento spedizione |
| **FIX_SHIPMENT_CREATION_STEPS.md** | Steps fix creazione spedizione |
| **SHIPMENT_CREATION_FIX_SUMMARY.md** | Summary fix spedizione |
| **QUICK_FIX_GUIDE.md** | Guida quick fix |

### Production Fixes

| File | Descrizione |
|------|-------------|
| **PRODUCTION_FIX_SUMMARY.md** | Summary fix produzione |
| **FIX_PLAN_TEMPLATE.md** | Template piano fix |
| **REQUIRED_INPUTS_FOR_FIX.md** | Input richiesti per fix |

### PR Reviews

| File | Descrizione |
|------|-------------|
| **PR40_REVIEW_ENTERPRISE.md** | Review PR40 enterprise |
| **PR37_REVIEW.md** | Review PR37 |
| **RIEPILOGO_PR_33.md** | Riepilogo PR33 |

### Deploy Reports

| File | Descrizione |
|------|-------------|
| **DEPLOYMENT_COMPLETE_REPORT.md** | Report deploy completo |
| **DEVELOPMENT_PLAN_FASE3.md** | Piano sviluppo fase3 |
| **DEVELOPMENT_PLAN_FASE4.md** | Piano sviluppo fase4 |
| **FASE4_POST_DEPLOY_CHECKLIST.md** | Checklist post-deploy fase4 |
| **FASE4_COMPLETE_REPORT.md** | Report completo fase4 |
| **STAGING_TEST_RESULTS.md** | Risultati test staging |
| **MIGRATION_EXECUTION_REPORT_081_087.md** | Report migrations 081-087 |
| **MIGRATION_TEST_PLAN_081_087.md** | Piano test migrations 081-087 |

### Documentazione Allineamento

| File | Descrizione |
|------|-------------|
| **DOCUMENTATION_ALIGNMENT_REPORT.md** | Report allineamento documentazione |
| **STATO_IMPLEMENTAZIONE_PR40.md** | Stato implementazione PR40 |
| **SESSION_STATUS_2026_01_01.md** | Status sessione 1 Gennaio 2026 |

---

## 📦 CATEGORIA 10: ARCHIVE (NON USARE!)

⚠️ **ATTENZIONE:** Questi file sono storici e **NON devono essere usati**.

### archive/ (Documentazione Storica)

| Sottocartella | Descrizione |
|----------------|-------------|
| **archive/fixes/** | Fix storici obsoleti |
| **archive/verifications/** | Verifiche setup storiche |
| **archive/setup-temporanei/** | Setup temporanei obsoleti |
| **archive/root/** | Documentazione root storica |

### Phase3 (Sottocartella)

| File | Descrizione |
|------|-------------|
| **COST_ALERT_PRE_COHORT_0.md** | Alert costi pre-cohort0 |
| **PII_AUDIT_PRE_COHORT_0.md** | Audit PII pre-cohort0 |
| **KILL_SWITCH_DRY_RUN_PRE_COHORT_0.md** | Kill switch dry-run pre-cohort0 |

### Security (Sottocartella)

| File | Descrizione |
|------|-------------|
| **security/AUDIT_MODE_PROMPT.md** | Prompt audit mode |

⚠️ **NOTA:** I file in `archive/` contengono documentazione OBSOLETA. NON usarli per sviluppo o configurazione attuale.

---

## 🎯 RACCOMANDAZIONI PER IL GPT

### Files OBBLIGATORI per Knowledge Base

Se configuri la Knowledge Base del GPT, carica **PRIMA questi file**:

1. **README.md** - Indice e guida
2. **MIGRATION_MEMORY.md** - ⭐ Architettura AI (SSOT)
3. **REVISIONE_FINALE_ENTERPRISE.md** - Enterprise completa
4. **ROADMAP.md** - Features e roadmap
5. **ARCHITECTURE.md** - Deep dive tecnico
6. **MONEY_FLOWS.md** - Sistema wallet
7. **SECURITY.md** - Multi-tenant e RLS
8. **VISION_BUSINESS.md** - Visione business
9. **DB_SCHEMA.md** - Schema database
10. **SPEDIZIONI_CANCELLATE.md** - Sistema soft delete

### Files CONSIGLIATI per Knowledge Base

Per un GPT più completo:

11. **SUPABASE_SETUP_GUIDE.md** - Setup Supabase
12. **AUTOMATION_SPEDISCI_ONLINE.md** - Automation
13. **README_API_CORRIERI.md** - API corrieri
14. **OBSERVABILITY_WALLET_IDEMPOTENCY.md** - Observability
15. **OPS_RUNBOOK.md** - Operazioni
16. **TESTING_QA_PLAN.md** - Testing plan
17. **SECURITY_AUDIT_COMPLETE.md** - Audit sicurezza
18. **INTEGRATION_HUB_COMPLETE.md** - Integration Hub

### Files OPZIONALI per Knowledge Base

Per funzionalità specifiche:

19. **AI_REQUIRED_READING.md** - AI fundamentals
20. **AGENT_TESTING_PROMPT_SUPERADMIN.md** - Testing Anne
21. **FLUSSO_CREAZIONE_RESELLER.md** - Creazione reseller
22. **DESIGN_COURIER_SELECTION_REALTIME.md** - Courier selection
23. **SYNC_LISTINI_FORNITORE.md** - Sync listini
24. **CAPABILITY_SYSTEM_USAGE.md** - Capability system

---

## ❌ Files DA NON CARICARE

⚠️ **NON caricare nella Knowledge Base:**

1. **Tutti i file in `docs/archive/`** - Obsoleti
2. **Fix reports** (es. FIX_SPEDISCI_ONLINE_401.md) - Storici
3. **PR reviews** (es. PR40_REVIEW_ENTERPRISE.md) - Storici
4. **Deploy reports** (es. DEPLOYMENT_COMPLETE_REPORT.md) - Storici
5. **Migration reports** (es. MIGRATION_EXECUTION_REPORT_081_087.md) - Storici
6. **Session status** (es. SESSION_STATUS_2026_01_01.md) - Storici
7. **Phase3 files** - Storici pre-cohort

Questi file sono utili per **audit storici**, ma NON per sviluppo attuale.

---

## 📊 RIEPILOGO NUMERICO

### Totale Files per Categoria

| Categoria | Numero Files | Priorità per KB |
|-----------|--------------|-----------------|
| **Core** | 10 | OBBLIGATORIO |
| **Setup** | 10 | CONSIGLIATO |
| **Sicurezza** | 10 | CONSIGLIATO |
| **Corrieri/API** | 5 | CONSIGLIATO |
| **AI/LLM** | 10 | OPZIONALE |
| **Features** | 12 | OPZIONALE |
| **Observability** | 3 | OPZIONALE |
| **Automation/Ops** | 9 | OPZIONALE |
| **Fix Reports** | 20 | NON USARE |
| **Archive** | 23 | NON USARE |

### Totale: 108 files
- **Attivi:** 85 files
- **Archiviati:** 23 files

---

## 🚀 COME USARE QUESTA GUIDA

### Per Configurazione Knowledge Base Base (18 files)

Carica i 10-18 file **OBBLIGATORI + CONSIGLIATI**.

### Per Configurazione Knowledge Base Completa (30+ files)

Carica tutti i file attivi **(esclusi archive/ e fix reports)**.

### Per Audit Storici

Usa i file in `archive/` e i fix reports per capire la storia del progetto.

---

## 📞 RIFERIMENTI

Per domande su file specifici:
- Setup: Leggi files **Setup**
- Sicurezza: Leggi files **Sicurezza**
- Architettura: Leggi files **Core**
- AI: Leggi files **AI/LLM**

---

**Ultimo aggiornamento:** 11 Gennaio 2026  
**Files analizzati:** 108  
**Categorie:** 10
