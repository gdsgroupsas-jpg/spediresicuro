# 📚 Documentazione Attiva - SpedireSicuro.it

> **Indice della documentazione attiva e aggiornata del progetto**

Questa cartella contiene **solo documentazione attiva** necessaria per:
- ✅ Sviluppo locale
- ✅ Deploy in produzione
- ✅ Onboarding nuovi sviluppatori
- ✅ Operazioni quotidiane

**Per documentazione storica, vedi [`archive/README.md`](archive/README.md)**

---

## 🚀 Quick Start

### Setup Iniziale
- **[SUPABASE_SETUP_GUIDE.md](SUPABASE_SETUP_GUIDE.md)** - Setup completo Supabase
- **[OAUTH_SETUP.md](OAUTH_SETUP.md)** - Configurazione OAuth (Google, GitHub)
- **[GEO_AUTOCOMPLETE_SETUP.md](GEO_AUTOCOMPLETE_SETUP.md)** - Setup autocompletamento geografico
- **[MICROSOFT_AUTHENTICATOR_SETUP.md](MICROSOFT_AUTHENTICATOR_SETUP.md)** - Setup Microsoft Authenticator

---

## 🔐 Sicurezza

### Guide Sicurezza
- **[SMOKE_TEST_SECURITY_BASELINE.md](SMOKE_TEST_SECURITY_BASELINE.md)** - ⭐ Baseline sicurezza: smoke test Supabase e gate CI/CD
- **[SICUREZZA_AUTOMATION.md](SICUREZZA_AUTOMATION.md)** - Sicurezza sistema automation
- **[SICUREZZA_CRITICA_PASSWORD.md](SICUREZZA_CRITICA_PASSWORD.md)** - Gestione password critiche
- **[SICUREZZA_GEO_LOCATIONS.md](SICUREZZA_GEO_LOCATIONS.md)** - Sicurezza geo locations
- **[SICUREZZA_COMMIT.md](SICUREZZA_COMMIT.md)** - Best practices commit sicuri
- **[CSP_SECURITY_POLICY.md](CSP_SECURITY_POLICY.md)** - Content Security Policy
- **[CONFIGURAZIONE_ENCRYPTION_KEY.md](CONFIGURAZIONE_ENCRYPTION_KEY.md)** - Configurazione chiavi encryption

### Privacy e Compliance
- **[COME_PROTEGGO_I_MIEI_DATI.md](COME_PROTEGGO_I_MIEI_DATI.md)** - Privacy e protezione dati utenti
- **[GDPR_IMPLEMENTATION.md](GDPR_IMPLEMENTATION.md)** - Implementazione GDPR

---

## 🚚 Feature e Sistemi

### ⭐ Documentazione Enterprise-Grade Completa
- **[REVISIONE_FINALE_ENTERPRISE.md](REVISIONE_FINALE_ENTERPRISE.md)** - ⭐ **DOCUMENTAZIONE ENTERPRISE COMPLETA** - Vision, Business Architecture, Financial Core, Technical Stack, AI Orchestrator, Security, Developer Guide, Roadmap, Quick Reference, PR #40 e #41

### Corrieri e Spedizioni
- **[README_API_CORRIERI.md](README_API_CORRIERI.md)** - Sistema completo API corrieri
- **[COURIER_CONFIGS_SYSTEM.md](COURIER_CONFIGS_SYSTEM.md)** - Sistema configurazioni corrieri
- **[GUIDA_REGISTRAZIONE_POSTE.md](GUIDA_REGISTRAZIONE_POSTE.md)** - Registrazione API Poste Italiane
- **[SPEDIZIONI_CANCELLATE.md](SPEDIZIONI_CANCELLATE.md)** - ⭐ Sistema soft delete con audit trail e cancellazione simultanea

### Automation
- **[AUTOMATION_SPEDISCI_ONLINE.md](AUTOMATION_SPEDISCI_ONLINE.md)** - Automation SpedisciOnline
- **[AUTOMATION_LOCK_SYSTEM.md](AUTOMATION_LOCK_SYSTEM.md)** - Sistema lock automation

### API e Versioning
- **[API_VERSIONING.md](API_VERSIONING.md)** - Sistema versioning API

---

## 🧪 Testing

- **[SMOKE_TEST_SECURITY_BASELINE.md](SMOKE_TEST_SECURITY_BASELINE.md)** - ⭐ Smoke test Supabase e gate sicurezza CI/CD
- **[E2E_TEST_COMPLETED.md](E2E_TEST_COMPLETED.md)** - Test end-to-end completati

---

## 🛠️ Utilities

- **[GUIDA_ANTI_DUPLICATI.md](GUIDA_ANTI_DUPLICATI.md)** - Guida prevenzione duplicati

---

## 📂 Struttura Documentazione

```
docs/
├── README.md                    # ← Questo file (indice attivo)
│
├── Setup/                        # Guide setup
│   ├── SUPABASE_SETUP_GUIDE.md
│   ├── OAUTH_SETUP.md
│   ├── GEO_AUTOCOMPLETE_SETUP.md
│   └── MICROSOFT_AUTHENTICATOR_SETUP.md
│
├── Security/                     # Documentazione sicurezza
│   ├── SMOKE_TEST_SECURITY_BASELINE.md  # ⭐ Baseline sicurezza
│   ├── SICUREZZA_*.md
│   ├── CSP_SECURITY_POLICY.md
│   ├── CONFIGURAZIONE_ENCRYPTION_KEY.md
│   ├── COME_PROTEGGO_I_MIEI_DATI.md
│   └── GDPR_IMPLEMENTATION.md
│
├── Features/                     # Documentazione feature
│   ├── README_API_CORRIERI.md
│   ├── COURIER_CONFIGS_SYSTEM.md
│   ├── GUIDA_REGISTRAZIONE_POSTE.md
│   ├── AUTOMATION_*.md
│   └── API_VERSIONING.md
│
├── Testing/                      # Testing
│   ├── SMOKE_TEST_SECURITY_BASELINE.md  # ⭐ Smoke test Supabase
│   └── E2E_TEST_COMPLETED.md
│
└── archive/                      # 📦 Documentazione storica
    └── README.md                 # Indice archivio
```

---

## 🔍 Come Usare Questa Documentazione

1. **Per setup iniziale**: Inizia da "Quick Start" sopra
2. **Per sicurezza**: Consulta la sezione "Sicurezza"
3. **Per feature specifiche**: Vai alla sezione "Feature e Sistemi"
4. **Per problemi storici**: Controlla `archive/` (ma probabilmente non serve)

---

## 📝 Note

- **Tutti i file qui sono ATTIVI e AGGIORNATI**
- **File obsoleti sono in `archive/`**
- **Se trovi documentazione obsoleta qui, segnalala**

---

**Ultimo aggiornamento**: 9 Gennaio 2026  
**Stato**: ✅ Documentazione attiva e organizzata  
**Feature recenti**: 
- Sistema Spedizioni Cancellate (soft delete + audit trail) - 31 Dicembre 2025
- PR #41: Servizi Accessori ID Numerici, Validazione Corriere, Multi-Config, Cleanup Test - 9 Gennaio 2026
- ⭐ Documentazione Enterprise-Grade Completa (REVISIONE_FINALE_ENTERPRISE.md) - 9 Gennaio 2026
