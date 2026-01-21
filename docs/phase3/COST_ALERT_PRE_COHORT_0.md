# Cost Alert & Budget Guard – Pre Cohort 0

**Data Audit:** 2025-01-XX  
**FinOps Engineer:** Cost Control Engineer  
**Obiettivo:** Implementare protezioni economiche per OCR immagini (Gemini Vision + LLM) prima di Cohort 0

---

## Scope

### Costi Coperti

1. **Gemini Vision (OCR Immagini)**
   - Chiamate API per estrazione dati da immagini
   - Modello: `gemini-2.0-flash-001` (multimodal)
   - Dove: `lib/agent/orchestrator/nodes.ts:97` - `llm.invoke([geminiMessage])`

2. **LLM Gemini (Estrazione Dati)**
   - Chiamate LLM per estrazione dati da testo (fallback)
   - Modello: `gemini-2.0-flash-001`
   - Dove: `lib/agent/orchestrator/nodes.ts:141-213` - LLM cleanup (legacy/fallback)

3. **Costi Accessori**
   - Retry policy: max 1 retry per errori transienti (potenzialmente 2x costo per immagine)
   - Timeout: 30 secondi (non genera costo diretto, ma può aumentare latenza)

### Costi NON Coperti (Out of Scope)

- Costi API corrieri (booking)
- Costi storage Supabase
- Costi Vercel hosting
- Costi altri servizi esterni

---

## Fonti di Costo

### Gemini Vision: Come si Misura

**Chiamata API:**

- **File:** `lib/agent/orchestrator/nodes.ts:97`
- **Metodo:** `llm.invoke([geminiMessage])` con `HumanMessage` contenente:
  - Text prompt (estrazione dati)
  - Image URL base64 (`data:image/jpeg;base64,...`)
- **Modello:** `gemini-2.0-flash-001` (configurato in `lib/config.ts:40`)

**Costo per Immagine:**

- **Input:** Immagine base64 (dimensioni variabili)
- **Output:** JSON con dati estratti (circa 500-1000 tokens)
- **Pricing (PRELIMINARE - da verificare in Google Cloud Console):**
  - Input tokens: ~1000-2000 tokens (immagine + prompt)
  - Output tokens: ~500-1000 tokens (JSON response)
  - **Stima conservativa:** €0.001-0.002 per immagine (da verificare)

**Retry Policy:**

- Max 1 retry per errori transienti (`lib/agent/workers/vision-fallback.ts:42`)
- **Impatto:** Potenzialmente 2x costo se retry necessario

### LLM: Come si Misura

**Chiamate LLM:**

- **File:** `lib/agent/orchestrator/nodes.ts:141-213`
- **Uso:** Post-processing dati OCR (legacy/fallback)
- **Modello:** `gemini-2.0-flash-001`
- **Frequenza:** Solo se Vision fallisce o dati parziali

**Costo per Chiamata:**

- **Input:** ~500-1000 tokens (dati estratti + prompt cleanup)
- **Output:** ~200-500 tokens (dati normalizzati)
- **Stima conservativa:** €0.0005-0.001 per chiamata (da verificare)

**Nota:** LLM viene usato principalmente come fallback, quindi costo minore rispetto a Vision.

### Altro (se esiste)

**Nessun altro costo diretto identificato per OCR flow.**

---

## Osservabilità

### Dove Vedere Costo per Immagine

**1. Google Cloud Console (Billing)**

- **URL:** https://console.cloud.google.com/billing
- **Path:** Billing → Reports → Filter by "Gemini API" o "Generative AI"
- **Metrica:** Costo per chiamata API
- **Granularità:** Per singola chiamata (se abilitato detailed billing)

**2. Google Cloud Console (Usage)**

- **URL:** https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/usage
- **Metrica:** Numero chiamate, tokens input/output
- **Granularità:** Giornaliera/settimanale

**3. Log Telemetria (Indiretto)**

- **File:** `lib/telemetry/logger.ts`
- **Evento:** `supervisorRouterComplete` con `ocr_source: 'image'`
- **Limite:** Non include costo diretto, solo conteggio immagini processate
- **Query esempio:**
  ```sql
  -- Conteggio immagini processate (da log telemetria)
  SELECT COUNT(*)
  FROM logs
  WHERE event = 'supervisorRouterComplete'
    AND ocr_source = 'image'
    AND created_at >= CURRENT_DATE;
  ```

**4. Database (Indiretto)**

- **Tabella:** `shipments`
- **Campo:** `created_via_ocr BOOLEAN` (indica se spedizione creata via OCR)
- **Query esempio:**
  ```sql
  -- Conteggio spedizioni create via OCR
  SELECT COUNT(*)
  FROM shipments
  WHERE created_via_ocr = true
    AND created_at >= CURRENT_DATE;
  ```

**⚠️ LIMITAZIONE:** Non c'è tracking diretto del costo per immagine nel database. Il costo deve essere calcolato moltiplicando il numero di immagini per il costo medio stimato.

### Dove Vedere Costo Giornaliero / Settimanale

**1. Google Cloud Console (Billing Dashboard)**

- **URL:** https://console.cloud.google.com/billing
- **Path:** Billing → Reports → Filter by service "Generative AI" → Group by "Day"
- **Metrica:** Costo totale giornaliero per Gemini API
- **Aggregazione:** Automatica per giorno/settimana

**2. Google Cloud Console (Cost Breakdown)**

- **URL:** https://console.cloud.google.com/billing
- **Path:** Billing → Cost breakdown → Filter by "Gemini" o "Generative AI"
- **Metrica:** Costo aggregato per periodo
- **Granularità:** Giornaliera, settimanale, mensile

**3. Query SQL (Stima Basata su Conteggio)**

```sql
-- Stima costo giornaliero OCR (basata su conteggio immagini)
SELECT
  DATE(created_at) as date,
  COUNT(*) as images_processed,
  COUNT(*) * 0.002 as estimated_cost_eur  -- Stima: €0.002 per immagine
FROM shipments
WHERE created_via_ocr = true
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**⚠️ LIMITAZIONE:** Query SQL fornisce solo stima basata su conteggio. Costo reale disponibile solo in Google Cloud Console.

### Query o Link Dashboard

**Dashboard Google Cloud Console:**

- **Billing Dashboard:** https://console.cloud.google.com/billing
- **API Usage:** https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/usage
- **Cost Breakdown:** https://console.cloud.google.com/billing/cost-breakdown

**Query Supabase (Stima):**

```sql
-- Conteggio immagini processate oggi
SELECT COUNT(*) as images_today
FROM shipments
WHERE created_via_ocr = true
  AND created_at >= CURRENT_DATE;

-- Conteggio immagini processate questa settimana
SELECT COUNT(*) as images_this_week
FROM shipments
WHERE created_via_ocr = true
  AND created_at >= DATE_TRUNC('week', CURRENT_DATE);
```

---

## Soglie Preliminari (Pre-Cohort 0)

### ⚠️ IMPORTANTE: Soglie PRELIMINARI

Le seguenti soglie sono **PRELIMINARI** e basate su **stime conservative**.  
Devono essere **aggiornate con dati reali** dopo i primi giorni di Cohort 0.

### Costo Giornaliero OCR: **€5.00** (PRELIMINARE)

**Motivazione:**

- Stima: 10-20 immagini/giorno in Cohort 0 (utenti interni)
- Costo per immagine: €0.002 (stima conservativa)
- Buffer 2x: €5.00/giorno = ~2500 immagini/giorno (molto conservativo)

**Aggiornamento:**

- Dopo 3 giorni di Cohort 0: ricalcolare basandosi su dati reali
- Dopo 1 settimana: aggiornare soglia definitiva

### Costo Settimanale OCR: **€30.00** (PRELIMINARE)

**Motivazione:**

- 6 giorni lavorativi × €5.00/giorno = €30.00
- Buffer aggiuntivo per weekend/variazioni

**Aggiornamento:**

- Dopo 1 settimana di Cohort 0: ricalcolare basandosi su dati reali

### Soglia Critica (Kill Switch): **€10.00/giorno** (PRELIMINARE)

**Motivazione:**

- 2x la soglia giornaliera normale
- Se raggiunta → attivare Kill Switch immediatamente

---

## Alert

### Tipo Alert: **AUTOMATICO** ✅ (Google Cloud Budget Alerts)

**✅ IMPLEMENTATO:** Alert automatici configurati in Google Cloud Console.

**Configurazione:**

- **Budget Target:** €10.00 (mensile)
- **Account Fatturazione:** SpedireSicuro
- **Progetto:** spedire-sicuro-geocoding

### Quando Scatta

**Configurazione Alert (Google Cloud Budget):**

1. **Alert 1 (50% Budget):**
   - Soglia: €5.00 (50% di €10.00)
   - Trigger: "Effettiva" (spesa effettiva)
   - **Azione:** Monitorare più frequentemente

2. **Alert 2 (80% Budget):**
   - Soglia: €8.00 (80% di €10.00)
   - Trigger: "Effettiva" (spesa effettiva)
   - **Azione:** Preparare Kill Switch, verificare anomalie

3. **Alert 3 (100% Budget):**
   - Soglia: €10.00 (100% di €10.00)
   - Trigger: "Effettiva" (spesa effettiva)
   - **Azione:** Review immediata, considerare Kill Switch

**Nota:** Budget mensile di €10.00 è intenzionalmente conservativo per pre-Cohort 0.  
Sarà aumentato a production-ready quando necessario. Per ora è appropriato per testing interno.

**Alert Critico (Kill Switch):**

- Costo giornaliero > €10.00 (soglia critica documentata)
- **Azione:** Attivare Kill Switch immediatamente

### Come Verificarlo

**Alert Automatici Configurati:**

1. **Email Notifications:**
   - ✅ Invio automatico a utenti e amministratori di fatturazione
   - ✅ Collegamento a Monitoring email notification channels
   - Progetto: spedire-sicuro-geocoding

2. **Verifica Alert:**
   - Google Cloud Console → Billing → Budget e avvisi
   - URL: `console.cloud.google.com/billing/.../budgets/.../edit`
   - Visualizza configurazione budget e soglie

3. **Verifica Costi Reali:**
   - Google Cloud Console → Billing → Reports
   - Filter: Service = "Generative AI" o "Gemini API"
   - Group by: Day
   - Period: Last 7 days

4. **Query Supabase (Stima):**
   ```sql
   -- Stima costo oggi (basata su conteggio)
   SELECT
     COUNT(*) as images_today,
     COUNT(*) * 0.002 as estimated_cost_eur
   FROM shipments
   WHERE created_via_ocr = true
     AND created_at >= CURRENT_DATE;
   ```

**Frequenza Check:**

- **Alert Automatici:** Email inviata automaticamente quando soglia raggiunta
- **Check Manuale:** 1 volta al giorno per verifica (opzionale, ma raccomandato)

**Nota:** Budget mensile di €10.00 è conservativo per Cohort 0. Considerare aumento a €30-50/mese se necessario.

---

## Reazione

### Azione Immediata

**Quando Alert Giallo (€3.00-€4.00/giorno):**

1. **Verifica Anomalie:**
   - Controlla log per immagini duplicate
   - Verifica retry rate (se > 20% → problema)
   - Controlla se utenti stanno abusando feature

2. **Monitoraggio Aumentato:**
   - Check ogni 4 ore invece di 2 volte/giorno
   - Verifica costo per utente (se possibile)

3. **Documentazione:**
   - Registra in `docs/phase3/cohort0-report.md`
   - Nota eventuali anomalie

**Quando Alert Arancione (€4.00-€5.00/giorno):**

1. **Tutte le azioni sopra +**
2. **Preparare Kill Switch:**
   - Verificare che `ENABLE_OCR_IMAGES=false` funzioni
   - Preparare comunicazione utenti (se necessario)

3. **Review Costi:**
   - Analizza costo per immagine (se > €0.002 → anomalia)
   - Verifica se ci sono chiamate duplicate

**Quando Alert Rosso (€5.00-€10.00/giorno):**

1. **Tutte le azioni sopra +**
2. **Review Immediata:**
   - Chi sta usando OCR? (verifica log)
   - Quante immagini processate? (verifica DB)
   - Costo medio per immagine? (calcola)

3. **Decisione:**
   - Se anomalia identificata → fix immediato
   - Se uso normale ma costoso → considerare Kill Switch

### Quando Attivare Kill Switch

**Condizioni per Kill Switch:**

1. **Costo Giornaliero > €10.00** (soglia critica)
   - **Azione:** Kill Switch immediato
   - **Tempo reazione:** < 1 ora

2. **Costo Medio per Immagine > €0.01** (5x stima)
   - **Azione:** Kill Switch + investigazione
   - **Tempo reazione:** < 2 ore

3. **Anomalia Identificata** (es: loop infinito, retry eccessivi)
   - **Azione:** Kill Switch + fix
   - **Tempo reazione:** < 30 minuti

**Procedura Kill Switch:**

1. **Imposta Flag:**

   ```bash
   # In Vercel Environment Variables
   ENABLE_OCR_IMAGES=false
   ```

2. **Riavvia Applicazione:**
   - Vercel: Automatico dopo cambio env var
   - Verifica: Test invio immagine → deve ritornare clarification

3. **Verifica:**
   - Check log: deve comparire "OCR immagini disabilitato"
   - Check costi: deve fermarsi crescita costi

4. **Comunicazione:**
   - Nota in `docs/phase3/cohort0-report.md`
   - Se necessario: comunicare a utenti interni

### Follow-up Richiesto

**Dopo Kill Switch Attivato:**

1. **Investigazione (24-48h):**
   - Analizza log per identificare causa
   - Calcola costo reale per immagine
   - Verifica se bug o uso normale

2. **Fix (se bug):**
   - Implementa fix
   - Test in locale/staging
   - Riattiva con monitoraggio aumentato

3. **Aggiornamento Soglie:**
   - Ricalcola soglie basandosi su dati reali
   - Aggiorna questo documento

**Dopo Alert (senza Kill Switch):**

1. **Review Settimanale:**
   - Analizza trend costi
   - Aggiorna soglie se necessario
   - Documenta in `docs/phase3/cohort0-report.md`

2. **Ottimizzazione (se necessario):**
   - Riduci retry rate se possibile
   - Ottimizza prompt per ridurre tokens
   - Considera caching per immagini duplicate

---

## Decisione

### ESITO: **PASS** ✅

**Motivazione:**

1. ✅ **Fonti di Costo Identificate:** Gemini Vision, LLM
2. ✅ **Osservabilità Documentata:** Google Cloud Console, query SQL
3. ✅ **Soglie Preliminari Definite:** €5.00/giorno, €30.00/settimana
4. ✅ **Alert Automatici Implementati:** Google Cloud Budget Alerts configurati
5. ✅ **Procedura Reazione Documentata:** Kill Switch, follow-up

**Limitazioni Note:**

1. **Budget Mensile Conservativo (Intenzionale):**
   - Budget configurato: €10.00/mese (~€0.33/giorno)
   - Soglie documentate: €5.00/giorno, €30.00/settimana
   - **Nota:** Budget attuale è intenzionalmente conservativo per pre-Cohort 0 (testing interno)
   - **Piano:** Budget sarà aumentato a production-ready quando necessario

2. **Soglie PrelIMINARI:**
   - Basate su stime, non dati reali
   - Devono essere aggiornate dopo 3-7 giorni di Cohort 0
   - **Mitigazione:** Review settimanale obbligatoria

3. **Tracking Costo per Immagine:**
   - Non implementato nel database
   - Deve essere calcolato manualmente (conteggio × costo medio)
   - **Mitigazione:** Query SQL per conteggio, Google Cloud Console per costo reale

4. **Costo Reale Non Verificato:**
   - Prezzi Gemini 2.0 Flash Vision non verificati in Google Cloud Console
   - Stime basate su pricing tipico API simili
   - **Mitigazione:** Verificare pricing reale prima di Cohort 0

### Impatto su Cohort 0: **NON BLOCCANTE** ✅

**Cohort 0 può procedere** con le seguenti condizioni:

1. ✅ Sistema di osservabilità documentato
2. ✅ Soglie preliminari conservative definite
3. ✅ Procedura reazione documentata
4. ✅ Alert automatici configurati (Google Cloud Budget)
5. ✅ Budget conservativo appropriato per pre-Cohort 0 (sarà aumentato in produzione)
6. ⚠️ **RACCOMANDATO:** Verificare pricing reale Gemini in Google Cloud Console prima di Cohort 0
7. ⚠️ **RACCOMANDATO:** Aggiornare soglie dopo 3-7 giorni con dati reali

### Follow-up Richiesti

**Prima di Cohort 0:**

1. **Verificare Pricing Reale:**
   - Aprire Google Cloud Console
   - Verificare pricing Gemini 2.0 Flash Vision
   - Aggiornare stime in questo documento

2. **Budget Pre-Cohort 0:**
   - Budget attuale: €10.00/mese (~€0.33/giorno) - appropriato per testing interno
   - **Piano:** Budget sarà aumentato a production-ready quando necessario

**Durante Cohort 0:**

1. **Monitoraggio Alert Automatici:**
   - Verificare email alert quando soglie raggiunte
   - Check manuale 1x/giorno per verifica (opzionale)

2. **Documentazione:**
   - Registrare costi in `docs/phase3/cohort0-report.md`
   - Notare anomalie o pattern
   - Verificare che alert funzionino correttamente

**Dopo Cohort 0 (Settimana 1):**

1. **Aggiornare Soglie:**
   - Ricalcolare basandosi su dati reali
   - Aggiornare budget mensile se necessario
   - Aggiornare questo documento

2. **Ottimizzare Alert:**
   - Verificare che soglie siano appropriate
   - Aggiungere alert aggiuntivi se necessario

---

## Note Aggiuntive

### Verifica Pricing Gemini (TODO)

**Prima di Cohort 0, verificare:**

- Pricing reale Gemini 2.0 Flash Vision in Google Cloud Console
- Costo per 1K input tokens
- Costo per 1K output tokens
- Costo per immagine (se pricing specifico)

**Aggiornare questo documento con pricing reale.**

### Query Utili

**Conteggio Immagini Processate Oggi:**

```sql
SELECT COUNT(*) as images_today
FROM shipments
WHERE created_via_ocr = true
  AND created_at >= CURRENT_DATE;
```

**Stima Costo Settimanale:**

```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as images,
  COUNT(*) * 0.002 as estimated_cost_eur
FROM shipments
WHERE created_via_ocr = true
  AND created_at >= DATE_TRUNC('week', CURRENT_DATE)
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Costo Medio per Immagine (Stima):**

```sql
-- Calcola costo medio basandosi su totale settimanale
SELECT
  COUNT(*) as total_images,
  COUNT(*) * 0.002 as total_estimated_cost,
  (COUNT(*) * 0.002) / NULLIF(COUNT(*), 0) as avg_cost_per_image
FROM shipments
WHERE created_via_ocr = true
  AND created_at >= DATE_TRUNC('week', CURRENT_DATE);
```

### Riferimenti

- **Kill Switch:** `docs/phase3/KILL_SWITCH_DRY_RUN_PRE_COHORT_0.md`
- **PII Audit:** `docs/phase3/PII_AUDIT_PRE_COHORT_0.md`
- **Rollout Plan:** `PHASE_3_ROLLOUT_PLAN.md:25-26`

---

## Conclusione

**COST ALERT & BUDGET GUARD IMPLEMENTATO** ✅

Il sistema è **protetto economicamente**:

- ✅ Fonti di costo identificate
- ✅ Osservabilità documentata
- ✅ Soglie preliminari conservative
- ✅ Procedura reazione documentata
- ✅ Alert automatici configurati (Google Cloud Budget)
- ✅ Budget conservativo appropriato per pre-Cohort 0 (sarà aumentato in produzione)

**Cohort 0 può procedere** con alert automatici attivi e budget conservativo per testing interno.
