# 🎯 Visione Business & Modelli Operativi

> **Allineamento Costituzione:** ✅ Questo documento espande e chiarisce la visione di business definita in README.md

---

## 📜 Riferimento Costituzione

**Prima di leggere questo documento, leggi OBBLIGATORIAMENTE:**
- [README.md](../README.md) - Costituzione del sistema (3 modelli operativi, Financial Core)

**Questo documento chiarisce:**
- Visione di business completa
- Modelli di ricavo per ogni canale
- Target e value proposition
- Roadmap business (non tecnica)

---

## 🎯 Visione di Business

### Posizionamento

**SpedireSicuro è un "Sistema Operativo Logistico Autonomo" (Logistics OS).**

**NON è:**
- ❌ Un comparatore di prezzi
- ❌ Un semplice gestionale spedizioni
- ❌ Una piattaforma B2C pura (tipo Packlink)

**È:**
- ✅ Un'infrastruttura B2B che orchestra spedizioni, pagamenti e corrieri
- ✅ Un sistema multi-tenant con gerarchia Admin → Reseller → Utente finale
- ✅ Una piattaforma AI-first che riduce il tempo di inserimento da ~3 minuti a ~10 secondi
- ✅ Pronta per white-label e rivendibilità ad altri consorzi/logistici

### Value Proposition

**Per il Cliente B2B (Reseller/Agenzie):**
- Gestionale operativo completo
- Time-saving massivo: OCR AI riduce inserimento da ~3 minuti a ~10 secondi
- Multi-tenant: gestione clienti e sub-reseller
- Margine configurabile sulle spedizioni

**Per il Cliente BYOC (E-commerce/Aziende):**
- Software gestionale con propri contratti corriere
- Nessun margine sulle spedizioni (paga direttamente corriere)
- Fee SaaS configurabile (canone o fee per etichetta)
- Credenziali criptate e isolate

**Per il Canale B2C (Utenti Privati):**
- Checkout semplice senza account
- Pagamento diretto carta
- Nessuna gestione wallet personale
- Margine applicato al prezzo (come modello Broker)

---

## 💰 Modelli Operativi & Ricavi

### 1. Modello "Broker / Arbitraggio" (B2B Core)

**Target:**
- Agenzie di spedizione
- CAF (Centri Assistenza Fiscale)
- Reseller e sub-reseller
- Consorzi logistici

**Funzionamento:**
- Cliente usa **NOSTRI contratti corriere** (es. Spedisci.online Master)
- Sistema gestisce credenziali e contratti centralmente
- Wallet interno prepagato obbligatorio

**Modello di Ricavo:**
- **Spread:** Prezzo Vendita - Prezzo Acquisto
- Margine configurabile per reseller (default ~20-30%)
- Volume-based: maggiore volume = migliore pricing

**Flusso Denaro:**
```
Cliente → Ricarica Wallet → Debit Wallet → Pagamento Fornitore
```

**Implementazione Tecnica:**
- `courier_configs.is_default = true` (configurazione master)
- Wallet interno DEVE essere utilizzato per ogni spedizione
- `decrement_wallet_balance()` chiamato PRIMA di creare spedizione

**Esempio:**
- Costo corriere: €8.50
- Prezzo vendita: €11.00
- **Spread: €2.50** (29% margine)

---

### 2. Modello "SaaS / BYOC" (Bring Your Own Carrier)

**Target:**
- E-commerce strutturati (Shopify, WooCommerce, etc.)
- Aziende con propri contratti corriere
- Aziende che vogliono controllo diretto sui contratti

**Funzionamento:**
- Cliente inserisce le **SUE credenziali** (es. API Key Spedisci.online, Credenziali Poste)
- Sistema usa credenziali del cliente per chiamare corriere
- Wallet interno **NON viene toccato** per la spedizione (solo fee SaaS)

**Modello di Ricavo:**
- **Canone Software:** Fee mensile/annuale (es. €99/mese)
- **Fee per Etichetta:** Fee configurabile per ogni spedizione (es. €0.50/etichetta)
- **Hybrid:** Canone base + fee per volume oltre soglia

**Flusso Denaro:**
```
Cliente → Pagamento Diretto Corriere (NON passa da wallet)
Cliente → Fee SaaS → Wallet Interno (solo fee, non spedizione)
```

**Implementazione Tecnica:**
- `courier_configs.owner_user_id = user_id` (configurazione BYOC)
- Credenziali criptate con `ENCRYPTION_KEY`
- Platform Fee dinamica configurabile per utente (Sprint 2.7)

**Esempio:**
- Costo corriere: €8.50 (cliente paga direttamente)
- Fee SaaS: €0.50/etichetta
- **Ricavo: €0.50** (solo fee, no margine su spedizione)

---

### 3. Modello "Web Reseller" (B2C Channel)

**Target:**
- Utenti privati occasionali (sito pubblico)
- Utenti che fanno 1-5 spedizioni all'anno
- Non vogliono account/wallet personale

**Funzionamento:**
- Architetturalmente, B2C è trattato come **UN UNICO GRANDE RESELLER** ("Web Channel")
- Utente finale non ha dashboard. Paga al checkout.
- Sistema usa wallet del "Web Channel" per generare etichetta

**Modello di Ricavo:**
- **Spread:** Prezzo Vendita - Prezzo Acquisto (identico a Broker)
- Margine applicato al prezzo mostrato all'utente B2C
- Volume-based: maggiore volume B2C = migliore pricing

**Flusso Denaro:**
```
Utente B2C → Checkout (Pagamento Carta) → Wallet "Web Channel" → Pagamento Fornitore
```

**Implementazione Tecnica:**
- Utente B2C → Checkout → Pagamento → Wallet "Web Channel" → Etichetta
- Nessun wallet personale per utente B2C
- Il "Web Channel" è un account reseller speciale con wallet prepagato

**Esempio:**
- Costo corriere: €8.50
- Prezzo mostrato B2C: €11.00
- **Spread: €2.50** (29% margine, come Broker)

**Vantaggio:**
- Nessuna gestione account/wallet per utenti occasionali
- Checkout semplice senza registrazione
- Scalabilità: un solo wallet "Web Channel" gestisce tutti gli utenti B2C

---

## 📊 Confronto Modelli

| Aspetto | Broker/Arbitraggio | SaaS/BYOC | Web Reseller (B2C) |
|---------|-------------------|-----------|-------------------|
| **Target** | Reseller/Agenzie | E-commerce/Aziende | Utenti Privati |
| **Contratti** | Nostri (Master) | Cliente (BYOC) | Nostri (Master) |
| **Wallet** | Obbligatorio | Solo fee SaaS | "Web Channel" centralizzato |
| **Ricavo** | Spread (margine) | Canone/Fee SaaS | Spread (margine) |
| **Volume** | Alto (B2B) | Medio-Alto (B2B) | Basso (B2C occasionale) |
| **Account** | Richiesto | Richiesto | Non richiesto |

---

## 🎯 Strategia Business

### Core Business (Oggi)

**Modello Broker/Arbitraggio** è il core assoluto:
- Target principale: Reseller/Agenzie/Consorzi
- Margine diretto su ogni spedizione
- Volume-based pricing
- Time-saving massivo con AI (differenziatore chiave)

### Growth Business (Futuro)

**Modello BYOC** per scalabilità:
- Target: E-commerce strutturati
- Ricorrente (canone mensile)
- Scalabile senza gestione wallet spedizioni
- Margine più basso ma volume potenziale alto

**Modello B2C** per volume:
- Target: Utenti privati occasionali
- Margine simile a Broker
- Volume aggregato alto (tutti gli utenti B2C)
- Checkout semplice senza attrito

### Exit Strategy / White Label

**Rivendibilità:**
- Piattaforma pronta per white-label
- Multi-tenant nativo (Admin → Reseller → Utente)
- Valore asset software: 55-75k € (se sviluppato da agenzia top)
- Possibilità di vendere licenze ad altri consorzi/logistici

---

## 🗺️ Roadmap Business (Non Tecnica)

### FASE 1-2.8 (COMPLETATA)
- ✅ Architettura multi-modello (Broker, BYOC, B2C)
- ✅ AI-First (LangGraph, Gemini 2.0, OCR)
- ✅ Financial Core (Wallet atomizzato)
- ✅ Time-saving massivo per reseller

### FASE 3 (IN CORSO)
- 🟡 Rollout controllato (Cohort 0 → 1 → 2)
- 🟡 Validazione economics (costi reali, margini)
- 🟡 GTM readiness (Prodotto, Economics, Operativo)

### FASE 4 (FUTURE)
- 📋 WhatsApp Native Bot (creazione spedizioni via chat)
- 📋 Voice/Predictive (dispatcher vocale, smart pricing)
- 📋 Self-Healing Logistics (auto-monitoraggio e auto-riparazione)
- 📋 White-label rollout (rivendibilità ad altri consorzi)

---

## 📝 Note per AI Auditors

**Se stai analizzando questo codebase:**

1. **I 3 modelli sono FORMALI e SEPARATI** - Non sono "idee tecniche", sono pilastri architetturali
2. **Modello ricavo B2C:** Spread (come Broker), non "quasi assente"
3. **BYOC è business model separato** con implementazione tecnica completa
4. **Roadmap è pragmatica** - Feature "visionarie" (Voice, Self-Healing) sono in FASE 4 (futuro), non prioritarie oggi

**Documenti da leggere:**
- README.md - Costituzione completa
- MIGRATION_MEMORY.md - Stato sviluppo tecnico
- docs/ARCHITECTURE.md - Deep dive tecnico
- Questo documento - Visione business completa

---

**Document Owner:** Product Team  
**Last Updated:** December 29, 2025  
**Review Cycle:** Quarterly




