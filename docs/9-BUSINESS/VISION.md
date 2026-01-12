# Business Vision - SpedireSicuro

## Overview

Questo documento descrive la visione di business di SpedireSicuro, il posizionamento, value proposition, strategia e roadmap business.

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
| Posizionamento | docs/9-BUSINESS/VISION.md | [Posizionamento](#posizionamento) |
| Value Proposition | docs/9-BUSINESS/VISION.md | [Value Proposition](#value-proposition) |
| Strategia Business | docs/9-BUSINESS/VISION.md | [Strategia](#strategia-business) |
| Roadmap | docs/9-BUSINESS/VISION.md | [Roadmap](#roadmap-business-non-tecnica) |

## Content

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

---

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

### Strategia Business

#### Core Business (Oggi)

**Modello Broker/Arbitraggio** è il core assoluto:
- Target principale: Reseller/Agenzie/Consorzi
- Margine diretto su ogni spedizione
- Volume-based pricing
- Time-saving massivo con AI (differenziatore chiave)

#### Growth Business (Futuro)

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

#### Exit Strategy / White Label

**Rivendibilità:**
- Piattaforma pronta per white-label
- Multi-tenant nativo (Admin → Reseller → Utente)
- Valore asset software: 55-75k € (se sviluppato da agenzia top)
- Possibilità di vendere licenze ad altri consorzi/logistici

---

### Roadmap Business (Non Tecnica)

#### FASE 1-2.8 (COMPLETATA)
- ✅ Architettura multi-modello (Broker, BYOC, B2C)
- ✅ AI-First (LangGraph, Gemini 2.0, OCR)
- ✅ Financial Core (Wallet atomizzato)
- ✅ Time-saving massivo per reseller

#### FASE 3 (IN CORSO)
- 🟡 Rollout controllato (Cohort 0 → 1 → 2)
- 🟡 Validazione economics (costi reali, margini)
- 🟡 GTM readiness (Prodotto, Economics, Operativo)

#### FASE 4 (FUTURE)
- 📋 WhatsApp Native Bot (creazione spedizioni via chat)
- 📋 Voice/Predictive (dispatcher vocale, smart pricing)
- 📋 Self-Healing Logistics (auto-monitoraggio e auto-riparazione)
- 📋 White-label rollout (rivendibilità ad altri consorzi)

---

## Examples

### Value Proposition per Reseller

```
Prima: 3 minuti per inserire una spedizione manualmente
Dopo: 10 secondi con OCR AI
Risparmio: 95% del tempo
ROI: Reseller può gestire 10x più spedizioni con stesso tempo
```

### Modello Ricavo Broker

```
Costo corriere: €8.50
Prezzo vendita: €11.00
Spread: €2.50 (29% margine)
Volume: 1000 spedizioni/mese
Ricavo mensile: €2,500
```

---

## Common Issues

| Issue | Soluzione |
|-------|-----------|
| Confusione con comparatore prezzi | Chiarire che è Logistics OS, non comparatore |
| Modello ricavo non chiaro | Vedere [Business Models](BUSINESS_MODELS.md) |

---

## Related Documentation

- [Business Models](BUSINESS_MODELS.md) - 3 modelli operativi dettagliati
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
