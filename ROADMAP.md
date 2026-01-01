# 🗺️ Product Roadmap

## Overview

This document tracks planned features and improvements for SpedireSicuro. Features are prioritized based on business value, technical complexity, and user demand.

**Last Updated:** January 1, 2026

---

## 🚀 Active Development (Q1 2026)

### AI Agent Features P2 - UX & Debugging
**Status:** In Progress (3/5 tasks completed)  
**Priority:** Medium  
**Effort:** ~11 days (estimated)

**Description:**  
Miglioramenti UX e debugging per AI Agent Integration. Feature "nice to have" per migliorare esperienza utente e debugging.

**Completed:**
- ✅ **Mobile Anne:** Icona ghost nel menu mobile per aprire Anne Assistant
- ✅ **AgentDebugPanel:** Componente UI per telemetria supervisor (solo admin/superadmin)
- ✅ **debug_worker:** Worker per analisi errori e suggerimenti fix

**In Progress:**
- 🔄 **explain_worker:** Worker per spiegare business flows (wallet, spedizioni, margini)
- ⏳ **compensation_queue processor:** CRON job per cleanup orphan records

**Dependencies:**
- ✅ P1 prerequisites (complete)
- ✅ LangGraph supervisor pattern (complete)
- ✅ Telemetria strutturata (complete)

**Success Metrics:**
- Debug panel utilizzato da admin per troubleshooting
- debug_worker riduce tempo risoluzione errori utente
- Mobile Anne migliora accessibilità su dispositivi mobili

---

### AI Anne Chat UI
**Status:** Backend Ready → Building UI  
**Priority:** High  
**Effort:** 2-3 weeks

**Description:**  
Build chat interface for AI assistant "Anne" that helps users create shipments from images/text.

**Requirements:**
- Chat UI component in dashboard
- Image upload with preview
- Streaming responses from Gemini API
- Conversation history persistence
- LangGraph workflow integration

**Dependencies:**
- ✅ Gemini 2.0 Flash integration (complete)
- ✅ LangGraph orchestration (complete - P1)
- ✅ Database tables for conversations (complete)

**Success Metrics:**
- 50% of shipments created via AI chat
- <10 second response time for image analysis
- >80% data extraction accuracy

---

### XPay Credit Card Payments
**Status:** Integration Ready → Testing & UI  
**Priority:** High  
**Effort:** 3-4 weeks

**Description:**  
Enable users to top up wallet with credit/debit cards via Intesa Sanpaolo XPay.

**Requirements:**
- Payment flow UI (amount selection, card form)
- XPay SDK integration
- Webhook handling for payment confirmation
- Transaction reconciliation
- PCI DSS compliance review

**Dependencies:**
- ✅ XPay API client (complete)
- ✅ Wallet system (complete)
- ❌ Production XPay credentials (needs approval)

**Success Metrics:**
- 70% of top-ups use card vs bank transfer
- <2% payment failure rate
- <5 second payment confirmation

---

## 📋 Backlog (Q2-Q3 2026)

### Doctor Service Dashboard
**Status:** Logging Active → UI Missing  
**Priority:** Medium  
**Effort:** 2 weeks

**Description:**  
Admin dashboard to view and analyze diagnostic events (automation failures, API errors).

**Features:**
- Event list with filtering (by type, severity, date)
- Real-time event stream
- AI-powered root cause analysis
- Auto-remediation suggestions

---

### Invoice Generation
**Status:** Schema Ready → PDF Generator Missing  
**Priority:** Medium  
**Effort:** 3 weeks

**Description:**  
Auto-generate PDF invoices for shipments and send via email.

**Features:**
- PDF template with Italian fiscal requirements
- Automatic invoice numbering
- Email delivery to user
- Invoice history and download

---

### Smart Top-Up OCR
**Status:** Concept → Proof of Concept  
**Priority:** Low (Manual approval works fine)  
**Effort:** 2 weeks

**Description:**  
Automatically extract amount and CRO from bank transfer receipt using Gemini Vision.

**Features:**
- Image preprocessing (rotation, crop)
- OCR with Gemini Vision
- Confidence scoring
- Auto-approval if confidence >95%

---

### Fiscal Brain (F24, LIPE Tracking)
**Status:** Concept → Design Phase  
**Priority:** Low  
**Effort:** 4-6 weeks

**Description:**  
Help users track fiscal deadlines and obligations (F24 tax forms, LIPE quarterly reports).

**Features:**
- Deadline calendar
- Automatic calculation of quarterly shipment totals
- Form pre-filling (where possible)
- Email reminders

---

### LangGraph Workflows
**Status:** Concept → Prototype  
**Priority:** Medium  
**Effort:** 4 weeks

**Description:**  
Implement LangGraph for complex AI workflows (shipment booking, address validation).

**Workflows:**
1. **Booking Flow:** Image → Extract → Validate → Quote → Confirm
2. **Validation Flow:** Address normalization, CAP lookup, phone formatting
3. **Smart Routing:** Select best courier based on zone, weight, price

---

### Multi-Region Support
**Status:** Concept  
**Priority:** Low  
**Effort:** 8-12 weeks

**Description:**  
Support multi-region deployments for low-latency access (EU, US, Asia).

**Requirements:**
- Database sharding by region
- Read replicas for analytics
- CDN for static assets
- Regional compliance (GDPR, CCPA)

---

### Mobile App (React Native)
**Status:** Concept  
**Priority:** Low  
**Effort:** 12-16 weeks

**Description:**  
Native iOS/Android app for on-the-go shipment creation and tracking.

**Features:**
- Camera for label scanning
- Push notifications for tracking updates
- Offline mode for draft shipments
- Biometric authentication

---

### API Marketplace
**Status:** Concept  
**Priority:** Low  
**Effort:** 6-8 weeks

**Description:**  
Public REST API for third-party integrations (e-commerce platforms, ERPs).

**Features:**
- API key management
- Rate limiting per tier
- Developer documentation
- SDKs (JavaScript, Python, PHP)
- Webhook support

---

## 🎯 Feature Requests (Community)

Track user feature requests here:

### Requested Features
- [ ] Bulk shipment creation (CSV import)
- [ ] Shipment templates (save recipient for reuse)
- [ ] Multi-language support (English, Spanish)
- [ ] Custom branding for resellers (white-label)
- [ ] Shipment scheduling (create now, ship later)
- [ ] Return shipment management
- [ ] COD (Cash on Delivery) support
- [ ] International shipping (non-IT destinations)

---

## ❌ Not Planned (Out of Scope)

### Features We Won't Build

#### Warehouse Management
**Reason:** Out of core competency. Users should use dedicated WMS (e.g., Odoo, TradeGecko).

#### Inventory Tracking
**Reason:** Shipping platform, not inventory system. Integrate with existing tools.

#### Full Accounting System
**Reason:** Invoice generation only. Use dedicated accounting software (e.g., Fatture in Cloud).

#### Custom Courier Integration (Direct API)
**Reason:** Maintain via Spedisci.Online aggregator to avoid N courier integrations.

---

## 🔄 Continuous Improvements

These are ongoing efforts without specific completion dates:

- **Performance Optimization** - Reduce API response times, improve DB query performance
- **Security Hardening** - Regular security audits, dependency updates
- **Documentation** - Keep docs in sync with code changes
- **Code Quality** - Reduce technical debt, improve test coverage
- **UX Polish** - Improve dashboard usability, add tooltips, better error messages

---

## 📊 Prioritization Criteria

Features are prioritized using RICE framework:

- **Reach:** How many users benefit?
- **Impact:** How much does it improve UX/revenue?
- **Confidence:** How certain are we of success?
- **Effort:** How long will it take?

**Score = (Reach × Impact × Confidence) / Effort**

---

## 🗳️ How to Request Features

1. Check if feature is already listed (above or in [GitHub Issues](https://github.com/gdsgroupsas-jpg/spediresicuro/issues))
2. If not, create a new issue with template:
   - **Problem:** What problem does this solve?
   - **Solution:** How would you solve it?
   - **Alternatives:** What alternatives did you consider?
   - **Benefit:** Who benefits and how much?

3. Community can vote 👍 on issues to help us prioritize

---

**Document Owner:** Product Team  
**Review Cycle:** Quarterly
