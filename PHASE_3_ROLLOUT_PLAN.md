# PHASE 3 – Rollout, Economics & GTM Readiness

> **Status:** 🟡 IN CORSO  
> **Data Inizio:** Dicembre 2025  
> **Prerequisiti:** ✅ FASE 1-2.8 completate

---

## Obiettivo

Validare esposizione reale, sostenibilità economica e readiness GTM **senza modifiche architetturali**.

**NON inventiamo metriche.** Osserviamo dati reali e prendiamo decisioni basate su evidenza.

---

## Prerequisiti (GIÀ SODDISFATTI)

- ✅ **FASE 1-2.8 completate** - Vedi [MIGRATION_MEMORY.md](MIGRATION_MEMORY.md)
- ✅ **OCR immagini production-ready** - Integration test con 10 immagini reali, 90% confidence
- ✅ **E2E user flow verificato** - Test Playwright attivi, workflow CI/CD configurato
- ✅ **Test unit / integration / E2E attivi** - 264 unit test, 90 integration test, E2E suite completa

---

## FASE 3.1 – Controlled Rollout

### Scope

- OCR ON by default per nuove coorti
- Fallback legacy sempre disponibile (feature flag `ENABLE_OCR_IMAGES`)
- Rollout incrementale per coorti di utenti

### Coorti

| Coorte | Utenti | Durata | Obiettivo |
|--------|--------|--------|-----------|
| **Cohort 0** | Internal (team) | 1 settimana | Validazione interna |
| **Cohort 1** | 3-5 utenti reali | 2 settimane | Validazione con utenti pilota |
| **Cohort 2** | 20-50 utenti | 4 settimane | Validazione scala piccola |

---

### Cohort 0: Internal Testing

**Owner:** Team sviluppo  
**Durata:** 1 settimana  
**Start Date:** TBD

#### Deliverable

- [ ] OCR attivo per utenti interni (whitelist email)
- [ ] Dashboard monitoring costi real-time
- [ ] Log aggregati per analisi errori
- [ ] Report settimanale: immagini processate, costi, errori

#### Evidenza

- Query Supabase: conteggio immagini processate con OCR
- Log telemetria: eventi `ocr_vision_used`, `ocr_vision_failed`, `ocr_fallback_legacy`
- Costi Gemini Vision: dashboard Google Cloud Console
- File: `docs/phase3/cohort0-report.md` (generato settimanalmente)

#### Stop Condition

- **STOP se:** Costo medio per immagine > €0.10 (soglia da definire)
- **STOP se:** Error rate > 30% (clarification rate > 30%)
- **STOP se:** Blocchi critici rilevati (P0)

#### Comandi di Verifica

```bash
# Verifica feature flag attivo
grep -r "ENABLE_OCR_IMAGES" .env.local
# Expected: ENABLE_OCR_IMAGES=true

# Verifica telemetria OCR
grep -r "ocr_vision_used\|ocr_vision_failed" lib/agent/workers/ocr.ts
# Expected: eventi telemetria presenti

# Query immagini processate (Supabase SQL)
SELECT COUNT(*) FROM shipments 
WHERE created_at > NOW() - INTERVAL '7 days'
AND metadata->>'ocr_source' = 'image';
```

---

### Cohort 1: Pilot Users (3-5 utenti)

**Owner:** Product Manager + Team sviluppo  
**Durata:** 2 settimane  
**Start Date:** TBD (dopo Cohort 0)

#### Deliverable

- [ ] Whitelist 3-5 utenti pilota (email in `.env.local` o DB)
- [ ] Onboarding utenti pilota (spiegazione OCR, feedback loop)
- [ ] Dashboard costi per utente
- [ ] Report feedback utenti (survey o interviste)
- [ ] Report settimanale: costi, satisfaction, errori

#### Evidenza

- Tabella `users` con flag `ocr_pilot_enabled = true`
- Telemetria per utente: `user_id` + eventi OCR
- Costi aggregati per utente (Google Cloud Console)
- File: `docs/phase3/cohort1-report.md` + `docs/phase3/cohort1-feedback.md`

#### Stop Condition

- **STOP se:** Costo medio per utente > €5/settimana (soglia da definire)
- **STOP se:** Satisfaction < 60% (survey)
- **STOP se:** Error rate > 25% (clarification rate > 25%)
- **STOP se:** Blocchi critici rilevati (P0)

#### Comandi di Verifica

```bash
# Verifica whitelist utenti
# Query Supabase SQL
SELECT email, ocr_pilot_enabled FROM users WHERE ocr_pilot_enabled = true;

# Verifica costi per utente (aggregazione telemetria)
# Query Supabase SQL
SELECT 
  user_id,
  COUNT(*) as images_processed,
  SUM(CAST(metadata->>'vision_cost_eur' AS NUMERIC)) as total_cost
FROM shipments
WHERE metadata->>'ocr_source' = 'image'
AND created_at > NOW() - INTERVAL '14 days'
GROUP BY user_id;
```

---

### Cohort 2: Small Scale (20-50 utenti)

**Owner:** Product Manager  
**Durata:** 4 settimane  
**Start Date:** TBD (dopo Cohort 1)

#### Deliverable

- [ ] Rollout graduale: 5 utenti/settimana fino a 50
- [ ] Dashboard costi aggregati
- [ ] Alert automatici se costi superano soglia
- [ ] Report mensile: costi totali, ROI, satisfaction, errori

#### Evidenza

- Telemetria aggregata: costi totali, immagini processate, errori
- Dashboard Google Cloud: costi Gemini Vision mensili
- File: `docs/phase3/cohort2-report.md` (settimanale) + `docs/phase3/cohort2-final.md` (finale)

#### Stop Condition

- **STOP se:** Costo totale mensile > €200 (soglia da definire)
- **STOP se:** Costo medio per spedizione > €0.15
- **STOP se:** Satisfaction < 50%
- **STOP se:** Error rate > 20%

#### Comandi di Verifica

```bash
# Verifica costi totali (Supabase SQL)
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as images_processed,
  SUM(CAST(metadata->>'vision_cost_eur' AS NUMERIC)) as daily_cost
FROM shipments
WHERE metadata->>'ocr_source' = 'image'
AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

# Verifica error rate
SELECT 
  COUNT(*) FILTER (WHERE metadata->>'ocr_result' = 'clarification') as clarifications,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->>'ocr_result' = 'clarification') / COUNT(*), 2) as error_rate_pct
FROM shipments
WHERE metadata->>'ocr_source' = 'image'
AND created_at > NOW() - INTERVAL '7 days';
```

---

## FASE 3.2 – Economics Observation

### Obiettivo

**Osservare costi reali per spedizione** (non stimare). Nessuna metrica inventata.

### Voci Osservate

| Voce | Sorgente | Come Misurare |
|------|----------|---------------|
| **Gemini Vision** | Google Cloud Console | Costo per immagine processata |
| **LLM (Gemini)** | Google Cloud Console | Costo per chiamata `extractData()` |
| **Booking** | Adapter corriere | Costo API corriere (se applicabile) |
| **Platform Fee** | Wallet debit | Fee configurata per utente |
| **Wallet Debit** | Transazioni wallet | Totale addebitato per spedizione |

### Output Richiesto

#### 1. Cost Breakdown per Spedizione

**File:** `docs/phase3/economics-cost-breakdown.md`

Template:
```markdown
## Cost Breakdown (Data: YYYY-MM-DD)

### Per Spedizione Media
- Gemini Vision: €X.XX
- LLM: €X.XX
- Booking: €X.XX
- Platform Fee: €X.XX
- **Totale: €X.XX**

### Aggregato Mensile (Cohort 2)
- Immagini processate: N
- Costo totale Vision: €X.XX
- Costo totale LLM: €X.XX
- **Totale costi: €X.XX**
- **Costo medio per spedizione: €X.XX**
```

#### 2. Alert Threshold

**File:** `docs/phase3/economics-alert-thresholds.md`

Soglie da definire basandosi su dati reali (non inventate):
- Costo medio per spedizione > €X.XX → Alert
- Costo giornaliero > €X.XX → Alert critico
- Error rate > X% → Alert

#### 3. Kill Switch Policy

**File:** `docs/phase3/economics-kill-switch.md`

Condizioni per disabilitare OCR:
- Costo totale mensile > €X.XX (soglia da definire)
- Costo medio per spedizione > €X.XX (soglia da definire)
- Error rate > X% per N giorni consecutivi

**Implementazione:**
- Feature flag `ENABLE_OCR_IMAGES = false` in `.env.local` (produzione)
- Rollback automatico a legacy OCR

---

## FASE 3.3 – GTM Readiness Gates

### Gate 1 – Prodotto

**Owner:** Product Manager + Tech Lead

#### Criteri

- [ ] OCR funziona per > 80% immagini (success rate)
- [ ] Clarification rate < 20%
- [ ] Tempo risposta < 5 secondi (P95)
- [ ] Zero PII nei log (verificato)
- [ ] E2E test passano (verificato)

#### Evidenza

- Report telemetria: success rate, clarification rate, tempi
- Test E2E: `npm run test:e2e` → tutti passati
- Audit PII: `grep -r "base64\|fullName\|phone" lib/agent/workers/ocr.ts` → zero match

#### Esito

- ✅ **GO** se tutti i criteri soddisfatti
- ⚠️ **GO con limitazioni** se 1-2 criteri non soddisfatti (documentare limitazioni)
- ❌ **NO-GO** se > 2 criteri non soddisfatti

---

### Gate 2 – Economics

**Owner:** CFO / Business Owner

#### Criteri

- [ ] Costo medio per spedizione < €X.XX (soglia da definire basandosi su dati reali)
- [ ] Costo totale mensile < €X.XX (soglia da definire)
- [ ] ROI positivo (se applicabile)
- [ ] Alert threshold definiti e testati

#### Evidenza

- File: `docs/phase3/economics-cost-breakdown.md`
- Dashboard Google Cloud: costi reali
- File: `docs/phase3/economics-alert-thresholds.md`

#### Esito

- ✅ **GO** se costi sostenibili
- ⚠️ **GO con limitazioni** se costi borderline (documentare mitigazioni)
- ❌ **NO-GO** se costi insostenibili (rollback o pausa)

---

### Gate 3 – Operativo

**Owner:** Operations Manager

#### Criteri

- [ ] Monitoring attivo (dashboard costi, errori)
- [ ] Alert configurati e testati
- [ ] Kill switch testato
- [ ] Documentazione operativa completa
- [ ] Runbook per incidenti

#### Evidenza

- Dashboard monitoring: screenshot o link
- Test kill switch: documentato in `docs/phase3/economics-kill-switch.md`
- File: `docs/phase3/runbook.md`

#### Esito

- ✅ **GO** se tutti i criteri soddisfatti
- ⚠️ **GO con limitazioni** se 1-2 criteri non soddisfatti
- ❌ **NO-GO** se > 2 criteri non soddisfatti

---

## Decision Log

Ogni decisione rilevante viene tracciata qui con data, motivo e evidenza.

| Data | Decisione | Motivo | Evidenza | Owner |
|------|-----------|--------|----------|-------|
| TBD | Start Cohort 0 | Prerequisiti soddisfatti | MIGRATION_MEMORY.md | Tech Lead |
| TBD | ... | ... | ... | ... |

---

## Comandi di Verifica Rapida

```bash
# Verifica feature flag OCR
grep -r "ENABLE_OCR_IMAGES" .env.local

# Verifica telemetria OCR attiva
grep -r "ocr_vision_used\|ocr_vision_failed" lib/agent/workers/ocr.ts

# Esegui test E2E
npm run test:e2e

# Verifica costi (richiede accesso Google Cloud Console)
# Dashboard: https://console.cloud.google.com/billing

# Query immagini processate (Supabase SQL)
SELECT COUNT(*) FROM shipments 
WHERE metadata->>'ocr_source' = 'image'
AND created_at > NOW() - INTERVAL '7 days';
```

---

## Documenti Correlati

- **[MIGRATION_MEMORY.md](MIGRATION_MEMORY.md)** - Storia completa FASE 1-2.8
- **[docs/SPRINT_2.5_OCR_IMMAGINI_GUIDA.md](docs/SPRINT_2.5_OCR_IMMAGINI_GUIDA.md)** - Guida tecnica OCR
- **[README.md](README.md)** - Overview progetto

---

## Note Finali

**Questo documento è un "copione" per FASE 3.** Non contiene metriche inventate. Tutte le soglie e i criteri devono essere definiti basandosi su dati reali osservati durante i rollout.

**Principio:** Osservare → Decidere → Documentare → Iterare.

