# PHASE 3 – Execution Checklist

> **⚠️ SINGLE SOURCE OF TRUTH OPERATIVA**  
> **Nessuna fase può avanzare se una voce BLOCKING non è ✅**

Questo file è la checklist giornaliera e il gate operativo per FASE 3.  
Riferimento dettagliato: [PHASE_3_ROLLOUT_PLAN.md](PHASE_3_ROLLOUT_PLAN.md)

---

## Pre-Cohort 0 (BLOCKING)

**Status:** ⬜ TODO | 🟡 IN PROGRESS | ✅ DONE

- [ ] **Audit PII robusto completato**
  - Verifica: `grep -r "base64\|fullName\|phone\|address" lib/agent/workers/ocr.ts` → zero match
  - Verifica: `grep -r "console\.log.*base64\|console\.log.*fullName" lib/` → zero match
  - Evidenza: File `docs/phase3/audit-pii-completed.md` con risultati

- [ ] **Kill switch OCR testato end-to-end**
  - Test: `ENABLE_OCR_IMAGES=false` → OCR disabilitato, fallback legacy attivo
  - Test: Immagine inviata → clarification request (non Vision)
  - Evidenza: File `docs/phase3/kill-switch-test.md` con screenshot/log

- [ ] **Cost alert Gemini configurati**
  - Google Cloud Console: Alert configurato per costi giornalieri > soglia
  - Alert inviato a: [email da definire]
  - Test alert: Trigger manuale verificato
  - Evidenza: Screenshot configurazione alert in `docs/phase3/cost-alert-config.md`

- [ ] **Stato race conditions dichiarato**
  - Verifica: Race conditions in `ocrWorker` / `extractData` risolte o mitigate
  - Documentazione: File `docs/phase3/race-conditions-status.md`
  - Status: ✅ Risolte | ⚠️ Mitigate (descrivere) | ❌ Aperte (bloccante)

- [ ] **Decision Log aggiornato (audit pre-C0)**
  - Entry in `PHASE_3_ROLLOUT_PLAN.md` → Decision Log
  - Data, decisione, motivo, evidenza, owner
  - Evidenza: Commit hash o link a decisione

---

## Cohort 0 – Internal

**Status:** ⬜ TODO | 🟡 IN PROGRESS | ✅ DONE

- [ ] **Utenti interni whitelistati**
  - Tabella `users`: flag `ocr_pilot_enabled = true` per utenti interni
  - Verifica: Query `SELECT email FROM users WHERE ocr_pilot_enabled = true;`
  - Evidenza: Lista email in `docs/phase3/cohort0-whitelist.md`

- [ ] **Monitoring enhanced attivo**
  - Dashboard costi real-time accessibile
  - Telemetria OCR aggregata visibile
  - Alert configurati e testati
  - Evidenza: Link dashboard o screenshot in `docs/phase3/cohort0-monitoring.md`

- [ ] **Primo report Cohort 0 compilato**
  - File: `docs/phase3/cohort0-report.md`
  - Contenuto: Immagini processate, costi, errori, clarification rate
  - Data: [YYYY-MM-DD]
  - Evidenza: File presente e compilato

---

## Gate: Cohort 0 → Cohort 1

**Status:** ⬜ TODO | 🟡 IN PROGRESS | ✅ DONE

- [ ] **Decisione esplicita: GO / NO-GO per Cohort 1**
  - Review meeting: Data [YYYY-MM-DD]
  - Partecipanti: [nomi]
  - Decisione: ✅ GO | ❌ NO-GO | ⚠️ GO con limitazioni
  - Motivo: [breve descrizione]
  - Evidenza: Entry in `PHASE_3_ROLLOUT_PLAN.md` → Decision Log

---

## Note Operative

- **Frequenza check:** Giornaliera durante Cohort 0, settimanale dopo
- **Owner:** Tech Lead (Pre-C0), Product Manager (Cohort 0+)
- **Blocco:** Se una voce BLOCKING non è ✅, NON avanzare alla fase successiva

---

## Comandi Rapidi

```bash
# Verifica PII
grep -r "base64\|fullName\|phone" lib/agent/workers/ocr.ts

# Verifica kill switch
grep -r "ENABLE_OCR_IMAGES" .env.local

# Verifica whitelist
# Query Supabase: SELECT email FROM users WHERE ocr_pilot_enabled = true;

# Verifica costi (Google Cloud Console)
# Dashboard: https://console.cloud.google.com/billing
```

