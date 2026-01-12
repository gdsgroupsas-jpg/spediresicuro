# Business Models - SpedireSicuro

## Overview

Questo documento descrive i 3 modelli operativi di SpedireSicuro: Broker/Arbitraggio, SaaS/BYOC, e Web Reseller (B2C).

## Target Audience

- [ ] Developers
- [ ] DevOps
- [x] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- Understanding of B2B SaaS models
- Logistics industry basics

## Quick Reference

| Sezione | Pagina | Link |
|---------|--------|------|
| Broker Model | docs/9-BUSINESS/BUSINESS_MODELS.md | [Broker](#1-modello-broker--arbitraggio-b2b-core) |
| BYOC Model | docs/9-BUSINESS/BUSINESS_MODELS.md | [BYOC](#2-modello-saas--byoc-bring-your-own-carrier) |
| B2C Model | docs/9-BUSINESS/BUSINESS_MODELS.md | [B2C](#3-modello-web-reseller-b2c-channel) |
| Confronto | docs/9-BUSINESS/BUSINESS_MODELS.md | [Confronto](#confronto-modelli) |

## Content

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
- Platform Fee dinamica configurabile per utente

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

### Confronto Modelli

| Aspetto | Broker/Arbitraggio | SaaS/BYOC | Web Reseller (B2C) |
|---------|-------------------|-----------|-------------------|
| **Target** | Reseller/Agenzie | E-commerce/Aziende | Utenti Privati |
| **Contratti** | Nostri (Master) | Cliente (BYOC) | Nostri (Master) |
| **Wallet** | Obbligatorio | Solo fee SaaS | "Web Channel" centralizzato |
| **Ricavo** | Spread (margine) | Canone/Fee SaaS | Spread (margine) |
| **Volume** | Alto (B2B) | Medio-Alto (B2B) | Basso (B2C occasionale) |
| **Account** | Richiesto | Richiesto | Non richiesto |

---

## Examples

### Calcolo Ricavo Broker

```
Volume: 1000 spedizioni/mese
Spread medio: €2.50
Ricavo mensile: €2,500
Ricavo annuo: €30,000
```

### Calcolo Ricavo BYOC

```
Volume: 5000 spedizioni/mese
Fee per etichetta: €0.50
Ricavo mensile: €2,500
Canone base: €99/mese
Ricavo totale mensile: €2,599
```

---

## Common Issues

| Issue | Soluzione |
|-------|-----------|
| Confusione tra modelli | Vedere tabella confronto |
| Modello ricavo non chiaro | Vedere esempi per ogni modello |

---

## Related Documentation

- [Business Vision](VISION.md) - Visione business completa
- [README.md](../../README.md) - Costituzione sistema

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0.0 | Initial version | AI Agent |

---
*Last Updated: 2026-01-12*  
*Status: 🟢 Active*  
*Maintainer: Product Team*
