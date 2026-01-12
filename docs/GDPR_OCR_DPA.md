# GDPR OCR Vision - Data Processing Agreement (DPA)

**Document Type**: Legal / Compliance
**Date**: 2026-01-11
**Status**: Template - REQUIRES LEGAL REVIEW
**Criticality**: P0 - GDPR Compliance Mandatory

---

## 1. EXECUTIVE SUMMARY

SpedireSicuro utilizza servizi di OCR Vision di terze parti per estrarre automaticamente dati da immagini caricate dagli utenti (es. foto di etichette, documenti).

**Providers utilizzati**:
- **Google Cloud Vision API** (Primary)
- **Anthropic Claude Vision API** (Fallback)
- **Tesseract OCR** (Local, NO external processing)

**GDPR Requirements**: Art. 28 (Processor Agreement) + Art. 44-50 (International Transfers)

---

## 2. DATA PROCESSING SCOPE

### 2.1 Data Categories Processed

| Category | Description | Example |
|----------|-------------|---------|
| **Personal Data** | Nomi, indirizzi, numeri telefono estratti da immagini | "Mario Rossi, Via Roma 1, Milano, 333-1234567" |
| **Metadata** | IP address, user agent, timestamp upload | "192.168.1.1, Mozilla/5.0, 2026-01-11 10:30:00" |
| **Image Data** | Immagini raw (temporaneamente processate, NON stored) | JPEG, PNG files |

### 2.2 Processing Activities

| Activity | Description | Provider |
|----------|-------------|----------|
| **OCR Extraction** | Analisi immagine per estrazione testo | Google Vision, Claude Vision |
| **Text Recognition** | Riconoscimento caratteri e struttura dati | Google Vision, Claude Vision |
| **Data Parsing** | Estrazione campi strutturati (nome, indirizzo, etc.) | SpedireSicuro (backend) |

### 2.3 NO Processing Activities

**SpedireSicuro NON invia ai provider**:
- ❌ Immagini con dati sensibili (salute, religione, orientamento politico) - filtro preventivo richiesto
- ❌ Documenti di identità (passaporti, carte ID)
- ❌ Dati bancari (IBAN, carte di credito)

**Se rilevato**: Immediate stop processing + user alert.

---

## 3. LEGAL BASIS

### 3.1 GDPR Art. 6 - Lawful Basis

**Consent (Art. 6.1.a)**:
- ✅ User consent ESPLICITO prima di OCR Vision processing
- ✅ Opt-in checkbox in UI (NO pre-checked)
- ✅ Possibilità revoca consent in qualsiasi momento
- ✅ Se consent revocato → Tesseract local only

**Legitimate Interest (Art. 6.1.f)** - NON applicabile:
- OCR Vision è feature opzionale (NO legittimo interesse)
- Tesseract locale disponibile come alternativa

### 3.2 GDPR Art. 28 - Processor Agreement

**Google Cloud Vision**:
- ✅ DPA disponibile: https://cloud.google.com/terms/data-processing-addendum
- ✅ Standard Contractual Clauses (SCC) firmati
- ✅ Certificazioni: ISO 27001, SOC 2 Type II

**Anthropic Claude**:
- ✅ DPA disponibile: https://www.anthropic.com/legal/dpa
- ✅ Privacy Policy: https://www.anthropic.com/legal/privacy
- ⚠️ **ACTION REQUIRED**: Firmare DPA Enterprise (contattare sales@anthropic.com)

---

## 4. DATA RETENTION POLICY

### 4.1 SpedireSicuro Storage

| Data Type | Retention | Deletion |
|-----------|-----------|----------|
| **Immagini raw** | ❌ **MAI stored** (solo in-memory processing) | Immediate (post-processing) |
| **Extracted fields** | 7 giorni (DB: `ocr_processing_log`) | Soft delete dopo 7gg, hard delete dopo 30gg |
| **Image hash** | 7 giorni (deduplication) | Soft delete dopo 7gg |
| **Metadata** | 7 giorni (audit trail) | Soft delete dopo 7gg |

### 4.2 Provider Storage

| Provider | Retention Policy | Reference |
|----------|------------------|-----------|
| **Google Vision** | "No storage of images after processing" (best-effort policy) | [Privacy Policy](https://cloud.google.com/vision/docs/data-usage) |
| **Claude Vision** | "No training on customer data" (zero-retention policy) | [Data Usage Policy](https://www.anthropic.com/legal/commercial-terms) |

**⚠️ CRITICAL**: Providers dichiarano NO storage, ma **NON è contrattualmente garantito** senza DPA Enterprise.

**ACTION REQUIRED**:
1. Firmare Google Cloud DPA (Enterprise tier)
2. Firmare Anthropic DPA (Enterprise tier)
3. Richiedere "Data Residency" EU (se disponibile)

---

## 5. INTERNATIONAL DATA TRANSFERS

### 5.1 Transfer Mechanisms

**Google Cloud Vision**:
- ✅ Data Processing Location: EU (se configurato `eu-vision.googleapis.com`)
- ✅ SCC (Standard Contractual Clauses) firmati
- ✅ Privacy Shield alternative: EU-US Data Privacy Framework

**Anthropic Claude**:
- ⚠️ Data Processing Location: **USA (default)**
- ⚠️ SCC: **ACTION REQUIRED** (firmare DPA)
- ❌ EU residency: **NON disponibile** (as of Jan 2025)

**RECOMMENDATION**:
- Preferire Google Vision (EU-based processing) come primary
- Usare Claude Vision solo come fallback (minimize USA transfers)

### 5.2 Adequacy Decision

**Post-Schrems II**:
- ❌ Privacy Shield invalidato (2020)
- ✅ SCC validati (CJEU decision)
- ✅ EU-US Data Privacy Framework (2023)

**Compliance**:
- SpedireSicuro deve completare TIA (Transfer Impact Assessment)
- Valutare rischi USA surveillance (FISA 702)
- Documentare "supplementary measures" (encryption, pseudonymization)

---

## 6. SECURITY MEASURES

### 6.1 SpedireSicuro Implementation

| Measure | Implementation | Status |
|---------|----------------|--------|
| **Encryption in transit** | TLS 1.3 (API → Provider) | ✅ |
| **Encryption at rest** | N/A (no storage) | ✅ |
| **Access control** | User consent required | ✅ |
| **Audit logging** | `ocr_processing_log` table | ✅ |
| **Data minimization** | NO raw text storage, solo extracted fields | ✅ |
| **Pseudonymization** | Image hash (SHA-256), NO image storage | ✅ |

### 6.2 Provider Security

**Google Cloud Vision**:
- ✅ ISO 27001, SOC 2 Type II, PCI DSS
- ✅ Encryption at rest (AES-256)
- ✅ Regional isolation (EU data stays in EU)

**Anthropic Claude**:
- ✅ SOC 2 Type II (claimed)
- ⚠️ **NO ISO 27001** (public certification)
- ⚠️ **ACTION REQUIRED**: Request security attestation

---

## 7. DATA SUBJECT RIGHTS

### 7.1 GDPR Rights Implementation

| Right | Implementation | API Endpoint |
|-------|----------------|--------------|
| **Right to be informed** | Privacy policy + consent dialog | N/A |
| **Right of access** | User can view `ocr_processing_log` | `GET /api/user/ocr-logs` (TODO) |
| **Right to rectification** | Manual (contact support) | N/A |
| **Right to erasure** | Delete account → CASCADE delete logs | `DELETE /api/user/account` |
| **Right to restrict processing** | Revoke consent → Tesseract only | `DELETE /api/user/ocr-consent` |
| **Right to data portability** | Export OCR logs (JSON) | `GET /api/user/ocr-logs?export=true` (TODO) |
| **Right to object** | Revoke consent | `DELETE /api/user/ocr-consent` |

### 7.2 Response Time

**GDPR Art. 12**: Risposta entro **30 giorni** dalla richiesta.

**SpedireSicuro SLA**:
- Automated requests (revoke consent): **Immediate**
- Manual requests (access, portability): **7 giorni lavorativi**
- Complex requests (erasure from providers): **30 giorni**

---

## 8. DATA BREACH NOTIFICATION

### 8.1 Notification Timeline

**GDPR Art. 33-34**:
- ✅ Supervisory Authority: **72 ore** dalla scoperta
- ✅ Data Subjects: **Senza indebito ritardo** (se high risk)

### 8.2 Breach Scenarios

| Scenario | Risk Level | Notification Required |
|----------|------------|----------------------|
| Provider data breach (Google/Anthropic) | **HIGH** | ✅ Supervisory Authority + Users |
| SpedireSicuro DB leak (`ocr_processing_log`) | **MEDIUM** | ✅ Supervisory Authority (valutazione case-by-case) |
| Image hash leak | **LOW** | ❌ (pseudonymized data) |

### 8.3 Breach Response Plan

1. **Detection**: Monitor provider security advisories
2. **Assessment**: TIA (72h window)
3. **Containment**: Revoke API keys, stop processing
4. **Notification**: Garante Privacy + Users (email)
5. **Remediation**: Patch, audit, lessons learned

---

## 9. COMPLIANCE CHECKLIST

### 9.1 Pre-Production (P0 - MANDATORY)

- [x] **Migration 099**: DB schema consent tracking
- [x] **Kill-switch**: `ENABLE_OCR_VISION` env var
- [x] **Consent UI**: Explicit opt-in checkbox
- [x] **Audit logging**: `ocr_processing_log` table
- [x] **Retention policy**: 7 giorni soft delete, 30gg hard delete
- [ ] **DPA Google**: Firmare Cloud DPA (Enterprise tier) ⚠️ **ACTION REQUIRED**
- [ ] **DPA Anthropic**: Firmare Enterprise DPA ⚠️ **ACTION REQUIRED**
- [ ] **TIA**: Transfer Impact Assessment (USA transfers) ⚠️ **ACTION REQUIRED**
- [ ] **Privacy Policy update**: Sezione OCR Vision ⚠️ **ACTION REQUIRED**
- [ ] **Cookie Policy**: (se applicable) ⚠️ **ACTION REQUIRED**

### 9.2 Post-Production (P1 - RECOMMENDED)

- [ ] **Regional endpoints**: `eu-vision.googleapis.com` (Google)
- [ ] **Data residency**: EU-only processing (se disponibile)
- [ ] **External audit**: GDPR compliance review
- [ ] **Pentesting**: Security assessment provider integration

---

## 10. DOCUMENTATION REQUIREMENTS

### 10.1 Records of Processing Activities (ROPA)

**GDPR Art. 30**: Controller must maintain ROPA.

**OCR Vision Entry**:
```
Activity: OCR Vision Data Extraction
Purpose: Automatic address extraction for shipment creation
Categories of data: Names, addresses, phone numbers (from images)
Recipients: Google LLC (USA), Anthropic PBC (USA)
Transfers to third countries: USA (SCC)
Retention period: 7 giorni (soft delete), 30 giorni (hard delete)
Security measures: TLS 1.3, pseudonymization, audit logging
```

### 10.2 Audit Trail

**Required logs** (GDPR compliance):
- User consent grants/revocations (`audit_logs`)
- OCR processing events (`ocr_processing_log`)
- Provider selection decisions (Google vs Claude)
- Data breach incidents (security log)

**Retention**: **5 anni** (statute of limitations GDPR penalties)

---

## 11. LEGAL REVIEW STATUS

⚠️ **THIS DOCUMENT IS A TEMPLATE**
**STATUS**: Draft - Requires legal counsel review
**ACTION REQUIRED**: Submit to Data Protection Officer (DPO) or external counsel

**Key questions for legal**:
1. Is consent sufficient as lawful basis? (or legitimate interest?)
2. Are SCC adequate post-Schrems II for USA transfers?
3. Do we need DPO appointment? (Art. 37)
4. Privacy Policy wording review
5. Cookie banner updates (if tracking consent)

---

## 12. CONTACTS

**Data Protection Officer (DPO)**:
- Email: [TO BE DEFINED]
- Phone: [TO BE DEFINED]

**Supervisory Authority**:
- Italy: Garante per la Protezione dei Dati Personali
- Email: garante@gpdp.it
- Website: https://www.garanteprivacy.it

**Provider Contacts**:
- Google Cloud Support: https://cloud.google.com/support
- Anthropic Enterprise Sales: sales@anthropic.com

---

## CHANGELOG

| Date | Change | Author |
|------|--------|--------|
| 2026-01-11 | Initial draft (P0 audit fix) | AI Assistant |
| TBD | Legal review | DPO/Counsel |
| TBD | Approval | Management |

---

**END OF DOCUMENT**
