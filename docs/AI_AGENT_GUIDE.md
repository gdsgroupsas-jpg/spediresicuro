# 🤖 Guida per AI Agents - Come Leggere la Documentazione

## Overview

Guida completa per AI agents su come navigare e utilizzare la documentazione strutturata di SpedireSicuro.

## Target Audience

- [x] AI Agents
- [x] Developers (per capire come gli agenti usano la doc)
- [ ] Business/PM

---

## 🚀 Quick Start per AI Agents

### 1. Punto di Partenza: `docs/README.md`

**SEMPRE iniziare da qui:**

```markdown
docs/README.md
```

**Contiene:**

- Indice completo di tutta la documentazione
- Quick reference per trovare rapidamente cosa serve
- Link organizzati per categoria
- Stato di completamento di ogni sezione

**Come usarlo:**

1. Leggi `docs/README.md` per capire la struttura
2. Identifica la sezione rilevante per il tuo task
3. Segui i link ai documenti specifici

---

## 📋 Strategia di Lettura per Tipo di Task

### Task: Modificare/Implementare Feature

**Ordine di lettura:**

1. **`docs/README.md`** - Indice generale
2. **`docs/2-ARCHITECTURE/OVERVIEW.md`** - Architettura generale
3. **`docs/11-FEATURES/[FEATURE_NAME].md`** - Feature specifica
4. **`docs/2-ARCHITECTURE/BACKEND.md`** o **`docs/2-ARCHITECTURE/DATABASE.md`** - Dettagli tecnici
5. **`docs/3-API/REST_API.md`** o **`docs/3-API/SERVER_ACTIONS.md`** - API rilevanti

**Esempio - Task: Modificare Wallet:**

```
1. docs/README.md → Quick reference
2. docs/11-FEATURES/WALLET.md → Feature completa
3. docs/2-ARCHITECTURE/DATABASE.md → Wallet system tecnico
4. docs/8-SECURITY/OVERVIEW.md → Security considerations
```

---

### Task: Fix Bug / Troubleshooting

**Ordine di lettura:**

1. **`docs/12-TROUBLESHOOTING/COMMON_ISSUES.md`** - Problemi comuni
2. **`docs/12-TROUBLESHOOTING/[SPECIFIC_ISSUE].md`** - Issue specifica
   - `DATABASE_ISSUES.md` - Problemi database
   - `API_ISSUES.md` - Problemi API
   - `PERFORMANCE_ISSUES.md` - Problemi performance
3. **`docs/12-TROUBLESHOOTING/DEBUG_GUIDE.md`** - Tecniche debugging

**Esempio - Task: Fix errore 500 API:**

```
1. docs/12-TROUBLESHOOTING/API_ISSUES.md → Sezione "500 Internal Server Error"
2. docs/12-TROUBLESHOOTING/DEBUG_GUIDE.md → Debugging techniques
3. docs/3-API/ERROR_CODES.md → Codici errore
```

---

### Task: Implementare API Endpoint

**Ordine di lettura:**

1. **`docs/3-API/OVERVIEW.md`** - Panoramica API
2. **`docs/3-API/REST_API.md`** - Esempi endpoint esistenti
3. **`docs/2-ARCHITECTURE/BACKEND.md`** - Patterns backend
4. **`docs/8-SECURITY/AUTHENTICATION.md`** - Autenticazione
5. **`docs/3-API/ERROR_CODES.md`** - Error handling

---

### Task: Modificare Database Schema

**Ordine di lettura:**

1. **`docs/2-ARCHITECTURE/DATABASE.md`** - Architettura database
2. **`docs/8-SECURITY/OVERVIEW.md`** - RLS policies
3. **`docs/12-TROUBLESHOOTING/DATABASE_ISSUES.md`** - Best practices
4. **`docs/6-DEPLOYMENT/CI_CD.md`** - Migration process

---

### Task: Deploy / CI/CD

**Ordine di lettura:**

1. **`docs/6-DEPLOYMENT/OVERVIEW.md`** - Deployment overview
2. **`docs/6-DEPLOYMENT/VERCEL.md`** - Deploy Vercel
3. **`docs/6-DEPLOYMENT/CI_CD.md`** - CI/CD pipelines
4. **`docs/7-OPERATIONS/MONITORING.md`** - Post-deploy monitoring

---

## 🔍 Come Trovare Documenti Specifici

### Metodo 1: Quick Reference in README.md

**`docs/README.md` → Sezione "Quick Reference"**

Tabella che mappa "cosa stai cercando" → "dove trovarlo"

**Esempio:**

```
| Così stai cercando? | Vai qui |
|---------------------|----------|
| API endpoints | [3-API/REST_API.md](3-API/REST_API.md) |
| Sicurezza & RLS | [8-SECURITY/OVERVIEW.md](8-SECURITY/OVERVIEW.md) |
```

---

### Metodo 2: Indice Completo in README.md

**`docs/README.md` → Sezione "Indice Completo"**

Organizzato per categoria:

- 1-GETTING-STARTED
- 2-ARCHITECTURE
- 3-API
- 4-UI-COMPONENTS
- 5-TESTING
- 6-DEPLOYMENT
- 7-OPERATIONS
- 8-SECURITY
- 9-BUSINESS
- 10-AI-AGENT
- 11-FEATURES
- 12-TROUBLESHOOTING

---

### Metodo 3: Codebase Search

**Usa `codebase_search` per trovare documenti per argomento:**

```typescript
// Esempio: Cercare documentazione su wallet
codebase_search({
  query: 'How does the wallet system work?',
  target_directories: ['docs'],
});
```

---

## 📖 Struttura Standard Documenti

**Tutti i documenti seguono `docs/_TEMPLATE.md`:**

### Sezioni Standard:

1. **Overview** - Cosa fa il documento (2-3 righe)
2. **Target Audience** - Chi è il documento per
3. **Prerequisites** - Cosa serve sapere prima
4. **Quick Reference** - Tabella link rapidi
5. **Content** - Contenuto dettagliato
6. **Examples** - Esempi codice
7. **Common Issues** - Problemi comuni
8. **Related Documentation** - Link a documenti correlati
9. **Changelog** - Storico modifiche

**Come usarlo:**

- Leggi **Overview** per capire se è il documento giusto
- Leggi **Quick Reference** per link rapidi
- Leggi **Content** per dettagli
- Usa **Related Documentation** per approfondire

---

## 🎯 Best Practices per AI Agents

### 1. Leggi Prima di Implementare

**❌ Sbagliato:**

```
Task: Modificare wallet
→ Inizia subito a modificare codice
```

**✅ Corretto:**

```
Task: Modificare wallet
→ Leggi docs/11-FEATURES/WALLET.md
→ Leggi docs/2-ARCHITECTURE/DATABASE.md (sezione Wallet)
→ Poi implementa
```

---

### 2. Usa Link, Non Duplicare

**❌ Sbagliato:**

```
// Copia tutto il contenuto di un documento in un altro
```

**✅ Corretto:**

```
// Link al documento originale
Vedi: [Wallet Feature](../11-FEATURES/WALLET.md)
```

---

### 3. Verifica Single Source of Truth

**Ogni concetto è documentato in UN SOLO posto:**

- Wallet → `docs/11-FEATURES/WALLET.md`
- Security → `docs/8-SECURITY/`
- API → `docs/3-API/`

**Se trovi duplicazioni, linka invece di duplicare.**

---

### 4. Segui la Gerarchia

**Ordine di priorità documentazione:**

1. **Feature-specific** (`docs/11-FEATURES/`) - Feature complete
2. **Architecture** (`docs/2-ARCHITECTURE/`) - Dettagli tecnici
3. **API** (`docs/3-API/`) - Endpoints e Server Actions
4. **Security** (`docs/8-SECURITY/`) - Security considerations
5. **Troubleshooting** (`docs/12-TROUBLESHOOTING/`) - Problemi comuni

**Leggi prima il livello più specifico, poi approfondisci.**

---

## 🔗 Link Pattern

### Link Relativi

**Tutti i link usano path relativi:**

```markdown
[Wallet Feature](../11-FEATURES/WALLET.md)
[Security Overview](../8-SECURITY/OVERVIEW.md)
[API REST](../3-API/REST_API.md)
```

**Come seguirli:**

- `../` = sali di una directory
- `./` = stessa directory
- Nome file = stessa directory

---

## 📚 Documenti Chiave per AI Agents

### Must-Read (Prima di Qualsiasi Modifica)

1. **`docs/README.md`** - Indice completo
2. **`docs/2-ARCHITECTURE/OVERVIEW.md`** - Architettura generale
3. **`docs/8-SECURITY/OVERVIEW.md`** - Security overview

### Feature-Specific (Quando Rilevante)

- **Wallet:** `docs/11-FEATURES/WALLET.md`
- **Shipments:** `docs/11-FEATURES/SHIPMENTS.md`
- **Price Lists:** `docs/11-FEATURES/PRICE_LISTS.md`
- **Reseller:** `docs/11-FEATURES/RESELLER_HIERARCHY.md`

### Troubleshooting (Quando Serve)

- **Common Issues:** `docs/12-TROUBLESHOOTING/COMMON_ISSUES.md`
- **Database:** `docs/12-TROUBLESHOOTING/DATABASE_ISSUES.md`
- **API:** `docs/12-TROUBLESHOOTING/API_ISSUES.md`
- **Debug:** `docs/12-TROUBLESHOOTING/DEBUG_GUIDE.md`

---

## 🚫 Cosa NON Fare

### ❌ Non Leggere Documenti Archiviati

**`docs/archive/` contiene documenti storici:**

- Non usare per sviluppo attivo
- Solo per riferimento storico
- Usa la nuova documentazione strutturata

**Vecchi documenti archiviati:**

- `docs/archive/root/ARCHITECTURE.md` → Usa `docs/2-ARCHITECTURE/`
- `docs/archive/root/SECURITY.md` → Usa `docs/8-SECURITY/`
- `docs/archive/root/VISION_BUSINESS.md` → Usa `docs/9-BUSINESS/`

---

### ❌ Non Duplicare Contenuto

**Ogni concetto in UN SOLO posto:**

- Link invece di copiare
- Riferisci invece di ripetere

---

### ❌ Non Saltare Overview

**Sempre leggere Overview prima:**

- Capisci se è il documento giusto
- Vedi struttura e link rapidi
- Eviti di leggere documenti sbagliati

---

## ✅ Checklist Pre-Implementazione

**Prima di implementare qualsiasi modifica:**

- [ ] Ho letto `docs/README.md` per capire struttura
- [ ] Ho letto documenti feature-specific rilevanti
- [ ] Ho letto documenti architecture rilevanti
- [ ] Ho letto documenti security se tocca auth/RLS
- [ ] Ho verificato link a documenti correlati
- [ ] Ho capito il contesto prima di modificare

---

## 🔄 Workflow Consigliato

### Step 1: Capire il Task

```
1. Leggi task description
2. Identifica area (Feature, API, Database, Security, ecc.)
3. Vai a docs/README.md → Quick Reference
```

### Step 2: Leggere Documentazione Rilevante

```
1. Leggi documento principale (feature/architecture)
2. Leggi documenti correlati (link in "Related Documentation")
3. Leggi troubleshooting se necessario
```

### Step 3: Implementare

```
1. Usa documentazione come riferimento
2. Segui patterns documentati
3. Rispetta security guidelines
```

### Step 4: Verificare

```
1. Verifica che implementazione segua documentazione
2. Aggiorna documentazione se necessario
3. Aggiungi link se crei nuovo documento
```

---

## 📝 Esempi Pratici

### Esempio 1: Task "Aggiungere campo a wallet"

**Lettura:**

1. `docs/README.md` → Quick Reference → Wallet
2. `docs/11-FEATURES/WALLET.md` → Sistema wallet completo
3. `docs/2-ARCHITECTURE/DATABASE.md` → Wallet system tecnico
4. `docs/8-SECURITY/OVERVIEW.md` → Security considerations

**Implementazione:**

- Segui pattern documentati in WALLET.md
- Usa funzioni atomiche (increment_wallet_balance, ecc.)
- Rispetta RLS policies

---

### Esempio 2: Task "Fix errore 500 in API shipments"

**Lettura:**

1. `docs/12-TROUBLESHOOTING/API_ISSUES.md` → Sezione "500 Internal Server Error"
2. `docs/12-TROUBLESHOOTING/DEBUG_GUIDE.md` → Debugging techniques
3. `docs/11-FEATURES/SHIPMENTS.md` → Shipment creation flow
4. `docs/3-API/REST_API.md` → Endpoint shipments/create

**Debug:**

- Segui checklist in DEBUG_GUIDE.md
- Verifica errori comuni in API_ISSUES.md
- Controlla logs come documentato

---

## Related Documentation

- [README.md](README.md) - Indice completo documentazione
- [Template](_TEMPLATE.md) - Template per nuovi documenti
- [2-ARCHITECTURE/OVERVIEW.md](2-ARCHITECTURE/OVERVIEW.md) - Architettura generale
- [8-SECURITY/OVERVIEW.md](8-SECURITY/OVERVIEW.md) - Security overview
- [12-TROUBLESHOOTING/DEBUG_GUIDE.md](12-TROUBLESHOOTING/DEBUG_GUIDE.md) - Debugging guide

---

## Changelog

| Date       | Version | Changes         | Author   |
| ---------- | ------- | --------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version | AI Agent |

---

_Last Updated: 2026-01-12_  
_Status: 🟢 Active_  
_Maintainer: AI Agents + Dev Team_
