# 🔬 COME TESTARE OCR CLAUDE VISION

**Data:** 29 Novembre 2024
**Status:** ✅ OCR Claude Vision ATTIVO

---

## 📋 Prerequisiti

### 1. Verifica API Key Configurata

File: `.env.local`
```env
ANTHROPIC_API_KEY=sk-ant-api03-xxx...xxxYOUR_API_KEY_HERE
```

✅ API Key presente e valida (sostituisci con la tua vera key)

### 2. Verifica Build

```bash
npm run build
```

**Risultato Atteso:** ✅ Build PASSING

---

## 🧪 Test OCR Claude Vision

### STEP 1: Avvia Server Locale

```bash
npm run dev
```

**Output Atteso:**
```
▲ Next.js 14.2.33
- Local:   http://localhost:3000
✓ Ready in 2.3s
```

### STEP 2: Login

1. Apri browser: `http://localhost:3000/login`
2. Login con:
   - Email: `admin@spediresicuro.it`
   - Password: `admin123`
3. ✅ Redirect a `/dashboard`

### STEP 3: Prepara Immagine LDV Test

**Opzioni:**

**A. Usa Immagine LDV Reale** (Consigliato per test accuratezza)
- Scannerizza o fotografa una Lettera di Vettura reale
- Formati supportati: JPG, PNG, WebP
- Risoluzione consigliata: 1200x1600px min

**B. Usa Immagine Mock** (Per test funzionalità)
- Crea screenshot di esempio con:
  - Nome destinatario
  - Indirizzo completo
  - CAP e città
  - Telefono

**C. Scarica Template LDV**
- Cerca online "template LDV italiana"
- Compila con dati fittizi
- Usa come test

### STEP 4: Upload e Test OCR

1. **Vai su:** `http://localhost:3000/dashboard/spedizioni/nuova`

2. **Verifica Mittente Precompilato:**
   - Se hai configurato mittente in `/dashboard/impostazioni`, i campi mittente dovrebbero essere già compilati
   - Altrimenti, compila manualmente

3. **Click "Carica da Scanner OCR"**
   - Si apre modal di upload

4. **Upload Immagine:**
   - Trascina immagine LDV o click "Seleziona file"
   - Formati: JPG, PNG, WebP (max 10MB)

5. **Attendi Elaborazione:**
   - Loading spinner (2-5 secondi)
   - **Console Browser:** Apri DevTools (F12) → tab Console
   - Cerca messaggio:
     ```
     ✅ OCR Claude Vision ATTIVO - consumerà crediti Anthropic
     ```

6. **Verifica Risultati:**
   - Form destinatario viene compilato automaticamente
   - Controlla campi:
     - ✅ Nome destinatario
     - ✅ Indirizzo completo
     - ✅ Città
     - ✅ CAP (5 cifre)
     - ✅ Provincia (2 lettere)
     - ✅ Telefono (se presente nell'immagine)

### STEP 5: Valuta Accuratezza

**Confronta dati estratti con immagine originale:**

| Campo | Corretto? | Note |
|-------|-----------|------|
| Nome destinatario | ☐ Sì ☐ No | |
| Indirizzo | ☐ Sì ☐ No | |
| Città | ☐ Sì ☐ No | |
| CAP | ☐ Sì ☐ No | |
| Provincia | ☐ Sì ☐ No | |
| Telefono | ☐ Sì ☐ No | |

**Scoring:**
- 6/6 ✅ **Perfetto** - OCR funziona correttamente
- 4-5/6 ⚠️ **Buono** - Piccole correzioni necessarie
- 2-3/6 ❌ **Scarso** - Necessita debug prompt
- 0-1/6 ❌ **Fallito** - Problema serio, segnala

---

## 🐛 Troubleshooting

### ❌ Console Mostra "Mock OCR"

**Problema:** Console browser mostra:
```
⚠️ OCR automatico disabilitato - usando Mock
```

**Causa:** `ANTHROPIC_API_KEY` non configurata o non letta

**Soluzione:**
1. Verifica `.env.local` contiene `ANTHROPIC_API_KEY`
2. Riavvia server: `Ctrl+C` → `npm run dev`
3. Cancella cache browser (Ctrl+Shift+Del)
4. Riprova upload

---

### ❌ Errore "API Key Invalid"

**Problema:** Console mostra errore API key non valida

**Causa:** API key scaduta o errata

**Soluzione:**
1. Vai su https://console.anthropic.com/
2. Verifica API key attiva
3. Genera nuova key se necessario
4. Aggiorna `.env.local`
5. Riavvia server

---

### ❌ Timeout o Errore di Rete

**Problema:** Loading infinito o errore "Network Error"

**Causa:** Firewall, proxy, o problemi di rete

**Soluzione:**
1. Verifica connessione internet
2. Disabilita firewall/antivirus temporaneamente
3. Prova con VPN disabilitata
4. Controlla console browser per dettagli errore

---

### ❌ Dati Estratti Sbagliati o Inventati

**Problema:** OCR estrae dati non presenti nell'immagine

**Causa Probabile:**
- Immagine di scarsa qualità
- Prompt non ottimizzato per LDV italiane
- Model temperature troppo alta

**Soluzione Immediata:**
1. Riprova con immagine ad alta risoluzione (1200x1600px min)
2. Assicurati che testo sia leggibile anche a occhio umano
3. Evita riflessi, ombre, angoli storti

**Debug Prompt (Avanzato):**

File: `lib/adapters/ocr/claude.ts` (linea ~60)

```typescript
const prompt = `
Sei un esperto OCR per documenti logistici italiani.

TASK: Estrai SOLO i dati del DESTINATARIO da questa Lettera di Vettura (LDV).

IMPORTANTE:
- Estrai SOLO dati visibili nell'immagine
- NON inventare dati mancanti
- Se un campo non è leggibile, omettilo
- Rispondi SOLO in formato JSON valido

CAMPI DA ESTRARRE:
- recipient_name: Nome completo destinatario
- recipient_address: Indirizzo completo (via, numero civico)
- recipient_city: Città
- recipient_zip: CAP (5 cifre)
- recipient_province: Provincia (2 lettere maiuscole)
- recipient_phone: Telefono (se presente)

FORMATO RISPOSTA (JSON):
{
  "recipient_name": "testo estratto o vuoto",
  "recipient_address": "testo estratto o vuoto",
  "recipient_city": "testo estratto o vuoto",
  "recipient_zip": "testo estratto o vuoto",
  "recipient_province": "testo estratto o vuoto",
  "recipient_phone": "testo estratto o vuoto"
}

RISPONDI SOLO CON IL JSON, NIENTE ALTRO.
`.trim();
```

**Parametri Model (se accuratezza scarsa):**

```typescript
const response = await this.client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  temperature: 0, // 👈 Abbassare a 0 per maggiore accuratezza
  messages: [/* ... */]
});
```

---

## 💰 Monitoraggio Costi

### Verifica Utilizzo API

1. **Vai su:** https://console.anthropic.com/dashboard
2. **Sezione:** "Usage & Billing"
3. **Controlla:**
   - Token input/output usati oggi
   - Costo totale giornaliero
   - Crediti rimanenti

### Costi Attesi (Test)

| Azione | Token Input | Token Output | Costo Stimato |
|--------|-------------|--------------|---------------|
| 1 upload LDV | ~500-1000 | ~100-200 | $0.003-0.005 |
| 10 test | ~5k-10k | ~1k-2k | $0.03-0.05 |
| 100 test | ~50k-100k | ~10k-20k | $0.30-0.50 |

**Model Pricing (Claude 3.5 Sonnet):**
- Input: $3.00 / 1M tokens
- Output: $15.00 / 1M tokens

### Alert Costi

Se superi **$5.00/giorno** durante test:
1. ⚠️ **STOP TEST** - Possibile problema loop/bug
2. Controlla console Anthropic per dettagli
3. Verifica log server per chiamate ripetute
4. Segnala anomalia

---

## 📊 Logging e Debug

### Console Browser (DevTools)

**Messaggi Attesi:**

✅ **Successo:**
```
✅ OCR Claude Vision ATTIVO - consumerà crediti Anthropic
OCR extraction completed: { recipient_name: "Mario Rossi", ... }
```

⚠️ **Fallback Mock:**
```
⚠️ ANTHROPIC_API_KEY non configurata - usando Mock OCR
```

❌ **Errore:**
```
Error calling Claude Vision API: [dettagli]
Fallback to Mock OCR
```

### Console Server (Terminal)

**Durante upload vedrai:**

```bash
POST /api/ocr/extract 200 in 2543ms
```

**Se errore:**
```bash
Error: Anthropic API key not configured
POST /api/ocr/extract 500 in 54ms
```

---

## 🎯 Obiettivo Test

**Success Criteria:**

1. ✅ OCR estrae dati **reali** dall'immagine (non inventati)
2. ✅ Accuratezza ≥ 80% (5/6 campi corretti)
3. ✅ Tempo elaborazione < 5 secondi
4. ✅ Nessun errore di rete/API
5. ✅ Costo per upload < $0.01

**Se tutti i criteri soddisfatti:**
- 🎉 OCR pronto per produzione
- Documentare eventuali limitazioni (es. solo immagini ad alta risoluzione)

**Se criteri non soddisfatti:**
- 🔧 Debug necessario (vedi sezione Troubleshooting)
- Segnalare problemi specifici
- Valutare alternative (Tesseract.js, Google Vision, etc.)

---

## 🔄 Come Disabilitare OCR (Se Necessario)

Se durante test scopri che OCR non funziona bene e vuoi tornare a Mock:

### Opzione A: Rimuovi API Key (Temporaneo)

File: `.env.local`
```env
# ANTHROPIC_API_KEY=sk-ant-api03-xxx  # 👈 Commenta questa riga
```

Riavvia server → OCR usa automaticamente Mock

### Opzione B: Forza Mock nel Codice

File: `lib/adapters/ocr/base.ts`
```typescript
case 'auto':
default: {
  // FORCE MOCK per debug
  console.warn('⚠️ OCR forzato a Mock per debug');
  const { ImprovedMockOCRAdapter } = require('./mock');
  return new ImprovedMockOCRAdapter();
}
```

---

## 📝 Report Test

Dopo aver completato i test, compila questo report:

```markdown
# Report Test OCR Claude Vision

**Data:** [inserisci data]
**Tester:** [tuo nome]
**Immagini Testate:** [numero]

## Risultati

| Immagine | Qualità | Accuratezza | Tempo | Note |
|----------|---------|-------------|-------|------|
| 1 | Alta/Media/Bassa | 6/6 | 2.3s | ... |
| 2 | Alta/Media/Bassa | 5/6 | 3.1s | ... |
| ... | | | | |

## Conclusione

- ☐ OCR funziona bene → Pronto per produzione
- ☐ OCR ha problemi → Necessita debug
- ☐ OCR non funziona → Usare Mock o alternative

## Note Aggiuntive

[Eventuali osservazioni, bug, suggerimenti...]
```

---

## 🆘 Supporto

### Documentazione

- **Setup:** `GUIDA_SETUP_LOCALE.md`
- **Fix:** `FIX_OCR_AUTOCOMPLETAMENTO.md`
- **Status:** `STATUS_FINALE_IMPLEMENTAZIONE.md`

### Link Utili

- Anthropic Console: https://console.anthropic.com/
- Anthropic Docs: https://docs.anthropic.com/
- Claude Vision Guide: https://docs.anthropic.com/claude/docs/vision

---

**Buon Test! 🚀**
