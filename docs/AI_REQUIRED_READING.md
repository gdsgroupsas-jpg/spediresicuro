# 📖 AI REQUIRED READING - Mandatory Pre-Flight Checklist

**⚠️ OBBLIGATORIO: Leggere TUTTI questi documenti PRIMA di proporre qualsiasi modifica al codice.**

Questo documento definisce la "Bibbia" del progetto. Ogni AI che lavora su SpedireSicuro DEVE essere allineata a questi principi.

---

## 🚨 REGOLA FONDAMENTALE

**Nessuna modifica può essere proposta senza aver letto e compreso:**

1. ✅ README.md (Costituzione del sistema)
2. ✅ Tutti i documenti Core (sezione A)
3. ✅ Documenti Operativi rilevanti (sezione B)
4. ✅ Documenti AI/Validazione se si lavora su wallet (sezione C)

**Se un documento non è allineato alla Costituzione, DEVI segnalarlo PRIMA di procedere.**

---

## 📚 A. DOCUMENTI CORE (OBBLIGATORI - Leggere PRIMA di sviluppare)

### 1. README.md (Costituzione)
**File:** `README.md` (root)  
**Priorità:** 🔴 P0 - OBBLIGATORIO  
**Contenuto:**
- Visione & Identità (Logistics OS, non comparatore)
- 3 modelli operativi (Broker, SaaS/BYOC, Web Reseller)
- Financial Core ("No Credit, No Label")
- Principi inderogabili (Atomicità, Idempotenza, Audit Trail)
- Anti-Pattern (cosa NON fare)

**Quando leggerlo:** SEMPRE, prima di qualsiasi modifica.

---

### 2. docs/SECURITY.md
**File:** `docs/SECURITY.md`  
**Priorità:** 🔴 P0 - OBBLIGATORIO  
**Contenuto:**
- Architettura multi-tenant
- Acting Context (Impersonation System)
- RLS policies e isolamento
- Audit logging

**Quando leggerlo:** Prima di modificare:
- Autenticazione/autorizzazione
- Query database
- Operazioni multi-tenant
- Impersonation

**Allineamento Costituzione:** ✅ Verificare se menziona i 3 modelli operativi

---

### 3. docs/MONEY_FLOWS.md
**File:** `docs/MONEY_FLOWS.md`  
**Priorità:** 🔴 P0 - OBBLIGATORIO  
**Contenuto:**
- Sistema wallet prepagato
- Flussi finanziari (ricarica, debit, credit)
- Anti-fraud mechanisms
- Idempotency patterns

**Quando leggerlo:** Prima di modificare:
- Wallet operations
- Payment flows
- Shipment creation (debit wallet)
- Top-up requests

**Allineamento Costituzione:** ✅ Verificare se rispetta "No Credit, No Label"

---

### 4. docs/OPS_RUNBOOK.md
**File:** `docs/OPS_RUNBOOK.md`  
**Priorità:** 🟡 P1 - Consigliato  
**Contenuto:**
- Deployment procedures
- Incident response
- Monitoring e alerting

**Quando leggerlo:** Prima di:
- Deploy in produzione
- Modifiche infrastrutturali
- Setup monitoring

---

### 5. docs/DB_SCHEMA.md
**File:** `docs/DB_SCHEMA.md`  
**Priorità:** 🟡 P1 - Consigliato  
**Contenuto:**
- Tabelle database
- RLS policies
- Invarianti e constraints

**Quando leggerlo:** Prima di:
- Modifiche schema database
- Nuove migrations
- Query complesse

---

### 6. docs/ARCHITECTURE.md
**File:** `docs/ARCHITECTURE.md`  
**Priorità:** 🟡 P1 - Consigliato  
**Contenuto:**
- Deep dive tecnico
- Patterns architetturali
- Performance considerations

**Quando leggerlo:** Prima di:
- Refactoring architetturale
- Ottimizzazioni performance
- Nuove feature complesse

**Allineamento Costituzione:** ⚠️ Verificare se menziona Courier Adapter pattern

---

## 📋 B. DOCUMENTI OPERATIVI (Leggere quando rilevanti)

### 7. docs/MIGRATIONS.md
**File:** `docs/MIGRATIONS.md`  
**Priorità:** 🟡 P1 - Quando si lavora su DB  
**Contenuto:**
- Storia migrations (49+ migrations)
- Procedure rollback
- Best practices migrations

**Quando leggerlo:** Prima di creare nuove migrations.

---

### 8. WALLET_SECURITY_GUARDRAILS.md
**File:** `WALLET_SECURITY_GUARDRAILS.md` (root)  
**Priorità:** 🔴 P0 - Se si lavora su wallet  
**Contenuto:**
- Regole critiche wallet (NON BYPASSABILE)
- Pattern corretti/errati
- Esempi codice

**Quando leggerlo:** OBBLIGATORIO prima di qualsiasi modifica wallet.

---

### 9. AUDIT_GO_NOGO_PIVOT.md
**File:** `AUDIT_GO_NOGO_PIVOT.md` (root)  
**Priorità:** 🟡 P1 - Per contesto strategico  
**Contenuto:**
- Audit strategico GO/NO-GO/PIVOT
- Top 5 rischi
- Top 5 fix prioritari
- Roadmap 14 giorni

**Quando leggerlo:** Per capire priorità business e rischi attuali.

---

## 🤖 C. DOCUMENTI AI/VALIDAZIONE (Leggere quando rilevanti)

### 10. WALLET_AUDIT_REPORT.md
**File:** `WALLET_AUDIT_REPORT.md` (root)  
**Priorità:** 🟡 P1 - Se si lavora su wallet  
**Contenuto:**
- Audit wallet completo
- Vulnerabilità P0 trovate e fixate
- Test di validazione

**Quando leggerlo:** Prima di modifiche wallet per capire vulnerabilità già risolte.

---

### 11. WALLET_AI_VALIDATION_PROMPT.md
**File:** `WALLET_AI_VALIDATION_PROMPT.md` (root)  
**Priorità:** 🟢 P2 - Per validazione esterna  
**Contenuto:**
- Prompt per validazione AI esterna
- Domande di validazione
- Output richiesto

**Quando leggerlo:** Per validare fix wallet con AI esterna.

---

## ✅ CHECKLIST PRE-MODIFICA (OBBLIGATORIA)

Prima di proporre qualsiasi modifica, verifica:

- [ ] Ho letto README.md (Costituzione)
- [ ] Ho letto i documenti Core rilevanti (A.1-A.6)
- [ ] Ho letto i documenti Operativi rilevanti (B.7-B.9)
- [ ] Ho verificato allineamento con Costituzione
- [ ] Ho identificato documenti obsoleti o non allineati
- [ ] Ho proposto aggiornamento documentazione se necessario

---

## 🔄 PROCESSO DI MANTENIMENTO DOCUMENTAZIONE

### Alla Fine di Ogni Sessione di Sviluppo

**OBBLIGATORIO:** Aggiornare i documenti modificati:

1. **Se hai modificato codice wallet:**
   - [ ] Aggiorna `docs/MONEY_FLOWS.md` se flussi cambiati
   - [ ] Aggiorna `WALLET_SECURITY_GUARDRAILS.md` se nuove regole
   - [ ] Verifica `WALLET_AUDIT_REPORT.md` per nuove vulnerabilità

2. **Se hai modificato autenticazione/RLS:**
   - [ ] Aggiorna `docs/SECURITY.md`
   - [ ] Aggiorna `docs/DB_SCHEMA.md` se schema cambiato

3. **Se hai aggiunto nuove feature:**
   - [ ] Aggiorna `docs/ARCHITECTURE.md` se pattern nuovi
   - [ ] Aggiorna `README.md` se modelli operativi cambiati

4. **Se hai creato nuove migrations:**
   - [ ] Aggiorna `docs/MIGRATIONS.md`

### Verifica Allineamento Costituzione

**Prima di commit finale, verifica:**

- [ ] La modifica rispetta i 3 modelli operativi?
- [ ] La modifica rispetta "No Credit, No Label"?
- [ ] La modifica usa funzioni atomiche (se wallet)?
- [ ] La modifica non introduce anti-pattern?

---

## 🚫 DOCUMENTI OBSOLETI (Non usare per sviluppo attivo)

### docs/archive/
**Status:** 📦 STORICO - Solo per riferimento storico

**Contenuto:**
- Documentazione vecchia
- Analisi obsolete
- Progetti abbandonati

**Regola:** NON usare per sviluppo attivo. Solo per capire storia del progetto.

---

## 📝 TEMPLATE PER NUOVI DOCUMENTI

Se crei un nuovo documento, segui questo template:

```markdown
# 📖 [Titolo Documento]

**Priorità:** 🔴 P0 / 🟡 P1 / 🟢 P2  
**Allineamento Costituzione:** ✅ / ⚠️ / ❌  
**Ultimo Aggiornamento:** YYYY-MM-DD

## Contenuto
[Descrizione contenuto]

## Quando Leggerlo
[Scenari specifici]

## Allineamento Costituzione
[Verifica rispetto a README.md]
```

---

## 🎯 PRIORITÀ LETTURA PER TIPO DI MODIFICA

### Modifica Wallet
1. README.md (Costituzione)
2. WALLET_SECURITY_GUARDRAILS.md
3. docs/MONEY_FLOWS.md
4. WALLET_AUDIT_REPORT.md

### Modifica Autenticazione/RLS
1. README.md (Costituzione)
2. docs/SECURITY.md
3. docs/DB_SCHEMA.md

### Modifica Shipment Creation
1. README.md (Costituzione)
2. docs/MONEY_FLOWS.md
3. docs/ARCHITECTURE.md
4. AUDIT_GO_NOGO_PIVOT.md (per contesto)

### Nuova Feature
1. README.md (Costituzione)
2. docs/ARCHITECTURE.md
3. Verifica allineamento modelli operativi

---

## ⚠️ SEGNALAZIONE DOCUMENTI OBSOLETI

Se trovi un documento:
- ❌ Non allineato alla Costituzione
- ❌ Contiene informazioni obsolete
- ❌ Contraddice altri documenti

**AZIONE OBBLIGATORIA:**
1. Segnala nel commit message
2. Proponi fix o deprecazione
3. Aggiorna questo file (AI_REQUIRED_READING.md)

---

**Questo documento DEVE essere aggiornato ogni volta che:**
- Viene creato un nuovo documento
- Un documento viene deprecato
- Un documento viene aggiornato significativamente

---

_Last updated: December 23, 2025_  
_Maintained by: Development Team + AI Agents_

